// Outil « Masquer le bandeau » : un rectangle noir plein largeur, déplaçable et redimensionnable, recouvre la zone d'identité de l'écran de l'échographe.
// Seule l'image masquée est enregistrée ; l'original n'est jamais conservé.
import { registerActions, makeLevel } from './ui.js';
import { loadBitmap, drawMasked, canvasData, makeThumb } from './media.js';
import { lsGet, lsSet } from './store.js';

const K_BAND = 'echo:band';
let st = null; // { bmp, band, finish }

function savedBand() {
  try { const b = JSON.parse(lsGet(K_BAND) || 'null'); if (b && b.h > 0 && b.h <= 0.6 && b.y >= 0 && b.y + b.h <= 1.001) return b; } catch (e) { /* ignore */ }
  return { y: 0, h: 0.12 };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function layout() {
  if (!st) return;
  const wrap = document.querySelector('.mask-stage-wrap'), stage = document.getElementById('maskStage');
  const availW = Math.max(100, wrap.clientWidth - 16), availH = Math.max(100, wrap.clientHeight - 16);
  const s = Math.min(availW / st.bmp.w, availH / st.bmp.h);
  stage.style.width = Math.round(st.bmp.w * s) + 'px';
  stage.style.height = Math.round(st.bmp.h * s) + 'px';
}
function paintBand() {
  const band = document.getElementById('maskBand');
  if (!band || !st) return;
  band.style.top = (st.band.y * 100) + '%';
  band.style.height = (st.band.h * 100) + '%';
}

function buildStage() {
  const stage = document.getElementById('maskStage');
  stage.textContent = '';
  const cv = document.createElement('canvas');
  const s = Math.min(1, 1400 / Math.max(st.bmp.w, st.bmp.h));
  cv.width = Math.round(st.bmp.w * s); cv.height = Math.round(st.bmp.h * s);
  cv.getContext('2d').drawImage(st.bmp.src, 0, 0, cv.width, cv.height);
  cv.style.width = '100%'; cv.style.height = '100%';
  stage.append(cv);
  const band = document.createElement('div');
  band.className = 'mask-band'; band.id = 'maskBand';
  band.innerHTML = '<div class="mh top" data-h="top">↕</div><div class="mh bottom" data-h="bottom">↕</div>';
  stage.append(band);
  band.addEventListener('pointerdown', onDown);
  layout(); paintBand();
}

let drag = null;
function onDown(e) {
  const stage = document.getElementById('maskStage');
  const h = e.target.dataset && e.target.dataset.h;
  drag = { mode: h || 'move', y0: e.clientY, band: Object.assign({}, st.band), H: stage.clientHeight };
  try { e.target.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  e.preventDefault();
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
function onMove(e) {
  if (!drag) return;
  const d = (e.clientY - drag.y0) / drag.H, b = drag.band, MIN = 0.02;
  if (drag.mode === 'move') st.band = { y: clamp(b.y + d, 0, 1 - b.h), h: b.h };
  else if (drag.mode === 'bottom') st.band = { y: b.y, h: clamp(b.h + d, MIN, 1 - b.y) };
  else { const y = clamp(b.y + d, 0, b.y + b.h - MIN); st.band = { y, h: b.y + b.h - y }; }
  paintBand();
}
function onUp() {
  drag = null;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
}

/** Fermeture de la fenêtre (boutons ou bouton Retour du téléphone) : sans choix préalable, c'est une annulation */
const maskLevel = makeLevel('overlay', () => {
  document.getElementById('maskModal').classList.remove('open');
  window.removeEventListener('resize', layout);
  if (st) { const s = st; st = null; if (s.bmp.close) s.bmp.close(); s.resolve(null); }
});

/** Ouvre l'éditeur pour une photo ; renvoie { data, thumb, masked, type, name } ou null si l'utilisateur annule */
export async function maskImage(file) {
  const bmp = await loadBitmap(file);
  return new Promise(resolve => {
    st = { bmp, band: savedBand(), file, resolve };
    document.getElementById('maskModal').classList.add('open');
    maskLevel.open();
    window.addEventListener('resize', layout);
    buildStage();
    // la mise en page n'est connue qu'une fois la fenêtre affichée
    requestAnimationFrame(() => { layout(); paintBand(); });
  });
}
function finish(useBand) {
  if (!st) return;
  const { bmp, band, file, resolve } = st;
  if (useBand) lsSet(K_BAND, JSON.stringify(band));
  const c = drawMasked(bmp, useBand ? band : null);
  const out = { data: canvasData(c), thumb: makeThumb(c), masked: !!useBand, type: 'image/jpeg', name: file.name || 'image.jpg', w: c.width, h: c.height };
  st = null; if (bmp.close) bmp.close();
  maskLevel.close();
  resolve(out);
}
registerActions({
  maskSave: () => finish(true),
  maskNone: () => finish(false),
  maskCancel: () => maskLevel.close()
});
