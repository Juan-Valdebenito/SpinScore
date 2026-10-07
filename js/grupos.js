/* SpinScore — grupos.js
   Torneo por grupos: inscripción, sorteo, fase de grupos e ingreso de resultados
   (también para la fase eliminatoria).
*/

const GROUP_COLORS = ['#4FC3F7', '#F5C518', '#F87171', '#22C55E', '#A78BFA', '#FB923C', '#F472B6', '#34D399'];
const GROUP_NAMES  = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MIN_PER_GROUP = 2;
const MAX_PER_GROUP = 4;

const GT = {
  id: null, name: '', catId: null, cfg: null, numGroups: 4, players: [], groups: [],
  confirmed: false, phase: 'groups', currentGroupTab: 0,
  groupMatches: [], elimRounds: [], podio: null, createdAt: null, finishedAt: null,
};

function getGT() { return GT; }

/** Nombre a mostrar para un cupo del cuadro que aún no tiene jugador. */
function isPendingName(name) { return !name || name === 'TBD'; }

function nuevoTorneoGrupos(catId = null, defaultName = 'Torneo') {
  Object.assign(GT, {
    id: null, name: '', catId, cfg: null, numGroups: 4, players: [], groups: [],
    confirmed: false, phase: 'groups', currentGroupTab: 0,
    groupMatches: [], elimRounds: [], podio: null, createdAt: null, finishedAt: null,
  });
  document.getElementById('gt-name').value = defaultName;
  document.getElementById('gp-input').value = '';
  selectGroups(4);
  renderGPList();
  goTo('screen-groups-setup');
}

function selectGroups(n) {
  GT.numGroups = n;
  document.querySelectorAll('#chips-groups .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === n));
  document.getElementById('gp-max').textContent = n * MAX_PER_GROUP;
  _updateGPInfo();
}

function addGPlayer() {
  const input = document.getElementById('gp-input');
  const name  = input.value.trim(); if (!name) return;
  const max = GT.numGroups * MAX_PER_GROUP;
  if (GT.players.length >= max) { showToast(`Máximo ${max} jugadores para ${GT.numGroups} grupos`); return; }
  if (GT.players.some(p => p.toLowerCase() === name.toLowerCase())) { showToast('Jugador ya existe'); return; }
  GT.players.push(name); input.value = ''; input.focus();
  renderGPList();
}

function removeGPlayer(i) { GT.players.splice(i, 1); renderGPList(); }

function renderGPList() {
  document.getElementById('gp-count').textContent = GT.players.length;
  document.getElementById('gp-list').innerHTML = GT.players.map((p, i) => `
    <div class="player-item">
      <div class="player-badge">${i + 1}</div>
      <span class="player-item-name">${esc(p)}</span>
      <button class="btn-remove" aria-label="Quitar a ${esc(p)}" onclick="removeGPlayer(${i})">×</button>
    </div>`).join('');
  _updateGPInfo();
}

function _updateGPInfo() {
  const n = GT.players.length, g = GT.numGroups;
  const min = g * MIN_PER_GROUP, max = g * MAX_PER_GROUP;
  const info = document.getElementById('gp-info');
  const btn = document.getElementById('btn-sortear');
  btn.disabled = n < min || n > max;
  info.classList.remove('d-none', 'warn');
  if (n > max) {
    info.classList.add('warn');
    info.textContent = `Hay ${n} jugadores: con ${g} grupos el máximo es ${max}. Elige más grupos o quita jugadores.`;
  } else if (n < min) {
    info.textContent = `Faltan ${min - n} jugador${min - n === 1 ? '' : 'es'}: se necesitan al menos ${MIN_PER_GROUP} por grupo (${min}).`;
  } else {
    info.textContent = `${n} jugadores en ${g} grupos (~${Math.ceil(n / g)} por grupo) · clasifican ${2 * g} · ${formatLabel(STATE.cfg)}`;
  }
}

function sortearGrupos() {
  const players = GT.players.map((_, i) => i);
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  GT.groups = Array.from({ length: GT.numGroups }, () => []);
  players.forEach((p, i) => GT.groups[i % GT.numGroups].push(p));
  _renderGroupsPreview();
  goTo('screen-groups-preview');
}

function _groupBadge(gi) {
  return `<div class="group-badge" style="background:${GROUP_COLORS[gi]};">G${GROUP_NAMES[gi]}</div>`;
}

function _renderGroupsPreview() {
  document.getElementById('groups-preview-content').innerHTML = GT.groups.map((group, gi) => `
    <div class="group-card">
      <div class="group-header">${_groupBadge(gi)}<span>Grupo ${GROUP_NAMES[gi]}</span></div>
      ${group.map((pi, pos) => `
        <div class="group-player">
          <div class="group-player-num">${pos + 1}</div>
          <div class="group-player-name">${esc(GT.players[pi])}</div>
        </div>`).join('')}
    </div>`).join('');
}

function confirmarGrupos() {
  if (!GT.id) {
    GT.id        = storageNewId();
    GT.createdAt = Date.now();
  }
  GT.name = document.getElementById('gt-name').value.trim() || 'Torneo';
  GT.cfg = { ...STATE.cfg };
  GT.confirmed = true; GT.phase = 'groups'; GT.currentGroupTab = 0;
  GT.groupMatches = [];
  GT.elimRounds = [];
  GT.groups.forEach((group, gi) => {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        GT.groupMatches.push({ groupIdx: gi, p1: group[i], p2: group[j], sets1: 0, sets2: 0, setScores: [], done: false });
  });
  storageSnapshot();
  goTo('screen-groups-main');
}

function _tournamentCfg() {
  return GT.cfg || STATE.cfg;
}

function renderGroupsMain() {
  document.getElementById('gt-header-name').textContent = GT.name;
  document.getElementById('print-torneo-name').textContent = GT.name;
  document.getElementById('gt-phase-label').textContent =
    `${GT.phase === 'elimination' ? 'Fase Eliminatoria' : 'Fase de Grupos'} · ${formatLabel(_tournamentCfg())}`;
  const tabsEl = document.getElementById('groups-tabs');
  tabsEl.innerHTML = GT.groups.map((_, gi) =>
    `<button class="group-tab${gi === GT.currentGroupTab ? ' active' : ''}" role="tab" aria-selected="${gi === GT.currentGroupTab}" data-group="${gi}" onclick="switchGroupTab(${gi})">Grupo ${GROUP_NAMES[gi]}</button>`
  ).join('') + `<button class="group-tab${GT.currentGroupTab === GT.groups.length ? ' active' : ''}" role="tab" aria-selected="${GT.currentGroupTab === GT.groups.length}" data-group="general" onclick="switchGroupTab(${GT.groups.length})">General</button>`;
  renderGroupTabContent();
}

function switchGroupTab(idx) {
  GT.currentGroupTab = idx;
  document.querySelectorAll('#groups-tabs .group-tab').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
    t.setAttribute('aria-selected', i === idx);
  });
  renderGroupTabContent();
}

function renderGroupTabContent() {
  const content = document.getElementById('groups-main-content');
  GT.currentGroupTab === GT.groups.length ? _renderGeneralTab(content) : _renderSingleGroupTab(content, GT.currentGroupTab);
}

function _groupDone(gi) {
  return GT.groupMatches.filter(m => m.groupIdx === gi).every(m => m.done);
}

function _renderSingleGroupTab(content, idx) {
  const matches = GT.groupMatches.filter(m => m.groupIdx === idx);
  const stats = calcGroupStats(idx), allDone = _groupDone(idx);
  const locked = GT.phase === 'elimination';

  let html = `<div class="group-card">
    <div class="group-header">
      ${_groupBadge(idx)}
      <span>Grupo ${GROUP_NAMES[idx]}</span>
      ${allDone ? `<span class="group-status">Completo</span>` : ''}
    </div>
    <div class="group-player group-table-head">
      <div class="group-player-num">#</div><div class="group-player-name">JUGADOR</div>
      <div class="group-player-stats cols">
        <span class="col-pts">PTS</span><span class="col-num">G</span><span class="col-num">P</span><span class="col-sets">SETS</span>
      </div>
    </div>`;

  stats.forEach((s, rank) => {
    const passing = rank < 2 && allDone;
    html += `<div class="group-player${passing ? ' passing' : ''}">
      <div class="group-player-num">${rank + 1}${passing ? '*' : ''}</div>
      <div class="group-player-name${rank < 2 ? ' top' : ''}">${esc(GT.players[s.idx])}</div>
      <div class="group-player-stats cols">
        <span class="col-pts stat-val">${s.pts}</span>
        <span class="col-num stat-val g">${s.won}</span>
        <span class="col-num stat-val p">${s.lost}</span>
        <span class="col-sets stat-val">${s.setW}-${s.setL}</span>
      </div>
    </div>`;
  });
  html += `</div><div class="section-label mt-2">Partidos</div><div class="match-grid">`;

  matches.forEach(m => {
    const ri = GT.groupMatches.indexOf(m), p1 = esc(GT.players[m.p1]), p2 = esc(GT.players[m.p2]);
    if (m.done) {
      const w1 = m.sets1 > m.sets2, detail = m.setScores.map(([a, b]) => `${a}-${b}`).join(' | ');
      const edit = locked ? '' : ` onclick="abrirResultado(${ri},'group')" aria-label="Editar resultado ${p1} contra ${p2}"`;
      html += `<${locked ? 'div' : 'button'} class="match-row done match-row-stack${locked ? '' : ' editable'}"${edit}>
        <div class="match-row-line">
          <div class="match-p ${w1 ? 'is-winner' : 'is-loser'}">${p1}</div>
          <div class="match-score">
            <span class="orb score-blue">${m.sets1}</span>
            <span class="muted">–</span>
            <span class="orb score-red">${m.sets2}</span>
          </div>
          <div class="match-p text-right ${!w1 ? 'is-winner' : 'is-loser'}">${p2}</div>
        </div>
        ${detail ? `<div class="match-detail">${detail}</div>` : ''}
      </${locked ? 'div' : 'button'}>`;
    } else {
      html += `<button class="match-row" onclick="abrirResultado(${ri},'group')" aria-label="Ingresar resultado ${p1} contra ${p2}">
        <div class="match-p match-p-left">${p1}</div>
        <div class="match-vs">VS</div>
        <div class="match-p match-p-right">${p2}</div>
        <div class="match-go" aria-hidden="true">+</div>
      </button>`;
    }
  });
  html += `</div>`;
  if (allDone) {
    const top2 = stats.slice(0, 2).map(s => esc(GT.players[s.idx]));
    html += `<div class="advance-banner mt-3">Clasifican: <b>${top2.join(' y ')}</b></div>`;
  }
  content.innerHTML = html;
}

function _renderGeneralTab(content) {
  const allDone = GT.groups.every((_, gi) => _groupDone(gi));
  let html = '<div class="groups-grid">';

  GT.groups.forEach((_, gi) => {
    const stats = calcGroupStats(gi), done = _groupDone(gi);
    html += `<div class="group-card">
      <div class="group-header">
        ${_groupBadge(gi)}
        <span>Grupo ${GROUP_NAMES[gi]}</span>
        ${done ? `<span class="group-status">Listo</span>` : ''}
      </div>`;
    stats.forEach((s, rank) => {
      const passing = rank < 2 && done;
      html += `<div class="group-player${passing ? ' passing' : ''}">
        <div class="group-player-num">${rank + 1}${passing ? '*' : ''}</div>
        <div class="group-player-name small${rank < 2 ? ' top' : ''}">${esc(GT.players[s.idx])}</div>
        <div class="group-player-stats">
          <span><span class="stat-val g">${s.won}</span>G</span>
          <span><span class="stat-val p">${s.lost}</span>P</span>
          <span><span class="stat-val">${s.pts}</span>pts</span>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  html += '</div>';

  if (allDone && GT.phase === 'groups') {
    html += `<div class="mt-section"><button class="btn-primary" onclick="iniciarEliminacion()">Iniciar Fase Eliminatoria</button></div>`;
  } else if (GT.phase === 'elimination') {
    html += `<div class="mt-section"><button class="btn-primary" onclick="goTo('screen-elimination')">Ver Cuadro Eliminatorio</button></div>`;
  }
  content.innerHTML = html;
}

/** Tabla del grupo ordenada con los criterios de desempate ITTF. */
function calcGroupStats(gi) {
  return rankPlayers(GT.groups[gi], GT.groupMatches.filter(m => m.groupIdx === gi));
}

// ── INGRESO DE RESULTADO ──
let _crm = null, _rmc = null, _src = 0;

function abrirResultado(matchIdx, context) {
  _crm = matchIdx; _rmc = context;
  let p1name, p2name, existing = [];
  if (context === 'group') {
    const m = GT.groupMatches[matchIdx];
    p1name = GT.players[m.p1]; p2name = GT.players[m.p2]; existing = m.setScores || [];
  } else {
    const { ri, mi } = matchIdx, m = GT.elimRounds[ri][mi];
    p1name = m.p1name; p2name = m.p2name; existing = m.setScores || [];
  }
  document.getElementById('result-match-info').innerHTML = `
    <div class="result-player-name left">${esc(p1name)}</div>
    <div class="result-vs">VS</div>
    <div class="result-player-name right">${esc(p2name)}</div>`;
  const cfg = _tournamentCfg();
  document.getElementById('result-format').textContent =
    `Al mejor de ${cfg.sets} · sets a ${cfg.pts} pts con 2 de diferencia. Ingresa solo los sets jugados.`;
  document.getElementById('result-sets-container').innerHTML = '';
  _src = 0;

  if (existing.length > 0) existing.forEach(([a, b]) => addSetRow(a, b));
  else for (let i = 0; i < setsNeededFor(cfg.sets); i++) addSetRow();

  const btn = document.getElementById('result-back-btn');
  if (btn) btn.onclick = () => goTo(context === 'elim' ? 'screen-elimination' : 'screen-groups-main');
  goTo('screen-result-entry');
  document.querySelector('#result-sets-container .set-input')?.focus();
}

function addSetRow(valA = null, valB = null) {
  const container = document.getElementById('result-sets-container');
  if (container.children.length >= _tournamentCfg().sets) {
    showToast(`Máximo ${_tournamentCfg().sets} sets`); return;
  }
  _src++;
  const id = _src;
  const row = document.createElement('div');
  row.className = 'set-row'; row.id = `set-row-${id}`;
  row.innerHTML = `
    <div class="set-row-label">Set</div>
    <input type="number" inputmode="numeric" class="set-input" id="set-a-${id}" min="0" max="99" value="${valA !== null ? valA : ''}" placeholder="0" aria-label="Puntos jugador 1">
    <div class="set-dash">–</div>
    <input type="number" inputmode="numeric" class="set-input" id="set-b-${id}" min="0" max="99" value="${valB !== null ? valB : ''}" placeholder="0" aria-label="Puntos jugador 2">
    <button class="btn-remove-set" aria-label="Quitar set" onclick="removeSetRow('set-row-${id}')">×</button>`;
  container.appendChild(row);
  _renumberSets();
}

function removeSetRow(id) { document.getElementById(id)?.remove(); _renumberSets(); }

function _renumberSets() {
  document.querySelectorAll('#result-sets-container .set-row').forEach((r, i) => {
    const l = r.querySelector('.set-row-label'); if (l) l.textContent = `Set ${i + 1}`;
  });
}

function guardarResultado() {
  const setScores = [];
  for (const row of document.querySelectorAll('#result-sets-container .set-row')) {
    const [ia, ib] = row.querySelectorAll('.set-input');
    const rawA = ia.value.trim(), rawB = ib.value.trim();
    if (rawA === '' && rawB === '') continue; // fila vacía: se ignora
    if (rawA === '' || rawB === '') { showToast('Completa ambos puntajes de cada set'); return; }
    setScores.push([Number(rawA), Number(rawB)]);
  }
  const res = validateMatchScores(setScores, _tournamentCfg());
  if (!res.ok) { showToast(res.error); return; }
  const { sets1, sets2 } = res;

  if (_rmc === 'group') {
    const m = GT.groupMatches[_crm];
    Object.assign(m, { sets1, sets2, setScores, done: true });
    storageSnapshot();
    goTo('screen-groups-main');
  } else {
    const { ri, mi } = _crm, m = GT.elimRounds[ri][mi];
    Object.assign(m, { sets1, sets2, setScores, done: true });
    m.winner     = sets1 > sets2 ? m.p1 : m.p2;
    m.winnername = sets1 > sets2 ? m.p1name : m.p2name;
    propagateElimWinner(ri, mi);
    const isFinal = ri === GT.elimRounds.length - 1;
    if (isFinal) GT.podio = _podioEliminacion();
    storageSnapshot();
    goTo('screen-elimination');
    if (isFinal) setTimeout(() => mostrarPodio(GT.podio, GT.name, [1, 2, 3, 3]), 300);
  }
}

/** Campeón, finalista y los dos semifinalistas (bronce compartido). */
function _podioEliminacion() {
  const total = GT.elimRounds.length;
  const fin = GT.elimRounds[total - 1][0];
  const loserOf = m => (m.winner === m.p1 ? m.p2name : m.p1name);
  const champion = fin.winnername, runnerUp = loserOf(fin);
  const semis = total >= 2 ? GT.elimRounds[total - 2] : [];
  const thirds = semis
    .filter(m => m.done && !m.bye)
    .map(loserOf)
    .filter(n => !isPendingName(n) && n !== 'BYE' && n !== champion && n !== runnerUp);
  return [champion, runnerUp, ...thirds];
}
