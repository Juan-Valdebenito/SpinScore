// Auditoría de accesibilidad: recorre las pantallas en los 3 temas, en celular y computador, y mide
//  - contraste de cada texto visible (WCAG AA: 4,5:1; texto grande 3:1), considerando opacidades;
//  - tamaño mínimo de letra (12 px);
//  - área táctil de botones y enlaces (44×44 px; los enlaces dentro de una oración están exentos).
const { test, expect } = require('@playwright/test');
const { abrirApp, armarTorneo, cargarResultado } = require('./helpers');

/** Se ejecuta dentro de la página. Devuelve la lista de problemas del elemento `scope`. */
function auditar(scope) {
  const parse = s => {
    let m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; }
    m = s.match(/color\(srgb ([^)]+)\)/);
    if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1]; }
    return [0, 0, 0, 0];
  };
  const mezclar = (arriba, abajo) => { const a = arriba[3]; return [0, 1, 2].map(i => arriba[i] * a + abajo[i] * (1 - a)).concat(1); };
  const luminancia = c => {
    const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
    return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]);
  };
  const contraste = (a, b) => { const [h, l] = [luminancia(a), luminancia(b)].sort((x, y) => y - x); return (h + .05) / (l + .05); };
  const fondoDe = el => {
    const capas = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) { capas.push(c); if (c[3] >= 1) break; }
    }
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (base[3] === 0) base = [255, 255, 255, 1];
    for (let i = capas.length - 1; i >= 0; i--) base = mezclar(capas[i], base);
    return base;
  };
  const opacidadDe = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const nombre = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');

  const problemas = new Set();
  const raiz = document.querySelector(scope) || document.body;
  raiz.querySelectorAll('*').forEach(el => {
    if (!visible(el) || el.closest('svg, script, style')) return;
    const texto = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    // Los signos sueltos (–, ·, ×…) son decorativos o tienen aria-label
    if (texto && !/^[–—·|*→←↩⇄×✕▶›+/]+$/.test(texto) && !el.closest('[aria-hidden="true"]')) {
      const cs = getComputedStyle(el), px = parseFloat(cs.fontSize), peso = +cs.fontWeight;
      const fondo = fondoDe(el), color = parse(cs.color);
      const r = contraste(mezclar([color[0], color[1], color[2], color[3] * opacidadDe(el)], fondo), fondo);
      const minimo = px >= 24 || (px >= 18.66 && peso >= 700) ? 3 : 4.5;
      if (r < minimo) problemas.add(`contraste ${r.toFixed(2)}:1 (mínimo ${minimo}) · ${px}px · "${texto.slice(0, 30)}" · ${nombre(el)}`);
      if (px < 12) problemas.add(`letra ${px}px · "${texto.slice(0, 30)}" · ${nombre(el)}`);
    }
    const enlaceEnOracion = el.tagName === 'A' && getComputedStyle(el).display === 'inline' &&
      [...el.parentElement.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!enlaceEnOracion && el.matches('button, a[href], [onclick], input, [role="tab"]') && !el.matches('.player-side, .mesa-player')) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) problemas.add(`área táctil ${Math.round(r.width)}×${Math.round(r.height)} · ${nombre(el)}`);
    }
  });
  return [...problemas];
}

/** Revisa una vista; acumula los problemas con el nombre de la vista. */
async function revisar(page, vista, scope, hallazgos) {
  await page.waitForTimeout(30);
  for (const p of await page.evaluate(auditar, scope)) hallazgos.push(`${vista}: ${p}`);
}

const TAMANOS = { celular: { width: 390, height: 844 }, computador: { width: 1280, height: 800 } };

for (const [dispositivo, viewport] of Object.entries(TAMANOS)) {
  test.describe(`Accesibilidad · ${dispositivo}`, () => {
    test.use({ viewport });

    for (const tema of ['standard', 'dark', 'light']) {
      test(`app · tema ${tema}`, async ({ page }) => {
        const hallazgos = [];
        await abrirApp(page);
        await page.evaluate(t => themeSet(t), tema);
        const ir = (fn, arg) => page.evaluate(fn, arg);

        await ir(() => document.getElementById('install-banner').classList.remove('d-none'));
        await revisar(page, 'inicio', '#screen-home', hallazgos);
        await ir(() => goTo('screen-quicksetup'));
        await revisar(page, 'partido rápido', '#screen-quicksetup', hallazgos);

        await ir(() => { initMatch('Martina Soto', 'Diego Rojas', { cfg: { sets: 5, pts: 11 } }); });
        await revisar(page, 'marcador sin empezar', '#screen-score', hallazgos);
        await ir(() => {
          Object.assign(MATCH, { sets: [1, 1], setHistory: [[11, 7], [9, 11]], pts: [10, 10] });
          MATCH.cards[0].yellow = 1; MATCH.cards[1].red = 1; _pushUndo('punto de Diego'); renderScoreUI(); renderCardsUI();
        });
        await revisar(page, 'marcador', '#screen-score', hallazgos);
        await ir(() => { MATCH.sets = [3, 1]; MATCH.setHistory = [[11, 5], [9, 11], [11, 8], [11, 9]]; showWinScreen(); });
        await revisar(page, 'ganador', '#win-screen', hallazgos);
        await ir(() => { document.getElementById('win-screen').classList.remove('show'); liveMatchClear(); });

        await ir(() => { nuevoTorneoGrupos(); });
        await revisar(page, 'nuevo torneo', '#screen-groups-setup', hallazgos);

        // Torneo con cabeza de serie: tablas con marcas, ronda previa, cuadro y podio
        await armarTorneo(page, { jugadores: 16, grupos: 4, cabezaDeSerie: true });
        await ir(() => { goTo('screen-groups-main'); });
        await revisar(page, 'grupo', '#screen-groups-main', hallazgos);
        await ir(() => switchGroupTab(GT.groups.length));
        await revisar(page, 'grupos general', '#screen-groups-main', hallazgos);
        await ir(() => abrirResultado(0, 'group'));
        await revisar(page, 'ingresar resultado', '#screen-result-entry', hallazgos);
        await ir(() => iniciarEliminacion());
        await revisar(page, 'ronda previa', '#screen-elimination', hallazgos);
        await cargarResultado(page, 'previa', 0, [[11, 6], [11, 6]]);
        await cargarResultado(page, 'previa', 1, [[11, 6], [11, 6]]);
        await revisar(page, 'cuadro', '#screen-elimination', hallazgos);
        await ir(() => mostrarPodio(['Martina Soto', 'Diego Rojas', 'Camila Pérez', 'Tomás Vera'], 'Copa', [1, 2, 3, 3]));
        await revisar(page, 'podio', '#podio-screen', hallazgos);
        await ir(() => { document.getElementById('podio-screen').classList.remove('show'); goTo('screen-mis-torneos'); });
        await revisar(page, 'mis torneos', '#screen-mis-torneos', hallazgos);

        await ir(() => goTo('screen-settings'));
        await revisar(page, 'configuración', '#screen-settings', hallazgos);
        await ir(() => { catSave({ id: 'C1', name: 'Sub-18', createdAt: 1 }); goTo('screen-categorias'); });
        await revisar(page, 'categorías', '#screen-categorias', hallazgos);
        await ir(() => goTo('screen-contact'));
        await revisar(page, 'contacto', '#screen-contact', hallazgos);

        await ir(async () => { _ligaDraft = ['Ana', 'Beto', 'Caro']; LIGA.id = null; await startTournament(); ligaRegistrarResultado('0-1', [2, 1], [[11, 5], [5, 11], [11, 9]]); });
        await revisar(page, 'liga', '#screen-tournament-bracket', hallazgos);
        await ir(() => switchTab('standings'));
        await revisar(page, 'liga tabla', '#screen-tournament-bracket', hallazgos);

        expect(hallazgos).toEqual([]);
      });
    }

    test('landing', async ({ page }) => {
      const hallazgos = [];
      await page.goto('/index.html');
      await revisar(page, 'landing', 'body', hallazgos);
      expect(hallazgos).toEqual([]);
    });

    test('vista pública', async ({ page }) => {
      const hallazgos = [];
      await abrirApp(page);
      await armarTorneo(page, { jugadores: 16, grupos: 4, cabezaDeSerie: true });
      await page.evaluate(() => iniciarEliminacion());
      await cargarResultado(page, 'previa', 0, [[11, 6], [11, 6]]);
      await cargarResultado(page, 'previa', 1, [[11, 6], [11, 6]]);
      const id = await page.evaluate(() => GT.id);
      await page.goto(`/public.html?id=${id}`);
      await revisar(page, 'pública · grupo', 'body', hallazgos);
      await page.click('.gtab:has-text("General")');
      await revisar(page, 'pública · general', 'body', hallazgos);
      await page.click('.gtab:has-text("Eliminatoria")');
      await revisar(page, 'pública · cuadro', 'body', hallazgos);
      expect(hallazgos).toEqual([]);
    });

    test('multimesa', async ({ page }) => {
      const hallazgos = [];
      await abrirApp(page, '/multimesa.html');
      await page.evaluate(() => {
        mesas = [
          { id: 1, name: 'Mesa 1', p1: 'Martina', p2: 'Diego', sets: 5, pts: 11, setsNeeded: 3, pts_score: [10, 10], sets_score: [1, 1], undo: [], setHistory: [[11, 9], [6, 11]], status: 'active', winner: null },
          { id: 2, name: 'Mesa 2', p1: 'Sofía', p2: 'Emilia', sets: 3, pts: 11, setsNeeded: 2, pts_score: [0, 0], sets_score: [2, 0], undo: [], setHistory: [[11, 9], [11, 6]], status: 'finished', winner: 0 },
        ];
        renderAll();
      });
      await revisar(page, 'multimesa', 'body', hallazgos);
      await page.click('text=+ Nueva mesa');
      await revisar(page, 'multimesa · nueva mesa', '#setup-modal', hallazgos);
      expect(hallazgos).toEqual([]);
    });
  });
}
