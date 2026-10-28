// Graphiques (canvas) : barres hebdomadaires et courbe cumulée
import { weekKey } from './util.js';

const roundRect = (g, x, y, w, h, r) => { if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };

/** 6 dernières semaines : [{ key, label, count }] à partir d'une liste d'objets possédant .week */
export function lastWeeks(items, n = 6) {
  const weeks = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i * 7);
    const k = weekKey(d);
    weeks.push({ key: k, label: i === 0 ? 'Sem. act.' : 'S-' + i, count: items.filter(l => l.week === k).length });
  }
  return weeks;
}
export function barChart(canvas, weeks, o = {}) {
  if (!canvas) return;
  const H = o.height || 140, pad = 28, bw = o.bw || 20;
  canvas.width = canvas.parentElement.offsetWidth || 320; canvas.height = H;
  const g = canvas.getContext('2d'); g.clearRect(0, 0, canvas.width, H);
  const W = canvas.width, gap = (W - pad * 2) / weeks.length - bw, maxV = Math.max(...weeks.map(w => w.count), 1);
  weeks.forEach((w, i) => {
    const x = pad + (gap + bw) * i, bh = Math.max((w.count / maxV) * (H - 35), 2), y = H - 20 - bh;
    const gr = g.createLinearGradient(0, y, 0, H - 20); gr.addColorStop(0, '#6ee7f7'); gr.addColorStop(1, '#a78bfa');
    g.fillStyle = gr; g.beginPath(); roundRect(g, x, y, bw, bh, 4); g.fill();
    if (w.count > 0) { g.fillStyle = '#e8eaf0'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.fillText(w.count, x + bw / 2, y - 4); }
    g.fillStyle = '#5a6180'; g.font = '9px system-ui'; g.textAlign = 'center'; g.fillText(w.label, x + bw / 2, H - 5);
  });
}
export function lineChart(canvas, logs) {
  if (!canvas) return;
  const LH = 130, lp = 28;
  canvas.width = canvas.parentElement.offsetWidth || 320; canvas.height = LH;
  const g = canvas.getContext('2d'); g.clearRect(0, 0, canvas.width, LH);
  const LW = canvas.width, sorted = logs.slice().sort((a, b) => a.ts - b.ts);
  if (sorted.length < 2) { g.fillStyle = '#5a6180'; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText('Ajoutez des examens pour voir la courbe', LW / 2, LH / 2); return; }
  const pts = sorted.map((l, i) => ({ x: i, y: i + 1 })), mX = pts.length - 1, mY = pts.length;
  const tX = i => lp + (i / mX) * (LW - lp * 2), tY = v => LH - 18 - ((v / mY) * (LH - 30));
  g.strokeStyle = '#2e3450'; g.lineWidth = 1;
  [0, .25, .5, .75, 1].forEach(f => { const y = LH - 18 - f * (LH - 30); g.beginPath(); g.moveTo(lp, y); g.lineTo(LW - lp, y); g.stroke(); });
  const gr = g.createLinearGradient(0, 0, 0, LH); gr.addColorStop(0, 'rgba(110,231,247,0.25)'); gr.addColorStop(1, 'rgba(110,231,247,0)');
  g.beginPath(); g.moveTo(tX(0), tY(0)); pts.forEach(p => g.lineTo(tX(p.x), tY(p.y))); g.lineTo(tX(mX), LH - 18); g.lineTo(tX(0), LH - 18); g.closePath(); g.fillStyle = gr; g.fill();
  g.beginPath(); g.moveTo(tX(0), tY(0)); pts.forEach(p => g.lineTo(tX(p.x), tY(p.y))); g.strokeStyle = '#6ee7f7'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#5a6180'; g.font = '9px system-ui'; g.textAlign = 'left'; g.fillText('0', 4, LH - 15); g.fillText(mY, 4, 18);
}
