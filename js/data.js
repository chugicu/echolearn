// Calculs sur les données : progression, examens, vignettes validées, classement
import { echoItem, echoItems, echoValids, echoExams } from './store.js';
import { MODALITIES, ALL_MODULES } from './modalities.js';
import { weekKey, fmtDateTime } from './util.js';
import { SLOTS } from './media.js';

export const modById = id => MODALITIES.find(m => m.id === id);               // modules visibles (listes, progression)
export const modByIdAny = id => ALL_MODULES.find(m => m.id === id);           // y compris masqués (examens anciens, validation d'une image)
export const modByName = n => ALL_MODULES.find(m => m.name === n || m.oldNames.indexOf(n) >= 0); // nom actuel ou ancien : les examens déjà saisis restent rattachés
export const itemsOf = m => m.tabs.flatMap(t => t.items);
export const STATUS_LABEL = { nonfait: 'Non fait', vu: 'Vu', fait: 'Fait', maitrise: 'Maîtrisé' };
export const STATUS_CLASS = { nonfait: 's-nonfait', vu: 's-vu', fait: 's-fait', maitrise: 's-maitrise' };
export const STATUS_COLOR = { nonfait: '#3a3f5c', vu: '#93c5fd', fait: '#fb923c', maitrise: '#4ade80' };
export const statusLabel = s => STATUS_LABEL[s] || 'Non fait';
export const statusClass = s => STATUS_CLASS[s] || 's-nonfait';
/** « Acquis » = Fait ou Maîtrisé (la version précédente comptait un statut qui n'existait pas : le total restait à 0) */
export const acquired = s => s === 'fait' || s === 'maitrise';

export function statusOf(uid, key) { const r = echoItem(uid, key); return r ? r.statut || 'nonfait' : 'nonfait'; }

/* ---------- Progression par module et globale ---------- */
export function progressOf(uid, modId) {
  const mod = modById(modId);
  if (!mod) return { total: 0, acquired: 0, maitrise: 0, pct: 0 };
  const rows = {}; echoItems(uid).forEach(r => (rows[r.key] = r));
  let total = 0, acq = 0, mait = 0;
  itemsOf(mod).forEach(it => {
    total++;
    const s = (rows[modId + '.' + it.id] || {}).statut;
    if (acquired(s)) acq++;
    if (s === 'maitrise') mait++;
  });
  return { total, acquired: acq, maitrise: mait, pct: total ? Math.round(acq / total * 100) : 0 };
}
export function globalProgress(uid) {
  let total = 0, acq = 0, mait = 0;
  MODALITIES.forEach(m => { const p = progressOf(uid, m.id); total += p.total; acq += p.acquired; mait += p.maitrise; });
  return { total, acquired: acq, maitrise: mait, pct: total ? Math.round(acq / total * 100) : 0 };
}

/* ---------- Examens (famille de gestes « Écho », le site est le nom du module) ---------- */
export function logsOf(uid) {
  return echoExams(uid).map(g => {
    const m = modByName(g.site);
    return { id: g.id, type: m ? m.id : g.site, note: g.commentaire || '', ts: g.ts, date: fmtDateTime(g.ts), week: weekKey(g.ts) };
  }).sort((a, b) => b.ts - a.ts);
}
export function weekCount(logs, weeksAgo) {
  const d = new Date(); d.setDate(d.getDate() - weeksAgo * 7);
  const k = weekKey(d);
  return logs.filter(l => l.week === k).length;
}

/* ---------- Vignettes validées ---------- */
/** Une vignette est validée si un formateur l'a validée après son ajout (remplacer l'image annule la validation). */
export function validRow(uid, key, idx) { return echoValids(uid).find(r => r.key === key && Number(r.slot) === idx) || null; }
export function slotValidation(uid, key, idx, slot) {
  if (!slot) return null;
  const v = validRow(uid, key, idx);
  if (v && (!slot.addedAt || v.ts >= slot.addedAt)) return { par: v.parNom || '', ts: v.ts, commentaire: v.commentaire || '' };
  return null;
}
/** Total de vignettes enregistrées / validées sur ce téléphone */
export function validatedProgress(uid, media) {
  let totalSlots = 0, validatedSlots = 0;
  Object.keys(media || {}).forEach(key => {
    (media[key] || []).forEach((s, i) => { if (s) { totalSlots++; if (slotValidation(uid, key, i, s)) validatedSlots++; } });
  });
  return { totalSlots, validatedSlots, pct: totalSlots ? Math.round(validatedSlots / totalSlots * 100) : 0 };
}
/** Vue du formateur (les images ne sont pas sur son appareil) : vignettes déclarées par l'interne (n) et validations enregistrées */
export function validatedForTrainer(uid) {
  let total = 0, valid = 0;
  const byKey = {}; echoValids(uid).forEach(v => { (byKey[v.key] = byKey[v.key] || new Set()).add(Number(v.slot)); });
  echoItems(uid).forEach(r => {
    const n = Math.min(SLOTS, Number(r.n) || 0);
    total += n;
    valid += Math.min(n, (byKey[r.key] || new Set()).size);
  });
  return { total, valid, pct: total ? Math.round(valid / total * 100) : 0 };
}

/* ---------- Classement anonyme (calculé par le serveur, visible à partir de 3 internes) ---------- */
/** `top` = part (en %) des internes qui font strictement mieux que moi, calculée par le serveur. Renvoie « Top X% » (le meilleur d'une promotion de 10 est dans le Top 10%). */
export function rankLabel(top, n, mine) {
  if (!mine) return { icon: '🌱', label: '—', x: 100 };
  const x = Math.min(100, Math.max(1, Math.round(((Math.round(top / 100 * n) + 1) / n) * 100)));
  const icon = x <= 10 ? '🏆' : x <= 20 ? '🥇' : x <= 30 ? '🥈' : x <= 40 ? '🥉' : x <= 50 ? '📈' : x <= 60 ? '📊' : x <= 70 ? '📉' : x <= 80 ? '💪' : x <= 90 ? '🎯' : '🌱';
  return { icon, label: 'Top ' + x + '%', x };
}
