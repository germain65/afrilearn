import glob
import re

fixes = [
    (r'<div class="lang-switch".*?</div>', ''),
    ('MVP frontend avec Flask + SQLite en backend.', 'AFRILEARN - Déploiement Phase 1.'),
    ("MVP expose l'expérience", 'Cette page vous donne un aperçu'),
    ('rend visible la structure MVP', 'rend visible la structure'),
    ('Le MVP prévoit une chaîne éditoriale', 'Cette page met en valeur une chaîne éditoriale'),
    ('Authentification réelle avec hachage/CSRF', 'Connexion sécurisée'),
    ('Le MVP simule un profil,', 'Bienvenue sur le tableau de bord,'),
    ('Cette page matérialise les besoins', "L'administration matérialise les besoins"),
    ('href="docs/', 'href="#'),
    ('href="README.md"', 'href="#"'),
    ('<!-- MVP: Cette structure permet de voir comment fonctionne la modération -->', ''),
    ('<button class="btn btn-outline btn-block">Continuer avec Google</button>', ''),
    ('<button class="btn btn-outline btn-block">Continuer avec Facebook</button>', ''),
    (r'<div class="auth-demo-credentials alert alert-info">.*?</div>', ''),
]

for f in glob.glob('*.html'):
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            
        if '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome' not in content:
            content = content.replace('</head>', '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n</head>')
            
        for old, new in fixes:
            if '.*?' in old:
                content = re.sub(old, new, content, flags=re.DOTALL)
            else:
                content = content.replace(old, new)
        
        content = re.sub(r'<h3>🎤 Parler</h3>', '<h3><i class="fa-solid fa-microphone"></i> Parler</h3>', content)
        content = re.sub(r'<h3>👂 Écouter</h3>', '<h3><i class="fa-solid fa-ear-listen"></i> Écouter</h3>', content)
        content = re.sub(r'<h3>📖 Lire</h3>', '<h3><i class="fa-solid fa-book-open"></i> Lire</h3>', content)
        content = re.sub(r'<h3>✍️ Écrire</h3>', '<h3><i class="fa-solid fa-pen"></i> Écrire</h3>', content)
        content = re.sub(r'<h3>🌍 Langues africaines</h3>', '<h3><i class="fa-solid fa-earth-africa"></i> Langues africaines</h3>', content)
        content = re.sub(r'<h3>📊 Suivi personnalisé</h3>', '<h3><i class="fa-solid fa-chart-simple"></i> Suivi personnalisé</h3>', content)
        content = re.sub(r'<h3>📚 Médiathèque</h3>', '<h3><i class="fa-solid fa-book"></i> Médiathèque</h3>', content)
        content = re.sub(r'<h3>🤝 Communauté</h3>', '<h3><i class="fa-solid fa-handshake"></i> Communauté</h3>', content)

        content = content.replace('<p class="eyebrow">Bibliothèque de textes</p>\\n          <div class="section-head">\\n            <p class="eyebrow">Bibliothèque de textes</p>', '<div class="section-head">\\n            <p class="eyebrow">Bibliothèque de textes</p>')
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
            
    except Exception as e:
        print(f'Error modifying {f}: {e}')
print('HTML files fixed successfully!')
