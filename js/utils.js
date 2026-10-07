/* SpinScore — utils.js
   Utilidades compartidas por app.html, public.html y multimesa.html.
*/

const APP_VERSION = '2.3.0';

// ── HTML SEGURO ────────────────────────────

/** Escapa texto para interpolarlo en HTML (nombres de jugadores, torneos, etc.). */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── LOCALSTORAGE ───────────────────────────

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    if (typeof showToast === 'function') showToast('No se pudo guardar (almacenamiento lleno o bloqueado)');
    return false;
  }
}

function removeKey(key) {
  try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
}

// ── LINK COMPARTIDO ────────────────────────
// El torneo viaja dentro del hash de la URL (#z... comprimido o #j... plano),
// así el link funciona en cualquier dispositivo sin backend.

function _b64urlFromBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _bytesFromB64url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function _pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

async function encodeShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + _b64urlFromBytes(await _pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + _b64urlFromBytes(bytes);
}

async function decodeShare(str) {
  const kind = str[0], body = str.slice(1);
  if (kind === 'z') {
    const bytes = await _pipe(_bytesFromB64url(body), new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  if (kind === 'j') return JSON.parse(new TextDecoder().decode(_bytesFromB64url(body)));
  // Formato antiguo: JSON en base64 simple
  return JSON.parse(atob(str));
}

// ── DIÁLOGOS (reemplazan confirm/prompt nativos) ──

function _dialog({ title = '', message = '', input = null, okText = 'Aceptar', cancelText = 'Cancelar', danger = false }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'ss-dialog-overlay';
    overlay.innerHTML = `
      <div class="ss-dialog" role="dialog" aria-modal="true" aria-labelledby="ss-dialog-title">
        ${title ? `<div class="ss-dialog-title" id="ss-dialog-title">${esc(title)}</div>` : ''}
        ${message ? `<div class="ss-dialog-msg">${esc(message)}</div>` : ''}
        ${input !== null ? `<input class="ss-dialog-input" type="text" value="${esc(input)}" aria-label="${esc(title || message)}">` : ''}
        <div class="ss-dialog-btns">
          <button type="button" class="ss-dialog-cancel">${esc(cancelText)}</button>
          <button type="button" class="ss-dialog-ok${danger ? ' danger' : ''}">${esc(okText)}</button>
        </div>
      </div>`;
    const field = overlay.querySelector('.ss-dialog-input');
    const prevFocus = document.activeElement;
    const close = value => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(value);
    };
    const ok = () => close(field ? field.value : true);
    const cancel = () => close(field ? null : false);
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        document.activeElement === overlay.querySelector('.ss-dialog-cancel') ? cancel() : ok();
      }
    };
    overlay.querySelector('.ss-dialog-ok').onclick = ok;
    overlay.querySelector('.ss-dialog-cancel').onclick = cancel;
    overlay.addEventListener('click', e => { if (e.target === overlay) cancel(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    (field || overlay.querySelector('.ss-dialog-ok')).focus();
    if (field) field.select();
  });
}

/** @returns {Promise<boolean>} */
function ssConfirm(message, opts = {}) {
  return _dialog({ title: opts.title || '¿Estás seguro?', message, okText: opts.okText || 'Aceptar', danger: !!opts.danger });
}

/** @returns {Promise<string|null>} */
function ssPrompt(title, defaultValue = '') {
  return _dialog({ title, input: defaultValue, okText: 'Guardar' });
}

// ── PWA ────────────────────────────────────

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').catch(err =>
    console.warn('[SpinScore] Service worker no registrado:', err));
}

function applyVersionLabels() {
  document.querySelectorAll('.app-version').forEach(el => { el.textContent = APP_VERSION; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { esc, encodeShare, decodeShare };
}
