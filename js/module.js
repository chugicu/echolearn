// Modules d'apprentissage : items, statuts, vignettes (images et vidéos stockées sur le téléphone), validation par QR code
import { S, meNow, isReadOnly, setItem, sync, echoValids } from './store.js';
import { html, setHTML, $, plural, fmtDateTime, esc } from './util.js';
import { registerActions, registerChanges, showPage, toast, confirmDlg, infoDlg, makeLevel } from './ui.js';
import { loadUserMedia, saveSlots, filledCount, SLOTS, slotUrl, isVideo } from './media.js';
import { maskImage } from './mask.js';
import { modById, modByIdAny, itemsOf, statusOf, statusLabel, statusClass, progressOf, slotValidation } from './data.js';

let curMod = null, curTab = 0;
let media = {}; // vignettes de l'utilisateur connecté : { 'cardio.paxp': [slot × 5] }
export const getMedia = () => media;
export async function loadMyMedia() {
  media = {};
  try { media = await loadUserMedia(S.me.username); } catch (e) { console.error(e); }
  return media;
}
export function resetMedia() { media = {}; curMod = null; }
const slotsOf = key => { const a = (media[key] || []).slice(0, SLOTS); while (a.length < SLOTS) a.push(null); return a; };

/* ---------- Ouverture ---------- */
export function openMod(modId) {
  const m = modById(modId);
  if (!m) { toast('Ce module n’est plus disponible.'); return; }
  curMod = m; curTab = 0;
  $('#moduleHeaderTitle').textContent = curMod.icon + ' ' + curMod.name;
  $('#moduleProgFill').style.background = curMod.accent;
  showPage('modulePage');
  renderTabs(); renderItems(); updateModuleProg();
}
export const inModule = () => !!curMod && $('#modulePage').classList.contains('active');
/** Le catalogue peut changer pendant que le module est ouvert (l'équipe ajoute ou masque un onglet, un item) : on retrouve le module à jour */
function resolveMod() {
  const m = curMod && modById(curMod.id);
  if (!m) return false;
  curMod = m;
  if (curTab >= m.tabs.length) curTab = Math.max(0, m.tabs.length - 1);
  return true;
}
export function refreshModule() {
  if (!inModule()) return;
  if (!resolveMod()) { curMod = null; toast('Ce module n’est plus disponible.'); showPage('homePage'); document.dispatchEvent(new CustomEvent('echo:render')); return; }
  $('#moduleHeaderTitle').textContent = curMod.icon + ' ' + curMod.name;
  $('#moduleProgFill').style.background = curMod.accent;
  renderTabs(); renderItems(); updateModuleProg();
}
function renderTabs() {
  setHTML($('#tabsContainer'), html`${curMod.tabs.map((t, i) => html`<div class="tab ${i === curTab ? 'active' : ''}" data-act="switchTab" data-i="${i}">${t.label}</div>`)}`);
}
function updateModuleProg() {
  const p = progressOf(S.me.id, curMod.id);
  $('#moduleProgFill').style.width = p.pct + '%';
  $('#moduleHeaderPct').textContent = p.pct + '% acquis (' + p.acquired + '/' + p.total + ' items)';
}

/* ---------- Items ---------- */
function slotHtml(uid, key, itemName, i, s, ro) {
  if (s) {
    const v = slotValidation(uid, key, i, s);
    const vid = isVideo(s);
    const inner = vid
      ? html`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;background:var(--bg4);border-radius:7px;gap:2px"><div style="font-size:1.4rem">▶️</div><div style="font-size:.5rem;color:var(--text2)">vidéo</div></div>`
      : html`<img src="${s.thumb || s.data}" alt="">`;
    return html`<div class="slot filled${v ? ' slot-validated' : ''}" data-act="openMedia" data-key="${key}" data-i="${i}" title="${v ? 'Validée' : 'Non validée'}">${inner}
      ${v ? html`<div class="slot-check">✓</div>` : ro ? '' : html`<button class="slot-qr" data-act="showQR" data-key="${key}" data-i="${i}" aria-label="Faire valider cette image">QR</button>`}
      ${ro ? '' : html`<button class="slot-del" data-act="delSlot" data-key="${key}" data-i="${i}" aria-label="Supprimer cette image">✕</button>`}</div>`;
  }
  if (ro) return html`<div class="slot" style="cursor:default;opacity:.5"><span class="slot-add">·</span></div>`;
  return html`<label class="slot"><span class="slot-add">+</span><input type="file" accept="image/*,video/*" data-change="addMedia" data-key="${key}" data-i="${i}" aria-label="Ajouter une image ou une vidéo"></label>`;
}
function lastValidator(uid, key) {
  const v = echoValids(uid).filter(r => r.key === key).sort((a, b) => b.ts - a.ts)[0];
  return v ? v.parNom : '';
}
export function renderItems() {
  if (!curMod) return;
  const me = meNow(), uid = me.id, ro = isReadOnly();
  const tab = curMod.tabs[curTab];
  setHTML($('#itemsGrid'), html`${tab.items.map(it => {
    const key = curMod.id + '.' + it.id;
    const status = statusOf(uid, key);
    const isMaitrise = status === 'maitrise';
    const slots = slotsOf(key);
    const filled = slots.map((s, i) => (s ? i : -1)).filter(i => i >= 0);
    const nValid = filled.filter(i => slotValidation(uid, key, i, slots[i])).length;
    const hasPending = filled.length > nValid;
    return html`<div class="item-card">
      <div class="item-top"><div class="item-name">${it.name}</div><div class="status-pill ${statusClass(status)}" ${ro ? '' : html`data-act="cycleStatus" data-key="${key}"`}>${statusLabel(status)}</div></div>
      <div class="item-desc">${it.desc}</div>
      <div class="slots-row">${slots.map((s, i) => slotHtml(uid, key, it.name, i, s, ro))}</div>
      <span class="upload-label">Appuie sur + pour ajouter une image ou une vidéo (${SLOTS} max)${filled.length ? ' · ' + nValid + '/' + filled.length + ' validée' + (filled.length > 1 ? 's' : '') : ''}</span>
      ${!ro && hasPending ? html`<div class="slot-actions"><button class="btn-mini" data-act="showQR" data-key="${key}" data-i="all">📋 Faire valider cet item</button></div>` : ''}
      ${isMaitrise ? html`<div style="font-size:.68rem;color:#4ade80;margin-top:.4rem;display:flex;align-items:center;gap:.3rem">✓ Maîtrisé — validé par ${lastValidator(uid, key) || 'un formateur'}</div>` : ''}
    </div>`;
  })}`);
}

/* ---------- Statut ---------- */
async function cycleStatus(d) {
  if (isReadOnly()) return;
  const uid = S.me.id, cur = statusOf(uid, d.key);
  if (cur === 'maitrise') { toast('Ce statut est attribué par un formateur'); return; }
  const c = ['nonfait', 'vu', 'fait'];
  setItem(uid, d.key, { statut: c[(c.indexOf(cur) + 1) % c.length] });
  refreshModule();
}

/* ---------- Ajouter / supprimer une vignette ---------- */
const MAX_FILE = 2 * 1024 * 1024 * 1024;
async function addMedia(d, el) {
  const file = el.files && el.files[0];
  el.value = '';
  if (!file) return;
  if (isReadOnly()) { toast('Semestre archivé : lecture seule.'); return; }
  if (file.size > MAX_FILE) { toast('Fichier trop volumineux (max 2 Go)'); return; }
  const key = d.key, idx = Number(d.i), me = meNow();
  let slot;
  if (file.type && file.type.indexOf('video') === 0) {
    const ok = await confirmDlg({ title: 'Vidéo : pas de masquage', text: 'Les vidéos ne passent pas par l’outil de masquage. Avant de l’enregistrer, vérifie qu’aucune donnée patient (nom, date de naissance, identifiant) n’apparaît à l’écran, à aucun moment de la vidéo. La vidéo reste sur ton téléphone.', ok: 'Enregistrer la vidéo' });
    if (!ok) return;
    slot = { type: file.type, name: file.name || 'video', addedAt: Date.now(), blob: file };
  } else {
    let m;
    try { m = await maskImage(file); } catch (e) { toast('Image illisible.'); return; }
    if (!m) return;
    slot = { type: m.type, name: m.name, addedAt: Date.now(), data: m.data, thumb: m.thumb, masked: m.masked };
  }
  const slots = slotsOf(key); slots[idx] = slot;
  const status = statusOf(me.id, key);
  try { await saveSlots(me.username, key, slots, status); }
  catch (e) { toast('Enregistrement impossible : espace insuffisant sur le téléphone.', 4500); return; }
  media[key] = slots;
  setItem(me.id, key, { statut: status === 'nonfait' ? 'vu' : status, n: filledCount(slots) });
  refreshModule();
  toast(slot.blob ? 'Vidéo enregistrée ✓' : 'Photo enregistrée ✓');
}
async function delSlot(d) {
  if (isReadOnly()) return;
  const key = d.key, idx = Number(d.i), me = meNow();
  const ok = await confirmDlg({ title: 'Supprimer cette image ?', text: 'Elle sera effacée de ton téléphone. Une validation déjà donnée par un formateur ne s’applique pas à une nouvelle image.', ok: 'Supprimer', danger: true });
  if (!ok) return;
  const slots = slotsOf(key); slots[idx] = null;
  try { await saveSlots(me.username, key, slots, statusOf(me.id, key)); } catch (e) { toast('Suppression impossible.'); return; }
  media[key] = slots;
  setItem(me.id, key, { n: filledCount(slots) });
  refreshModule();
}

/* ---------- Visionneuse ---------- */
function openMedia(d) {
  const s = slotsOf(d.key)[Number(d.i)];
  if (!s) return;
  const me = meNow(), v = slotValidation(me.id, d.key, Number(d.i), s);
  const src = slotUrl(s);
  const body = isVideo(s)
    ? html`<video src="${src}" controls autoplay playsinline style="max-width:95vw;max-height:80vh;border-radius:12px;display:block"></video>`
    : html`<img src="${src}" alt="" style="max-width:95vw;max-height:80vh;border-radius:12px;display:block">`;
  setHTML($('#mediaContent'), html`${body}${v ? html`<div style="margin-top:.75rem;font-size:.78rem;color:#4ade80;text-align:center">✓ Validée par ${v.par || 'un formateur'}${v.ts ? ' · ' + fmtDateTime(v.ts) : ''}</div>` : html`<div style="margin-top:.75rem;font-size:.75rem;color:var(--text3);text-align:center">En attente de validation${s.masked === false ? ' · image non masquée' : ''}</div>`}`);
  $('#mediaModal').classList.add('open');
  mediaLevel.open();
}
const mediaLevel = makeLevel('overlay', () => {
  const v = document.querySelector('#mediaContent video');
  if (v) { v.pause(); v.removeAttribute('src'); v.load && v.load(); }
  $('#mediaContent').textContent = '';
  $('#mediaModal').classList.remove('open');
});
export const closeMedia = () => mediaLevel.close();

/* ---------- QR code de validation (en présence d'un formateur connecté sur son propre téléphone) ---------- */
let qrState = null, qrPoll = null;
export function qrPayload(uid, key, mask, full, ts) { return [uid, key, mask, full ? 1 : 0, ts].join('/'); }
export function validationUrl(uid, key, mask, full, ts) { return location.href.split('#')[0].split('?')[0] + '#/v/' + qrPayload(uid, key, mask, full, ts); }
function showQR(d) {
  const me = meNow(), key = d.key, slots = slotsOf(key);
  const pending = slots.reduce((m, s, i) => (s && !slotValidation(me.id, key, i, s) ? m | (1 << i) : m), 0);
  const mask = d.i === 'all' ? pending : (pending & (1 << Number(d.i)));
  if (!mask) { toast('Cette image est déjà validée.'); return; }
  const full = (pending & ~mask) === 0;
  const ts = Date.now();
  const url = validationUrl(me.id, key, mask, full, ts);
  const it = (() => { const m = modByIdAny(key.split('.')[0]); return m && itemsOf(m).find(x => x.id === key.split('.')[1]); })();
  const nImg = [0, 1, 2, 3, 4].filter(i => mask & (1 << i)).length;
  $('#qrItemName').textContent = (it ? it.name : key) + ' — ' + nImg + ' image' + (nImg > 1 ? 's' : '');
  const box = $('#qrCodeContainer');
  box.dataset.url = url;
  try {
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (e) { box.textContent = 'Impossible de générer le QR code.'; }
  $('#qrTimer').textContent = 'Valable 15 minutes. Réaffiche-le pour en générer un nouveau.';
  qrState = { key, mask, ts };
  $('#qrModal').classList.add('open');
  qrLevel.open();
  clearInterval(qrPoll);
  qrPoll = setInterval(() => sync(), 6000); // la coche arrive dès que le formateur a validé
}
const qrLevel = makeLevel('overlay', () => {
  $('#qrModal').classList.remove('open');
  clearInterval(qrPoll); qrPoll = null; qrState = null;
});
export const closeQR = () => qrLevel.close();
/** Appelé à chaque synchronisation : ferme la fenêtre QR dès que les images sont validées */
export function checkQrDone() {
  if (!qrState || !$('#qrModal').classList.contains('open')) return;
  const me = meNow(), slots = slotsOf(qrState.key);
  const left = [0, 1, 2, 3, 4].filter(i => (qrState.mask & (1 << i)) && slots[i] && !slotValidation(me.id, qrState.key, i, slots[i]));
  if (!left.length) {
    const who = lastValidator(me.id, qrState.key);
    closeQR();
    toast('✅ Validé' + (who ? ' par ' + who : '') + ' !', 4000);
  }
}
async function refreshValidations() { await sync(); checkQrDone(); toast('Validations à jour'); }

registerActions({
  switchTab: d => { curTab = Number(d.i); renderTabs(); renderItems(); },
  cycleStatus, openMedia, closeMedia, delSlot, showQR, closeQR, refreshValidations
});
registerChanges({ addMedia });
