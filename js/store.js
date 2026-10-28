// Couche de données d'EchoLearn : session partagée avec Carnet Réa, stockage local, file d'attente hors ligne, synchronisation.
// Même serveur (Apps Script), mêmes comptes : un seul identifiant prenom.nom et un seul mot de passe pour les deux applications.
import { API_URL } from './config.js';
import { uid as makeId, debounce, clone } from './util.js';
import { applyCatalogue } from './modalities.js';

export const TABLES = ['users', 'gestes', 'echo_items', 'echo_valid', 'config'];
export class NetError extends Error {}
export class ApiError extends Error {}

// Les deux applications sont sur le même domaine : elles lisent et écrivent la même session et le même réglage de déverrouillage
export const K_SESSION = 'cr:session';
const K_UNLOCK = ['cr:unlock', 'cr:unlockAt', 'cr:unlockAsked'];
const P_DB = 'echo:db:';              // base locale propre à EchoLearn (Carnet Réa utilise « cr:db: »)
const OVERLAP = 10000;
const FULL_EVERY = 24 * 3600e3;

/* Valeurs de repli tant que le serveur n'a pas envoyé la configuration */
const DEFAULTS = {
  semestreCourant: '',
  semestres: [],
  echo: { actif: true, url: '', etabService: false, etabs: [], services: [] },
  securite: { mdpMin: 8 }
};

/* ---------- Stockage local tolérant aux pannes ---------- */
const mem = {};
export function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { mem[k] = v; return false; } }
export function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } delete mem[k]; }
export function lsKeys() { try { return Object.keys(localStorage); } catch (e) { return Object.keys(mem); } }

/* ---------- État ---------- */
export const S = {
  session: null, me: null, db: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  syncing: false, lastSync: 0, error: '', mustChange: false, notice: '', storageFull: false
};
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(kind, payload) { listeners.forEach(fn => { try { fn(kind, payload); } catch (e) { console.error(e); } }); }

function emptyDb() {
  const rows = {}; TABLES.forEach(t => (rows[t] = {}));
  return { rows, ops: [], since: 0, lastFull: 0, rank: null, forceFull: false };
}
function loadDb(uid) {
  const raw = lsGet(P_DB + uid);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      const base = emptyDb();
      TABLES.forEach(t => { if (d.rows && d.rows[t]) base.rows[t] = d.rows[t]; });
      base.ops = (d.ops || []).map(o => { delete o.sent; return o; });
      base.since = d.since || 0; base.lastFull = d.lastFull || 0; base.rank = d.rank || null;
      return base;
    } catch (e) { /* base corrompue : on repart de zéro (le serveur refait tout) */ }
  }
  return emptyDb();
}
const cache = {};
let cfgCache = null;
function touch(tbl) { delete cache[tbl]; if (tbl === 'config') { cfgCache = null; applyCatalogue(cfg('echoCatalogue')); } }
/** Vide les caches de lecture puis aligne le catalogue (modules, onglets, items) sur le réglage « echoCatalogue » reçu du serveur */
function touchAll() {
  Object.keys(cache).forEach(k => delete cache[k]); cfgCache = null;
  applyCatalogue(cfg('echoCatalogue'));
}

const persistNow = () => {
  if (!S.db || !S.me) return;
  const ok = lsSet(P_DB + S.me.id, JSON.stringify(S.db));
  if (!ok && !S.storageFull) { S.storageFull = true; emit('status'); }
};
const persistSoon = debounce(persistNow, 400);
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistNow(); else onVisible(); });
  window.addEventListener('pagehide', persistNow);
  window.addEventListener('online', () => { S.online = true; emit('status'); sync(); });
  window.addEventListener('offline', () => { S.online = false; emit('status'); });
  // connexion ou déconnexion faite dans Carnet Réa pendant qu'EchoLearn est ouvert
  window.addEventListener('storage', e => {
    if (e.key !== K_SESSION) return;
    let n = null; try { n = e.newValue ? JSON.parse(e.newValue) : null; } catch (x) { n = null; }
    const cur = S.session ? S.session.token : null;
    if ((n && n.token) !== cur) location.reload();
  });
}

function saveSession() { if (S.session) lsSet(K_SESSION, JSON.stringify({ token: S.session.token, user: S.me })); }

/* ---------- Lecture ---------- */
export function all(tbl) {
  if (!S.db) return [];
  return cache[tbl] || (cache[tbl] = Object.values(S.db.rows[tbl] || {}));
}
export function get(tbl, id) { return S.db && S.db.rows[tbl] ? S.db.rows[tbl][id] || null : null; }
export function cfg(key) {
  if (!cfgCache) {
    cfgCache = {};
    all('config').forEach(r => { if (r.valeur !== null && r.valeur !== undefined) cfgCache[r.id] = r.valeur; });
  }
  const v = cfgCache[key], d = DEFAULTS[key];
  if (v === undefined) return d;
  if (v && d && typeof v === 'object' && typeof d === 'object' && !Array.isArray(v) && !Array.isArray(d)) return Object.assign({}, d, v);
  return v;
}
export function pendingCount() { return S.db ? S.db.ops.length : 0; }
export function rank() { return S.db ? S.db.rank : null; }
export function curSem() { return cfg('semestreCourant'); }
export function isIntern() { return !!S.me && S.me.role === 'interne'; }
export function isTrainer() { return !!S.me && (S.me.role === 'senior' || S.me.role === 'equipe'); }
export function isReadOnly() { return isIntern() && S.me.sem !== cfg('semestreCourant'); }

/* ---------- Écriture locale + file d'attente ---------- */
function queueOp(t, tbl, row, isNew) {
  const ops = S.db.ops;
  const i = ops.findIndex(o => !o.sent && o.tbl === tbl && o.row.id === row.id);
  if (t === 'put') {
    if (i >= 0 && ops[i].t === 'put') ops[i].row = Object.assign({}, ops[i].row, row);
    else ops.push({ id: makeId(), t: 'put', tbl, row: Object.assign({}, row), isNew: !!isNew, ts: Date.now() });
  } else {
    if (i >= 0 && ops[i].t === 'put' && ops[i].isNew) { ops.splice(i, 1); return; }
    if (i >= 0) ops.splice(i, 1);
    ops.push({ id: makeId(), t: 'del', tbl, row: { id: row.id }, ts: Date.now() });
  }
}
function afterLocal() { persistSoon(); emit('data'); scheduleSync(); }
const scheduleSync = debounce(() => sync(), 700);

export function put(tbl, row) {
  if (!S.db) throw new Error('Non connecté');
  if (!row.id) row.id = makeId();
  const cur = S.db.rows[tbl][row.id];
  S.db.rows[tbl][row.id] = Object.assign({}, cur || {}, row);
  touch(tbl);
  queueOp('put', tbl, row, !cur);
  afterLocal();
  return S.db.rows[tbl][row.id];
}
export function del(tbl, id) {
  if (!S.db) return;
  delete S.db.rows[tbl][id];
  touch(tbl);
  queueOp('del', tbl, { id });
  afterLocal();
}

/* ---------- Réseau ---------- */
export async function api(req, timeout = 30000) {
  if (!API_URL) throw new NetError("L'adresse du serveur n'est pas configurée (fichier js/config.js).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let txt;
  try {
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), signal: ctrl.signal, redirect: 'follow' });
    txt = await r.text();
  } catch (e) {
    throw new NetError('Pas de connexion au serveur.');
  } finally { clearTimeout(timer); }
  try { return JSON.parse(txt); } catch (e) { throw new NetError('Réponse inattendue du serveur.'); }
}
function authLost(msg) {
  persistNow();
  lsDel(K_SESSION);
  S.session = null; S.me = null; S.db = null; S.mustChange = false;
  S.notice = msg || 'Ta session a expiré, reconnecte-toi.';
  touchAll();
  emit('session');
}
export async function callAuth(req) {
  if (!S.session) throw new ApiError('Non connecté.');
  const r = await api(Object.assign({}, req, { token: S.session.token }));
  if (!r.ok) {
    if (r.err === 'auth') { authLost(); throw new ApiError('Session expirée.'); }
    throw new ApiError(r.err || 'Erreur.');
  }
  return r;
}

/* ---------- Authentification (comptes de Carnet Réa) ---------- */
function startSession(r) {
  S.session = { token: r.token };
  S.me = r.user;
  S.mustChange = !!r.mustChange;
  S.notice = '';
  S.error = '';
  S.db = loadDb(r.user.id);
  touchAll();
  saveSession();
  lsSet('cr:unlockAt', String(Date.now())); // le mot de passe vient d'être saisi : pas de second contrôle
  emit('session');
  sync({ force: !S.db.since });
}
export async function login(username, password) {
  const r = await api({ a: 'login', username, password });
  if (!r.ok) throw new ApiError(r.err || 'Connexion impossible.');
  startSession(r);
  return r;
}
export async function changePw(old, password) {
  await callAuth({ a: 'chpw', old, password });
  S.mustChange = false;
  emit('session');
}
export function restoreSession() {
  const raw = lsGet(K_SESSION);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    if (!s.token || !s.user || !s.user.id) return false;
    S.session = { token: s.token };
    S.me = s.user;
    S.db = loadDb(s.user.id);
    touchAll();
    return true;
  } catch (e) { return false; }
}
/** Sans session, on efface les copies locales de données qui n'ont plus rien à envoyer au serveur. */
export function purgeOrphans() {
  lsKeys().filter(k => k.startsWith(P_DB)).forEach(k => {
    let d = null; try { d = JSON.parse(lsGet(k)); } catch (e) { d = null; }
    if (!d || !d.ops || !d.ops.length) lsDel(k);
  });
}
/** La déconnexion vaut pour les deux applications (session commune). */
export async function logout() {
  const s = S.session, uid = S.me && S.me.id;
  if (!s) return;
  if (S.db && S.db.ops.length) { try { await sync(); } catch (e) { /* hors ligne */ } }
  api({ a: 'logout', token: s.token }, 8000).catch(() => {});
  lsDel(K_SESSION); K_UNLOCK.forEach(lsDel);
  if (uid && !(S.db && S.db.ops.length)) lsDel(P_DB + uid);
  S.session = null; S.me = null; S.db = null; S.mustChange = false; S.notice = '';
  touchAll();
  emit('session');
}

/* ---------- Synchronisation ---------- */
let syncP = null, again = false;
export function sync(opts) {
  if (!S.session || !S.db) return Promise.resolve();
  if (syncP) { again = true; if (opts && opts.force) S.db.forceFull = true; return syncP; }
  syncP = doSync(opts || {}).finally(() => {
    syncP = null;
    if (again) { again = false; setTimeout(() => sync(), 60); }
  });
  return syncP;
}
async function doSync(opts) {
  S.syncing = true; emit('status');
  const IGNORABLE = /déjà envoyé/;
  try {
    for (let loop = 0; loop < 4; loop++) {
      const db = S.db; if (!db || !S.session) return;
      const full = !!(opts.force || db.forceFull || !db.since || Date.now() - db.lastFull > FULL_EVERY);
      opts = {};
      const sent = db.ops.slice(0, 100);
      sent.forEach(o => (o.sent = true));
      let res;
      try {
        res = await api({ a: 'sync', token: S.session.token, since: full ? 0 : Math.max(1, db.since - OVERLAP), tables: TABLES, echoRank: S.me.role === 'interne', ops: sent.map(o => ({ id: o.id, t: o.t, tbl: o.tbl, row: o.row })) });
      } catch (e) {
        sent.forEach(o => delete o.sent);
        throw e;
      }
      if (!S.db || S.db !== db) return; // déconnexion pendant l'appel
      if (!res.ok) {
        sent.forEach(o => delete o.sent);
        if (res.err === 'auth') { authLost(); return; }
        throw new ApiError(res.err || 'Erreur serveur.');
      }
      let failed = 0;
      const byId = {};
      (res.results || []).forEach(r => (byId[r.id] = r));
      const sentIds = new Set(sent.map(o => o.id));
      sent.forEach(o => {
        const r = byId[o.id];
        if (r && !r.ok) {
          failed++;
          if (!IGNORABLE.test(r.err || '')) emit('opError', r.err || 'Une modification a été refusée.');
        }
      });
      db.ops = db.ops.filter(o => !sentIds.has(o.id));
      if (res.full) { TABLES.forEach(t => (db.rows[t] = {})); }
      Object.keys(res.rows || {}).forEach(t => {
        if (!db.rows[t]) return;
        res.rows[t].forEach(r => { if (r.del) delete db.rows[t][r.id]; else db.rows[t][r.id] = r; });
      });
      // les modifications encore en attente restent prioritaires sur ce que dit le serveur
      db.ops.forEach(o => {
        if (!db.rows[o.tbl]) return;
        if (o.t === 'put') db.rows[o.tbl][o.row.id] = Object.assign({}, db.rows[o.tbl][o.row.id] || {}, o.row);
        else delete db.rows[o.tbl][o.row.id];
      });
      const nRows = Object.keys(res.rows || {}).reduce((n, t) => n + res.rows[t].length, 0);
      const rankChanged = res.echo !== undefined && JSON.stringify(res.echo) !== JSON.stringify(db.rank);
      const meChanged = !!res.user && JSON.stringify(res.user) !== JSON.stringify(S.me);
      const changed = nRows > 0 || rankChanged || meChanged || sent.length > 0 || !!res.full;
      db.since = res.now;
      if (res.full) db.lastFull = Date.now();
      if (res.echo !== undefined) db.rank = res.echo;
      db.forceFull = failed > 0; // une opération refusée : on réaligne tout sur le serveur
      if (res.user) { S.me = res.user; saveSession(); }
      S.mustChange = !!res.mustChange;
      touchAll();
      persistSoon();
      S.lastSync = Date.now(); S.online = true; S.error = '';
      if (changed) emit('data');
      if (!db.ops.length && !db.forceFull) break;
    }
  } catch (e) {
    if (e instanceof NetError) { S.online = false; S.error = ''; }
    else S.error = e.message || 'Erreur de synchronisation.';
  } finally {
    S.syncing = false; emit('status');
  }
}
function onVisible() {
  if (S.session && Date.now() - S.lastSync > 30000) sync();
}
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (!S.session || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;
    if (S.db && (S.db.ops.length || Date.now() - S.lastSync > 150000)) sync();
  }, 45000);
}

/* ---------- Utilisateurs ---------- */
export function users() { return all('users').filter(u => !u.del); }
export function userById(id) { return get('users', id); }
export function meNow() { return S.me ? Object.assign({}, S.me, get('users', S.me.id) || {}) : null; }
export function profileComplete(u) { return !!(u && u.specialite && Number(u.rang) >= 1 && Number(u.rang) <= 12); }
export function needsProfile() { const m = meNow(); return !!(m && m.role === 'interne' && !profileComplete(m)); }
/** Internes de la promotion courante visibles pour le formateur */
export function interns() { return users().filter(u => u.role === 'interne' && !u.anon && u.actif !== false && u.sem === cfg('semestreCourant')); }

/* ---------- Données EchoLearn ---------- */
const isItemRow = r => !r.del && r.key && r.key.indexOf('.') > 0;
export function echoItems(uid) { return all('echo_items').filter(r => r.uid === uid && isItemRow(r)); }
export function echoItem(uid, key) { const r = get('echo_items', uid + '_' + key); return r && isItemRow(r) ? r : null; }
export function echoValids(uid) { return all('echo_valid').filter(r => r.uid === uid && !r.del); }
export function echoExams(uid) { return all('gestes').filter(g => g.uid === uid && g.type === 'echo' && !g.del); }

/** Statut d'un item (nonfait | vu | fait | maitrise) et nombre de vignettes remplies */
export function setItem(uid, key, patch) {
  const id = uid + '_' + key;
  const cur = get('echo_items', id) || {};
  const row = { id, uid, key, statut: cur.statut || 'nonfait', n: cur.n || 0 };
  return put('echo_items', Object.assign(row, patch));
}
export function addExam(uid, sem, site, note) {
  return put('gestes', { id: makeId(), uid, sem, type: 'echo', site, modalite: '', resultat: '', nom: '', commentaire: String(note || '').slice(0, 500), ts: Date.now() });
}

export { clone, makeId };
