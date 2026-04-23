"use strict";

const STATE = {
  data: null,
  user: null,
  csrfToken: null,
  lang: localStorage.getItem("afrilearn-lang") || "fr",
  mediaFilter: "all",
  mediaSearch: "",
  mediaRenderedItems: [],
  revealObserver: null,
  backgroundObserver: null,
  counterObserver: null,
  barObserver: null,
  previousFocus: null,
};

const I18N = {
  fr: {
    "nav.home": "Accueil",
    "nav.languages": "Langues",
    "nav.sciences": "Sciences",
    "nav.media": "Médiathèque",
    "nav.community": "Communauté",
    "nav.dashboard": "Tableau de bord",
    "nav.admin": "Administration",
    "nav.login": "Espace membre",
    "nav.logout": "Se déconnecter",
    "hero.home.eyebrow": "Plateforme numérique d'apprentissage et de transmission",
    "hero.home.title": "Apprendre des langues africaines avec des parcours clairs, des ressources utiles et un accès mobile.",
    "cta.start": "Créer un compte",
    "cta.discover": "Voir les parcours",
  },
  en: {
    "nav.home": "Home",
    "nav.languages": "Languages",
    "nav.sciences": "Sciences",
    "nav.media": "Media Library",
    "nav.community": "Community",
    "nav.dashboard": "Dashboard",
    "nav.admin": "Administration",
    "nav.login": "Member area",
    "nav.logout": "Sign Out",
    "hero.home.eyebrow": "Digital learning and cultural transmission platform",
    "hero.home.title": "Learn African languages through clear pathways, useful resources, and mobile access.",
    "cta.start": "Create account",
    "cta.discover": "View courses",
  },
};

const BADGE_ICONS = ["🎤", "👂", "📖", "🔬"];
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function t(key) {
  return (I18N[STATE.lang] || I18N.fr)[key] || key;
}

function prefersReducedMotion() {
  return REDUCED_MOTION.matches;
}

function debounce(fn, delay = 180) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "AF";
}

function splitMetricValue(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d+)(.*)$/);
  if (!match) {
    return { countable: false, label: raw, number: 0, suffix: "", digits: 0 };
  }
  return {
    countable: true,
    label: raw,
    number: Number.parseInt(match[1], 10),
    suffix: match[2] || "",
    digits: match[1].length,
  };
}

function getMediaTypeLabel(type) {
  const labels = {
    audio: "Audio",
    video: "Vidéo",
    texte: "Texte",
    telechargement: "Téléchargement",
  };
  return labels[type] || "Ressource";
}

function getMediaIcon(type) {
  const icons = {
    audio: '<i class="fa-solid fa-headphones"></i>',
    video: '<i class="fa-solid fa-play"></i>',
    texte: '<i class="fa-solid fa-book"></i>',
    telechargement: '<i class="fa-solid fa-download"></i>',
  };
  return icons[type] || '<i class="fa-solid fa-circle"></i>';
}

function getFileExtension(path) {
  const value = String(path || "");
  const match = value.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match ? match[1].toLowerCase() : "";
}

function getMediaActionLabel(item) {
  if (item.youtube_id) {
    return "Voir la vidéo";
  }
  const ext = getFileExtension(item.file_path);
  if (ext === "mp3" || ext === "wav" || ext === "ogg") {
    return "Écouter";
  }
  if (ext === "pdf") {
    return "Consulter le document";
  }
  return "Ouvrir";
}

function resolveNextUrl(defaultPath = "/tableau-de-bord.html") {
  try {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (!next || !next.startsWith("/") || next.startsWith("//")) {
      return defaultPath;
    }
    return next;
  } catch {
    return defaultPath;
  }
}

function buildAuthUrl(nextPath = "/tableau-de-bord.html") {
  const safeNext = typeof nextPath === "string" && nextPath.startsWith("/") ? nextPath : "/tableau-de-bord.html";
  return `/authentification.html?next=${encodeURIComponent(safeNext)}`;
}

function sanitizeYouTubeId(value) {
  return String(value ?? "").replace(/[^\w-]/g, "");
}

function buildYouTubePoster(id) {
  const safeId = sanitizeYouTubeId(id);
  return safeId ? `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg` : "";
}

function buildLiteVideo(item) {
  const youtubeId = sanitizeYouTubeId(item.youtube_id);
  if (!youtubeId) {
    return buildMediaPlaceholder(item.type, item.title);
  }
  const poster = buildYouTubePoster(youtubeId);
  return `
    <button
      class="lite-video"
      type="button"
      data-lite-video
      data-video-id="${escapeHtml(youtubeId)}"
      data-video-title="${escapeHtml(item.title)}"
      data-poster="${escapeHtml(poster)}"
      aria-label="Lire la vidéo ${escapeHtml(item.title)}"
    >
      <span class="lite-video-poster"></span>
      <span class="lite-video-play">Lire la vidéo</span>
    </button>
  `;
}

function buildMediaPlaceholder(type, title = "") {
  const safeType = escapeHtml(type || "media");
  return `
    <div class="media-placeholder media-placeholder-${safeType}">
      <div class="media-placeholder-content">
        <span class="media-icon" aria-hidden="true">${getMediaIcon(type)}</span>
        <strong>${escapeHtml(getMediaTypeLabel(type))}</strong>
        <span>${escapeHtml(title || "Aperçu disponible à l'ouverture")}</span>
      </div>
    </div>
  `;
}

function buildMediaVisual(item) {
  if (item.type === "video") {
    return buildLiteVideo(item);
  }
  return buildMediaPlaceholder(item.type, item.title);
}

function buildMediaDialogVisual(item) {
  const extension = getFileExtension(item.file_path);

  if (item.type === "video") {
    return buildLiteVideo(item);
  }

  if (item.file_path && (extension === "mp3" || extension === "wav" || extension === "ogg")) {
    return `
      <div class="media-embed-shell media-embed-audio">
        <div class="media-embed-head">
          <span class="media-icon" aria-hidden="true">${getMediaIcon(item.type)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.meta || "Audio AFRILEARN")}</span>
        </div>
        <audio controls preload="metadata" class="media-audio-player">
          <source src="${escapeHtml(item.file_path)}">
          Votre navigateur ne prend pas en charge la lecture audio intégrée.
        </audio>
      </div>
    `;
  }

  if (item.file_path && extension === "pdf") {
    return `
      <div class="media-embed-shell media-embed-document">
        <div class="media-embed-head">
          <span class="media-icon" aria-hidden="true">${getMediaIcon(item.type)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <span>Aperçu document intégré</span>
        </div>
        <iframe
          class="media-document-frame"
          src="${escapeHtml(item.file_path)}#view=FitH"
          title="${escapeHtml(item.title)}"
          loading="lazy"
        ></iframe>
      </div>
    `;
  }

  return buildMediaPlaceholder(item.type, item.title);
}

function buildStatCard(item) {
  const metric = splitMetricValue(item.value);
  const valueAttrs = metric.countable
    ? ` data-countup="${metric.number}" data-count-suffix="${escapeHtml(metric.suffix)}" data-count-pad="${metric.digits}"`
    : "";
  return `
    <div class="stat-card" data-reveal>
      <div class="stat-value"${valueAttrs}>${escapeHtml(item.value)}</div>
      <div class="stat-label">${escapeHtml(item.label)}</div>
    </div>
  `;
}

function buildResourceCard(item, index) {
  const extraMeta = [item.language, item.audience].filter(Boolean).join(" · ");
  return `
    <article class="card media-card card-type-${escapeHtml(item.type)}" data-reveal>
      <div class="media-preview-visual">
        ${buildMediaVisual(item)}
      </div>
      <div class="media-card-body">
        <span class="card-phase">${escapeHtml(item.tag || getMediaTypeLabel(item.type))}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.meta || getMediaTypeLabel(item.type))}</p>
        ${extraMeta ? `<p class="card-meta">${escapeHtml(extraMeta)}</p>` : ""}
        <div class="media-card-actions">
          ${item.file_path || item.youtube_id 
            ? `<button type="button" class="btn btn-secondary btn-sm" data-media-open="${index}">${getMediaActionLabel(item)}</button>`
            : `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.6; cursor:not-allowed;" title="Contenu non disponible">Non disponible</button>`
          }
          ${item.file_path ? `<a class="media-link" href="${escapeHtml(item.file_path)}" target="_blank" rel="noreferrer">Ouvrir le fichier</a>` : ""}
          ${item.link ? `<a class="media-link" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">Source</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

function buildFeaturedMedia(item) {
  if (!item) {
    return `
      <div class="media-empty">
        <strong>Aucune ressource mise en avant</strong>
        <p>Modifiez le filtre pour consulter d'autres ressources disponibles.</p>
      </div>
    `;
  }

  return `
    <div class="featured-media" data-reveal>
      <div class="media-featured-visual">
        ${buildMediaVisual(item)}
      </div>
      <div class="featured-media-copy">
        <span class="card-phase">${escapeHtml(item.tag || getMediaTypeLabel(item.type))}</span>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.description)}</p>
        <p class="featured-media-meta">${escapeHtml(item.meta || "")}</p>
        <div class="media-dialog-meta">
          ${[item.language, item.audience, item.phase].filter(Boolean).map((chip) => `<span class="media-dialog-chip">${escapeHtml(chip)}</span>`).join("")}
        </div>
        <div class="button-group">
          <button type="button" class="btn btn-primary" data-media-open="0">${getMediaActionLabel(item)}</button>
          ${item.file_path ? `<a class="btn btn-secondary" href="${escapeHtml(item.file_path)}" target="_blank" rel="noreferrer">Ouvrir le fichier</a>` : ""}
          ${item.link ? `<a class="btn btn-secondary" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">Ouvrir la source</a>` : `<a class="btn btn-secondary" href="communaute.html">Discuter avec la communauté</a>`}
        </div>
      </div>
    </div>
  `;
}

function buildMediaDialog(item) {
  const chips = [
    item.tag || getMediaTypeLabel(item.type),
    item.meta || "",
    item.phase || "",
    item.language || "",
    item.audience || "",
  ].filter(Boolean);
  const primaryHref = STATE.user ? "/tableau-de-bord.html" : buildAuthUrl("/tableau-de-bord.html");
  const primaryLabel = STATE.user ? "Ouvrir mon tableau de bord" : "Accéder à l'espace";

  return `
    <button type="button" class="media-dialog-close" data-modal-close aria-label="Fermer">✕</button>
    <div class="media-dialog-grid">
      <div>
        ${buildMediaDialogVisual(item)}
      </div>
      <div class="media-dialog-body">
        <span class="card-phase">${escapeHtml(item.tag || getMediaTypeLabel(item.type))}</span>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.description)}</p>
        <div class="media-dialog-meta">
          ${chips.map((chip) => `<span class="media-dialog-chip">${escapeHtml(chip)}</span>`).join("")}
        </div>
        <p class="card-meta">${escapeHtml(item.meta || "Ressource AFRILEARN")}</p>
        <div class="button-group">
          <a class="btn btn-primary" href="${escapeHtml(primaryHref)}">${primaryLabel}</a>
          ${item.file_path ? `<a class="btn btn-secondary" href="${escapeHtml(item.file_path)}" target="_blank" rel="noreferrer">Ouvrir le fichier</a>` : ""}
          ${item.link ? `<a class="btn btn-secondary" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">Source externe</a>` : ""}
          <button type="button" class="btn btn-secondary" data-modal-close>Fermer</button>
        </div>
      </div>
    </div>
  `;
}

function setFormMessage(node, text, state = "") {
  if (!node) {
    return;
  }
  node.textContent = text;
  node.className = "form-message";
  if (state) {
    node.classList.add(state);
  }
}

function setSubmitState(button, busyLabel, idleLabel, busy) {
  if (!button) {
    return;
  }
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function validatePassword(value) {
  const text = String(value || "");
  return text.length >= 8 && /[A-Za-z]/.test(text) && /\d/.test(text);
}

async function fetchCsrf() {
  try {
    const response = await fetch("/api/csrf-token");
    const data = await response.json();
    STATE.csrfToken = data.csrf_token || "";
  } catch {
    STATE.csrfToken = "";
  }
}

async function apiFetch(url, opts = {}) {
  const options = { ...opts };
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (body && typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = options.body;
    }
  }

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    if ((options.method || "GET").toUpperCase() !== "GET") {
      body.csrf_token = STATE.csrfToken;
    }
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  return fetch(url, { ...options, body, headers, credentials: "same-origin" });
}

async function loadBootstrap() {
  try {
    const response = await fetch("/api/bootstrap");
    if (!response.ok) {
      throw new Error("API unavailable");
    }
    STATE.data = await response.json();
    updateApiStatus(true);
    return STATE.data;
  } catch {
    STATE.data = typeof FALLBACK_DATA !== "undefined" ? FALLBACK_DATA : {};
    updateApiStatus(false);
    return STATE.data;
  }
}

function updateApiStatus(fromApi) {
  // Log discret en console uniquement — pas de message technique visible
  if (fromApi) {
    console.info(`[AFRILEARN] Données chargées depuis ${STATE.data?.dbInfo?.engine || "SQLite"}.`);
  } else {
    console.info("[AFRILEARN] Mode local actif — données de secours.");
  }
}

async function loadAuthState() {
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    STATE.user = data.authenticated ? data : null;
  } catch {
    STATE.user = null;
  }
  renderAuthNav();
}

function renderAuthNav() {
  const nav = qs("[data-site-menu]");
  if (!nav) {
    return;
  }

  qsa(".nav-auth-btn", nav).forEach((node) => node.remove());
  qs(".user-bar", nav)?.remove();
  qsa(".btn-nav-cta", nav).forEach((node) => node.remove());

  qsa("[data-nav='dashboard']", nav).forEach((link) => {
    link.style.display = STATE.user ? "" : "none";
  });

  qsa("[data-nav='admin']", nav).forEach((link) => {
    link.style.display = STATE.user?.role === "admin" ? "" : "none";
  });

  if (STATE.user) {
    const userName = STATE.user.firstName || STATE.data?.profile?.firstName || "Membre";

    const userBar = document.createElement("div");
    userBar.className = "user-bar nav-auth-btn";
    userBar.innerHTML = `
      <span class="user-avatar">${escapeHtml(getInitials(userName))}</span>
      <span class="user-name">${escapeHtml(userName)}</span>
    `;
    nav.appendChild(userBar);

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-sm btn-ghost nav-auth-btn";
    logoutBtn.textContent = t("nav.logout");
    logoutBtn.addEventListener("click", handleLogout);
    nav.appendChild(logoutBtn);

    const nameEl = qs("[data-user-name]");
    if (nameEl) {
      nameEl.textContent = userName;
    }
  } else {
    const loginLink = document.createElement("a");
    const nextPath = document.body.dataset.page === "auth"
      ? "/tableau-de-bord.html"
      : `${window.location.pathname}${window.location.search}`;
    loginLink.href = buildAuthUrl(nextPath);
    loginLink.className = "btn btn-primary btn-sm nav-auth-btn";
    loginLink.textContent = t("nav.login");
    nav.appendChild(loginLink);
  }
}

async function handleLogout() {
  await apiFetch("/api/auth/logout", { method: "POST", body: {} });
  STATE.user = null;
  window.location.href = "/authentification.html";
}

function initHeaderState() {
  const header = qs(".site-header");
  if (!header) {
    return;
  }

  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function setMenuState(open) {
  const nav = qs("[data-site-menu]");
  const toggle = qs("[data-menu-toggle]");
  if (!nav || !toggle) {
    return;
  }
  nav.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
}

function initNav() {
  const toggle = qs("[data-menu-toggle]");
  const nav = qs("[data-site-menu]");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      setMenuState(open);
    });

    document.addEventListener("click", (event) => {
      if (!nav.classList.contains("is-open")) {
        return;
      }
      if (!nav.contains(event.target) && !toggle.contains(event.target)) {
        setMenuState(false);
      }
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        setMenuState(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenuState(false);
        closeMediaDialog();
      }
    });
  }

  const page = document.body.dataset.page;
  qsa("[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) {
      link.setAttribute("aria-current", "page");
    }
  });

  qsa("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const translated = t(key);
    if (translated !== key) {
      el.textContent = translated;
    }
  });

  qsa("[data-lang-switch]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.langSwitch === STATE.lang);
    btn.addEventListener("click", () => {
      STATE.lang = btn.dataset.langSwitch;
      localStorage.setItem("afrilearn-lang", STATE.lang);
      window.location.reload();
    });
  });

  qsa("[data-current-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

function injectKenteStrip() {
  if (qs(".kente-strip")) {
    return;
  }
  const strip = document.createElement("div");
  strip.className = "kente-strip";
  qs(".site-header")?.after(strip);
}

function initSmartImages(scope = document) {
  qsa("img", scope).forEach((img) => {
    if (img.dataset.imageReady === "true") {
      return;
    }
    img.dataset.imageReady = "true";
    img.classList.add("smart-image");

    if (!img.hasAttribute("decoding")) {
      img.decoding = "async";
    }
    if (!img.hasAttribute("loading")) {
      img.loading = img.closest(".hero-illustration-frame") || img.closest(".brand") ? "eager" : "lazy";
    }

    const markReady = () => img.classList.add("is-ready");
    if (img.complete) {
      markReady();
    } else {
      img.addEventListener("load", markReady, { once: true });
      img.addEventListener("error", () => img.classList.add("has-error"), { once: true });
    }
  });
}

function applyBackground(el) {
  const url = el.dataset.bg;
  if (!url || el.dataset.bgApplied === "true") {
    return;
  }
  el.dataset.bgApplied = "true";

  const img = new Image();
  img.onload = () => {
    el.style.backgroundImage = `url("${url}")`;
    el.classList.add("is-loaded");
  };
  img.onerror = () => {
    el.classList.add("is-failed");
  };
  img.src = url;
}

function getBackgroundObserver() {
  if (STATE.backgroundObserver || prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    return STATE.backgroundObserver;
  }

  STATE.backgroundObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        applyBackground(entry.target);
        STATE.backgroundObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "200px 0px" });

  return STATE.backgroundObserver;
}

function initLazyBackgrounds(scope = document) {
  const nodes = qsa("[data-bg]", scope);
  if (!nodes.length) {
    return;
  }

  if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    nodes.forEach(applyBackground);
    return;
  }

  const observer = getBackgroundObserver();
  nodes.forEach((node) => observer.observe(node));
}

function initHeroParallax() {
  if (prefersReducedMotion() || window.innerWidth < 768) {
    return;
  }

  const targets = qsa("[data-parallax]");
  if (!targets.length) {
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    targets.forEach((target) => {
      const rect = target.getBoundingClientRect();
      const offset = Math.max(Math.min(rect.top * -0.05, 18), -18);
      target.style.transform = `translate3d(0, ${offset}px, 0) scale(1.08)`;
    });
  };

  update();
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
}

function getRevealObserver() {
  if (STATE.revealObserver || prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    return STATE.revealObserver;
  }

  STATE.revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        STATE.revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  return STATE.revealObserver;
}

function initScrollReveal(scope = document) {
  const nodes = qsa("[data-reveal]", scope);
  if (!nodes.length) {
    return;
  }

  if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    nodes.forEach((node) => {
      node.classList.add("is-visible");
    });
    return;
  }

  const observer = getRevealObserver();
  nodes.forEach((node, index) => {
    if (!node.classList.contains("reveal-ready")) {
      node.classList.add("reveal-ready");
      node.style.setProperty("--reveal-delay", `${Math.min(index * 60, 240)}ms`);
      observer.observe(node);
    }
  });
}

function getCounterObserver() {
  if (STATE.counterObserver || prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    return STATE.counterObserver;
  }

  STATE.counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }
      animateCounter(entry.target);
      STATE.counterObserver.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  return STATE.counterObserver;
}

function animateCounter(el) {
  const target = Number.parseInt(el.dataset.countup || "0", 10);
  const suffix = el.dataset.countSuffix || "";
  const pad = Number.parseInt(el.dataset.countPad || "0", 10);
  if (!Number.isFinite(target) || el.dataset.countAnimated === "true") {
    return;
  }
  el.dataset.countAnimated = "true";

  const formatValue = (value) => `${String(value).padStart(pad, "0")}${suffix}`;

  if (prefersReducedMotion()) {
    el.textContent = formatValue(target);
    return;
  }

  const startTime = performance.now();
  const duration = 900;

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatValue(Math.round(target * eased));
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  };

  window.requestAnimationFrame(tick);
}

function initCounters(scope = document) {
  const nodes = qsa("[data-countup]", scope);
  if (!nodes.length) {
    return;
  }

  if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    nodes.forEach(animateCounter);
    return;
  }

  const observer = getCounterObserver();
  nodes.forEach((node) => {
    if (node.dataset.countObserved === "true") {
      return;
    }
    node.dataset.countObserved = "true";
    observer.observe(node);
  });
}

function getBarObserver() {
  if (STATE.barObserver || prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    return STATE.barObserver;
  }

  STATE.barObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateBar(entry.target);
        STATE.barObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  return STATE.barObserver;
}

function animateBar(el) {
  const value = Number.parseFloat(el.dataset.progressValue || "0");
  if (!Number.isFinite(value)) {
    return;
  }
  el.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function initProgressBars(scope = document) {
  const bars = qsa("[data-progress-value]", scope);
  if (!bars.length) {
    return;
  }

  if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    bars.forEach(animateBar);
    return;
  }

  const observer = getBarObserver();
  bars.forEach((bar) => {
    if (bar.dataset.progressObserved === "true") {
      return;
    }
    bar.dataset.progressObserved = "true";
    observer.observe(bar);
  });
}

function hydrateLiteVideos(scope = document) {
  qsa("[data-lite-video]", scope).forEach((button) => {
    const poster = button.dataset.poster;
    const posterEl = qs(".lite-video-poster", button);
    if (poster && posterEl) {
      posterEl.style.backgroundImage = `url("${poster}")`;
    }
  });
}

function activateLiteVideo(button) {
  if (!button || button.dataset.videoLoaded === "true") {
    return;
  }
  const youtubeId = sanitizeYouTubeId(button.dataset.videoId);
  if (!youtubeId) {
    return;
  }
  button.dataset.videoLoaded = "true";
  button.innerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0"
      title="${escapeHtml(button.dataset.videoTitle || "Video AFRILEARN")}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      loading="lazy"
    ></iframe>
  `;
}

function createMediaDialogRoot() {
  let dialog = qs("[data-media-dialog]");
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("div");
  dialog.className = "media-dialog";
  dialog.dataset.mediaDialog = "true";
  dialog.innerHTML = `<div class="media-dialog-card" role="dialog" aria-modal="true" aria-label="Aperçu média"></div>`;
  document.body.appendChild(dialog);
  return dialog;
}

function openMediaDialog(item) {
  if (!item) {
    return;
  }

  const dialog = createMediaDialogRoot();
  const card = qs(".media-dialog-card", dialog);
  if (!card) {
    return;
  }

  STATE.previousFocus = document.activeElement;
  card.innerHTML = buildMediaDialog(item);
  dialog.classList.add("is-open");
  document.body.classList.add("dialog-open");
  hydrateLiteVideos(card);
  initSmartImages(card);
  const closeButton = qs("[data-modal-close]", card);
  closeButton?.focus();
}

function closeMediaDialog() {
  const dialog = qs("[data-media-dialog]");
  if (!dialog || !dialog.classList.contains("is-open")) {
    return;
  }

  dialog.classList.remove("is-open");
  document.body.classList.remove("dialog-open");
  if (STATE.previousFocus && typeof STATE.previousFocus.focus === "function") {
    STATE.previousFocus.focus();
  }
}

function initDialogDelegation() {
  document.addEventListener("click", (event) => {
    const videoTrigger = event.target.closest("[data-lite-video]");
    if (videoTrigger) {
      event.preventDefault();
      activateLiteVideo(videoTrigger);
      return;
    }

    const openTrigger = event.target.closest("[data-media-open]");
    if (openTrigger) {
      event.preventDefault();
      const index = Number.parseInt(openTrigger.dataset.mediaOpen || "-1", 10);
      openMediaDialog(STATE.mediaRenderedItems[index]);
      return;
    }

    const closeTrigger = event.target.closest("[data-modal-close]");
    if (closeTrigger) {
      event.preventDefault();
      closeMediaDialog();
      return;
    }

    const dialog = event.target.closest("[data-media-dialog]");
    if (dialog && event.target === dialog) {
      closeMediaDialog();
    }
  });
}

function refreshEnhancements(scope = document) {
  initSmartImages(scope);
  initLazyBackgrounds(scope);
  hydrateLiteVideos(scope);
  initScrollReveal(scope);
  initCounters(scope);
  initProgressBars(scope);
}

function getFilteredResources(resources) {
  const filter = STATE.mediaFilter;
  const query = normalizeText(STATE.mediaSearch);

  return asArray(resources).filter((resource) => {
    const matchesFilter = filter === "all" || resource.type === filter;
    if (!matchesFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = normalizeText([
      resource.title,
      resource.description,
      resource.meta,
      resource.tag,
      resource.type,
    ].join(" "));
    return haystack.includes(query);
  });
}

function updateMediaResultsMeta(items) {
  const el = qs("[data-media-results-meta]");
  if (!el) {
    return;
  }
  const filterLabel = STATE.mediaFilter === "all" ? "toutes catégories" : getMediaTypeLabel(STATE.mediaFilter).toLowerCase();
  el.textContent = `${items.length} ressource(s) affichée(s) · filtre : ${filterLabel}${STATE.mediaSearch ? ` · recherche : "${STATE.mediaSearch}"` : ""}`;
}

function renderDbSummary(data) {
  const el = qs("[data-db-summary]");
  if (!el || !data?.dbInfo) {
    return;
  }
  const info = data.dbInfo;
  el.textContent = `Base ${info.engine} · ${info.tables} tables · ${info.collections} collections · ${info.profiles} profil(s)`;
}

const RENDERERS = {
  stats(el, data) {
    el.innerHTML = asArray(data?.stats).map(buildStatCard).join("");
  },

  "languages-home"(el, data) {
    el.innerHTML = asArray(data?.languages).slice(0, 3).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.phase)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.zone)} · ${escapeHtml(item.level)}</p>
      </article>
    `).join("");
  },

  "languages-catalogue"(el, data) {
    el.innerHTML = asArray(data?.languages).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.phase)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.zone)} · ${escapeHtml(item.level)}</p>
      </article>
    `).join("");
  },

  "sciences-home"(el, data) {
    el.innerHTML = asArray(data?.sciences).slice(0, 3).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.level)}</span>
        <h3>${escapeHtml(item.label)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>
    `).join("");
  },

  "sciences-catalogue"(el, data) {
    el.innerHTML = asArray(data?.sciences).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.level)}</span>
        <h3>${escapeHtml(item.label)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>
    `).join("");
  },

  "news-list"(el, data) {
    el.innerHTML = asArray(data?.news).map((item) => `
      <div class="stack-item" data-reveal>
        <span class="item-tag">${escapeHtml(item.tag)}</span>
        <div class="item-body">
          ${item.youtube_id ? buildLiteVideo(item) : ""}
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <span class="item-meta">${escapeHtml(item.meta)}</span>
        </div>
      </div>
    `).join("");
  },

  "events-list"(el, data) {
    el.innerHTML = asArray(data?.events).map((item) => `
      <div class="stack-item" data-reveal>
        <span class="item-tag">${escapeHtml(item.tag)}</span>
        <div class="item-body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <span class="item-meta">${escapeHtml(item.meta)}</span>
        </div>
      </div>
    `).join("");
  },

  "forum-topics"(el, data) {
    el.innerHTML = asArray(data?.forumTopics).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.phase)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.zone)} · ${escapeHtml(item.level)}</p>
      </article>
    `).join("");
  },

  "home-highlights"(el, data) {
    el.innerHTML = asArray(data?.homeHighlights).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.phase)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.zone)} · ${escapeHtml(item.level)}</p>
      </article>
    `).join("");
  },

  "featured-media"(el, data) {
    const items = getFilteredResources(data?.resources);
    STATE.mediaRenderedItems = items;
    el.innerHTML = buildFeaturedMedia(items[0]);
  },

  "media-library"(el, data) {
    const items = getFilteredResources(data?.resources);
    STATE.mediaRenderedItems = items;
    updateMediaResultsMeta(items);

    if (!items.length) {
      el.innerHTML = `
        <div class="media-empty">
          <strong>Aucun contenu ne correspond à ce filtre.</strong>
          <p>Essayez une autre catégorie ou videz la recherche.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = items.map((item, index) => buildResourceCard(item, index)).join("");
  },

  badges(el, data) {
    el.innerHTML = asArray(data?.badges).map((item, index) => `
      <div class="badge-item" data-reveal>
        <div class="badge-icon">${BADGE_ICONS[index] || "🏅"}</div>
        <span class="badge-label">${escapeHtml(item.label)}</span>
        <span class="badge-title">${escapeHtml(item.title)}</span>
      </div>
    `).join("");
  },

  "community-groups"(el, data) {
    el.innerHTML = asArray(data?.communityGroups).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.phase)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.zone)} · ${escapeHtml(item.level)}</p>
      </article>
    `).join("");
  },

  "dashboard-stats"(el, data) {
    const progress = data?.progress;
    if (!progress) {
      return;
    }
    const items = [
      { value: progress.activeTracks, label: "parcours actifs" },
      { value: progress.lessonsCompleted, label: "leçons complétées" },
      { value: `${progress.weeklyMinutes}mn`, label: "cette semaine" },
      { value: progress.certifications, label: "certification(s)" },
    ];
    el.innerHTML = items.map(buildStatCard).join("");
  },

  "dashboard-progress"(el, data) {
    el.innerHTML = asArray(data?.progress?.tracks).map((track) => `
      <div class="progress-item" data-reveal>
        <div class="progress-header">
          <span class="progress-title">${escapeHtml(track.title)}</span>
          <span class="progress-pct">${escapeHtml(String(track.percentage))}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" data-progress-value="${escapeHtml(String(track.percentage))}"></div>
        </div>
        <div class="progress-next">→ ${escapeHtml(track.nextStep)}</div>
      </div>
    `).join("");
  },

  "dashboard-recommendations"(el, data) {
    el.innerHTML = asArray(data?.dashboard?.recommendations).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.phase)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.zone)} · ${escapeHtml(item.level)}</p>
      </article>
    `).join("");
  },

  "dashboard-week-plan"(el, data) {
    el.innerHTML = asArray(data?.dashboard?.weeklyPlan).map((item) => `
      <div class="stack-item" data-reveal>
        <span class="item-tag">${escapeHtml(item.tag)}</span>
        <div class="item-body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <span class="item-meta">${escapeHtml(item.meta)}</span>
        </div>
      </div>
    `).join("");
  },

  "performance-bars"(el, data) {
    el.innerHTML = asArray(data?.performance).map((item) => `
      <div class="perf-item" data-reveal>
        <div class="perf-header">
          <span>${escapeHtml(item.label)}</span>
          <span>${escapeHtml(String(item.value))}%</span>
        </div>
        <div class="perf-track">
          <div class="perf-fill" data-progress-value="${escapeHtml(String(item.value))}"></div>
        </div>
      </div>
    `).join("");
  },

  "admin-metrics"(el, data) {
    el.innerHTML = asArray(data?.admin?.metrics).map(buildStatCard).join("");
  },

  "admin-pipeline"(el, data) {
    el.innerHTML = asArray(data?.admin?.pipeline).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.level)}</span>
        <h3>${escapeHtml(item.label)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>
    `).join("");
  },

  "moderation-list"(el, data) {
    el.innerHTML = asArray(data?.admin?.moderation).map((item) => `
      <div class="mod-item" data-reveal>
        <div class="mod-title">${escapeHtml(item.title)}</div>
        <div class="mod-desc">${escapeHtml(item.description)}</div>
      </div>
    `).join("");
  },

  "admin-quality-checks"(el, data) {
    el.innerHTML = asArray(data?.admin?.qualityChecks).map((item) => `
      <article class="card" data-reveal>
        <span class="card-phase">${escapeHtml(item.phase)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p class="card-meta">${escapeHtml(item.zone)} · ${escapeHtml(item.level)}</p>
      </article>
    `).join("");
  },
};

function renderAll(data) {
  qsa("[data-render]").forEach((el) => {
    const key = el.dataset.render;
    if (RENDERERS[key]) {
      RENDERERS[key](el, data);
    }
  });
  refreshEnhancements();
}

function rerenderMediaViews() {
  if (!STATE.data) {
    return;
  }
  qsa("[data-render='featured-media']").forEach((el) => {
    RENDERERS["featured-media"](el, STATE.data);
  });
  qsa("[data-render='media-library']").forEach((el) => {
    RENDERERS["media-library"](el, STATE.data);
  });
  refreshEnhancements();
}

function initMediaFilters() {
  const searchInput = qs("[data-media-search]");

  qsa("[data-filter-button]").forEach((button) => {
    button.addEventListener("click", () => {
      STATE.mediaFilter = button.dataset.filterButton || "all";
      qsa("[data-filter-button]").forEach((node) => {
        node.classList.toggle("is-active", node === button);
      });
      rerenderMediaViews();
    });
  });

  if (searchInput) {
    searchInput.value = STATE.mediaSearch;
    searchInput.addEventListener("input", debounce(() => {
      STATE.mediaSearch = searchInput.value.trim();
      rerenderMediaViews();
    }, 140));
  }
}

function highlightMatch(text, query) {
  const raw = String(text ?? "");
  if (!query) {
    return escapeHtml(raw);
  }
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${safeQuery})`, "ig");
  return escapeHtml(raw).replace(regex, "<mark>$1</mark>");
}

function initDictionary(data) {
  const input = qs("[data-dictionary-search]");
  const results = qs("[data-dictionary-results]");
  if (!input || !results) {
    return;
  }

  const dictionary = asArray(data?.dictionary);

  const renderResults = () => {
    const query = input.value.trim();
    const normalized = normalizeText(query);
    if (!query) {
      results.innerHTML = "";
      return;
    }

    const hits = dictionary
      .filter((entry) => normalizeText(`${entry.word} ${entry.translation} ${entry.example}`).includes(normalized))
      .slice(0, 8);

    if (!hits.length) {
      results.innerHTML = `<p class="card-meta">Aucun résultat pour « ${escapeHtml(query)} ».</p>`;
      return;
    }

    results.innerHTML = hits.map((entry) => `
      <div class="dict-entry" data-reveal>
        <div class="dict-word">${highlightMatch(entry.word, query)}</div>
        <div class="dict-translation">${highlightMatch(entry.translation, query)}</div>
        <div class="dict-example">${highlightMatch(entry.example, query)}</div>
      </div>
    `).join("");
    refreshEnhancements(results);
  };

  input.addEventListener("input", debounce(renderResults, 100));
}

function initFlashcards(data) {
  const card = qs("[data-flashcard]");
  const button = qs("[data-flashcard-next]");
  if (!card || !button) {
    return;
  }

  const dictionary = asArray(data?.dictionary);
  let index = 0;
  let flipped = false;

  const term = qs(".flashcard-term", card);
  const meaning = qs(".flashcard-meaning", card);
  const example = qs(".flashcard-example", card);

  const renderCard = () => {
    const entry = dictionary[index];
    if (!entry) {
      return;
    }
    if (term) {
      term.textContent = entry.word;
    }
    if (meaning) {
      meaning.textContent = entry.translation;
    }
    if (example) {
      example.textContent = entry.example;
    }
    card.classList.toggle("is-flipped", flipped);
    card.setAttribute("aria-pressed", String(flipped));
  };

  const toggle = () => {
    flipped = !flipped;
    renderCard();
  };

  card.addEventListener("click", toggle);
  button.addEventListener("click", () => {
    if (!dictionary.length) {
      return;
    }
    index = (index + 1) % dictionary.length;
    flipped = false;
    renderCard();
  });

  if (dictionary.length) {
    renderCard();
  }
}

function initScienceQuiz() {
  const form = qs("[data-science-quiz]");
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const feedback = qs("[data-quiz-feedback]", form);
    const selected = qs("[name='quiz']:checked", form);
    if (!feedback || !selected) {
      return;
    }

    if (selected.value === "correct") {
      feedback.innerHTML = '<i class="fa-solid fa-check" style="color:var(--c-earth)"></i> Correct. Chaque leçon relie vidéo, lexique et exercices.';
      feedback.className = "quiz-feedback correct";
    } else {
      feedback.innerHTML = '<i class="fa-solid fa-xmark" style="color:#d32f2f"></i> Réponse incorrecte. Une leçon scientifique AFRILEARN associe également un lexique et des exercices.';
      feedback.className = "quiz-feedback incorrect";
    }
  });
}

function initAuthTabs() {
  qsa("[data-auth-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.authTab;
      qsa("[data-auth-tab]").forEach((node) => {
        const active = node === tab;
        node.classList.toggle("is-active", active);
        node.setAttribute("aria-selected", String(active));
      });
      qsa("[data-auth-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.authPanel === target);
      });
    });
  });
}

function initLoginForm() {
  const form = qs("[data-login-form]");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = qs("[data-login-message]");
    const button = qs("button[type='submit']", form);
    const data = new FormData(form);
    const email = String(data.get("identifier") || data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    if (!validateEmail(email)) {
      setFormMessage(message, "Saisissez une adresse e-mail valide.", "error");
      qs("[name='identifier']", form)?.focus();
      return;
    }

    if (!password) {
      setFormMessage(message, "Saisissez votre mot de passe.", "error");
      qs("[name='password']", form)?.focus();
      return;
    }

    setSubmitState(button, "Connexion en cours...", "Accéder à mon espace", true);
    setFormMessage(message, "");

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: {
          email,
          password,
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        setFormMessage(message, "Connexion établie. Redirection vers votre espace...", "success");
        window.setTimeout(() => {
          window.location.href = resolveNextUrl("/tableau-de-bord.html");
        }, 700);
      } else {
        setFormMessage(message, payload.error || "Connexion impossible. Vérifiez vos identifiants.", "error");
        await fetchCsrf();
      }
    } finally {
      setSubmitState(button, "Connexion en cours...", "Accéder à mon espace", false);
    }
  });
}

function initRegisterForm() {
  const form = qs("[data-register-form]");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = qs("[data-register-message]");
    const button = qs("button[type='submit']", form);
    const data = new FormData(form);
    const firstName = String(data.get("firstName") || "").trim();
    const country = String(data.get("country") || "").trim();
    const region = String(data.get("region") || "").trim();
    const nativeLanguage = String(data.get("nativeLanguage") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const passwordConfirm = String(data.get("passwordConfirm") || "");

    if (firstName.length < 2) {
      setFormMessage(message, "Renseignez un prénom valide.", "error");
      qs("[name='firstName']", form)?.focus();
      return;
    }

    if (!country || !region || !nativeLanguage) {
      setFormMessage(message, "Complétez le pays, la région et la langue principale.", "error");
      (!country ? qs("[name='country']", form) : !region ? qs("[name='region']", form) : qs("[name='nativeLanguage']", form))?.focus();
      return;
    }

    if (!validateEmail(email)) {
      setFormMessage(message, "Saisissez une adresse e-mail valide.", "error");
      qs("[name='email']", form)?.focus();
      return;
    }

    if (!validatePassword(password)) {
      setFormMessage(message, "Le mot de passe doit contenir au moins 8 caractères, une lettre et un chiffre.", "error");
      qs("[name='password']", form)?.focus();
      return;
    }

    if (password !== passwordConfirm) {
      setFormMessage(message, "La confirmation du mot de passe ne correspond pas.", "error");
      qs("[name='passwordConfirm']", form)?.focus();
      return;
    }

    setSubmitState(button, "Création du compte...", "Créer le compte", true);
    setFormMessage(message, "");

    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: {
          email,
          password,
          firstName,
          country,
          region,
          nativeLanguage,
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        setFormMessage(message, "Compte créé. Redirection vers votre espace...", "success");
        window.setTimeout(() => {
          window.location.href = resolveNextUrl("/tableau-de-bord.html");
        }, 850);
      } else {
        setFormMessage(message, payload.error || "Création du compte impossible. Vérifiez les informations saisies.", "error");
        await fetchCsrf();
      }
    } finally {
      setSubmitState(button, "Création du compte...", "Créer le compte", false);
    }
  });
}

function initPasswordToggles() {
  qsa("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.parentElement?.querySelector("input");
      if (!field) {
        return;
      }
      const visible = field.type === "text";
      field.type = visible ? "password" : "text";
      button.textContent = visible ? "Afficher" : "Masquer";
      button.setAttribute("aria-label", visible ? "Afficher le mot de passe" : "Masquer le mot de passe");
    });
  });
}

function initPageGuard() {
  const page = document.body.dataset.page;
  const protectedPages = ["dashboard", "admin"];
  if (!protectedPages.includes(page)) {
    return;
  }
  if (!STATE.user) {
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    window.location.replace(buildAuthUrl(returnUrl));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initHeaderState();
  injectKenteStrip();
  initDialogDelegation();
  refreshEnhancements();
  initHeroParallax();

  await fetchCsrf();
  await loadAuthState();
  initPageGuard();
  const data = await loadBootstrap();

  renderAll(data);
  renderDbSummary(data);
  initDictionary(data);
  initFlashcards(data);
  initScienceQuiz();
  initMediaFilters();
  initAuthTabs();
  initPasswordToggles();
  initLoginForm();
  initRegisterForm();
});
