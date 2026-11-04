/* SpinScore — grupos.js
   Torneo por grupos: inscripción, sorteo, fase de grupos e ingreso de resultados
   (también para la fase eliminatoria).
*/

const GROUP_COLORS = ['#4FC3F7', '#F5C518', '#F87171', '#22C55E', '#A78BFA', '#FB923C', '#F472B6', '#34D399'];
const GROUP_NAMES  = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MIN_PER_GROUP = 2;
const MAX_PER_GROUP = 4;
const MAX_PER_GROUP_SEEDED = 5;   // con cabeza de serie se permiten grupos de 5 (pasan los 3 primeros)

/** Máximo de jugadores por grupo según el modo. */
function maxPorGrupo() { return GT.seededMode ? MAX_PER_GROUP_SEEDED : MAX_PER_GROUP; }

const GT = {
  id: null, name: '', catId: null, cfg: null, numGroups: 4, players: [], groups: [],
  confirmed: false, phase: 'groups', currentGroupTab: 0, seededMode: false,
  groupMatches: [], prelimMatches: [], prelimDirect: [], elimDirect: [], elimRounds: [], podio: null, createdAt: null, finishedAt: null,
};

function getGT() { return GT; }

/** Nombre a mostrar para un cupo del cuadro que aún no tiene jugador. */
function isPendingName(name) { return !name || name === 'TBD'; }

function nuevoTorneoGrupos(catId = null, defaultName = 'Torneo') {
  Object.assign(GT, {
    id: null, name: '', catId, cfg: null, numGroups: 4, players: [], groups: [],
    confirmed: false, phase: 'groups', currentGroupTab: 0, seededMode: false,
    groupMatches: [], prelimMatches: [], prelimDirect: [], elimDirect: [], elimRounds: [], podio: null, createdAt: null, finishedAt: null,
  });
  document.getElementById('gt-name').value = defaultName;
  document.getElementById('gp-input').value = '';
  selectGroups(4);
  renderSeedMode();
  renderGPList();
  goTo('screen-groups-setup');
}

/** Activa la siembra para priorizar a los ganadores de grupo al armar el cuadro. */
function toggleSeedMode() {
  GT.seededMode = !GT.seededMode;
  renderSeedMode();
  document.getElementById('gp-max').textContent = GT.numGroups * maxPorGrupo();
  _updateGPInfo();
}

/** Cupos del grupo `gi`: con cabeza de serie dependen del tamaño; si no, pasan siempre 1.° y 2.°. */
function cuposDeGrupo(gi) {
  return GT.seededMode ? cuposGrupo(GT.groups[gi].length) : { directos: 2, previa: 0 };
}

/** Estado de quien terminó en el puesto `rank` (0 = 1.°) de un grupo ya completo. */
function _estadoPuesto(gi, rank) {
  const { directos, previa } = cuposDeGrupo(gi);
  if (rank < directos) return 'pasa';
  if (rank < directos + previa) return 'previa';
  return '';
}

function renderSeedMode() {
  const toggle = document.getElementById('seed-mode-toggle');
  if (!toggle) return;
  toggle.classList.toggle('active', GT.seededMode);
  toggle.setAttribute('aria-checked', String(GT.seededMode));
}

function selectGroups(n) {
  GT.numGroups = n;
  document.querySelectorAll('#chips-groups .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === n));
  document.getElementById('gp-max').textContent = n * maxPorGrupo();
  _updateGPInfo();
}

function addGPlayer() {
  const input = document.getElementById('gp-input');
  const name  = input.value.trim(); if (!name) return;
  const max = GT.numGroups * maxPorGrupo();
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
  const min = g * MIN_PER_GROUP, max = g * maxPorGrupo();
  const info = document.getElementById('gp-info');
  const btn = document.getElementById('btn-sortear');
  btn.disabled = n < min || n > max;
  info.classList.remove('d-none', 'warn');
  if (n > max) {
    info.classList.add('warn');
    const pista = !GT.seededMode && n <= g * MAX_PER_GROUP_SEEDED ? ' Con el modo cabeza de serie se permiten 5 por grupo.' : '';
    info.textContent = `Hay ${n} jugadores: con ${g} grupos el máximo es ${max}. Elige más grupos o quita jugadores.${pista}`;
  } else if (n < min) {
    info.textContent = `Faltan ${min - n} jugador${min - n === 1 ? '' : 'es'}: se necesitan al menos ${MIN_PER_GROUP} por grupo (${min}).`;
  } else {
    let clasifican = `clasifican ${2 * g}`;
    if (GT.seededMode) {
      // Tamaños que tendrán los grupos al sortear (se reparten de a uno)
      const tam = Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0));
      const d = tam.reduce((s, t) => s + cuposGrupo(t).directos, 0), p = tam.reduce((s, t) => s + cuposGrupo(t).previa, 0);
      clasifican = `clasifican ${d} directo${p ? ` + ${p} a la llave previa` : ''}`;
    }
    info.textContent = `${n} jugadores en ${g} grupos (~${Math.ceil(n / g)} por grupo) · ${clasifican} · ${formatLabel(STATE.cfg)}`;
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
  GT.prelimMatches = [];
  GT.prelimDirect = [];
  GT.elimDirect = [];
  GT.elimRounds = [];
  GT.groups.forEach((group, gi) => {
    GT.groupMatches.push(...generarCalendarioGrupo(group, gi));
  });
  storageSnapshot();
  goTo('screen-groups-main');
}

/**
 * Calendario round-robin por método del círculo (Berger): cada fecha deja a
 * cada jugador con un único partido; con número impar hay un descanso rotativo.
 */
function generarCalendarioGrupo(players, groupIdx) {
  const rotation = [...players];
  if (rotation.length % 2) rotation.push(null);
  const matches = [], total = rotation.length;
  for (let round = 1; round < total; round++) {
    for (let i = 0; i < total / 2; i++) {
      const p1 = rotation[i], p2 = rotation[total - 1 - i];
      if (p1 !== null && p2 !== null)
        matches.push({ groupIdx, round, p1, p2, sets1: 0, sets2: 0, setScores: [], done: false });
    }
    rotation.splice(1, 0, rotation.pop());
  }
  return matches;
}

function _tournamentCfg() {
  return GT.cfg || STATE.cfg;
}

/** Formato del partido cuyo resultado se está ingresando (torneo por grupos o liga). */
function _resultCfg() {
  return _rmc === 'liga' ? (LIGA.cfg || STATE.cfg) : _tournamentCfg();
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
    const estado = allDone ? _estadoPuesto(idx, rank) : '';
    html += `<div class="group-player${estado === 'pasa' ? ' passing' : estado === 'previa' ? ' previa' : ''}">
      <div class="group-player-num">${rank + 1}${estado === 'pasa' ? '*' : estado === 'previa' ? ' P' : ''}</div>
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

  let displayedRound = null;
  matches.forEach(m => {
    if (m.round && m.round !== displayedRound) {
      html += `<div class="section-label match-round-label">Fecha ${m.round}</div>`;
      displayedRound = m.round;
    }
    const ri = GT.groupMatches.indexOf(m), p1 = esc(GT.players[m.p1]), p2 = esc(GT.players[m.p2]);
    if (m.done) {
      const w1 = m.sets1 > m.sets2, detail = [m.setScores.map(([a, b]) => `${a}-${b}`).join(' | '), resultadoEspecialTexto(m)].filter(Boolean).join(' · ');
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
    const { directos, previa } = cuposDeGrupo(idx);
    const pasan = stats.slice(0, directos).map(s => esc(GT.players[s.idx]));
    const aPrevia = stats.slice(directos, directos + previa).map(s => esc(GT.players[s.idx]));
    const lista = pasan.length > 1 ? `${pasan.slice(0, -1).join(', ')} y ${pasan.at(-1)}` : pasan[0];
    html += `<div class="advance-banner mt-3">Clasifica${pasan.length > 1 ? 'n' : ''}: <b>${lista}</b>` +
      (aPrevia.length ? `<br>Llave previa: <b>${aPrevia.join(', ')}</b>` : '') + `</div>`;
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
      const estado = done ? _estadoPuesto(gi, rank) : '';
      html += `<div class="group-player${estado === 'pasa' ? ' passing' : estado === 'previa' ? ' previa' : ''}">
        <div class="group-player-num">${rank + 1}${estado === 'pasa' ? '*' : estado === 'previa' ? ' P' : ''}</div>
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
  } else if (context === 'liga') {
    const m = LIGA.matches.find(x => x.id === matchIdx);
    p1name = LIGA.players[m.p1]; p2name = LIGA.players[m.p2]; existing = m.setHistory || [];
  } else if (context === 'previa') {
    const m = GT.prelimMatches[matchIdx];
    p1name = m.p1name; p2name = m.p2name; existing = m.setScores || [];
  } else {
    const { ri, mi } = matchIdx, m = GT.elimRounds[ri][mi];
    p1name = m.p1name; p2name = m.p2name; existing = m.setScores || [];
  }
  document.getElementById('result-match-info').innerHTML = `
    <div class="result-player-name left">${esc(p1name)}</div>
    <div class="result-vs">VS</div>
    <div class="result-player-name right">${esc(p2name)}</div>`;
  const cfg = _resultCfg();
  document.getElementById('result-format').textContent =
    `Al mejor de ${cfg.sets} · sets a ${cfg.pts} pts con 2 de diferencia. Ingresa solo los sets jugados.`;
  document.getElementById('result-sets-container').innerHTML = '';
  _src = 0;

  if (existing.length > 0) existing.forEach(([a, b]) => addSetRow(a, b));
  else for (let i = 0; i < setsNeededFor(cfg.sets); i++) addSetRow();

  const liveBtn = document.getElementById('result-live-btn');
  if (liveBtn) liveBtn.classList.toggle('d-none', existing.length > 0);
  _renderSpecialResultActions(p1name, p2name, existing.length === 0);

  const btn = document.getElementById('result-back-btn');
  const volver = { elim: 'screen-elimination', previa: 'screen-elimination', liga: 'screen-tournament-bracket' }[context] || 'screen-groups-main';
  if (btn) btn.onclick = () => goTo(volver);
  goTo('screen-result-entry');
  document.querySelector('#result-sets-container .set-input')?.focus();
}

function _renderSpecialResultActions(p1, p2, pending) {
  const el = document.getElementById('result-special-actions');
  if (!el) return;
  el.classList.toggle('d-none', !pending);
  if (!pending) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="ss-section-label mt-4">Resultado especial</div>
    <div class="btn-row"><button class="btn-secondary flex-1" onclick="declararResultadoEspecial('walkover',0)">W.O. ${esc(p1)}</button><button class="btn-secondary flex-1" onclick="declararResultadoEspecial('walkover',1)">W.O. ${esc(p2)}</button></div>
    <div class="btn-row mt-2"><button class="btn-ghost flex-1" onclick="declararResultadoEspecial('retired',0)">Retiro ${esc(p1)}</button><button class="btn-ghost flex-1" onclick="declararResultadoEspecial('retired',1)">Retiro ${esc(p2)}</button></div>`;
}

function _specialScores(loser, cfg) {
  const winner = 1 - loser;
  return Array.from({ length: setsNeededFor(cfg.sets) }, () => winner === 0 ? [cfg.pts, 0] : [0, cfg.pts]);
}

async function declararResultadoEspecial(type, loser) {
  let p;
  if (_rmc === 'group') { const m = GT.groupMatches[_crm]; p = [GT.players[m?.p1], GT.players[m?.p2]]; }
  else if (_rmc === 'previa') { const m = GT.prelimMatches[_crm]; p = [m?.p1name, m?.p2name]; }
  else if (_rmc === 'elim') { const m = GT.elimRounds[_crm?.ri]?.[_crm?.mi]; p = [m?.p1name, m?.p2name]; }
  else return;
  if (!p[0] || !p[1]) return;
  const label = type === 'walkover' ? 'W.O.' : 'retiro';
  if (!await ssConfirm(`${p[loser]} queda registrado por ${label}. Ganará ${p[1 - loser]}.`, { title: '¿Confirmar resultado?', okText: 'Confirmar', danger: true })) return;
  await guardarResultado(_specialScores(loser, _resultCfg()), { resultType: type, specialLoser: p[loser] });
}

function resultadoEspecialTexto(m) {
  if (!m?.resultType) return '';
  return m.resultType === 'walkover' ? `W.O. · ${m.specialLoser} no se presentó` : `Retiro · ${m.specialLoser}`;
}

/** Inicia el marcador en vivo para el partido pendiente abierto en el formulario. */
async function iniciarPartidoTorneoEnVivo() {
  let m, p1name, p2name;
  if (_rmc === 'group') {
    m = GT.groupMatches[_crm];
    p1name = GT.players[m?.p1]; p2name = GT.players[m?.p2];
  } else if (_rmc === 'previa') {
    m = GT.prelimMatches[_crm];
    p1name = m?.p1name; p2name = m?.p2name;
  } else if (_rmc === 'elim') {
    m = GT.elimRounds[_crm?.ri]?.[_crm?.mi];
    p1name = m?.p1name; p2name = m?.p2name;
  } else return;
  if (!m || m.done || !p1name || !p2name || isPendingName(p1name) || isPendingName(p2name)) return;
  if (!await _confirmReplaceLive()) return;
  initMatch(p1name, p2name, {
    source: 'torneo', tournamentId: GT.id, tournamentContext: _rmc,
    tournamentMatch: _crm, cfg: _resultCfg(),
  });
}

/** Devuelve la pantalla de origen de un partido en vivo de torneo. */
function pantallaPartidoTorneoEnVivo(context) {
  return context === 'group' ? 'screen-groups-main' : 'screen-elimination';
}

/** Carga y verifica el torneo vinculado a un partido en vivo antes de reanudarlo. */
function restaurarPartidoTorneoEnVivo(live) {
  const snap = storageGetAll().find(t => t.id === live.tournamentId);
  if (!snap) return false;
  storageLoad(snap);
  let m, p1name, p2name;
  if (live.tournamentContext === 'group') {
    m = GT.groupMatches[live.tournamentMatch];
    p1name = GT.players[m?.p1]; p2name = GT.players[m?.p2];
  } else if (live.tournamentContext === 'previa') {
    m = GT.prelimMatches[live.tournamentMatch];
    p1name = m?.p1name; p2name = m?.p2name;
  } else if (live.tournamentContext === 'elim') {
    const ref = live.tournamentMatch;
    m = GT.elimRounds[ref?.ri]?.[ref?.mi];
    p1name = m?.p1name; p2name = m?.p2name;
  }
  return !!m && !m.done && p1name === live.p[0] && p2name === live.p[1];
}

/** Guarda en el torneo el resultado que acaba de finalizar en el marcador en vivo. */
async function registrarResultadoTorneoEnVivo(live) {
  if (!restaurarPartidoTorneoEnVivo(live)) {
    goTo('screen-home');
    await ssConfirm('El torneo de este partido ya no existe o fue modificado. El resultado no se guardó.',
      { title: 'Partido sin torneo', okText: 'Entendido' });
    return;
  }
  _crm = live.tournamentMatch;
  _rmc = live.tournamentContext;
  await guardarResultado(live.setHistory);
}

function addSetRow(valA = null, valB = null) {
  const container = document.getElementById('result-sets-container');
  if (container.children.length >= _resultCfg().sets) {
    showToast(`Máximo ${_resultCfg().sets} sets`); return;
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

async function guardarResultado(setScoresOverride = null, special = null) {
  const setScores = setScoresOverride ? setScoresOverride.map(([a, b]) => [a, b]) : [];
  if (!setScoresOverride) {
    for (const row of document.querySelectorAll('#result-sets-container .set-row')) {
      const [ia, ib] = row.querySelectorAll('.set-input');
      const rawA = ia.value.trim(), rawB = ib.value.trim();
      if (rawA === '' && rawB === '') continue; // fila vacía: se ignora
      if (rawA === '' || rawB === '') { showToast('Completa ambos puntajes de cada set'); return; }
      setScores.push([Number(rawA), Number(rawB)]);
    }
  }
  const res = validateMatchScores(setScores, _resultCfg());
  if (!res.ok) { showToast(res.error); return; }
  const { sets1, sets2 } = res;

  if (_rmc === 'liga') {
    ligaCorregirResultado(_crm, sets1, sets2, setScores);
  } else if (_rmc === 'group') {
    const m = GT.groupMatches[_crm];
    Object.assign(m, { sets1, sets2, setScores, done: true, ...(special || {}) });
    storageSnapshot();
    goTo('screen-groups-main');
  } else if (_rmc === 'previa') {
    const m = GT.prelimMatches[_crm];
    const eraJugado = m.done;
    const cambiaGanador = eraJugado && (sets1 > sets2 ? m.p1 : m.p2) !== m.winner;
    const cuadroArmado = GT.elimRounds.length > 0;
    if (cambiaGanador && cuadroArmado) {
      // El ganador de la previa ya está en el cuadro: hay que rearmarlo (y borrar lo jugado, si lo hay).
      const jugados = GT.elimRounds.flat().filter(x => x.done && !x.bye).length;
      if (jugados) {
        const ok = await ssConfirm(`Cambiar el ganador de la ronda previa rearma el cuadro eliminatorio y borra sus ${jugados} resultado${jugados === 1 ? '' : 's'}.`,
          { title: '¿Cambiar el ganador?', okText: 'Rearmar cuadro', danger: true });
        if (!ok) return;
      }
    }
    Object.assign(m, { sets1, sets2, setScores, done: true, ...(special || {}) });
    m.winner = sets1 > sets2 ? m.p1 : m.p2;
    m.winnername = sets1 > sets2 ? m.p1name : m.p2name;
    if (GT.prelimMatches.every(x => x.done) && (!cuadroArmado || cambiaGanador)) {
      // Se arma el cuadro (al terminar la previa) o se rearma con el ganador corregido
      GT.podio = null; GT.finishedAt = null;
      _generarCuadroDesdePrevia();
    } else storageSnapshot();
    goTo('screen-elimination');
    if (!eraJugado) {
      if (!cuadroArmado && GT.elimRounds.length) showToast('Ronda previa terminada · se armó el cuadro');
    } else if (!cambiaGanador) showToast('Resultado corregido');
    else showToast(cuadroArmado ? 'Ganador corregido · se rearmó el cuadro' : 'Ganador corregido');
  } else {
    const { ri, mi } = _crm, m = GT.elimRounds[ri][mi];
    const total = GT.elimRounds.length;
    const eraJugado = m.done;
    const cambiaGanador = eraJugado && (sets1 > sets2 ? m.p1 : m.p2) !== m.winner;
    let deps = [];
    if (cambiaGanador) {
      // Los partidos posteriores ya jugados dependían del ganador anterior: se reabren (previa confirmación).
      deps = elimDependientesJugados(GT.elimRounds, ri, mi);
      if (deps.length) {
        const lista = deps.map(d => {
          const x = GT.elimRounds[d.ri][d.mi];
          return `${_rn(d.ri, total)} (${x.p1name} vs ${x.p2name})`;
        }).join(', ');
        const ok = await ssConfirm(`Se borrará el resultado de: ${lista}. Esos partidos quedarán pendientes con el ganador corregido.`,
          { title: '¿Cambiar el ganador?', okText: 'Cambiar ganador', danger: true });
        if (!ok) return;
      }
      elimReabrirDependientes(GT.elimRounds, deps);
    }
    Object.assign(m, { sets1, sets2, setScores, done: true, ...(special || {}) });
    m.winner     = sets1 > sets2 ? m.p1 : m.p2;
    m.winnername = sets1 > sets2 ? m.p1name : m.p2name;
    propagateElimWinner(ri, mi);
    const isFinal = ri === total - 1;
    if (GT.elimRounds[total - 1][0].done) GT.podio = _podioEliminacion();
    else { GT.podio = null; GT.finishedAt = null; }   // sin final jugada el torneo está en curso
    storageSnapshot();
    goTo('screen-elimination');
    if (!eraJugado) {
      if (isFinal) setTimeout(() => mostrarPodio(GT.podio, GT.name, [1, 2, 3, 3]), 300);
    } else if (!cambiaGanador) showToast('Resultado corregido');
    else if (deps.some(d => d.ri === total - 1)) showToast('Ganador corregido · el torneo vuelve a estar en curso');
    else if (isFinal) showToast('Ganador corregido · podio actualizado');
    else showToast('Ganador corregido');
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
