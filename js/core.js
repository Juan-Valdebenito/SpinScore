/* SpinScore v1.9 — core.js */

const STATE = { cfg: { sets: 3, pts: 11 } };

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'screen-home')               { updateHomeLabel(); renderHomeButtons(); setPageTitle(null); }
  if (id === 'screen-quicksetup')         { updateQSLabels(); setPageTitle('Partido Rapido'); }
  if (id === 'screen-tournament-bracket') { renderBracket(); setPageTitle(LIGA.name || 'Liga'); }
  if (id === 'screen-groups-main')        { renderGroupsMain(); setPageTitle(getGT().name || 'Torneo'); }
  if (id === 'screen-elimination')        { renderElimination(); setPageTitle((getGT().name || 'Torneo') + ' · Eliminatoria'); }
  if (id === 'screen-mis-torneos')        { renderMisTorneos(); setPageTitle('Mis Torneos'); }
  if (id === 'screen-settings')           setPageTitle('Configuracion');
  if (id === 'screen-contact')            setPageTitle('Contacto');
}

function updateHomeLabel() {
  const el = document.getElementById('home-cfg-label');
  if (el) el.textContent = `${STATE.cfg.sets} sets · ${STATE.cfg.pts} puntos`;
}

function selectCfg(type, val) {
  if (type === 'sets') {
    STATE.cfg.sets = val;
    document.querySelectorAll('#chips-sets .ss-chip').forEach(c =>
      c.classList.toggle('active', +c.dataset.val === val));
    const el = document.getElementById('cfg-display-sets');
    if (el) el.textContent = val;
  } else {
    STATE.cfg.pts = val;
    document.querySelectorAll('#chips-pts .ss-chip').forEach(c =>
      c.classList.toggle('active', +c.dataset.val === val));
    const el = document.getElementById('cfg-display-pts');
    if (el) el.textContent = val;
  }
  updateHomeLabel();
}

function _syncChips() {
  document.querySelectorAll('#chips-sets .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === STATE.cfg.sets));
  document.querySelectorAll('#chips-pts .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === STATE.cfg.pts));
  document.querySelectorAll('#chips-groups .ss-chip').forEach(c =>
    c.classList.toggle('active', +c.dataset.val === (typeof GT !== 'undefined' ? GT.numGroups : 4)));
}

// ── ACTIVE TORNEOS HOME ──
function renderHomeButtons() {
  const container = document.getElementById('home-active-torneos');
  if (!container) return;
  const activos = storageGetAll().filter(t => t.status === 'active');
  if (!activos.length) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <div style="padding:0 0 8px;">
      <div class="active-torneos-label">Torneos en curso</div>
      ${activos.map(t => `
        <button class="active-torneo-btn" onclick="reanudarTorneo('${t.id}')">
          <div class="active-torneo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="9" height="8" rx="1"/><rect x="13" y="3" width="9" height="8" rx="1"/><rect x="2" y="13" width="9" height="8" rx="1"/><rect x="13" y="13" width="9" height="8" rx="1"/></svg>
          </div>
          <div style="flex:1;">
            <div class="active-torneo-name">${t.name}</div>
            <div class="active-torneo-meta">${t.players.length} jugadores · ${t.phase==='elimination'?'Eliminatoria':'Fase de grupos'}</div>
          </div>
          <div class="active-torneo-arrow">▶</div>
        </button>`).join('')}
    </div>`;
}

function reanudarTorneo(id) {
  const snap = storageGetAll().find(t => t.id === id);
  if (!snap) return;
  storageLoad(snap);
  renderGroupsMain();
  goTo('screen-groups-main');
}


// ── TITULO DE PAGINA ──
function setPageTitle(title) {
  document.title = title ? `${title} — SpinScore` : 'SpinScore — Marcador de Tenis de Mesa';
}

// ── TOAST ──
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── PODIO ──
function mostrarPodio(names, tournamentName) {
  const cfgP = [
    { cls:'gold-card',   color:'#F5C518', sym:'🥇', label:'1° Lugar' },
    { cls:'silver-card', color:'#C0C8D8', sym:'🥈', label:'2° Lugar' },
    { cls:'bronze-card', color:'#CD7F32', sym:'🥉', label:'3° / 4° Lugar' },
    { cls:'bronze-card', color:'#CD7F32', sym:'🥉', label:'3° / 4° Lugar' },
  ];
  document.getElementById('podio-tournament-name').textContent = tournamentName || '';
  document.getElementById('podio-cards').innerHTML = names.slice(0,4).map((name,i) => {
    const m = cfgP[Math.min(i,3)];
    return `<div class="podio-card ${m.cls}">
      <div class="podio-sym">${m.sym}</div>
      <div>
        <div class="podio-name">${name}</div>
        <div class="podio-label" style="color:${m.color};">${m.label}</div>
      </div>
    </div>`;
  }).join('');
  const GT = getGT();
  GT.podio = names;
  storageSnapshot();
  storageFinish(GT.id);
  document.getElementById('podio-screen').classList.add('show');
}

function cerrarPodio() {
  document.getElementById('podio-screen').classList.remove('show');
  goTo('screen-home');
}

// ── MIS TORNEOS ──
function renderMisTorneos() {
  const all = storageGetAll();
  const activos    = all.filter(t => t.status === 'active');
  const terminados = all.filter(t => t.status === 'finished');
  const container  = document.getElementById('mis-torneos-content');
  let html = '';

  if (!all.length) {
    container.innerHTML = `<div class="empty-state"><div style="font-size:40px;margin-bottom:12px;">📋</div><div style="font-weight:700;font-size:17px;margin-bottom:6px;">Sin torneos aún</div><div style="color:var(--ss-muted);font-size:14px;">Crea un Torneo por Grupos desde el inicio</div></div>`;
    return;
  }

  if (activos.length) {
    html += `<div class="ss-section-label">En curso (${activos.length})</div>`;
    activos.forEach(t => {
      const pct = _torneoProgress(t);
      html += `<div class="torneo-card torneo-active">
        <div class="torneo-card-header">
          <div><div class="torneo-card-name">${t.name}</div><div class="torneo-card-meta">${t.players.length} jugadores · ${t.phase==='elimination'?'Fase eliminatoria':'Fase de grupos'}</div></div>
          <button class="btn-delete-torneo" onclick="eliminarTorneo('${t.id}',event)">✕</button>
        </div>
        <div class="torneo-progress-bar"><div class="torneo-progress-fill" style="width:${pct}%"></div></div>
        <div class="torneo-progress-label">${pct}% completado</div>
        <button class="btn-primary mt-2" onclick="reanudarTorneo('${t.id}')">Continuar torneo</button>
      </div>`;
    });
  }

  if (terminados.length) {
    html += `<div class="ss-section-label" style="margin-top:20px;">Historial (${terminados.length})</div>`;
    terminados.forEach(t => {
      const fecha = t.finishedAt ? new Date(t.finishedAt).toLocaleDateString('es-CL') : '';
      html += `<div class="torneo-card">
        <div class="torneo-card-header">
          <div><div class="torneo-card-name">${t.name}</div><div class="torneo-card-meta">${t.players.length} jugadores · ${fecha}</div></div>
          <button class="btn-delete-torneo" onclick="eliminarTorneo('${t.id}',event)">✕</button>
        </div>
        <div class="torneo-podio-preview">
          ${(t.podio||[]).slice(0,3).map((n,i)=>['🥇','🥈','🥉'][i]+' '+n).map(x=>`<span class="torneo-podio-item">${x}</span>`).join('')}
        </div>
      </div>`;
    });
    html += `<button class="btn-secondary mt-3 w-100" onclick="limpiarHistorial()">Limpiar historial</button>`;
  }
  container.innerHTML = html;
}

function _torneoProgress(t) {
  const total = (t.groupMatches||[]).length + (t.elimRounds||[]).reduce((s,r)=>s+r.length,0);
  const done  = (t.groupMatches||[]).filter(m=>m.done).length + (t.elimRounds||[]).reduce((s,r)=>s+r.filter(m=>m.done).length,0);
  return total===0?0:Math.round((done/total)*100);
}

function eliminarTorneo(id,e) {
  e.stopPropagation();
  if (!confirm('¿Eliminar este torneo?')) return;
  storageDelete(id); renderMisTorneos(); renderHomeButtons();
}

function limpiarHistorial() {
  if (!confirm('¿Limpiar todos los torneos terminados?')) return;
  const activos = storageGetAll().filter(t=>t.status==='active');
  localStorage.setItem('spinscore_torneos', JSON.stringify(activos));
  renderMisTorneos();
}

// ── PWA ──
if ('serviceWorker' in navigator) {
  const sw = `const C='spinscore-v195';
  const F=['./','./index.html','./css/style.css',
    './js/theme.js','./js/storage.js','./js/core.js',
    './js/theme.js','./js/storage.js','./js/match.js','./js/liga.js','./js/grupos.js','./js/eliminacion.js'];
  self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting();});
  self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`;
  navigator.serviceWorker.register(
    URL.createObjectURL(new Blob([sw],{type:'application/javascript'}))
  ).catch(()=>{});
}

window.addEventListener('load', () => {
  themeInit();
  _syncChips();
  updateHomeLabel();
  renderHomeButtons();
  const installed = window.matchMedia('(display-mode:standalone)').matches || navigator.standalone;
  if (!installed)
    setTimeout(() => document.getElementById('install-banner').classList.remove('d-none'), 1500);
});

window.addEventListener('resize', () => {
  const a = document.querySelector('.screen.active');
  if (!a) return;
  if (a.id==='screen-groups-main') renderGroupTabContent();
  if (a.id==='screen-elimination') renderElimination();
});
