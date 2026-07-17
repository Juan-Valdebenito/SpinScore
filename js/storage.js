/* SpinScore v1.8.5 — storage.js
   Manejo de múltiples torneos con localStorage
*/

const SS_KEY = 'spinscore_torneos';

// ── CRUD DE TORNEOS ────────────────────────

/** Devuelve todos los torneos guardados */
function storageGetAll() {
  try {
    return JSON.parse(localStorage.getItem(SS_KEY) || '[]');
  } catch { return []; }
}

/** Guarda (crea o actualiza) un torneo por su id */
function storageSave(torneo) {
  const all = storageGetAll();
  const idx = all.findIndex(t => t.id === torneo.id);
  if (idx >= 0) all[idx] = torneo;
  else all.unshift(torneo); // más reciente primero
  localStorage.setItem(SS_KEY, JSON.stringify(all));
}

/** Elimina un torneo por id */
function storageDelete(id) {
  const all = storageGetAll().filter(t => t.id !== id);
  localStorage.setItem(SS_KEY, JSON.stringify(all));
}

/** Genera un id único */
function storageNewId() {
  return 'T' + Date.now() + Math.random().toString(36).slice(2,6).toUpperCase();
}

/** Marca un torneo como terminado */
function storageFinish(id) {
  const all = storageGetAll();
  const t = all.find(x => x.id === id);
  if (t) { t.status = 'finished'; t.finishedAt = Date.now(); }
  localStorage.setItem(SS_KEY, JSON.stringify(all));
}

// ── SNAPSHOT DEL TORNEO ACTIVO ─────────────

/** Serializa el estado actual de GT para guardarlo */
function storageSnapshot() {
  const GT = getGT();
  if (!GT.id) return; // no hay torneo activo
  const snap = {
    id:           GT.id,
    name:         GT.name,
    status:       GT.phase === 'elimination' && _isFinalDone() ? 'finished' : 'active',
    createdAt:    GT.createdAt || Date.now(),
    finishedAt:   _isFinalDone() ? Date.now() : null,
    numGroups:    GT.numGroups,
    players:      GT.players,
    groups:       GT.groups,
    confirmed:    GT.confirmed,
    phase:        GT.phase,
    groupMatches: GT.groupMatches,
    elimRounds:   GT.elimRounds,
    podio:        GT.podio || null,
  };
  storageSave(snap);
}

function _isFinalDone() {
  const GT = getGT();
  if (!GT.elimRounds.length) return false;
  const fin = GT.elimRounds[GT.elimRounds.length - 1]?.[0];
  return fin?.done === true;
}

/** Carga un torneo guardado al estado GT */
function storageLoad(snap) {
  const GT = getGT();
  GT.id          = snap.id;
  GT.name        = snap.name;
  GT.createdAt   = snap.createdAt;
  GT.numGroups   = snap.numGroups;
  GT.players     = snap.players;
  GT.groups      = snap.groups;
  GT.confirmed   = snap.confirmed;
  GT.phase       = snap.phase;
  GT.groupMatches = snap.groupMatches;
  GT.elimRounds  = snap.elimRounds || [];
  GT.currentGroupTab = 0;
  GT.podio       = snap.podio || null;
}
