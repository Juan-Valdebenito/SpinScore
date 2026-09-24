/* SpinScore — eliminacion.js
   Fase eliminatoria: armado del cuadro (con BYEs), avance de ganadores y render.
*/

const ROUND_NAMES = ['Dieciseisavos', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];

function iniciarEliminacion() {
  const classified = [];
  GT.groups.forEach((_, gi) =>
    calcGroupStats(gi).slice(0, 2).forEach((s, pos) =>
      classified.push({ id: s.idx, group: gi, pos })));

  const firstRound = buildFirstRound(classified).map(([a, b]) => {
    if (!b) {
      // BYE: pasa directo a la siguiente ronda
      return Object.assign(_nm(a.id, GT.players[a.id], null, 'BYE'),
        { bye: true, done: true, winner: a.id, winnername: GT.players[a.id] });
    }
    return _nm(a.id, GT.players[a.id], b.id, GT.players[b.id]);
  });

  GT.elimRounds = [firstRound];
  GT.phase = 'elimination';
  let size = firstRound.length;
  while (size > 1) {
    size = Math.ceil(size / 2);
    GT.elimRounds.push(Array.from({ length: size }, () => _nm(null, null, null, null)));
  }
  firstRound.forEach((m, mi) => { if (m.bye) propagateElimWinner(0, mi); });
  storageSnapshot();
  goTo('screen-elimination');
}

function _nm(p1, p1name, p2, p2name) {
  return { p1, p1name, p2, p2name, sets1: 0, sets2: 0, setScores: [], done: false, winner: null, winnername: null };
}

/** Lleva al ganador del partido (ri, mi) a su cupo en la ronda siguiente. */
function propagateElimWinner(ri, mi) {
  const nextRi = ri + 1;
  if (nextRi >= GT.elimRounds.length) return;
  const m = GT.elimRounds[ri][mi], next = GT.elimRounds[nextRi][Math.floor(mi / 2)];
  if (mi % 2 === 0) { next.p1 = m.winner; next.p1name = m.winnername; }
  else              { next.p2 = m.winner; next.p2name = m.winnername; }
}

function _rn(ri, total) {
  const fe = total - 1 - ri;
  return fe < ROUND_NAMES.length ? ROUND_NAMES[ROUND_NAMES.length - 1 - fe] : `Ronda ${ri + 1}`;
}

function _canPlay(m) {
  return !m.done && !isPendingName(m.p1name) && !isPendingName(m.p2name);
}

/** Nombre listo para HTML, con estilo para cupos vacíos y BYE. */
function _slotName(name) {
  if (name === 'BYE') return { html: 'BYE', cls: ' is-bye' };
  if (isPendingName(name)) return { html: 'Por definir', cls: ' is-tbd' };
  return { html: esc(name), cls: '' };
}

function renderElimination() {
  const total = GT.elimRounds.length;
  const container = document.getElementById('elim-content');
  document.getElementById('elim-header-name').textContent = GT.name;
  if (!total) { container.innerHTML = ''; return; }
  window.innerWidth >= 768 ? _renderDesktop(container, total) : _renderMobile(container, total);
}

function _renderMobile(container, total) {
  let html = '';
  GT.elimRounds.forEach((round, ri) => {
    html += `<div class="elim-round-title">${_rn(ri, total)}</div>`;
    round.forEach((m, mi) => {
      const n1 = _slotName(m.p1name), n2 = _slotName(m.p2name);
      if (m.bye) {
        html += `<div class="elim-match is-bye-match">
          <div class="elim-player"><div class="elim-player-name winner">${n1.html}</div><div class="elim-player-sets">→</div></div>
          <div class="elim-result-detail">Pasa directo (BYE)</div>
        </div>`;
      } else if (m.done) {
        const w1 = m.sets1 > m.sets2, detail = m.setScores.map(([a, b]) => `${a}-${b}`).join(' | ');
        html += `<div class="elim-match">
          <div class="elim-player"><div class="elim-player-name${w1 ? ' winner' : ''}">${n1.html}</div><div class="elim-player-sets${w1 ? ' winner' : ''}">${m.sets1}</div></div>
          <div class="elim-player"><div class="elim-player-name${!w1 ? ' winner' : ''}">${n2.html}</div><div class="elim-player-sets${!w1 ? ' winner' : ''}">${m.sets2}</div></div>
          ${detail ? `<div class="elim-result-detail">${detail}</div>` : ''}
        </div>`;
        if (ri === total - 1) {
          html += `<div class="champion-banner mt-3">
            <div class="champion-banner-title">Campeón</div>
            <div class="champion-banner-name">${esc(m.winnername)}</div>
          </div>`;
        }
      } else {
        const can = _canPlay(m);
        html += `<${can ? 'button' : 'div'} class="elim-match${can ? ' clickable' : ''}" ${can ? `onclick="abrirResultadoElim(${ri},${mi})" aria-label="Ingresar resultado ${n1.html} contra ${n2.html}"` : ''}>
          <div class="elim-player"><div class="elim-player-name${n1.cls}">${n1.html}</div><div class="elim-player-sets">–</div></div>
          <div class="elim-player"><div class="elim-player-name${n2.cls}">${n2.html}</div><div class="elim-player-sets">–</div></div>
          ${can ? `<div class="elim-result-detail accent">Toca para ingresar resultado</div>` : ''}
        </${can ? 'button' : 'div'}>`;
      }
    });
  });
  container.innerHTML = html;
}

function _renderDesktop(container, total) {
  const leftRounds  = _halfRounds('left');
  const rightRounds = _halfRounds('right');
  const champion = GT.elimRounds[total - 1][0];
  let html = `<div class="bracket-wrapper"><div class="bracket-half bracket-left">`;
  leftRounds.forEach((round, ri) => {
    html += `<div class="bracket-col"><div class="bracket-round-label">${_rn(ri, total)}</div><div class="bracket-col-matches">`;
    round.forEach((m, mi) => { html += _bcard(m, ri, mi); });
    html += `</div></div>`;
    if (ri < leftRounds.length - 1) html += _conn(round.length);
  });
  html += `</div>`;

  const champName = champion.done ? champion.winnername : null;
  const fin1 = _slotName(champion.p1name), fin2 = _slotName(champion.p2name);
  html += `<div class="bracket-center">
    <div class="bracket-final-label">FINAL</div>
    ${total === 1 || !champion.done ? `<div class="bracket-final-vs">${fin1.html}<span>vs</span>${fin2.html}</div>` : ''}
    <div class="bracket-champion-box">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${champName ? '#F5C518' : '#2A5C3A'}" stroke-width="1.5" aria-hidden="true"><path d="M6 9H4a2 2 0 0 0-2 2v1a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6v-1a2 2 0 0 0-2-2h-2"/><rect x="6" y="2" width="12" height="10" rx="2"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
      <div class="bracket-champion-name">${champName ? esc(champName) : 'Campeón'}</div>
      ${champion.done ? `<div class="b-detail">${champion.setScores.map(([a, b]) => `${a}-${b}`).join(' | ')}</div>` : ''}
    </div>
    ${_canPlay(champion) ? `<button class="btn-final" onclick="abrirResultadoElim(${total - 1},0)">Ingresar resultado</button>` : ''}
  </div>`;

  html += `<div class="bracket-half bracket-right">`;
  rightRounds.forEach((round, ri) => {
    if (ri < rightRounds.length - 1) html += _conn(round.length);
    // En la mitad derecha, el índice real del partido parte en la mitad de SU ronda.
    const offset = Math.ceil(GT.elimRounds[ri].length / 2);
    html += `<div class="bracket-col"><div class="bracket-round-label">${_rn(ri, total)}</div><div class="bracket-col-matches">`;
    round.forEach((m, mi) => { html += _bcard(m, ri, offset + mi); });
    html += `</div></div>`;
  });
  html += `</div></div>`;
  container.innerHTML = html;
}

/** Rondas previas a la final, divididas en mitad izquierda o derecha. */
function _halfRounds(side) {
  const total = GT.elimRounds.length, half = [];
  GT.elimRounds.forEach((round, ri) => {
    if (ri === total - 1) return;
    const h1 = Math.ceil(round.length / 2);
    const slice = side === 'left' ? round.slice(0, h1) : round.slice(h1);
    if (slice.length > 0) half.push(slice);
  });
  return half;
}

function _bcard(m, ri, mi) {
  const n1 = _slotName(m.p1name), n2 = _slotName(m.p2name);
  if (m.bye) {
    return `<div class="b-match b-done is-bye-match">
      <div class="b-team b-winner"><div class="b-name">${n1.html}</div><div class="b-score">→</div></div>
      <div class="b-team"><div class="b-name is-bye">BYE</div><div class="b-score"></div></div>
    </div>`;
  }
  const can = _canPlay(m);
  const w1 = m.done && m.sets1 > m.sets2, w2 = m.done && m.sets2 > m.sets1;
  const detail = m.done ? m.setScores.map(([a, b]) => `${a}-${b}`).join(' | ') : '';
  const tag = can ? 'button' : 'div';
  return `<${tag} class="b-match${can ? ' b-clickable' : ''}${m.done ? ' b-done' : ''}" ${can ? `onclick="abrirResultadoElim(${ri},${mi})" aria-label="Ingresar resultado ${n1.html} contra ${n2.html}"` : ''}>
    <div class="b-team${w1 ? ' b-winner' : ''}"><div class="b-name${n1.cls}">${n1.html}</div><div class="b-score${w1 ? ' b-winner' : ''}">${m.done ? m.sets1 : '–'}</div></div>
    <div class="b-team${w2 ? ' b-winner' : ''}"><div class="b-name${n2.cls}">${n2.html}</div><div class="b-score${w2 ? ' b-winner' : ''}">${m.done ? m.sets2 : '–'}</div></div>
    ${detail ? `<div class="b-detail">${detail}</div>` : ''}
    ${can ? `<div class="b-play-hint">Toca para ingresar</div>` : ''}
  </${tag}>`;
}

function _conn(matchCount) {
  const lines = Array.from({ length: Math.ceil(matchCount / 2) }, () => `
    <div class="conn-pair"><div class="conn-top"></div><div class="conn-mid"></div><div class="conn-bot"></div></div>`).join('');
  return `<div class="bracket-connector" aria-hidden="true">${lines}</div>`;
}

function abrirResultadoElim(ri, mi) { abrirResultado({ ri, mi }, 'elim'); }
