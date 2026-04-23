"""
AFRILEARN — Backend Flask sécurisé
- Authentification réelle avec hachage werkzeug (PBKDF2-SHA256)
- Sessions signées via Flask secret_key
- Protection CSRF sur tous les formulaires POST
- Rate-limiting sur login (5 tentatives / 15 min par email)
- Routes admin protégées par rôle
- Pas de debug=True en production
"""
from __future__ import annotations

import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    abort,
    g,
    jsonify,
    redirect,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

from init_db import DEFAULT_PROGRESS, ensure_database


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _is_production_env() -> bool:
    return any((
        os.environ.get("AFRILEARN_ENV", "").strip().lower() == "production",
        os.environ.get("FLASK_ENV", "").strip().lower() == "production",
        "DYNO" in os.environ,
        "RENDER" in os.environ,
        "PORT" in os.environ and os.environ.get("FLASK_DEBUG", "0") != "1",
    ))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "afrilearn.db"

ensure_database(DB_PATH)

app = Flask(__name__, static_folder=".", static_url_path="")

# Secret key: lire depuis l'env ou générer un aléatoire stable
_KEY_FILE = BASE_DIR / "data" / ".secret_key"
if _KEY_FILE.exists():
    app.secret_key = _KEY_FILE.read_bytes()
else:
    _key = secrets.token_bytes(32)
    _KEY_FILE.write_bytes(_key)
    app.secret_key = _key

session_cookie_secure = _env_flag("SESSION_COOKIE_SECURE", _is_production_env())

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=session_cookie_secure,
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)
if session_cookie_secure:
    app.config["PREFERRED_URL_SCHEME"] = "https"

# ---------------------------------------------------------------------------
# CSRF
# ---------------------------------------------------------------------------
def _generate_csrf_token() -> str:
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return session["csrf_token"]

def _validate_csrf(token: str) -> bool:
    expected = session.get("csrf_token", "")
    return secrets.compare_digest(expected, token)

@app.context_processor
def inject_csrf():
    return {"csrf_token": _generate_csrf_token()}

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
COLLECTION_NAMES = [
    "stats","languages","sciences","resources","news","events",
    "forumTopics","badges","dictionary","performance","admin",
]

def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db:
        db.close()

def load_collection(name: str):
    row = get_db().execute(
        "SELECT payload FROM collections WHERE name=?", (name,)
    ).fetchone()
    return json.loads(row["payload"]) if row else None

def profile_payload(email: str) -> dict | None:
    db = get_db()
    profile = db.execute(
        "SELECT email,first_name,country,region,native_language FROM profiles WHERE email=?",
        (email,),
    ).fetchone()
    if not profile:
        return None
    snapshot = db.execute(
        """SELECT active_tracks,lessons_completed,weekly_minutes,certifications
           FROM progress_snapshots WHERE profile_email=?""",
        (email,),
    ).fetchone()
    tracks = db.execute(
        """SELECT title,percentage,next_step,detail FROM progress_tracks
           WHERE profile_email=? ORDER BY sort_order ASC""",
        (email,),
    ).fetchall()
    return {
        "profile": {
            "firstName": profile["first_name"],
            "country": profile["country"],
            "region": profile["region"],
            "nativeLanguage": profile["native_language"],
            "email": profile["email"],
        },
        "progress": {
            "activeTracks": snapshot["active_tracks"] if snapshot else DEFAULT_PROGRESS["activeTracks"],
            "lessonsCompleted": snapshot["lessons_completed"] if snapshot else DEFAULT_PROGRESS["lessonsCompleted"],
            "weeklyMinutes": snapshot["weekly_minutes"] if snapshot else DEFAULT_PROGRESS["weeklyMinutes"],
            "certifications": snapshot["certifications"] if snapshot else DEFAULT_PROGRESS["certifications"],
            "tracks": [
                {"title": r["title"],"percentage": r["percentage"],
                 "nextStep": r["next_step"],"detail": r["detail"]}
                for r in tracks
            ] or DEFAULT_PROGRESS["tracks"],
        },
    }

def ensure_profile_progress(email: str) -> None:
    db = get_db()
    if not db.execute(
        "SELECT 1 FROM progress_snapshots WHERE profile_email=?", (email,)
    ).fetchone():
        db.execute(
            """INSERT INTO progress_snapshots(profile_email,active_tracks,lessons_completed,
                                              weekly_minutes,certifications)
               VALUES(?,?,?,?,?)""",
            (email, DEFAULT_PROGRESS["activeTracks"], DEFAULT_PROGRESS["lessonsCompleted"],
             DEFAULT_PROGRESS["weeklyMinutes"], DEFAULT_PROGRESS["certifications"]),
        )
    if not db.execute(
        "SELECT COUNT(*) AS c FROM progress_tracks WHERE profile_email=?", (email,)
    ).fetchone()["c"]:
        for i, t in enumerate(DEFAULT_PROGRESS["tracks"], 1):
            db.execute(
                """INSERT INTO progress_tracks(profile_email,title,percentage,next_step,detail,sort_order)
                   VALUES(?,?,?,?,?,?)""",
                (email, t["title"], t["percentage"], t["nextStep"], t["detail"], i),
            )

# ---------------------------------------------------------------------------
# Rate limiting (5 échecs / 15 min)
# ---------------------------------------------------------------------------
MAX_ATTEMPTS = 5
WINDOW_MINUTES = 15

def _check_rate_limit(email: str) -> bool:
    """Retourne True si bloqué."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MINUTES)).isoformat()
    row = get_db().execute(
        """SELECT COUNT(*) AS c FROM login_attempts
           WHERE email=? AND success=0 AND attempted_at > ?""",
        (email, cutoff),
    ).fetchone()
    return row["c"] >= MAX_ATTEMPTS

def _record_attempt(email: str, success: bool, ip: str | None) -> None:
    db = get_db()
    db.execute(
        "INSERT INTO login_attempts(email,success,ip_address) VALUES(?,?,?)",
        (email, 1 if success else 0, ip),
    )
    db.commit()

# ---------------------------------------------------------------------------
# Auth decorators
# ---------------------------------------------------------------------------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "authentification requise", "redirect": "/authentification.html"}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "authentification requise"}), 401
        if session.get("role") != "admin":
            return jsonify({"error": "accès réservé aux administrateurs"}), 403
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}

    # CSRF
    if not _validate_csrf(data.get("csrf_token", "")):
        return jsonify({"error": "jeton CSRF invalide"}), 403

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    first_name = str(data.get("firstName", "")).strip() or "Apprenant"
    country = str(data.get("country", "")).strip() or "RDC"
    region = str(data.get("region", "")).strip() or "Sud-Kivu"
    native_language = str(data.get("nativeLanguage", "")).strip() or "Swahili"

    if not email or "@" not in email:
        return jsonify({"error": "e-mail invalide"}), 400
    if len(password) < 8:
        return jsonify({"error": "le mot de passe doit faire au moins 8 caractères"}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        return jsonify({"error": "un compte existe déjà avec cet e-mail"}), 409

    pw_hash = generate_password_hash(password)
    db.execute(
        "INSERT INTO users(email,password_hash,role) VALUES(?,?,'learner')",
        (email, pw_hash),
    )
    db.execute(
        """INSERT INTO profiles(email,first_name,country,region,native_language)
           VALUES(?,?,?,?,?)
           ON CONFLICT(email) DO UPDATE SET
               first_name=excluded.first_name, country=excluded.country,
               region=excluded.region, native_language=excluded.native_language,
               updated_at=CURRENT_TIMESTAMP""",
        (email, first_name, country, region, native_language),
    )
    ensure_profile_progress(email)
    db.commit()

    # Auto-login
    user = db.execute("SELECT id,role FROM users WHERE email=?", (email,)).fetchone()
    session.permanent = True
    session["user_id"] = user["id"]
    session["email"] = email
    session["role"] = user["role"]

    return jsonify({"ok": True, "email": email, "role": user["role"]}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}

    # CSRF
    if not _validate_csrf(data.get("csrf_token", "")):
        return jsonify({"error": "jeton CSRF invalide"}), 403

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    ip = request.remote_addr

    if not email or not password:
        return jsonify({"error": "e-mail et mot de passe requis"}), 400

    # Rate limit
    if _check_rate_limit(email):
        return jsonify({"error": f"Trop de tentatives. Réessayez dans {WINDOW_MINUTES} minutes."}), 429

    db = get_db()
    user = db.execute(
        """SELECT u.id, u.email, u.password_hash, u.role, u.is_active, p.first_name 
           FROM users u
           LEFT JOIN profiles p ON p.email = u.email
           WHERE u.email=?""",
        (email,),
    ).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        _record_attempt(email, False, ip)
        # Message générique pour éviter l'énumération
        return jsonify({"error": "identifiants incorrects"}), 401

    if not user["is_active"]:
        return jsonify({"error": "compte désactivé, contactez l'administration"}), 403

    _record_attempt(email, True, ip)
    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    session["email"] = user["email"]
    session["role"] = user["role"]

    return jsonify({"ok": True, "email": user["email"], "role": user["role"], "firstName": user["first_name"]})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/auth/me")
def me():
    if "user_id" not in session:
        return jsonify({"authenticated": False}), 200
    
    db = get_db()
    profile = db.execute("SELECT first_name FROM profiles WHERE email=?", (session.get("email"),)).fetchone()
    first_name = profile["first_name"] if profile else "Membre"

    return jsonify({
        "authenticated": True,
        "email": session.get("email"),
        "role": session.get("role"),
        "firstName": first_name,
    })

# ---------------------------------------------------------------------------
# CSRF token endpoint (pour les clients JS)
# ---------------------------------------------------------------------------
@app.get("/api/csrf-token")
def csrf_token_endpoint():
    return jsonify({"csrf_token": _generate_csrf_token()})

# ---------------------------------------------------------------------------
# Data endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
def healthcheck():
    return jsonify({
        "status": "ok",
        "engine": "sqlite",
        "database": str(DB_PATH.relative_to(BASE_DIR)),
    })

@app.get("/api/bootstrap")
def bootstrap():
    payload = {name: load_collection(name) for name in COLLECTION_NAMES}
    payload["source"] = "sqlite"
    db = get_db()
    payload["dbInfo"] = {
        "engine": "SQLite",
        "path": str(DB_PATH.relative_to(BASE_DIR)),
        "tables": db.execute(
            "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()["c"],
        "collections": db.execute("SELECT COUNT(*) AS c FROM collections").fetchone()["c"],
        "profiles": db.execute("SELECT COUNT(*) AS c FROM profiles").fetchone()["c"],
    }
    email = session.get("email")
    if email:
        payload.update(profile_payload(email) or {})
    return jsonify(payload)


@app.get("/api/profile")
@login_required
def get_profile():
    email = request.args.get("email", session["email"]).strip().lower()
    # Un utilisateur normal ne peut voir que son propre profil
    if session.get("role") != "admin" and email != session["email"]:
        return jsonify({"error": "accès refusé"}), 403
    payload = profile_payload(email)
    if not payload:
        return jsonify({"error": "profil introuvable"}), 404
    return jsonify(payload)


@app.post("/api/profile")
@login_required
def upsert_profile():
    data = request.get_json(silent=True) or {}

    if not _validate_csrf(data.get("csrf_token", "")):
        return jsonify({"error": "jeton CSRF invalide"}), 403

    email = session["email"]  # Toujours l'email de session — pas celui du body
    first_name = str(data.get("firstName", "")).strip() or "Apprenant"
    country = str(data.get("country", "")).strip() or "RDC"
    region = str(data.get("region", "")).strip() or "Sud-Kivu"
    native_language = str(data.get("nativeLanguage", "")).strip() or "Swahili"

    db = get_db()
    db.execute(
        """INSERT INTO profiles(email,first_name,country,region,native_language)
           VALUES(?,?,?,?,?)
           ON CONFLICT(email) DO UPDATE SET
               first_name=excluded.first_name, country=excluded.country,
               region=excluded.region, native_language=excluded.native_language,
               updated_at=CURRENT_TIMESTAMP""",
        (email, first_name, country, region, native_language),
    )
    ensure_profile_progress(email)
    db.commit()
    return jsonify(profile_payload(email))


# Admin-only: liste des utilisateurs
@app.get("/api/admin/users")
@admin_required
def admin_users():
    db = get_db()
    rows = db.execute(
        "SELECT id,email,role,is_active,created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])

# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return app.send_static_file("index.html")

@app.get("/<path:path>")
def static_proxy(path: str):
    if path.startswith("api/"):
        abort(404)
    return app.send_static_file(path)

# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------
@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Jamais debug=True en production
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug, port=5000)
