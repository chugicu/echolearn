// Écrans d'accès : connexion (comptes de Carnet Réa), mot de passe provisoire, profil à compléter, déverrouillage par le téléphone
import { S, login, changePw, logout, NetError, meNow, sync, cfg } from './store.js';
import { setHTML, html, $ } from './util.js';
import { registerActions, showPage } from './ui.js';
import { carnetUrl } from './home.js';
import { verifyUnlock } from './unlock.js';

/** Identifiant saisi → forme attendue par le serveur : minuscules, sans espaces ni e-mail */
export const normUsername = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
const fail = (e, def) => (e instanceof NetError ? 'Pas de connexion au serveur. Vérifie ton réseau puis réessaie.' : (e && e.message) || def);

/* ---------- Connexion ---------- */
export function renderLogin() {
  showPage('loginPage');
  const err = $('#loginErr');
  err.textContent = S.notice || '';
  err.style.color = S.notice ? 'var(--text2)' : '';
  const url = carnetUrl();
  setHTML($('#loginLinks'), url ? html`<a class="link-btn" href="${url}">Pas encore de compte ? Crée-le dans Carnet Réa</a><a class="link-btn" href="${url}">Mot de passe oublié ? Carnet Réa</a>` : '');
}
async function submitLogin(e) {
  e.preventDefault();
  const u = normUsername($('#usernameInput').value), p = $('#passwordInput').value, err = $('#loginErr'), btn = $('#loginBtn');
  err.style.color = ''; err.textContent = '';
  if (!u || !p) { err.textContent = 'Saisis ton identifiant (prenom.nom) et ton mot de passe.'; return; }
  btn.disabled = true; btn.textContent = 'Connexion…';
  try { await login(u, p); $('#passwordInput').value = ''; }
  catch (ex) { err.textContent = fail(ex, 'Connexion impossible.'); }
  finally { btn.disabled = false; btn.textContent = 'Se connecter'; }
}

/* ---------- Mot de passe provisoire ---------- */
export function renderChangePw() {
  showPage('changePwPage');
  ['cpOld', 'cpNew', 'cpNew2'].forEach(id => ($('#' + id).value = ''));
  $('#cpErr').textContent = '';
}
async function submitChangePw(e) {
  e.preventDefault();
  const old = $('#cpOld').value, n1 = $('#cpNew').value, n2 = $('#cpNew2').value, err = $('#cpErr');
  err.textContent = '';
  const min = Number((cfg('securite') || {}).mdpMin) || 8;
  if (n1 !== n2) { err.textContent = 'Les deux mots de passe ne sont pas identiques.'; return; }
  if (n1.length < min) { err.textContent = min + ' caractères minimum.'; return; }
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  try { await changePw(old, n1); }
  catch (ex) { err.textContent = fail(ex, 'Changement impossible.'); btn.disabled = false; }
}

/* ---------- Profil (DES d'origine et semestre) : se remplit une seule fois, dans Carnet Réa ---------- */
export function renderProfile() {
  showPage('profilePage');
  const a = $('#profileCarnet'), url = carnetUrl();
  a.classList.toggle('hidden', !url);
  if (url) a.href = url;
}

/* ---------- Déverrouillage par le téléphone ---------- */
let lockBusy = false, onUnlocked = null;
export function renderLock(done) {
  onUnlocked = done;
  showPage('lockPage');
  const me = meNow();
  $('#lockName').textContent = 'Bonjour ' + (me.prenom || me.username || '');
  $('#lockErr').textContent = '';
  setTimeout(() => attempt(false), 250); // tentative silencieuse ; le bouton prend le relais si le navigateur exige un geste
}
async function attempt(manual) {
  if (lockBusy || !S.me) return;
  lockBusy = true;
  const btn = $('#unlockBtn'); btn.disabled = true;
  const ok = await verifyUnlock(S.me.id);
  lockBusy = false; btn.disabled = false;
  if (ok) { if (onUnlocked) onUnlocked(); return; }
  if (manual) $('#lockErr').textContent = 'Déverrouillage impossible. Réessaie, ou reconnecte-toi avec ton mot de passe.';
}

registerActions({
  logout: () => logout(),
  unlockNow: () => attempt(true),
  refreshProfile: async () => { await sync({ force: true }); document.dispatchEvent(new CustomEvent('echo:route')); }
});
export function initAuthForms() {
  $('#loginForm').addEventListener('submit', submitLogin);
  $('#changePwForm').addEventListener('submit', submitChangePw);
}
