const test = require('node:test');
const assert = require('node:assert/strict');
const {
  serverFor, isSetWon, isDeuce, validateMatchScores,
  rankPlayers, nextPow2, buildFirstRound, bracketSeedOrder, elimDependientesJugados, elimReabrirDependientes,
} = require('../js/rules.js');
const { esc, encodeShare, decodeShare } = require('../js/utils.js');

// ── Saque ──────────────────────────────────
test('saque: 2 puntos cada uno antes del deuce', () => {
  const seq = [];
  for (let t = 0; t < 8; t++) seq.push(serverFor(t, 0, 0, 11));
  assert.deepEqual(seq, [0, 0, 1, 1, 0, 0, 1, 1]);
});

test('saque: alterna cada punto desde el deuce (11 pts)', () => {
  assert.equal(serverFor(10, 10, 0, 11), 0);
  assert.equal(serverFor(11, 10, 0, 11), 1);
  assert.equal(serverFor(11, 11, 0, 11), 0);
});

test('saque: rachas de 2 hasta el deuce y de 1 después, para todos los formatos', () => {
  for (const pts of [7, 11, 15, 21]) {
    // Set que llega al deuce alternando puntos y se alarga 6 puntos más
    let a = 0, b = 0;
    const servers = [];
    for (let t = 0; t < 2 * (pts - 1) + 6; t++) {
      servers.push(serverFor(a, b, 0, pts));
      t % 2 === 0 ? a++ : b++;
    }
    const deuceAt = 2 * (pts - 1);
    for (let t = 0; t < deuceAt; t++)
      assert.equal(servers[t], Math.floor(t / 2) % 2, `pts=${pts} punto ${t}`);
    for (let t = deuceAt; t < servers.length; t++)
      assert.notEqual(servers[t], servers[t - 1], `pts=${pts}: en deuce alterna cada punto (${t})`);
  }
});

test('saque: el primer saque se alterna por set y respeta quién sacó primero', () => {
  assert.equal(serverFor(0, 0, 0, 11, 0), 0);
  assert.equal(serverFor(0, 0, 1, 11, 0), 1);
  assert.equal(serverFor(0, 0, 0, 11, 1), 1);
});

// ── Sets ───────────────────────────────────
test('fin de set y deuce', () => {
  assert.ok(isSetWon(11, 9, 11));
  assert.ok(!isSetWon(11, 10, 11));
  assert.ok(isSetWon(14, 12, 11));
  assert.ok(isDeuce(10, 10, 11));
  assert.ok(!isDeuce(10, 9, 11));
});

test('validación de resultados', () => {
  const cfg = { sets: 3, pts: 11 };
  assert.deepEqual(validateMatchScores([[11, 5], [11, 9]], cfg), { ok: true, sets1: 2, sets2: 0 });
  assert.deepEqual(validateMatchScores([[11, 5], [8, 11], [12, 14]], cfg), { ok: true, sets1: 1, sets2: 2 });
  assert.equal(validateMatchScores([[15, 3], [11, 0]], cfg).ok, false, 'no se puede pasar de 11 sin deuce');
  assert.equal(validateMatchScores([[11, 10], [11, 0]], cfg).ok, false, 'falta diferencia de 2');
  assert.equal(validateMatchScores([[13, 10], [11, 0]], cfg).ok, false, 'en deuce se gana por exactamente 2');
  assert.equal(validateMatchScores([[11, 5]], cfg).ok, false, 'faltan sets');
  assert.equal(validateMatchScores([[11, 5], [11, 5], [11, 5]], cfg).ok, false, 'set de más');
  assert.equal(validateMatchScores([[11, 5], [5, 11], [11, 5], [11, 5]], cfg).ok, false, 'más sets que el máximo');
});

// ── Clasificación ──────────────────────────
const M = (p1, p2, sets1, sets2, setScores = []) => ({ p1, p2, sets1, sets2, setScores, done: true });

test('clasificación por puntos', () => {
  const r = rankPlayers([0, 1, 2], [M(0, 1, 2, 0), M(0, 2, 2, 0), M(1, 2, 2, 1)]);
  assert.deepEqual(r.map(s => s.idx), [0, 1, 2]);
  assert.equal(r[0].pts, 4);
});

test('empate de dos: decide el enfrentamiento directo aunque el otro tenga mejor diferencia de sets', () => {
  // 1 y 2 terminan con 2 victorias; 2 ganó el duelo directo, 1 tiene mejor diferencia general.
  const matches = [
    M(1, 2, 0, 2), // gana 2
    M(1, 0, 2, 0), M(1, 3, 2, 0),
    M(2, 0, 1, 2), M(2, 3, 2, 1),
    M(0, 3, 0, 2),
  ];
  const r = rankPlayers([0, 1, 2, 3], matches);
  assert.deepEqual(r.slice(0, 2).map(s => s.idx), [2, 1]);
});

test('triple empate: cociente de sets entre ellos', () => {
  // 0 le gana a 1, 1 a 2, 2 a 0 → empatados en puntos; se decide por sets entre ellos.
  const matches = [
    M(0, 1, 2, 0, [[11, 1], [11, 1]]),
    M(1, 2, 2, 1, [[11, 1], [1, 11], [11, 1]]),
    M(2, 0, 2, 1, [[11, 1], [1, 11], [11, 1]]),
  ];
  const r = rankPlayers([0, 1, 2], matches);
  // Sets: 0 → 3-2, 1 → 2-3, 2 → 3-3
  assert.deepEqual(r.map(s => s.idx), [0, 2, 1]);
});

test('partidos pendientes no cuentan', () => {
  const r = rankPlayers([0, 1], [{ p1: 0, p2: 1, sets1: 0, sets2: 0, setScores: [], done: false }]);
  assert.deepEqual(r.map(s => s.pts), [0, 0]);
});

// ── Cuadro ─────────────────────────────────
const classify = groups => {
  const out = [];
  for (let g = 0; g < groups; g++) {
    out.push({ id: g * 10, group: g, pos: 0 });
    out.push({ id: g * 10 + 1, group: g, pos: 1 });
  }
  return out;
};

test('nextPow2', () => {
  assert.deepEqual([1, 2, 3, 5, 12, 16].map(nextPow2), [1, 2, 4, 8, 16, 16]);
});

for (const groups of [2, 4, 8]) {
  test(`cuadro completo con ${groups} grupos: sin BYEs, 1° vs 2° de otro grupo y mitades opuestas`, () => {
    const r = buildFirstRound(classify(groups));
    assert.equal(r.length, groups);
    for (const [a, b] of r) {
      assert.ok(b, 'sin BYE');
      assert.equal(a.pos, 0);
      assert.equal(b.pos, 1);
      assert.notEqual(a.group, b.group);
    }
    const half = r.length / 2;
    const groupsTop = new Set(r.slice(0, half).flat().map(p => `${p.group}-${p.pos}`));
    for (let g = 0; g < groups; g++)
      assert.ok(!(groupsTop.has(`${g}-0`) && groupsTop.has(`${g}-1`)), `grupo ${g} no debe tener 1° y 2° en la misma mitad`);
  });
}

test('cuadro con 6 grupos: 16 cupos, 4 BYEs a primeros y todos juegan', () => {
  const players = classify(6);
  const r = buildFirstRound(players);
  assert.equal(r.length, 8);
  const byes = r.filter(([, b]) => b === null);
  assert.equal(byes.length, 4);
  assert.ok(byes.every(([a]) => a.pos === 0), 'los BYE van a primeros de grupo');
  const seen = r.flat().filter(Boolean).map(p => p.id).sort((x, y) => x - y);
  assert.deepEqual(seen, players.map(p => p.id).sort((x, y) => x - y), 'cada clasificado aparece una vez');
  for (const [a, b] of r) if (b) assert.notEqual(a.group, b.group, 'sin cruces del mismo grupo');
  // Ronda 2: nunca dos BYE juntos (el que pasa directo enfrenta a un ganador real)
  for (let i = 0; i < r.length; i += 2)
    assert.ok(!(r[i][1] === null && r[i + 1][1] === null));
});

test('modo cabeza de serie: los BYE se asignan a los ganadores con mejor rendimiento', () => {
  const players = classify(6).map(p => ({ ...p, stats: {
    pts: p.pos === 0 ? p.group : 0, won: p.group, setW: p.group, setL: 0, ptW: p.group, ptL: 0,
  } }));
  const r = buildFirstRound(players, true);
  const byeIds = r.filter(([, b]) => b === null).map(([a]) => a.id).sort((a, b) => a - b);
  // Con seis grupos hay cuatro BYE; se los llevan los primeros de los grupos 2 a 5.
  assert.deepEqual(byeIds, [20, 30, 40, 50]);
});

test('modo cabeza de serie: nunca cruza en primera ronda al 1.° y 2.° del mismo grupo', () => {
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  // Ranking de grupos: el primero de la lista tiene al mejor 1.°
  const conRanking = (groups, ranking) => classify(groups).map(p => ({ ...p, stats: {
    pts: p.pos === 0 ? 100 - ranking.indexOf(p.group) : 0, won: 0, setW: 0, setL: 0, ptW: 0, ptL: 0,
  } }));
  const ordenes = n => n <= 6 ? perms([...Array(n).keys()])
    : Array.from({ length: 500 }, () => [...Array(n).keys()].sort(() => Math.random() - .5));
  for (const n of [2, 4, 6, 8]) {
    for (const ranking of ordenes(n)) {
      const r = buildFirstRound(conRanking(n, ranking), true);
      for (const [a, b] of r) if (b) assert.notEqual(a.group, b.group, `${n} grupos, ranking ${ranking}: mismo grupo en primera ronda`);
      if (n !== 6) {   // sin BYE: el 1.° y el 2.° de cada grupo van a mitades opuestas
        const top = new Set(r.slice(0, r.length / 2).flat().map(p => `${p.group}-${p.pos}`));
        for (let g = 0; g < n; g++) assert.ok(!(top.has(`${g}-0`) && top.has(`${g}-1`)), `${n} grupos, ranking ${ranking}: grupo ${g} en la misma mitad`);
      }
    }
  }
});

test('orden estándar de sembrados en el cuadro', () => {
  assert.deepEqual(bracketSeedOrder(2), [1, 2]);
  assert.deepEqual(bracketSeedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(bracketSeedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test('modo cabeza de serie: los sembrados 1 y 2 quedan en mitades opuestas del cuadro', () => {
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  const conRanking = (groups, ranking) => classify(groups).map(p => ({ ...p, stats: {
    pts: p.pos === 0 ? 100 - ranking.indexOf(p.group) : 0, won: 0, setW: 0, setL: 0, ptW: 0, ptL: 0,
  } }));
  const ordenes = n => n <= 6 ? perms([...Array(n).keys()])
    : Array.from({ length: 500 }, () => [...Array(n).keys()].sort(() => Math.random() - .5));
  for (const n of [2, 4, 6, 8]) {
    for (const ranking of ordenes(n)) {
      const r = buildFirstRound(conRanking(n, ranking), true);
      const half = r.length / 2;
      const mitad = g => r.findIndex(([a, b]) => (a.group === g && a.pos === 0) || (b && b.group === g && b.pos === 0)) < half;
      const [s1, s2] = ranking;   // grupos de los dos mejores 1.°
      assert.notEqual(mitad(s1), mitad(s2), `${n} grupos, ranking ${ranking}: sembrados 1 y 2 en la misma mitad`);
      // Lo de A2 se mantiene: nunca el mismo grupo en primera ronda
      for (const [a, b] of r) if (b) assert.notEqual(a.group, b.group);
      if (n === 6) {
        // Los BYE siguen yendo a los 4 mejores 1.° y nunca hay dos BYE que se enfrenten en la ronda 2
        const byeGroups = r.filter(([, b]) => b === null).map(([a]) => a.group).sort();
        assert.deepEqual(byeGroups, ranking.slice(0, 4).sort());
        for (let i = 0; i < r.length; i += 2) assert.ok(!(r[i][1] === null && r[i + 1][1] === null));
      }
    }
  }
});

test('sin cabeza de serie el cuadro no cambia', () => {
  const pl = classify(4).map(p => ({ ...p, stats: { pts: p.group } }));
  assert.deepEqual(buildFirstRound(pl, false).map(([a, b]) => [a.id, b && b.id]), [[0, 11], [20, 31], [10, 1], [30, 21]]);
});

test('cabeza de serie con BYE: los 2 mejores 1.° enfrentan en la ronda 2 al ganador de un 2.° contra 2.° de otros grupos', () => {
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  for (const ranking of perms([0, 1, 2, 3, 4, 5])) {
    const pl = classify(6).map(p => ({ ...p, stats: { pts: p.pos === 0 ? 100 - ranking.indexOf(p.group) : 50 - p.group } }));
    const r = buildFirstRound(pl, true);
    for (const g of ranking.slice(0, 2)) {
      const i = r.findIndex(([a, b]) => b === null && a.group === g && a.pos === 0);
      assert.ok(i >= 0, `el 1.° del grupo ${g} tiene BYE`);
      const rival = r[i % 2 === 0 ? i + 1 : i - 1];   // partido que define su rival de ronda 2
      assert.ok(rival.every(p => p && p.pos === 1), `ranking ${ranking}: el rival del 1.° del grupo ${g} sale de un 2.° contra 2.°`);
      assert.ok(rival.every(p => p.group !== g), `ranking ${ranking}: el rival del 1.° del grupo ${g} no es de su grupo`);
    }
  }
});

test('cabeza de serie con BYE: reglas generales con 3, 5, 6 y 7 grupos', () => {
  for (const n of [3, 5, 6, 7]) {
    for (let k = 0; k < 200; k++) {
      const ranking = [...Array(n).keys()].sort(() => Math.random() - .5);
      const pl = classify(n).map(p => ({ ...p, stats: { pts: p.pos === 0 ? 100 - ranking.indexOf(p.group) : Math.random() * 50 } }));
      const r = buildFirstRound(pl, true);
      const flat = r.flat().filter(Boolean);
      assert.equal(r.length, nextPow2(2 * n) / 2, `${n} grupos: tamaño del cuadro`);
      assert.deepEqual(flat.map(p => p.id).sort((a, b) => a - b), pl.map(p => p.id).sort((a, b) => a - b), `${n} grupos: cada clasificado aparece una vez`);
      for (const [a, b] of r) if (b) assert.notEqual(a.group, b.group, `${n} grupos: mismo grupo en primera ronda`);
      // Los BYE van a los mejores 1.° (y si sobran BYE, después a los mejores 2.°)
      const byes = r.filter(([, b]) => b === null).map(([a]) => a);
      const primerosConBye = byes.filter(p => p.pos === 0).map(p => p.group).sort();
      assert.deepEqual(primerosConBye, ranking.slice(0, primerosConBye.length).sort(), `${n} grupos: BYE a los mejores 1.°`);
      if (byes.some(p => p.pos === 1)) assert.equal(primerosConBye.length, n, `${n} grupos: un 2.° solo tiene BYE si todos los 1.° lo tienen`);
      // Sembrados 1 y 2 en mitades opuestas
      const half = r.length / 2;
      const mitad = g => r.findIndex(([a]) => a.group === g && a.pos === 0) < half;
      assert.notEqual(mitad(ranking[0]), mitad(ranking[1]), `${n} grupos: sembrados 1 y 2 en la misma mitad`);
    }
  }
});

// ── Utilidades ─────────────────────────────
test('esc escapa HTML', () => {
  assert.equal(esc(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  assert.equal(esc(null), '');
});

test('link compartido: ida y vuelta con tildes y ñ', async () => {
  const data = { name: 'Torneo Ñuñoa — Categoría Sub-18', players: ['José', 'Iñaki', 'Zoë'] };
  const hash = await encodeShare(data);
  assert.match(hash, /^[zj][A-Za-z0-9_-]+$/, 'solo caracteres seguros para URL');
  assert.deepEqual(await decodeShare(hash), data);
});

test('link compartido: formato antiguo en base64', async () => {
  const old = Buffer.from(JSON.stringify({ name: 'Viejo' })).toString('base64');
  assert.deepEqual(await decodeShare(old), { name: 'Viejo' });
});

// ── Corregir el ganador en la eliminatoria ──
/** Cuadro de 8: cuartos (4), semis (2), final (1). Los cuartos 0 y 1 alimentan la semi 0. */
const cuadro = () => {
  const m = (p1, p2, done = false, winner = null) => ({
    p1, p1name: p1 === null ? null : 'J' + p1, p2, p2name: p2 === null ? null : 'J' + p2,
    sets1: done ? 2 : 0, sets2: 0, setScores: done ? [[11, 5], [11, 5]] : [], done,
    winner, winnername: winner === null ? null : 'J' + winner,
  });
  return [
    [m(0, 1, true, 0), m(2, 3, true, 2), m(4, 5, true, 4), m(6, 7, true, 6)],
    [m(0, 2, true, 0), m(4, 6, true, 4)],
    [m(0, 4, true, 0)],
  ];
};

test('dependientes: un cuarto con semi y final jugadas afecta a ambas', () => {
  assert.deepEqual(elimDependientesJugados(cuadro(), 0, 1), [{ ri: 1, mi: 0 }, { ri: 2, mi: 0 }]);
});

test('dependientes: si la ronda siguiente no se jugó, no hay nada que borrar', () => {
  const r = cuadro();
  r[1][0].done = false; r[2][0].done = false;
  assert.deepEqual(elimDependientesJugados(r, 0, 1), []);
});

test('dependientes: la final no tiene partidos posteriores', () => {
  assert.deepEqual(elimDependientesJugados(cuadro(), 2, 0), []);
});

test('reabrir: borra resultados y vacía solo el cupo que ocupaba cada ganador', () => {
  const r = cuadro();
  elimReabrirDependientes(r, elimDependientesJugados(r, 0, 1));
  // Semi 0: sin resultado, conserva a sus jugadores (el cupo de J2 lo reemplaza luego el ganador corregido)
  assert.equal(r[1][0].done, false);
  assert.equal(r[1][0].winner, null);
  assert.deepEqual(r[1][0].setScores, []);
  assert.equal(r[1][0].p1name, 'J0');
  // Final: sin resultado; el cupo que venía de la semi 0 queda vacío y el de la semi 1 se mantiene
  assert.equal(r[2][0].done, false);
  assert.equal(r[2][0].p1, null);
  assert.equal(r[2][0].p1name, null);
  assert.equal(r[2][0].p2name, 'J4');
  // Lo que no depende del cambio queda igual
  assert.equal(r[1][1].done, true);
  assert.equal(r[0][2].done, true);
});
