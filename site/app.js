/* ==================================================================
   KAMPUS — la vraie version
   - Comptes, chat, messages privés, étoiles : base de données Supabase
   - Fichiers : stockage Supabase (en ligne, jamais sur ton ordinateur)
   - Facultés, programmes, cours : data.js (créé par outils/collecte_donnees.py)
   ================================================================== */
"use strict";

const CFG = window.KAMPUS_CONFIG || {};
const D = window.STUDY_DATA;
const SCHOOL = D.schools[0];               // Kampus commence uniquement avec l'ULiège
const HOME = [SCHOOL.id];
const BUCKET = "documents";
const MAX_SIZE = 50 * 1024 * 1024;         // 50 Mo par fichier
const EMAIL_OK = /@(student\.)?uliege\.be$/i;
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ---------- Icônes dessinées pour Kampus (pas d'emoji) ---------- */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  cours: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6"/>',
  syntheses: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>',
  exercices: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  examens: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4M8.5 11l2 2 4-4M8.5 17h7"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  cap: '<path d="M2 9.5l10-5 10 5-10 5z"/><path d="M6 11.5v4.5c3.5 2.5 8.5 2.5 12 0v-4.5M22 9.5v5.5"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v4.5h16V15"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 15v4.5h16V15"/>',
  marker: '<path d="M14.5 4.5l5 5L11 18H6v-5z"/><path d="M6 18l-2 2.5h5M12.5 6.5l5 5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3.2 2.6-5.5 5.5-5.5s5.5 2.3 5.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.8.2 4.8 2.3 4.8 5"/>',
  logout: '<path d="M10 4H5v16h5M14.5 8l4 4-4 4M18.5 12H9"/>',
  file: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>',
  star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  // Facultés
  archi: '<path d="M3 21h18M5 21V10.5L12 4l7 6.5V21M9.5 21v-6h5v6"/>',
  droit: '<path d="M12 4v16M8 20h8M5 7h14M5 7l-2.8 6a2.8 2.8 0 0 0 5.6 0zM19 7l-2.8 6a2.8 2.8 0 0 0 5.6 0z"/>',
  gembloux: '<path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z"/><path d="M5 20l8-8"/>',
  hec: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4.5h6V7M3 12.5h18M11 12.5v2h2v-2"/>',
  medecine: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
  veto: '<circle cx="6.5" cy="11" r="1.8"/><circle cx="17.5" cy="11" r="1.8"/><circle cx="9.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><path d="M8 17.5c0-3 1.8-5 4-5s4 2 4 5c0 2-2 2.8-4 1.8-2 1-4 .2-4-1.8z"/>',
  philo: '<path d="M3 5.5c3-1.2 6-1 9 1 3-2 6-2.2 9-1V19c-3-1-6-.8-9 1-3-1.8-6-2-9-1z"/><path d="M12 6.5V20"/>',
  psycho: '<path d="M9 21v-3.5A7 7 0 1 1 17.3 11l1.9 3.5h-2.2V18h-3.5v3"/><path d="M10 9.5a2 2 0 1 1 3.4 1.4"/>',
  sciences: '<path d="M9 3h6M10 3v6.5L5 18a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-8.5V3"/><path d="M7.2 15h9.6"/>',
  appliquees: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  sociales: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3.2 2.6-5.5 5.5-5.5s5.5 2.3 5.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.8.2 4.8 2.3 4.8 5"/>',
};
const icon = (name, size = 18, cls = "") => `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;

const CATS = [
  { id: "cours",     label: "Cours" },
  { id: "syntheses", label: "Synthèses" },
  { id: "exercices", label: "Exercices" },
  { id: "examens",   label: "Examens" },
];
const catOf = (id) => CATS.find((c) => c.id === id) || CATS[0];

/* La mascotte : un petit requin sérieux avec son chapeau de diplômé */
const MASCOT = `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true">
  <rect width="64" height="64" rx="15" fill="#FFFFFF"/>
  <path d="M13 43L3 52.5L17 50Z" fill="#3B7C88"/><path d="M51 43L61 52.5L47 50Z" fill="#3B7C88"/>
  <path d="M9 44C9 30 20 23 32 23C44 23 55 30 55 44C55 52 45 58 32 58C19 58 9 52 9 44Z" fill="#4F8F9B"/>
  <path d="M18 48C21 43 26.5 41 32 41C37.5 41 43 43 46 48C43 53 37.5 55 32 55C26.5 55 21 53 18 48Z" fill="#EEF2F1"/>
  <path d="M20.5 31.6L28 32.8M43.5 31.6L36 32.8" stroke="#00373E" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="24.5" cy="36.4" rx="2.3" ry="2.5" fill="#00373E"/><ellipse cx="39.5" cy="36.4" rx="2.3" ry="2.5" fill="#00373E"/>
  <path d="M28 45.2Q32 46.4 36 45.2" stroke="#00373E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M31 27C33 18 37.5 8.5 45.5 1.5C43.2 8.5 42.4 17 44 27Z" fill="#4F8F9B"/>
  <path d="M18 19L18 25.5C24 30 40 30 46 25.5L46 19L32 24Z" fill="#002A30"/>
  <path d="M32 7L57 16L32 25L7 16Z" fill="#00373E"/>
  <path d="M37.4 9.1L38.3 11.3L39.5 9.9L40.5 12.1L41.7 10.5L42.9 12.4L43.3 10.9Z" fill="#4F8F9B"/>
  <path d="M37.6 9.2L35.6 5.6L39.1 8.1Z" fill="#00373E"/><path d="M43.2 10.9L46.6 8.1L45.5 11.8Z" fill="#00373E"/>
  <path d="M47 17.6L52 20V28.5" stroke="#F2C230" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M50 28h4l1 5h-6z" fill="#F2C230"/>
</svg>`;
// Version sans fond blanc, pour la barre du haut (fond turquoise foncé) : requin un peu éclairci, toque bordée de clair
const MASCOT_DARK = `<svg class="mascot bare" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M13 43L3 52.5L17 50Z" fill="#4E929D"/><path d="M51 43L61 52.5L47 50Z" fill="#4E929D"/>
  <path d="M9 44C9 30 20 23 32 23C44 23 55 30 55 44C55 52 45 58 32 58C19 58 9 52 9 44Z" fill="#66A3AE"/>
  <path d="M18 48C21 43 26.5 41 32 41C37.5 41 43 43 46 48C43 53 37.5 55 32 55C26.5 55 21 53 18 48Z" fill="#F2F6F5"/>
  <path d="M20.5 31.6L28 32.8M43.5 31.6L36 32.8" stroke="#00373E" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="24.5" cy="36.4" rx="2.3" ry="2.5" fill="#00373E"/><ellipse cx="39.5" cy="36.4" rx="2.3" ry="2.5" fill="#00373E"/>
  <path d="M28 45.2Q32 46.4 36 45.2" stroke="#00373E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M31 27C33 18 37.5 8.5 45.5 1.5C43.2 8.5 42.4 17 44 27Z" fill="#66A3AE"/>
  <path d="M18 19L18 25.5C24 30 40 30 46 25.5L46 19L32 24Z" fill="#050F11"/>
  <path d="M32 7L57 16L32 25L7 16Z" fill="#0A1A1D"/>
  <path d="M37.4 9.1L38.3 11.3L39.5 9.9L40.5 12.1L41.7 10.5L42.9 12.4L43.3 10.9Z" fill="#66A3AE"/>
  <path d="M37.6 9.2L35.6 5.6L39.1 8.1Z" fill="#0A1A1D"/><path d="M43.2 10.9L46.6 8.1L45.5 11.8Z" fill="#0A1A1D"/>
  <path d="M47 17.6L52 20V28.5" stroke="#F2C230" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M50 28h4l1 5h-6z" fill="#F2C230"/>
</svg>`;

/* ---------- petites aides ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function toast(t, err) { const el = $("#toast"); el.textContent = t; el.classList.toggle("err", !!err); el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), err ? 5000 : 2800); }
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const tsOf = (v) => (typeof v === "number" ? v : Date.parse(v));
function fmtDay(v) { const d = new Date(tsOf(v)); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; }
function fmtTime(v) { const d = new Date(tsOf(v)); return `${d.getDate()} ${MOIS[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function sizeStr(b) { return b > 1e6 ? (b / 1e6).toFixed(1).replace(".", ",") + " Mo" : Math.max(1, Math.round(b / 1e3)) + " Ko"; }
const yearOf = (v) => String(new Date(tsOf(v)).getFullYear());   // l'année se met toute seule, selon la date d'ajout
// Pastilles des personnes : fonds doux de la même famille, texte foncé assorti
const COLORS = [["#D6ECEE", "#00535E"], ["#E3E7F3", "#2F3F7A"], ["#E4EEDA", "#3A5A1E"], ["#F3E7D6", "#74450F"], ["#EEE2EC", "#6B2F63"], ["#DDE7EA", "#28505C"]];
function color(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; }
function initials(name) { return String(name).trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }
function ext(name) { const m = /\.([a-z0-9]+)$/i.exec(name); return m ? m[1].toUpperCase() : "Fichier"; }
const siteUrl = () => location.origin + location.pathname;

/* ---------- Noms des étudiants (on les demande à la base au besoin) ---------- */
const NAMES = {};
const nameOf = (id) => NAMES[id] || "Étudiant·e";
async function ensureNames(ids) {
  const miss = [...new Set(ids)].filter((id) => id && !(id in NAMES));
  if (!miss.length) return;
  const { data } = await sb.from("profiles").select("id, full_name").in("id", miss);
  (data || []).forEach((p) => (NAMES[p.id] = p.full_name));
  miss.forEach((id) => { if (!(id in NAMES)) NAMES[id] = "Étudiant·e"; });
}
function avatar(id, sm) { const n = nameOf(id); return `<span class="av ${sm ? "sm" : ""}" data-person="${esc(id)}" title="Écrire à ${esc(n)} en privé" style="background:${color(id)[0]};color:${color(id)[1]}">${esc(initials(n))}</span>`; }
const person = (id) => `<b class="person" data-person="${esc(id)}" title="Écrire à ${esc(nameOf(id))} en privé">${esc(nameOf(id))}</b>`;

/* ---------- Index : quels programmes partagent quel cours ---------- */
const COURSE_INDEX = {};
SCHOOL.faculties.forEach((f) => f.programmes.forEach((p) => {
  Object.entries(p.courses || {}).forEach(([y, list]) => list.forEach((c) => {
    const e = COURSE_INDEX[c.code] || (COURSE_INDEX[c.code] = { name: c.name, prof: c.prof, uses: [] });
    if (!e.uses.some((u) => u.path[2] === p.id && u.year === y)) e.uses.push({ path: [SCHOOL.id, f.id, p.id, y], pname: p.name, year: y });
  }));
}));

/* ---------- Recherche rapide ---------- */
const SEARCH = [];
SCHOOL.faculties.forEach((f) => {
  SEARCH.push({ kind: "fac", ico: f.id, label: f.name, sub: "Faculté", path: [SCHOOL.id, f.id], n: norm(f.name) });
  f.programmes.forEach((p) => SEARCH.push({ kind: "prog", ico: "cap", label: p.name, sub: f.name, path: [SCHOOL.id, f.id, p.id], n: norm(p.name) }));
});
Object.entries(COURSE_INDEX).forEach(([code, c]) => SEARCH.push({
  kind: "course", ico: "cours", label: c.name,
  sub: `${code} · ${c.uses.length > 1 ? "commun à " + c.uses.length + " programmes" : c.uses[0].pname + " · " + c.uses[0].year}`,
  path: [...c.uses[0].path, code], n: norm(c.name + " " + code + " " + c.prof),
}));
function searchAll(q) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const hits = SEARCH.filter((it) => toks.every((t) => it.n.includes(t)));
  const score = (it) => (norm(it.label).startsWith(toks[0]) ? 0 : norm(it.label).includes(" " + toks[0]) ? 1 : 2);
  const by = (k, n) => hits.filter((h) => h.kind === k).sort((a, b) => score(a) - score(b) || a.label.localeCompare(b.label, "fr")).slice(0, n);
  return [...by("prog", 8), ...by("fac", 4), ...by("course", 8)];
}
function highlightText(label, q) {
  let out = esc(label);
  norm(q).split(/\s+/).filter(Boolean).forEach((t) => {
    const i = norm(label).indexOf(t);
    if (i >= 0) { const part = label.slice(i, i + t.length); out = out.replace(esc(part), `<mark>${esc(part)}</mark>`); }
  });
  return out;
}

/* ================================================================
   ÉTAT DE L'APPLICATION
   ================================================================ */
let sb = null;
const S = {
  authReady: false,
  authMode: "login",   // login | signup | forgot | sent | newpass
  authMsg: null,       // { ok|err, text }
  me: null,            // { id, email, name }
  path: [...HOME],     // [école, faculté, programme, année, code du cours]
  tab: "chat",
  sort: "recent",
  fq: "", fyear: "",
  pickerOpen: false,
  draft: "", draftRef: null,
  c: {},               // le cours ouvert : { code, loading, files, ratings, msgs, channel }
  uploading: 0,
  viewer: null,        // { fileId, selecting, pending }
  dms: [], dm: null, dmDraft: "", dmChannel: null,
};

/* ---------- Adresse de la page (#/faculté/programme/année/cours) : le bouton retour du navigateur marche ---------- */
function hashToPath() {
  return [SCHOOL.id, ...location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent)];
}
function validPath(p) {
  const out = [SCHOOL.id];
  const fac = SCHOOL.faculties.find((f) => f.id === p[1]); if (!fac) return out; out.push(fac.id);
  const prog = fac.programmes.find((x) => x.id === p[2]); if (!prog) return out; out.push(prog.id);
  if (!prog.years.includes(p[3])) return out; out.push(p[3]);
  const c = ((prog.courses || {})[p[3]] || []).find((x) => x.code === p[4]); if (c) out.push(c.code);
  return out;
}
function setPath(p) {
  const h = "#/" + p.slice(1).map(encodeURIComponent).join("/");
  if (location.hash === h || (p.length === 1 && !location.hash)) onRoute(); else location.hash = h;
}
function go(depth, id) { const p = S.path.slice(0, Math.max(1, depth)); if (id) p.push(id); setPath(p); }
const goPath = (p) => setPath(p);
window.addEventListener("hashchange", () => onRoute());

function onRoute() {
  if (!S.me) { render(); return; }
  const p = validPath(hashToPath());
  const prevCode = S.path[4];
  S.path = p;
  if (p[4] !== prevCode) { S.pickerOpen = false; S.fq = ""; S.fyear = ""; S.draft = ""; S.draftRef = null; S.tab = "chat"; if (S.viewer) closeViewer(true); }
  if (p[4]) loadCourse(p[4]); else leaveCourse();
  render(); window.scrollTo(0, 0);
}
function cur() {
  const [, f, p, y, c] = S.path;
  const fac = SCHOOL.faculties.find((x) => x.id === f);
  const prog = fac && fac.programmes.find((x) => x.id === p);
  const year = prog && y;
  const course = year && ((prog.courses || {})[year] || []).find((x) => x.code === c);
  return { fac, prog, year, course };
}

/* ================================================================
   COMPTES : connexion, inscription, mot de passe oublié
   ================================================================ */
function authError(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/invalid login/i.test(m)) return "Email ou mot de passe incorrect.";
  if (/not confirmed/i.test(m)) return "Ton adresse n'est pas encore confirmée : clique sur le lien reçu dans ta boîte mail ULiège.";
  if (/already registered|already been registered/i.test(m)) return "Un compte existe déjà avec cette adresse. Connecte-toi.";
  if (/database error saving new user|seules les adresses/i.test(m)) return "Seules les adresses @student.uliege.be ou @uliege.be peuvent s'inscrire.";
  if (/password.*(at least|short|characters)/i.test(m)) return "Mot de passe trop court : au moins 8 caractères.";
  if (/rate limit|too many|seconds/i.test(m)) return "Trop d'essais d'affilée. Attends une minute puis réessaie.";
  if (/fetch|network/i.test(m)) return "Pas de connexion internet ?";
  return "Oups : " + m;
}
function setAuth(mode, msg) { S.authMode = mode; S.authMsg = msg || null; render(); }

async function onSession(session) {
  S.authReady = true;
  if (!session) {
    leaveCourse(); stopDMs(); S.me = null;
    if (S.authMode === "newpass") S.authMode = "login";
    render(); return;
  }
  if (S.me && S.me.id === session.user.id) return;
  const u = session.user;
  const { data } = await sb.from("profiles").select("full_name").eq("id", u.id).maybeSingle();
  S.me = { id: u.id, email: u.email, name: data?.full_name || u.user_metadata?.full_name || u.email.split("@")[0] };
  NAMES[u.id] = S.me.name;
  startDMs();
  onRoute();
}

function viewSetup() {
  return `<div class="login-wrap"><div class="login"><div class="brand">${MASCOT}Kampus</div>
    <p class="sub">Kampus n'est pas encore relié à sa base de données.</p>
    <div class="notice err">Il faut remplir l'adresse Supabase et la clé publique dans le fichier <b>config.js</b>.</div></div></div>`;
}
function viewAuth() {
  const m = S.authMode, msg = S.authMsg;
  const notice = msg ? `<div class="notice ${msg.ok ? "ok" : "err"}">${esc(msg.text)}</div>` : "";
  let body = "";
  if (m === "login" || m === "signup") {
    body = `<div class="switch-mode"><button type="button" class="${m === "login" ? "on" : ""}" data-auth="login">Connexion</button><button type="button" class="${m === "signup" ? "on" : ""}" data-auth="signup">Créer un compte</button></div>
      <form id="authForm" novalidate>
        ${m === "signup" ? `<label>Prénom et nom</label><input class="field" name="name" autocomplete="name" required placeholder="ex. Mathis Dupont">` : ""}
        <label>Email ULiège</label><input class="field" name="email" type="email" autocomplete="email" required placeholder="prenom.nom@student.uliege.be">
        <label>Mot de passe</label><input class="field" name="password" type="password" autocomplete="${m === "signup" ? "new-password" : "current-password"}" required minlength="8" placeholder="${m === "signup" ? "8 caractères minimum" : "••••••••"}">
        <button class="btn" id="authBtn">${m === "signup" ? "Créer mon compte" : "Se connecter"}</button>
      </form>
      ${m === "login" ? `<button class="linkish" data-auth="forgot">Mot de passe oublié ?</button>` : `<p class="hint">Réservé aux adresses @student.uliege.be et @uliege.be. Tu recevras un email pour confirmer.</p>`}`;
  } else if (m === "forgot") {
    body = `<form id="authForm" novalidate><label>Ton email ULiège</label><input class="field" name="email" type="email" required placeholder="prenom.nom@student.uliege.be">
      <button class="btn" id="authBtn">Recevoir un lien pour changer mon mot de passe</button></form>
      <button class="linkish" data-auth="login">Retour à la connexion</button>`;
  } else if (m === "newpass") {
    body = `<form id="authForm" novalidate><label>Ton nouveau mot de passe</label><input class="field" name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="8 caractères minimum">
      <button class="btn" id="authBtn">Enregistrer</button></form>`;
  } else if (m === "sent") {
    body = `<button class="linkish" data-auth="login">Retour à la connexion</button>`;
  }
  return `<div class="login-wrap"><div class="login"><div class="brand">${MASCOT}Kampus</div>
    <p class="sub">Partage tes cours, synthèses, exercices et examens avec les étudiants de l'ULiège.</p>${notice}${body}</div></div>`;
}
function bindAuth() {
  $$("[data-auth]").forEach((b) => b.onclick = () => setAuth(b.dataset.auth));
  const form = $("#authForm"); if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    const name = String(fd.get("name") || "").trim();
    const btn = $("#authBtn"); btn.disabled = true;
    const fail = (text) => { S.authMsg = { text }; render(); };
    try {
      if (S.authMode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return fail(authError(error));
      } else if (S.authMode === "signup") {
        if (name.length < 2) return fail("Écris ton prénom et ton nom.");
        if (!EMAIL_OK.test(email)) return fail("Utilise ton adresse ULiège (@student.uliege.be ou @uliege.be).");
        if (password.length < 8) return fail("Mot de passe trop court : au moins 8 caractères.");
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: siteUrl() } });
        if (error) return fail(authError(error));
        if (data.user && data.user.identities && data.user.identities.length === 0) return fail("Un compte existe déjà avec cette adresse. Connecte-toi.");
        if (!data.session) setAuth("sent", { ok: true, text: `Presque fini ! Un email vient d'être envoyé à ${email}. Clique sur le lien dedans pour activer ton compte (regarde aussi dans les courriers indésirables).` });
      } else if (S.authMode === "forgot") {
        if (!EMAIL_OK.test(email)) return fail("Utilise ton adresse ULiège.");
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
        if (error) return fail(authError(error));
        setAuth("sent", { ok: true, text: `Si un compte existe pour ${email}, tu vas recevoir un email avec un lien pour choisir un nouveau mot de passe.` });
      } else if (S.authMode === "newpass") {
        if (password.length < 8) return fail("Mot de passe trop court : au moins 8 caractères.");
        const { error } = await sb.auth.updateUser({ password });
        if (error) return fail(authError(error));
        S.authMode = "login"; S.authMsg = null; toast("Mot de passe changé");
        const { data } = await sb.auth.getSession(); S.me = null; await onSession(data.session);
      }
    } finally { const b = $("#authBtn"); if (b) b.disabled = false; }
  };
}

/* ================================================================
   ÉCRANS
   ================================================================ */
function searchBox(id, ph) {
  return `<div class="top-search">${icon("search", 17, "lead")}<input id="${id}" autocomplete="off" placeholder="${esc(ph)}"><div class="sr" id="${id}-r" hidden></div></div>`;
}
function dmDot() { const n = unreadTotal(); return n ? `<span class="dot">${n}</span>` : ""; }
function header() {
  return `<header class="top">
    <div class="logo" data-go="1" title="Accueil">${MASCOT_DARK}Kampus</div>
    ${S.path.length > 1 ? searchBox("gs", "Rechercher un master, une faculté, un cours…") : ""}
    <div class="top-right">
      <button class="btn-top" id="openDm" title="Messages privés">${icon("mail", 17)}<span class="long">Messages</span>${dmDot()}</button>
      <span class="who-label">${avatar(S.me.id, true).replace("data-person", "data-x")} ${esc(S.me.name)}</span>
      <button class="btn-top" id="logout" title="Se déconnecter">${icon("logout", 17)}<span class="long">Déconnexion</span></button>
    </div>
  </header>`;
}
function navLine() {
  const { fac, prog, year, course } = cur();
  const p = [`<a data-go="1">Accueil</a>`];
  if (fac) p.push(`<a data-go="2">${esc(fac.name)}</a>`);
  if (prog) p.push(`<a data-go="3">${esc(prog.name)}</a>`);
  if (year) p.push(`<a data-go="4">${esc(year)}</a>`);
  if (course) p.push(`<span>${esc(course.name)}</span>`);
  return `<div class="nav-line"><button class="back" id="back" title="Retour" aria-label="Retour">${icon("back", 18)}</button>
    <nav class="crumbs">${p.join(`<span class="sep">›</span>`)}</nav></div>`;
}

function viewHome() {
  return `<section class="home-head">
      <h1>Salut ${esc(S.me.name.split(" ")[0])}</h1>
      <p class="sub">Trouve ton cours, ton master ou ta faculté.</p>
      ${searchBox("hs", "Rechercher un cours, un master, une faculté…")}
    </section>
    <h2 class="group-title">Facultés de l'ULiège</h2>
    <div class="grid">${SCHOOL.faculties.map((f) => `<button class="tile" data-open="${f.id}">
      <div class="badge-ic">${icon(f.id, 24)}</div><div class="name">${esc(f.name)}</div>
      <div class="meta">${f.programmes.length} programme${f.programmes.length > 1 ? "s" : ""}</div></button>`).join("")}</div>`;
}

function viewProgrammes() {
  const { fac } = cur();
  const groups = [["Bachelier", "Bacheliers"], ["Master", "Masters"]].map(([k, title]) => {
    const list = fac.programmes.filter((p) => p.kind === k);
    if (!list.length) return "";
    return `<div data-group><h2 class="group-title">${title}</h2><div class="list">${list.map((p) => {
      const nC = p.courses ? Object.values(p.courses).reduce((a, l) => a + l.length, 0) : 0;
      return `<button class="row" data-open="${p.id}" data-search="${esc(norm(p.name))}">
        <div class="grow"><div class="rname">${esc(p.name)}</div><div class="rmeta">${p.years.length} année${p.years.length > 1 ? "s" : ""} · ${esc(p.years.join(", "))}</div></div>
        ${nC ? `<span class="badge teal">${nC} cours</span>` : ""}<span class="chev">${icon("chev", 18)}</span></button>`;
    }).join("")}</div></div>`;
  }).join("");
  return `${navLine()}
    <div class="page-title"><h1>${esc(fac.name)}</h1><p class="sub">${fac.programmes.length} programmes</p></div>
    <div class="toolbar"><div class="search-wrap">${icon("search", 17)}<input class="search" id="search" placeholder="Filtrer les programmes"></div></div>
    ${groups}
    <p class="empty" id="noResult" hidden>Aucun programme ne correspond. Essaie la grande barre de recherche en haut.</p>`;
}

function viewYears() {
  const { prog } = cur();
  return `${navLine()}
    <div class="page-title"><h1>${esc(prog.name)}</h1><p class="sub">${esc(prog.kind)} · choisis ton année</p></div>
    <div class="grid">${prog.years.map((y) => {
      const n = ((prog.courses || {})[y] || []).length;
      return `<button class="tile" data-open="${esc(y)}"><div class="badge-ic">${icon("calendar", 24)}</div><div class="name">${esc(y)}</div>
        <div class="meta">${n ? n + " cours" : "Pas de cours cette année"}</div></button>`;
    }).join("")}</div>`;
}

function courseRow(c) {
  const shared = (COURSE_INDEX[c.code]?.uses.length || 1) > 1;
  const meta = [c.code, c.prof, c.q, c.cr ? c.cr + " crédits" : ""].filter(Boolean).join(" · ");
  return `<button class="row" data-open="${esc(c.code)}" data-search="${esc(norm(c.name + " " + c.prof + " " + c.code))}">
    <div class="grow"><div class="rname">${esc(c.name)}</div><div class="rmeta">${esc(meta)}</div></div>
    ${shared ? `<span class="badge" title="Cours suivi par plusieurs programmes : un seul espace pour tous">${icon("people", 14)} commun</span>` : ""}
    <span class="chev">${icon("chev", 18)}</span></button>`;
}
function viewCourses() {
  const { prog, year } = cur();
  const list = (prog.courses || {})[year] || [];
  const must = list.filter((c) => !c.choice), opt = list.filter((c) => c.choice);
  return `${navLine()}
    <div class="page-title"><h1>${esc(year)}</h1><p class="sub">${esc(prog.name)} · ${list.length} cours</p></div>
    ${list.length > 6 ? `<div class="toolbar"><div class="search-wrap">${icon("search", 17)}<input class="search" id="search" placeholder="Filtrer : nom du cours ou du prof"></div></div>` : ""}
    ${must.length ? `<div data-group><h2 class="group-title">Cours obligatoires</h2><div class="list">${must.map(courseRow).join("")}</div></div>` : ""}
    ${opt.length ? `<div data-group><h2 class="group-title">Cours au choix</h2><div class="list">${opt.map(courseRow).join("")}</div></div>` : ""}
    ${!list.length ? `<div class="list"><div class="empty">Pas de cours pour cette année.</div></div>` : ""}
    <p class="empty" id="noResult" hidden>Aucun cours ne correspond à ta recherche.</p>`;
}

/* ================================================================
   UN COURS : chargement, chat, documents
   ================================================================ */
async function loadCourse(code) {
  if (S.c.code === code) return;
  leaveCourse();
  const c = (S.c = { code, loading: true, files: [], ratings: {}, msgs: [] });
  const [f, m] = await Promise.all([
    sb.from("files").select("*").eq("course_code", code).order("created_at", { ascending: false }),
    sb.from("messages").select("*").eq("course_code", code).order("created_at", { ascending: true }).limit(1000),
  ]);
  if (S.c !== c) return;
  if (f.error || m.error) toast("Impossible de charger ce cours. Vérifie ta connexion internet.", true);
  c.files = f.data || [];
  c.msgs = m.data || [];
  if (c.files.length) {
    const r = await sb.from("ratings").select("file_id, user_id, stars").in("file_id", c.files.map((x) => x.id));
    (r.data || []).forEach((x) => ((c.ratings[x.file_id] = c.ratings[x.file_id] || {})[x.user_id] = x.stars));
  }
  await ensureNames([...c.files.map((x) => x.uploader_id), ...c.msgs.map((x) => x.author_id)]);
  if (S.c !== c) return;
  c.loading = false;
  render();
  // Temps réel : les nouveaux messages et documents arrivent tout seuls
  c.channel = sb.channel("course-" + code)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `course_code=eq.${code}` }, async (p) => {
      if (c.msgs.some((x) => x.id === p.new.id)) return;
      await ensureNames([p.new.author_id]); c.msgs.push(p.new); refreshChat();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
      const i = c.msgs.findIndex((x) => x.id === p.old.id); if (i >= 0) { c.msgs.splice(i, 1); refreshChat(); }
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "files", filter: `course_code=eq.${code}` }, async (p) => {
      if (c.files.some((x) => x.id === p.new.id)) return;
      await ensureNames([p.new.uploader_id]); c.files.unshift(p.new); if (!S.viewer) render();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "files" }, (p) => {
      const i = c.files.findIndex((x) => x.id === p.old.id); if (i >= 0) { c.files.splice(i, 1); if (!S.viewer) render(); }
    })
    .subscribe();
}
function leaveCourse() { if (S.c.channel) sb.removeChannel(S.c.channel); S.c = {}; }
function refreshChat() {
  if (S.viewer) renderViewerChat();
  else if (S.path[4] && S.tab === "chat") render();
}

/* ---------- Le chat général du cours ---------- */
function msgHTML(m) {
  const me = m.author_id === S.me.id;
  const f = m.ref_file_id && S.c.files.find((x) => x.id === m.ref_file_id);
  const ref = f ? `<button class="ref" data-ref="${m.id}" title="Ouvrir le document à cet endroit">${icon("marker", 14)}<span>${m.ref_label ? esc(m.ref_label) + " — " : ""}${esc(f.name)}</span></button>\n` : "";
  return `<div class="msg ${me ? "me" : ""}" id="m-${m.id}">${avatar(m.author_id, true)}<div class="body">
    <div class="who">${me ? "<b>Toi</b>" : person(m.author_id)} · ${fmtTime(m.created_at)}${me ? ` · <button class="x" style="display:inline;font-size:12px;text-decoration:underline" data-delmsg="${m.id}">supprimer</button>` : ""}</div>
    <div class="bubble">${ref}${esc(m.body)}</div></div></div>`;
}
function chatHTML(ctx) {
  const c = S.c;
  const list = c.msgs || [];
  const files = c.files || [];
  const shared = (COURSE_INDEX[c.code]?.uses.length || 1) > 1;
  const dr = S.draftRef && files.find((f) => f.id === S.draftRef.fileId);
  return `<section class="panel chat">
    <div class="panel-head"><h3>${icon("chat", 19)} Chat général du cours</h3><small>${list.length} message${list.length > 1 ? "s" : ""}${shared ? " · commun à tous les programmes qui ont ce cours" : ""}</small></div>
    <div class="msgs" id="${ctx}-msgs">${c.loading ? `<div class="loading">Chargement…</div>` : list.length ? list.map(msgHTML).join("") : `<div class="empty">Personne n'a encore écrit ici.<br>Pose la première question !</div>`}</div>
    <form class="composer" id="${ctx}-form">
      ${ctx === "m" && S.pickerOpen ? `<div class="picker"><div class="ptitle">Ta question porte sur quel document ? Tu pourras ensuite cliquer sur l'endroit précis.</div>
        ${files.length ? CATS.map((k) => files.filter((f) => f.category === k.id).map((f) => `<button type="button" data-pickfile="${f.id}">${icon(k.id, 16)} ${esc(f.name)} <small style="color:#8C8B82">· ${esc(nameOf(f.uploader_id))}</small></button>`).join("")).join("") : `<div class="ptitle">Aucun document pour l'instant.</div>`}</div>` : ""}
      ${dr ? `<div class="draft"><span class="ref">${icon("marker", 14)}<span>${esc(S.draftRef.label)} — ${esc(dr.name)}</span></span><button type="button" class="x" data-cleardraft title="Retirer">${icon("close", 16)}</button></div>` : ""}
      <div class="line">
        ${ctx === "m" ? `<button type="button" class="icon-btn ${S.pickerOpen ? "on" : ""}" id="pickBtn" title="Poser une question sur un endroit précis d'un document">${icon("marker", 20)}</button>` : ""}
        <textarea id="${ctx}-input" placeholder="${dr ? "Écris ta question sur ce passage…" : "Écris ton message…"}">${esc(S.draft)}</textarea>
        <button class="btn">Envoyer</button>
      </div>
    </form>
  </section>`;
}
function bindChat(ctx) {
  const ci = $(`#${ctx}-input`), cf = $(`#${ctx}-form`);
  if (!cf) return;
  ci.oninput = () => (S.draft = ci.value);
  ci.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); cf.requestSubmit(); } };
  cf.onsubmit = (e) => { e.preventDefault(); const text = ci.value.trim(); if (text) sendMessage(text); };
  const ms = $(`#${ctx}-msgs`); if (ms) ms.scrollTop = ms.scrollHeight;
}
async function sendMessage(text) {
  const c = S.c, ref = S.draftRef;
  const row = { course_code: c.code, body: text };
  if (ref) Object.assign(row, { ref_file_id: ref.fileId, ref_page: ref.page, ref_y: ref.y, ref_label: ref.label });
  S.draft = ""; S.draftRef = null;
  clearMarks("sel");
  const { data, error } = await sb.from("messages").insert(row).select().single();
  if (error) { S.draft = text; S.draftRef = ref; toast("Message pas envoyé. Vérifie ta connexion et réessaie.", true); }
  else if (S.c === c && !c.msgs.some((x) => x.id === data.id)) c.msgs.push(data);
  refreshChat();
}
async function deleteMessage(id) {
  if (!confirm("Supprimer ce message pour tout le monde ?")) return;
  const { error } = await sb.from("messages").delete().eq("id", id);
  if (error) return toast("Impossible de supprimer ce message.", true);
  const i = S.c.msgs.findIndex((x) => x.id === id); if (i >= 0) S.c.msgs.splice(i, 1);
  refreshChat();
}

/* ---------- Les documents du cours ---------- */
function ratingOf(f) { const v = Object.values(S.c.ratings?.[f.id] || {}); return { avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, n: v.length }; }
const starsHTML = (avg, size = 14) => `<span class="stars" title="${avg ? avg.toFixed(1).replace(".", ",") + " sur 5" : "Pas encore noté"}">${[1, 2, 3, 4, 5].map((i) => icon("star", size, i <= Math.round(avg) ? "on" : "")).join("")}</span>`;
function ratingHTML(f) {
  const { avg, n } = ratingOf(f);
  return n ? `<span class="rating">${starsHTML(avg)} <b>${avg.toFixed(1).replace(".", ",")}</b> (${n} avis)</span>` : `<span class="rating">${starsHTML(0)} pas encore noté</span>`;
}
function fileMatches(f) {
  if (S.fyear && yearOf(f.created_at) !== S.fyear) return false;
  if (S.fq) { const q = norm(S.fq); if (!norm(nameOf(f.uploader_id)).includes(q) && !norm(f.name).includes(q)) return false; }
  return true;
}
function fileRow(f) {
  const n = S.c.msgs.filter((m) => m.ref_file_id === f.id).length;
  const mine = f.uploader_id === S.me.id;
  return `<div class="file">
    <div class="ficon">${icon(f.category, 20)}</div>
    <div style="min-width:0"><div class="fname" data-openfile="${f.id}" title="Ouvrir">${esc(f.name)}</div>
      <div class="fmeta"><span class="badge year">${icon("calendar", 13)} ${yearOf(f.created_at)}</span>${esc(ext(f.name))} · ${esc(sizeStr(f.size_bytes))} · ajouté le ${fmtDay(f.created_at)}</div>
      <div class="fmeta" style="margin-top:2px">${ratingHTML(f)}</div></div>
    <div class="by">${avatar(f.uploader_id)}<div style="min-width:0"><small>Ajouté par</small>${person(f.uploader_id)}</div></div>
    <div class="actions">
      <button class="btn ghost small" data-download="${f.id}" title="Télécharger">${icon("download", 16)}</button>
      <button class="btn ghost small" data-openfile="${f.id}" title="${n} question${n > 1 ? "s" : ""} sur ce document dans le chat">${icon("chat", 15)} ${n}</button>
      ${mine ? `<button class="btn danger small" data-delfile="${f.id}" title="Supprimer mon document">${icon("trash", 15)}</button>` : ""}
    </div>
  </div>`;
}
function filesPanel() {
  const files = S.c.files || [];
  if (S.c.loading) return `<div class="loading">Chargement des documents…</div>`;
  const filtered = files.filter(fileMatches);
  const cat = catOf(S.tab);
  const list = filtered.filter((f) => f.category === S.tab);
  const sorters = {
    recent: (a, b) => tsOf(b.created_at) - tsOf(a.created_at),
    best: (a, b) => ratingOf(b).avg - ratingOf(a).avg || ratingOf(b).n - ratingOf(a).n,
    az: (a, b) => a.name.localeCompare(b.name, "fr"),
    author: (a, b) => nameOf(a.uploader_id).localeCompare(nameOf(b.uploader_id), "fr") || tsOf(b.created_at) - tsOf(a.created_at),
    year: (a, b) => tsOf(b.created_at) - tsOf(a.created_at),
  };
  list.sort(sorters[S.sort] || sorters.recent);
  let body;
  if (!list.length) {
    const elsewhere = filtered.length && (S.fq || S.fyear) ? CATS.filter((k) => k.id !== S.tab && filtered.some((f) => f.category === k.id)).map((k) => `<button class="btn ghost small" data-tab="${k.id}">${icon(k.id, 15)} ${k.label} (${filtered.filter((f) => f.category === k.id).length})</button>`).join(" ") : "";
    body = `<div class="empty">${S.fq || S.fyear ? "Rien ne correspond dans cet onglet." : `Pas encore de documents dans « ${cat.label} ».<br>Sois le premier à en ajouter !`}${elsewhere ? `<br><br>Mais il y a des résultats ici : ${elsewhere}` : ""}</div>`;
  } else if (S.sort === "author" || S.sort === "year") {
    const key = S.sort === "author" ? (f) => f.uploader_id : (f) => yearOf(f.created_at);
    const groups = [];
    list.forEach((f) => { const k = key(f); const g = groups.find((x) => x.k === k); g ? g.items.push(f) : groups.push({ k, items: [f] }); });
    body = groups.map((g) => `<div class="group-row">${S.sort === "author" ? avatar(g.k, true) + " " + person(g.k) : icon("calendar", 16) + " " + esc(g.k)} <span class="badge">${g.items.length}</span></div>${g.items.map(fileRow).join("")}`).join("");
  } else body = list.map(fileRow).join("");

  const years = [...new Set(files.map((f) => yearOf(f.created_at)))].sort().reverse();
  const yearCount = (y) => files.filter((f) => yearOf(f.created_at) === y && (!S.fq || norm(nameOf(f.uploader_id) + " " + f.name).includes(norm(S.fq)))).length;
  const note = S.fq || S.fyear ? `<div class="filter-note">Filtre actif : ${S.fq ? `« ${esc(S.fq)} »` : ""}${S.fq && S.fyear ? " · " : ""}${S.fyear ? esc(S.fyear) : ""} — <button id="clearFilters">tout afficher</button></div>` : "";
  return `<div class="ftools">
      <div class="search-wrap">${icon("search", 17)}<input class="search" id="fsearch" placeholder="Chercher une personne ou un fichier" value="${esc(S.fq)}"></div>
      <select class="sel" id="fyear" title="Année"><option value="">Toutes les années</option>${years.map((y) => `<option value="${y}" ${S.fyear === y ? "selected" : ""}>${y} (${yearCount(y)})</option>`).join("")}</select>
      <select class="sel" id="sort" title="Trier">
        <option value="recent" ${S.sort === "recent" ? "selected" : ""}>Plus récents d'abord</option>
        <option value="best" ${S.sort === "best" ? "selected" : ""}>Mieux notés d'abord</option>
        <option value="year" ${S.sort === "year" ? "selected" : ""}>Rangés par année</option>
        <option value="author" ${S.sort === "author" ? "selected" : ""}>Rangés par personne</option>
        <option value="az" ${S.sort === "az" ? "selected" : ""}>Nom (A → Z)</option>
      </select>
    </div>
    ${note}
    <div>${body}</div>
    <div class="drop ${S.uploading ? "busy" : ""}" id="drop">${icon("upload", 26)}
      ${S.uploading ? `<div><b>Envoi en cours (${S.uploading} fichier${S.uploading > 1 ? "s" : ""})…</b></div><small>Ne ferme pas la page.</small>`
        : `<div>Glisse tes fichiers ici ou <label class="pick">choisis-les<input type="file" id="fileInput" multiple hidden></label></div>
      <small>Ils seront rangés dans « ${cat.label} », avec ton nom et l'année ${yearOf(Date.now())}. 50 Mo maximum par fichier.</small>`}</div>`;
}
function viewCourse() {
  const { prog, year, course } = cur();
  const files = S.c.files || [], msgs = S.c.msgs || [];
  const uses = COURSE_INDEX[course.code]?.uses || [];
  const meta = [course.code, course.prof, course.cr ? course.cr + " crédits" : ""].filter(Boolean).join(" · ");
  const sharedHTML = uses.length > 1 ? `<details class="shared"><summary>${icon("people", 16)} Cours commun à ${uses.length} programmes</summary>
      <ul>${uses.map((u) => `<li>${esc(u.pname)} · ${esc(u.year)}</li>`).join("")}</ul></details>` : "";
  const filtered = files.filter(fileMatches);
  const tabs = `<div class="tabs">
    <button class="tab chat-tab ${S.tab === "chat" ? "on" : ""}" data-tab="chat">${icon("chat", 18)} Chat général<span class="count">${msgs.length}</span></button>
    ${CATS.map((k) => `<button class="tab ${k.id === S.tab ? "on" : ""}" data-tab="${k.id}">${icon(k.id, 18)} ${k.label}<span class="count">${filtered.filter((f) => f.category === k.id).length}</span></button>`).join("")}</div>`;
  return `${navLine()}
    <div class="page-title"><h1>${esc(course.name)}</h1><p class="sub">${esc(meta)}</p>${sharedHTML}</div>
    <div class="panel" style="margin-bottom:14px">${tabs}${S.tab === "chat" ? "" : filesPanel()}</div>
    ${S.tab === "chat" ? chatHTML("m") : ""}`;
}

/* ---------- Envoyer, télécharger, supprimer, noter ---------- */
async function uploadFiles(list) {
  const c = S.c, cat = S.tab;
  const files = [...list];
  const tooBig = files.filter((f) => f.size > MAX_SIZE);
  if (tooBig.length) toast(`${tooBig.map((f) => f.name).join(", ")} : trop lourd (50 Mo maximum).`, true);
  const ok = files.filter((f) => f.size <= MAX_SIZE && f.size > 0);
  if (!ok.length) return;
  S.uploading += ok.length; render();
  let done = 0;
  for (const file of ok) {
    const safe = norm(file.name).replace(/[^a-z0-9._-]+/g, "_").slice(-120) || "fichier";
    const path = `${S.me.id}/${c.code}/${crypto.randomUUID()}-${safe}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (up.error) { toast(`« ${file.name} » n'a pas pu être envoyé.`, true); S.uploading--; continue; }
    const { data, error } = await sb.from("files").insert({ course_code: c.code, category: cat, name: file.name, storage_path: path, size_bytes: file.size, mime_type: file.type || null }).select().single();
    S.uploading--;
    if (error) { await sb.storage.from(BUCKET).remove([path]); toast(`« ${file.name} » n'a pas pu être enregistré.`, true); continue; }
    if (S.c === c && !c.files.some((x) => x.id === data.id)) c.files.unshift(data);
    done++;
  }
  if (!S.viewer) render();
  if (done) toast(`${done} fichier${done > 1 ? "s" : ""} ajouté${done > 1 ? "s" : ""} dans « ${catOf(cat).label} »`);
}
async function signedUrl(f, forDownload) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.storage_path, 600, forDownload ? { download: f.name } : undefined);
  if (error) { toast("Impossible d'ouvrir ce fichier pour le moment.", true); return null; }
  return data.signedUrl;
}
async function downloadFile(id) {
  const f = S.c.files.find((x) => x.id === id); if (!f) return;
  const url = await signedUrl(f, true); if (!url) return;
  const a = document.createElement("a"); a.href = url; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  toast(`Téléchargement de « ${f.name} »`);
}
async function deleteFile(id) {
  const f = S.c.files.find((x) => x.id === id); if (!f) return;
  if (!confirm(`Supprimer « ${f.name} » ? Il disparaîtra pour tout le monde.`)) return;
  const { error } = await sb.from("files").delete().eq("id", id);
  if (error) return toast("Impossible de supprimer ce document.", true);
  await sb.storage.from(BUCKET).remove([f.storage_path]);
  S.c.files = S.c.files.filter((x) => x.id !== id);
  if (S.viewer?.fileId === id) closeViewer(); else render();
  toast("Document supprimé");
}
async function rate(id, n) {
  const f = S.c.files.find((x) => x.id === id); if (!f) return;
  const me = S.me.id, map = (S.c.ratings[id] = S.c.ratings[id] || {});
  const prev = map[me];
  map[me] = n; renderViewerHead();
  let res = prev
    ? await sb.from("ratings").update({ stars: n, updated_at: new Date().toISOString() }).eq("file_id", id).eq("user_id", me)
    : await sb.from("ratings").insert({ file_id: id, user_id: me, stars: n });
  if (res.error && res.error.code === "23505") res = await sb.from("ratings").update({ stars: n, updated_at: new Date().toISOString() }).eq("file_id", id).eq("user_id", me);
  if (res.error) { if (prev) map[me] = prev; else delete map[me]; renderViewerHead(); return toast("Ta note n'a pas pu être enregistrée.", true); }
  toast(`Merci ! Tu as donné ${n} étoile${n > 1 ? "s" : ""} sur 5`);
}

/* ================================================================
   VISIONNEUSE : le document + le chat général à côté
   ================================================================ */
function docKind(f) {
  const t = (f.mime_type || "").toLowerCase(), e = ext(f.name).toLowerCase();
  if (t === "application/pdf" || e === "pdf") return "pdf";
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(e)) return "image";
  return "other";
}
async function openViewer(fileId, ref, selecting) {
  const f = S.c.files.find((x) => x.id === fileId);
  if (!f) return toast("Ce document n'existe plus.", true);
  const v = (S.viewer = { fileId, selecting: !!selecting, pending: ref || null });
  S.pickerOpen = false;
  document.body.style.overflow = "hidden";
  $("#modal").innerHTML = `<div class="viewer-bg" id="viewerBg"><div class="viewer">
    <div class="vhead" id="vhead"></div>
    <div class="vbody"><div class="pages ${v.selecting ? "selecting" : ""}" id="pages"><div class="loading">Ouverture du document…</div></div><div id="v-chat" style="display:contents"></div></div>
  </div></div>`;
  $("#viewerBg").onclick = (e) => { if (e.target.id === "viewerBg") closeViewer(); };
  $("#pages").onclick = (e) => pickSpot(e);
  renderViewerHead(); renderViewerChat();
  await loadDoc(f, v);
}
function renderViewerHead() {
  const v = S.viewer; if (!v) return;
  const f = S.c.files.find((x) => x.id === v.fileId); if (!f) return;
  const { avg, n } = ratingOf(f), mine = (S.c.ratings[f.id] || {})[S.me.id] || 0;
  const canPick = docKind(f) !== "other";
  $("#vhead").innerHTML = `
    <div class="ficon">${icon(f.category, 20)}</div>
    <div class="grow"><h3>${esc(f.name)}</h3>
      <div class="vmeta">${avatar(f.uploader_id, true)} Ajouté par ${person(f.uploader_id)} · <span class="badge year">${yearOf(f.created_at)}</span> · ${esc(catOf(f.category).label)}
        · <span class="rate-inline">${n ? `${starsHTML(avg)} <b>${avg.toFixed(1).replace(".", ",")}</b> · ` : ""}ta note :
        <span class="rate">${[5, 4, 3, 2, 1].map((k) => `<button type="button" data-rate="${k}" data-file="${f.id}" class="${mine >= k ? "on" : ""}" title="${k} étoile${k > 1 ? "s" : ""} sur 5">${icon("star", 16)}</button>`).join("")}</span></span></div></div>
    <button class="btn ghost" data-download="${f.id}">${icon("download", 17)} Télécharger</button>
    ${canPick ? `<button class="btn ${v.selecting ? "" : "ghost"}" id="selMode">${icon("marker", 17)} ${v.selecting ? "Clique sur l'endroit précis…" : "Poser une question sur un passage"}</button>` : ""}
    <button class="btn ghost" id="closeViewer">${icon("close", 17)} Fermer</button>`;
  $("#closeViewer").onclick = () => closeViewer();
  const sm = $("#selMode"); if (sm) sm.onclick = () => setSelecting(!S.viewer.selecting);
}
function renderViewerChat() {
  const box = $("#v-chat"); if (!box || !S.viewer) return;
  const active = document.activeElement?.id === "v-input", pos = $("#v-input")?.selectionStart;
  box.innerHTML = chatHTML("v");
  bindChat("v");
  if (active) { const el = $("#v-input"); el.focus(); el.setSelectionRange(pos, pos); }
}
function setSelecting(on) {
  S.viewer.selecting = on;
  $("#pages").classList.toggle("selecting", on);
  $("#pin-help")?.remove();
  if (on) $("#pages").insertAdjacentHTML("afterbegin", `<div class="pin-help" id="pin-help">Clique sur la question, l'exercice ou le chapitre qui te pose problème</div>`);
  renderViewerHead();
}
async function loadDoc(f, v) {
  const pages = $("#pages");
  const kind = docKind(f);
  if (kind === "other") {
    pages.innerHTML = `<div class="sheet msg-box">${icon("file", 40)}<p><b>${esc(f.name)}</b></p><p>L'aperçu n'est pas disponible pour les fichiers ${esc(ext(f.name))}.<br>Télécharge-le pour l'ouvrir.</p>
      <button class="btn" data-download="${f.id}">${icon("download", 17)} Télécharger</button></div>`;
    return;
  }
  const url = await signedUrl(f, false);
  if (!url || S.viewer !== v) return;
  if (kind === "image") {
    pages.innerHTML = `<div class="sheet" data-page="1"><img src="${esc(url)}" alt=""></div>`;
  } else {
    try {
      const pdf = await pdfjsLib.getDocument({ url }).promise;
      if (S.viewer !== v) return;
      pages.innerHTML = "";
      const width = Math.min(pages.clientWidth - 48, 820);
      const max = Math.min(pdf.numPages, 200);
      for (let i = 1; i <= max; i++) {
        if (S.viewer !== v) return;
        const page = await pdf.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) });
        const sheet = document.createElement("div"); sheet.className = "sheet"; sheet.dataset.page = i;
        const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
        sheet.appendChild(canvas); sheet.insertAdjacentHTML("beforeend", `<div class="pnum">${i} / ${pdf.numPages}</div>`);
        pages.appendChild(sheet);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        if (i === 1 || (v.pending && v.pending.page === i)) afterPagesChange();
      }
      if (pdf.numPages > max) pages.insertAdjacentHTML("beforeend", `<p class="hint">Seules les ${max} premières pages sont affichées. Télécharge le fichier pour tout voir.</p>`);
    } catch (e) {
      pages.innerHTML = `<div class="sheet msg-box"><p>Impossible d'afficher ce PDF ici.</p><button class="btn" data-download="${f.id}">${icon("download", 17)} Télécharger</button></div>`;
      return;
    }
  }
  if (v.selecting) setSelecting(true);
  afterPagesChange();
}
function afterPagesChange() {
  const v = S.viewer; if (!v) return;
  showSelBand();
  if (v.pending && $(`#pages .sheet[data-page="${v.pending.page}"]`)) { const r = v.pending; v.pending = null; flash(r); }
}
function pickSpot(e) {
  const v = S.viewer; if (!v || !v.selecting) return;
  const sh = e.target.closest(".sheet[data-page]"); if (!sh) return;
  const r = sh.getBoundingClientRect(), page = +sh.dataset.page;
  const y = Math.max(0, Math.min(100, Math.round(((e.clientY - r.top) / r.height) * 1000) / 10));
  S.draftRef = { fileId: v.fileId, page, y, label: `Page ${page}` };
  setSelecting(false);
  showSelBand(); renderViewerChat();
  $("#v-input")?.focus();
}
// Repère sur une page : une zone turquoise douce autour de l'endroit + une pastille sur le bord.
// « sel » = l'endroit qu'on est en train de choisir (jaune) ; « hl » = l'endroit d'une question (turquoise).
function makeMark(page, y, cls) {
  const sheet = $(`#pages .sheet[data-page="${page}"]`); if (!sheet) return null;
  const m = document.createElement("div"); m.className = "mark " + cls;
  m.style.top = Math.max(0, y - 2.2) + "%";
  m.innerHTML = `<span class="mark-zone"></span><span class="mark-pin">${icon(cls === "sel" ? "marker" : "chat", 14)}</span>`;
  sheet.appendChild(m); return m;
}
function clearMarks(cls) { $$("#pages .mark." + cls).forEach((b) => b.parentNode.removeChild(b)); }
function showSelBand() {
  clearMarks("sel");
  if (S.draftRef && S.viewer && S.draftRef.fileId === S.viewer.fileId) makeMark(S.draftRef.page, S.draftRef.y, "sel");
}
// Amène l'endroit au milieu de l'écran, puis le montre : zone + pastille ~4 s, puis tout s'efface.
function flash(ref) {
  const sheet = $(`#pages .sheet[data-page="${ref.page}"]`);
  if (!sheet) { S.viewer.pending = ref; return; }
  clearMarks("hl");
  const pages = $("#pages"), y = ref.y ?? 10;
  pages.scrollTo({ top: Math.max(0, sheet.offsetTop + (sheet.offsetHeight * y) / 100 - pages.clientHeight * 0.4), behavior: "smooth" });
  setTimeout(() => {
    const m = S.viewer && makeMark(ref.page, y, "hl");
    if (m) setTimeout(() => m.parentNode && m.parentNode.removeChild(m), 4700);   // zone et pastille s'effacent ensemble
  }, 380);
}
function closeViewer(silent) {
  S.viewer = null; $("#modal").innerHTML = ""; document.body.style.overflow = "";
  if (S.draftRef) S.draftRef = null;
  if (!silent) render();
}

/* ================================================================
   MESSAGES PRIVÉS
   ================================================================ */
const otherOf = (m) => (m.sender_id === S.me.id ? m.recipient_id : m.sender_id);
const unreadFrom = (id) => S.dms.filter((m) => m.sender_id === id && m.recipient_id === S.me.id && !m.read_at).length;
const unreadTotal = () => (S.me ? S.dms.filter((m) => m.recipient_id === S.me.id && !m.read_at).length : 0);
function updateDmBadge() { const b = $("#openDm"); if (!b) return; b.querySelector(".dot")?.remove(); b.insertAdjacentHTML("beforeend", dmDot()); }
async function startDMs() {
  const me = S.me.id;
  const { data } = await sb.from("direct_messages").select("*").or(`sender_id.eq.${me},recipient_id.eq.${me}`).order("created_at", { ascending: true }).limit(3000);
  S.dms = data || [];
  await ensureNames(S.dms.flatMap((m) => [m.sender_id, m.recipient_id]));
  updateDmBadge(); if (S.dm) renderDM();
  S.dmChannel = sb.channel("dm-" + me)
    .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, async (p) => {
      const m = p.new; if (!m || !m.id || (m.sender_id !== me && m.recipient_id !== me)) return;
      const i = S.dms.findIndex((x) => x.id === m.id);
      if (i >= 0) S.dms[i] = m; else S.dms.push(m);
      await ensureNames([m.sender_id, m.recipient_id]);
      if (p.eventType === "INSERT" && m.recipient_id === me) {
        if (S.dm === m.sender_id) markRead(m.sender_id);
        else toast(`Nouveau message privé de ${nameOf(m.sender_id)}`);
      }
      updateDmBadge(); if (S.dm) renderDM();
    })
    .subscribe();
}
function stopDMs() { if (S.dmChannel) sb.removeChannel(S.dmChannel); S.dmChannel = null; S.dms = []; S.dm = null; renderDM(); }
async function markRead(other) {
  const now = new Date().toISOString(), me = S.me.id;
  let changed = false;
  S.dms.forEach((m) => { if (m.sender_id === other && m.recipient_id === me && !m.read_at) { m.read_at = now; changed = true; } });
  if (!changed) return;
  updateDmBadge();
  await sb.from("direct_messages").update({ read_at: now }).eq("recipient_id", me).eq("sender_id", other).is("read_at", null);
}
function openDM(id) { if (!id || id === S.me.id) return; S.dm = id; S.dmDraft = ""; markRead(id); renderDM(); }
function renderDM() {
  const box = $("#dm");
  if (!S.dm || !S.me) { box.innerHTML = ""; return; }
  const me = S.me.id;
  if (S.dm === "list") {
    const convs = {};
    S.dms.forEach((m) => { const o = otherOf(m); (convs[o] = convs[o] || []).push(m); });
    const rows = Object.entries(convs).sort((a, b) => tsOf(b[1].at(-1).created_at) - tsOf(a[1].at(-1).created_at));
    box.innerHTML = `<div class="dm-panel"><div class="panel-head"><h3>${icon("mail", 19)} Messages privés</h3><button id="dmClose" title="Fermer">${icon("close", 20)}</button></div>
      <div style="overflow-y:auto;flex:1">${rows.length ? rows.map(([id, l]) => {
        const u = unreadFrom(id);
        return `<button class="dm-row ${u ? "unread" : ""}" data-dmopen="${esc(id)}">${avatar(id).replace("data-person", "data-x")}<div style="min-width:0;flex:1"><b class="nm">${esc(nameOf(id))}</b><div class="last">${esc(l.at(-1).body)}</div></div>${u ? `<span class="new">${u} nouveau${u > 1 ? "x" : ""}</span>` : ""}</button>`;
      }).join("") : `<div class="empty">Aucune conversation.<br>Clique sur le nom d'une personne (dans le chat ou sur un fichier) pour lui écrire en privé.</div>`}</div>
      </div>`;
  } else {
    const other = S.dm;
    const list = S.dms.filter((m) => otherOf(m) === other);
    const typing = document.activeElement?.id === "dm-input";
    box.innerHTML = `<div class="dm-panel"><div class="panel-head"><h3><button id="dmBack" title="Toutes les conversations">${icon("back", 20)}</button>${avatar(other, true).replace("data-person", "data-x")} ${esc(nameOf(other))}</h3><button id="dmClose" title="Fermer">${icon("close", 20)}</button></div>
      <div class="msgs" id="dm-msgs">${list.length ? list.map((m) => {
        const mine = m.sender_id === me;
        return `<div class="msg ${mine ? "me" : ""}" style="max-width:88%"><div class="body"><div class="who">${mine ? "Toi" : esc(nameOf(m.sender_id))} · ${fmtTime(m.created_at)}</div><div class="bubble">${esc(m.body)}</div></div></div>`;
      }).join("") : `<div class="empty">Écris ton premier message privé à ${esc(nameOf(other).split(" ")[0])}.<br>Personne d'autre ne pourra le lire.</div>`}</div>
      <form class="composer" id="dm-form"><div class="line"><textarea id="dm-input" placeholder="Votre message…">${esc(S.dmDraft)}</textarea><button class="btn">Envoyer</button></div></form></div>`;
    const inp = $("#dm-input"), form = $("#dm-form");
    inp.oninput = () => (S.dmDraft = inp.value);
    inp.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = async (e) => {
      e.preventDefault(); const body = inp.value.trim(); if (!body) return;
      S.dmDraft = ""; inp.value = "";
      const { data, error } = await sb.from("direct_messages").insert({ recipient_id: other, body }).select().single();
      if (error) { S.dmDraft = body; toast("Message pas envoyé. Réessaie.", true); }
      else if (!S.dms.some((x) => x.id === data.id)) S.dms.push(data);
      renderDM(); $("#dm-input")?.focus();
    };
    const ms = $("#dm-msgs"); ms.scrollTop = ms.scrollHeight;
    $("#dmBack").onclick = () => { S.dm = "list"; renderDM(); };
    if (typing || !list.length) setTimeout(() => $("#dm-input")?.focus(), 0);
  }
  $("#dmClose").onclick = () => { S.dm = null; renderDM(); };
  $$("[data-dmopen]").forEach((b) => b.onclick = () => openDM(b.dataset.dmopen));
}

/* ================================================================
   AFFICHAGE + CLICS
   ================================================================ */
function render() {
  const app = $("#app");
  if (!sb) { app.innerHTML = viewSetup(); return; }
  if (!S.authReady) { app.innerHTML = `<div class="loading">Chargement de Kampus…</div>`; return; }
  if (!S.me || S.authMode === "newpass") { app.innerHTML = viewAuth(); bindAuth(); return; }
  const active = document.activeElement, aid = active?.id, pos = active?.selectionStart;
  const view = [null, viewHome, viewProgrammes, viewYears, viewCourses, viewCourse][S.path.length];
  app.innerHTML = header() + `<main>${view()}</main>`;
  bind();
  // on garde le curseur dans la case où on était en train d'écrire
  if (aid === "fsearch" || aid === "m-input") { const el = $("#" + aid); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
}

function bindSearch(id) {
  const inp = $("#" + id), box = $("#" + id + "-r");
  if (!inp) return;
  let results = [], sel = 0;
  const KIND = { prog: "Programmes", fac: "Facultés", course: "Cours" };
  const draw = () => {
    if (!inp.value.trim()) { box.hidden = true; return; }
    results = searchAll(inp.value);
    let last = "";
    box.innerHTML = results.length ? results.map((r, i) => {
      const t = r.kind !== last ? `<div class="sr-title">${KIND[r.kind]}</div>` : ""; last = r.kind;
      return `${t}<button type="button" data-i="${i}" class="${i === sel ? "on" : ""}">${icon(r.ico, 18)}<span><div class="l">${highlightText(r.label, inp.value)}</div><div class="s">${esc(r.sub)}</div></span></button>`;
    }).join("") : `<div class="none">Rien trouvé pour « ${esc(inp.value)} ». Essaie un autre mot.</div>`;
    box.hidden = false;
    box.querySelectorAll("[data-i]").forEach((b) => b.onmousedown = (e) => { e.preventDefault(); goPath(results[+b.dataset.i].path); });
  };
  inp.oninput = () => { sel = 0; draw(); };
  inp.onfocus = draw;
  inp.onblur = () => setTimeout(() => (box.hidden = true), 120);
  inp.onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); draw(); }
    if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    if (e.key === "Enter" && results[sel]) { e.preventDefault(); goPath(results[sel].path); }
    if (e.key === "Escape") { inp.value = ""; box.hidden = true; inp.blur(); }
  };
}

function bind() {
  $$("[data-go]").forEach((el) => el.onclick = () => go(+el.dataset.go));
  const bk = $("#back"); if (bk) bk.onclick = () => go(S.path.length - 1);
  $$("#app [data-open]").forEach((el) => el.onclick = () => go(S.path.length, el.dataset.open));
  $$("#app [data-tab]").forEach((el) => el.onclick = () => { S.tab = el.dataset.tab; S.pickerOpen = false; render(); });
  bindSearch("gs"); bindSearch("hs");

  const lo = $("#logout"); if (lo) lo.onclick = async () => { await sb.auth.signOut(); };
  const od = $("#openDm"); if (od) od.onclick = () => { S.dm = "list"; renderDM(); };

  const se = $("#search");
  if (se) se.oninput = () => {
    const q = norm(se.value.trim()); let any = false;
    $$("[data-group]").forEach((g) => {
      let vis = 0;
      g.querySelectorAll("[data-search]").forEach((r) => { const ok = r.dataset.search.includes(q); r.hidden = !ok; if (ok) vis++; });
      g.hidden = !vis; if (vis) any = true;
    });
    $("#noResult").hidden = any;
  };

  const fs = $("#fsearch"); if (fs) fs.oninput = () => { S.fq = fs.value; render(); };
  const fy = $("#fyear"); if (fy) fy.onchange = () => { S.fyear = fy.value; render(); };
  const cfl = $("#clearFilters"); if (cfl) cfl.onclick = () => { S.fq = ""; S.fyear = ""; render(); };
  const so = $("#sort"); if (so) so.onchange = () => { S.sort = so.value; render(); };
  const fi = $("#fileInput"); if (fi) fi.onchange = () => uploadFiles(fi.files);
  const drop = $("#drop");
  if (drop && !S.uploading) {
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); uploadFiles(e.dataTransfer.files); };
  }
  $$("#app [data-openfile]").forEach((el) => el.onclick = () => openViewer(el.dataset.openfile));

  const pb = $("#pickBtn"); if (pb) pb.onclick = () => { S.pickerOpen = !S.pickerOpen; render(); };
  $$("[data-pickfile]").forEach((b) => b.onclick = () => openViewer(b.dataset.pickfile, null, true));
  bindChat("m");
}

// Clics « partout » : nom → message privé ; étiquette → document à cet endroit ; télécharger ; supprimer ; noter
document.addEventListener("click", (e) => {
  const t = e.target;
  const per = t.closest("[data-person]");
  if (per) { e.preventDefault(); e.stopPropagation(); openDM(per.dataset.person); return; }
  const ref = t.closest("[data-ref]");
  if (ref) {
    e.preventDefault(); e.stopPropagation();
    const m = (S.c.msgs || []).find((x) => x.id === ref.dataset.ref); if (!m) return;
    const r = { page: m.ref_page || 1, y: m.ref_y ?? 10 };
    if (S.viewer && S.viewer.fileId === m.ref_file_id) flash(r); else openViewer(m.ref_file_id, r);
    return;
  }
  const dl = t.closest("[data-download]"); if (dl) { e.preventDefault(); e.stopPropagation(); downloadFile(dl.dataset.download); return; }
  const df = t.closest("[data-delfile]"); if (df) { e.preventDefault(); e.stopPropagation(); deleteFile(df.dataset.delfile); return; }
  const dm = t.closest("[data-delmsg]"); if (dm) { e.preventDefault(); e.stopPropagation(); deleteMessage(dm.dataset.delmsg); return; }
  const rt = t.closest("[data-rate]"); if (rt) { e.preventDefault(); e.stopPropagation(); rate(rt.dataset.file, +rt.dataset.rate); return; }
  if (t.closest("[data-cleardraft]")) {
    e.preventDefault(); S.draftRef = null; showSelBand();
    if (S.viewer) renderViewerChat(); else render();
  }
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (S.dm) { S.dm = null; renderDM(); return; }
  if (S.viewer) closeViewer();
});


/* ================================================================
   DÉMARRAGE
   ================================================================ */
(async function boot() {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) { render(); return; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") { S.authMode = "newpass"; S.authMsg = null; }
    setTimeout(() => onSession(session), 0);   // (petit délai conseillé par Supabase)
  });
  const { data } = await sb.auth.getSession();
  await onSession(data.session);
})();
