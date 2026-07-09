/* ═══════════════════════════════════════════
   SpinScore v1.4 — match.js
   Motor de partido en vivo (marcador ITTF)
═══════════════════════════════════════════ */

// ── ESTADO DEL PARTIDO ────────────────────
const MATCH = {
  p: ['J1', 'J2'],
  pts: [0, 0],
  sets: [0, 0],
  history: [],        // [0|1] quién marcó cada punto
  setHistory: [],     // [[ptsA, ptsB], ...] por set terminado
  setsNeeded: 2,      // sets para ganar el partido
  fromTournament: false,
  tournamentMatchId: null,
};

// ── INICIO DE PARTIDO ─────────────────────
function updateQSLabels() {
  document.getElementById('qs-sets-label').textContent = STATE.cfg.sets;
  document.getElementById('qs-pts-label').textContent  = STATE.cfg.pts;
}

function startQuickMatch() {
  const p1 = document.getElementById('qs-p1').value.trim() || 'J1';
  const p2 = document.getElementById('qs-p2').value.trim() || 'J2';
  initMatch(p1, p2, false, null);
}

/**
 * Inicializa un partido y navega al marcador.
 * @param {string}  p1
 * @param {string}  p2
 * @param {boolean} fromTournament
 * @param {*}       tournamentMatchId
 */
function initMatch(p1, p2, fromTournament, tournamentMatchId) {
  MATCH.p                = [p1, p2];
  MATCH.pts              = [0, 0];
  MATCH.sets             = [0, 0];
  MATCH.history          = [];
  MATCH.setHistory       = [];
  MATCH.setsNeeded       = Math.ceil(STATE.cfg.sets / 2);
  MATCH.fromTournament   = fromTournament;
  MATCH.tournamentMatchId = tournamentMatchId;

  document.getElementById('score-format-label').textContent =
    `Al mejor de ${STATE.cfg.sets} set${STATE.cfg.sets > 1 ? 's' : ''} · ${STATE.cfg.pts} pts`;
  document.getElementById('score-p1-name').textContent = p1;
  document.getElementById('score-p2-name').textContent = p2;

  renderScoreUI();
  goTo('screen-score');
}

// ── SUMAR PUNTO ───────────────────────────
function addPoint(player) {
  // Si el partido ya terminó, ignorar toques
  if (MATCH.sets[0] >= MATCH.setsNeeded || MATCH.sets[1] >= MATCH.setsNeeded) return;

  MATCH.pts[player]++;
  MATCH.history.push(player);

  // Pulso en el número
  const elId = player === 0 ? 'score-p1-pts' : 'score-p2-pts';
  const el   = document.getElementById(elId);
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');

  checkSetEnd();
  renderScoreUI();
}

// ── DESHACER PUNTO ────────────────────────
function undoPoint() {
  if (!MATCH.history.length) { showToast('Nada que deshacer'); return; }
  const last = MATCH.history.pop();
  MATCH.pts[last]--;
  renderScoreUI();
}

// ── LÓGICA ITTF: FIN DE SET Y PARTIDO ────
/**
 * Regla ITTF:
 *  - Gana el set quien llega primero al mínimo de puntos (cfg.pts)
 *    con al menos 2 de diferencia.
 *  - Gana el partido quien acumula setsNeeded sets.
 *  - No se puede seguir jugando tras alcanzar setsNeeded.
 */
function checkSetEnd() {
  const [a, b]  = MATCH.pts;
  const minPts  = STATE.cfg.pts;
  const lead    = Math.abs(a - b);

  if ((a >= minPts || b >= minPts) && lead >= 2) {
    const winner = a > b ? 0 : 1;
    MATCH.setHistory.push([a, b]);
    MATCH.sets[winner]++;
    MATCH.pts    = [0, 0];
    MATCH.history = [];

    // ── FIN DE PARTIDO ──
    if (MATCH.sets[0] >= MATCH.setsNeeded || MATCH.sets[1] >= MATCH.setsNeeded) {
      setTimeout(showWinScreen, 300);
    }
  }
}

// ── RENDER MARCADOR ───────────────────────
function renderScoreUI() {
  const [a, b]   = MATCH.pts;
  const [sa, sb] = MATCH.sets;

  document.getElementById('score-p1-pts').textContent = a;
  document.getElementById('score-p2-pts').textContent = b;
  document.getElementById('score-p1-sets').textContent = sa;
  document.getElementById('score-p2-sets').textContent = sb;

  document.getElementById('score-p1-sets').className =
    'sets-count' + (sa >= MATCH.setsNeeded ? ' winning' : '');
  document.getElementById('score-p2-sets').className =
    'sets-count' + (sb >= MATCH.setsNeeded ? ' winning' : '');

  renderSetDots(sa, sb);
  renderPips('pips-p1', sa, MATCH.setsNeeded, 'filled-blue');
  renderPips('pips-p2', sb, MATCH.setsNeeded, 'filled-red');

  // Indicador de saque ITTF:
  //   Cada 2 puntos cambia el saque; en deuce (ambos ≥ pts-1) cambia cada punto.
  const total   = a + b;
  const inDeuce = a >= STATE.cfg.pts - 1 && b >= STATE.cfg.pts - 1;
  const cycle   = inDeuce ? 1 : 2;
  const srv     = (Math.floor(total / cycle) + (sa + sb)) % 2;

  document.getElementById('score-p1-name').textContent = (srv === 0 ? '> ' : '') + MATCH.p[0];
  document.getElementById('score-p2-name').textContent = (srv === 1 ? '> ' : '') + MATCH.p[1];
}

function renderSetDots(sa, sb) {
  const c = document.getElementById('set-dots');
  c.innerHTML = '';
  for (let i = 0; i < STATE.cfg.sets; i++) {
    const d = document.createElement('div');
    d.className = 'pip';
    if (i < sa)        d.classList.add('filled-blue');
    else if (i < sa + sb) d.classList.add('filled-red');
    c.appendChild(d);
  }
}

function renderPips(elId, filled, total, cls) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const p = document.createElement('div');
    p.className = 'pip' + (i < filled ? ' ' + cls : '');
    el.appendChild(p);
  }
}

// ── PANTALLA DE VICTORIA ──────────────────
function showWinScreen() {
  const [sa, sb] = MATCH.sets;
  const wi       = sa > sb ? 0 : 1;

  document.getElementById('win-name').textContent    = MATCH.p[wi];
  document.getElementById('win-p1-name').textContent = MATCH.p[0];
  document.getElementById('win-p2-name').textContent = MATCH.p[1];
  document.getElementById('win-p1-sets').textContent = sa;
  document.getElementById('win-p2-sets').textContent = sb;

  document.getElementById('win-set-history').innerHTML =
    MATCH.setHistory.map(([a, b], i) => `
      <div style="display:flex;justify-content:space-between;gap:24px;
                  font-size:14px;color:var(--muted);padding:3px 0;">
        <span>Set ${i + 1}</span>
        <span style="color:${a > b ? 'var(--win)' : 'var(--text)'};">${a}</span>
        <span>–</span>
        <span style="color:${b > a ? 'var(--win)' : 'var(--text)'};">${b}</span>
      </div>`).join('');

  document.getElementById('win-screen').classList.add('show');
}

function finishMatch() {
  document.getElementById('win-screen').classList.remove('show');

  if (MATCH.fromTournament) {
    const m = LIGA.matches.find(x => x.id === MATCH.tournamentMatchId);
    if (m) {
      m.sets1      = MATCH.sets[0];
      m.sets2      = MATCH.sets[1];
      m.setHistory = [...MATCH.setHistory];
      m.done       = true;
    }
    renderBracket();
    goTo('screen-tournament-bracket');
  } else {
    goTo('screen-home');
  }
}

function confirmBack() {
  const hasProgress = MATCH.history.length > 0 ||
                      MATCH.sets[0] > 0 || MATCH.sets[1] > 0;
  if (!hasProgress || confirm('¿Salir del partido? Se perdera el progreso.')) {
    document.getElementById('win-screen').classList.remove('show');
    goTo(MATCH.fromTournament ? 'screen-tournament-bracket' : 'screen-quicksetup');
  }
}
