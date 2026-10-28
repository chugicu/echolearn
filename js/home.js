// Accueil de l'étudiant : progression, examens, modules, graphiques, classement anonyme
import { S, meNow, isReadOnly, rank, addExam, sync } from './store.js';
import { html, setHTML, $, $$, plural, firstName, cap, weekLabel, weekKey } from './util.js';
import { MODALITIES, ALL_MODULES } from './modalities.js';
import { registerActions, showPage, toast } from './ui.js';
import { modById, modByIdAny, progressOf, globalProgress, logsOf, weekCount, validatedProgress, rankLabel } from './data.js';
import { getMedia, openMod, refreshModule } from './module.js';
import { barChart, lineChart, lastWeeks } from './charts.js';

export function renderHome() {
  const me = meNow(), uid = me.id;
  const logs = logsOf(uid), vp = validatedProgress(uid, getMedia()), gp = globalProgress(uid);
  $('#navFirstName').textContent = cap(firstName(me));
  $('#globalBar').style.width = gp.pct + '%';
  setHTML($('#globalPct'), html`<span style="font-weight:600;color:var(--text1)">${gp.pct}%</span> <span style="color:var(--text2)">des items acquis</span> <span style="color:var(--text3);margin-left:.25rem">(${gp.acquired}/${gp.total} · ${gp.maitrise} maîtrisé${gp.maitrise > 1 ? 's' : ''})</span>`);
  const thisW = weekCount(logs, 0), lastW = weekCount(logs, 1), delta = thisW - lastW;
  const deltaHtml = (lastW === 0 && delta === 0) ? '' : delta > 0 ? html`<span style="color:#4ade80;font-size:.68rem;font-weight:600">▲ +${delta} vs sem. préc.</span>` : delta < 0 ? html`<span style="color:#f87171;font-size:.68rem;font-weight:600">▼ ${delta} vs sem. préc.</span>` : html`<span style="color:var(--text3);font-size:.68rem">= sem. préc. (${lastW})</span>`;
  setHTML($('#statsRow'), html`
    <div class="stat-card"><div class="stat-num">${logs.length}</div><div class="stat-label">Total examens</div></div>
    <div class="stat-card" id="weekStatCard"><div class="stat-num">${thisW}</div><div class="stat-label">Cette semaine</div><div id="weekDelta" style="min-height:.85rem;margin-top:.2rem">${deltaHtml}</div></div>
    <div class="stat-card"><div class="stat-num">${vp.validatedSlots}/${vp.totalSlots}</div><div class="stat-label">Images validées</div></div>`);
  setHTML($('#modGrid'), html`${MODALITIES.map(m => {
    const p = progressOf(uid, m.id);
    return html`<div class="mod-card" data-act="openMod" data-id="${m.id}">
      <div class="mod-icon">${m.icon}</div><div class="mod-name">${m.name}</div>
      <div class="prog-bar-wrap"><div class="prog-bar" style="width:${p.pct}%;background:${m.accent}"></div></div>
      <div class="prog-pct">${p.pct}% — ${p.acquired}/${p.total}</div>
    </div>`;
  })}`);
  const sel = $('#quickType'), selSig = MODALITIES.map(m => m.id + m.name + m.icon).join('|');
  if (sel.dataset.sig !== selSig) { // reconstruit la liste quand l'équipe ajoute, masque ou renomme un module
    const keep = sel.value;
    setHTML(sel, html`<option value="">Type d'examen...</option>${MODALITIES.map(m => html`<option value="${m.id}">${m.icon} ${m.name}</option>`)}`);
    sel.dataset.sig = selSig; if (keep && MODALITIES.some(m => m.id === keep)) sel.value = keep;
  }
  $('.exam-add').style.display = isReadOnly() ? 'none' : '';
  renderExamList(logs);
  barChart($('#barChart'), lastWeeks(logs), { height: 140 });
  lineChart($('#lineChart'), logs);
  renderRank();
  const cl = $('#carnetLink');
  if (cl) { const u = carnetUrl(); cl.classList.toggle('hidden', !u); if (u) cl.href = u; }
}
let CARNET = '';
export function setCarnetUrl(u) { CARNET = u || ''; }
export function carnetUrl() { return CARNET; }

/* ---------- Examens ---------- */
function examInner(l, full) {
  const m = modByIdAny(l.type) || { accent: '#888', icon: '📋', name: l.type };
  return html`<div class="exam-dot" style="background:${m.accent}"></div><div class="exam-info"><div class="exam-type">${m.icon} ${m.name}</div>${l.note ? html`<div class="exam-note-text" ${full ? html`style="white-space:normal"` : ''}>${l.note}</div>` : ''}</div><div class="exam-date">${l.date}</div>`;
}
const examRow = l => html`<div class="exam-item">${examInner(l, false)}</div>`;
function renderExamList(logs) {
  const list = $('#examList'), more = $('#seeAllBtn');
  if (!logs.length) { setHTML(list, html`<div style="color:var(--text3);font-size:.78rem;padding:.3rem 0">Aucun examen enregistré.</div>`); more.style.display = 'none'; return; }
  setHTML(list, html`${logs.slice(0, 3).map(examRow)}`);
  if (logs.length > 3) { more.style.display = 'block'; more.textContent = 'Afficher tout (' + logs.length + ' examens) →'; } else more.style.display = 'none';
}
function quickAddExam() {
  if (isReadOnly()) { toast('Semestre archivé : lecture seule.'); return; }
  const type = $('#quickType').value, note = $('#quickNote').value.trim();
  if (!type) { toast('Choisissez un type d\'examen'); return; }
  if (!modById(type)) { toast('Ce type d\'examen n\'est plus proposé.'); renderHome(); return; }
  const me = meNow();
  addExam(me.id, me.sem, modById(type).name, note);
  $('#quickType').value = ''; $('#quickNote').value = '';
  toast('Examen enregistré !');
}

/* ---------- Tous les examens ---------- */
let logFilter = 'all';
function showAllLogs() {
  const f = $('#allLogsFilters');
  const mine = logsOf(meNow().id), shown = ALL_MODULES.filter(m => MODALITIES.some(v => v.id === m.id) || mine.some(l => l.type === m.id)); // un module masqué reste filtrable tant qu'il a des examens
  setHTML(f, html`<button class="filter-btn active" data-act="filterLogs" data-f="all">Tous</button>${shown.map(m => html`<button class="filter-btn" data-act="filterLogs" data-f="${m.id}">${m.icon} ${m.name.split(' ')[0]}</button>`)}`);
  logFilter = 'all';
  showPage('allLogsPage');
  renderAllLogs();
}
export const inAllLogs = () => $('#allLogsPage').classList.contains('active');
export function renderAllLogs() {
  const all = logsOf(meNow().id);
  const filtered = logFilter === 'all' ? all : all.filter(l => l.type === logFilter);
  $('#allLogsCount').textContent = filtered.length + ' examen' + (filtered.length > 1 ? 's' : '');
  const list = $('#allLogsFullList');
  if (!filtered.length) { setHTML(list, html`<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.82rem">Aucun examen pour cette modalité.</div>`); return; }
  const byWeek = {};
  filtered.forEach(l => (byWeek[l.week] = byWeek[l.week] || []).push(l));
  const cur = weekKey(new Date());
  setHTML(list, html`${Object.keys(byWeek).sort((a, b) => b.localeCompare(a)).map(wk => html`<div style="margin-bottom:1.25rem">
    <div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between"><span>${wk === cur ? 'Cette semaine' : 'Semaine du ' + weekLabel(wk)}</span><span>${byWeek[wk].length} acte${byWeek[wk].length > 1 ? 's' : ''}</span></div>
    ${byWeek[wk].map(l => html`<div class="exam-item" style="margin-bottom:.35rem;background:var(--bg2);border:1px solid var(--border)">${examInner(l, true)}</div>`)}
  </div>`)}`);
}
/* ---------- Classement anonyme (calculé par le serveur) ---------- */
export function renderRank() {
  const el = $('#compareContent'), r = rank();
  if (!r) { setHTML(el, html`<div class="rank-lock">Classement indisponible pour le moment.<br>Il apparaît après la première synchronisation.</div>`); return; }
  if (r.hidden) { setHTML(el, html`<div class="rank-lock">🔒 Le classement anonyme apparaît à partir de 3 internes dans la promotion.<br><span style="color:var(--text3);font-size:.72rem">Promotion actuelle : ${r.n} interne${r.n > 1 ? 's' : ''}.</span></div>`); return; }
  const delta = (v, a) => { const d = v - a; return d > 0 ? html`<span class="cmp-delta delta-pos">+${d}</span>` : d < 0 ? html`<span class="cmp-delta delta-neg">${d}</span>` : html`<span class="cmp-delta delta-neu">=</span>`; };
  const tot = rankLabel(r.tot.top, r.n, r.tot.me), acq = rankLabel(r.acq.top, r.n, r.acq.me);
  const all = MODALITIES.reduce((n, m) => n + m.tabs.reduce((k, t) => k + t.items.length, 0), 0);
  setHTML(el, html`
    <div style="font-size:.65rem;color:var(--text3);text-align:right;margin-bottom:.65rem">${r.n} internes dans la promotion · <span style="color:#6ee7f7;cursor:pointer" data-act="refreshRank">↻ Actualiser</span></div>
    <div class="compare-grid">
      <div class="cmp-card"><div class="cmp-label">Examens (7 derniers jours)</div><div class="cmp-row"><div class="cmp-val">${r.wk.me}</div>${delta(r.wk.me, r.wk.avg)}</div><div class="cmp-avg">Moy. promotion : ${r.wk.avg}</div></div>
      <div class="cmp-card"><div class="cmp-label">Total cumulé</div><div class="cmp-row"><div class="cmp-val">${r.tot.me}</div>${delta(r.tot.me, r.tot.avg)}</div><div class="cmp-avg">Moy. promotion : ${r.tot.avg}</div></div>
      <div class="cmp-card"><div class="cmp-label">Items acquis</div><div class="cmp-row"><div class="cmp-val">${r.acq.me}</div>${delta(r.acq.me, r.acq.avg)}</div><div class="cmp-avg">Moy. promotion : ${r.acq.avg} / ${all}</div></div>
      <div class="cmp-card" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.3rem">
        <div style="font-size:1.6rem">${tot.icon}</div><div style="font-size:.72rem;color:var(--text2);font-weight:600">${tot.label}</div><div style="font-size:.62rem;color:var(--text3)">examens réalisés</div>
      </div>
    </div>
    <div class="percentile-badge" style="margin-top:.65rem">
      <div style="font-size:.75rem;color:var(--text2);margin-bottom:.5rem">Votre classement dans la promotion</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div style="text-align:center"><div class="pct-value">${tot.label}</div><div style="font-size:.68rem;color:var(--text3);margin-top:.2rem">Nombre d'examens</div></div>
        <div style="text-align:center"><div class="pct-value" style="font-size:1.3rem">${acq.label}</div><div style="font-size:.68rem;color:var(--text3);margin-top:.2rem">Items acquis</div></div>
      </div>
      <div style="font-size:.65rem;color:var(--text3);margin-top:.65rem;border-top:1px solid var(--border);padding-top:.5rem">🔒 Classement anonyme — aucun détail individuel n'est visible</div>
    </div>`);
}

registerActions({
  openMod: d => openMod(d.id),
  quickAddExam, showAllLogs,
  goHome: () => { showPage('homePage'); renderHome(); },
  filterLogs: (d, el) => { logFilter = d.f; $$('.filter-btn').forEach(b => b.classList.remove('active')); el.classList.add('active'); renderAllLogs(); },
  refreshRank: async () => { await sync({ force: true }); renderRank(); toast('Classement actualisé'); }
});
export { refreshModule };
