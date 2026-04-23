# Architecture Technique AFRILEARN

## 1. Positionnement

Le dossier AFRILEARN n'est plus seulement statique :

- frontend en `HTML + CSS + JS`
- backend `Flask`
- base de données `SQLite`

Le choix reste cohérent avec une phase MVP légère, mais ajoute une persistance réelle.

## 2. Stack retenue pour cette livraison

### Frontend actuel

- `HTML5`
- `CSS3`
- `JavaScript` natif
- `localStorage` pour la continuité côté navigateur
- `Service Worker` simple pour hors-ligne partiel
- `Web App Manifest` pour une expérience PWA légère

### Backend actuel

- `Flask`
- `sqlite3`
- API JSON légère
- sessions signées
- protection CSRF
- authentification par mot de passe haché

### Hébergement compatible

- GitHub Pages, Netlify, Vercel pour le frontend seul
- hébergement Python pour la version complète avec API

## 3. Modules couverts

### Couverture directe dans ce MVP

- accueil
- authentification visible
- catalogue langues
- catalogue sciences
- médiathèque
- communauté
- tableau de bord apprenant
- administration produit

### Couverture fonctionnelle partielle

- inscription et connexion : interface + backend sécurisé + persistance SQLite
- suivi apprenant : simulation côté navigateur, synchronisable avec la base
- badges et progression : simulation côté navigateur
- filtres de contenus : implémentés côté navigateur
- quiz et flashcards : implémentés côté navigateur

### À implémenter dans une phase suivante

- récupération de mot de passe par e-mail ou SMS
- OAuth Google / Facebook réel
- enregistrement vocal
- stockage média distant
- forum réel, messagerie réelle, notifications réelles
- analytics serveur avancés
- modération persistante complète

## 4. Arborescence logique

### Pages

- `index.html`
- `langues.html`
- `sciences.html`
- `mediatheque.html`
- `communaute.html`
- `tableau-de-bord.html`
- `administration.html`
- `authentification.html`

### Couches frontend

- `assets/css/styles.css`
  Regroupe l'identité visuelle, la grille responsive, l'accessibilité, les backgrounds photo et les composants UI.

- `assets/js/data.js`
  Centralise les données de secours si l'API n'est pas disponible.

- `assets/js/app.js`
  Gère l'initialisation, la navigation mobile, le rendu des cartes, la traduction d'interface, le stockage local, la lecture API et les interactions utilisateur.

### Couche backend

- `app.py`
  Sert les pages statiques et expose les endpoints JSON.

- `init_db.py`
  Crée et alimente la base SQLite avec les collections de contenu et le profil par défaut.

- `data/afrilearn.db`
  Base de données légère du projet.

## 5. Schéma actuel simplifié

### Tables actuelles

- `collections`
- `profiles`
- `progress_snapshots`
- `progress_tracks`

### Rôle

- `collections`
  Stocke les ensembles de contenus du site en JSON : langues, sciences, ressources, badges, admin.

- `profiles`
  Stocke les profils apprenants de base.

- `progress_snapshots`
  Stocke les indicateurs synthétiques du tableau de bord.

- `progress_tracks`
  Stocke les parcours détaillés affichés dans le dashboard.

## 6. Passage recommandé vers une vraie architecture produit

### Option A

- Frontend : `Next.js`
- Backend : `Node.js` / `NestJS` ou `Express`
- Base de données : `PostgreSQL`
- Stockage médias : `Cloudflare R2` ou `Amazon S3`
- Auth : `JWT` + `OAuth 2.0`

### Option B

- Frontend : `Next.js`
- Backend : `Django`
- Base de données : `PostgreSQL`
- Stockage médias : `S3 compatible`
- Admin : `Django Admin` + back-office dédié

## 7. Modèle de données recommandé

### Tables minimales en phase produit

- `users`
- `profiles`
- `languages`
- `courses`
- `lessons`
- `media_assets`
- `science_disciplines`
- `science_lessons`
- `progress_records`
- `badges`
- `user_badges`
- `forum_topics`
- `forum_posts`
- `events`
- `notifications`

## 8. Sécurité

Le cahier des charges demande :

- HTTPS obligatoire
- chiffrement des mots de passe
- protection XSS, CSRF et injections SQL
- anti-brute force
- conformité données personnelles

### Application concrète recommandée

- `Argon2id` ou `bcrypt` pour les mots de passe
- cookies HTTP-only sécurisés ou jetons courts + rotation
- validation stricte des entrées
- CSP, headers de sécurité et sanitation HTML
- limitation de débit sur login, mot de passe oublié et API sensibles
- sauvegardes quotidiennes et journalisation

## 9. Accessibilité et performance

Déjà prises en compte dans ce MVP :

- structure sémantique
- lien de contournement
- contrastes élevés
- boutons et formulaires explicites
- navigation mobile
- poids léger et absence de dépendances complexes

À renforcer ensuite :

- audit WCAG automatisé
- transcription audio/vidéo complète
- sous-titres synchronisés
- navigation clavier exhaustive sur tous les composants avancés

## 10. Déploiement recommandé

### Phase actuelle

- dépôt Git
- déploiement Python simple pour `Flask + SQLite`
- domaine propre
- CDN via Cloudflare si besoin

### Phase produit

- VPS Linux
- reverse proxy Nginx
- backend applicatif
- PostgreSQL managé ou auto-hébergé
- stockage objet pour médias

## 11. Conclusion

Ce dossier répond maintenant à la partie technique du cahier des charges dans une forme plus concrète :

- une base visuelle solide
- un périmètre fonctionnel visible complet
- une base de données minimale réelle
- un chemin clair vers une architecture robuste

Le site créé ici est donc un socle réel de démonstration, pas une simple maquette statique.
