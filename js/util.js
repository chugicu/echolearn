// Utilitaires : échappement HTML sûr, dates, semaines, divers

/* ---------- HTML sûr : toute valeur interpolée est échappée, sauf un fragment déjà produit par html`` ou raw() ---------- */
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export const raw = s => new Safe(String(s ?? ''));
function part(v) {
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Safe(out);
}
export function setHTML(el, v) { el.innerHTML = v instanceof Safe ? v.s : esc(v); }

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function uid() { return (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16)).replace(/-/g, '').slice(0, 20); }
export const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- Noms ---------- */
export function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '_'); }
export function fullName(u) { return u ? ((u.prenom || '') + ' ' + (u.nom || '')).trim() || u.username || '—' : '—'; }
export function firstName(u) { return u ? (u.prenom || String(u.username || '').split('.')[0] || '') : ''; }
export function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- Dates (heure locale de l'appareil) ---------- */
const pad = n => String(n).padStart(2, '0');
/** Semaine ISO « 2026-W44 » */
export function weekKey(d = new Date()) {
  d = d instanceof Date ? d : new Date(d);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - new Date(Date.UTC(y, 0, 1))) / 864e5 + 1) / 7);
  return y + '-W' + pad(w);
}
/** Lundi de la semaine ISO */
export function weekStart(k) {
  const [y, w] = String(k).split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const mon = new Date(jan4); mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (w - 1) * 7);
  return new Date(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate(), 12);
}
export function weekLabel(k) { return weekStart(k).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
export function fmtDateTime(ts) { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
export function fmtDate(ts) { return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
export function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return 'il y a ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 24) return 'il y a ' + h + ' h';
  return 'il y a ' + Math.round(h / 24) + ' j';
}
export function plural(n, one, many) { return n > 1 ? many : one; }

/* ---------- Fichiers ---------- */
export function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Lecture échouée')); r.readAsDataURL(blob); });
}
