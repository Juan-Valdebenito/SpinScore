const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Carga utils.js y storage.js (scripts del navegador) con un localStorage en memoria. */
function loadStorage() {
  const data = new Map();
  const ctx = vm.createContext({
    localStorage: {
      getItem: k => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: k => data.delete(k),
    },
    console,
  });
  for (const f of ['utils.js', 'storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  return { ctx, data };
}

// Los valores creados dentro del contexto vm tienen otros prototipos: se comparan como JSON plano.
const plain = v => JSON.parse(JSON.stringify(v));
const liga = (id, extra = {}) => ({ id, name: 'Liga ' + id, players: ['Ana', 'Beto'], matches: [], status: 'active', ...extra });

test('ligaSave guarda la liga abierta y la agrega al historial', () => {
  const { ctx } = loadStorage();
  ctx.ligaSave(liga('L1'));
  assert.equal(ctx.ligaGet().id, 'L1');
  assert.deepEqual(plain(ctx.ligasGetAll().map(l => l.id)), ['L1']);
});

test('crear otra liga no borra la anterior del historial (más reciente primero)', () => {
  const { ctx } = loadStorage();
  ctx.ligaSave(liga('L1', { status: 'finished', podio: ['Ana', 'Beto'] }));
  ctx.ligaSave(liga('L2'));
  assert.equal(ctx.ligaGet().id, 'L2');
  assert.deepEqual(plain(ctx.ligasGetAll().map(l => l.id)), ['L2', 'L1']);
  assert.deepEqual(plain(ctx.ligasGetAll()[1].podio), ['Ana', 'Beto']);
});

test('guardar de nuevo la misma liga la actualiza en el historial sin duplicarla', () => {
  const { ctx } = loadStorage();
  ctx.ligaSave(liga('L1'));
  ctx.ligaSave(liga('L1', { status: 'finished' }));
  const all = ctx.ligasGetAll();
  assert.equal(all.length, 1);
  assert.equal(all[0].status, 'finished');
});

test('ligaHistDelete quita solo esa liga', () => {
  const { ctx } = loadStorage();
  ctx.ligaSave(liga('L1'));
  ctx.ligaSave(liga('L2'));
  ctx.ligaHistDelete('L1');
  assert.deepEqual(plain(ctx.ligasGetAll().map(l => l.id)), ['L2']);
});

test('historial dañado o ausente se trata como vacío', () => {
  const { ctx, data } = loadStorage();
  assert.deepEqual(plain(ctx.ligasGetAll()), []);
  data.set('spinscore_ligas', '{no es json');
  assert.deepEqual(plain(ctx.ligasGetAll()), []);
  data.set('spinscore_ligas', '{"id":"x"}');
  assert.deepEqual(plain(ctx.ligasGetAll()), []);
});
