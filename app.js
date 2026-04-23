/* ============================================================
   AFRILEARN app.js — v2
   - Authentification réelle via API Flask
   - CSRF token géré automatiquement
   - Rendu dynamique depuis SQLite via /api/bootstrap
   - Stockage local profil + session info
   ============================================================ */
"use strict";

// ── État global ─────────────────────────────────────────────
const STATE = {
  data: null,
  user: null,
  csrfToken: null,
  lang: localStorage.getItem("afrilearn-lang") || "fr",
};

// ── i18n minimal ────────────────────────────────────────────
const I18N = {
  fr: {
    "nav.home":"Accueil","nav.languages":"Langues","nav.sciences":"Sciences",
    "nav.media":"Médiathèque","nav.community":"Communauté",
    "nav.dashboard":"Tableau de bord","nav.admin":"Administration",
    "nav.login":"Se connecter","nav.logout":"Se déconnecter",
    "hero.home.eyebrow":"Plateforme numérique d'apprentissage et de transmission",
    "hero.home.title":"Réapprendre les langues africaines et enseigner les sciences dans nos langues.",
    "cta.start":"Commencer maintenant","cta.discover":"Découvrir les parcours",
  },
  en: {
    "nav.home":"Home","nav.languages":"Languages","nav.sciences":"Sciences",
    "nav.media":"Media Library","nav.community":"Community",
    "nav.dashboard":"Dashboard","nav.admin":"Administration",
    "nav.login":"Sign In","nav.logout":"Sign Out",
    "hero.home.eyebrow":"Digital learning and cultural transmission platform",
    "hero.home.title":"Relearn African languages and teach sciences in our languages.",
    "cta.start":"Get started","cta.discover":"Browse courses",
  },
};

function t(key) {
  return (I18N[STATE.lang] || I18N.fr)[key] || key;
}

// ── CSRF helper ─────────────────────────────────────────────
async function fetchCsrf() {
  try {
    const r = await fetch("/api/csrf-token");
    const d = await r.json();
    STATE.csrfToken = d.csrf_token;
  } catch {
    STATE.csrfToken = "";
  }
}

async function apiFetch(url, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const body = opts.body ? JSON.parse(opts.body) : undefined;

  if (opts.method && opts.method !== "GET" && body !== undefined) {
    body.csrf_token = STATE.csrfToken;
    opts.body = JSON.stringify(body);
  }

  return fetch(url, { ...opts, headers, credentials: "same-origin" });
}

// ── Bootstrap data ───────────────────────────────────────────
async function loadBootstrap() {
  try {
    const r = await fetch("/api/bootstrap");
    if (!r.ok) throw new Error("API unavailable");
    STATE.data = await r.json();
    updateApiStatus(true);
    return STATE.data;
  } catch {
    STATE.data = typeof FALLBACK_DATA !== "undefined" ? FALLBACK_DATA : {};
    updateApiStatus(false);
    return STATE.data;
  }
}

function updateApiStatus(fromApi) {
  const el = document.querySelector("[data-api-status]");
  if (!el) return;
  if (fromApi) {
    el.textContent = `✓ Données chargées depuis SQLite (${STATE.data?.dbInfo?.engine || "DB"})`;
    el.classList.add("api-ok");
  } else {
    el.textContent = "Mode statique local actif. Le backend SQLite n'est pas encore détecté.";
  }
}

// ── Auth state ───────────────────────────────────────────────
async function loadAuthState() {
  try {
    const r = await fetch("/api/auth/me");
    const d = await r.json();
    STATE.user = d.authenticated ? d : null;
  } catch {
    STATE.user = null;
  }
  renderAuthNav();
}

function renderAuthNav() {
  const nav = document.querySelector("[data-site-menu]");
  if (!nav) return;

  // Supprimer l'ancien bouton connexion/déconnexion
  nav.querySelectorAll(".nav-auth-btn").forEach(el => el.remove());

  if (STATE.user) {
    // Bouton déconnexion
    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-sm btn-ghost nav-auth-btn";
    logoutBtn.textContent = t("nav.logout");
    logoutBtn.addEventListener("click", handleLogout);
    nav.appendChild(logoutBtn);

    // Afficher nom utilisateur dans dashboard
    const nameEl = document.querySelector("[data-user-name]");
    if (nameEl && STATE.data?.profile?.firstName) {
      nameEl.textContent = STATE.data.profile.firstName;
    }
  } else {
    const loginLink = document.createElement("a");
    loginLink.href = "/authentification.html";
    loginLink.className = "btn btn-primary btn-sm nav-auth-btn";
    loginLink.textContent = t("nav.login");
    nav.appendChild(loginLink);
  }
}

async function handleLogout() {
  await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
  STATE.user = null;
  window.location.href = "/";
}

// ── Login form ───────────────────────────────────────────────
function initLoginForm() {
  const form = document.querySelector("[data-login-form]");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.querySelector("[data-login-message]");
    const fd = new FormData(form);
    const btn = form.querySelector("button[type=submit]");

    btn.disabled = true;
    btn.textContent = "Connexion…";
    msg.textContent = "";
    msg.className = "form-message";

    const r = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: fd.get("identifier") || fd.get("email"),
        password: fd.get("password"),
      }),
    });

    const d = await r.json().catch(() => ({}));
    btn.disabled = false;
    btn.textContent = "Se connecter";

    if (r.ok) {
      msg.textContent = "Connexion réussie, redirection…";
      msg.classList.add("success");
      setTimeout(() => { window.location.href = "/tableau-de-bord.html"; }, 800);
    } else {
      msg.textContent = d.error || "Erreur de connexion.";
      msg.classList.add("error");
      await fetchCsrf(); // Renouveler le token après échec
    }
  });
}

// ── Register form ────────────────────────────────────────────
function initRegisterForm() {
  const form = document.querySelector("[data-register-form]");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.querySelector("[data-register-message]");
    const fd = new FormData(form);
    const btn = form.querySelector("button[type=submit]");

    btn.disabled = true;
    btn.textContent = "Création…";
    msg.textContent = "";
    msg.className = "form-message";

    const r = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
        firstName: fd.get("firstName"),
        country: fd.get("country"),
        region: fd.get("region"),
        nativeLanguage: fd.get("nativeLanguage"),
      }),
    });

    const d = await r.json().catch(() => ({}));
    btn.disabled = false;
    btn.textContent = "Créer mon compte";

    if (r.ok) {
      msg.textContent = "Compte créé ! Redirection…";
      msg.classList.add("success");
      setTimeout(() => { window.location.href = "/tableau-de-bord.html"; }, 900);
    } else {
      msg.textContent = d.error || "Erreur lors de l'inscription.";
      msg.classList.add("error");
      await fetchCsrf();
    }
  });
}

// ── Auth tabs ────────────────────────────────────────────────
function initAuthTabs() {
  document.querySelectorAll("[data-auth-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.authTab;
      document.querySelectorAll("[data-auth-tab]").forEach(t => t.classList.remove("is-active"));
      document.querySelectorAll("[data-auth-panel]").forEach(p => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.querySelector(`[data-auth-panel="${target}"]`)?.classList.add("is-active");
    });
  });
}

// ── Renderers ────────────────────────────────────────────────
const BADGE_ICONS = ["🎤", "👂", "📖", "🔬"];

const RENDERERS = {
  stats(el, data) {
    if (!Array.isArray(data?.stats)) return;
    el.innerHTML = data.stats.map(s => `
      <div class="stat-card">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join("");
  },

  "languages-home"(el, data) {
    if (!Array.isArray(data?.languages)) return;
    el.innerHTML = data.languages.slice(0, 3).map(l => `
      <article class="card">
        <span class="card-phase">${l.phase}</span>
        <h3>${l.name}</h3>
        <p>${l.description}</p>
        <p class="card-meta">${l.zone} · ${l.level}</p>
      </article>`).join("");
  },

  "languages-catalogue"(el, data) {
    if (!Array.isArray(data?.languages)) return;
    el.innerHTML = data.languages.map(l => `
      <article class="card">
        <span class="card-phase">${l.phase}</span>
        <h3>${l.name}</h3>
        <p>${l.description}</p>
        <p class="card-meta">${l.zone} · ${l.level}</p>
      </article>`).join("");
  },

  "sciences-home"(el, data) {
    if (!Array.isArray(data?.sciences)) return;
    el.innerHTML = data.sciences.slice(0, 3).map(s => `
      <article class="card">
        <span class="card-phase">${s.level}</span>
        <h3>${s.label}</h3>
        <p>${s.description}</p>
      </article>`).join("");
  },

  "sciences-catalogue"(el, data) {
    if (!Array.isArray(data?.sciences)) return;
    el.innerHTML = data.sciences.map(s => `
      <article class="card">
        <span class="card-phase">${s.level}</span>
        <h3>${s.label}</h3>
        <p>${s.description}</p>
      </article>`).join("");
  },

  "news-list"(el, data) {
    if (!Array.isArray(data?.news)) return;
    el.innerHTML = data.news.map(n => `
      <div class="stack-item">
        <span class="item-tag">${n.tag}</span>
        <div class="item-body">
          <h3>${n.title}</h3>
          <p>${n.description}</p>
          <span class="item-meta">${n.meta}</span>
        </div>
      </div>`).join("");
  },

  "events-list"(el, data) {
    if (!Array.isArray(data?.events)) return;
    el.innerHTML = data.events.map(ev => `
      <div class="stack-item">
        <span class="item-tag">${ev.tag}</span>
        <div class="item-body">
          <h3>${ev.title}</h3>
          <p>${ev.description}</p>
          <span class="item-meta">${ev.meta}</span>
        </div>
      </div>`).join("");
  },

  "forum-topics"(el, data) {
    if (!Array.isArray(data?.forumTopics)) return;
    el.innerHTML = data.forumTopics.map(f => `
      <article class="card">
        <span class="card-phase">${f.phase}</span>
        <h3>${f.name}</h3>
        <p>${f.description}</p>
        <p class="card-meta">${f.zone} · ${f.level}</p>
      </article>`).join("");
  },

  "media-library"(el, data) {
    if (!Array.isArray(data?.resources)) return;
    const active = el.closest("section")?.querySelector("[data-filter-button].is-active")?.dataset.filterButton || "all";
    const items = active === "all" ? data.resources : data.resources.filter(r => r.type === active);
    el.innerHTML = items.map(r => `
      <article class="card card-type-${r.type}" data-media-type="${r.type}">
        <span class="card-phase">${r.tag}</span>
        <h3>${r.title}</h3>
        <p>${r.description}</p>
        <p class="card-meta">${r.meta}</p>
      </article>`).join("");
  },

  badges(el, data) {
    if (!Array.isArray(data?.badges)) return;
    el.innerHTML = data.badges.map((b, i) => `
      <div class="badge-item">
        <div class="badge-icon">${BADGE_ICONS[i] || "🏅"}</div>
        <span class="badge-label">${b.label}</span>
        <span class="badge-title">${b.title}</span>
      </div>`).join("");
  },

  "dashboard-stats"(el, data) {
    const p = data?.progress;
    if (!p) return;
    const items = [
      { value: p.activeTracks, label: "parcours actifs" },
      { value: p.lessonsCompleted, label: "leçons complétées" },
      { value: `${p.weeklyMinutes}mn`, label: "cette semaine" },
      { value: p.certifications, label: "certification(s)" },
    ];
    el.innerHTML = items.map(s => `
      <div class="stat-card">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join("");
  },

  "dashboard-progress"(el, data) {
    const tracks = data?.progress?.tracks;
    if (!Array.isArray(tracks)) return;
    el.innerHTML = tracks.map(tr => `
      <div class="progress-item">
        <div class="progress-header">
          <span class="progress-title">${tr.title}</span>
          <span class="progress-pct">${tr.percentage}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${tr.percentage}%"></div>
        </div>
        <div class="progress-next">→ ${tr.nextStep}</div>
      </div>`).join("");
  },

  "performance-bars"(el, data) {
    if (!Array.isArray(data?.performance)) return;
    el.innerHTML = data.performance.map(p => `
      <div class="perf-item">
        <div class="perf-header">
          <span>${p.label}</span>
          <span>${p.value}%</span>
        </div>
        <div class="perf-track">
          <div class="perf-fill" style="width:${p.value}%"></div>
        </div>
      </div>`).join("");
  },

  "admin-metrics"(el, data) {
    const metrics = data?.admin?.metrics;
    if (!Array.isArray(metrics)) return;
    el.innerHTML = metrics.map(m => `
      <div class="stat-card">
        <div class="stat-value">${m.value}</div>
        <div class="stat-label">${m.label}</div>
      </div>`).join("");
  },

  "admin-pipeline"(el, data) {
    const pipeline = data?.admin?.pipeline;
    if (!Array.isArray(pipeline)) return;
    el.innerHTML = pipeline.map(p => `
      <article class="card">
        <span class="card-phase">${p.level}</span>
        <h3>${p.label}</h3>
        <p>${p.description}</p>
      </article>`).join("");
  },

  "moderation-list"(el, data) {
    const items = data?.admin?.moderation;
    if (!Array.isArray(items)) return;
    el.innerHTML = items.map(m => `
      <div class="mod-item">
        <div class="mod-title">${m.title}</div>
        <div class="mod-desc">${m.description}</div>
      </div>`).join("");
  },
};

function renderAll(data) {
  document.querySelectorAll("[data-render]").forEach(el => {
    const key = el.dataset.render;
    if (RENDERERS[key]) RENDERERS[key](el, data);
  });
}

// ── DB summary ───────────────────────────────────────────────
function renderDbSummary(data) {
  const el = document.querySelector("[data-db-summary]");
  if (!el || !data?.dbInfo) return;
  const info = data.dbInfo;
  el.textContent = `Base ${info.engine} · ${info.tables} tables · ${info.collections} collections · ${info.profiles} profil(s)`;
}

// ── Dictionary search ─────────────────────────────────────────
function initDictionary(data) {
  const input = document.querySelector("[data-dictionary-search]");
  const results = document.querySelector("[data-dictionary-results]");
  if (!input || !results) return;

  const dict = data?.dictionary || [];

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ""; return; }
    const hits = dict.filter(e => e.word.includes(q) || e.translation.includes(q));
    results.innerHTML = hits.length
      ? hits.map(e => `
          <div class="dict-entry">
            <div class="dict-word">${e.word}</div>
            <div class="dict-translation">${e.translation}</div>
            <div class="dict-example">${e.example}</div>
          </div>`).join("")
      : `<p style="color:var(--c-warm-soft);font-size:.85rem">Aucun résultat pour « ${q} »</p>`;
  });
}

// ── Flashcards ───────────────────────────────────────────────
function initFlashcards(data) {
  const card = document.querySelector("[data-flashcard]");
  const btn  = document.querySelector("[data-flashcard-next]");
  if (!card || !btn) return;

  const dict = data?.dictionary || [];
  let idx = 0;

  function show(i) {
    const e = dict[i];
    if (!e) return;
    card.querySelector(".flashcard-term").textContent    = e.word;
    card.querySelector(".flashcard-meaning").textContent = e.translation;
  }

  btn.addEventListener("click", () => {
    idx = (idx + 1) % dict.length;
    card.style.transform = "scale(0.96) rotateY(8deg)";
    setTimeout(() => {
      show(idx);
      card.style.transform = "";
    }, 200);
  });

  if (dict.length) show(0);
}

// ── Science quiz ─────────────────────────────────────────────
function initScienceQuiz() {
  const form = document.querySelector("[data-science-quiz]");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const fb = form.querySelector("[data-quiz-feedback]");
    const selected = form.querySelector("[name=quiz]:checked");
    if (!selected) return;
    if (selected.value === "correct") {
      fb.textContent = "✓ Correct ! Le lexique bilingue et les exercices structurent chaque leçon.";
      fb.className = "quiz-feedback correct";
    } else {
      fb.textContent = "✗ Essayez encore : une leçon complète combine vidéo, lexique et exercices.";
      fb.className = "quiz-feedback incorrect";
    }
  });
}

// ── Media filters ─────────────────────────────────────────────
function initMediaFilters() {
  document.querySelectorAll("[data-filter-button]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-filter-button]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const el = document.querySelector("[data-render='media-library']");
      if (el && STATE.data) RENDERERS["media-library"](el, STATE.data);
    });
  });
}

// ── Nav ───────────────────────────────────────────────────────
function initNav() {
  // Mobile toggle
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav    = document.querySelector("[data-site-menu]");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open);
    });
    // Fermer au clic dehors
    document.addEventListener("click", e => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", false);
      }
    });
  }

  // Active link
  const page = document.body.dataset.page;
  document.querySelectorAll("[data-nav]").forEach(link => {
    if (link.dataset.nav === page) link.setAttribute("aria-current", "page");
  });

  // i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (val !== key) el.textContent = val;
  });

  // Lang switch
  document.querySelectorAll("[data-lang-switch]").forEach(btn => {
    if (btn.dataset.langSwitch === STATE.lang) btn.classList.add("is-active");
    btn.addEventListener("click", () => {
      STATE.lang = btn.dataset.langSwitch;
      localStorage.setItem("afrilearn-lang", STATE.lang);
      location.reload();
    });
  });

  // Current year
  document.querySelectorAll("[data-current-year]").forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

// ── Kente strip ───────────────────────────────────────────────
function injectKenteStrip() {
  const strip = document.createElement("div");
  strip.className = "kente-strip";
  document.querySelector(".site-header")?.after(strip);
}

// ── Main ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  injectKenteStrip();

  await fetchCsrf();
  await loadAuthState();

  const data = await loadBootstrap();

  renderAll(data);
  renderDbSummary(data);
  initDictionary(data);
  initFlashcards(data);
  initScienceQuiz();
  initMediaFilters();
  initAuthTabs();
  initLoginForm();
  initRegisterForm();
});