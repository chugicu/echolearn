// Paramètres : compte, déverrouillage par le téléphone, synchronisation, portfolio, export
import { S, meNow, isIntern, isTrainer, pendingCount, sync, echoItems, echoExams } from './store.js';
import { html, setHTML, fullName, timeAgo, download, $ } from './util.js';
import { registerActions, showPage, previousPage, toast } from './ui.js';
import { carnetUrl } from './home.js';
import { getMedia } from './module.js';
import { filledCount } from './media.js';
import { unlockSupported, platformAvailable, unlockEnabled, enableUnlock, disableUnlock } from './unlock.js';

let platOk = null;
platformAvailable().then(v => { platOk = v; document.dispatchEvent(new CustomEvent('echo:render')); });
export const unlockAvailable = () => unlockSupported() && platOk !== false;
export const unlockOfferWanted = () => platOk === true && unlockSupported();

/** Stockage persistant : demande au navigateur de ne pas effacer les images en cas de manque de place (Chrome l'accorde surtout aux applications installées) */
let persisted = null;
const storageApi = () => (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) ? navigator.storage : null;
const setPersisted = v => { if (v !== persisted) { persisted = v; document.dispatchEvent(new CustomEvent('echo:render')); } };
export function ensurePersistentStorage() {
  const st = storageApi(); if (!st) return;
  Promise.resolve().then(async () => {
    let ok = st.persisted ? await st.persisted() : false;
    if (!ok) ok = await st.persist();
    setPersisted(!!ok);
  }).catch(() => {});
}

const ROLE = { interne: 'Interne', senior: 'Senior', equipe: 'Équipe pédagogique' };

function card(icon, title, desc, action) {
  return html`<div class="settings-card"><div class="settings-card-left"><div class="settings-icon">${icon}</div><div class="settings-info"><div class="settings-title">${title}</div><div class="settings-desc">${desc}</div></div></div>${action || ''}</div>`;
}
const btn = (label, act, cls = '', extra = '') => html`<button class="settings-btn ${cls}" data-act="${act}" ${extra}>${label}</button>`;

export function renderSettings() {
  const me = meNow(); if (!me) return;
  const n = pendingCount(), uOn = unlockEnabled(me.id), media = getMedia();
  const imgs = Object.keys(media).reduce((t, k) => t + filledCount(media[k]), 0);
  const url = carnetUrl();
  const rows = [];
  rows.push(card('👤', fullName(me), html`<span id="settingsUserInfo">Connecté en tant que ${me.username} · ${ROLE[me.role] || me.role}${me.role === 'interne' && me.sem ? ' · ' + me.sem : ''}</span><br>Le même compte donne accès à Carnet Réa.`, btn('Se déconnecter', 'logout', 'settings-btn-danger')));
  if (url) rows.push(card('📓', 'Carnet Réa', 'Gestes, objectifs, entretiens, bilan. Profil, photo et mot de passe se modifient dans « Moi ».', html`<a class="settings-btn settings-btn-primary" href="${url}" style="text-decoration:none">Ouvrir</a>`));
  rows.push(card('🔐', 'Déverrouillage par le téléphone',
    unlockAvailable() ? (uOn ? 'Activé : Face ID, empreinte ou code du téléphone sont demandés après quelques minutes d\'inactivité, dans EchoLearn comme dans Carnet Réa.' : 'Demande Face ID, empreinte ou le code du téléphone à la réouverture. Un seul réglage pour les deux applications.') : 'Indisponible sur cet appareil ou ce navigateur.',
    unlockAvailable() ? btn(uOn ? 'Désactiver' : 'Activer', 'toggleUnlock', uOn ? 'settings-btn-connected' : 'settings-btn-primary') : ''));
  rows.push(card('🔄', 'Synchronisation', html`${S.online ? (S.lastSync ? 'Dernière synchronisation : ' + timeAgo(S.lastSync) + '.' : 'Pas encore synchronisé.') : 'Hors ligne : tes données restent disponibles.'}${n ? html`<br><b style="color:#fb923c">${n} modification${n > 1 ? 's' : ''} en attente d'envoi.</b>` : ''}${S.error ? html`<br><span style="color:#f87171">${S.error}</span>` : ''}`, btn('Synchroniser', 'syncNow')));
  if (isIntern()) {
    rows.push(card('📄', 'Portfolio PDF', 'Toutes tes images classées par module avec leur validation, ta progression et la liste de tes examens. Ouvre une page à imprimer ou enregistrer en PDF.', btn('Générer', 'generatePortfolio', 'settings-btn-primary')));
    rows.push(card('💾', 'Mes données', 'Exporte tes statuts et tes examens (fichier JSON). Les images ne sont pas incluses : elles ne sont stockées que sur ce téléphone.', btn('Exporter', 'exportData')));
    rows.push(card('🖼️', 'Images sur ce téléphone', html`${imgs} image${imgs > 1 ? 's' : ''} ou vidéo${imgs > 1 ? 's' : ''} enregistrée${imgs > 1 ? 's' : ''} ici. Elles ne sont jamais envoyées au serveur et ne suivent pas si tu changes de téléphone : pense au portfolio PDF.${persisted === true ? html`<br><span id="storageState" style="color:#4ade80">Stockage protégé : le téléphone ne les efface pas automatiquement.</span>` : persisted === false ? html`<br><span id="storageState" style="color:#fb923c">Stockage non protégé : installe l'application sur l'écran d'accueil pour que le téléphone ne puisse pas effacer tes images s'il manque de place.</span>` : ''}`, ''));
  }
  rows.push(card('📖', 'Tutoriel', 'Revoir le guide interactif (accueil, modules' + (isTrainer() ? ', espace formateur' : '') + ').', btn('Lancer', 'closeAndTuto')));
  rows.push(html`<div style="font-size:.68rem;color:var(--text3);text-align:center;margin-top:1rem;line-height:1.7">EchoLearn v2 · Réanimation de Guadeloupe<br>Les images et vidéos ne quittent jamais ton téléphone.</div>`);
  setHTML($('#settingsBody'), html`${rows}`);
}
export function openSettings() { renderSettings(); showPage('settingsPage'); }

async function toggleUnlock() {
  const me = meNow();
  if (unlockEnabled(me.id)) { disableUnlock(); toast('Déverrouillage par le téléphone désactivé.'); renderSettings(); return; }
  try { await enableUnlock(me, 'EchoLearn'); toast('Déverrouillage par le téléphone activé.'); }
  catch (e) { toast('Activation impossible sur cet appareil.'); }
  renderSettings();
}
function exportData() {
  const me = meNow();
  const items = echoItems(me.id).map(r => ({ key: r.key, statut: r.statut, images: r.n || 0 }));
  const exams = echoExams(me.id).map(g => ({ module: g.site, date: new Date(g.ts).toISOString(), note: g.commentaire || '' }));
  download('echolearn_' + me.username + '_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ utilisateur: me.username, semestre: me.sem, items, examens: exams, exporte: new Date().toISOString() }, null, 2));
  toast('Export téléchargé');
}

registerActions({
  openSettings, toggleUnlock, exportData,
  closeSettings: () => { showPage(previousPage()); document.dispatchEvent(new CustomEvent('echo:render')); },
  syncNow: async () => { await sync({ force: true }); renderSettings(); toast(S.error ? 'Synchronisation impossible' : S.online ? 'Synchronisé' : 'Hors ligne'); },
  closeAndTuto: () => { showPage(previousPage()); document.dispatchEvent(new CustomEvent('echo:render')); setTimeout(() => { const b = document.getElementById('helpBtn'); if (b) b.click(); }, 150); }
});
