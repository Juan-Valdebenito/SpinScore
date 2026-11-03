// Ayudas compartidas por las pruebas en el navegador.
// Las acciones se hacen con las mismas funciones que usan los botones de la app.

/** Abre la app con los datos vacíos y sin animaciones (las capturas y los clics quedan estables). */
async function abrirApp(page, ruta = '/app.html') {
  await page.goto(ruta);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
}

/** Errores de JavaScript de la página, para verificar al final de cada prueba que no hubo ninguno. */
function capturarErrores(page) {
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  return errores;
}

/**
 * Crea un torneo por grupos desde la pantalla de inscripción y juega la fase de grupos.
 * Gana siempre el jugador inscrito antes (así el resultado es predecible).
 */
async function armarTorneo(page, { jugadores, grupos, cabezaDeSerie = false, sets = 3, pts = 11, nombre = 'Copa' }) {
  await page.evaluate(async ({ jugadores, grupos, cabezaDeSerie, sets, pts, nombre }) => {
    selectCfg('sets', sets); selectCfg('pts', pts);
    nuevoTorneoGrupos(null, nombre);
    if (cabezaDeSerie) document.getElementById('seed-mode-toggle').click();
    selectGroups(grupos);
    const lista = Array.isArray(jugadores) ? jugadores : Array.from({ length: jugadores }, (_, i) => 'J' + i);
    for (const n of lista) { document.getElementById('gp-input').value = n; addGPlayer(); }
    sortearGrupos(); confirmarGrupos();
    for (let i = 0; i < GT.groupMatches.length; i++) {
      const m = GT.groupMatches[i];
      abrirResultado(i, 'group');
      const v = m.p1 < m.p2 ? ['11', '5', '11', '5'] : ['5', '11', '5', '11'];
      document.querySelectorAll('#result-sets-container .set-input').forEach((el, j) => { el.value = v[j] ?? ''; });
      await guardarResultado();
    }
  }, { jugadores, grupos, cabezaDeSerie, sets, pts, nombre });
}

/**
 * Ingresa un resultado por el formulario "Ingresar resultado".
 * @param contexto 'group' | 'elim' | 'previa' | 'liga'
 * @param idx índice (grupos/previa), {ri, mi} (eliminatoria) o id del partido (liga)
 * @param sets lista de sets, p. ej. [[11, 5], [11, 7]]
 * No espera la confirmación si aparece un diálogo (para poder responderlo en la prueba).
 */
async function cargarResultado(page, contexto, idx, sets) {
  await page.evaluate(({ contexto, idx, sets }) => {
    abrirResultado(idx, contexto);
    const valores = sets.flat().map(String);
    document.querySelectorAll('#result-sets-container .set-input').forEach((el, j) => { el.value = valores[j] ?? ''; });
    guardarResultado();
  }, { contexto, idx, sets });
}

/** Juega todos los partidos pendientes de la ronda previa y del cuadro (gana siempre el de arriba). */
async function jugarEliminatoria(page) {
  await page.evaluate(async () => {
    const cargar = async (ctx, idx) => {
      abrirResultado(idx, ctx);
      document.querySelectorAll('#result-sets-container .set-input').forEach((el, j) => { el.value = ['11', '6', '11', '6'][j] ?? ''; });
      await guardarResultado();
    };
    for (let q = 0; q < GT.prelimMatches.length; q++) if (!GT.prelimMatches[q].done) await cargar('previa', q);
    for (let ri = 0; ri < GT.elimRounds.length; ri++)
      for (let mi = 0; mi < GT.elimRounds[ri].length; mi++)
        if (!GT.elimRounds[ri][mi].done) await cargar('elim', { ri, mi });
    await new Promise(r => setTimeout(r, 400));   // el podio aparece con una pequeña demora
  });
}

/** Grupo (índice) al que pertenece cada jugador, para revisar cruces del mismo grupo. */
async function crucesMismoGrupoEnPrimeraRonda(page) {
  return page.evaluate(() => {
    const grupoDe = id => GT.groups.findIndex(g => g.includes(id));
    return GT.elimRounds[0].filter(m => !m.bye && m.p1 !== null && m.p2 !== null && grupoDe(m.p1) === grupoDe(m.p2)).length;
  });
}

module.exports = { abrirApp, capturarErrores, armarTorneo, cargarResultado, jugarEliminatoria, crucesMismoGrupoEnPrimeraRonda };
