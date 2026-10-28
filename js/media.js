// Images et vidéos : elles restent sur le téléphone (IndexedDB). Aucun média n'est envoyé au serveur.
const DB_NAME = 'EchoLearnDB', DB_VER = 8;
export const SLOTS = 5;

let dbP = null;
export function openDb() {
  if (dbP) return dbP;
  dbP = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('IndexedDB indisponible')); return; }
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const d = e.target.result; // ⚠️ on ne supprime jamais de magasin : les données existantes sont préservées
      if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('logs')) d.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('formateurs')) d.createObjectStore('formateurs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('services')) d.createObjectStore('services', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('etablissements')) d.createObjectStore('etablissements', { keyPath: 'id' });
    };
    r.onsuccess = e => res(e.target.result);
    r.onerror = () => { dbP = null; rej(r.error || new Error('Erreur de base locale')); };
    r.onblocked = () => { /* un autre onglet garde l'ancienne version ouverte */ };
  });
  return dbP;
}
const req2p = q => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
async function store(name, mode = 'readonly') { const d = await openDb(); return d.transaction(name, mode).objectStore(name); }
async function tx(name, mode, fn) {
  const d = await openDb();
  return new Promise((res, rej) => {
    const t = d.transaction(name, mode);
    let out;
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Écriture annulée (stockage plein ?)'));
    out = fn(t.objectStore(name));
  });
}

/* ---------- Vignettes d'un item ---------- */
// Enregistrement : { id: '<identifiant>|<module.item>', status, slots: [ { type, name, addedAt, data | blob, thumb, masked } | null ] }
const range = prefix => IDBKeyRange.bound(prefix, prefix + '￿');
/** Toutes les vignettes d'un utilisateur : { 'cardio.paxp': [slot…] } */
export async function loadUserMedia(username) {
  const prefix = username + '|';
  const rows = await req2p((await store('items')).getAll(range(prefix)));
  const out = {};
  rows.forEach(r => {
    const key = r.id.slice(prefix.length);
    if (key.indexOf('.') > 0) out[key] = normalizeSlots(r.slots);
  });
  return out;
}
function normalizeSlots(slots) {
  const out = [];
  for (let i = 0; i < SLOTS; i++) {
    const s = (slots || [])[i];
    if (s && (s.data || s.blob)) {
      out.push(Object.assign({}, s));
    } else out.push(null);
  }
  return out;
}
export async function saveSlots(username, key, slots, status) {
  const id = username + '|' + key;
  const rec = { id, status: status || 'nonfait', slots: slots.map(s => s || null) };
  await tx('items', 'readwrite', st => st.put(rec));
}
export function filledCount(slots) { return (slots || []).filter(Boolean).length; }
export function filledMask(slots) { return (slots || []).reduce((m, s, i) => (s ? m | (1 << i) : m), 0); }

/* ---------- Images : lecture, redimensionnement, bandeau ---------- */
export const MAX_IMG = 2000;
export async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try { const b = await createImageBitmap(file, { imageOrientation: 'from-image' }); return { src: b, w: b.width, h: b.height, close: () => b.close && b.close() }; } catch (e) { /* repli ci-dessous */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image illisible')); i.src = url; });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
/** Dessine l'image (taille maximale MAX_IMG) puis le rectangle noir : band = { y: 0..1, h: 0..1 } en fraction de la hauteur, ou null */
export function drawMasked(bmp, band, maxDim = MAX_IMG) {
  const s = Math.min(1, maxDim / Math.max(bmp.w, bmp.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.w * s)); c.height = Math.max(1, Math.round(bmp.h * s));
  const g = c.getContext('2d');
  g.drawImage(bmp.src, 0, 0, c.width, c.height);
  if (band && band.h > 0) { g.fillStyle = '#000'; g.fillRect(0, Math.round(band.y * c.height), c.width, Math.ceil(band.h * c.height)); }
  return c;
}
export function canvasData(c, q = 0.88) { return c.toDataURL('image/jpeg', q); }
export function makeThumb(c, size = 160) {
  const s = Math.min(1, size / Math.max(c.width, c.height));
  const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width * s)); t.height = Math.max(1, Math.round(c.height * s));
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.7);
}

/* ---------- URL d'affichage d'une vignette (les vidéos sont des Blob) ---------- */
const urls = new WeakMap();
export function slotUrl(s) {
  if (!s) return '';
  if (s.data) return s.data;
  if (s.blob) { let u = urls.get(s.blob); if (!u) { u = URL.createObjectURL(s.blob); urls.set(s.blob, u); } return u; }
  return '';
}
export const isVideo = s => !!(s && s.type && String(s.type).indexOf('video') === 0);
