// Portfolio imprimable (PDF via « Imprimer ») : progression, images par module avec leur validation, tableau des examens.
// Il est construit sur le téléphone de l'interne : les images ne passent par aucun serveur.
import { meNow, cfg } from './store.js';
import { html, fullName, fmtDate, weekKey } from './util.js';
import { MODALITIES } from './modalities.js';
import { registerActions, toast } from './ui.js';
import { getMedia } from './module.js';
import { itemsOf, progressOf, globalProgress, logsOf, statusOf, statusLabel, validatedProgress, slotValidation, modByIdAny } from './data.js';
import { isVideo } from './media.js';

const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;background:white}
@media print{.no-print{display:none!important}.page-break{page-break-before:always}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.print-btn{position:fixed;top:1rem;right:1rem;padding:.65rem 1.25rem;border-radius:10px;border:none;background:linear-gradient(135deg,#6ee7f7,#a78bfa);color:#0f1117;font-weight:700;font-size:.9rem;cursor:pointer;z-index:100;box-shadow:0 4px 15px rgba(0,0,0,.15)}
.cover{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(160deg,#0f1117 0%,#1f2435 100%);color:white;text-align:center;padding:3rem 2rem}
.cover-title{font-size:2.2rem;font-weight:800;margin-bottom:.5rem;color:#6ee7f7}
.cover-subtitle{font-size:1rem;color:#8b93b0;margin-bottom:2.5rem}
.cover-name{font-size:1.8rem;font-weight:700;margin-bottom:.4rem}
.cover-info{font-size:.95rem;color:#8b93b0;margin-bottom:.25rem}
.box{background:rgba(255,255,255,.07);border-radius:14px;padding:1rem 1.25rem;width:100%;max-width:480px;margin-top:1rem;text-align:left}
.box h4{font-size:.72rem;color:#8b93b0;margin-bottom:.7rem;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.bar{height:6px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden}.bar>i{display:block;height:100%;border-radius:3px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;width:100%;max-width:480px;margin-top:1rem}
.grid3>div{background:rgba(255,255,255,.07);border-radius:12px;padding:.85rem .5rem;text-align:center}
.grid3 b{display:block;font-size:1.6rem;font-weight:800}.grid3 span{font-size:.68rem;color:#8b93b0}
.module-section{padding:2.5rem 2rem}
.module-header{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid}
.module-name{font-size:1.4rem;font-weight:700}
.module-pct{margin-left:auto;font-size:.85rem;font-weight:600;padding:.3rem .8rem;border-radius:20px;background:#f0f4ff;color:#4a5568}
.item{margin-bottom:2.5rem;page-break-inside:avoid;border-bottom:1px solid #f0f0f0;padding-bottom:2rem}
.item-header{display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem}
.item-name{font-size:1rem;font-weight:600;flex:1}
.pill{font-size:.7rem;padding:.25rem .65rem;border-radius:20px;font-weight:700}
.s-maitrise{background:#d1fae5;color:#065f46}.s-fait{background:#fef3c7;color:#92400e}.s-vu{background:#dbeafe;color:#1e40af}.s-nonfait{background:#f3f4f6;color:#6b7280}
.item-desc{font-size:.78rem;color:#6b7280;margin-bottom:.75rem}
.photos{display:flex;flex-direction:column;gap:1.5rem;margin-top:.75rem}
.photo{width:100%;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;background:#f9fafb;page-break-inside:avoid}
.photo img{width:100%;height:auto;display:block;object-fit:contain;max-height:80vh}
.photo.video{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.5rem;color:#9ca3af;font-size:.85rem;padding:2rem;min-height:120px}
.cap{font-size:.72rem;color:#6b7280;padding:.4rem .75rem;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center}
.cap.ok{color:#065f46;background:#ecfdf5}
.exams{padding:2rem;background:#f9fafb}.exams h2{font-size:1.2rem;margin-bottom:1rem}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;padding:.6rem .75rem;background:#1f2435;color:white;font-weight:600}
td{padding:.55rem .75rem;border-bottom:1px solid #e5e7eb;vertical-align:top}
tr:nth-child(even) td{background:#f3f4f6}
.foot{text-align:center;padding:1.5rem;font-size:.72rem;color:#9ca3af;border-top:1px solid #e5e7eb;margin-top:2rem}`;

const today = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export function buildPortfolio() {
  const me = meNow(), uid = me.id, media = getMedia();
  const logs = logsOf(uid), gp = globalProgress(uid), vp = validatedProgress(uid, media);
  const ts = logs.map(l => l.ts).filter(Boolean);
  const periode = ts.length ? new Date(Math.min(...ts)).toLocaleDateString('fr-FR') + ' → ' + new Date(Math.max(...ts)).toLocaleDateString('fr-FR') : 'Aucun examen enregistré';
  const showEtab = !!cfg('echo').etabService;
  const sub = [showEtab ? me.etab : '', showEtab ? me.service : ''].filter(Boolean).join(' — ');
  const curWeek = weekKey(new Date());
  const cover = html`<div class="cover">
    <div style="font-size:3rem;margin-bottom:1.5rem">🩺</div>
    <div class="cover-title">EchoLearn</div>
    <div class="cover-subtitle">Portfolio d'apprentissage en échographie</div>
    <div class="cover-name">${fullName(me)}</div>
    ${sub ? html`<div class="cover-info">${sub}</div>` : ''}
    <div class="cover-info" style="font-size:.82rem">${me.specialite ? me.specialite + ' · ' : ''}${me.rang ? 'Semestre ' + me.rang + ' · ' : ''}${me.sem || ''}</div>
    <div class="cover-info" style="font-size:.82rem;margin-top:.35rem">Période : ${periode}</div>
    <div class="box"><h4>Images validées par un formateur</h4>
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.5rem"><div class="bar" style="flex:1;height:10px"><i style="width:${vp.pct}%;background:linear-gradient(90deg,#6ee7f7,#a78bfa)"></i></div><div style="font-size:1.4rem;font-weight:800;color:#6ee7f7">${vp.pct}%</div></div>
      <div style="font-size:.78rem;color:#8b93b0">${vp.validatedSlots} / ${vp.totalSlots} images validées</div></div>
    <div class="grid3">
      <div><b style="color:#6ee7f7">${logs.length}</b><span>Examens réalisés</span></div>
      <div><b style="color:#a78bfa">${logs.filter(l => l.week === curWeek).length}</b><span>Cette semaine</span></div>
      <div><b style="color:#60a5fa">${gp.maitrise}</b><span>Items maîtrisés</span></div>
    </div>
    <div class="box"><h4>Progression par module (items acquis : Fait ou Maîtrisé)</h4>
      ${MODALITIES.map(m => { const p = progressOf(uid, m.id); return html`<div style="margin-bottom:.6rem"><div style="display:flex;justify-content:space-between;margin-bottom:.25rem"><span style="font-size:.78rem">${m.icon} ${m.name}</span><span style="font-size:.72rem;color:#8b93b0">${p.acquired}/${p.total} — ${p.pct}%</span></div><div class="bar"><i style="width:${p.pct}%;background:${m.accent}"></i></div></div>`; })}
    </div>
    <div style="font-size:.68rem;color:#5a6180;margin-top:1.25rem">Portfolio généré le ${today()}</div>
  </div>`;
  const sections = MODALITIES.map(mod => {
    const p = progressOf(uid, mod.id), blocks = [];
    mod.tabs.forEach(tab => tab.items.forEach(it => {
      const key = mod.id + '.' + it.id, slots = (media[key] || []).map((s, i) => ({ s, i })).filter(x => x.s);
      if (slots.length) blocks.push({ tab, it, key, slots });
    }));
    if (!blocks.length) return '';
    return html`<div class="page-break"></div><div class="module-section">
      <div class="module-header" style="border-color:${mod.accent}"><div style="font-size:2rem">${mod.icon}</div><div class="module-name" style="color:${mod.accent}">${mod.name}</div><div class="module-pct">${p.pct}% — ${p.acquired}/${p.total}</div></div>
      ${blocks.map(({ tab, it, key, slots }) => {
        const st = statusOf(uid, key);
        return html`<div class="item" ${slots.length >= 3 ? html`style="page-break-before:always"` : ''}>
          <div class="item-header"><div class="item-name">${tab.label} — ${it.name}</div><div class="pill s-${st}">${statusLabel(st)}</div></div>
          <div class="item-desc">${it.desc}</div>
          <div class="photos">${slots.map(({ s, i }, n) => {
            const v = slotValidation(uid, key, i, s), cap = html`<div class="cap ${v ? 'ok' : ''}">${it.name} · Image ${n + 1}/${slots.length}${v ? ' · ✓ Validée par ' + (v.par || 'un formateur') + (v.ts ? ', le ' + fmtDate(v.ts) : '') : ' · non validée'}</div>`;
            return isVideo(s)
              ? html`<div class="photo video"><div style="font-size:2rem">▶️</div><div style="font-weight:600">Vidéo ${n + 1}</div><div style="font-size:.72rem">Lecture non disponible en version imprimée</div></div>`
              : html`<div class="photo"><img src="${s.data}" alt="${it.name} — image ${n + 1}">${cap}</div>`;
          })}</div></div>`;
      })}</div>`;
  });
  const table = logs.length ? html`<div class="page-break"></div><div class="exams"><h2>🩺 Examens réalisés (${logs.length} au total)</h2>
    <table><thead><tr><th>Date</th><th>Type d'examen</th><th>Note</th></tr></thead><tbody>
    ${logs.slice().sort((a, b) => a.ts - b.ts).map(l => { const m = modByIdAny(l.type); return html`<tr><td>${l.date}</td><td>${m ? m.icon + ' ' + m.name : l.type}</td><td>${l.note || '—'}</td></tr>`; })}
    </tbody></table></div>` : '';
  return html`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio EchoLearn — ${fullName(me)}</title><style>${CSS}</style></head><body>
    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
    ${cover}${sections}${table}
    <div class="foot">Portfolio généré le ${today()} — EchoLearn</div></body></html>`;
}
// html`` échappe aussi le CSS (les guillemets simples deviendraient &#39;) : on le réinjecte tel quel
export function portfolioHtml() { return buildPortfolio().s.replace(/<style>[\s\S]*?<\/style>/, () => '<style>' + CSS + '</style>'); }

function generate() {
  // La fenêtre doit être ouverte de façon synchrone, avant tout traitement (exigence de Safari sur iPhone)
  const win = window.open('', '_blank');
  if (!win) { toast('Autorise les fenêtres pop-up pour générer le portfolio.'); return; }
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio EchoLearn</title></head><body style="font-family:system-ui,sans-serif;background:#0f1117;color:#8b93b0;display:flex;align-items:center;justify-content:center;min-height:100vh"><p>Génération du portfolio…</p></body></html>');
  try {
    const doc = portfolioHtml();
    win.document.open(); win.document.write(doc); win.document.close();
    toast('Portfolio généré ✓');
  } catch (e) {
    console.error(e);
    win.document.body.textContent = 'Erreur : ' + e.message;
    toast('Erreur lors de la génération');
  }
}
registerActions({ generatePortfolio: generate });
