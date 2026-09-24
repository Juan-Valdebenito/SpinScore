/* SpinScore — storage.js
   Persistencia en localStorage: torneos por grupos, categorías, liga,
   partido en vivo y configuración.
*/

const SS_KEY     = 'spinscore_torneos';
const CAT_KEY    = 'spinscore_cats';
const LIGA_KEY   = 'spinscore_liga';
const LIVE_KEY   = 'spinscore_live_match';
const CFG_KEY    = 'spinscore_cfg';

// ── CRUD DE TORNEOS ────────────────────────

/** Devuelve todos los torneos guardados */
function storageGetAll() {
  const all = readJSON(SS_KEY, []);
  return Array.isArray(all) ? all : [];
}

function _storageWriteAll(all) {
  writeJSON(SS_KEY, all);
}

/** Guarda (crea o actualiza) un torneo por su id */
function storageSave(torneo) {
  const all = storageGetAll();
  const idx = all.findIndex(t => t.id === torneo.id);
  if (idx >= 0) all[idx] = torneo;
  else all.unshift(torneo); // más reciente primero
  _storageWriteAll(all);
}

/** Elimina un torneo por id */
function storageDelete(id) {
  _storageWriteAll(storageGetAll().filter(t => t.id !== id));
}

/** Elimina todos los torneos terminados */
function storageClearFinished() {
  _storageWriteAll(storageGetAll().filter(t => t.status !== 'finished'));
}

/** Genera un id único */
function storageNewId() {
  return 'T' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// ── SNAPSHOT DEL TORNEO ACTIVO ─────────────

function _isFinalDone(elimRounds) {
  if (!elimRounds || !elimRounds.length) return false;
  return elimRounds[elimRounds.length - 1]?.[0]?.done === true;
}

/** Serializa el estado actual de GT y lo guarda */
function storageSnapshot() {
  const GT = getGT();
  if (!GT.id) return; // no hay torneo activo
  const finished = _isFinalDone(GT.elimRounds);
  if (finished && !GT.finishedAt) GT.finishedAt = Date.now();
  storageSave({
    id:           GT.id,
    name:         GT.name,
    catId:        GT.catId || null,
    cfg:          GT.cfg,
    status:       finished ? 'finished' : 'active',
    createdAt:    GT.createdAt || Date.now(),
    finishedAt:   finished ? GT.finishedAt : null,
    numGroups:    GT.numGroups,
    players:      GT.players,
    groups:       GT.groups,
    confirmed:    GT.confirmed,
    phase:        GT.phase,
    groupMatches: GT.groupMatches,
    elimRounds:   GT.elimRounds,
    podio:        GT.podio || null,
  });
}

/** Carga un torneo guardado al estado GT */
function storageLoad(snap) {
  const GT = getGT();
  GT.id           = snap.id;
  GT.name         = snap.name;
  GT.catId        = snap.catId || null;
  GT.cfg          = snap.cfg || { ...STATE.cfg }; // torneos antiguos no guardaban su formato
  GT.createdAt    = snap.createdAt;
  GT.finishedAt   = snap.finishedAt || null;
  GT.numGroups    = snap.numGroups;
  GT.players      = snap.players;
  GT.groups       = snap.groups;
  GT.confirmed    = snap.confirmed;
  GT.phase        = snap.phase;
  GT.groupMatches = snap.groupMatches;
  GT.elimRounds   = snap.elimRounds || [];
  GT.currentGroupTab = 0;
  GT.podio        = snap.podio || null;
}

// ── CATEGORÍAS ─────────────────────────────

function catsGetAll() {
  const all = readJSON(CAT_KEY, []);
  return Array.isArray(all) ? all : [];
}

function catSave(cat) {
  const all = catsGetAll();
  const idx = all.findIndex(c => c.id === cat.id);
  if (idx >= 0) all[idx] = cat; else all.push(cat);
  writeJSON(CAT_KEY, all);
}

/** Elimina una categoría y todos sus torneos */
function catDelete(id) {
  writeJSON(CAT_KEY, catsGetAll().filter(c => c.id !== id));
  _storageWriteAll(storageGetAll().filter(t => t.catId !== id));
}

function catNewId() {
  return 'C' + Date.now() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ── LIGA ───────────────────────────────────

function ligaGet()       { return readJSON(LIGA_KEY, null); }
function ligaSave(liga)  { writeJSON(LIGA_KEY, liga); }

// ── PARTIDO EN VIVO ────────────────────────

function liveMatchGet()      { return readJSON(LIVE_KEY, null); }
function liveMatchSave(m)    { writeJSON(LIVE_KEY, m); }
function liveMatchClear()    { removeKey(LIVE_KEY); }

// ── CONFIGURACIÓN ──────────────────────────

function cfgGet() {
  const c = readJSON(CFG_KEY, null);
  return c && [1, 3, 5, 7].includes(c.sets) && c.pts > 0 ? c : { sets: 3, pts: 11 };
}
function cfgSave(cfg) { writeJSON(CFG_KEY, cfg); }
