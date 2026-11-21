"""
Robot qui collecte les écoles, facultés, programmes et cours
et les écrit dans maquette/data.js pour la maquette Study Space.

- ULiège : lu automatiquement sur programmes.uliege.be (année 2026-2027),
  avec les vrais cours de tous les programmes de toutes les facultés.
- HELMo et HEPL : listes recopiées depuis helmo.be/fr/formations et hepl.be/fr/formations
  (novembre 2026). Pas encore de cours détaillés.

Lancer :  python3 outils/collecte_donnees.py
"""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

YEAR = "20262027"
# Pour l'instant Kampus commence uniquement avec l'ULiège.
# Mettre True pour rajouter HELMo et la HEPL plus tard.
INCLUDE_HAUTES_ECOLES = False
BASE = f"https://www.programmes.uliege.be/cocoon/{YEAR}"
ROOT = Path(__file__).resolve().parent.parent
OUTS = [ROOT / "site" / "data.js", ROOT / "maquette" / "data.js"]   # vraie version + maquette


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (StudySpace mockup)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower())
    return s.strip("-")[:60]


# ---------------------------------------------------------------- ULiège
ULIEGE_FACS = {
    "T": ("archi", "Architecture", "🏛️"),
    "D": ("droit", "Droit, Science politique et Criminologie", "⚖️"),
    "R": ("gembloux", "Gembloux Agro-Bio Tech", "🌱"),
    "G": ("hec", "HEC Liège – École de Gestion", "💼"),
    "M": ("medecine", "Médecine", "🩺"),
    "V": ("veto", "Médecine vétérinaire", "🐾"),
    "P": ("philo", "Philosophie et Lettres", "📜"),
    "Y": ("psycho", "Psychologie, Logopédie et Sciences de l'éducation", "🧠"),
    "S": ("sciences", "Sciences", "🔬"),
    "A": ("appliquees", "Sciences appliquées (ingénieur civil)", "⚙️"),
    "H": ("sociales", "Sciences sociales", "🤝"),
}


def year_labels(kind, n):
    if kind == "Bachelier":
        return [f"Bac {i}" for i in range(1, n + 1)]
    if kind == "Master":
        return [f"Master {i}" for i in range(1, n + 1)]
    if kind == "Bac + Master":
        return [f"Bloc {i}" for i in range(1, n + 1)]
    return [f"Année {i}" for i in range(1, n + 1)]


def uliege_programmes(level):
    page = get(f"{BASE}/recherche.html?source=formation&fo_niveau={level}")
    rows = re.findall(
        r'<td class="u-courses-results__row__cell">(Bachelier|Master)</td>.*?'
        r'cell--title">(.*?)</td>.*?formations/bref/([A-Z0-9]+)\.html',
        page, re.S)
    out = []
    for kind, title, code in rows:
        title = clean(title)
        if "Réinscription uniquement" in title:
            continue
        m = re.search(r"\((\d+) crédits\)", title)
        credits = int(m.group(1)) if m else (180 if kind == "Bachelier" else 120)
        name = re.sub(r"\s*\(\d+ crédits\)", "", title).strip()
        out.append({"code": code, "kind": kind, "name": f"{kind} {name}",
                    "years": max(1, credits // 60)})
    return out


def hec_courses(code, n_years, kind):
    page = get(f"{BASE}/programmes/{code}_C.html")
    labels = year_labels(kind, n_years)
    courses = {lab: [] for lab in labels}
    seen = set()
    # On découpe la page en morceaux, chaque morceau commence par un titre de section
    caption = "Cours obligatoires"
    pos = 0
    tokens = re.finditer(
        r'<h3 class="u-courses-caption__title">(.*?)</h3>|'
        r'<tr[^>]*class="u-courses-row"[^>]*>(.*?)</tr>', page, re.S)
    for t in tokens:
        if t.group(1) is not None:
            caption = clean(t.group(1))
            continue
        row = t.group(2)
        cm = re.search(r'itemprop="courseCode">([^<]+)<', row)
        if not cm:
            continue  # sous-partie d'un cours, on ignore
        ccode = cm.group(1).strip()
        nm = re.search(r'itemprop="name">(.*?)</span>(.*?)</i>', row, re.S)
        name = clean(nm.group(1)) if nm else ccode
        lang = clean(nm.group(2)) if nm else ""
        if "anglais" in lang:
            name += " (EN)"
        people = re.search(r'u-courses-cell__people">(.*?)</div>', row, re.S)
        prof = clean(people.group(1)) if people else ""
        prof = re.sub(r"\s*-\s*Suppl\s*:.*$", "", prof)
        prof = re.sub(r"\s+,", ",", prof)
        bloc = re.search(r'cell--data--bloc">(.*?)</td>', row, re.S)
        orga = re.search(r'cell--data--orga">(.*?)</td>', row, re.S)
        cred = re.search(r'cell--data--credits">(.*?)</td>', row, re.S)
        blocs = re.findall(r"B(\d)", clean(bloc.group(1)) if bloc else "")
        for b in blocs:
            idx = int(b) - 1
            if idx >= len(labels):
                continue
            key = (labels[idx], ccode)
            if key in seen:
                continue
            seen.add(key)
            courses[labels[idx]].append({
                "code": ccode,
                "name": name,
                "prof": prof,
                "q": clean(orga.group(1)) if orga else "",
                "cr": clean(cred.group(1)) if cred else "",
                "choice": "choix" in caption.lower(),
            })
    return courses


def build_uliege():
    facs = {k: {"id": v[0], "name": v[1], "ico": v[2], "programmes": []} for k, v in ULIEGE_FACS.items()}
    progs = uliege_programmes("BAC") + uliege_programmes("MASTER")
    for p in progs:
        letter = p["code"][0]
        if letter not in facs:
            continue  # programmes inter-écoles (ex : Z = HEL)
        entry = {
            "id": p["code"].lower(),
            "name": p["name"],
            "kind": p["kind"],
            "years": year_labels(p["kind"], p["years"]),
            "source": f"{BASE}/formations/bref/{p['code']}.html",
        }
        # Les vrais cours de chaque programme, pour toutes les facultés
        for attempt in range(3):
            try:
                entry["courses"] = hec_courses(p["code"], p["years"], p["kind"])
                n = sum(len(v) for v in entry["courses"].values())
                print(f"  {p['code']}: {n} cours", file=sys.stderr)
                break
            except Exception as e:  # noqa
                print(f"  ! {p['code']} (essai {attempt + 1}): {e}", file=sys.stderr)
                time.sleep(2)
        time.sleep(0.3)  # on reste poli avec le site
        facs[letter]["programmes"].append(entry)
    return {"id": "uliege", "name": "ULiège", "full": "Université de Liège", "ico": "🎓",
            "label": "Faculté", "faculties": list(facs.values())}


# ---------------------------------------------------------------- HELMo / HEPL
# (domaine, [(type, nom, années)])
HELMO = [
    ("Sciences biomédicales & pharmaceutiques", "🧪", [
        ("Bachelier", "Technologue de laboratoire médical", 3),
        ("Bachelier", "Biopharmaceutique (en alternance)", 3)]),
    ("Sciences de l'éducation & enseignement", "🍎", [
        ("Bachelier", "Accueil et éducation du jeune enfant", 3),
        ("Bachelier", "Éducateur·trice spécialisé·e en accompagnement psycho-éducatif", 3),
        ("Master", "Master transitoire en enseignement", 1),
        ("Bac + Master", "Enseignement section 1 – Maternel > P2", 4),
        ("Bac + Master", "Enseignement section 2 – Primaire (Liège)", 4),
        ("Bac + Master", "Enseignement section 2 – Primaire (Theux)", 4),
        ("Bac + Master", "Enseignement section 2 – Primaire (horaire adapté, Loncin)", 4),
        ("Bac + Master", "Enseignement section 3 – Langues germaniques", 4),
        ("Bac + Master", "Enseignement section 3 – Français / Religion", 4),
        ("Bac + Master", "Enseignement section 3 – Français / Français langue étrangère", 4),
        ("Bac + Master", "Enseignement section 3 – Français / Philosophie et citoyenneté", 4),
        ("Bac + Master", "Enseignement section 3 – Français / Éducation culturelle et artistique", 4),
        ("Bac + Master", "Enseignement section 3 – Mathématiques et formation numérique", 4),
        ("Bac + Master", "Enseignement section 3 – Sciences", 4),
        ("Bac + Master", "Enseignement section 3 – Sciences humaines", 4),
        ("Bac + Master", "Enseignement section 3 – Éducation physique et éducation à la santé (Loncin)", 4),
        ("Spécialisation", "Préparation physique et entraînement", 1)]),
    ("Sciences de l'ingénieur & technologie", "⚙️", [
        ("Bachelier", "Automatisation", 3),
        ("Bachelier", "Bioqualité (en alternance)", 3),
        ("Bachelier", "Robotique industrielle", 3),
        ("Bachelier", "Mécatronique et robotique (en alternance)", 3),
        ("Bachelier", "Technico-commercial·e", 3),
        ("Bachelier", "Sciences de l'ingénieur·e industriel·le – Gramme", 3),
        ("Spécialisation", "Passerelle ingénieur·e industriel·le – Gramme", 1),
        ("Master", "Ingénieur·e industriel·le en industrie – Gramme", 2),
        ("Master", "Ingénieur·e industriel·le en génie énergétique durable – Gramme", 2),
        ("Master", "Double diplôme Industrial & Business Engineering (Gramme + HEC)", 3),
        ("Master", "Double diplôme Ingénieur·e industriel·le + Data Engineering", 3),
        ("Master", "Double diplôme Ingénieur·e industriel·le + Ingénierie et santé", 3)]),
    ("Sciences de la motricité", "🤸", [
        ("Bachelier", "Psychomotricité", 3)]),
    ("Sciences de la santé publique", "🏥", [
        ("Bachelier", "Sage-femme", 4),
        ("Bachelier", "Infirmier·e responsable de soins généraux", 4),
        ("Master", "Sciences infirmières (horaire adapté)", 2),
        ("Spécialisation", "Pédiatrie et néonatologie", 1),
        ("Spécialisation", "Santé communautaire", 1),
        ("Spécialisation", "Soins intensifs et aide médicale urgente (SIAMU)", 1)]),
    ("Sciences économiques & de gestion", "💼", [
        ("Bachelier", "Assistant·e de direction", 3),
        ("Bachelier", "Assistant·e de direction (en alternance)", 3),
        ("Bachelier", "Comptabilité", 3),
        ("Bachelier", "Coopération internationale", 3),
        ("Bachelier", "International business (commerce extérieur)", 3),
        ("Bachelier", "Marketing", 3),
        ("Master", "Expertise comptable et fiscale (en alternance)", 2),
        ("Master", "Gestion publique", 2),
        ("Master", "Sales management (en alternance)", 2)]),
    ("Sciences juridiques & criminologie", "⚖️", [
        ("Bachelier", "Assurances et gestion du risque", 3),
        ("Bachelier", "Droit", 3)]),
    ("Sciences informatiques", "💻", [
        ("Bachelier", "Informatique – Développement d'applications", 3),
        ("Bachelier", "Informatique – Sécurité des systèmes (cybersécurité)", 3),
        ("Bachelier", "Informatique – Intelligence artificielle", 3),
        ("Master", "Business analyst (en alternance)", 2),
        ("Master", "Architecture des systèmes informatiques", 2)]),
    ("Sciences sociales", "🤝", [
        ("Bachelier", "Éducateur·trice spécialisé·e en animation socioculturelle et sportive", 3),
        ("Bachelier", "Assistant·e social·e", 3),
        ("Master", "Ingénierie et action sociales", 2),
        ("Master", "Ingénierie et action sociales (horaire adapté)", 2)]),
    ("Technique de mode", "👗", [
        ("Bachelier", "Techniques de mode", 3)]),
]

HEPL = [
    ("Agronomie & environnement", "🌾", [("Bachelier", "Agronome", 3)]),
    ("Chimie & biotechnologie", "🧪", [("Bachelier", "Bioqualité", 3), ("Bachelier", "Chimie", 3)]),
    ("Construction & énergie", "🏗️", [
        ("Bachelier", "Construction", 3), ("Bachelier", "Énergies alternatives et renouvelables", 3)]),
    ("Éducation & psychologie", "🍎", [
        ("Bachelier", "Accueil et éducation du jeune enfant", 3),
        ("Bachelier", "Assistant en psychologie", 3),
        ("Bachelier", "Coaching sportif", 3),
        ("Bachelier", "Éducateur spécialisé en accompagnement psycho-éducatif", 3),
        ("Bachelier", "Logopédie", 3),
        ("Master", "Enseignement section 3 – Éducation physique et éducation à la santé", 2),
        ("Spécialisation", "Éducation et rééducation des déficients sensoriels", 1),
        ("Spécialisation", "Préparation physique et entraînement", 1),
        ("Spécialisation", "Psychomotricité", 1)]),
    ("Électromécanique & gestion de production", "🔧", [
        ("Bachelier", "Électromécanique", 3), ("Master", "Gestion de production", 2)]),
    ("Gestion & droit", "💼", [
        ("Bachelier", "Comptabilité", 3), ("Bachelier", "Coopération internationale", 3),
        ("Bachelier", "Droit", 3), ("Bachelier", "e-Business", 3),
        ("Bachelier", "International business", 3), ("Bachelier", "Management de la logistique", 3),
        ("Bachelier", "Marketing", 3), ("Master", "Expertise comptable et fiscale", 2),
        ("Master", "Facility management", 2), ("Master", "Gestion publique", 2),
        ("Master", "Sales management", 2)]),
    ("Information & communication", "📰", [
        ("Bachelier", "Bibliothécaire-documentaliste", 3), ("Bachelier", "Communication", 3),
        ("Bachelier", "Écriture multimédia", 3)]),
    ("Ingénieur", "⚙️", [
        ("Master", "Ingénieur industriel – Biochimie / Bioproduction", 2),
        ("Master", "Ingénieur industriel – Chimie / Chimie verte", 2),
        ("Master", "Ingénieur industriel – Construction / Énergie et environnement", 2),
        ("Master", "Ingénieur industriel – Électromécanique / Génie mécanique et aérotechnique", 2),
        ("Master", "Ingénieur industriel – Électromécanique / Génie énergétique et mécatronique", 2),
        ("Master", "Ingénieur industriel – Électronique / Systèmes embarqués", 2),
        ("Master", "Ingénieur industriel – Géomètre", 2),
        ("Master", "Ingénieur industriel – Informatique", 2)]),
    ("Motricité", "🤸", [
        ("Bachelier", "Ergothérapie", 3), ("Bachelier", "Psychomotricité", 3),
        ("Bachelier", "Kinésithérapie et réadaptation", 3),
        ("Master", "Kinésithérapie et réadaptation", 2)]),
    ("Numérique & informatique", "💻", [
        ("Bachelier", "Informatique", 3), ("Bachelier", "Techniques graphiques (infographie)", 3),
        ("Bachelier", "Jeu vidéo", 3), ("Master", "Jeu vidéo", 2),
        ("Master", "Architecture des systèmes informatiques", 2),
        ("Master", "Business analyst (en alternance)", 2)]),
    ("Santé", "🏥", [
        ("Bachelier", "Audiologie", 3), ("Bachelier", "Biopharmaceutique", 3),
        ("Bachelier", "Diététique", 3), ("Bachelier", "Hygiéniste bucco-dentaire", 3),
        ("Bachelier", "Infirmier responsable de soins généraux", 4), ("Bachelier", "Orthoptie", 3),
        ("Bachelier", "Sage-femme", 4), ("Bachelier", "Technologue de laboratoire médical", 3),
        ("Bachelier", "Technologue en imagerie médicale", 3),
        ("Master", "Sciences infirmières", 2),
        ("Spécialisation", "Gériatrie et psychogériatrie", 1),
        ("Spécialisation", "Nutrition et diététique du sport", 1),
        ("Spécialisation", "Oncologie", 1),
        ("Spécialisation", "Pédiatrie et néonatalogie", 1),
        ("Spécialisation", "Santé communautaire", 1),
        ("Spécialisation", "Santé mentale et psychiatrie", 1),
        ("Spécialisation", "Soins intensifs et aide médicale urgente", 1),
        ("Spécialisation", "Soins péri-opératoires, anesthésie, assistance opératoire et instrumentation", 1)]),
    ("Social", "🤝", [
        ("Bachelier", "Assistant social", 3), ("Bachelier", "Gestion des ressources humaines", 3),
        ("Master", "Ingénierie de la prévention et de la gestion des conflits", 2),
        ("Master", "Ingénierie et action sociales", 2), ("Spécialisation", "Médiation", 1)]),
]


def build_he(sid, name, full, domains, source):
    faculties = []
    for dname, ico, progs in domains:
        fid = slug(dname)
        faculties.append({
            "id": f"{sid}-{fid}", "name": dname, "ico": ico,
            "programmes": [{
                "id": f"{sid}-{fid}-{slug(n)}-{slug(k)}",
                "name": f"{k} {n}" if k in ("Bachelier", "Master", "Spécialisation") else f"{k} – {n}",
                "kind": k, "years": year_labels(k, y), "source": source,
            } for k, n, y in progs],
        })
    return {"id": sid, "name": name, "full": full, "ico": "🏫", "label": "Domaine", "faculties": faculties}


def main():
    print("Lecture de l'ULiège…", file=sys.stderr)
    uliege = build_uliege()
    helmo = build_he("helmo", "HELMo", "Haute École Libre Mosane", HELMO, "https://www.helmo.be/fr/formations")
    hepl = build_he("hepl", "HEPL", "Haute École de la Province de Liège", HEPL, "https://www.hepl.be/fr/formations")
    schools = [uliege] + ([helmo, hepl] if INCLUDE_HAUTES_ECOLES else [])
    data = {"generated": time.strftime("%Y-%m-%d"), "schools": schools}
    text = ("// Fichier créé automatiquement par outils/collecte_donnees.py — ne pas modifier à la main\n"
            "window.STUDY_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    n_prog = sum(len(f["programmes"]) for s in data["schools"] for f in s["faculties"])
    for out in OUTS:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"OK : {n_prog} programmes écrits dans {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
