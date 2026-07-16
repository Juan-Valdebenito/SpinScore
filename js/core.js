/* SpinScore v1.8 — core.js */

const STATE = { cfg: { sets: 3, pts: 11 } };

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  if (id === 'screen-home')               updateHomeLabel();
  if (id === 'screen-quicksetup')         updateQSLabels();
  if (id === 'screen-tournament-bracket') renderBracket();
  if (id === 'screen-groups-main')        renderGroupsMain();
  if (id === 'screen-elimination')        renderElimination();
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

let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── PODIO ──
function mostrarPodio(names, tournamentName) {
  const cfg = [
    { cls:'gold-card',   color:'#F5C518', sym:'🥇', label:'1° Lugar' },
    { cls:'silver-card', color:'#C0C8D8', sym:'🥈', label:'2° Lugar' },
    { cls:'bronze-card', color:'#CD7F32', sym:'🥉', label:'3° / 4° Lugar' },
    { cls:'bronze-card', color:'#CD7F32', sym:'🥉', label:'3° / 4° Lugar' },
  ];
  document.getElementById('podio-tournament-name').textContent = tournamentName || '';
  document.getElementById('podio-cards').innerHTML = names.slice(0,4).map((name, i) => {
    const m = cfg[Math.min(i,3)];
    return `<div class="podio-card ${m.cls}">
      <div class="podio-sym">${m.sym}</div>
      <div>
        <div class="podio-name">${name}</div>
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

// ── PWA ──
if ('serviceWorker' in navigator) {
  const sw = `const C='spinscore-v18';
  const F=['./','./index.html','./css/style.css','./js/core.js','./js/match.js','./js/liga.js','./js/grupos.js','./js/eliminacion.js'];
  self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting();});
  self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`;
  navigator.serviceWorker.register(
    URL.createObjectURL(new Blob([sw],{type:'application/javascript'}))
  ).catch(()=>{});
}

window.addEventListener('load', () => {
  _syncChips();
  updateHomeLabel();
  const installed = window.matchMedia('(display-mode:standalone)').matches || navigator.standalone;
  if (!installed)
    setTimeout(() => document.getElementById('install-banner').classList.remove('d-none'), 1500);
});

window.addEventListener('resize', () => {
  const a = document.querySelector('.screen.active');
  if (!a) return;
  if (a.id === 'screen-groups-main') renderGroupTabContent();
  if (a.id === 'screen-elimination') renderElimination();
});
