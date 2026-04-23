/* AFRILEARN — données de secours si l'API Flask n'est pas disponible */
const FALLBACK_DATA = {
  stats: [
    {"value":"06","label":"langues planifiées"},
    {"value":"10","label":"disciplines scientifiques"},
    {"value":"04","label":"compétences linguistiques"},
    {"value":"04","label":"tables SQLite"},
  ],
  languages: [
    {"phase":"Phase 1A","name":"Swahili","zone":"Est RDC, Grands Lacs","level":"A1 à C2","description":"Langue de lancement, parcours complet et premiers modules scientifiques."},
    {"phase":"Phase 1B","name":"Mashi","zone":"Sud-Kivu","level":"A1 à B2","description":"Extension régionale pour renforcer l'ancrage culturel du projet."},
    {"phase":"Phase 1B","name":"Kilega","zone":"Maniema, Sud-Kivu","level":"A1 à B2","description":"Intégration progressive avec enregistrements et glossaires."},
    {"phase":"Phase 1B","name":"Kinande","zone":"Nord-Kivu","level":"A1 à B2","description":"Déploiement régional avec ressources communautaires."},
    {"phase":"Phase 1B","name":"Kihunde","zone":"Nord-Kivu","level":"A1 à B2","description":"Parcours structuré avec locuteurs natifs."},
    {"phase":"Phase 1B","name":"Kinyarwanda","zone":"Rwanda, Est RDC","level":"A1 à B2","description":"Ouverture régionale des Grands Lacs."},
  ],
  sciences: [
    {"label":"Mathématiques","level":"Collège - Lycée","description":"Arithmétique, algèbre, géométrie, statistiques."},
    {"label":"Médecine et santé","level":"Lycée - Supérieur","description":"Anatomie, hygiène, premiers secours."},
    {"label":"SVT","level":"Collège - Lycée","description":"Biologie, botanique, écologie africaine."},
    {"label":"Histoire","level":"Collège - Supérieur","description":"Histoire africaine, civilisations, histoires locales."},
    {"label":"Géographie","level":"Collège - Supérieur","description":"Cartographie, ressources naturelles."},
    {"label":"Entrepreneuriat","level":"Lycée - Supérieur","description":"Économie locale et modèles africains."},
  ],
  resources: [
    {"type":"audio","tag":"Audio","title":"Proverbes swahili","description":"Proverbes commentés par un locuteur natif.","meta":"12 min · MP3"},
    {"type":"audio","tag":"Conversation","title":"Dialogue du marché","description":"Compréhension orale quotidienne.","meta":"08 min · MP3"},
    {"type":"video","tag":"Cours","title":"Mathématiques en swahili","description":"Capsule avec résumé et lexique.","meta":"18 min · MP4"},
    {"type":"video","tag":"Conférence","title":"Langues africaines et sciences","description":"Transmission du savoir en langue locale.","meta":"34 min · MP4"},
    {"type":"texte","tag":"Texte","title":"Contes des Grands Lacs","description":"Anthologie de récits transcrits.","meta":"PDF"},
    {"type":"telechargement","tag":"PDF","title":"Guide grammatical A1","description":"Fiche téléchargeable débutant.","meta":"PDF"},
  ],
  news: [
    {"tag":"Produit","title":"MVP AFRILEARN v2","description":"Sécurité renforcée et refonte visuelle.","meta":"Avril 2026"},
    {"tag":"Contenus","title":"Priorité au swahili","description":"Premiers parcours en cours de structuration.","meta":"Phase 1A"},
  ],
  events: [
    {"tag":"Atelier","title":"Pratique orale swahili","description":"Session de conversation guidée.","meta":"24 avril 2026"},
    {"tag":"Webinaire","title":"Sciences en langues africaines","description":"Présentation du module scientifique.","meta":"30 avril 2026"},
  ],
  forumTopics: [
    {"phase":"Forum langue","name":"Prononciation swahili","zone":"Débutants","level":"24 messages","description":"Aide entre apprenants."},
    {"phase":"Forum sciences","name":"Lexique mathématique","zone":"Contributeurs","level":"12 messages","description":"Unification des termes scientifiques."},
    {"phase":"Forum communauté","name":"Diaspora et transmission","zone":"Communauté","level":"31 messages","description":"Réintroduire les langues d'origine."},
  ],
  badges: [
    {"label":"Voix claire","title":"5 exercices oraux validés","description":"Compétence parler reconnue."},
    {"label":"Oreille active","title":"3 écoutes complètes","description":"Compréhension orale régulière."},
    {"label":"Curieux culturel","title":"2 textes lus","description":"Découverte du patrimoine oral."},
    {"label":"Passeport science","title":"Quiz scientifique réussi","description":"Module scientifique validé."},
  ],
  dictionary: [
    {"word":"habari","translation":"bonjour / nouvelles","example":"Habari za asubuhi ?"},
    {"word":"asante","translation":"merci","example":"Asante sana."},
    {"word":"karibu","translation":"bienvenue","example":"Karibu AFRILEARN."},
    {"word":"shule","translation":"école","example":"Ninaenda shule."},
    {"word":"hesabu","translation":"mathématiques","example":"Hesabu ni somo muhimu."},
    {"word":"afya","translation":"santé","example":"Afya bora ni muhimu."},
  ],
  performance: [
    {"label":"Parler","value":72},
    {"label":"Écouter","value":68},
    {"label":"Lire","value":81},
    {"label":"Écrire","value":64},
  ],
  profile: {"firstName":"Amani","country":"RDC","region":"Sud-Kivu","nativeLanguage":"Swahili","email":"amani@afrilearn.org"},
  progress: {
    "activeTracks":3,"lessonsCompleted":18,"weeklyMinutes":145,"certifications":1,
    "tracks":[
      {"title":"Swahili A1","percentage":72,"nextStep":"Prononciation guidée - unité 6","detail":"Parler, écouter, lire, écrire"},
      {"title":"Mathématiques en swahili","percentage":38,"nextStep":"Lexique de base - module 2","detail":"Niveau collège"},
      {"title":"Culture orale des Grands Lacs","percentage":56,"nextStep":"Lecture de proverbes - séquence 4","detail":"Médiathèque"},
    ],
  },
  admin: {
    metrics:[
      {"value":"124","label":"apprenants inscrits"},
      {"value":"18","label":"contenus en validation"},
      {"value":"07","label":"contributeurs actifs"},
      {"value":"03","label":"alertes de modération"},
    ],
    pipeline:[
      {"label":"Cours swahili A1","level":"Contenu","description":"En attente de validation native."},
      {"label":"Lexique mathématique","level":"Sciences","description":"Version bilingue à harmoniser."},
    ],
    moderation:[
      {"title":"Message forum à relire","description":"Vérification terminologique requise."},
      {"title":"Fiche incomplète","description":"PDF sans mention de langue ni niveau."},
    ],
  },
};