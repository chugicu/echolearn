// Point d'entrée d'EchoLearn : démarrage, choix de l'écran selon l'état (connexion, déverrouillage, profil, rôle), synchronisation, bandeaux
import { S, subscribe, restoreSession, purgeOrphans, sync, isTrainer, isIntern, isReadOnly, needsProfile, meNow, pendingCount } from './store.js';
import { initDelegation, showPage, currentPage, toast, loadingDone, registerActions, resetLevels } from './ui.js';
import { CARNET_URL } from './config.js';
import { html, setHTML, $ } from './util.js';
import { renderHome, renderAllLogs, setCarnetUrl } from './home.js';
import { loadMyMedia, resetMedia, refreshModule, checkQrDone } from './module.js';
import { renderLogin, renderChangePw, renderProfile, renderLock, initAuthForms } from './auth.js';
import { refreshFormateur, showOverview, renderValidate, parseValidationHash, validateNeedsRefresh } from './formateur.js';
import { renderSettings, unlockOfferWanted, ensurePersistentStorage } from './settings.js';
import { needsUnlock, unlockEnabled, touchUnlock, offerWanted, markOffered, enableUnlock } from './unlock.js';
import './tutorial.js';
import './portfolio.js';

let mediaFor = null, routing = 0;

/* ---------- Choix de l'écran ---------- */
async function route() {
  const ticket = ++routing;
  resetLevels(); // changement d'écran de fond : fenêtres refermées, historique du bouton Retour remis à zéro
  if (!S.session || !S.me) {
    mediaFor = null; resetMedia();
    renderLogin(); loadingDone(); return;
  }
  if (needsUnlock(S.me.id)) { renderLock(route); loadingDone(); return; }
  if (S.mustChange) { renderChangePw(); loadingDone(); return; }
  if (needsProfile()) { renderProfile(); loadingDone(); return; }
  if (mediaFor !== S.me.id) {
    mediaFor = S.me.id;
    if (isIntern()) { ensurePersistentStorage(); await loadMyMedia(); }
    if (ticket !== routing) return; // un autre changement d'écran a eu lieu pendant le chargement
  }
  const hash = location.hash || '';
  if (hash.indexOf('#/v/') === 0) {
    const p = parseValidationHash(hash);
    if (p) { renderValidate(p); loadingDone(); return; }
    history.replaceState(history.state, '', location.pathname + location.search); // lien de validation illisible
    toast('Lien de validation non reconnu.');
  }
  if (isTrainer()) { showPage('formateurPage'); showOverview(); }
  else { showPage('homePage'); renderHome(); }
  renderBanners(); renderSync();
  loadingDone();
}

/** Redessine l'écran affiché (données reçues, retour des paramètres…) sans changer d'écran */
function refreshActive() {
  if (!S.session || !S.me) return;
  const p = currentPage();
  if ((p === 'profilePage' && !needsProfile()) || (p === 'changePwPage' && !S.mustChange) || p === 'loginPage') { route(); return; }
  if (p === 'homePage') renderHome();
  else if (p === 'modulePage') { refreshModule(); checkQrDone(); }
  else if (p === 'allLogsPage') renderAllLogs();
  else if (p === 'formateurPage') refreshFormateur();
  else if (p === 'settingsPage') renderSettings();
  else if (p === 'validatePage' && validateNeedsRefresh()) { const v = parseValidationHash(location.hash); if (v) renderValidate(v); }
  renderBanners(); renderSync();
}

/* ---------- Bandeaux ---------- */
function banners() {
  const me = meNow(), out = [];
  if (!me) return '';
  if (isIntern() && isReadOnly()) out.push(html`<div class="banner warn"><span style="font-size:1.1rem">🔒</span><span class="grow">Semestre archivé : tes données sont en lecture seule.</span></div>`);
  if (S.storageFull) out.push(html`<div class="banner warn"><span style="font-size:1.1rem">⚠️</span><span class="grow">Mémoire du téléphone pleine : certaines données ne sont pas conservées hors ligne.</span></div>`);
  if (unlockOfferWanted() && offerWanted(me.id)) {
    out.push(html`<div class="banner" id="unlockOffer"><span style="font-size:1.1rem">🔐</span><span class="grow">Protège tes données : active le déverrouillage par Face ID, empreinte ou code du téléphone (pour EchoLearn et Carnet Réa).</span><button class="primary" data-act="unlockActivate">Activer</button><button data-act="unlockLater">Plus tard</button></div>`);
  }
  return html`${out}`;
}
function renderBanners() {
  const b = banners();
  const h = $('#homeBanners'), f = $('#fmtBanners');
  if (h) setHTML(h, isTrainer() ? '' : b);
  if (f) setHTML(f, isTrainer() ? b : '');
}
/* ---------- Indicateur de synchronisation ---------- */
function renderSync() {
  const n = pendingCount();
  let txt = '', off = false;
  if (!S.online) { txt = '⚠️ Hors ligne' + (n ? ' · ' + n : ''); off = true; }
  else if (S.syncing) txt = '↻ Synchronisation…';
  else if (S.error) { txt = '⚠️ Erreur de synchronisation'; off = true; }
  else if (n) { txt = '↑ ' + n + ' en attente'; off = true; }
  ['syncBadge', 'syncBadgeF'].forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = txt; el.classList.toggle('off', off); } });
}

registerActions({
  unlockActivate: async () => {
    const me = meNow(); markOffered(me.id);
    try { await enableUnlock(me, 'EchoLearn'); toast('Déverrouillage par le téléphone activé.'); }
    catch (e) { toast('Activation impossible sur cet appareil.'); }
    renderBanners();
  },
  unlockLater: () => { markOffered(meNow().id); renderBanners(); }
});

/* ---------- Événements du magasin de données ---------- */
subscribe((kind, payload) => {
  if (kind === 'session') { mediaFor = null; route(); return; }
  if (kind === 'status') { renderSync(); return; }
  if (kind === 'opError') { toast(payload); return; }
  if (kind === 'data') { refreshActive(); }
});
document.addEventListener('echo:route', () => route());
document.addEventListener('echo:render', () => refreshActive());
window.addEventListener('hashchange', () => { if (S.session && S.me && !S.mustChange) route(); });

/* ---------- Déverrouillage : l'échéance est repoussée tant que l'application est utilisée ---------- */
const keepUnlocked = () => { if (S.session && S.me && unlockEnabled(S.me.id) && currentPage() !== 'lockPage') touchUnlock(); };
document.addEventListener('visibilitychange', () => {
  if (!S.session || !S.me) return;
  if (document.visibilityState === 'hidden') keepUnlocked();
  else if (needsUnlock(S.me.id) && currentPage() !== 'lockPage') route();
});
window.addEventListener('pagehide', keepUnlocked);
setInterval(() => { if (document.visibilityState === 'visible') keepUnlocked(); }, 60000);

/* ---------- Démarrage ---------- */
initDelegation();
initAuthForms();
setCarnetUrl(CARNET_URL);
if (!restoreSession()) purgeOrphans();
route().then(() => { if (S.session) sync(); });

if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('Nouvelle version disponible : ferme puis rouvre l\'application.', 9000); });
}
