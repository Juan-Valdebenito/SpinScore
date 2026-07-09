/* ═══════════════════════════════════════════
   SpinScore v1.4 — eliminacion.js
   Bracket eliminatorio: visual espejo
   izquierda / derecha con campeón al centro
═══════════════════════════════════════════ */

const ROUND_NAMES = ['Dieciseisavos','Octavos de Final','Cuartos de Final','Semifinal','Final'];

// ── INICIAR ELIMINACIÓN ───────────────────
function iniciarEliminacion() {
  const GT = getGT();

  // Recoger los 2 clasificados de cada grupo
  const classified = [];
  GT.groups.forEach((_, gi) => {
    calcGroupStats(gi).slice(0, 2).forEach((s, pos) =>
      classified.push({ playerIdx: s.idx, group: gi, pos })
    );
  });

  GT.elimRounds = [];
  GT.phase      = 'elimination';

  // Construir seeds con cruces (1°A vs 2°B, etc.)
  const seeds      = _buildSeeding(classified);
  const firstRound = [];

  for (let i = 0; i < seeds.length; i += 2) {
    const home = seeds[i];
    const away = seeds[i + 1] || null;
    firstRound.push(_newElimMatch(
      home ? home.playerIdx : null,
      home ? GT.players[home.playerIdx] : 'TBD',
      away ? away.playerIdx : null,
      away ? GT.players[away.playerIdx] : 'TBD',
    ));
  }
  GT.elimRounds.push(firstRound);

  // Generar rondas vacías hasta la final
  let size = firstRound.length;
  while (size > 1) {
    size = Math.ceil(size / 2);
    GT.elimRounds.push(
      Array.from({ length: size }, () => _newElimMatch(null,'TBD',null,'TBD'))
    );
  }

  renderElimination();
  goTo('screen-elimination');
}

function _newElimMatch(p1, p1name, p2, p2name) {
  return { p1, p1name, p2, p2name,
           sets1: 0, sets2: 0, setScores: [],
           done: false, winner: null, winnername: null };
}

function _buildSeeding(classified) {
  const first  = classified.filter(c => c.pos === 0);
  const second = classified.filter(c => c.pos === 1);
  const used   = new Set();
  const seeds  = [];

  first.forEach(f => {
    seeds.push(f);
    // Buscar 2° de otro grupo no usado
    const cross = second.find(s => s.group !== f.group && !used.has(s.group));
    if (cross) { used.add(cross.group); seeds.push(cross); }
    else        seeds.push(second.find(s => !used.has(s.group)) || second[0]);
  });
  return seeds;
}

function _getRoundName(ri, totalRounds) {
  const fromEnd = totalRounds - 1 - ri;
  return fromEnd < ROUND_NAMES.length
    ? ROUND_NAMES[ROUND_NAMES.length - 1 - fromEnd]
    : `Ronda ${ri + 1}`;
}

// ── RENDER PRINCIPAL ──────────────────────
function renderElimination() {
  const GT          = getGT();
  const totalRounds = GT.elimRounds.length;
  const isDesktop   = window.innerWidth >= 768;
  const container   = document.getElementById('elim-content');
  document.getElementById('elim-header-name').textContent = GT.name;

  isDesktop
    ? _renderDesktopBracket(container, GT, totalRounds)
    : _renderMobileBracket(container, GT, totalRounds);
}

// ── BRACKET VISUAL DESKTOP ────────────────
// Estructura espejo: izquierda → centro (campeón) ← derecha
function _renderDesktopBracket(container, GT, totalRounds) {
  const total    = GT.elimRounds[0].length; // total partidos primera ronda
  const halfSize = Math.ceil(total / 2);    // mitad izquierda

  // Dividir primera ronda en dos mitades
  const leftMatches  = GT.elimRounds[0].slice(0, halfSize);
  const rightMatches = GT.elimRounds[0].slice(halfSize);

  // Construir rondas izquierda y derecha
  // La izquierda avanza hacia la final izquierda → centro
  // La derecha avanza hacia la final derecha → centro
  const leftRounds  = _buildHalfRounds(GT, 'left',  halfSize);
  const rightRounds = _buildHalfRounds(GT, 'right', total - halfSize);

  const champion = GT.elimRounds[totalRounds - 1]?.[0];

  let html = `<div class="bracket-wrapper">`;

  // ── MITAD IZQUIERDA (columnas de izq a der) ──
  html += `<div class="bracket-half bracket-left">`;
  leftRounds.forEach((round, ri) => {
    html += `<div class="bracket-col">
      <div class="bracket-round-label">${_getRoundName(ri, totalRounds)}</div>
      <div class="bracket-col-matches">`;
    round.forEach((m, mi) => {
      html += _matchCard(m, ri, mi, 'left', GT);
    });
    html += `</div></div>`;
    if (ri < leftRounds.length - 1) html += _connectorCol(round.length, 'left');
  });
  html += `</div>`;

  // ── CAMPEÓN CENTRAL ──
  const champName = champion?.done ? champion.winnername : null;
  html += `<div class="bracket-center">
    <div class="bracket-final-label">FINAL</div>
    <div class="bracket-champion-box">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke="${champName ? '#F5C518' : '#2A5C3A'}" stroke-width="1.5">
        <path d="M6 9H4a2 2 0 0 0-2 2v1a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6v-1a2 2 0 0 0-2-2h-2"/>
        <rect x="6" y="2" width="12" height="10" rx="2"/>
        <line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
      </svg>
      <div class="bracket-champion-name">${champName || 'Campeon'}</div>
    </div>
    ${champion && !champion.done && champion.p1name !== 'TBD' && champion.p2name !== 'TBD'
      ? `<button class="btn-final" onclick="abrirResultadoElim(${totalRounds-1},0)">
           Ingresar resultado
         </button>` : ''}
  </div>`;

  // ── MITAD DERECHA (columnas de der a izq, espejo) ──
  html += `<div class="bracket-half bracket-right">`;
  rightRounds.forEach((round, ri) => {
    if (ri < rightRounds.length - 1) html += _connectorCol(round.length, 'right');
    html += `<div class="bracket-col">
      <div class="bracket-round-label">${_getRoundName(ri, totalRounds)}</div>
      <div class="bracket-col-matches">`;
    round.forEach((m, mi) => {
      // Los índices de los partidos de la derecha en la ronda original
      const origMi = halfSize + mi + (ri > 0 ? 0 : 0);
      html += _matchCard(m, ri, origMi, 'right', GT);
    });
    html += `</div></div>`;
  });
  html += `</div>`;

  html += `</div>`; // bracket-wrapper
  container.innerHTML = html;
}

function _buildHalfRounds(GT, side, firstRoundSize) {
  const totalRounds = GT.elimRounds.length;
  const half        = [];

  GT.elimRounds.forEach((round, ri) => {
    if (ri === totalRounds - 1) return; // final va al centro
    const total = round.length;
    const half1 = Math.ceil(total / 2);
    const slice = side === 'left'
      ? round.slice(0, half1)
      : round.slice(half1);
    if (slice.length > 0) half.push(slice);
  });
  return half;
}

function _matchCard(m, ri, mi, side, GT) {
  const canPlay = m.p1name !== 'TBD' && m.p2name !== 'TBD' && !m.done;
  const w1      = m.done && m.sets1 > m.sets2;
  const w2      = m.done && m.sets2 > m.sets1;
  const detail  = m.done ? m.setScores.map(([a,b])=>`${a}-${b}`).join(' | ') : '';

  return `<div class="b-match${canPlay ? ' b-clickable' : ''}${m.done ? ' b-done' : ''}"
      ${canPlay ? `onclick="abrirResultadoElim(${ri},${mi})"` : ''}>
    <div class="b-team${w1 ? ' b-winner' : ''}">
      <div class="b-name${m.p1name==='TBD'?' b-tbd':''}">${m.p1name}</div>
      <div class="b-score${w1?' b-winner':''}">${m.done ? m.sets1 : '–'}</div>
    </div>
    <div class="b-team${w2 ? ' b-winner' : ''}">
      <div class="b-name${m.p2name==='TBD'?' b-tbd':''}">${m.p2name}</div>
      <div class="b-score${w2?' b-winner':''}">${m.done ? m.sets2 : '–'}</div>
    </div>
    ${detail ? `<div class="b-detail">${detail}</div>` : ''}
    ${canPlay ? `<div class="b-play-hint">Toca para ingresar resultado</div>` : ''}
  </div>`;
}

function _connectorCol(matchCount, side) {
  const lines = Array.from({ length: Math.ceil(matchCount / 2) }, (_, i) => `
    <div class="conn-pair">
      <div class="conn-top"></div>
      <div class="conn-mid ${side === 'left' ? 'conn-mid-right' : 'conn-mid-left'}"></div>
      <div class="conn-bot"></div>
    </div>`).join('');
  return `<div class="bracket-connector">${lines}</div>`;
}

// ── BRACKET MÓVIL (lista por rondas) ──────
function _renderMobileBracket(container, GT, totalRounds) {
  let html = '';
  GT.elimRounds.forEach((round, ri) => {
    html += `<div class="elim-round-title">${_getRoundName(ri, totalRounds)}</div>`;
    round.forEach((m, mi) => {
      const canPlay = m.p1name !== 'TBD' && m.p2name !== 'TBD' && !m.done;
      const isFinal = ri === totalRounds - 1;
      if (m.done) {
        const w1     = m.sets1 > m.sets2;
        const detail = m.setScores.map(([a,b])=>`${a}-${b}`).join(' | ');
        html += `<div class="elim-match">
          <div class="elim-player">
            <div class="elim-player-name${w1?' winner':''}">${m.p1name}</div>
            <div class="elim-player-sets${w1?' winner':''}">${m.sets1}</div>
          </div>
          <div class="elim-player">
            <div class="elim-player-name${!w1?' winner':''}">${m.p2name}</div>
            <div class="elim-player-sets${!w1?' winner':''}">${m.sets2}</div>
          </div>
          ${detail ? `<div class="elim-result-detail">${detail}</div>` : ''}
        </div>`;
        if (isFinal) {
          html += `<div style="background:rgba(245,197,24,.12);border:1px solid var(--accent);
            border-radius:14px;padding:16px;text-align:center;margin-top:12px;">
            <div style="font-weight:800;color:var(--accent);font-size:22px;">Campeon</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">${m.winnername}</div>
          </div>`;
        }
      } else {
        html += `<div class="elim-match${canPlay?' clickable':''}"
          ${canPlay ? `onclick="abrirResultadoElim(${ri},${mi})"` : ''}>
          <div class="elim-player">
            <div class="elim-player-name${m.p1name==='TBD'?' elim-tbd':''}">${m.p1name}</div>
            <div class="elim-player-sets">–</div>
          </div>
          <div class="elim-player">
            <div class="elim-player-name${m.p2name==='TBD'?' elim-tbd':''}">${m.p2name}</div>
            <div class="elim-player-sets">–</div>
          </div>
          ${canPlay ? `<div class="elim-result-detail" style="color:var(--accent);">Toca para ingresar resultado</div>` : ''}
        </div>`;
      }
    });
  });
  container.innerHTML = html;
}

// ── ABRIR RESULTADO ELIMINACIÓN ───────────
function abrirResultadoElim(ri, mi) {
  abrirResultado({ ri, mi }, 'elim');
}
