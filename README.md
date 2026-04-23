# AFRILEARN Site

Prototype AFRILEARN avec frontend multi-pages et backend léger `Flask + SQLite`.

## Objectif

Cette base matérialise les modules visibles demandés et ajoute une base de données minimale :

- page d'accueil
- authentification
- apprentissage des langues
- module scientifique
- médiathèque
- espace communautaire
- tableau de bord apprenant
- interface d'administration

Le projet reste léger et pragmatique :

- frontend en `HTML`, `CSS`, `JavaScript`
- backend `Flask` avec session, CSRF et rôles
- base de données `SQLite`
- déploiement local immédiat sans stack lourde

## Arborescence

```text
afrilearn-site/
├── administration.html
├── app.py
├── authentification.html
├── communaute.html
├── index.html
├── init_db.py
├── langues.html
├── manifest.webmanifest
├── mediatheque.html
├── README.md
├── requirements.txt
├── sciences.html
├── sw.js
├── tableau-de-bord.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── img/
│   │   ├── backgrounds/
│   │   ├── favicon.svg
│   │   ├── hero-knowledge.svg
│   │   └── logo-afrilearn.svg
│   └── js/
│       ├── app.js
│       └── data.js
├── data/
│   └── afrilearn.db
└── docs/
    ├── architecture-technique.md
    └── matrice-conformite.md
```

## Fonctions incluses

- design responsive mobile-first
- backgrounds photo réels par page
- palette visuelle conforme au cahier des charges
- navigation multi-pages
- traduction d'interface FR / EN pour le shell principal
- stockage local pour profil et progression
- lecture prioritaire des contenus depuis SQLite via API
- authentification sécurisée côté serveur
- dictionnaire de démonstration
- flashcards
- quiz scientifique de démonstration
- filtres de médiathèque
- badges, progression et analytics simulés
- manifest PWA et service worker simple pour hors-ligne partiel

## Lancer localement

### Mode recommandé avec base de données

Initialiser la base puis lancer le serveur :

```powershell
python init_db.py
python app.py
```

Puis ouvrir :

```text
http://127.0.0.1:5000/
```

Compte démo local :

```text
amani@afrilearn.org / Afrilearn2026!
```

### Mode statique de secours

Le frontend peut encore être ouvert sans backend :

```powershell
python -m http.server 8080
```

Puis ouvrir :

```text
http://127.0.0.1:8080/
```

## Déploiement

- Le frontend seul peut être déployé sur `GitHub Pages`, `Netlify` ou `Vercel`.
- La version avec base SQLite doit tourner sur un hébergement Python.

### Déploiement Railway

Le dépôt est prêt pour Railway avec [`railway.toml`](/C:/Users/USER/Desktop/afrilearn-site/railway.toml) et `gunicorn`.

Configuration recommandée sur Railway :

- importer le repo GitHub : [https://github.com/germain65/afrilearn](https://github.com/germain65/afrilearn)
- laisser Railway builder avec `Railpack`
- start command : `gunicorn app:app --bind 0.0.0.0:$PORT`
- healthcheck path : `/`
- ajouter un volume monté par exemple sur `/data`
- définir la variable : `AFRILEARN_DB_PATH=/data/afrilearn.db`

Variables optionnelles pour un compte démo :

- `AFRILEARN_DEMO_EMAIL`
- `AFRILEARN_DEMO_PASSWORD`
- `AFRILEARN_DEMO_FIRST_NAME`
- `AFRILEARN_DEMO_COUNTRY`
- `AFRILEARN_DEMO_REGION`
- `AFRILEARN_DEMO_NATIVE_LANGUAGE`
- `AFRILEARN_DEMO_ROLE`

## Notes techniques

- Les données de secours restent dans `assets/js/data.js`.
- La source prioritaire devient `SQLite` via `app.py`.
- Le comportement utilisateur visible est géré dans `assets/js/app.js`.
- L'initialisation de la base est gérée dans `init_db.py`.
- Les exigences backend, sécurité et montée en charge sont précisées dans `docs/architecture-technique.md`.
