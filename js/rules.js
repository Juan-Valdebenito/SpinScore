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

/**
 * Cupos de un grupo de `n` jugadores en modo cabeza de serie.
 *  - Grupo par: clasifica directo la mitad y el siguiente va a la llave previa.
 *  - Grupo impar: clasifica directo la mitad redondeada hacia arriba; el resto queda fuera.
 * Ej.: 2 → 1 + previa · 3 → 2 · 4 → 2 + previa · 5 → 3.
 */
function cuposGrupo(n) {
  return n % 2 === 0 ? { directos: n / 2, previa: 1 } : { directos: Math.ceil(n / 2), previa: 0 };
}

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
 * @param {boolean} seededMode cuando está activo, ordena los ganadores por rendimiento
 *   antes de otorgar los BYE disponibles.
 * @returns {Array<[object, object|null]>} pares; null = BYE
 */
function buildFirstRound(classified, seededMode = false) {
  const seedCompare = (a, b) => {
    const A = a.stats || {}, B = b.stats || {};
    return (B.pts || 0) - (A.pts || 0)
      || (B.won || 0) - (A.won || 0)
      || ((B.setW || 0) - (B.setL || 0)) - ((A.setW || 0) - (A.setL || 0))
      || ((B.ptW || 0) - (B.ptL || 0)) - ((A.ptW || 0) - (A.ptL || 0))
      || a.group - b.group;
  };
  // Primeros en orden de grupo (A, B, C…): el emparejamiento clásico depende de ese orden.
  const firstsByGroup = classified.filter(c => c.pos === 0);
  // Primeros ordenados por rendimiento si hay cabezas de serie: decide quién recibe los BYE.
  const firsts  = seededMode ? [...firstsByGroup].sort(seedCompare) : firstsByGroup;
  const seconds = classified.filter(c => c.pos === 1);
  const n = classified.length;
  if (n < 2) return n ? [[classified[0], null]] : [];
  const size = nextPow2(n);
  const byes = size - n;

  // Caso clásico (2, 4 u 8 grupos completos): 1°A vs 2°B y 1°B vs 2°A, y cada
  // grupo queda con su 1° y su 2° en mitades opuestas del cuadro.
  // Usa siempre el orden de grupos: con los primeros reordenados, el 1° y el 2°
  // de un mismo grupo podían cruzarse en primera ronda.
  if (byes === 0 && classified.every(c => c.pos <= 1) &&
      firstsByGroup.length === seconds.length && firstsByGroup.length % 2 === 0) {
    // Con cabezas de serie, los grupos se ordenan por el rendimiento de su 1.°: el grupo del
    // sembrado 1 queda arriba (índice 0) y el del sembrado 2 abajo (índice 1).
    const groupOrder = (seededMode ? firsts : firstsByGroup).map(f => f.group);
    const F = groupOrder.map(g => firstsByGroup.find(f => f.group === g));
    const S = groupOrder.map(g => seconds.find(s => s.group === g));
    const top = [], bottom = [];
    for (let i = 0; i < F.length; i += 2) {
      top.push([F[i], S[i + 1]]);
      bottom.push([F[i + 1], S[i]]);
    }
    return [...top, ...bottom];
  }

  // Con cabezas de serie: ranking completo (todos los 1.° por rendimiento, luego los 2.°, luego los 3.°…).
  if (seededMode) return _cuadroSembrado([...classified].sort((a, b) => a.pos - b.pos || seedCompare(a, b)), size);

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

/**
 * Cuadro con cabezas de serie cuando hay BYE.
 *  1. Los mejores del ranking pasan directo (BYE).
 *  2. El resto se empareja "el mejor que queda contra el peor que queda", de grupos distintos.
 *  3. Cada BYE, del mejor al peor, enfrentará en la ronda 2 al ganador del partido más débil
 *     que no tenga jugadores de su grupo (así el sembrado 1 recibe, por ejemplo, un 2.° que le
 *     ganó a otro 2.°).
 *  4. Los bloques [BYE, partido] se ubican en el orden estándar del cuadro (1 y 2 en mitades opuestas).
 * @param {Array<{group:number}>} ranked de mejor a peor
 * @param {number} size tamaño del cuadro (potencia de 2)
 */
function _cuadroSembrado(ranked, size) {
  const byes = size - ranked.length;
  const byeHolders = ranked.slice(0, byes);
  const pool = ranked.slice(byes);
  const altos = pool.filter(p => p.pos === 0);        // 1.° de grupo que no alcanzaron BYE
  const bajos = pool.filter(p => p.pos !== 0);        // 2.° (y menores), de mejor a peor
  const blocks = [], singles = [];

  /** Saca de `arr` los dos más débiles que no sean del grupo `evitar` ni del mismo grupo entre sí. */
  const parDebil = (arr, evitar) => {
    for (let i = arr.length - 1; i >= 1; i--) {
      if (arr[i].group === evitar) continue;
      for (let j = i - 1; j >= 0; j--) {
        if (arr[j].group === evitar || arr[j].group === arr[i].group) continue;
        const b = arr.splice(i, 1)[0], a = arr.splice(j, 1)[0];
        return [a, b];
      }
    }
    return null;
  };

  // 1) "2.° contra 2.°" para los mejores BYE: tantos como alcancen los 2.° que no hacen falta
  //    para enfrentar a los 1.° sin BYE.
  const bajoVsBajo = Math.max(0, Math.floor((bajos.length - altos.length) / 2));
  let k = 0;
  for (; k < byeHolders.length && k < bajoVsBajo; k++) {
    const m = parDebil(bajos, byeHolders[k].group) || parDebil(bajos, -1);
    blocks.push([[byeHolders[k], null], m]);
  }

  // 2) Resto: el mejor que queda contra el peor que queda, de grupos distintos (de más fuerte a más débil).
  const resto = [...altos, ...bajos], matches = [];
  while (resto.length) {
    const a = resto.shift();
    let j = -1;
    for (let q = resto.length - 1; q >= 0; q--) if (resto[q].group !== a.group) { j = q; break; }
    if (j < 0) j = resto.length - 1;
    matches.push([a, j >= 0 ? resto.splice(j, 1)[0] : null]);
  }
  // Cada BYE que queda (del mejor al peor) toma el partido más débil sin jugadores de su grupo.
  for (const p of byeHolders.slice(k)) {
    let j = -1;
    for (let q = matches.length - 1; q >= 0; q--) if (!matches[q].some(x => x && x.group === p.group)) { j = q; break; }
    if (j < 0) j = matches.length - 1;
    if (j < 0) singles.push([p, null]);                    // más BYE que partidos
    else blocks.push([[p, null], matches.splice(j, 1)[0]]);
  }

  // 3) Si quedó algún cruce del mismo grupo en primera ronda, intercambiar rivales entre partidos.
  const partidos = [...blocks.map(b => b[1]), ...matches].filter(m => m && m[1]);
  for (const m of partidos) {
    if (m[0].group !== m[1].group) continue;
    const otro = partidos.find(o => o !== m && o[1].group !== m[0].group && o[0].group !== m[1].group);
    if (otro) [m[1], otro[1]] = [otro[1], m[1]];
  }
  // Sobrantes: los BYE más débiles se cruzan entre sí; los partidos sin BYE, entre ellos.
  for (let i = 0; i < singles.length; i += 2) blocks.push([singles[i], singles[i + 1]]);
  for (let i = 0; i < matches.length; i += 2) blocks.push([matches[i], matches[i + 1]]);
  if (blocks.length < 2) return blocks.flat();
  return bracketSeedOrder(blocks.length).flatMap(seed => blocks[seed - 1]);
}

/**
 * Orden estándar de los sembrados en un cuadro de `size` posiciones (potencia de 2):
 * 2 → [1,2] · 4 → [1,4,2,3] · 8 → [1,8,4,5,2,7,3,6]. Los sembrados 1 y 2 quedan en mitades opuestas.
 */
function bracketSeedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap(s => [s, n + 1 - s]);
  }
  return order;
}

/**
 * Partidos ya jugados que dependen del ganador del partido (ri, mi): el de la ronda siguiente
 * donde avanzó y, si también se jugó, los posteriores. Orden: de la ronda más cercana a la final.
 * @param {Array<Array<{done:boolean}>>} rounds cuadro (rondas → partidos)
 * @returns {Array<{ri:number, mi:number}>}
 */
function elimDependientesJugados(rounds, ri, mi) {
  const out = [];
  for (let r = ri, i = mi; r + 1 < rounds.length; ) {
    const nr = r + 1, ni = Math.floor(i / 2);
    if (!rounds[nr][ni].done) break;
    out.push({ ri: nr, mi: ni });
    r = nr; i = ni;
  }
  return out;
}

/**
 * Deja pendientes esos partidos: borra su resultado y vacía el cupo que su ganador ocupaba
 * en la ronda siguiente. El otro jugador de cada partido se mantiene.
 */
function elimReabrirDependientes(rounds, deps) {
  for (const { ri, mi } of deps) {
    Object.assign(rounds[ri][mi], { sets1: 0, sets2: 0, setScores: [], done: false, winner: null, winnername: null });
    if (ri + 1 < rounds.length) {
      const up = rounds[ri + 1][Math.floor(mi / 2)];
      if (mi % 2 === 0) { up.p1 = null; up.p1name = null; }
      else              { up.p2 = null; up.p2name = null; }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    serverFor, isSetWon, isDeuce, setsNeededFor, validateMatchScores,
    rankPlayers, cuposGrupo, nextPow2, buildFirstRound, bracketSeedOrder, elimDependientesJugados, elimReabrirDependientes,
  };
}
