from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

from werkzeug.security import generate_password_hash


COLLECTIONS = {
    "stats": [
        {"value": "06", "label": "langues planifiées pour les premières phases"},
        {"value": "10", "label": "disciplines scientifiques prévues"},
        {"value": "04", "label": "compétences linguistiques structurantes"},
        {"value": "04", "label": "tables principales dans la base SQLite"},
    ],
    "languages": [
        {"phase": "Phase 1A", "name": "Swahili", "zone": "Est de la RDC, Grands Lacs", "level": "A1 à C2",
         "description": "Langue de lancement, avec parcours linguistique complet et premiers modules scientifiques."},
        {"phase": "Phase 1B", "name": "Mashi", "zone": "Sud-Kivu", "level": "A1 à B2",
         "description": "Extension régionale pour renforcer l'ancrage culturel et scolaire du projet."},
        {"phase": "Phase 1B", "name": "Kilega", "zone": "Maniema, Sud-Kivu", "level": "A1 à B2",
         "description": "Intégration progressive autour des contenus de base, des enregistrements et des glossaires."},
        {"phase": "Phase 1B", "name": "Kinande", "zone": "Nord-Kivu", "level": "A1 à B2",
         "description": "Déploiement linguistique régional avec ressources communautaires et médiathèque dédiée."},
        {"phase": "Phase 1B", "name": "Kihunde", "zone": "Nord-Kivu", "level": "A1 à B2",
         "description": "Parcours structuré prévu avec mise en avant des locuteurs natifs et des ressources orales."},
        {"phase": "Phase 1B", "name": "Kinyarwanda", "zone": "Rwanda, Est RDC", "level": "A1 à B2",
         "description": "Ouverture régionale cohérente avec l'espace des Grands Lacs."},
    ],
    "sciences": [
        {"label": "Mathématiques", "level": "Collège - Lycée",
         "description": "Numération, algèbre, géométrie, proportionnalité et statistiques, avec un lexique stabilisé pour l'explication des raisonnements et la résolution de problèmes."},
        {"label": "Sciences de la santé", "level": "Lycée - Supérieur",
         "description": "Anatomie fonctionnelle, hygiène, prévention, premiers secours et santé communautaire, dans une approche utile aux contextes scolaires et de terrain."},
        {"label": "SVT", "level": "Collège - Lycée",
         "description": "Biologie, écologie, nutrition, reproduction et étude du vivant, avec des exemples tirés des milieux locaux."},
        {"label": "Physique", "level": "Collège - Lycée",
         "description": "Mouvement, énergie, forces, électricité et mesures, avec des activités guidées pour relier notions abstraites et observations concrètes."},
        {"label": "Chimie", "level": "Lycée",
         "description": "Structure de la matière, mélanges, réactions chimiques et sécurité au laboratoire, avec vocabulaire scientifique progressif."},
        {"label": "Histoire africaine", "level": "Collège - Supérieur",
         "description": "Civilisations, royaumes, circulations, résistances et sources historiques, pour construire des repères solides sur les sociétés africaines."},
        {"label": "Géographie", "level": "Collège - Supérieur",
         "description": "Cartographie, climat, peuplement, reliefs et ressources, avec articulation entre échelles locale, nationale et régionale."},
        {"label": "Entrepreneuriat", "level": "Lycée - Supérieur",
         "description": "Calcul de coûts, organisation coopérative, gestion d'activité et initiatives locales, pour relier formation et insertion socio-économique."},
    ],
    "resources": [
        {"type": "audio", "tag": "Bibliothèque audio", "title": "Proverbes swahili de la transmission",
         "description": "Collection de proverbes commentés par un locuteur natif.", "meta": "12 min · MP3 · Swahili"},
        {"type": "audio", "tag": "Conversation", "title": "Dialogue du marché",
         "description": "Compréhension orale autour d'une situation du quotidien.", "meta": "08 min · MP3 · Débutant"},
        {"type": "video", "tag": "Cours vidéo", "title": "Introduction aux mathématiques en swahili",
         "description": "Capsule scientifique avec résumé et lexique bilingue.", "meta": "18 min · MP4 · Collège"},
        {"type": "video", "tag": "Conférence", "title": "Langues africaines et sciences",
         "description": "Intervention sur la transmission du savoir en langue locale.", "meta": "34 min · MP4 · Conférence"},
        {"type": "texte", "tag": "Texte culturel", "title": "Contes fondateurs des Grands Lacs",
         "description": "Anthologie de récits transcrits avec contextualisation culturelle.", "meta": "PDF · Lecture guidée"},
        {"type": "texte", "tag": "Lexique", "title": "Lexique scientifique bilingue",
         "description": "Premiers termes mathématiques et scientifiques en swahili/français.", "meta": "PDF · Référence"},
        {"type": "telechargement", "tag": "Fiche pédagogique", "title": "Guide grammatical swahili A1",
         "description": "Fiche de révision téléchargeable pour le parcours débutant.", "meta": "PDF · Téléchargement"},
        {"type": "telechargement", "tag": "Phrasebook", "title": "Expressions courantes par contexte",
         "description": "Recueil classé pour saluer, demander, expliquer et argumenter.", "meta": "PDF · Phrasebook"},
    ],
    "news": [
        {"tag": "Produit", "title": "MVP AFRILEARN enrichi avec sécurité et design",
         "description": "Authentification sécurisée, sessions, protection CSRF et refonte visuelle.", "meta": "Avril 2026"},
        {"tag": "Contenus", "title": "Priorité éditoriale donnée au swahili",
         "description": "Les premiers parcours et lexiques se concentrent sur le swahili avant les autres langues.", "meta": "Phase 1A"},
        {"tag": "Partenariats", "title": "Recherche de linguistes, formateurs et contributeurs",
         "description": "La structuration du contenu dépend du recrutement de référents linguistiques et scientifiques.", "meta": "En cours"},
    ],
    "events": [
        {"tag": "Atelier", "title": "Pratique orale swahili",
         "description": "Session hebdomadaire de conversation avec mise en situation.", "meta": "24 avril 2026 · En ligne"},
        {"tag": "Webinaire", "title": "Sciences en langues africaines",
         "description": "Présentation du module scientifique et des besoins en terminologie.", "meta": "30 avril 2026 · Visioconférence"},
        {"tag": "Rencontre", "title": "Atelier de structuration des contenus",
         "description": "Organisation des contributions linguistiques, audio et pédagogiques.", "meta": "8 mai 2026 · Bukavu / En ligne"},
    ],
    "forumTopics": [
        {"phase": "Forum langue", "name": "Questions de prononciation swahili", "zone": "Débutants",
         "level": "24 messages", "description": "Aide entre apprenants sur les sons, la lecture et la correction orale."},
        {"phase": "Forum sciences", "name": "Lexique mathématique", "zone": "Contributeurs",
         "level": "12 messages", "description": "Discussions sur l'unification des termes scientifiques et leur usage pédagogique."},
        {"phase": "Forum communauté", "name": "Diaspora et transmission", "zone": "Communauté",
         "level": "31 messages", "description": "Espace pour les familles et associations souhaitant réintroduire les langues d'origine."},
    ],
    "badges": [
        {"label": "Voix claire", "title": "5 exercices oraux validés", "description": "Progression reconnue sur la compétence parler."},
        {"label": "Oreille active", "title": "3 écoutes complètes", "description": "Compréhension orale régulière avec support natif."},
        {"label": "Curieux culturel", "title": "2 textes culturels lus", "description": "Lecture et découverte du patrimoine oral."},
        {"label": "Passeport science", "title": "Premier quiz scientifique réussi", "description": "Passage vers le module scientifique validé."},
    ],
    "dictionary": [
        {"word": "habari", "translation": "bonjour / nouvelles", "example": "Habari za asubuhi ?"},
        {"word": "asante", "translation": "merci", "example": "Asante sana."},
        {"word": "karibu", "translation": "bienvenue", "example": "Karibu AFRILEARN."},
        {"word": "shule", "translation": "école", "example": "Ninaenda shule."},
        {"word": "hesabu", "translation": "mathématiques", "example": "Hesabu ni somo muhimu."},
        {"word": "afya", "translation": "santé", "example": "Afya bora ni muhimu."},
    ],
    "performance": [
        {"label": "Parler", "value": 72},
        {"label": "Écouter", "value": 68},
        {"label": "Lire", "value": 81},
        {"label": "Écrire", "value": 64},
    ],
    "admin": {
        "metrics": [
            {"value": "124", "label": "apprenants inscrits simulés"},
            {"value": "18", "label": "contenus en validation"},
            {"value": "07", "label": "contributeurs actifs identifiés"},
            {"value": "03", "label": "alertes de modération"},
        ],
        "pipeline": [
            {"label": "Cours swahili A1", "level": "Contenu",
             "description": "Modules d'introduction et vocabulaire de base en attente de validation native."},
            {"label": "Lexique mathématique", "level": "Sciences",
             "description": "Première version bilingue swahili / français à harmoniser."},
            {"label": "Médiathèque audio", "level": "Audio",
             "description": "Collecte de contes, proverbes et capsules de prononciation."},
            {"label": "Guide contributeur", "level": "Documentation",
             "description": "Normes de structuration, validation et publication des ressources."},
        ],
        "moderation": [
            {"title": "Message forum à relire",
             "description": "Vérifier la justesse terminologique sur un échange du forum sciences."},
            {"title": "Fiche téléchargeable incomplète",
             "description": "Un PDF grammatical a été ajouté sans mention de langue ni niveau."},
            {"title": "Profil contributeur à confirmer",
             "description": "Validation d'un nouveau formateur annoncé pour le swahili."},
        ],
    },
}

DEFAULT_PROGRESS = {
    "activeTracks": 3,
    "lessonsCompleted": 18,
    "weeklyMinutes": 145,
    "certifications": 1,
    "tracks": [
        {"title": "Swahili A1", "percentage": 72,
         "nextStep": "Prononciation guidée - unité 6", "detail": "Parler, écouter, lire, écrire"},
        {"title": "Mathématiques en swahili", "percentage": 38,
         "nextStep": "Lexique de base - module 2", "detail": "Niveau collège"},
        {"title": "Culture orale des Grands Lacs", "percentage": 56,
         "nextStep": "Lecture de proverbes - séquence 4", "detail": "Médiathèque"},
    ],
}

LEGACY_DEMO_EMAIL = "amani@afrilearn.org"


def _normalize_role(value: str) -> str:
    return "admin" if str(value).strip().lower() == "admin" else "learner"


def _get_demo_account() -> dict | None:
    email = os.environ.get("AFRILEARN_DEMO_EMAIL", "").strip().lower()
    password = os.environ.get("AFRILEARN_DEMO_PASSWORD", "")
    if not email or not password:
        return None

    return {
        "firstName": os.environ.get("AFRILEARN_DEMO_FIRST_NAME", "Compte demo").strip() or "Compte demo",
        "country": os.environ.get("AFRILEARN_DEMO_COUNTRY", "RDC").strip() or "RDC",
        "region": os.environ.get("AFRILEARN_DEMO_REGION", "Sud-Kivu").strip() or "Sud-Kivu",
        "nativeLanguage": os.environ.get("AFRILEARN_DEMO_NATIVE_LANGUAGE", "Swahili").strip() or "Swahili",
        "email": email,
        "password": password,
        "role": _normalize_role(os.environ.get("AFRILEARN_DEMO_ROLE", "learner")),
    }


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT  NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'learner' CHECK(role IN ('learner','admin')),
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL COLLATE NOCASE,
    success     INTEGER NOT NULL DEFAULT 0,
    ip_address  TEXT,
    attempted_at TEXT   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
    ON login_attempts(email, attempted_at);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  TEXT    NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
    name        TEXT PRIMARY KEY,
    payload     TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    email           TEXT PRIMARY KEY COLLATE NOCASE,
    first_name      TEXT NOT NULL,
    country         TEXT NOT NULL,
    region          TEXT NOT NULL,
    native_language TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS progress_snapshots (
    profile_email   TEXT PRIMARY KEY,
    active_tracks   INTEGER NOT NULL,
    lessons_completed INTEGER NOT NULL,
    weekly_minutes  INTEGER NOT NULL,
    certifications  INTEGER NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(profile_email) REFERENCES profiles(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS progress_tracks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_email   TEXT NOT NULL,
    title           TEXT NOT NULL,
    percentage      INTEGER NOT NULL,
    next_step       TEXT NOT NULL,
    detail          TEXT NOT NULL,
    sort_order      INTEGER NOT NULL,
    FOREIGN KEY(profile_email) REFERENCES profiles(email) ON DELETE CASCADE
);
"""


def ensure_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA)
        _seed_collections(conn)
        _cleanup_legacy_demo_account(conn)
        _seed_demo_user(conn)
        _seed_demo_profile(conn)
        conn.commit()
    finally:
        conn.close()


def _seed_collections(conn: sqlite3.Connection) -> None:
    for name, payload in COLLECTIONS.items():
        conn.execute(
            "INSERT INTO collections(name, payload) VALUES(?,?) ON CONFLICT(name) DO NOTHING",
            (name, json.dumps(payload, ensure_ascii=False)),
        )


def _cleanup_legacy_demo_account(conn: sqlite3.Connection) -> None:
    demo_account = _get_demo_account()
    if demo_account and demo_account["email"] == LEGACY_DEMO_EMAIL:
        return

    row = conn.execute(
        "SELECT id FROM users WHERE email=? COLLATE NOCASE",
        (LEGACY_DEMO_EMAIL,),
    ).fetchone()
    if not row:
        return

    legacy_user_id = row[0]
    other_users = conn.execute(
        "SELECT COUNT(*) FROM users WHERE email<>? COLLATE NOCASE",
        (LEGACY_DEMO_EMAIL,),
    ).fetchone()[0]

    if other_users == 0:
        conn.execute("DELETE FROM sessions WHERE user_id=?", (legacy_user_id,))
        conn.execute("DELETE FROM login_attempts WHERE email=? COLLATE NOCASE", (LEGACY_DEMO_EMAIL,))
        conn.execute("DELETE FROM progress_tracks WHERE profile_email=? COLLATE NOCASE", (LEGACY_DEMO_EMAIL,))
        conn.execute("DELETE FROM progress_snapshots WHERE profile_email=? COLLATE NOCASE", (LEGACY_DEMO_EMAIL,))
        conn.execute("DELETE FROM profiles WHERE email=? COLLATE NOCASE", (LEGACY_DEMO_EMAIL,))
        conn.execute("DELETE FROM users WHERE email=? COLLATE NOCASE", (LEGACY_DEMO_EMAIL,))
        return

    conn.execute("DELETE FROM sessions WHERE user_id=?", (legacy_user_id,))
    conn.execute(
        """UPDATE users
           SET is_active=0, updated_at=CURRENT_TIMESTAMP
           WHERE email=? COLLATE NOCASE""",
        (LEGACY_DEMO_EMAIL,),
    )


def _seed_demo_user(conn: sqlite3.Connection) -> None:
    demo_account = _get_demo_account()
    if not demo_account:
        return

    pw_hash = generate_password_hash(demo_account["password"])
    conn.execute(
        """INSERT INTO users(email, password_hash, role)
           VALUES(?,?,?)
           ON CONFLICT(email) DO NOTHING""",
        (demo_account["email"], pw_hash, demo_account["role"]),
    )


def _seed_demo_profile(conn: sqlite3.Connection) -> None:
    demo_account = _get_demo_account()
    if not demo_account:
        return

    conn.execute(
        """INSERT INTO profiles(email, first_name, country, region, native_language)
           VALUES(?,?,?,?,?)
           ON CONFLICT(email) DO NOTHING""",
        (demo_account["email"], demo_account["firstName"],
         demo_account["country"], demo_account["region"],
         demo_account["nativeLanguage"]),
    )
    conn.execute(
        """INSERT INTO progress_snapshots(profile_email, active_tracks, lessons_completed,
                                          weekly_minutes, certifications)
           VALUES(?,?,?,?,?)
           ON CONFLICT(profile_email) DO NOTHING""",
        (demo_account["email"], DEFAULT_PROGRESS["activeTracks"],
         DEFAULT_PROGRESS["lessonsCompleted"], DEFAULT_PROGRESS["weeklyMinutes"],
         DEFAULT_PROGRESS["certifications"]),
    )
    existing = conn.execute(
        "SELECT COUNT(*) FROM progress_tracks WHERE profile_email=?",
        (demo_account["email"],),
    ).fetchone()[0]
    if not existing:
        for i, track in enumerate(DEFAULT_PROGRESS["tracks"], 1):
            conn.execute(
                """INSERT INTO progress_tracks(profile_email, title, percentage, next_step, detail, sort_order)
                   VALUES(?,?,?,?,?,?)""",
                (demo_account["email"], track["title"], track["percentage"],
                 track["nextStep"], track["detail"], i),
            )


if __name__ == "__main__":
    ensure_database(Path(__file__).resolve().parent / "data" / "afrilearn.db")
    print("Base SQLite AFRILEARN initialisee.")
    if _get_demo_account():
        print("   Compte de demonstration active via variables d'environnement.")
    else:
        print("   Aucun compte de demonstration par defaut n'a ete cree.")
