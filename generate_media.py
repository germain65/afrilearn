import os
from gtts import gTTS
from fpdf import FPDF
import time

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

# --- 1. Génération des MP3 (Swahili) ---
def generate_audio():
    print("Génération des fichiers MP3...")
    ensure_dir('assets/media/audio')
    
    audios = [
        {
            'filename': 'assets/media/audio/proverbes_swahili.mp3',
            'text': 'Haraka haraka haina baraka. Pole pole ndio mwendo.',
            'lang': 'sw'
        },
        {
            'filename': 'assets/media/audio/alphabet_swahili.mp3',
            'text': 'A. E. I. O. U. Habari. Karibu. Asante.',
            'lang': 'sw'
        },
        {
            'filename': 'assets/media/audio/dialogue_marche.mp3',
            'text': 'Jambo. Jambo sana. Habari gani? Nzuri. Karoti ni bei gani? Elfu moja. Asante. Kwa heri.',
            'lang': 'sw'
        }
    ]
    
    for a in audios:
        tts = gTTS(a['text'], lang=a['lang'])
        tts.save(a['filename'])
        print(f"Créé: {a['filename']}")

# --- 2. Génération des PDF ---
class PDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 15)
        self.cell(80)
        self.cell(30, 10, "AFRILEARN", border=0, align="C")
        self.ln(20)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def generate_pdf():
    print("Génération des fichiers PDF...")
    ensure_dir('assets/media/pdf')
    
    # PDF 1 : Guide Grammatical
    pdf = PDF()
    pdf.add_page()
    pdf.set_font("helvetica", "B", 16)
    pdf.cell(0, 10, "Guide Grammatical Swahili A1", ln=True, align="C")
    pdf.ln(10)
    
    content = [
        ("Les Pronoms Personnels", "Mimi (Je), Wewe (Tu), Yeye (Il/Elle), Sisi (Nous), Nyinyi (Vous), Wao (Ils/Elles)."),
        ("Les Préfixes de Sujet", "ni- (je), u- (tu), a- (il/elle), tu- (nous), m- (vous), wa- (ils/elles)."),
        ("Les Temps de base", "-na- (présent), -li- (passé), -ta- (futur)."),
        ("Exemple simple", "Mimi ni-na-soma (Je lis) -> Ninasoma.")
    ]
    
    for title, text in content:
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, title, ln=True)
        pdf.set_font("helvetica", "", 11)
        pdf.multi_cell(0, 8, text)
        pdf.ln(5)
        
    pdf.output('assets/media/pdf/guide_grammatical_a1.pdf')
    print("Créé: assets/media/pdf/guide_grammatical_a1.pdf")
    
    # PDF 2 : Lexique Scientifique
    pdf2 = PDF()
    pdf2.add_page()
    pdf2.set_font("helvetica", "B", 16)
    pdf2.cell(0, 10, "Lexique Scientifique Bilingue (Swahili / Francais)", ln=True, align="C")
    pdf2.ln(10)
    
    lexique = [
        ("Mathématiques", "Hesabu"),
        ("Santé", "Afya"),
        ("Environnement", "Mazingira"),
        ("Énergie", "Nishati"),
        ("Nombre / Chiffre", "Namba"),
        ("Géométrie", "Jiometri")
    ]
    
    pdf2.set_font("helvetica", "", 12)
    for fr, sw in lexique:
        pdf2.cell(0, 10, f"{sw} : {fr}", ln=True)
        
    pdf2.output('assets/media/pdf/lexique_scientifique.pdf')
    print("Créé: assets/media/pdf/lexique_scientifique.pdf")

if __name__ == "__main__":
    generate_audio()
    generate_pdf()
    print("Terminé ! Les médias réels sont prêts.")
