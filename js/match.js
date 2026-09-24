/* SpinScore — match.js
   Motor de partido en vivo: puntos, sets, saque ITTF, deuce, tarjetas
   y deshacer (incluye puntos que cerraron un set y tarjetas).
*/

const MATCH = {
  p: ['J1', 'J2'],
  cfg: { sets: 3, pts: 11 },
  pts: [0, 0],
  sets: [0, 0],
  setHistory: [],
  setsNeeded: 2,
  firstServer: 0,
  source: 'quick',       // 'quick' | 'liga'
  matchId: null,         // id del partido de liga
  cards: [{ yellow: 0, red: 0 }, { yellow: 0, red: 0 }],
  undo: [],              // pila de estados previos
};

let _winTimer = null;
let _qsFirstServer = 0;

function updateQSLabels() {
  document.getElementById('qs-sets-label').textContent = STATE.cfg.sets;
  document.getElementById('qs-pts-label').textContent  = STATE.cfg.pts;
  _renderQSServe();
}

function selectQSServe(i) {
  _qsFirstServer = i;
  _renderQSServe();
}

function _renderQSServe() {
  document.querySelectorAll('#qs-serve .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === _qsFirstServer));
}

async function startQuickMatch() {
  const p1 = document.getElementById('qs-p1').value.trim() || 'J1';
  const p2 = document.getElementById('qs-p2').value.trim() || 'J2';
  if (!await _confirmReplaceLive()) return;
  initMatch(p1, p2, { source: 'quick', cfg: STATE.cfg, firstServer: _qsFirstServer });
}

/** Si hay otro partido en vivo guardado, pide confirmación antes de reemplazarlo. */
async function _confirmReplaceLive() {
  const live = liveMatchGet();
  if (!live || !live.p) return true;
  return ssConfirm(`Hay un partido sin terminar: ${live.p[0]} vs ${live.p[1]}. Si inicias otro se perderá.`,
    { title: '¿Iniciar nuevo partido?', okText: 'Iniciar', danger: true });
}

/**
 * @param {string} p1
 * @param {string} p2
 * @param {{source?:'quick'|'liga', matchId?:string, cfg?:{sets:number,pts:number}, firstServer?:0|1}} opts
 */
function initMatch(p1, p2, opts = {}) {
  const cfg = { ...(opts.cfg || STATE.cfg) };
  Object.assign(MATCH, {
    p: [p1, p2],
    cfg,
    pts: [0, 0], sets: [0, 0],
    setHistory: [],
    setsNeeded: setsNeededFor(cfg.sets),
    firstServer: opts.firstServer || 0,
    source: opts.source || 'quick',
    matchId: opts.matchId ?? null,
    cards: [{ yellow: 0, red: 0 }, { yellow: 0, red: 0 }],
    undo: [],
  });
  _showScoreScreen();
  _persistLive();
}

function _showScoreScreen() {
  clearTimeout(_winTimer);
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('score-format-label').textContent =
    `Al mejor de ${MATCH.cfg.sets} set${MATCH.cfg.sets > 1 ? 's' : ''} · ${MATCH.cfg.pts} pts`;
  document.getElementById('card-p1-name').textContent = MATCH.p[0];
  document.getElementById('card-p2-name').textContent = MATCH.p[1];
  document.getElementById('score-p1-btn').setAttribute('aria-label', `Punto para ${MATCH.p[0]}`);
  document.getElementById('score-p2-btn').setAttribute('aria-label', `Punto para ${MATCH.p[1]}`);
  renderScoreUI();
  renderCardsUI();
  goTo('screen-score');
  setPageTitle(`${MATCH.p[0]} vs ${MATCH.p[1]}`);
}

/** Reanuda el partido en vivo guardado (tras recargar o cerrar la app). */
function resumeLiveMatch() {
  const live = liveMatchGet();
  if (!live || !live.p) return;
  Object.assign(MATCH, live);
  _showScoreScreen();
  if (_isMatchOver()) showWinScreen();
}

function _persistLive() {
  liveMatchSave({ ...MATCH });
}

function _isMatchOver() {
  return MATCH.sets[0] >= MATCH.setsNeeded || MATCH.sets[1] >= MATCH.setsNeeded;
}

// ── DESHACER ──
function _pushUndo() {
  MATCH.undo.push(JSON.stringify({
    pts: MATCH.pts, sets: MATCH.sets, setHistory: MATCH.setHistory, cards: MATCH.cards,
  }));
  if (MATCH.undo.length > 500) MATCH.undo.shift();
}

function undoPoint() {
  if (!MATCH.undo.length) { showToast('Nada que deshacer'); return; }
  Object.assign(MATCH, JSON.parse(MATCH.undo.pop()));
  clearTimeout(_winTimer);
  document.getElementById('win-screen').classList.remove('show');
  renderScoreUI();
  renderCardsUI();
  _persistLive();
}

// ── PUNTOS ──
function addPoint(player) {
  if (_isMatchOver()) return;
  _pushUndo();
  _scorePoint(player);
  _persistLive();
}

function _scorePoint(player) {
  MATCH.pts[player]++;
  const el = document.getElementById(player === 0 ? 'score-p1-pts' : 'score-p2-pts');
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  checkSetEnd();
  renderScoreUI();
}

function swapFirstServer() {
  if (MATCH.undo.length) return;
  MATCH.firstServer = 1 - MATCH.firstServer;
  renderScoreUI();
  _persistLive();
}

// ── TARJETAS ──
/**
 * Muestra modal de confirmación antes de aplicar la tarjeta
 * @param {number} player 0|1
 * @param {'yellow'|'red'} type
 */
function showCardModal(player, type) {
  if (_isMatchOver()) return;
  const modal   = document.getElementById('card-modal');
  const icon    = document.getElementById('card-modal-icon');
  const title   = document.getElementById('card-modal-title');
  const sub     = document.getElementById('card-modal-sub');
  const btnEl   = document.getElementById('card-modal-confirm');
  const pname   = MATCH.p[player];

  if (type === 'yellow') {
    icon.style.background = '#F5C518';
    title.textContent     = 'Tarjeta Amarilla';
    title.style.color     = '#F5C518';
    sub.textContent       = `Advertencia para ${pname}`;
  } else {
    icon.style.background = '#E63946';
    title.textContent     = 'Tarjeta Roja';
    title.style.color     = '#E63946';
    sub.textContent       = `Punto para ${MATCH.p[1 - player]}`;
  }

  btnEl.onclick = () => {
    applyCard(player, type);
    closeCardModal();
  };
  modal.classList.add('show');
  btnEl.focus();
}

function applyCard(player, type) {
  _pushUndo(); // deshacer revierte la tarjeta y, si es roja, también el punto
  MATCH.cards[player][type]++;
  // Tarjeta roja: punto al rival (regla ITTF)
  if (type === 'red') _scorePoint(1 - player);
  renderCardsUI();
  _persistLive();
  showToast(type === 'yellow'
    ? `Tarjeta amarilla → ${MATCH.p[player]}`
    : `Tarjeta roja → Punto para ${MATCH.p[1 - player]}`
  );
}

function closeCardModal() {
  document.getElementById('card-modal').classList.remove('show');
}

function renderCardsUI() {
  MATCH.cards.forEach((c, i) => {
    const yEl = document.getElementById(`card-y-${i}`);
    const rEl = document.getElementById(`card-r-${i}`);
    if (yEl) { yEl.textContent = c.yellow; yEl.style.display = c.yellow > 0 ? 'inline' : 'none'; }
    if (rEl) { rEl.textContent = c.red;    rEl.style.display = c.red > 0    ? 'inline' : 'none'; }
  });
}

// ── SETS ──
function checkSetEnd() {
  const [a, b] = MATCH.pts;
  if (!isSetWon(a, b, MATCH.cfg.pts)) return;
  MATCH.setHistory.push([a, b]);
  MATCH.sets[a > b ? 0 : 1]++;
  MATCH.pts = [0, 0];
  if (_isMatchOver()) {
    clearTimeout(_winTimer);
    _winTimer = setTimeout(showWinScreen, 300);
  }
}

function renderScoreUI() {
  const [a, b]   = MATCH.pts;
  const [sa, sb] = MATCH.sets;

  document.getElementById('score-p1-pts').textContent = a;
  document.getElementById('score-p2-pts').textContent = b;
  document.getElementById('score-p1-sets').textContent = sa;
  document.getElementById('score-p2-sets').textContent = sb;
  document.getElementById('score-p1-sets').className = 'sets-count' + (sa >= MATCH.setsNeeded ? ' winning' : '');
  document.getElementById('score-p2-sets').className = 'sets-count' + (sb >= MATCH.setsNeeded ? ' winning' : '');

  renderSetDots();
  renderPips('pips-p1', sa, MATCH.setsNeeded, 'filled-blue');
  renderPips('pips-p2', sb, MATCH.setsNeeded, 'filled-red');

  // Saque ITTF
  const srv = serverFor(a, b, sa + sb, MATCH.cfg.pts, MATCH.firstServer);
  ['score-p1-name', 'score-p2-name'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.textContent = MATCH.p[i];
    el.classList.toggle('serving', srv === i);
  });

  const swap = document.getElementById('btn-swap-serve');
  if (swap) swap.classList.toggle('d-none', MATCH.undo.length > 0);

  const deuceBanner = document.getElementById('deuce-banner');
  if (deuceBanner) deuceBanner.classList.toggle('show', isDeuce(a, b, MATCH.cfg.pts));
}

function renderSetDots() {
  const [sa, sb] = MATCH.sets;
  const c = document.getElementById('set-dots'); c.innerHTML = '';
  // Se colorea cada set jugado según quién lo ganó, en orden.
  for (let i = 0; i < MATCH.cfg.sets; i++) {
    const d = document.createElement('div'); d.className = 'pip';
    const s = MATCH.setHistory[i];
    if (s) d.classList.add(s[0] > s[1] ? 'filled-blue' : 'filled-red');
    c.appendChild(d);
  }
  c.setAttribute('aria-label', `Sets: ${sa} a ${sb}`);
}

function renderPips(elId, filled, total, cls) {
  const el = document.getElementById(elId); el.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const p = document.createElement('div');
    p.className = 'pip' + (i < filled ? ' ' + cls : '');
    el.appendChild(p);
  }
}

function showWinScreen() {
  const [sa, sb] = MATCH.sets, wi = sa > sb ? 0 : 1;
  document.getElementById('win-name').textContent    = MATCH.p[wi];
  document.getElementById('win-p1-name').textContent = MATCH.p[0];
  document.getElementById('win-p2-name').textContent = MATCH.p[1];
  document.getElementById('win-p1-sets').textContent = sa;
  document.getElementById('win-p2-sets').textContent = sb;
  document.getElementById('win-set-history').innerHTML =
    MATCH.setHistory.map(([a, b], i) => `
      <div class="win-set-row">
        <span>Set ${i + 1}</span>
        <span class="${a > b ? 'win-set-winner' : ''}">${a}</span>
        <span>–</span>
        <span class="${b > a ? 'win-set-winner' : ''}">${b}</span>
      </div>`).join('');
  document.getElementById('win-screen').classList.add('show');
}

function finishMatch() {
  document.getElementById('win-screen').classList.remove('show');
  liveMatchClear();
  if (MATCH.source === 'liga') {
    ligaRegistrarResultado(MATCH.matchId, MATCH.sets, MATCH.setHistory);
  } else {
    goTo('screen-home');
  }
}

async function confirmBack() {
  const started = MATCH.undo.length > 0;
  if (started && !await ssConfirm('Se perderá el progreso de este partido.', { title: '¿Salir del partido?', okText: 'Salir', danger: true })) return;
  liveMatchClear();
  clearTimeout(_winTimer);
  document.getElementById('win-screen').classList.remove('show');
  goTo(MATCH.source === 'liga' ? 'screen-tournament-bracket' : 'screen-quicksetup');
}


// ── ITTF CARD TOOLTIPS ──────────────────────
const ITTF_RULES = {
  yellow: {
    header: '🟨 Tarjeta Amarilla',
    rule: 'La tarjeta amarilla es una advertencia oficial. Se emite por comportamiento antideportivo leve, como protestar decisiones, tardar en servir, o interrumpir el juego innecesariamente. No conlleva penalización de puntos inmediata, pero una segunda tarjeta amarilla al mismo jugador puede resultar en tarjeta roja.',
    ref: 'Reglamento ITTF — Regla 3.4.3: Advertencias y penalizaciones de conducta'
  },
  red: {
    header: '🟥 Tarjeta Roja',
    rule: 'La tarjeta roja implica una penalización inmediata: se otorga un punto al rival. Se emite por comportamiento antideportivo grave, insultos, o como segunda infracción tras una tarjeta amarilla. Una segunda tarjeta roja en el mismo partido puede resultar en descalificación.',
    ref: 'Reglamento ITTF — Regla 3.4.4: Penalización de puntos por conducta'
  }
};

function showCardTooltip(event, type) {
  event.preventDefault();
  const rule = ITTF_RULES[type];
  const tooltip = document.getElementById('card-tooltip');
  document.getElementById('card-tooltip-header').textContent = rule.header;
  document.getElementById('card-tooltip-header').style.color = type === 'yellow' ? '#F5C518' : 'var(--ss-red)';
  document.getElementById('card-tooltip-rule').textContent  = rule.rule;
  document.getElementById('card-tooltip-ref').textContent   = rule.ref;
  tooltip.classList.add('show');
}

function hideCardTooltip() {
  document.getElementById('card-tooltip').classList.remove('show');
}

// También se puede activar con long-press en móvil
(function() {
  let pressTimer;
  function addLongPress(selector, type) {
    document.addEventListener('touchstart', function(e) {
      const btn = e.target.closest(selector);
      if (!btn) return;
      pressTimer = setTimeout(() => showCardTooltip(e, type), 500);
    }, { passive: true });
    document.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
    document.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
  }
  addLongPress('.btn-card-yellow', 'yellow');
  addLongPress('.btn-card-red',    'red');
})();

// Atajos de teclado en el marcador (útil en notebook junto a la mesa)
document.addEventListener('keydown', e => {
  if (!document.getElementById('screen-score')?.classList.contains('active')) return;
  if (document.querySelector('.ss-dialog-overlay, .card-modal.show, .win-screen.show')) return;
  if (e.key === 'ArrowLeft')  addPoint(0);
  if (e.key === 'ArrowRight') addPoint(1);
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoPoint(); }
});
