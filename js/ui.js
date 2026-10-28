// Interface commune : actions déléguées (pas de code dans le HTML), pages, messages, boîtes de dialogue
import { html, setHTML, $, $$ } from './util.js';

/* ---------- Actions : <button data-act="nom" data-a="valeur"> ---------- */
export const ACT = {};
export const CHG = {};
export function registerActions(o) { Object.assign(ACT, o); }
export function registerChanges(o) { Object.assign(CHG, o); }
export function initDelegation() {
  document.addEventListener('click', e => {
    const el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    const f = ACT[el.dataset.act];
    if (!f) return;
    if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') !== '#') return; // vrai lien : on laisse le navigateur faire
    e.preventDefault();
    Promise.resolve().then(() => f(el.dataset, el, e)).catch(err => { console.error(err); toast('Une erreur est survenue.'); });
  });
  document.addEventListener('change', e => {
    const el = e.target.closest ? e.target.closest('[data-change]') : null;
    if (!el) return;
    const f = CHG[el.dataset.change];
    if (f) Promise.resolve().then(() => f(el.dataset, el, e)).catch(err => { console.error(err); toast('Une erreur est survenue.'); });
  });
}

/* ---------- Bouton Retour du téléphone ---------- */
// Chaque écran secondaire (module, tous les examens, paramètres, détail d'un interne) et chaque fenêtre (dialogue, image, QR code,
// masque, tutoriel) ajoute une entrée à l'historique du navigateur : le bouton ou le geste Retour referme alors le dernier écran
// ouvert au lieu de quitter l'application. Les fermetures faites par l'interface (✕, ← Retour, validation reçue…) retirent l'entrée.
const levels = [];           // { close, kind: 'page' | 'view' | 'overlay' } : ce que l'interface affiche, du plus ancien au plus récent
let depth = 0;               // entrées d'historique ajoutées par l'application
let waiting = false, waitT = null;
const histDepth = () => (history.state && Number(history.state.echoLevel)) || 0;
depth = histDepth();         // rechargement d'une page ouverte sur un écran secondaire : on revient à l'entrée de base
function reconcile() {
  if (waiting) return;       // un retour est en cours : on rajuste dès qu'il est terminé
  if (depth > levels.length) {
    const k = depth - levels.length;
    waiting = true;
    clearTimeout(waitT);
    waitT = setTimeout(() => { if (waiting) { waiting = false; depth = histDepth(); reconcile(); } }, 1000);
    try { history.go(-k); } catch (e) { waiting = false; depth = levels.length; }
    return;
  }
  while (depth < levels.length) {
    depth++;
    try { history.pushState({ echoLevel: depth }, ''); } catch (e) { /* historique indisponible : Retour garde son comportement habituel */ }
  }
}
function runClose(lv) { try { lv.close(); } catch (e) { console.error(e); } }
export function openLevel(close, kind = 'overlay') { const lv = { close, kind }; levels.push(lv); reconcile(); return lv; }
export const levelOpen = lv => !!lv && levels.indexOf(lv) >= 0;
/** Fermeture voulue par l'interface : referme l'écran (et ceux ouverts par-dessus) et retire l'entrée d'historique. Renvoie faux s'il n'était plus ouvert. */
export function closeLevel(lv) {
  const i = levels.indexOf(lv);
  if (i < 0) return false;
  levels.splice(i).reverse().forEach(runClose);
  reconcile();
  return true;
}
/** Changement complet d'écran (connexion, verrou, retour à l'accueil…) : les fenêtres ouvertes sont refermées, les entrées d'historique retirées */
export function resetLevels() {
  levels.splice(0).reverse().forEach(lv => { if (lv.kind === 'overlay') runClose(lv); });
  reconcile();
}
/** Écran ou fenêtre avec sa propre entrée d'historique : open() l'ajoute, close() la retire ; hide() fait la fermeture visuelle */
export function makeLevel(kind, hide) {
  let lv = null;
  return {
    open() { if (!levelOpen(lv)) lv = openLevel(() => { lv = null; hide(); }, kind); },
    close() { const l = lv; lv = null; if (!(l && closeLevel(l))) hide(); },
    get isOpen() { return levelOpen(lv); }
  };
}
window.addEventListener('popstate', e => {
  const target = (e.state && Number(e.state.echoLevel)) || 0;
  if (waiting) { waiting = false; clearTimeout(waitT); depth = target; reconcile(); return; } // fin d'un retour demandé par l'application
  depth = target;                                                                            // Retour demandé par la personne
  while (levels.length > depth) runClose(levels.pop());
  reconcile();
});

/* ---------- Pages ---------- */
let prevPage = 'homePage';
export const PAGES_WITH_HELP = ['homePage', 'modulePage', 'formateurPage'];
const SUBPAGES = { modulePage: () => 'homePage', allLogsPage: () => 'homePage', settingsPage: () => prevPage }; // écrans secondaires : Retour revient à la page indiquée
const pageLevels = {};
export function currentPage() { const p = $('.page.active'); return p ? p.id : ''; }
export function showPage(id) {
  const cur = currentPage();
  if (cur && cur !== 'settingsPage' && cur !== id) prevPage = cur;
  $$('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  const help = document.getElementById('helpBtn');
  if (help) help.style.display = PAGES_WITH_HELP.indexOf(id) >= 0 ? 'flex' : 'none';
  if (SUBPAGES[id]) {
    if (!levelOpen(pageLevels[id])) pageLevels[id] = openLevel(() => { showPage(SUBPAGES[id]()); document.dispatchEvent(new CustomEvent('echo:render')); }, 'page');
  } else {
    const i = levels.findIndex(l => l.kind === 'page'); // retour sur une page principale : les écrans secondaires ne sont plus dans l'historique
    if (i >= 0) { levels.splice(i).reverse().forEach(l => { if (l.kind === 'overlay') runClose(l); }); reconcile(); }
  }
}
export function previousPage() { return prevPage; }
export function loadingDone() { const l = document.getElementById('loadingScreen'); if (l) l.style.display = 'none'; }

/* ---------- Message bref ---------- */
let toastT = null;
export function toast(msg, dur = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), dur);
}

/* ---------- Boîtes de dialogue ---------- */
let dlgResolve = null, dlgCancel = null;
const dlgLevel = makeLevel('overlay', () => { // fermeture par Retour : équivaut à « Annuler »
  document.getElementById('dlg').classList.remove('open');
  const r = dlgResolve; dlgResolve = null;
  if (r) r(dlgCancel);
});
function dlgOpen(content, cancelValue) {
  const box = document.getElementById('dlgBox');
  setHTML(box, content);
  dlgCancel = cancelValue;
  document.getElementById('dlg').classList.add('open');
  dlgLevel.open();
}
export function dlgClose(value) {
  const r = dlgResolve; dlgResolve = null;
  dlgLevel.close();
  if (r) r(value);
}
ACT.dlgPick = (d) => { let v = d.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (v === 'null') v = null; dlgClose(v); };
export function confirmDlg({ title, text, ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  return new Promise(res => {
    dlgResolve = res;
    dlgOpen(html`<div class="dlg-title">${title}</div><div class="dlg-text">${text}</div>
      <div class="dlg-actions"><button class="btn-save" style="${danger ? 'background:#f43f5e;color:#fff' : ''}" data-act="dlgPick" data-v="true">${ok}</button><button class="btn-cancel" data-act="dlgPick" data-v="false">${cancel}</button></div>`, false);
  });
}
export function infoDlg({ title, text, ok = 'OK' }) {
  return new Promise(res => {
    dlgResolve = res;
    dlgOpen(html`<div class="dlg-title">${title}</div><div class="dlg-text">${text}</div><div class="dlg-actions"><button class="btn-save" data-act="dlgPick" data-v="true">${ok}</button></div>`, true);
  });
}
/** choices : [{ label, sub, value }] ; renvoie la valeur choisie ou null */
export function choiceDlg({ title, text, choices, cancel = 'Annuler' }) {
  return new Promise(res => {
    dlgResolve = res;
    dlgOpen(html`<div class="dlg-title">${title}</div><div class="dlg-text">${text}</div>
      ${choices.map(c => html`<button class="dlg-choice" data-act="dlgPick" data-v="${c.value === null ? 'null' : c.value}">${c.label}${c.sub ? html`<small>${c.sub}</small>` : ''}</button>`)}
      <div class="dlg-actions"><button class="btn-cancel" data-act="dlgPick" data-v="null">${cancel}</button></div>`, null);
  });
}
