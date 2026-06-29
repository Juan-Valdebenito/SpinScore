/* ════════════════════════════════════════════
   SpinScore — app.js
   Lógica completa: marcador, sets, torneo
════════════════════════════════════════════ */

// ────────────────────────────────────────────
// ESTADO GLOBAL
// ────────────────────────────────────────────

/** Configuración de sets y puntos */
let cfg = { sets: 3, pts: 11 };

/** Estado del partido activo */
let match = {
  p: ['J1', 'J2'],       // nombres
  pts: [0, 0],           // puntos del set actual
  sets: [0, 0],          // sets ganados
  history: [],           // quién marcó cada punto (0|1)
  setHistory: [],        // [[ptsA, ptsB], ...] sets terminados
  setsNeeded: 2,         // sets para ganar el partido
  fromTournament: false, // si vino del torneo
  tournamentMatchId: null,
};

/** Estado del torneo */
let tournament = {
  name: '',
  players: [],
  matches: [],
  currentTab: 'matches',
};

// ────────────────────────────────────────────
// NAVEGACIÓN
// ────────────────────────────────────────────

function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(screenId);
  if (el) el.classList.add('active');
  document.getElementById('app').scrollTop = 0;

  // Actualizar labels al entrar a cada pantalla
  if (screenId === 'screen-home')       updateHomeLabel();
  if (screenId === 'screen-quicksetup') updateQSLabels();
  if (screenId === 'screen-tournament-bracket') renderBracket();
}

// ────────────────────────────────────────────
// HOME
// ────────────────────────────────────────────

function updateHomeLabel() {
  const el = document.getElementById('home-cfg-label');
  if (el) el.textContent = `${cfg.sets} sets · ${cfg.pts} puntos`;
}

// ────────────────────────────────────────────
// CONFIGURACIÓN
// ────────────────────────────────────────────

function selectCfg(type, val) {
  if (type === 'sets') {
    cfg.sets = val;
    document.querySelectorAll('#chips-sets .chip').forEach(c =>
      c.classList.toggle('selected', +c.dataset.val === val)
    );
    document.getElementById('cfg-display-sets').textContent = val;
  } else {
    cfg.pts = val;
    document.querySelectorAll('#chips-pts .chip').forEach(c =>
      c.classList.toggle('selected', +c.dataset.val === val)
    );
    document.getElementById('cfg-display-pts').textContent = val;
  }
}

// ────────────────────────────────────────────
// PARTIDO RÁPIDO
// ────────────────────────────────────────────

function updateQSLabels() {
  document.getElementById('qs-sets-label').textContent = cfg.sets;
  document.getElementById('qs-pts-label').textContent  = cfg.pts;
}

function startQuickMatch() {
  const p1 = document.getElementById('qs-p1').value.trim() || 'J1';
  const p2 = document.getElementById('qs-p2').value.trim() || 'J2';
  initMatch(p1, p2, false, null);
}

// ────────────────────────────────────────────
// MOTOR DE PARTIDO
// ────────────────────────────────────────────

/**
 * Inicializa un partido nuevo y muestra la pantalla de marcador.
 * @param {string} p1 - Nombre jugador 1
 * @param {string} p2 - Nombre jugador 2
 * @param {boolean} fromTournament - Si es parte del torneo
 * @param {string|null} tMatchId - ID del partido en el torneo
 */
function initMatch(p1, p2, fromTournament, tMatchId) {
  match = {
    p: [p1, p2],
    pts: [0, 0],
    sets: [0, 0],
    history: [],
    setHistory: [],
    setsNeeded: Math.ceil(cfg.sets / 2),
    fromTournament,
    tournamentMatchId: tMatchId,
  };

  document.getElementById('score-format-label').textContent =
    `Al mejor de ${cfg.sets} set${cfg.sets > 1 ? 's' : ''} · ${cfg.pts} pts`;
  document.getElementById('score-p1-name').textContent = p1;
  document.getElementById('score-p2-name').textContent = p2;

  renderScoreUI();
  goTo('screen-score');
}

/**
 * Agrega un punto al jugador indicado (0 = p1, 1 = p2).
 * @param {number} player
 */
function addPoint(player) {
  match.pts[player]++;
  match.history.push(player);

  // Animación de pulso en el número
  const elId = player === 0 ? 'score-p1-pts' : 'score-p2-pts';
  const el   = document.getElementById(elId);
  el.classList.remove('pulse');
  void el.offsetWidth; // fuerza reflow para reiniciar animación
  el.classList.add('pulse');

  checkSetEnd();
  renderScoreUI();
}

/** Deshace el último punto registrado. */
function undoPoint() {
  if (match.history.length === 0) {
    showToast('Nada que deshacer');
    return;
  }
  const last = match.history.pop();
  match.pts[last]--;
  renderScoreUI();
}

/**
 * Verifica si el set actual terminó.
 * Regla: llegar primero al mínimo de puntos con 2 de diferencia.
 */
function checkSetEnd() {
  const [a, b] = match.pts;
  const minPts = cfg.pts;
  const lead   = Math.abs(a - b);

  if ((a >= minPts || b >= minPts) && lead >= 2) {
    const winner = a > b ? 0 : 1;
    match.setHistory.push([a, b]);
    match.sets[winner]++;
    match.pts    = [0, 0];
    match.history = [];

    if (match.sets[0] >= match.setsNeeded || match.sets[1] >= match.setsNeeded) {
      setTimeout(showWinScreen, 300);
    }
  }
}

/** Redibuja toda la UI del marcador con el estado actual. */
function renderScoreUI() {
  const [a, b]   = match.pts;
  const [sa, sb] = match.sets;

  // Puntos
  document.getElementById('score-p1-pts').textContent = a;
  document.getElementById('score-p2-pts').textContent = b;

  // Sets
  document.getElementById('score-p1-sets').textContent = sa;
  document.getElementById('score-p2-sets').textContent = sb;
  document.getElementById('score-p1-sets').className =
    'sets-count' + (sa >= match.setsNeeded ? ' winning' : '');
  document.getElementById('score-p2-sets').className =
    'sets-count' + (sb >= match.setsNeeded ? ' winning' : '');

  // Puntos de set (barra superior)
  renderSetDots(sa, sb);

  // Pip indicators bajo el marcador
  renderPips('pips-p1', sa, match.setsNeeded, 'filled-blue');
  renderPips('pips-p2', sb, match.setsNeeded, 'filled-red');

  // Indicador de saque
  // Regla ITTF: cada 2 puntos cambia saque; en deuce (ambos >= ptsMax-1) cada punto
  const total    = a + b;
  const inDeuce  = a >= cfg.pts - 1 && b >= cfg.pts - 1;
  const cycleLen = inDeuce ? 1 : 2;
  const servingNow = (Math.floor(total / cycleLen) + (sa + sb)) % 2;

  document.getElementById('score-p1-name').textContent =
    (servingNow === 0 ? '🏓 ' : '') + match.p[0];
  document.getElementById('score-p2-name').textContent =
    (servingNow === 1 ? '🏓 ' : '') + match.p[1];
}

/**
 * Dibuja los puntos de sets en la barra superior.
 * Azul = sets del J1, Rojo = sets del J2.
 */
function renderSetDots(sa, sb) {
  const container = document.getElementById('set-dots');
  container.innerHTML = '';
  const total = sa + sb;
  for (let i = 0; i < cfg.sets; i++) {
    const d = document.createElement('div');
    d.className = 'pip';
    if (i < sa)    d.classList.add('filled-blue');
    else if (i < total) d.classList.add('filled-red');
    container.appendChild(d);
  }
}

/**
 * Dibuja los pips de sets ganados bajo el marcador de un jugador.
 * @param {string} elId      - ID del contenedor
 * @param {number} filled    - Cuántos pips llenar
 * @param {number} total     - Total de pips a mostrar
 * @param {string} filledCls - Clase CSS para pip lleno
 */
function renderPips(elId, filled, total, filledCls) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const p = document.createElement('div');
    p.className = 'pip' + (i < filled ? ' ' + filledCls : '');
    el.appendChild(p);
  }
}

/** Muestra la pantalla de victoria con el resumen del partido. */
function showWinScreen() {
  const [sa, sb]    = match.sets;
  const winnerIdx   = sa > sb ? 0 : 1;

  document.getElementById('win-name').textContent    = match.p[winnerIdx];
  document.getElementById('win-p1-name').textContent = match.p[0];
  document.getElementById('win-p2-name').textContent = match.p[1];
  document.getElementById('win-p1-sets').textContent = sa;
  document.getElementById('win-p2-sets').textContent = sb;

  // Historial de sets
  const hist = document.getElementById('win-set-history');
  hist.innerHTML = match.setHistory.map(([a, b], i) => `
    <div style="display:flex;justify-content:space-between;gap:24px;
                font-size:14px;color:var(--muted);padding:3px 0;">
      <span>Set ${i + 1}</span>
      <span style="color:${a > b ? 'var(--win)' : 'var(--text)'};">${a}</span>
      <span>–</span>
      <span style="color:${b > a ? 'var(--win)' : 'var(--text)'};">${b}</span>
    </div>
  `).join('');

  document.getElementById('win-screen').classList.add('show');
}

/** Acción al presionar "Continuar" en la pantalla de victoria. */
function finishMatch() {
  document.getElementById('win-screen').classList.remove('show');

  if (match.fromTournament) {
    // Guardar resultado en el torneo
    const m = tournament.matches.find(x => x.id === match.tournamentMatchId);
    if (m) {
      m.sets1      = match.sets[0];
      m.sets2      = match.sets[1];
      m.setHistory = [...match.setHistory];
      m.done       = true;
    }
    renderBracket();
    goTo('screen-tournament-bracket');
  } else {
    goTo('screen-home');
  }
}

/** Confirma antes de salir si el partido ya tiene puntos. */
function confirmBack() {
  const hasProgress = match.history.length > 0 || match.sets[0] > 0 || match.sets[1] > 0;
  if (!hasProgress || confirm('¿Salir del partido? Se perderá el progreso.')) {
    document.getElementById('win-screen').classList.remove('show');
    goTo(match.fromTournament ? 'screen-tournament-bracket' : 'screen-quicksetup');
  }
}

// ────────────────────────────────────────────
// TORNEO
// ────────────────────────────────────────────

/** Agrega un jugador a la lista del torneo. */
function addTPlayer() {
  const input = document.getElementById('t-player-input');
  const name  = input.value.trim();
  if (!name) return;
  if (tournament.players.includes(name)) {
    showToast('Ese jugador ya existe');
    return;
  }
  tournament.players.push(name);
  input.value = '';
  input.focus();
  renderPlayerList();
}

/**
 * Elimina un jugador de la lista por índice.
 * @param {number} i - Índice del jugador
 */
function removePlayer(i) {
  tournament.players.splice(i, 1);
  renderPlayerList();
}

/** Redibuja la lista de jugadores en la pantalla de setup. */
function renderPlayerList() {
  const n = tournament.players.length;
  document.getElementById('player-count').textContent = n;

  document.getElementById('player-list').innerHTML =
    tournament.players.map((p, i) => `
      <div class="player-item">
        <div class="player-badge">${i + 1}</div>
        <span style="flex:1;font-size:15px;">${p}</span>
        <button class="btn-remove" onclick="removePlayer(${i})">✕</button>
      </div>
    `).join('');

  const matchCount = (n * (n - 1)) / 2;
  const info       = document.getElementById('t-match-count');
  if (n >= 2) {
    info.style.display = 'block';
    info.innerHTML = `🏓 ${n} jugadores · <b style="color:var(--text);">${matchCount}</b> partidos en total`;
  } else {
    info.style.display = 'none';
  }

  document.getElementById('btn-start-tournament').disabled = n < 2;
}

/** Genera los partidos todos-contra-todos e inicia el torneo. */
function startTournament() {
  tournament.name       = document.getElementById('t-name').value.trim() || 'Torneo';
  tournament.matches    = createRoundRobin(tournament.players);
  tournament.currentTab = 'matches';

  document.getElementById('t-header-name').textContent = tournament.name;
  renderBracket();
  goTo('screen-tournament-bracket');
}

/**
 * Crea todos los partidos posibles entre los jugadores (n*(n-1)/2).
 * @param {string[]} players
 * @returns {Object[]} Lista de partidos
 */
function createRoundRobin(players) {
  const matches = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({
        id:         `${i}-${j}`,
        p1:         i,
        p2:         j,
        sets1:      0,
        sets2:      0,
        setHistory: [],
        done:       false,
      });
    }
  }
  return matches;
}

/**
 * Cambia entre la pestaña de partidos y posiciones.
 * @param {string} tab - 'matches' | 'standings'
 */
function switchTab(tab) {
  tournament.currentTab = tab;
  document.getElementById('tab-matches').classList.toggle('active',   tab === 'matches');
  document.getElementById('tab-standings').classList.toggle('active', tab === 'standings');
  renderBracket();
}

/** Redibuja el contenido principal del torneo según la pestaña activa. */
function renderBracket() {
  const done  = tournament.matches.filter(m => m.done).length;
  const total = tournament.matches.length;
  document.getElementById('t-header-progress').textContent = `${done}/${total} partidos`;

  if (tournament.currentTab === 'matches') renderMatchesTab();
  else                                     renderStandingsTab();
}

/** Renderiza la lista de partidos (pendientes y jugados). */
function renderMatchesTab() {
  const pending  = tournament.matches.filter(m => !m.done);
  const done     = tournament.matches.filter(m =>  m.done);
  const total    = tournament.matches.length;
  const allDone  = total > 0 && pending.length === 0;

  let html = '';

  // Banner de campeón
  if (allDone) {
    const st    = calcStandings();
    const champ = tournament.players[st[0].idx];
    html += `
      <div style="background:rgba(245,197,24,.12);border:1px solid var(--accent);
                  border-radius:14px;padding:16px;margin-bottom:16px;text-align:center;">
        <div style="font-size:36px;">🏆</div>
        <div style="font-weight:800;color:var(--accent);font-size:20px;">¡Torneo finalizado!</div>
        <div style="color:var(--muted);font-size:14px;margin-top:4px;">
          Campeón: <b style="color:var(--text);">${champ}</b>
        </div>
      </div>`;
  }

  // Partidos pendientes
  if (pending.length > 0) {
    html += `<div class="section-label">Pendientes</div>`;
    pending.forEach(m => {
      html += `
        <div class="match-row" onclick="playTournamentMatch('${m.id}')">
          <div style="flex:1;text-align:left;">
            <span style="color:var(--blue);font-weight:700;font-size:15px;">
              ${tournament.players[m.p1]}
            </span>
          </div>
          <div class="match-vs">VS</div>
          <div style="flex:1;text-align:right;">
            <span style="color:var(--red);font-weight:700;font-size:15px;">
              ${tournament.players[m.p2]}
            </span>
          </div>
          <div class="match-play-icon">▶</div>
        </div>`;
    });
  }

  // Partidos jugados
  if (done.length > 0) {
    html += `<div class="section-label" style="color:var(--muted);margin-top:${pending.length > 0 ? '16px' : '0'};">
               Jugados
             </div>`;
    done.forEach(m => {
      const w = m.sets1 > m.sets2 ? m.p1 : m.p2;
      html += `
        <div class="match-row done">
          <div style="flex:1;text-align:left;
                      color:${w === m.p1 ? 'var(--win)' : 'var(--muted)'};
                      font-weight:${w === m.p1 ? 700 : 400};font-size:14px;">
            ${tournament.players[m.p1]}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
            <span class="orb" style="color:var(--blue);font-size:18px;">${m.sets1}</span>
            <span style="color:var(--muted);font-size:12px;">–</span>
            <span class="orb" style="color:var(--red);font-size:18px;">${m.sets2}</span>
          </div>
          <div style="flex:1;text-align:right;
                      color:${w === m.p2 ? 'var(--win)' : 'var(--muted)'};
                      font-weight:${w === m.p2 ? 700 : 400};font-size:14px;">
            ${tournament.players[m.p2]}
          </div>
        </div>`;
    });
  }

  document.getElementById('bracket-content').innerHTML = html;
}

/** Renderiza la tabla de posiciones. */
function renderStandingsTab() {
  const st      = calcStandings();
  const allDone = tournament.matches.every(m => m.done) && tournament.matches.length > 0;
  const medals  = ['🥇', '🥈', '🥉'];

  let html = `
    <div class="standings-head">
      <div style="width:28px;">#</div>
      <div style="flex:1;">JUGADOR</div>
      <div style="width:34px;text-align:center;">PTS</div>
      <div style="width:30px;text-align:center;">PJ</div>
      <div style="width:28px;text-align:center;">G</div>
      <div style="width:28px;text-align:center;">P</div>
      <div style="width:42px;text-align:center;">SETS</div>
    </div>`;

  st.forEach((s, rank) => {
    html += `
      <div class="standing-row${rank === 0 && allDone ? ' champion' : ''}">
        <div style="width:28px;font-weight:800;font-size:14px;
                    color:${rank === 0 ? 'var(--accent)' : 'var(--muted)'};">
          ${rank < 3 ? medals[rank] : rank + 1}
        </div>
        <div style="flex:1;font-weight:${rank === 0 ? 700 : 500};font-size:14px;">
          ${tournament.players[s.idx]}
        </div>
        <div style="width:34px;text-align:center;color:var(--accent);font-weight:800;">${s.pts}</div>
        <div style="width:30px;text-align:center;color:var(--muted);font-size:13px;">${s.won + s.lost}</div>
        <div style="width:28px;text-align:center;color:var(--win);font-size:13px;">${s.won}</div>
        <div style="width:28px;text-align:center;color:var(--red);font-size:13px;">${s.lost}</div>
        <div style="width:42px;text-align:center;color:var(--muted);font-size:12px;">${s.setW}-${s.setL}</div>
      </div>`;
  });

  html += `<div class="standings-footer">
    2 pts por victoria · Desempate por diferencia de sets y puntos
  </div>`;

  document.getElementById('bracket-content').innerHTML = html;
}

/**
 * Calcula la tabla de posiciones ordenada.
 * Criterios: puntos → dif. sets → dif. puntos
 * @returns {Object[]} Lista de posiciones ordenada
 */
function calcStandings() {
  const st = tournament.players.map((_, i) => ({
    idx: i, pts: 0, won: 0, lost: 0,
    setW: 0, setL: 0, ptW: 0, ptL: 0,
  }));

  tournament.matches.filter(m => m.done).forEach(m => {
    // Acumular sets
    st[m.p1].setW += m.sets1;  st[m.p1].setL += m.sets2;
    st[m.p2].setW += m.sets2;  st[m.p2].setL += m.sets1;

    // Acumular puntos individuales de cada set
    (m.setHistory || []).forEach(([a, b]) => {
      st[m.p1].ptW += a;  st[m.p1].ptL += b;
      st[m.p2].ptW += b;  st[m.p2].ptL += a;
    });

    // Puntos de clasificación: 2 al ganador, 0 al perdedor
    const winner = m.sets1 > m.sets2 ? m.p1 : m.p2;
    const loser  = winner === m.p1 ? m.p2 : m.p1;
    st[winner].pts += 2;
    st[winner].won++;
    st[loser].lost++;
  });

  return st.sort((a, b) =>
    b.pts - a.pts ||
    (b.setW - b.setL) - (a.setW - a.setL) ||
    (b.ptW  - b.ptL)  - (a.ptW  - a.ptL)
  );
}

/**
 * Inicia un partido del torneo.
 * @param {string} matchId - ID del partido
 */
function playTournamentMatch(matchId) {
  const m = tournament.matches.find(x => x.id === matchId);
  if (!m) return;
  initMatch(tournament.players[m.p1], tournament.players[m.p2], true, matchId);
}

// ────────────────────────────────────────────
// TOAST (notificaciones rápidas)
// ────────────────────────────────────────────

let toastTimer;

/**
 * Muestra un mensaje breve en la parte inferior de la pantalla.
 * @param {string} msg
 */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ────────────────────────────────────────────
// PWA — SERVICE WORKER (cache offline)
// ────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  const swCode = `
    const CACHE = 'spinscore-v1';
    const FILES = ['./','./index.html','./css/style.css','./js/app.js'];

    self.addEventListener('install', e => {
      e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
      self.skipWaiting();
    });

    self.addEventListener('fetch', e => {
      e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request))
      );
    });
  `;
  const swBlob = new Blob([swCode], { type: 'application/javascript' });
  const swURL  = URL.createObjectURL(swBlob);
  navigator.serviceWorker.register(swURL).catch(() => {});
}

// ────────────────────────────────────────────
// INICIO
// ────────────────────────────────────────────

window.addEventListener('load', () => {
  updateHomeLabel();

  // Mostrar banner de instalación si no está en modo standalone
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches
                   || window.navigator.standalone;
  if (!isInstalled) {
    setTimeout(() => {
      document.getElementById('install-banner').classList.add('show');
    }, 1500);
  }
});
