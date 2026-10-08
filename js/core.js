/* SpinScore — core.js
   Navegación, inicio, Mis Torneos, categorías, compartir, podio y PWA.
*/

const STATE = { cfg: cfgGet() };

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'screen-home')               { updateHomeLabel(); renderHomeButtons(); setPageTitle(null); }
  if (id === 'screen-quicksetup')         { updateQSLabels(); setPageTitle('Partido Rápido'); }
  if (id === 'screen-tournament-setup')   setPageTitle('Nueva Liga');
  if (id === 'screen-tournament-bracket') { renderBracket(); setPageTitle(LIGA.name || 'Liga'); }
  if (id === 'screen-groups-main')        { renderGroupsMain(); setPageTitle(getGT().name || 'Torneo'); }
  if (id === 'screen-elimination')        { renderElimination(); setPageTitle((getGT().name || 'Torneo') + ' · Eliminatoria'); }
  if (id === 'screen-mis-torneos')        { renderMisTorneos(); setPageTitle('Mis Torneos'); }
  if (id === 'screen-categorias')         { renderCategorias(); setPageTitle('Categorías'); }
  if (id === 'screen-settings')           setPageTitle('Configuración');
  if (id === 'screen-contact')            setPageTitle('Contacto');
}

function updateHomeLabel() {
  const el = document.getElementById('home-cfg-label');
  if (el) el.textContent = `${STATE.cfg.sets} sets · ${STATE.cfg.pts} puntos`;
}

function selectCfg(type, val) {
  STATE.cfg[type] = val;
  cfgSave(STATE.cfg);
  _syncChips();
  updateHomeLabel();
}

function _syncChips() {
  document.querySelectorAll('#chips-sets .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === STATE.cfg.sets));
  document.querySelectorAll('#chips-pts .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === STATE.cfg.pts));
  document.querySelectorAll('#chips-groups .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === getGT().numGroups));
  const s = document.getElementById('cfg-display-sets');
  const p = document.getElementById('cfg-display-pts');
  if (s) s.textContent = STATE.cfg.sets;
  if (p) p.textContent = STATE.cfg.pts;
}

function formatLabel(cfg) {
  return `${cfg.sets} set${cfg.sets > 1 ? 's' : ''} · ${cfg.pts} pts`;
}

// ── EN CURSO (HOME) ────────────────────────
const ICON_GROUPS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><rect x="2" y="3" width="9" height="8" rx="1"/><rect x="13" y="3" width="9" height="8" rx="1"/><rect x="2" y="13" width="9" height="8" rx="1"/><rect x="13" y="13" width="9" height="8" rx="1"/></svg>';
const ICON_TROPHY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9H4a2 2 0 0 0-2 2v1a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6v-1a2 2 0 0 0-2-2h-2"/><rect x="6" y="2" width="12" height="10" rx="2"/></svg>';
const ICON_BOLT   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

function _activeBtn(onclick, icon, name, meta) {
  return `
    <button class="active-torneo-btn" onclick="${onclick}">
      <div class="active-torneo-icon">${icon}</div>
      <div class="flex-1">
        <div class="active-torneo-name">${esc(name)}</div>
        <div class="active-torneo-meta">${esc(meta)}</div>
      </div>
      <div class="active-torneo-arrow" aria-hidden="true">▶</div>
    </button>`;
}

function renderHomeButtons() {
  const container = document.getElementById('home-active-torneos');
  if (!container) return;
  let items = '';

  const live = liveMatchGet();
  if (live && live.p) {
    items += _activeBtn('resumeLiveMatch()', ICON_BOLT,
      `${live.p[0]} vs ${live.p[1]}`,
      `Partido en vivo · ${live.sets[0]}-${live.sets[1]} en sets`);
  }
  if (LIGA.id && LIGA.status === 'active') {
    const done = LIGA.matches.filter(m => m.done).length;
    items += _activeBtn("goTo('screen-tournament-bracket')", ICON_TROPHY,
      LIGA.name, `Liga · ${done}/${LIGA.matches.length} partidos`);
  }
  storageGetAll().filter(t => t.status === 'active').forEach(t => {
    items += _activeBtn(`reanudarTorneo('${esc(t.id)}')`, ICON_GROUPS, t.name,
      `${t.players.length} jugadores · ${t.phase === 'elimination' ? 'Eliminatoria' : 'Fase de grupos'}`);
  });

  container.innerHTML = items
    ? `<div class="pb-2"><div class="active-torneos-label">En curso</div>${items}</div>`
    : '';
}

function reanudarTorneo(id) {
  const snap = storageGetAll().find(t => t.id === id);
  if (!snap) return;
  storageLoad(snap);
  goTo(snap.phase === 'elimination' ? 'screen-elimination' : 'screen-groups-main');
}

// ── TITULO DE PAGINA ──
function setPageTitle(title) {
  document.title = title ? `${title} — SpinScore` : 'SpinScore — Marcador de Tenis de Mesa';
}

// ── EXPORTAR PDF ──────────────────────────
function exportarPDF() {
  if (!getGT().name) { showToast('No hay torneo activo'); return; }
  window.print();
}

// ── VISTA PUBLICA / COMPARTIR ─────────────
function abrirVistaPublica() {
  const GT = getGT();
  if (!GT.id) { showToast('Guarda el torneo primero'); return; }
  window.open(`public.html?id=${encodeURIComponent(GT.id)}`, '_blank');
}

/** Datos mínimos que necesita public.html para mostrar el torneo. */
function _publicPayload(GT) {
  return {
    name: GT.name, cfg: GT.cfg, phase: GT.phase, players: GT.players,
    groups: GT.groups, groupMatches: GT.groupMatches, elimRounds: GT.elimRounds,
    podio: GT.podio || null, sharedAt: Date.now(),
  };
}

async function compartirTorneo() {
  const GT = getGT();
  if (!GT.id) { showToast('No hay torneo activo'); return; }
  let url;
  try {
    const hash = await encodeShare(_publicPayload(GT));
    url = new URL('public.html', location.href);
    url.hash = hash;
    url = url.href;
  } catch {
    showToast('No se pudo generar el link'); return;
  }
  try {
    if (navigator.share) {
      await navigator.share({ title: GT.name + ' — SpinScore', url });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // el usuario cerró el menú de compartir
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copiado · muestra el estado actual del torneo');
  } catch {
    await ssPrompt('Copia este link', url);
  }
}

// ── TOAST ──
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── PODIO ──
const PODIO_META = {
  1: { cls: 'gold-card',   color: '#F5C518', label: '1° Lugar' },
  2: { cls: 'silver-card', color: '#C9D1DC', label: '2° Lugar' },
  3: { cls: 'bronze-card', color: '#D98C4A', label: '3° Lugar' },
  4: { cls: '',            color: 'var(--ss-muted)', label: '4° Lugar' },
};

/** Medalla con el número del lugar (reemplaza los emojis 🥇🥈🥉). */
function medalHTML(place, small = false) {
  return `<span class="medal medal-${Math.min(place, 4)}${small ? ' medal-sm' : ''}" aria-hidden="true">${place}</span>`;
}

/**
 * Muestra la pantalla de podio (solo presentación; quien llama persiste el resultado).
 * @param {string[]} names
 * @param {string} tournamentName
 * @param {number[]} places lugar de cada nombre. En eliminación directa ambos
 *   semifinalistas perdedores reciben bronce (3° compartido, como en la ITTF).
 */
function mostrarPodio(names, tournamentName, places = [1, 2, 3, 4]) {
  names = (Array.isArray(names) ? names : [])
    .map(entry => typeof entry === 'string' ? entry : entry?.name)
    .filter(Boolean);
  document.getElementById('podio-tournament-name').textContent = tournamentName || '';
  document.getElementById('podio-cards').innerHTML = names.slice(0, 4).map((name, i) => {
    const place = places[i] || 4, m = PODIO_META[place];
    return `<div class="podio-card ${m.cls}">
      <div class="podio-sym">${medalHTML(place)}</div>
      <div>
        <div class="podio-name">${esc(name)}</div>
        <div class="podio-label" style="color:${m.color};">${m.label}</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('podio-screen').classList.add('show');
}

function cerrarPodio() {
  document.getElementById('podio-screen').classList.remove('show');
  goTo('screen-home');
}

// ── MIS TORNEOS ──
function renderMisTorneos() {
  const all = storageGetAll();
  const cats = new Map(catsGetAll().map(c => [c.id, c.name]));
  const activos    = all.filter(t => t.status === 'active');
  const terminados = all.filter(t => t.status === 'finished');
  const container  = document.getElementById('mis-torneos-content');
  const catLabel = t => t.catId && cats.has(t.catId) ? ` · ${cats.get(t.catId)}` : '';
  let html = '';

  if (!all.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
      <div class="empty-title">Sin torneos aún</div>
      <div class="empty-sub">Crea un Torneo por Grupos desde el inicio</div>
    </div>`;
    return;
  }

  if (activos.length) {
    html += `<div class="ss-section-label">En curso (${activos.length})</div>`;
    activos.forEach(t => {
      const pct = _torneoProgress(t);
      html += `<div class="torneo-card torneo-active">
        <div class="torneo-card-header">
          <div>
            <div class="torneo-card-name">${esc(t.name)}</div>
            <div class="torneo-card-meta">${t.players.length} jugadores · ${t.phase === 'elimination' ? 'Fase eliminatoria' : 'Fase de grupos'}${esc(catLabel(t))}</div>
          </div>
          <button class="btn-delete-torneo" aria-label="Eliminar torneo ${esc(t.name)}" onclick="eliminarTorneo('${esc(t.id)}')">✕</button>
        </div>
        <div class="torneo-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="torneo-progress-fill" style="width:${pct}%"></div></div>
        <div class="torneo-progress-label">${pct}% completado</div>
        <button class="btn-primary mt-2" onclick="reanudarTorneo('${esc(t.id)}')">Continuar torneo</button>
      </div>`;
    });
  }

  if (terminados.length) {
    html += `<div class="ss-section-label mt-section">Historial (${terminados.length})</div>`;
    terminados.forEach(t => {
      const fecha = t.finishedAt ? new Date(t.finishedAt).toLocaleDateString('es-CL') : '';
      html += `<div class="torneo-card">
        <div class="torneo-card-header">
          <div>
            <div class="torneo-card-name">${esc(t.name)}</div>
            <div class="torneo-card-meta">${t.players.length} jugadores · ${fecha}${esc(catLabel(t))}</div>
          </div>
          <button class="btn-delete-torneo" aria-label="Eliminar torneo ${esc(t.name)}" onclick="eliminarTorneo('${esc(t.id)}')">✕</button>
        </div>
        <div class="torneo-podio-preview">
          ${(t.podio || []).slice(0, 3).map((n, i) => `<span class="torneo-podio-item">${medalHTML(i + 1, true)}${esc(n)}</span>`).join('')}
        </div>
        <button class="btn-secondary mt-3 w-100" onclick="reanudarTorneo('${esc(t.id)}')">Ver torneo</button>
      </div>`;
    });
    html += `<button class="btn-secondary mt-3 w-100" onclick="limpiarHistorial()">Limpiar historial</button>`;
  }
  container.innerHTML = html;
}

function _torneoProgress(t) {
  const real = m => m.p1name !== 'BYE' && m.p2name !== 'BYE' && !m.bye;
  const elim = (t.elimRounds || []).flat().filter(real);
  const total = (t.groupMatches || []).length + elim.length;
  const done  = (t.groupMatches || []).filter(m => m.done).length + elim.filter(m => m.done).length;
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

async function eliminarTorneo(id) {
  if (!await ssConfirm('Se borrarán todos sus resultados.', { title: '¿Eliminar este torneo?', okText: 'Eliminar', danger: true })) return;
  storageDelete(id);
  renderMisTorneos(); renderHomeButtons();
}

async function limpiarHistorial() {
  if (!await ssConfirm('Se borrarán todos los torneos terminados.', { title: '¿Limpiar historial?', okText: 'Limpiar', danger: true })) return;
  storageClearFinished();
  renderMisTorneos();
}

// ── CATEGORÍAS UI ──────────────────────────
function addCategoria() {
  const input = document.getElementById('cat-input');
  const name = input.value.trim();
  if (!name) return;
  if (catsGetAll().some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('Esa categoría ya existe'); return;
  }
  catSave({ id: catNewId(), name, createdAt: Date.now() });
  input.value = '';
  renderCategorias();
}

function renderCategorias() {
  const cats = catsGetAll();
  const container = document.getElementById('cat-list');
  if (!container) return;
  if (!cats.length) {
    container.innerHTML = `<div class="empty-state empty-state-sm">
      <div class="empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
      <div class="empty-title">Sin categorías</div>
      <div class="empty-sub">Agrega categorías para organizar tus torneos</div>
    </div>`;
    return;
  }
  const torneos = storageGetAll();
  container.innerHTML = cats.map(cat => {
    const deCat = torneos.filter(t => t.catId === cat.id);
    const activos = deCat.filter(t => t.status === 'active').length;
    const terminados = deCat.filter(t => t.status === 'finished').length;
    return `<div class="player-item cat-item">
      <div class="cat-item-row">
        <div class="cat-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
        <div class="flex-1">
          <div class="cat-name">${esc(cat.name)}</div>
          <div class="cat-meta">${activos} activo${activos !== 1 ? 's' : ''} · ${terminados} finalizado${terminados !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn-remove" aria-label="Eliminar categoría ${esc(cat.name)}" onclick="deleteCategoria('${esc(cat.id)}')">✕</button>
      </div>
      <button class="btn-primary btn-compact" onclick="nuevoCatTorneo('${esc(cat.id)}')">+ Nuevo torneo en esta categoría</button>
    </div>`;
  }).join('');
}

async function deleteCategoria(id) {
  if (!await ssConfirm('También se eliminarán todos sus torneos.', { title: '¿Eliminar esta categoría?', okText: 'Eliminar', danger: true })) return;
  catDelete(id);
  renderCategorias();
  renderHomeButtons();
}

function nuevoCatTorneo(catId) {
  const cat = catsGetAll().find(c => c.id === catId);
  if (!cat) return;
  nuevoTorneoGrupos(cat.id, cat.name);
}

// ── INSTALACIÓN PWA ──
let _installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  const btn = document.getElementById('install-btn');
  const txt = document.getElementById('install-text');
  if (btn) btn.classList.remove('d-none');
  if (txt) txt.textContent = 'Instala SpinScore para usarlo sin conexión';
  document.getElementById('install-banner')?.classList.remove('d-none');
});

async function instalarApp() {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  await _installPrompt.userChoice;
  _installPrompt = null;
  document.getElementById('install-banner').classList.add('d-none');
}

// ── ARRANQUE ──
registerServiceWorker();

window.addEventListener('load', () => {
  themeInit();
  applyVersionLabels();
  _syncChips();
  updateHomeLabel();
  renderHomeButtons();
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!installed)
    setTimeout(() => document.getElementById('install-banner').classList.remove('d-none'), 1500);
});

window.addEventListener('resize', debounce(() => {
  const a = document.querySelector('.screen.active');
  if (!a) return;
  if (a.id === 'screen-groups-main') renderGroupTabContent();
  if (a.id === 'screen-elimination') renderElimination();
}, 150));
