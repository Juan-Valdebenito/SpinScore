/* SpinScore — liga.js
   Torneo Liga (todos contra todos), persistido en localStorage.
*/

const LIGA = Object.assign(
  { id: null, name: '', players: [], matches: [], cfg: null, status: 'active', podio: null, currentTab: 'matches' },
  ligaGet() || {}
);
let _ligaDraft = [];

function _ligaPersist() {
  const { currentTab, ...data } = LIGA;
  ligaSave(data);
}

/** Abre el formulario de una liga nueva (la liga en curso se sigue viendo desde el inicio). */
function nuevaLiga() {
  _ligaDraft = [];
  document.getElementById('t-name').value = 'Liga';
  document.getElementById('t-player-input').value = '';
  renderTPlayerList();
  goTo('screen-tournament-setup');
}

function addTPlayer() {
  const input = document.getElementById('t-player-input'), name = input.value.trim();
  if (!name) return;
  if (_ligaDraft.some(p => p.toLowerCase() === name.toLowerCase())) { showToast('Jugador ya existe'); return; }
  _ligaDraft.push(name); input.value = ''; input.focus();
  renderTPlayerList();
}
function removeTPlayer(i) { _ligaDraft.splice(i, 1); renderTPlayerList(); }

function renderTPlayerList() {
  const n = _ligaDraft.length;
  document.getElementById('player-count').textContent = n;
  document.getElementById('player-list').innerHTML = _ligaDraft.map((p, i) => `
    <div class="player-item">
      <div class="player-badge">${i + 1}</div>
      <span class="player-item-name">${esc(p)}</span>
      <button class="btn-remove" aria-label="Quitar a ${esc(p)}" onclick="removeTPlayer(${i})">×</button>
    </div>`).join('');
  const mc = (n * (n - 1)) / 2, info = document.getElementById('t-match-count');
  if (n >= 2) { info.classList.remove('d-none'); info.innerHTML = `${n} jugadores · <b class="text-strong">${mc}</b> partidos · ${formatLabel(STATE.cfg)}`; }
  else info.classList.add('d-none');
  document.getElementById('btn-start-tournament').disabled = n < 2;
}

async function startTournament() {
  if (LIGA.id && LIGA.status === 'active' && LIGA.matches.some(m => m.done)) {
    const ok = await ssConfirm(`La liga "${LIGA.name}" está en curso y se reemplazará.`,
      { title: '¿Iniciar nueva liga?', okText: 'Reemplazar', danger: true });
    if (!ok) return;
  }
  Object.assign(LIGA, {
    id: 'L' + Date.now(),
    name: document.getElementById('t-name').value.trim() || 'Liga',
    players: [..._ligaDraft],
    matches: _rr(_ligaDraft),
    cfg: { ...STATE.cfg },
    status: 'active',
    podio: null,
    currentTab: 'matches',
  });
  _ligaPersist();
  goTo('screen-tournament-bracket');
}

function _rr(players) {
  const m = [];
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++)
      m.push({ id: `${i}-${j}`, p1: i, p2: j, sets1: 0, sets2: 0, setHistory: [], done: false });
  return m;
}

function switchTab(tab) {
  LIGA.currentTab = tab;
  document.getElementById('tab-matches').classList.toggle('active', tab === 'matches');
  document.getElementById('tab-standings').classList.toggle('active', tab === 'standings');
  document.getElementById('tab-matches').setAttribute('aria-selected', tab === 'matches');
  document.getElementById('tab-standings').setAttribute('aria-selected', tab === 'standings');
  renderBracket();
}

function renderBracket() {
  const done = LIGA.matches.filter(m => m.done).length, total = LIGA.matches.length;
  document.getElementById('t-header-name').textContent = LIGA.name;
  document.getElementById('t-header-progress').textContent =
    `${done}/${total} partidos${LIGA.cfg ? ' · ' + formatLabel(LIGA.cfg) : ''}`;
  LIGA.currentTab === 'matches' ? _renderMatchesTab() : _renderStandingsTab();
}

function _renderMatchesTab() {
  const pending = LIGA.matches.filter(m => !m.done), done = LIGA.matches.filter(m => m.done);
  const allDone = LIGA.matches.length > 0 && pending.length === 0;
  let html = '';
  if (allDone) {
    const champ = LIGA.players[_standings()[0].idx];
    html += `<div class="champion-banner">
      <div class="champion-banner-title">Torneo finalizado</div>
      <div class="champion-banner-sub">Campeón: <b class="text-strong">${esc(champ)}</b></div>
    </div>`;
  }
  if (pending.length > 0) {
    html += `<div class="section-label">Pendientes</div>`;
    pending.forEach(m => {
      html += `<button class="match-row" onclick="playTournamentMatch('${m.id}')" aria-label="Jugar ${esc(LIGA.players[m.p1])} contra ${esc(LIGA.players[m.p2])}">
        <div class="match-p match-p-left">${esc(LIGA.players[m.p1])}</div>
        <div class="match-vs">VS</div>
        <div class="match-p match-p-right">${esc(LIGA.players[m.p2])}</div>
        <div class="match-go" aria-hidden="true">▶</div>
      </button>`;
    });
  }
  if (done.length > 0) {
    html += `<div class="section-label muted${pending.length ? ' mt-section' : ''}">Jugados</div>`;
    done.forEach(m => {
      const w1 = m.sets1 > m.sets2;
      const detail = (m.setHistory || []).map(([a, b]) => `${a}-${b}`).join(' | ');
      html += `<div class="match-row done match-row-stack">
        <div class="match-row-line">
          <div class="match-p ${w1 ? 'is-winner' : 'is-loser'}">${esc(LIGA.players[m.p1])}</div>
          <div class="match-score">
            <span class="orb score-blue">${m.sets1}</span>
            <span class="muted">–</span>
            <span class="orb score-red">${m.sets2}</span>
          </div>
          <div class="match-p text-right ${!w1 ? 'is-winner' : 'is-loser'}">${esc(LIGA.players[m.p2])}</div>
        </div>
        ${detail ? `<div class="match-detail">${detail}</div>` : ''}
      </div>`;
    });
  }
  document.getElementById('bracket-content').innerHTML = html;
}

function _renderStandingsTab() {
  const st = _standings(), allDone = LIGA.matches.length > 0 && LIGA.matches.every(m => m.done);
  const medals = ['1°', '2°', '3°'];
  let html = `<div class="standings-head">
    <div class="col-rank">#</div><div class="flex-1">JUGADOR</div>
    <div class="col-pts">PTS</div><div class="col-num">PJ</div>
    <div class="col-num">G</div><div class="col-num">P</div>
    <div class="col-sets">SETS</div></div>`;
  st.forEach((s, rank) => {
    html += `<div class="standing-row${rank === 0 && allDone ? ' champion' : ''}">
      <div class="col-rank standing-rank${rank === 0 ? ' first' : ''}">${rank < 3 ? medals[rank] : rank + 1}</div>
      <div class="flex-1 standing-name${rank === 0 ? ' first' : ''}">${esc(LIGA.players[s.idx])}</div>
      <div class="col-pts standing-pts">${s.pts}</div>
      <div class="col-num muted">${s.won + s.lost}</div>
      <div class="col-num stat-val g">${s.won}</div>
      <div class="col-num stat-val p">${s.lost}</div>
      <div class="col-sets muted">${s.setW}-${s.setL}</div>
    </div>`;
  });
  html += `<div class="standings-footer">2 pts por victoria · Desempate ITTF: enfrentamiento directo, sets y puntos</div>`;
  document.getElementById('bracket-content').innerHTML = html;
}

function _standings() {
  return rankPlayers(LIGA.players.map((_, i) => i), LIGA.matches);
}

async function playTournamentMatch(id) {
  const m = LIGA.matches.find(x => x.id === id); if (!m) return;
  if (!await _confirmReplaceLive()) return;
  initMatch(LIGA.players[m.p1], LIGA.players[m.p2], { source: 'liga', matchId: id, cfg: LIGA.cfg || STATE.cfg });
}

/** Llamado por el marcador al terminar un partido de liga. */
function ligaRegistrarResultado(matchId, sets, setHistory) {
  const m = LIGA.matches.find(x => x.id === matchId);
  if (m) {
    m.sets1 = sets[0]; m.sets2 = sets[1];
    m.setHistory = [...setHistory]; m.done = true;
  }
  const allDone = LIGA.matches.length > 0 && LIGA.matches.every(x => x.done);
  if (allDone && LIGA.status !== 'finished') {
    LIGA.status = 'finished';
    LIGA.podio = _standings().slice(0, 4).map(s => LIGA.players[s.idx]);
    _ligaPersist();
    goTo('screen-tournament-bracket');
    setTimeout(() => mostrarPodio(LIGA.podio, LIGA.name, [1, 2, 3, 4]), 300);
    return;
  }
  _ligaPersist();
  goTo('screen-tournament-bracket');
}
