/* ═══════════════════════════════════════════
   SpinScore v1.4 — core.js
   Estado global, configuración y navegación
═══════════════════════════════════════════ */

// ── CONFIGURACIÓN GLOBAL ──────────────────
const STATE = {
  cfg: { sets: 3, pts: 11 },
};

// ── NAVEGACIÓN ────────────────────────────
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);

  // Hooks de entrada a cada pantalla
  if (id === 'screen-home')                 updateHomeLabel();
  if (id === 'screen-quicksetup')           updateQSLabels();
  if (id === 'screen-tournament-bracket')   renderBracket();
  if (id === 'screen-groups-main')          renderGroupsMain();
  if (id === 'screen-elimination')          renderElimination();
}

// ── CONFIGURACIÓN ─────────────────────────
function updateHomeLabel() {
  const el = document.getElementById('home-cfg-label');
  if (el) el.textContent = `${STATE.cfg.sets} sets · ${STATE.cfg.pts} puntos`;
}

function selectCfg(type, val) {
  if (type === 'sets') {
    STATE.cfg.sets = val;
    document.querySelectorAll('#chips-sets .chip').forEach(c =>
      c.classList.toggle('active', +c.dataset.val === val));
    document.getElementById('cfg-display-sets').textContent = val;
  } else {
    STATE.cfg.pts = val;
    document.querySelectorAll('#chips-pts .chip').forEach(c =>
      c.classList.toggle('active', +c.dataset.val === val));
    document.getElementById('cfg-display-pts').textContent = val;
  }
}

// ── TOAST ─────────────────────────────────
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── PWA ───────────────────────────────────
if ('serviceWorker' in navigator) {
  const sw = `
    const C = 'spinscore-v15';
    const F = ['./', './index.html', './css/style.css',
               './js/core.js','./js/match.js','./js/liga.js',
               './js/grupos.js','./js/eliminacion.js'];
    self.addEventListener('install', e => {
      e.waitUntil(caches.open(C).then(c => c.addAll(F)));
      self.skipWaiting();
    });
    self.addEventListener('fetch', e => {
      e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    });
  `;
  navigator.serviceWorker
    .register(URL.createObjectURL(new Blob([sw], { type: 'application/javascript' })))
    .catch(() => {});
}

window.addEventListener('load', () => {
  updateHomeLabel();
  const installed = window.matchMedia('(display-mode: standalone)').matches
                 || navigator.standalone;
  if (!installed) {
    setTimeout(() => document.getElementById('install-banner').classList.remove('d-none'), 1500);
  }
});

// Re-render responsive en resize
window.addEventListener('resize', () => {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'screen-groups-main')  renderGroupTabContent();
  if (active.id === 'screen-elimination')  renderElimination();
});
