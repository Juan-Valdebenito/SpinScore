/* SpinScore — public.js
   Vista pública de solo lectura: muestra un torneo compartido por link
   o guardado en este navegador.
*/

themeInit();

const GROUP_COLORS = ['#4FC3F7','#F5C518','#F87171','#22C55E','#A78BFA','#FB923C','#F472B6','#34D399'];
const GROUP_NAMES  = ['A','B','C','D','E','F','G','H'];
const ROUND_NAMES  = ['Dieciseisavos','Octavos de Final','Cuartos de Final','Semifinal','Final'];
const REFRESH_MS   = 30000;

let currentTab = 0;
let data = null;
let fromLink = false;

/**
 * Fuente de datos:
 *  - #hash → torneo compartido por link (funciona en cualquier dispositivo; es una foto del momento).
 *  - ?id=  → torneo guardado en este navegador (se refresca solo cada 30 s).
 */
async function loadData() {
  const hash = location.hash.slice(1);
  if (hash) {
    fromLink = true;
    try { data = await decodeShare(hash); } catch { data = null; }
    if (!torneoPublicoValido(data)) data = null;
  } else {
    const guardados = readJSON('spinscore_torneos', []);
    const all = Array.isArray(guardados) ? guardados.filter(torneoPublicoValido) : [];
    const id = new URLSearchParams(location.search).get('id');
    data = (id ? all.find(t => t.id === id) : all.find(t => t.status === 'active')) || null;
  }
  render();
  if (!fromLink) setTimeout(loadData, REFRESH_MS);
}

function render() {
  const refresh = document.getElementById('pub-refresh');
  if (!data) {
    document.getElementById('pub-name').textContent = 'Torneo no encontrado';
    document.getElementById('pub-content').innerHTML = fromLink
      ? '<div class="empty">El link está incompleto o dañado.<br>Pide que te lo compartan de nuevo desde SpinScore.</div>'
      : '<div class="empty">No se encontró ningún torneo activo en este dispositivo.<br>Abre la app y usa “Compartir link” desde un torneo.</div>';
    refresh.textContent = '';
    return;
  }
  document.title = `${data.name} — SpinScore`;
  document.getElementById('pub-name').textContent = data.name;
  const fmt = data.cfg ? ` · Al mejor de ${data.cfg.sets} · ${data.cfg.pts} pts` : '';
  document.getElementById('pub-meta').textContent =
    `${data.players.length} jugadores · ${data.phase === 'elimination' ? 'Fase Eliminatoria' : 'Fase de Grupos'}${fmt}`;
  refresh.textContent = fromLink
    ? (data.sharedAt ? `Estado al ${new Date(data.sharedAt).toLocaleString('es-CL')} · pide un link nuevo para ver resultados posteriores` : '')
    : 'Esta página se actualiza cada 30 segundos';

  const groups = data.groups || [];
  const tabs = document.getElementById('pub-tabs');
  if (groups.length) {
    const hasElim = (data.elimRounds || []).length > 0 || (data.prelimMatches || []).length > 0;
    const maxTab = groups.length + (hasElim ? 1 : 0);
    if (currentTab > maxTab) currentTab = 0;
    tabs.innerHTML = groups.map((_, gi) =>
      `<button class="gtab${gi === currentTab ? ' active' : ''}" data-tab="${gi}">Grupo ${GROUP_NAMES[gi]}</button>`
    ).join('') +
    `<button class="gtab${currentTab === groups.length ? ' active' : ''}" data-tab="${groups.length}">General</button>` +
    (hasElim ? `<button class="gtab${currentTab === groups.length + 1 ? ' active' : ''}" data-tab="${groups.length + 1}">Eliminatoria</button>` : '');
  } else { tabs.innerHTML = ''; }

  renderContent();
}

function switchTab(idx) {
  currentTab = idx;
  document.querySelectorAll('.gtab').forEach((t, i) => t.classList.toggle('active', i === idx));
  renderContent();
}

function renderContent() {
  const c = document.getElementById('pub-content');
  if (!data) return;
  const groups = data.groups || [];
  if (((data.elimRounds?.length) || (data.prelimMatches?.length)) && currentTab === groups.length + 1) { renderElim(c); return; }
  if (currentTab === groups.length) { renderGeneral(c); return; }
  renderGroup(c, currentTab);
}

/** Cupos del grupo: con cabeza de serie dependen del tamaño (ver cuposGrupo en rules.js). */
function cupos(gi) {
  return data.seededMode ? cuposGrupo(data.groups[gi].length) : { directos: 2, previa: 0 };
}
function marca(gi, rank, done) {
  if (!done) return '';
  const { directos, previa } = cupos(gi);
  return rank < directos ? 'pass' : rank < directos + previa ? 'previa' : '';
}

function calcStats(gi) {
  return rankPlayers(data.groups[gi], (data.groupMatches || []).filter(m => m.groupIdx === gi));
}

const pname = i => esc(data.players[i]);
const detalleSets = m => m.done ? (m.setScores || []).map(([a, b]) => `${esc(a)}-${esc(b)}`).join(' | ') : '';

function renderGroup(c, gi) {
  const stats = calcStats(gi);
  const matches = (data.groupMatches || []).filter(m => m.groupIdx === gi);
  const allDone = matches.every(m => m.done);

  let html = `<div class="group-card">
    <div class="group-header"><div class="gbadge" style="background:${GROUP_COLORS[gi]};">G${GROUP_NAMES[gi]}</div> Grupo ${GROUP_NAMES[gi]}</div>
    <div class="gplayer ghead">
      <div class="gplayer-num">#</div><div class="gplayer-name">JUGADOR</div>
      <div class="gstats"><span>PTS</span><span>G</span><span>P</span><span>SETS</span></div>
    </div>`;
  stats.forEach((s, rank) => {
    const m = marca(gi, rank, allDone);
    html += `<div class="gplayer${m ? ' ' + m : ''}">
      <div class="gplayer-num">${rank + 1}${m === 'pass' ? '*' : m === 'previa' ? ' P' : ''}</div>
      <div class="gplayer-name${rank < 2 ? ' top' : ''}">${pname(s.idx)}</div>
      <div class="gstats">
        <span>${s.pts}</span>
        <span class="gstat-g">${s.won}</span>
        <span class="gstat-p">${s.lost}</span>
        <span>${esc(s.setW)}-${esc(s.setL)}</span>
      </div>
    </div>`;
  });
  html += `</div><div class="sub-title">Partidos</div>`;

  matches.forEach(m => {
    const w = m.done ? (m.sets1 > m.sets2 ? 'p1' : 'p2') : null;
    const detail = detalleSets(m);
    html += `<div class="match-row">
      <div class="match-p${w === 'p1' ? ' win' : ''}">${pname(m.p1)}</div>
      ${m.done
        ? `<div class="match-score done score-blue">${esc(m.sets1)}</div><span class="dash">–</span><div class="match-score done score-red">${esc(m.sets2)}</div>`
        : `<div class="match-score"><span class="match-pending">vs</span></div>`}
      <div class="match-p text-right${w === 'p2' ? ' win' : ''}">${pname(m.p2)}</div>
    </div>
    ${detail ? `<div class="match-detail">${detail}</div>` : ''}`;
  });

  if (allDone) {
    const { directos, previa } = cupos(gi);
    const pasan = stats.slice(0, directos).map(s => pname(s.idx));
    const aPrevia = stats.slice(directos, directos + previa).map(s => pname(s.idx));
    const lista = pasan.length > 1 ? `${pasan.slice(0, -1).join(', ')} y ${pasan.at(-1)}` : pasan[0];
    html += `<div class="advance">Clasifica${pasan.length > 1 ? 'n' : ''}: <b>${lista}</b>` +
      (aPrevia.length ? `<br>Llave previa: <b>${aPrevia.join(', ')}</b>` : '') + `</div>`;
  }
  c.innerHTML = html;
}

function renderGeneral(c) {
  let html = '';
  data.groups.forEach((_, gi) => {
    const stats = calcStats(gi);
    const done = (data.groupMatches || []).filter(m => m.groupIdx === gi).every(m => m.done);
    html += `<div class="group-card">
      <div class="group-header"><div class="gbadge" style="background:${GROUP_COLORS[gi]};">G${GROUP_NAMES[gi]}</div>Grupo ${GROUP_NAMES[gi]}${done ? '<span class="gdone">✓ Completo</span>' : ''}</div>`;
    stats.forEach((s, rank) => {
      const m = marca(gi, rank, done);
      html += `<div class="gplayer${m ? ' ' + m : ''}">
        <div class="gplayer-num">${rank + 1}${m === 'pass' ? '*' : m === 'previa' ? ' P' : ''}</div>
        <div class="gplayer-name small${rank < 2 ? ' top' : ''}">${pname(s.idx)}</div>
        <div class="gstats"><span class="gstat-g">${s.won}G</span><span class="gstat-p">${s.lost}P</span><span>${s.pts}pts</span></div>
      </div>`;
    });
    html += `</div>`;
  });
  if (data.elimRounds?.length || data.prelimMatches?.length) {
    html += `<button class="btn-elim" data-tab="${data.groups.length + 1}">Ver Cuadro Eliminatorio →</button>`;
  }
  c.innerHTML = html;
}

function slot(n) {
  if (n === 'BYE') return { html: 'BYE', cls: ' tbd' };
  if (!n || n === 'TBD') return { html: 'Por definir', cls: ' tbd' };
  return { html: esc(n), cls: '' };
}

function renderElim(c) {
  const rounds = data.elimRounds || [], total = rounds.length;
  let html = '';
  if (data.prelimMatches?.length) {
    const directo = (data.prelimDirect || []).map(p => pname(p.id)).join(', ');
    html += `<div class="round-title">Ronda previa</div><div class="match-detail">${rounds.length ? 'Sus ganadores ya están en el cuadro eliminatorio.' : 'Los ganadores entran al cuadro eliminatorio.'}</div>`;
    if (directo) html += `<div class="match-detail"><b>${directo}</b> pasa directo por ser el mejor clasificado.</div>`;
    data.prelimMatches.forEach(m => {
      const n1 = slot(m.p1name), n2 = slot(m.p2name), w1 = m.done && m.winner === m.p1;
      const detail = detalleSets(m);
      html += `<div class="elim-match"><div class="elim-player"><span class="${w1 ? 'win' : ''}">${n1.html}</span><b>${m.done ? esc(m.sets1) : '–'}</b></div><div class="elim-player"><span class="${m.done && !w1 ? 'win' : ''}">${n2.html}</span><b>${m.done ? esc(m.sets2) : '–'}</b></div>${detail ? `<div class="match-detail">${detail}</div>` : ''}</div>`;
    });
    if (!rounds.length) { c.innerHTML = html; return; }
  }
  rounds.forEach((round, ri) => {
    const fe = total - 1 - ri;
    html += `<div class="round-title">${fe < ROUND_NAMES.length ? ROUND_NAMES[ROUND_NAMES.length - 1 - fe] : `Ronda ${ri + 1}`}</div>`;
    round.forEach(m => {
      const n1 = slot(m.p1name), n2 = slot(m.p2name);
      if (m.bye) {
        html += `<div class="elim-match bye"><div class="elim-player"><div class="elim-name winner">${n1.html}</div><div class="elim-sets">→</div></div><div class="elim-detail">Pasa directo (BYE)</div></div>`;
        return;
      }
      const w1 = m.done && m.sets1 > m.sets2, w2 = m.done && m.sets2 > m.sets1;
      const detail = detalleSets(m);
      html += `<div class="elim-match">
        <div class="elim-player"><div class="elim-name${w1 ? ' winner' : n1.cls}">${n1.html}</div><div class="elim-sets${w1 ? ' winner' : ''}">${m.done ? esc(m.sets1) : '–'}</div></div>
        <div class="elim-player"><div class="elim-name${w2 ? ' winner' : n2.cls}">${n2.html}</div><div class="elim-sets${w2 ? ' winner' : ''}">${m.done ? esc(m.sets2) : '–'}</div></div>
        ${detail ? `<div class="elim-detail">${detail}</div>` : ''}
      </div>`;
    });
  });
  if (data.podio?.length) {
    html += `<div class="round-title podio-title">Podio Final</div>`;
    const medals = [
      { cls: 'gold-card', place: 1, label: '1° Lugar' },
      { cls: '', place: 2, label: '2° Lugar' },
      { cls: '', place: 3, label: '3° Lugar' },
      { cls: '', place: 3, label: '3° Lugar' },
    ];
    data.podio.slice(0, 4).forEach((n, i) => {
      const m = medals[i];
      html += `<div class="podio-card ${m.cls}"><div class="podio-sym"><span class="medal medal-${m.place}" aria-hidden="true">${m.place}</span></div><div><div class="podio-name">${esc(n)}</div><div class="podio-pos">${m.label}</div></div></div>`;
    });
  }
  c.innerHTML = html;
}

document.addEventListener('click', e => {
  const boton = e.target.closest('[data-tab]');
  if (boton) switchTab(Number(boton.dataset.tab));
});
window.addEventListener('hashchange', () => { currentTab = 0; loadData(); });
applyVersionLabels();
loadData();
