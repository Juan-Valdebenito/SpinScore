# SpinScore

Marcador y gestor de torneos de **tenis de mesa**. Es una PWA estática, sin backend ni registro: todo se guarda en el navegador y funciona sin conexión una vez abierta por primera vez.

## Funciones

| Modo | Qué hace |
|---|---|
| **Partido rápido** | Marcador en vivo con saque ITTF, deuce, tarjetas amarilla/roja y deshacer ilimitado (también entre sets). Si se recarga la página, el partido se puede reanudar. |
| **Liga** | Todos contra todos. Los partidos se juegan con el marcador y la tabla usa el desempate ITTF. |
| **Torneo por grupos** | De 2 a 8 grupos (de 2 a 4 jugadores cada uno), sorteo, resultados por sets y cuadro eliminatorio automático con BYEs cuando los clasificados no son potencia de 2. |
| **Categorías** | Agrupa los torneos por nivel o edad (Infantil, Sub-18, etc.). |
| **Multimesa** | Varios marcadores simultáneos en una sola pantalla. |
| **Vista pública** | Link de solo lectura con el estado del torneo. Funciona en cualquier dispositivo porque los datos viajan comprimidos dentro de la URL. |

## Reglas implementadas (ITTF)

- El set se gana al llegar a los puntos configurados (7, 11, 15 o 21) con 2 de diferencia.
- Saque: 2 puntos por jugador; desde el deuce, 1 punto cada uno. El primer saque se alterna en cada set y se puede elegir quién saca al inicio.
- Clasificación: 2 puntos por victoria. Los empates se resuelven solo con los partidos entre los empatados (puntos → cociente de sets → cociente de puntos) y el proceso se repite con los que siguen empatados.
- En la eliminación directa, los dos semifinalistas perdedores comparten el 3° lugar.

## Estructura

```
index.html        Landing
app.html          Aplicación (pantallas como <div class="screen">)
public.html       Vista pública de solo lectura
multimesa.html    Marcadores simultáneos
sw.js             Service worker (offline)
js/
  rules.js        Reglas puras sin DOM: saque, sets, validación, desempates, cuadro  ← con tests
  utils.js        Escape de HTML, localStorage seguro, link compartido, diálogos
  storage.js      Persistencia (torneos, categorías, liga, partido en vivo, configuración)
  core.js         Navegación, inicio, Mis Torneos, categorías, compartir, podio, PWA
  match.js        Marcador en vivo
  liga.js         Modo liga
  grupos.js       Fase de grupos e ingreso de resultados
  eliminacion.js  Cuadro eliminatorio
tests/            Tests de rules.js y utils.js (node:test, sin dependencias)
```

## Desarrollo

Requiere Node 20 o superior solo para los tests y el servidor local; la app no tiene paso de build.

```bash
npm start      # sirve la carpeta en http://localhost:5173
npm test       # corre los tests
```

> El service worker necesita `http://` (o `https://`); abrir los archivos con `file://` funciona, pero sin modo offline.

Al publicar una versión nueva, actualiza `APP_VERSION` en `js/utils.js` y `CACHE` en `sw.js` para que los usuarios reciban los archivos nuevos.

## Imágenes

| Archivo | Uso |
|---|---|
| `images/Logo.png` | Original en alta resolución (1024 px, 1,4 MB). **No se carga en la web**: es la fuente para generar el resto. |
| `images/favicon.ico`, `favicon-32.png` | Favicon (solo la paleta, el texto no se lee a ese tamaño). |
| `images/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | Íconos de la PWA al instalarla. |
| `images/screens/*.webp` | Capturas de la app que se muestran en la landing y en el diálogo de instalación. |
| `images/og-image.jpg` | Vista previa al compartir en redes (1200×630). Se genera capturando `images/og-template.html` a ese tamaño. |

Las etiquetas Open Graph usan URLs absolutas con `https://spinscore.cl`. Si el sitio se publica en otro dominio, cámbialo en `index.html`, `app.html` y `public.html`.

## Datos

Todo vive en el `localStorage` del navegador (claves `spinscore_*`). Borrar los datos del sitio borra los torneos.
