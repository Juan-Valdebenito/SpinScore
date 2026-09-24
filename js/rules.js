/* SpinScore — rules.js
   Reglas puras del deporte (sin DOM): saque, sets, validación de resultados,
   clasificación con desempate ITTF y armado del cuadro eliminatorio.
   Se carga como script en el navegador y con require() en los tests de Node.
*/

// ── SAQUE Y SETS ───────────────────────────

/**
 * Jugador (0|1) que tiene el saque.
 * Cada jugador saca 2 puntos seguidos; desde el deuce (ambos en pts-1) se alterna cada punto.
 * El primer saque de cada set lo alterna respecto al set anterior.
 */
function serverFor(ptsA, ptsB, setsPlayed, pointsPerSet, firstServer = 0) {
  const total = ptsA + ptsB;
  const deuceStart = 2 * (pointsPerSet - 1);
  const turns = total < deuceStart
    ? Math.floor(total / 2)
    : (pointsPerSet - 1) + (total - deuceStart);
  return (firstServer + turns + setsPlayed) % 2;
}

function isSetWon(a, b, pointsPerSet) {
  return (a >= pointsPerSet || b >= pointsPerSet) && Math.abs(a - b) >= 2;
}

function isDeuce(a, b, pointsPerSet) {
  return a === b && a >= pointsPerSet - 1;
}

function setsNeededFor(bestOf) {
  return Math.ceil(bestOf / 2);
}

/**
 * Valida el resultado de un partido ingresado a mano.
 * @param {Array<[number,number]>} setScores
 * @param {{sets:number, pts:number}} cfg
 * @returns {{ok:true, sets1:number, sets2:number} | {ok:false, error:string}}
 */
function validateMatchScores(setScores, cfg) {
  const needed = setsNeededFor(cfg.sets);
  const target = cfg.pts;
  if (!setScores.length) return { ok: false, error: 'Completa todos los sets' };
  if (setScores.length > cfg.sets) return { ok: false, error: `Máximo ${cfg.sets} sets` };

  let sets1 = 0, sets2 = 0;
  for (const [a, b] of setScores) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0)
      return { ok: false, error: 'Ingresa puntos enteros iguales o mayores a 0' };
    if (sets1 >= needed || sets2 >= needed)
      return { ok: false, error: 'No agregues sets después de que el partido ya terminó' };
    const hi = Math.max(a, b), lo = Math.min(a, b);
    // El set termina exactamente al llegar a `target` con 2 de ventaja,
    // o en el deuce cuando uno saca 2 de diferencia (ej. 11-9, 12-10, 15-13).
    const valid = lo <= target - 2 ? hi === target : hi === lo + 2;
    if (!valid)
      return { ok: false, error: `Set inválido ${a}-${b}: se gana a ${target} con 2 de diferencia` };
    if (a > b) sets1++; else sets2++;
  }
  if (sets1 < needed && sets2 < needed)
    return { ok: false, error: `Faltan sets: se necesitan ${needed} ganados` };
  return { ok: true, sets1, sets2 };
}

// ── CLASIFICACIÓN (ITTF 3.7.5) ─────────────

function _emptyStats(idx) {
  return { idx, pts: 0, won: 0, lost: 0, setW: 0, setL: 0, ptW: 0, ptL: 0 };
}

/** Estadísticas considerando solo los partidos jugados entre los jugadores `ids`. */
function _statsAmong(ids, matches) {
  const set = new Set(ids);
  const st = new Map(ids.map(id => [id, _emptyStats(id)]));
  for (const m of matches) {
    if (!m.done || !set.has(m.p1) || !set.has(m.p2)) continue;
    const s1 = st.get(m.p1), s2 = st.get(m.p2);
    s1.setW += m.sets1; s1.setL += m.sets2;
    s2.setW += m.sets2; s2.setL += m.sets1;
    for (const [a, b] of (m.setScores || m.setHistory || [])) {
      s1.ptW += a; s1.ptL += b; s2.ptW += b; s2.ptL += a;
    }
    const w = m.sets1 > m.sets2 ? s1 : s2, l = w === s1 ? s2 : s1;
    w.pts += 2; w.won++; l.lost++;
  }
  return st;
}

function _ratio(w, l) {
  if (l === 0) return w === 0 ? 0 : Infinity;
  return w / l;
}

/** Agrupa ids por el valor de `key`, de mayor a menor. */
function _buckets(ids, key) {
  const map = new Map();
  for (const id of ids) {
    const k = key(id);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(id);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(e => e[1]);
}

/**
 * Ordena jugadores empatados usando solo los partidos entre ellos:
 * puntos → cociente de sets → cociente de puntos. Si un criterio separa a
 * algunos, los que siguen empatados vuelven a empezar entre sí.
 */
function _orderTied(ids, matches, fallback) {
  if (ids.length < 2) return ids;
  const st = _statsAmong(ids, matches);
  const criteria = [
    s => s.pts,
    s => _ratio(s.setW, s.setL),
    s => _ratio(s.ptW, s.ptL),
  ];
  for (const crit of criteria) {
    const buckets = _buckets(ids, id => crit(st.get(id)));
    if (buckets.length > 1) return buckets.flatMap(b => _orderTied(b, matches, fallback));
  }
  return fallback(ids);
}

/**
 * Tabla de posiciones de un grupo o liga.
 * @param {number[]} playerIds
 * @param {Array<{p1,p2,sets1,sets2,setScores?,setHistory?,done}>} matches
 * @returns estadísticas generales ordenadas por posición
 */
function rankPlayers(playerIds, matches) {
  const overall = _statsAmong(playerIds, matches);
  const order = new Map(playerIds.map((id, i) => [id, i]));
  // Si ni el enfrentamiento directo separa, se usa la diferencia general y luego el orden de inscripción.
  const fallback = ids => ids.slice().sort((a, b) => {
    const A = overall.get(a), B = overall.get(b);
    return (B.setW - B.setL) - (A.setW - A.setL)
        || (B.ptW - B.ptL) - (A.ptW - A.ptL)
        || order.get(a) - order.get(b);
  });
  const ranked = _buckets(playerIds, id => overall.get(id).pts)
    .flatMap(b => _orderTied(b, matches, fallback));
  return ranked.map(id => overall.get(id));
}

// ── CUADRO ELIMINATORIO ────────────────────

function nextPow2(n) {
  let s = 1;
  while (s < n) s *= 2;
  return s;
}

/**
 * Arma la primera ronda a partir de los clasificados de grupos.
 * Completa el cuadro a potencia de 2 con BYEs (pase directo) para los mejores
 * clasificados y evita que dos jugadores del mismo grupo se crucen en primera ronda.
 * @param {Array<{id:number, group:number, pos:0|1}>} classified pos 0 = 1° del grupo
 * @returns {Array<[object, object|null]>} pares; null = BYE
 */
function buildFirstRound(classified) {
  const firsts  = classified.filter(c => c.pos === 0);
  const seconds = classified.filter(c => c.pos === 1);
  const n = classified.length;
  if (n < 2) return n ? [[classified[0], null]] : [];
  const size = nextPow2(n);
  const byes = size - n;

  // Caso clásico (2, 4 u 8 grupos completos): 1°A vs 2°B y 1°B vs 2°A, y cada
  // grupo queda con su 1° y su 2° en mitades opuestas del cuadro.
  if (byes === 0 && firsts.length === seconds.length && firsts.length % 2 === 0) {
    const top = [], bottom = [];
    for (let i = 0; i < firsts.length; i += 2) {
      top.push([firsts[i], seconds[i + 1]]);
      bottom.push([firsts[i + 1], seconds[i]]);
    }
    return [...top, ...bottom];
  }

  // Caso general: los mejores sembrados reciben BYE; el resto se empareja
  // prefiriendo 1° vs 2° de grupos distintos.
  const seeded = [...firsts, ...seconds];
  const byeUnits = seeded.slice(0, byes).map(p => [p, null]);
  const pool = seeded.slice(byes);
  const matchUnits = [];
  while (pool.length) {
    const a = pool.shift();
    let j = pool.findIndex(x => x.pos !== a.pos && x.group !== a.group);
    if (j < 0) j = pool.findIndex(x => x.group !== a.group);
    if (j < 0) j = 0;
    const b = pool.splice(j, 1)[0] ?? null;
    matchUnits.push([a, b]);
  }
  // Intercalar BYE / partido para que quien pasa directo enfrente a un ganador real.
  const units = [];
  while (byeUnits.length || matchUnits.length) {
    if (byeUnits.length) units.push(byeUnits.shift());
    if (matchUnits.length) units.push(matchUnits.shift());
  }
  return units;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    serverFor, isSetWon, isDeuce, setsNeededFor, validateMatchScores,
    rankPlayers, nextPow2, buildFirstRound,
  };
}
