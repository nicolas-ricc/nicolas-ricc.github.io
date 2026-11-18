# Composición responsive: el faro, los carriles y Writing para pantallas angostas

**Fecha:** 2026-11-18
**Estado:** implementado (#423)
**Alcance:** recomponer la escena para que el recorte de pantallas angostas
(celular, tablet vertical, 4:3, tablet horizontal) muestre los tres carteles y
el faro sin generar nada propio de esas pantallas. Para eso se muda el cabo
entero del faro, como un bloque, y se corren los carriles. Hay una sola
excepción: el cartel de Writing, que tiene dos sitios y usa uno u otro según el
host.
**Revisa:** la consecuencia de `docs/adr/0003-signs-are-the-navigation.md`
("en un celular vertical Writing queda fuera de la ventana… ningún
`COVER_FOCUS_U` entra a los tres").

## 1. El problema, medido

Medido sobre `main` en bf47dd8 con `coverView` (foco `COVER_FOCUS_U` = 0,35).
Cada celda es la fracción (x, y) del host en la que cae el centro de la
palabra; ✗ quiere decir que la caja de la palabra no entra entera.

| Host | Aspecto | RESUME | PORTFOLIO | WRITING |
|---|---|---|---|---|
| 1920×955 | 2,01 | 0,31, 0,39 | 0,47, 0,15 | 0,58, 0,64 |
| 1600×900 | 1,78 | 0,30, 0,40 | 0,47, 0,17 | 0,59, 0,63 |
| 1024×768 | 1,33 | 0,40, 0,40 | 0,63, 0,17 | 0,79, 0,63 |
| 820×1180 | 0,69 | 0,37, 0,40 | 0,81, 0,17 | 1,11 ✗ |
| 390×750 | 0,52 | 0,33, 0,40 | 0,91 ✗ (corte de ≈11 px) | 1,32 ✗ |

En vertical, los tres carteles ya forman una columna (PORTFOLIO arriba, RESUME
al medio, Writing abajo). Lo que no entra es el ancho: los carteles ocupan un
37 % del ancho del cuadro 16:9 y un celular ve un 29 %.

Además:

- El faro (`LIGHTHOUSE`, (396, 118)) está en la punta del cabo (`HEADLAND`,
  x 330..400, y 97..134, pegado al muelle de alistamiento del astillero).
  Queda fuera del recorte en celular y en tablet vertical.
- En escritorio Writing queda casi en el centro de la escena, y no debería:
  es un elemento secundario, abajo a la derecha.

## 2. Decisiones (tomadas con el dueño del sitio)

1. **Un solo mundo para todas las pantallas.** En la escena compartida se
   mueven **el cabo entero del faro** (la península: terreno, rocas, arrecife,
   faro, casa del farero y neones; no solo la torre) y el tramo sur de los
   carriles de los barcos. Se mueven para todas las pantallas a la vez, y el
   recorte hace el resto. El cabo mudado pasa a ser zona **Blog**.
2. **Excepción: el cartel de Writing tiene dos sitios.** Se mueve la
   plataforma entera (pilotes, cubierta, caseta, baliza, boyas propias si las
   tiene, cartel). Nunca hay dos plataformas a la vez. RESUME y PORTFOLIO no
   cambian.
3. **En los dos sitios, Writing queda abajo a la derecha de la pantalla, nunca
   en el centro.**
   - Sitio ancho (16:9 o más ancho): en el agua oscura, a la derecha y abajo.
   - Sitio angosto: por debajo de la isla, abajo a la derecha.
4. **Regla de elección:** se usa el sitio ancho si la caja de la palabra
   Writing, con su margen de rótulo, entra entera en la ventana de
   `coverView(w, h)`. Si no entra, se usa el sitio angosto. No hay un umbral de
   aspecto elegido a mano.
5. **Un solo trazado de carriles para todas las pantallas.** Los carriles pasan
   **entre** los dos sitios: al este del sitio angosto y al oeste del sitio
   ancho.
6. **Foco angosto:** `COVER_FOCUS_U` pasa de 0,35 a 0,39 para que la ventana
   del celular quede centrada en la columna de carteles. Con 0,35, PORTFOLIO
   se corta en 390 px y el faro no entra.

## 3. Composición

Las coordenadas son de partida. Las verificó un cálculo sobre `coverView`, pero
el implementador puede ajustarlas mientras cumplan §5. Si las cambia, anota los
valores finales y el motivo en el PR.

### 3.1 Foco

`COVER_FOCUS_U = 0.39` en `src/world/view.ts`. Hay que actualizar el comentario
y el test 3 de `view.test.ts` (foco en 390×750). Entre los aspectos 1,25 y
1,78 la ventana se corre unas 40 u a la derecha; en 4:3 sigue clavada en
0,40. Las pantallas de aspecto ≥ 16:9 no cambian.

Proyección del cálculo con 0,39 (centro de la palabra):

| Host | RESUME | PORTFOLIO | Writing | Faro (linterna) |
|---|---|---|---|---|
| 1600×900 | 0,30, 0,42 | 0,47, 0,18 | ancho 0,79, 0,72 | 0,50, 0,72 |
| 1024×768 | 0,38 | 0,61 | angosto 0,55, 0,86 | 0,65 |
| 820×1180 | 0,27 | 0,70 | angosto 0,60, 0,86 | 0,79 |
| 390×750 | 0,19 | 0,77 | angosto 0,63, 0,86 | 0,89 |
| 360×740 | 0,17 | 0,79 | angosto 0,64, 0,86 | 0,91 |
| 430×932 | 0,15 | 0,81 | angosto 0,65, 0,86 | 0,93 |

Con el cabo en el sitio de §3.4 y su punta en x ≈ 414, la linterna queda a la
derecha de la ventana del celular. Con 0,39 entra en 360, 390 y 430 px (en
0,93 en el peor caso). Si el cabo final queda más al este, se puede subir el
foco a 0,40 mientras RESUME siga entrando entero.

### 3.2 Writing: dos sitios

- **Sitio ancho** `PLATFORM_SITE_WIDE` ≈ (550, 125): en el agua oscura, al este
  del carril de vuelta. Es Blog por geografía.
- **Sitio angosto** `PLATFORM_SITE_TALL` ≈ (440, 400): al sur de la isla y del
  cabo mudado, al oeste del carril de salida. Es Blog por geografía. Cae fuera
  de `WORLD` (y1 = 336), en el sangrado, que es mar y se ve en el recorte. Su
  cubierta (x ≈ 413..467, y ≈ 373..427) queda a unas 55 u al sur de la orilla
  del cabo.

`PLATFORM_SITE` (392, 178) desaparece. `seaPlatformAt` recibe el sitio, y
`BLOG_SIGN` pasa a ser uno por sitio (`blogSign(site)` o dos constantes), con
`signSpec` calculado para cada uno.

**Elección y cambio de sitio:**

- Una función pura decide el sitio, por ejemplo `writingSite(w, h)` en
  `src/world/signs.ts`: aplica la regla 2.4 con `signBox` del sitio ancho y la
  ventana de `coverView`.
- El sitio se decide con el tamaño del host **sin zona abierta**, es decir, el
  área de `#app` y no el host del mapa cuando el panel de contenido lo
  angosta. Se recalcula cuando cambia el viewport o la orientación, no en cada
  cuadro de la transición CSS de abrir o cerrar una zona. Así la plataforma no
  salta al navegar a una zona.
- El cambio de sitio no reconstruye el mundo. La plataforma sale de la parte
  estática de `sea()` y pasa a una capa propia que se puede reubicar. Hay dos
  candidatos, a elegir en el plan:
  - un `Animator` (`platformAnimator`) con capas `solid` y `accent` y un
    `setSite(site)` cuyo `tick` marca las capas cuando el sitio cambió;
  - dos contenedores armados al arrancar, de los que se ve uno solo.

  En los dos casos se respetan el velo (las luces de la plataforma son Blog en
  los dos sitios), el bloom y el presupuesto de acentos de #389. La plataforma
  suma unos 650 acentos, y nunca deben contarse dos veces.
- `SIGNS.blog`, `signPolygons`, `signBox`, `zoneAtScreen` y `placeLabel`
  siguen el sitio activo: el clic y el rótulo accesible quedan sobre el cartel
  que se ve.
- `zoneView("blog")` muestra el cartel entero en el sitio activo, en
  1920×955, 768×955 y 390×300. Si `zoneFrame("blog")` no lo incluye (el sitio
  angosto está en y > 336), se extiende la caja de Blog o se acota con el
  cartel.

### 3.3 Carriles

Se cambia solo el tramo sur de `LANE_OUT` y `LANE_BACK`, a partir de y ≈ 176.
El tramo norte, de la boca a la punta del cabo, no cambia.

- `LANE_OUT` deja de doblar hacia el sur-suroeste por (420, 232) → (377, 647).
  En cambio, baja pasando **al este** de la punta del cabo mudado (x ≥ 440 a
  la altura de y ≈ 290) y **al este** del sitio angosto (x ≥ 481 a la altura de
  y ≈ 400).
- `LANE_BACK` mantiene la separación de unas 42 u al este del carril de salida
  y pasa **al oeste** del sitio ancho: a la altura de y ≈ 125, x ≤ 500.
- El tramo norte no tiene que esquivar más el cabo en su sitio viejo. Puede
  quedar igual o enderezarse; da lo mismo mientras pase los tests.
- Los dos siguen terminando en el sangrado, fuera del cuadro, con el fundido
  (`FADE_U`) en el sangrado.

Valen todos los tests de `src/scenes/sea-anim.test.ts`: agua de profundidad
≥ 6, Blog para x ≥ 380, ninguna oclusión estática, dos cargueros que no se
tocan, la lancha a más de 20 u de los dos carriles, cobertura, y que ningún
barco cruce las letras de un cartel. Esta última se corre **con los dos sitios
de Writing**.

Regla nueva: la cubierta de la plataforma queda a ≥ 14 u de los dos carriles
en los dos sitios. #390 midió 14,7 u en (392, 178).

### 3.4 El cabo del faro se muda entero

**Se muda la península entera, no solo el faro.** Es todo lo que hoy forma la
punta: el polígono `HEADLAND` y su terreno (`headland`, la orilla y el
`reef` alrededor, `distToHeadland`), las rocas y el sendero de roca, la torre
(`LIGHTHOUSE`) con su linterna y su haz, la casa del farero (`KEEPER`) con su
ventana y su cartelito, los neones de la galería y de la costa del cabo, y
`headlandZ`. Todo se traslada como **un bloque rígido**, con la misma forma,
la misma orientación y las mismas posiciones relativas. La única excepción es
la base, que se ajusta para apoyarse en la costa nueva.

- **Traslación de partida:** (+14, +172).
  - La base, que hoy se apoya en el muelle de alistamiento (x 330..344,
    y 97..134), pasa a apoyarse en la costa este de la isla (x = 344,
    y ≈ 269..306). Esa costa es recta, en x = 344, entre y ≈ 160 y y ≈ 320.
  - Los vértices de la base pasan de x = 330 a x = 344.
  - La punta queda en x ≈ 414, y ≈ 286..294, y el faro cerca de (410, 290).
- **Mejor como dato:** conviene que la traslación sea una constante, por
  ejemplo `HEADLAND_SHIFT`, aplicada a `HEADLAND`, `LIGHTHOUSE`, `KEEPER` y los
  demás puntos del cabo, en vez de reescribir cada coordenada a mano.
- **El sitio viejo** (al este del muelle de alistamiento, en la boca) pasa a
  ser mar. El muelle de alistamiento del astillero termina en el agua. Hay que
  revisar con capturas que la boca y el astillero no queden con huecos ni con
  terreno suelto.
- **Zona: el cabo mudado es Blog.** Hoy `worldZoneAt` devuelve Portfolio para
  el cabo, su arrecife y su orilla (`inHeadland || distToHeadland < SHORE_W`,
  "el faro remata el astillero"). Esa regla cambia: el cabo pasa a ser
  **Blog**.
  - Cambian el clic, el hover y el velo de sus luces (ADR 0001: la luz sigue
    a su posición).
  - Hay que actualizar el comentario de `worldZoneAt`, la entrada *Zone* de
    `CONTEXT.md` y los tests de geografía y de velo que fijan el cabo como
    Portfolio.
  - El astillero sigue siendo Portfolio.
- **Restricciones:**
  - El cabo no pisa sólidos de la isla (la costa del barrio costero, sus
    faroles del malecón).
  - Si un sólido de la isla queda dentro del polígono nuevo, se corre el cabo
    unas unidades al norte o al sur, sin achicarlo.
  - `terrain-classify.ts` y `city-grid` siguen leyendo `inHeadland` y
    `distToHeadland`; sus tests se actualizan con la posición nueva.
- **`LANDMARKS.blog`:** pasa a ser el faro en su posición nueva (hoy vale
  (470, 160) y `CONTEXT.md` dice que es el faro). El test
  `worldZoneAt(LANDMARKS.blog)` = `blog` sigue pasando.
- **Storybook:** se actualizan los exhibits `faro` y `plataforma-escena`, más
  los que encuadren el cabo o el muelle de alistamiento. Hace falta un
  exhibit de contexto por sitio de Writing: `plataforma-escena` (ancho) y
  `plataforma-escena-angosta`, los dos bajo la compuerta de carteles de
  `src/lab/signs.test.ts`.

## 4. Lo que no cambia

- RESUME (`CROWN_SITE`) y PORTFOLIO (`TINKER_SITE`).
- `coverQuad`, el sangrado y su generación, y `clampToCover` / `clampToBleed`.
- Las pantallas de aspecto ≥ 16:9, salvo lo que cambia en la escena: la
  plataforma, los carriles y el faro.
- Los niveles de legibilidad 1 a 3 y sus escalas (1,17 y 0,83).

## 5. Criterios de aceptación

Vitest, sobre funciones puras con `coverView` y `signBox`:

1. Para 1920×955, 1600×900, 1440×900, 1366×1024, 1280×900, 1180×820,
   1024×768, 1000×1000, 900×1000, 820×1180, 768×1024, 430×932, 390×750 y
   360×740, las cajas de las tres palabras (con el sitio que elige
   `writingSite`) y la linterna del faro caen enteras dentro del host.
2. Writing nunca queda en el centro. El centro de su palabra cumple
   x ≥ 0,52·w e y ≥ 0,68·h en todos los tamaños de (1). En los de aspecto
   ≥ 16:9 cumple además x ∈ [0,70, 0,88]·w.
3. `writingSite` elige el sitio ancho para todo aspecto ≥ 16:9 y el angosto
   para todo aspecto < 1. Es estable: no oscila entre 1 y 16:9 al variar el
   ancho de a 1 px.
4. Carriles: los tests de §3.3, con los dos sitios, y la separación ≥ 14 u
   entre la cubierta y los carriles.
5. Cabo: el cabo mudado conserva la forma (los vértices de `HEADLAND` menos
   la traslación coinciden con los de hoy, salvo los de la base). El faro y
   la casa del farero mantienen su posición relativa al cabo.
   `worldZoneAt` es `blog` sobre el cabo, su arrecife y su orilla. Ningún
   sólido de la isla queda dentro del polígono nuevo, y el sitio viejo
   clasifica como mar.
6. Compuerta de carteles (`signs.test.ts`): `checkSign` pasa para los dos
   exhibits de Writing a 1,17 y 0,83, contra los sólidos del mundo.
7. Presupuestos del mundo (acentos estáticos, polígonos) sin subir: la
   plataforma cuenta una sola vez.
8. `npm test` y `npm run typecheck` en verde.

Verificación visual en el PR, con agent-browser (ver `CLAUDE.md`; usar
`localhost` y no `127.0.0.1`):

- capturas del mapa en 390×750, 430×932, 820×1180, 1024×768, 1366×1024,
  1600×900 y 1920×955, antes y después;
- capturas de `/area/blog/` en 1920×955 y 390×750;
- una rotación simulada (cambiar el viewport de 820×1180 a 1180×820) en la que
  la plataforma cambia de sitio sin recargar la página.

Criterios de las capturas:

- se ven los tres carteles y el cabo con su faro;
- en el sitio viejo del cabo (la boca, junto al muelle de alistamiento) no
  quedan huecos ni terreno suelto: hace falta una captura de esa zona en
  1920×955;
- Writing está abajo a la derecha;
- en 390×750 no hay ningún rótulo de emergencia pegado al borde;
- en escritorio los barcos no pasan por encima de Writing ni lo tapan.

Si cruzan el cartel o compiten con él a simple vista, se corre el sitio ancho
hacia el noreste (más arriba a la derecha en pantalla) y se anota en el PR.

`npm run legibility` (nivel 3) con los dos sitios, y `REPORT.md` regenerado.

## 6. Documentación

- **ADR 0004:** "El sitio de Writing depende del host". Es la excepción a "un
  solo mundo" y revisa la consecuencia de ADR 0003 sobre celulares. Explica la
  regla de 2.4 y por qué el sitio se decide con el host sin zona abierta.
- El ADR 0004 registra también que el cabo mudado pasa de Portfolio a Blog.
- `CONTEXT.md`: entradas *Sign* (dos sitios de Writing y `writingSite`),
  *Lanes* (tramo sur nuevo), *Cover frame* (`COVER_FOCUS_U` 0,39) y *Zone*
  (el cabo pasa a ser Blog y deja de "rematar el astillero").
- README del storybook, si cambian los ids de los exhibits.

## 7. Fuera de alcance

- Arrastrar para recorrer el mapa en celular.
- Mover otras piezas: la feria, el astillero, la punta este de la isla y sus
  galpones.
- Cambiar el diseño de los carteles o su legibilidad.
- El humo de la fábrica sobre PORTFOLIO (ADR 0003, conocido).

## 8. Desvíos y medición

Cierre de #423 (verificación en #429). Las capturas "después" y su juicio están
en `assets/423-composicion-responsive/despues/README.md`; la tabla de
legibilidad, en `assets/carteles-legibilidad/REPORT.md`.

### 8.1 Valores finales

- `HEADLAND_SHIFT` = (+14, +172), como en la spec: el cabo quedó en x 344..414,
  y 269..306, con el faro en (410, 290). No hubo que correrlo al norte ni al sur.
- `PLATFORM_SITES`: ancho (570, 105) y angosto (440, 400). El angosto es el de
  partida de §3.2. El ancho se corrió 20 u al noreste desde (550, 125), el
  máximo que permite #429: en su pasada de vuelta, a t ≈ 790..810 s, el
  carguero entraba en la caja de la palabra Writing en pantalla. No cruzaba
  las letras, pero competía con ellas a simple vista. Con 5, 10 y 15 u la caja
  seguía tocada; con 20 u queda a 2,9 u proyectadas. Lo fija el test "no ship
  piece's screen box reaches the box of the Writing word at the wide site" de
  `src/scenes/sea-anim.test.ts`. La caja del exhibit `plataforma-escena` se
  corrió igual, a x 536..604, y 71..139. Las capturas están en `despues/README.md`.
- `COVER_FOCUS_U` = 0,39, como en §3.1.
- Carriles, tal como quedaron en `src/scenes/sea-anim.ts` (no los borradores del
  comentario de la historia):
  - `LANE_OUT`: (362, -16), (398, 40), (424, 86), (437, 114), (440, 142),
    (434, 176), (446, 232), (456, 290), (486, 347), (500, 405), (523, 510).
  - `LANE_BACK`: (564, 467), (548, 330), (546, 262), (512, 200), (480, 144),
    (477, 102), (461, 66), (434, 18), (397, -39).
- Umbral del sitio: medido con `writingSite(w, 900)`. El sitio ancho aparece
  desde w = 1390, un aspecto de 1,54 (1390/900); por debajo, el angosto. Con
  el sitio en (550, 125) era w = 1330 (1,48). No es un umbral elegido: sale de
  la decisión 4 de §2.
- Rotación: 900×1440 usa el sitio angosto y 1440×900 el ancho. Al girar sin
  recargar la página, el `transform` del enlace de Writing cambia en los dos
  sentidos y el marcador `window.__rot429` se mantiene (no hubo recarga).

### 8.2 Presupuesto del mundo

Polígonos estáticos (`buildRenderList` de `terrain.ground`, `ground` y
`solids`) y acentos estáticos de `assembleWorld(undefined, { reducedMotion: true })`,
contados como en `src/scenes/city-budget.test.ts`:

| | Polígonos | Acentos |
|---|---|---|
| Antes (issue) | 46 481 | 2 409 |
| Después | 46 146 | 1 753 |

Los dos bajan respecto del número de la issue (criterio 7 de §5, cumplido).

### 8.3 Legibilidad, nivel 3

Desde #429 las medidas vigentes de nivel 3 viven aquí; el §8.1 de la spec
2026-11-15 conserva las del 2026-11-17. Los valores de los contextos viejos
cambiaron respecto de 2026-11-17 porque cambió su entorno (cabo, carriles y
sitios de la plataforma), y todos siguen en ✓.

| Contexto | Escala | Contraste | Halo | OCR |
|---|---|---|---|---|
| `cartel-torre-escena` | 1.17 | 10.44:1 | 0.05 | `RESUME` |
| `cartel-torre-escena` | 0.83 | 9.58:1 | 0.04 | `RESUME` |
| `cartel-taller-escena` | 1.17 | 6.60:1 | 0.08 | `PORTFOLIO` |
| `cartel-taller-escena` | 0.83 | 5.75:1 | 0.08 | `PORTFOLIO` |
| `plataforma-escena` | 1.17 | 12.27:1 | 0.07 | `Writing` |
| `plataforma-escena` | 0.83 | 12.19:1 | 0.04 | `Writing` |
| `plataforma-escena-angosta` | 1.17 | 12.16:1 | 0.07 | `Writing` |
| `plataforma-escena-angosta` | 0.83 | 12.08:1 | 0.04 | `Writing` |
