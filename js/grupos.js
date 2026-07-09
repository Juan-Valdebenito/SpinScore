/* ═══════════════════════════════════════════
   SpinScore v1.4 — grupos.js
   Fase de grupos: setup, sorteo, partidos,
   ingreso de resultados manual (ITTF)
═══════════════════════════════════════════ */

const GROUP_COLORS = ['#4FC3F7','#F5C518','#E63946','#22C55E','#A78BFA','#FB923C','#F472B6','#34D399'];
const GROUP_NAMES  = ['A','B','C','D','E','F','G','H'];

const GT = {
  name: '',
  numGroups: 4,
  players: [],
  groups: [],          // [[playerIdx, ...], ...]
  confirmed: false,
  phase: 'groups',     // 'groups' | 'elimination'
  currentGroupTab: 0,
  groupMatches: [],    // { groupIdx, p1, p2, sets1, sets2, setScores, done }
  elimRounds: [],
};

// ── SETUP DE GRUPOS ───────────────────────
function selectGroups(n) {
  GT.numGroups = n;
  document.querySelectorAll('#chips-groups .chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === n));
  document.getElementById('gp-max').textContent = n * 4;
  _updateGPInfo();
}

function addGPlayer() {
  const input = document.getElementById('gp-input');
  const name  = input.value.trim();
  if (!name) return;
  const max = GT.numGroups * 4;
  if (GT.players.length >= max) { showToast(`Maximo ${max} jugadores`); return; }
  if (GT.players.includes(name)) { showToast('Jugador ya existe'); return; }
  GT.players.push(name);
  input.value = '';
  input.focus();
  renderGPList();
}

function removeGPlayer(i) { GT.players.splice(i, 1); renderGPList(); }

function renderGPList() {
  const n = GT.players.length;
  document.getElementById('gp-count').textContent = n;
  document.getElementById('gp-list').innerHTML =
    GT.players.map((p, i) => `
      <div class="player-item">
        <div class="player-badge">${i + 1}</div>
        <span style="flex:1;font-size:15px;">${p}</span>
        <button class="btn-remove" onclick="removeGPlayer(${i})">×</button>
      </div>`).join('');
  _updateGPInfo();
  document.getElementById('btn-sortear').disabled = n < 2;
}

function _updateGPInfo() {
  const n    = GT.players.length;
  const info = document.getElementById('gp-info');
  if (n >= 2) {
    info.classList.remove('d-none');
    info.textContent   = `${n} jugadores en ${GT.numGroups} grupos (~${Math.ceil(n / GT.numGroups)} por grupo)`;
  } else {
    info.classList.add('d-none');
  }
}

// ── SORTEO ────────────────────────────────
function sortearGrupos() {
  const players = [...GT.players];
  // Fisher-Yates shuffle
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  GT.groups = Array.from({ length: GT.numGroups }, () => []);
  players.forEach((p, i) => GT.groups[i % GT.numGroups].push(GT.players.indexOf(p)));
  _renderGroupsPreview();
  goTo('screen-groups-preview');
}

function _renderGroupsPreview() {
  let html = '';
  GT.groups.forEach((group, gi) => {
    const color = GROUP_COLORS[gi];
    html += `<div class="group-card">
      <div class="group-header">
        <div class="group-badge" style="background:${color};">G${GROUP_NAMES[gi]}</div>
        <span>Grupo ${GROUP_NAMES[gi]}</span>
      </div>`;
    group.forEach((pi, pos) => {
      html += `<div class="group-player">
        <div class="group-player-num">${pos + 1}</div>
        <div class="group-player-name">${GT.players[pi]}</div>
      </div>`;
    });
    html += `</div>`;
  });
  document.getElementById('groups-preview-content').innerHTML = html;
}

function confirmarGrupos() {
  GT.name      = document.getElementById('gt-name').value.trim() || 'Torneo';
  GT.confirmed = true;
  GT.phase     = 'groups';
  GT.currentGroupTab = 0;
  GT.groupMatches = [];
  GT.groups.forEach((group, gi) => {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        GT.groupMatches.push({
          groupIdx: gi, p1: group[i], p2: group[j],
          sets1: 0, sets2: 0, setScores: [], done: false,
        });
  });
  renderGroupsMain();
  goTo('screen-groups-main');
}

// ── RENDER PANTALLA PRINCIPAL GRUPOS ─────
function renderGroupsMain() {
  document.getElementById('gt-header-name').textContent  = GT.name;
  document.getElementById('gt-phase-label').textContent  = 'Fase de Grupos';

  const tabsEl = document.getElementById('groups-tabs');
  let tabsHtml = '';
  GT.groups.forEach((_, gi) => {
    tabsHtml += `<button class="tab${gi === GT.currentGroupTab ? ' active' : ''}"
      onclick="switchGroupTab(${gi})">Grupo ${GROUP_NAMES[gi]}</button>`;
  });
  tabsHtml += `<button class="tab${GT.currentGroupTab === GT.groups.length ? ' active' : ''}"
    onclick="switchGroupTab(${GT.groups.length})">General</button>`;
  tabsEl.innerHTML = tabsHtml;

  renderGroupTabContent();
}

function switchGroupTab(idx) {
  GT.currentGroupTab = idx;
  document.querySelectorAll('#groups-tabs .tab').forEach((t, i) =>
    t.classList.toggle('active', i === idx));
  renderGroupTabContent();
}

function renderGroupTabContent() {
  const content = document.getElementById('groups-main-content');
  GT.currentGroupTab === GT.groups.length
    ? _renderGeneralTab(content)
    : _renderSingleGroupTab(content, GT.currentGroupTab);
}

// ── TAB DE GRUPO INDIVIDUAL ───────────────
function _renderSingleGroupTab(content, idx) {
  const color     = GROUP_COLORS[idx];
  const matches   = GT.groupMatches.filter(m => m.groupIdx === idx);
  const stats     = calcGroupStats(idx);
  const allDone   = matches.every(m => m.done);
  const isDesktop = window.innerWidth >= 768;

  // Tabla de posiciones
  let html = `<div class="group-card">
    <div class="group-header">
      <div class="group-badge" style="background:${color};">G${GROUP_NAMES[idx]}</div>
      <span>Grupo ${GROUP_NAMES[idx]}</span>
      ${allDone ? `<span style="margin-left:auto;font-size:11px;color:var(--win);font-weight:600;">Completo</span>` : ''}
    </div>
    <div style="display:flex;font-size:10px;color:var(--muted);font-weight:700;
      padding:6px 16px;letter-spacing:.5px;border-bottom:1px solid var(--border);">
      <div style="width:24px;">#</div>
      <div style="flex:1;">JUGADOR</div>
      <div style="width:32px;text-align:center;">PTS</div>
      <div style="width:26px;text-align:center;">G</div>
      <div style="width:26px;text-align:center;">P</div>
      <div style="width:40px;text-align:center;">SETS</div>
    </div>`;

  stats.forEach((s, rank) => {
    const passing = rank < 2 && allDone;
    html += `<div class="group-player" style="${passing ? 'background:rgba(34,197,94,.07);' : ''}">
      <div class="group-player-num" style="color:${passing ? 'var(--win)' : 'var(--muted)'};">
        ${rank + 1}${passing ? '*' : ''}
      </div>
      <div class="group-player-name" style="font-weight:${rank < 2 ? 600 : 400};">${GT.players[s.idx]}</div>
      <div class="group-player-stats">
        <span><span class="stat-val">${s.pts}</span></span>
        <span><span class="stat-val g">${s.won}</span></span>
        <span><span class="stat-val p">${s.lost}</span></span>
        <span><span class="stat-val">${s.setW}-${s.setL}</span></span>
      </div>
    </div>`;
  });
  html += `</div>`;

  // Partidos
  html += `<div class="section-label" style="margin-top:4px;">Partidos</div>`;
  if (isDesktop) html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;

  matches.forEach(m => {
    const realIdx  = GT.groupMatches.indexOf(m);
    const p1name   = GT.players[m.p1];
    const p2name   = GT.players[m.p2];
    if (m.done) {
      const w      = m.sets1 > m.sets2 ? 'p1' : 'p2';
      const detail = m.setScores.map(([a, b]) => `${a}-${b}`).join(' | ');
      html += `<div class="match-row done" style="flex-direction:column;align-items:stretch;gap:4px;">
        <div style="display:flex;align-items:center;">
          <div style="flex:1;color:${w==='p1'?'var(--win)':'var(--muted)'};font-weight:${w==='p1'?700:400};font-size:14px;">${p1name}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="orb" style="color:var(--blue);font-size:16px;">${m.sets1}</span>
            <span style="color:var(--muted);">–</span>
            <span class="orb" style="color:var(--red);font-size:16px;">${m.sets2}</span>
          </div>
          <div style="flex:1;text-align:right;color:${w==='p2'?'var(--win)':'var(--muted)'};font-weight:${w==='p2'?700:400};font-size:14px;">${p2name}</div>
        </div>
        ${detail ? `<div style="font-size:11px;color:var(--border);text-align:center;">${detail}</div>` : ''}
      </div>`;
    } else {
      html += `<div class="match-row" onclick="abrirResultado(${realIdx},'group')">
        <div style="flex:1;text-align:left;color:var(--blue);font-weight:700;font-size:14px;">${p1name}</div>
        <div class="match-vs">VS</div>
        <div style="flex:1;text-align:right;color:var(--red);font-weight:700;font-size:14px;">${p2name}</div>
        <div style="margin-left:10px;color:var(--accent);font-size:18px;">+</div>
      </div>`;
    }
  });

  if (isDesktop) html += `</div>`;

  if (allDone) {
    const top2 = stats.slice(0, 2).map(s => GT.players[s.idx]);
    html += `<div class="advance-banner" style="margin-top:8px;">
      Clasifican: <b>${top2.join(' y ')}</b>
    </div>`;
  }
  content.innerHTML = html;
}

// ── TAB GENERAL ───────────────────────────
function _renderGeneralTab(content) {
  const allGroupsDone = GT.groups.every((_, gi) =>
    GT.groupMatches.filter(x => x.groupIdx === gi).every(x => x.done));
  const isDesktop = window.innerWidth >= 768;
  let html = '';

  if (isDesktop)
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">`;

  GT.groups.forEach((_, gi) => {
    const color = GROUP_COLORS[gi];
    const stats = calcGroupStats(gi);
    const done  = GT.groupMatches.filter(m => m.groupIdx === gi).every(m => m.done);
    html += `<div class="group-card">
      <div class="group-header">
        <div class="group-badge" style="background:${color};">G${GROUP_NAMES[gi]}</div>
        <span>Grupo ${GROUP_NAMES[gi]}</span>
        ${done ? `<span style="margin-left:auto;font-size:11px;color:var(--win);font-weight:600;">Listo</span>` : ''}
      </div>`;
    stats.forEach((s, rank) => {
      html += `<div class="group-player" style="${rank < 2 && done ? 'background:rgba(34,197,94,.07);' : ''}">
        <div class="group-player-num" style="color:${rank < 2 && done ? 'var(--win)' : 'var(--muted)'};">
          ${rank + 1}${rank < 2 && done ? '*' : ''}
        </div>
        <div class="group-player-name" style="font-weight:${rank < 2 ? 600 : 400};font-size:13px;">${GT.players[s.idx]}</div>
        <div class="group-player-stats">
          <span><span class="stat-val g">${s.won}</span>G</span>
          <span><span class="stat-val p">${s.lost}</span>P</span>
          <span><span class="stat-val">${s.pts}</span>pts</span>
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  if (isDesktop) html += `</div>`;

  if (allGroupsDone && GT.phase === 'groups') {
    html += `<div style="margin-top:16px;">
      <button class="btn-primary" onclick="iniciarEliminacion()">Iniciar Fase Eliminatoria</button>
    </div>`;
  } else if (GT.phase === 'elimination') {
    html += `<div style="margin-top:16px;">
      <button class="btn-primary" onclick="goTo('screen-elimination')">Ver Cuadro Eliminatorio</button>
    </div>`;
  }
  content.innerHTML = html;
}

// ── ESTADÍSTICAS DE GRUPO ─────────────────
function calcGroupStats(gi) {
  const group = GT.groups[gi];
  const st    = group.map(pi => ({
    idx: pi, pts: 0, won: 0, lost: 0, setW: 0, setL: 0, ptW: 0, ptL: 0,
  }));
  GT.groupMatches.filter(m => m.groupIdx === gi && m.done).forEach(m => {
    const s1 = st.find(x => x.idx === m.p1);
    const s2 = st.find(x => x.idx === m.p2);
    if (!s1 || !s2) return;
    s1.setW += m.sets1; s1.setL += m.sets2;
    s2.setW += m.sets2; s2.setL += m.sets1;
    m.setScores.forEach(([a, b]) => {
      s1.ptW += a; s1.ptL += b; s2.ptW += b; s2.ptL += a;
    });
    const w = m.sets1 > m.sets2 ? s1 : s2;
    const l = w === s1 ? s2 : s1;
    w.pts += 2; w.won++; l.lost++;
  });
  return st.sort((a, b) =>
    b.pts - a.pts ||
    (b.setW - b.setL) - (a.setW - a.setL) ||
    (b.ptW  - b.ptL)  - (a.ptW  - a.ptL)
  );
}

// ── INGRESO MANUAL DE RESULTADO ───────────
let _currentResultMatch = null;
let _resultMatchContext = null;
let _setRowCount = 0;

function abrirResultado(matchIdx, context) {
  _currentResultMatch = matchIdx;
  _resultMatchContext = context;

  let p1name, p2name, existing = [];

  if (context === 'group') {
    const m = GT.groupMatches[matchIdx];
    p1name   = GT.players[m.p1];
    p2name   = GT.players[m.p2];
    existing = m.setScores || [];
  } else {
    const { ri, mi } = matchIdx;
    const m  = GT.elimRounds[ri][mi];
    p1name   = m.p1name;
    p2name   = m.p2name;
    existing = m.setScores || [];
  }

  document.getElementById('result-match-info').innerHTML = `
    <div class="result-player-name left">${p1name}</div>
    <div style="color:var(--muted);font-size:18px;flex-shrink:0;">VS</div>
    <div class="result-player-name right">${p2name}</div>`;

  document.getElementById('result-sets-container').innerHTML = '';
  _setRowCount = 0;

  const baseSets = existing.length > 0 ? existing.length : STATE.cfg.sets;
  for (let i = 0; i < baseSets; i++) {
    const [a, b] = existing[i] || [null, null];
    addSetRow(a, b);
  }

  // Botón back según contexto
  const backBtn = document.getElementById('result-back-btn');
  if (backBtn) backBtn.onclick = () =>
    goTo(context === 'elim' ? 'screen-elimination' : 'screen-groups-main');

  goTo('screen-result-entry');
}

function addSetRow(valA = null, valB = null) {
  _setRowCount++;
  const id        = _setRowCount;
  const container = document.getElementById('result-sets-container');
  const num       = container.children.length + 1;
  const row       = document.createElement('div');
  row.className   = 'set-row';
  row.id          = `set-row-${id}`;
  row.innerHTML   = `
    <div class="set-row-label">Set ${num}</div>
    <input type="number" class="set-input" id="set-a-${id}" min="0" max="99"
      value="${valA !== null ? valA : ''}" placeholder="0">
    <div class="set-dash">–</div>
    <input type="number" class="set-input" id="set-b-${id}" min="0" max="99"
      value="${valB !== null ? valB : ''}" placeholder="0">
    <button class="btn-remove-set" onclick="removeSetRow('set-row-${id}')">×</button>`;
  container.appendChild(row);
  _renumberSets();
}

function removeSetRow(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  _renumberSets();
}

function _renumberSets() {
  document.querySelectorAll('#result-sets-container .set-row').forEach((row, i) => {
    const l = row.querySelector('.set-row-label');
    if (l) l.textContent = `Set ${i + 1}`;
  });
}

/**
 * Guarda el resultado aplicando reglas ITTF:
 *  - Valida que haya un ganador de sets (setsNeeded).
 *  - No permite más sets de los necesarios.
 */
function guardarResultado() {
  const rows       = document.querySelectorAll('#result-sets-container .set-row');
  const setScores  = [];
  let sets1 = 0, sets2 = 0, valid = true;
  const setsNeeded = Math.ceil(STATE.cfg.sets / 2);

  rows.forEach(row => {
    const inputs = row.querySelectorAll('.set-input');
    const a      = parseInt(inputs[0].value);
    const b      = parseInt(inputs[1].value);
    if (isNaN(a) || isNaN(b)) { valid = false; return; }
    setScores.push([a, b]);
    if (a > b) sets1++; else sets2++;
  });

  if (!valid || setScores.length === 0) { showToast('Completa todos los sets'); return; }
  if (sets1 < setsNeeded && sets2 < setsNeeded) {
    showToast(`Necesitas ${setsNeeded} sets ganados (ITTF)`); return;
  }
  if (sets1 === sets2) { showToast('Debe haber un ganador'); return; }
  // No permitir más sets de los posibles
  if (setScores.length > STATE.cfg.sets) {
    showToast(`Maximo ${STATE.cfg.sets} sets`); return;
  }

  if (_resultMatchContext === 'group') {
    const m = GT.groupMatches[_currentResultMatch];
    m.sets1 = sets1; m.sets2 = sets2; m.setScores = setScores; m.done = true;
    renderGroupsMain();
    goTo('screen-groups-main');
  } else {
    const { ri, mi } = _currentResultMatch;
    const m = GT.elimRounds[ri][mi];
    m.sets1 = sets1; m.sets2 = sets2; m.setScores = setScores; m.done = true;
    m.winner     = sets1 > sets2 ? m.p1 : m.p2;
    m.winnername = sets1 > sets2 ? m.p1name : m.p2name;
    _propagateElimWinner(ri, mi);
    renderElimination();
    goTo('screen-elimination');
  }
}

function _propagateElimWinner(ri, mi) {
  const nextRi = ri + 1;
  if (nextRi >= GT.elimRounds.length) return;
  const nextMi  = Math.floor(mi / 2);
  const isFirst = mi % 2 === 0;
  const m       = GT.elimRounds[ri][mi];
  const next    = GT.elimRounds[nextRi][nextMi];
  if (isFirst) { next.p1 = m.winner; next.p1name = m.winnername; }
  else         { next.p2 = m.winner; next.p2name = m.winnername; }
}

// Exponer para eliminacion.js
function getGT() { return GT; }
