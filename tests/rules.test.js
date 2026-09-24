const test = require('node:test');
const assert = require('node:assert/strict');
const {
  serverFor, isSetWon, isDeuce, validateMatchScores,
  rankPlayers, nextPow2, buildFirstRound,
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
