// Espace formateur (seniors et équipe pédagogique) : tableau de bord, détail d'un interne, validation par QR code
import { S, meNow, isTrainer, interns, userById, cfg, put, del, get, sync, subscribe, echoItems, echoValids } from './store.js';
import { html, setHTML, $, fullName, fmtDateTime, fmtDate, timeAgo, plural, esc } from './util.js';
import { MODALITIES } from './modalities.js';
import { registerActions, registerChanges, showPage, toast, confirmDlg, makeLevel } from './ui.js';
import { modById, modByIdAny, itemsOf, progressOf, globalProgress, logsOf, validatedForTrainer, STATUS_COLOR, statusLabel, acquired } from './data.js';
import { barChart, lastWeeks } from './charts.js';
import { SLOTS } from './media.js';

let filter = { etab: '', service: '' };
let detailUid = null;
const etabOn = () => !!cfg('echo').etabService;
const visible = () => interns().filter(u => (!filter.etab || u.etab === filter.etab) && (!filter.service || u.service === filter.service)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
const ECHO_QR_MS = 15 * 60 * 1000;

/* ---------- Tableau de bord ---------- */
export function renderFormateur() {
  const me = meNow();
  $('#fmtServiceHeader').textContent = me.role === 'equipe' ? 'Équipe pédagogique' : 'Senior';
  renderFilters();
  const list = visible();
  const rows = list.map(u => ({ u, gp: globalProgress(u.id), logs: logsOf(u.id), vp: validatedForTrainer(u.id) }));
  const total = rows.length, totalLogs = rows.reduce((n, r) => n + r.logs.length, 0);
  const avg = total ? Math.round(rows.reduce((n, r) => n + r.gp.pct, 0) / total) : 0;
  setHTML($('#globalFormStats'), html`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:.85rem">
      <div style="text-align:center"><div style="font-size:1.4rem;font-weight:700" id="fmtCount">${total}</div><div style="font-size:.68rem;color:var(--text2)">Internes</div></div>
      <div style="text-align:center"><div style="font-size:1.4rem;font-weight:700">${avg}%</div><div style="font-size:.68rem;color:var(--text2)">Moy. progression</div></div>
      <div style="text-align:center"><div style="font-size:1.4rem;font-weight:700">${totalLogs}</div><div style="font-size:.68rem;color:var(--text2)">Examens logués</div></div>
    </div>
    <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${avg}%;background:linear-gradient(90deg,#6ee7f7,#a78bfa);border-radius:3px"></div></div>
    <div style="font-size:.68rem;color:var(--text3);margin-top:.3rem;text-align:right">${S.lastSync ? 'Dernière synchro : ' + timeAgo(S.lastSync) : ''} <button data-act="fmtRefresh" style="margin-left:.5rem;background:transparent;border:none;color:#6ee7f7;cursor:pointer;font-size:.68rem">↻ Actualiser</button></div>`);
  $('#fmtChartsCard').style.display = 'block';
  const all = rows.flatMap(r => r.logs);
  barChart($('#fmtBarChart'), lastWeeks(all), { height: 130 });
  setHTML($('#fmtModStats'), html`${MODALITIES.map(m => {
    const n = all.filter(l => l.type === m.id).length;
    return html`<div style="background:var(--bg3);border-radius:10px;padding:.55rem .25rem;text-align:center"><div style="font-size:1.1rem">${m.icon}</div><div style="font-size:1.2rem;font-weight:700;color:${m.accent};margin:.15rem 0">${n}</div><div style="font-size:.58rem;color:var(--text2);line-height:1.3">${m.name.split(' ')[0]}</div><div style="font-size:.56rem;color:var(--text3)">${all.length ? Math.round(n / all.length * 100) + '%' : '—'}</div></div>`;
  })}`);
  $('#fmtModStats').style.gridTemplateColumns = 'repeat(auto-fit,minmax(58px,1fr))'; // le nombre de modules est réglé par l'équipe
  const grid = $('#studentGrid');
  grid.style.display = 'flex'; grid.style.flexDirection = 'column'; grid.style.gap = '.4rem';
  if (!rows.length) { setHTML(grid, html`<div style="color:var(--text2);font-size:.83rem;text-align:center;padding:1rem">Aucun interne dans la promotion courante.</div>`); return; }
  setHTML(grid, html`${rows.map(({ u, gp, logs, vp }) => html`<div class="student-list-item" data-act="openStudent" data-uid="${u.id}">
    <div style="flex:1;min-width:0">
      <div style="font-size:.9rem;font-weight:700;color:var(--text1)">👤 ${fullName(u)}</div>
      ${etabOn() && (u.service || u.etab) ? html`<div style="font-size:.72rem;color:var(--text2);margin-top:.1rem">${[u.service, u.etab].filter(Boolean).join(' · ')}</div>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:1rem;flex-shrink:0">
      <div style="text-align:center"><div style="font-size:1.1rem;font-weight:700;color:var(--text1)">${logs.length}</div><div style="font-size:.62rem;color:var(--text3)">actes</div></div>
      <div style="text-align:center"><div style="font-size:1.1rem;font-weight:700;color:var(--text1)">${gp.pct}%</div><div style="font-size:.62rem;color:var(--text3)">acquis</div></div>
      <div style="text-align:center"><div style="font-size:1.1rem;font-weight:700;color:${vp.valid > 0 ? '#4ade80' : 'var(--text3)'}">${vp.pct}%</div><div style="font-size:.62rem;color:var(--text3)">validé</div><div style="font-size:.58rem;color:var(--text3)">${vp.valid}/${vp.total}</div></div>
      <div style="color:var(--text3);font-size:.9rem">›</div>
    </div></div>`)}`);
}
function renderFilters() {
  const box = $('#fmtFilters');
  if (!etabOn()) { box.classList.add('hidden'); return; }
  const base = interns();
  const uniq = k => Array.from(new Set(base.map(u => u[k]).filter(Boolean))).sort();
  const sel = (k, label, list) => html`<select class="fsel" data-change="fmtFilter" data-k="${k}" aria-label="${label}"><option value="">${label} : tous</option>${list.map(v => html`<option value="${v}" ${filter[k] === v ? 'selected' : ''}>${v}</option>`)}</select>`;
  setHTML(box, html`${sel('etab', 'Établissement', uniq('etab'))}${sel('service', 'Service', uniq('service'))}`);
  box.classList.remove('hidden');
}
export const setFilter = (k, v) => { filter[k] = v; if (detailUid) openStudent({ uid: detailUid }); else renderFormateur(); };

/* ---------- Détail d'un interne ---------- */
export function openStudent(d) {
  const u = userById(d.uid);
  if (!u) { toast('Interne introuvable.'); return; }
  detailUid = u.id;
  const uid = u.id, logs = logsOf(uid), gp = globalProgress(uid), vp = validatedForTrainer(uid);
  $('#fdStudentName').textContent = '👤 ' + fullName(u);
  const items = {}; echoItems(uid).forEach(r => (items[r.key] = r));
  const valids = {}; echoValids(uid).forEach(v => (valids[v.key] = valids[v.key] || []).push(v));
  const thisWeek = logs.filter(l => l.week === lastWeeks([], 1)[0].key).length;
  const modules = MODALITIES.map(m => {
    const p = progressOf(uid, m.id);
    return html`<div class="fd-mod-section">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem"><div style="font-size:1.1rem">${m.icon}</div><div style="font-size:.88rem;font-weight:600;color:var(--text1);flex:1">${m.name}</div><div style="font-size:.75rem;color:var(--text2)">${p.pct}% — ${p.acquired}/${p.total}</div></div>
      <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:.6rem"><div style="height:100%;width:${p.pct}%;background:${m.accent};border-radius:2px"></div></div>
      <div class="fd-items" style="display:flex;flex-direction:column;gap:.3rem">${itemsOf(m).map(it => {
        const key = m.id + '.' + it.id, r = items[key] || {}, st = r.statut || 'nonfait', n = Math.min(SLOTS, Number(r.n) || 0), vs = (valids[key] || []).slice().sort((a, b) => a.slot - b.slot);
        return html`<div class="fd-item" style="flex-direction:column;align-items:flex-start;padding:.5rem .65rem">
          <div style="display:flex;align-items:center;gap:.4rem;width:100%"><div class="fd-dot" style="background:${STATUS_COLOR[st]}"></div><div class="fd-name" style="flex:1">${it.name}</div><div style="font-size:.65rem;color:var(--text3)">${statusLabel(st)}</div></div>
          ${n || vs.length ? html`<div class="val-list">${n} image${n > 1 ? 's' : ''} · ${vs.length} validée${vs.length > 1 ? 's' : ''}${vs.length ? ' — ' + Array.from(new Set(vs.map(v => v.parNom))).join(', ') + ', ' + fmtDate(Math.max(...vs.map(v => v.ts))) : ''}</div>` : ''}
          ${st === 'maitrise' ? html`<div class="fd-actions"><button class="btn-mini" data-act="removeMaitrise" data-uid="${uid}" data-key="${key}">Retirer la maîtrise</button></div>` : ''}
        </div>`;
      })}</div>
    </div>`;
  });
  const recent = logs.slice(0, 8);
  setHTML($('#fdContent'), html`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem">
      ${etabOn() && (u.etab || u.service) ? html`<div style="font-size:.72rem;color:var(--text2);margin-bottom:.7rem">${[u.service, u.etab].filter(Boolean).join(' · ')}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:1rem">
        <div style="background:var(--bg3);border-radius:10px;padding:.6rem .4rem;text-align:center"><div style="font-size:1.3rem;font-weight:700">${logs.length}</div><div style="font-size:.62rem;color:var(--text2)">Total actes</div></div>
        <div style="background:var(--bg3);border-radius:10px;padding:.6rem .4rem;text-align:center"><div style="font-size:1.3rem;font-weight:700;color:#6ee7f7">${thisWeek}</div><div style="font-size:.62rem;color:var(--text2)">Cette semaine</div></div>
        <div style="background:var(--bg3);border-radius:10px;padding:.6rem .4rem;text-align:center"><div style="font-size:1.3rem;font-weight:700;color:#4ade80">${gp.pct}%</div><div style="font-size:.62rem;color:var(--text2)">Items acquis</div></div>
        <div style="background:var(--bg3);border-radius:10px;padding:.6rem .4rem;text-align:center"><div style="font-size:1.3rem;font-weight:700;color:#fb923c">${gp.maitrise}</div><div style="font-size:.62rem;color:var(--text2)">Maîtrisés</div></div>
      </div>
      <div style="font-size:.72rem;color:var(--text2);margin-bottom:.5rem">📅 Actes par semaine (toutes échographies)</div>
      <div style="height:110px;position:relative"><canvas id="studentBarChart"></canvas></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(54px,1fr));gap:.3rem;margin-top:.75rem">${MODALITIES.map(m => html`<div style="text-align:center;background:var(--bg3);border-radius:8px;padding:.4rem .25rem"><div style="font-size:.9rem">${m.icon}</div><div style="font-size:.85rem;font-weight:700;color:${m.accent}">${logs.filter(l => l.type === m.id).length}</div><div style="font-size:.55rem;color:var(--text3);line-height:1.2;margin-top:.1rem">${m.name.split(' ')[0]}</div></div>`)}</div>
      <div style="font-size:.68rem;color:var(--text3);margin-top:.7rem">Les images restent sur le téléphone de l'interne. La validation se fait en sa présence, en scannant son QR code. ${vp.total ? vp.valid + '/' + vp.total + ' images validées.' : ''}</div>
    </div>
    ${recent.length ? html`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:.9rem 1rem;margin-bottom:1rem"><div class="card-title">🩺 Derniers examens</div>${recent.map(l => { const m = modByIdAny(l.type) || { icon: '📋', name: l.type, accent: '#888' }; return html`<div class="exam-item" style="margin-bottom:.35rem"><div class="exam-dot" style="background:${m.accent}"></div><div class="exam-info"><div class="exam-type">${m.icon} ${m.name}</div>${l.note ? html`<div class="exam-note-text" style="white-space:normal">${l.note}</div>` : ''}</div><div class="exam-date">${l.date}</div></div>`; })}</div>` : ''}
    ${modules}`);
  $('#fmtOverview').style.display = 'none';
  $('#fmtDetail').style.display = 'block';
  detailLevel.open();
  setTimeout(() => barChart($('#studentBarChart'), lastWeeks(logs), { height: 110, bw: 18 }), 50);
}
/** Le détail d'un interne a sa propre entrée d'historique : Retour du téléphone = retour au tableau de bord */
const detailLevel = makeLevel('view', () => { detailUid = null; $('#fmtOverview').style.display = ''; $('#fmtDetail').style.display = 'none'; renderFormateur(); });
export function showOverview() { detailLevel.close(); }
export const inDetail = () => !!detailUid && $('#fmtDetail').style.display === 'block';
export function refreshFormateur() {
  if (!$('#formateurPage').classList.contains('active')) return;
  if (inDetail()) openStudent({ uid: detailUid }); else renderFormateur();
}

async function removeMaitrise(d) {
  const u = userById(d.uid);
  const ok = await confirmDlg({ title: 'Retirer la maîtrise ?', text: 'L’item repasse à « Fait » et les validations de ses images sont effacées. L’interne devra les faire valider de nouveau.', ok: 'Retirer', danger: true });
  if (!ok) return;
  const r = get('echo_items', d.uid + '_' + d.key);
  put('echo_items', { id: d.uid + '_' + d.key, uid: d.uid, key: d.key, statut: 'fait', n: r ? r.n : 0 });
  echoValids(d.uid).filter(v => v.key === d.key).forEach(v => del('echo_valid', v.id));
  toast('Maîtrise retirée' + (u ? ' pour ' + fullName(u) : ''));
  refreshFormateur();
}

/* ---------- Validation par QR code ---------- */
export function parseValidationHash(h) {
  const m = /^#\/v\/([A-Za-z0-9]{6,40})\/([A-Za-z0-9_-]{1,24}\.[A-Za-z0-9_-]{1,40})\/(\d{1,2})\/([01])\/(\d{10,14})$/.exec(h || '');
  if (!m) return null;
  const mask = Number(m[3]);
  if (!(mask >= 1 && mask < (1 << SLOTS))) return null;
  return { uid: m[1], key: m[2], mask, full: m[4] === '1', ts: Number(m[5]) };
}
const slotsFromMask = mask => [0, 1, 2, 3, 4].filter(i => mask & (1 << i));
function vBody(inner) { setHTML($('#validateBody'), inner); }
let validateLoading = false;
/** Vrai tant que la page de validation attend le premier chargement des données (formateur qui vient de se connecter) */
export const validateNeedsRefresh = () => validateLoading;
export function renderValidate(p) {
  showPage('validatePage');
  validateLoading = false;
  if (!isTrainer()) { vBody(html`<div style="font-size:2rem;margin-bottom:.75rem">📋</div><div style="font-size:1rem;font-weight:700;margin-bottom:.5rem">Validation réservée aux formateurs</div><div style="font-size:.82rem;color:var(--text2);margin-bottom:1.25rem;line-height:1.6">Ce QR code doit être scanné par un senior ou un membre de l'équipe pédagogique, connecté avec son propre compte.</div><button class="btn-ghost" data-act="validateDone">Retour</button>`); return; }
  if (!S.db || !S.db.since) { // première synchronisation pas encore faite : on attend les données avant de conclure que l'interne est inconnu
    validateLoading = true;
    vBody(html`<div class="spinner" style="margin:0 auto 1rem"></div><div style="font-size:.9rem;font-weight:600;margin-bottom:.4rem">Chargement des données…</div><div style="font-size:.78rem;color:var(--text2)">La validation s'affichera dans un instant.</div>`);
    return;
  }
  const u = userById(p.uid), mod = modByIdAny(p.key.split('.')[0]), it = mod && itemsOf(mod).find(x => x.id === p.key.split('.')[1]);
  const expired = Date.now() - p.ts > ECHO_QR_MS || p.ts > Date.now() + 120000;
  if (!u || !it) {
    vBody(html`<div style="font-size:2rem;margin-bottom:.75rem">⚠️</div><div style="font-size:1rem;font-weight:700;margin-bottom:.5rem">QR code non reconnu</div><div style="font-size:.82rem;color:var(--text2);margin-bottom:1.25rem;line-height:1.6">${!u ? 'Cet interne ne fait pas partie de la promotion courante (ou ses données ne sont pas encore chargées).' : 'Cet item n\'existe pas.'}</div><button class="btn-save" style="width:100%;margin-bottom:.5rem" data-act="validateReload">Actualiser</button><button class="btn-ghost" data-act="validateDone">Retour</button>`);
    return;
  }
  const slots = slotsFromMask(p.mask);
  vBody(html`
    <div style="font-size:2rem;margin-bottom:.75rem">📋</div>
    <div style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem" id="validateTitle">Validation échographie</div>
    <div style="font-size:.85rem;color:var(--text2);margin-bottom:.5rem" id="validateStudent">Interne : ${fullName(u)}</div>
    <div class="validate-line" id="validateItem">${mod.icon} ${mod.name} — ${it.name}<br><span style="font-weight:400;color:var(--text2)">${slots.length} image${slots.length > 1 ? 's' : ''} (n°${slots.map(i => i + 1).join(', ')})</span></div>
    ${p.full ? html`<div class="validate-ok" style="margin-bottom:.9rem">Cet item passera en « Maîtrisé » : toutes ses images seront validées.</div>` : ''}
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:1rem;line-height:1.55">Confirmes-tu avoir examiné ${slots.length > 1 ? 'ces images' : 'cette image'} <b>en présence de l'interne</b>, sur son téléphone ?</div>
    ${expired ? html`<div class="err" id="validateError">QR code expiré (valable 15 minutes). Demande à l'interne d'en afficher un nouveau.</div>` : html`<input type="text" id="validateComment" maxlength="300" placeholder="Commentaire (facultatif)" style="width:100%;padding:.6rem .8rem;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text1);font-size:.85rem;margin-bottom:.7rem;outline:none"><div class="err" id="validateError"></div>`}
    <button class="btn-primary" id="validateBtn" data-act="submitValidation" ${expired ? 'disabled' : ''} style="margin-bottom:.5rem">✓ Valider</button>
    <button class="btn-ghost" data-act="rejectValidation">✗ Refuser</button>
    <div id="validateSuccess" class="hidden" style="margin-top:1rem"></div>`);
  validating = p;
}
let validating = null;
async function submitValidation() {
  const p = validating; if (!p) return;
  const me = meNow(), btn = $('#validateBtn'), errBox = $('#validateError');
  btn.disabled = true; errBox.textContent = '';
  const comment = ($('#validateComment') ? $('#validateComment').value : '').trim().slice(0, 300);
  const errs = [];
  const off = subscribe((k, payload) => { if (k === 'opError') errs.push(payload); });
  slotsFromMask(p.mask).forEach(i => put('echo_valid', { id: p.uid + '_' + p.key + '_' + i, uid: p.uid, key: p.key, slot: i, qts: p.ts, maitrise: p.full ? true : undefined, commentaire: comment, par: me.id, parNom: fullName(me), ts: Date.now() }));
  await sync();
  off();
  if (errs.length) { errBox.textContent = errs[0]; btn.disabled = false; return; }
  const pending = S.db.ops.length > 0;
  $('#validateBtn').classList.add('hidden');
  document.querySelector('[data-act="rejectValidation"]').classList.add('hidden');
  const ok = $('#validateSuccess'); ok.classList.remove('hidden');
  setHTML(ok, pending
    ? html`<div style="font-size:2rem">🕒</div><div style="font-size:.9rem;font-weight:700;color:#fb923c;margin-top:.5rem">Validation enregistrée sur ce téléphone</div><div class="validate-ok" style="color:var(--text2);margin-top:.35rem">Pas de connexion : elle sera envoyée dès que le réseau revient (le QR code reste valable 15 minutes).</div><button class="btn-ghost" style="margin-top:1rem" data-act="validateDone">Terminer</button>`
    : html`<div style="font-size:2rem">✅</div><div style="font-size:.9rem;font-weight:700;color:#4ade80;margin-top:.5rem">Validation enregistrée !</div><div class="validate-ok" style="color:var(--text2);margin-top:.35rem">L'interne verra la coche verte sur son téléphone.</div><button class="btn-save" style="width:100%;margin-top:1rem" data-act="validateDone">Terminer</button>`);
  validating = null;
}
function validateDone() {
  validating = null;
  history.replaceState(history.state, '', location.pathname + location.search);
  document.dispatchEvent(new CustomEvent('echo:route'));
}

registerChanges({ fmtFilter: (d, el) => setFilter(d.k, el.value) });
registerActions({
  openStudent, showFmtOverview: showOverview, removeMaitrise,
  fmtRefresh: async () => { await sync({ force: true }); refreshFormateur(); toast('Données actualisées'); },
  submitValidation, validateDone,
  rejectValidation: () => { const e = $('#validateError'); if (e) e.textContent = 'Validation refusée. Informe l\'interne.'; },
  validateReload: async () => { await sync({ force: true }); document.dispatchEvent(new CustomEvent('echo:route')); }
});
