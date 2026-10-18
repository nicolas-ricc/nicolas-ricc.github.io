# Mundo 2: sombras, sangrado, fábrica, distrito moderno y Blog — diseño

**Fecha:** 2026-09-14
**Estado:** implementada (2026-09-14)
**Antecede:** `2026-09-14-mundo-isometrico-design.md` (§4 rulings, §6 Blog),
`2026-09-14-resume-ciudad-design.md` (grilla y desvíos de la ciudad),
`2026-09-13-portfolio-isometrico-design.md` (astillero).
**Alcance:** el laboratorio (`lab/*.html`). La reintegración al sitio (cámara
*cover*, hover, zoom a landmark, panel) sigue siendo una spec aparte; esta spec
deja el mundo listo para ella.

## 1. Objetivo

Cinco cambios sobre el mundo isométrico, en una sola spec porque cada uno fija
coordenadas o capas que el siguiente usa:

1. **Sombras** uniformes y con gradiente definido, en clima de atardecer.
2. **Mundo más grande** con origen negativo y **sangrado** de terreno alrededor,
   para que la cámara del sitio pueda cubrir el viewport sin mostrar cielo.
3. **Fábrica** detrás (al norte) y al oeste del astillero: chimeneas humeantes,
   grúa torre, playa de vías. Portfolio pasa a hablar de fabricación y actividad.
4. **Distrito moderno** en Resume: dos columnas al oeste y dos filas al sur con
   torres de vidrio, edificios clásicos grandes, campus de startups con patio
   verde y una obra en construcción. Look de business centre.
5. **Blog:** mar con una fosa de agua profunda, punta con faro, barcos que se
   van. La zona clickeable Blog es **solo el agua profunda**; la punta y el faro
   cuentan como Portfolio para el hover y el click.

Criterios de éxito:

- `lab/world.html` muestra las tres zonas ampliadas sin grietas, con sangrado
  alrededor, sin cielo dentro del rectángulo 16:9 inscripto en el rombo.
- Ninguna sombra se oscurece por superposición; toda sombra tiene núcleo denso
  y punta suave.
- Piso de calidad por zona (tabla en §9).
- El motor sigue puro y cubierto por tests; ningún color fuera del atlas.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Crecimiento | Hacia afuera: el mundo gana origen negativo. Nada de lo hecho se mueve; las costuras x 344 e y 146 no cambian |
| Sangrado | Terreno de relleno con celda 18 alrededor del contenido. Lomas solo detrás del contenido (norte y oeste); al sur y al este, chato |
| Zonas clickeables | Por geografía, no por corte en x: la punta, el arrecife y su orilla son Portfolio; la orilla del malecón es Resume; el mar abierto es Blog |
| Sombra | Una unión por banda (`AlphaFilter` sobre el contenedor), dos bandas (completa y núcleo), color violeta cálido |
| Skyline | Tope 24 en el distrito nuevo; la torre de 30 sigue siendo el único landmark de Resume. Las manzanas viejas no cambian. Sombras recortadas a 18 |
| Esbeltos | Chimeneas y mástiles de grúa superan 18 (como la grúa pórtico): se consideran esbeltos si r ≤ 3 o lado ≤ 3 |
| Barcos | El `hull` acepta `heading`; las piezas del barco se emiten como `poly` con huella rotada. Rotación general de sólidos sigue fuera de alcance |
| Materiales nuevos | `brick` (fábrica), `curtain`, `stone`, `copper` (distrito), `abyss`, `foam`, `whitewash` (Blog). Exclusivos por zona; `steel`/`rust` siguen compartidos en vehículos, grúas y barcos |
| Landmark Blog | Pasa del faro a la boya del pecio en la fosa, `(470, 160)` |

### Desvíos de la implementación

Decididos al planificar (plan `2026-09-14-mundo-2-fabrica-distrito-blog.md`,
sección "Desvíos respecto de la spec"):

- `WORLD = { x0: -60, y0: -60, x1: 570, y1: 336 }` (no 560/330) y
  `BLEED = { x: 342, y: 378 }` (no 320/260): el sangrado es una grilla de 18
  anclada en la esquina del contenido, así que ancho y alto del contenido
  tienen que ser múltiplos de 18 y los sangrados también. Blog gana 10 al este
  y Resume 6 al sur (selva). El terreno proyectado es un paralelogramo (lados
  con pendiente ±1/2), un rombo solo si `Wx = Wy`, así que el rectángulo 16:9
  inscripto queda acotado por `min(Wx, Wy)`: con este sangrado
  `Wy = 396 + 2·378 = 1152 ≥ 1128` (`Wx = 630 + 2·342 = 1314`, mayor y no
  limitante). `coverFrame` usa la fórmula del paralelogramo y se retrae
  `COVER_INSET = 3` (el borde de la malla es agua a z −1).
- El vértice de sangrado que cae sobre la costura toma la z base del terreno
  del contenido en ese punto (no 0.6): al norte del astillero el borde es
  losa de fábrica (z 0). Entre dos vértices de sangrado (18 u) el borde del
  contenido puede cambiar de tierra a agua: queda una grieta de ≤ 1.6 u,
  aceptada.
- `HILL_TAPER = 72` (`src/scenes/terrain.ts`): las lomas del norte bajan a 0
  en las 4 celdas antes del corte selva/bahía, así la selva llega al agua a
  0.6 y no queda un acantilado sin cara.
- Los conos del arrecife caen al centro de la celda cuando el desplazamiento
  aleatorio los saca de una celda `reef` (el anillo del arrecife mide 6 u, y
  un desplazamiento puede caer en orilla o roca en vez de agua de arrecife).
- `COVER_INSET = 3` (`src/lab/draw.ts`): el `coverFrame` se retrae esa
  cantidad hacia el centro porque el borde de la malla no es exactamente el
  paralelogramo a z 0 — es agua a z −1 o selva a 0.6 ± 0.8 —, es decir hasta
  1.4 px por debajo de él en pantalla.
- Piso de calidad Blog: ≥ 110 sólidos elevados (no 250), contando arrecife
  (hasta 40 conos), pedruscos (20), roca (6 `poly`), faro, casa, boyas, pecio
  (≥ 80 estáticos) y los tres barcos (~30). La spec heredó 250 de la spec del
  mundo; el usuario pidió que el Blog sea agua.
- *Desvío: reemplazado por los carriles semirrectos de #87 (`LANE_OUT` /
  `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63, con fases 0,
  1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Ruta de barcos ejecutada (`ROUTE` en `src/scenes/sea-anim.ts`):
  `(326, -24) → (350, 10) → (500, 20) → (510, 118) → (520, 172) → (545, 224)
  → (610, 260)`, no la polilínea de la spec. El inicio en `(326, -24)` (no
  `(290, -6)`) evita que un barco en la bahía (`max.y < 24`) quede detrás
  (`isBehind` por y) de los galpones del muelle de alistamiento o de su selva
  y se pinte encima. El trazado corre más al este y al sur que la spec porque
  la caja de alineación en pantalla del carguero (60 u de eslora) es mucho
  más ancha que su silueta real cuando la proa apunta en diagonal (35°..55°):
  un trazado en diagonal directa hacia el este de la punta cruza en pantalla,
  en algún tramo, la boya `BUOYS[0]` `(420, 80)` o el arrecife (conos cerca de
  `(405, 111)`) aunque el barco esté a decenas de unidades de distancia en el
  mundo real — falsos positivos del bounding-box del test de profundidad, no
  una superposición real. El tramo `(350, 10) → (500, 20)` se aplanó (casi
  puro este) para que el barco, casi horizontal ahí, tenga una caja angosta
  en y que no llegue a la altura de la boya ni del arrecife; recién gira
  hacia el sur en `x ≥ 500`, lejos de ambos.
- `glass` es compartido entre Blog y Resume: la linterna del faro es `glass`
  por spec §7.
- Espuma del arrecife: alterna `toneOffset 0 / -1` sobre material propio
  `foam` (no `+2 / +1` sobre `shore`) cada 500 ms; `sea.foam` es su propia
  capa `water`, dibujada después de `sea.band0..2` y `sea.abyss`, no dentro
  de una banda. El cerco de la obra son cuatro prismas
  `officeDark` de 1.2 (no un `strip`, que se pintaría bajo el zócalo).
- Grúa de la obra: mástil en `x + w − 8` y pluma de 14 (no 20): la huella útil
  mide 21 (`SIDEWALK = 1.5`) y pluma + contrapluma no pueden superarla.
- `TOWER_H`, `TOWER_FLOORS` y `LIT_FLOOR` se mudan a `city-grid.ts` (sin rng)
  para que `district.ts` calcule la caja del piso encendido sin importar
  `city.ts` (ciclo).
- Pecio en `(462, 150)` con heading 30° (no 466, 156): separado 12 u de la
  ruta. La boya del pecio sigue en `(470, 160)` (`LANDMARKS.blog`).
- Terraza verde de las torres de vidrio: prisma fino de `leafDark` (0.3) más
  conos, no `ground` (un `ground` no puede pintarse sobre un techo).
- Boyas: parpadeo 1 s encendida / 1 s apagada, desfasadas 1 s; se verifica que
  en un período de 2 s cada boya está encendida ≥ 1 s y que nunca están las
  dos apagadas a la vez.
- Las manzanas de distrito usan un `Rng` propio (`zoneRng(seed, "cv", 1)`),
  así las manzanas viejas no se re-sortean; autos y selva sí cambian de lugar.

Surgidos durante la ejecución de las tareas (no estaban en el plan):

- El este del astillero (galpones y selva `cluster(332, 340, 26, 94)`) obligó
  a que el inicio de la ruta de barcos fuera `(326, -24)` en vez de
  `(290, -6)`: un barco en la bahía con `max.y < 24` que se superponga en
  pantalla con esos sólidos queda detrás de ellos (`isBehind` por y) y se
  pintaría encima si no se corrige el punto de partida.
- El clúster de selva este del astillero (x 332..340) empieza en y 50 en vez
  de 26 para que los barcos que salen de la bahía nunca queden detrás de él
  (spec §5 decía que el astillero no cambia; este ajuste es una excepción
  puntual, no un cambio de su trazado).
- `maxDistrictHeight` no recorta ningún bloque actual del distrito: queda
  como guarda para futuras manzanas más altas.
- Cornisa de la fábrica en `h − 0.8`; portones que sobresalen 0.3; un portón
  este en `y −23..−17`; la cinta transportadora arranca en `x 121` (fuera de
  la planta); los vagones N-S estacionados arrancan en `y −46`.
- `DISTRICT_BANK_Y = 264` y `MALECON_STREET_X = 336` (múltiplos de `CELL`)
  clasifican la banda este del distrito; las rayas N-S del anillo este paran
  en `DISTRICT_BANK_Y`.
- `SEA_STEP_MS = 150` (el mar se redibuja cada 150 ms, no cada frame) para
  bajar el costo de redibujo; la espuma del arrecife (`sea.foam`) es su
  propia capa `water`, dibujada después de `sea.band0..2` y `sea.abyss`,
  y se repinta cada 500 ms.
- Presupuesto medido en Chrome headless sin GPU, DPR 2 (ver detalle abajo):
  el objetivo de peor redibujo ≤ 6 ms **no se cumple** en este entorno en
  ninguna página salvo `portfolio.html`. La solución de recambio prevista en
  el plan (RenderTexture estático para sombras y partir el mar en 4 bandas,
  `BANDS = 4` + `sea.band3`) **no se implementó**: falta medir primero en un
  Chrome de escritorio con GPU real, donde el costo del `AlphaFilter` por
  banda y el de recomponer el mar cada `SEA_STEP_MS` puede ser muy distinto.
  `buildRenderList` calcula `shadowPolygon` dos veces por sólido elevado (la
  banda completa y el núcleo), así que el costo de CPU por redibujo de las
  capas animadas prácticamente se duplicó con la Task 1; conviene medir eso
  primero en un navegador de escritorio con GPU antes de ir al recambio de
  RenderTexture. Ver la tabla de presupuesto en el reporte de la Task 7
  (`task-7-report.md`) y la memoria `mapa-iso-world-rulings.md`.

## 3. Sombras (`src/iso/light.ts`, `render-list.ts`, `src/lab/runtime.ts`)

**Diagnóstico.** Cada sólido proyecta un casco convexo y todos van a una
`Graphics` con alpha 0.55; Pixi aplica el alpha polígono por polígono, así que
donde dos cascos se superponen (edificio y zócalo, edificio y vecino) el suelo
se oscurece dos veces. El "cuadrado más oscuro en la punta" es esa
superposición; el resto de la sombra queda tapado por el propio edificio.

**Diseño.**

- `shadowPolygon(s, maxH)` recibe el tope: la banda **completa** usa
  `SHADOW_MAX_H = 18`, el **núcleo** usa `SHADOW_CORE_H = 9`. El núcleo es
  siempre subconjunto de la completa (mismos vértices, longitud recortada).
- `Layer` suma `"shadowCore"`. `buildRenderList` emite, por sólido elevado,
  un ítem `shadow` y un ítem `shadowCore`, en ese orden, antes de los sólidos.
- El runtime tiene dos contenedores, `shadowSlot` y `coreSlot`, cada uno con
  un `AlphaFilter` (alpha 0.30 y 0.30; combinado ≈ 0.51 en el núcleo, 0.30 en
  la punta). Dentro se dibuja todo a alpha 1: las `Graphics` estáticas **y**
  las de sombra de cada sólido animado (carro, barcos, humo), que dejan de vivir
  en `solidSlot`. Así tampoco se oscurece el cruce entre sombra fija y móvil.
- `ISO_COLORS.shadow` pasa a `0x2a1a3a` (violeta cálido de atardecer). Sigue
  siendo la única sombra; el gradiente lo dan las dos bandas.
- `SUN_ELEVATION` y `SHADOW_DIR` no cambian (25°, ENE): ya son sombras largas.

Tests: `light.test`: el núcleo de un prisma de 20 mide como uno de 9 y cabe
dentro de su sombra completa. `render-list.test`: por sólido elevado hay un
`shadow` y un `shadowCore`, ambos antes del primer `solid`; `shadowCore` tiene
área menor o igual. `pixi-free.test` sigue valiendo para `src/iso`.

## 4. Mundo: origen, sangrado y zonas clickeables (`src/map/geo.ts`, `src/scenes/terrain.ts`)

### Coordenadas

- `WORLD = { x0: -60, y0: -60, x1: 560, y1: 330 }` reemplaza a
  `WORLD_W`/`WORLD_H`. `zoneFrame("all")` y `buildTerrain` usan `WORLD`.
- `BLEED = { x: 320, y: 260 }`: el terreno cubre `x -380..880`, `y -320..590`.
- Zonas visuales (para filtrar celdas y escenas): Portfolio `x < 344, y < 146`
  (incluye la banda norte `y -60..0` y la columna oeste `x -60..0`); Resume
  `x < 344, y ≥ 146` (incluye `x -60..12` e `y 270..330`); Blog `x ≥ 344`.
  `ZONE_SPLIT_X` y `ZONE_SPLIT_Y` no cambian.

### Sangrado

Por qué: un rectángulo iso se proyecta como rombo de semidiagonales
`a = (Wx + Wy)/2` y `b = a/2`. El rectángulo de aspecto `r` inscripto mide
`u = r·a/(r+2)` de semiancho y `v = a/(r+2)` de semialto. Con 16:9, para que
el rectángulo inscripto contenga la caja de pantalla del contenido
(`1010 × 505`, más 42 de la torre) hace falta `a ≥ 1074`, es decir
`Wx + Wy ≥ 2148`. Con el sangrado propuesto `Wx + Wy = 2170`.

- `CELL_BLEED = 18`. El sangrado es una segunda grilla que rodea a la de
  `CELL = 6`; comparten los vértices de la costura (`WORLD` está alineado a 6
  y a 18 desde el origen del sangrado). **Ningún vértice sobre la costura
  lleva jitter**, en ninguna de las dos grillas, así no hay grietas.
- Clasificación del sangrado, `bleedTerrainAt(x, y)`:
  - norte (`y < -60`): `x < riverCenter(y) - RIVER_HALF` → `jungle`; si no,
    `sea` (la bahía de la desembocadura sigue hacia el norte).
  - este (`x > 560`): `abyss` si `x ≥ abyssX(y)`, si no `sea`.
  - sur (`y > 330`) y oeste (`x < -60`): `jungle`.
- Lomas: solo en norte y oeste. `z = 0.6 + 12 · min(1, d / 200)` con `d` la
  distancia al borde del contenido, jitter 3; las celdas con `z > 9` salen en
  `rock`. Sur y este: `jungle` a 0.6 (jitter 0.8) o agua a -1. Motivo: con la
  cámara al SE, lo que está al sur o al este queda delante del contenido y una
  loma lo taparía; al norte y al oeste queda detrás.
- El sangrado sale como `ground` propios (`bleedGround: Solid[]`) para que el
  runtime los pinte primero y las páginas de zona puedan omitirlos.
- Test: `coverFrame(16/9)` (rectángulo inscripto en el rombo del terreno
  completo) contiene `zoneFrame("all")` proyectado. Otro: ninguna celda del
  sangrado con `y > 330` o `x > 560` supera z 1.4.

### Zonas clickeables

`worldZoneAt(x, y)` deja de cortar en x 344:

1. Si `inHeadland(x, y)` o `distToHeadland(x, y) < SHORE_W` → `"portfolio"`.
2. Si `x < 344` → `y < 146 ? "portfolio" : "cv"`.
3. Si `x < 344 + shoreWidth(y)` → `y < 146 ? "portfolio" : "cv"`
   (`shoreWidth` se muda de `terrain.ts` a `geo.ts`).
4. Si no → `"blog"`.

`terrainAt` despacha por geografía, no por zona: `x ≥ 344` o punta →
`seaTerrainAt`; el resto por `y`. Así el terreno visual no cambia, y la orilla
frente al malecón sigue siendo `shore` aunque clickee como Resume.

Tests: la punta, el arrecife y `(350, 118)` son Portfolio; `(350, 200)` es
Resume; todo punto clasificado `abyss` o `sea` a más de `SHORE_W` de la punta y
más de `shoreWidth` del corte es Blog; ningún punto con terreno de tierra cae
en Blog. El filtro por zona de `buildTerrain` sigue usando `worldZoneAt`, así
`lab/portfolio.html` incluye la punta.

### Fosa

- `abyssX(y) = 392 + 0.25 · (y + 60) + 6 · sin(y / 17)`: talud diagonal
  NE-SO que se abre hacia el este. En y 118 vale ≈ 437, a 37 u de la punta.
- `Terrain` suma `"abyss"` (`waterDeep` → plataforma; `abyss` → fosa), z -1,
  plano, sin espuma. `TerrainMesh` suma `abyss: Solid`.
- El talud se lee por el salto de tono; el agua es plana. Onda más lenta y
  sutil en la fosa (§8).

## 5. Fábrica (Portfolio; `src/scenes/factory.ts`, `factory-anim.ts`)

Ocupa la banda norte (`x -60..205, y -60..0`, al oeste del río) y la columna
oeste (`x -60..0, y 0..146`). `shipyard()` no cambia salvo el muro del muelle
(`quay`) que se extiende al norte hasta `y -60`; `factory(rng)` es una escena
propia concatenada por `world.ts`, con el mismo `Rng` de zona que el astillero
derivado con otro hash.

Terreno: `shipyardTerrainAt` cubre la banda y la columna. Banda norte
`x < QUAY_X` → `slab`; `x ≥ QUAY_X` → `water` (bahía, ya lo da `inMouth`).
Columna oeste: `slab` para `y < 110`, `jungle` para `y ≥ 110`.

Elementos (coordenadas de mundo, z sobre `slab` = 0):

- **Planta principal.** Prisma `brick` `x 20..120, y -46..-16, h 14`, con
  cinco dientes de sierra encima (rampas `dir: "w"`, w 20, h 4, `brick`).
  Portones: dos huecos como prismas `concrete` 6×0.5×8 en la
  cara sur. Cornisa: prisma `concrete` 0.6 saliente, h 0.8.
- **Chimeneas.** Tres, cilindros `brick` en (130, -40), (140, -34), (150, -40):
  r 2.8 / 2.6 / 2.4, h 22 / 26 / 24, sobre bases `concrete` 7×7×3, con una
  banda `rust` (cilindro r + 0.2, h 1) a dos tercios de altura. Esbeltas.
- **Humo.** Animación de sólidos: por chimenea, 5 bocanadas (cilindros
  `concrete` r 1.2 → 3, h 1.2, sides 6) que nacen en la boca, suben 0.25 u
  por unidad recorrida, derivan al NNE (`{0.45, -0.893}`) 2 u/s con seno lateral
  ±1.5 y se reciclan a 28 u; arrancan escalonadas (`i/n · rango`). Con
  `reduced-motion`, quietas y escalonadas. Sombra en `shadowSlot` como todo
  sólido animado.
- **Torre de enfriamiento.** Cuatro cilindros `concrete` apilados en
  (172, -36): r 9, 8, 7, 7.5, h 4 cada uno (16).
- **Grúa torre.** Helper compartido `towerCrane(at, mastH, jibLen, dir)` en
  `src/scenes/pieces.ts`: mástil `steel` 1.2×1.2, pluma prisma `jibLen×1×0.8`
  a `mastH - 1`, contrapluma 8 con contrapeso `concrete` 2×2×1.5, cabina
  `steel` 1.6×1.6×1.6, gancho colgando a mitad de pluma (prisma 0.6×0.6×(mastH·0.4)
  con bloque `rust`), luz `cyan` r 1 en la punta. En la fábrica:
  `at (60, -12), mastH 20, jibLen 30, dir "e"`. Esbelta.
- **Desvío ferroviario.** Dos `strip` `steel` de 0.4 separadas 1.6, a z 0.1,
  E-O en `y -8` desde `x -60` hasta `x 110`, con seis vagones (prismas
  8×2.4×3 alternando `rust`/`steel`, separados 1) y una locomotora
  (`steel` 9×2.6×3.6 con cabina 3×2.6×1) en `x -50..0`.
- **Cinta transportadora.** Del portón este de la planta (120, -20) al patio
  de material (30, 4): pasarela `steel` 2 de ancho, 0.6 de alto, a z 6, en dos
  tramos rectos, sobre caballetes `steel` 0.8×0.8×6 cada 12 u. Cruza la playa
  de camiones y la vía.
- **Subestación grande.** Seis transformadores `steel` 3×3×3 en dos filas y
  dos pórticos `steel` (postes 0.6×0.6×7 unidos por travesaño) en
  `x 150..190, y -60..-48`, cercada por `strip` `concrete` 0.3.
- **Playa de camiones.** `y -16..0`: tres camiones (prismas
  6×2.4×2.8 `rust` con cabina `steel`) y dos faroles `cyan`.
- **Columna oeste.** Playa de vías: tres `strip` `steel` N-S en `x -48, -38,
  -28` de `y -60` a `y 128`, empalmando con las vías del oeste (`RAIL_Y`)
  por una curva de `strip`. Acopios: cuatro conos `rust` (r 6..9, h 4..6) y
  dos `sand` (r 5, h 3) en `x -55..-5, y 40..100`, sin pisar vías. Selva de
  `flora.jungle()` en `x -60..-6, y 110..146` (14 conos).
- **Faroles.** Cinco `cyan` más en la fábrica (portones, grúa, subestación).

Tests (`factory.test`): determinismo; ≥ 120 sólidos elevados; todo dentro de
Portfolio; nada apoyado en agua; chimeneas y mástil son los únicos > 18 y son
esbeltos; humo: cada bocanada vuelve a la boca tras un ciclo, nunca más de 28
u de la boca, quietas con `reduced-motion`; solo materiales de Portfolio más
`steel`/`rust`; ningún vagón pisa otro. `world.test` suma "Portfolio ≥ 400
sólidos elevados con fábrica".

## 6. Distrito moderno (Resume; `src/scenes/city-grid.ts`, `city.ts`, `district.ts`)

### Grilla

- `WEST_COLS` suma `-48, -18` al inicio; `ROWS` suma `272, 302` al final.
  `CITY_EDGE` pasa a `{ west: -54, north: 158, south: 324 }` (múltiplos de
  6). Queda calle sur de 4 (320..324) como la actual 260..264.
- Las filas nuevas solo tienen manzanas en la ribera oeste: en y 272..320 el
  estuario llega a x 285..302, y la franja `302..334` al este del agua es
  selva con el malecón extendido hasta `y 326`. `EAST_COLS` no cambia.
- La avenida (`y 206..218`) y sus carriles, sendas y faroles se extienden
  hasta `x -54`. Los carriles N-S nuevos van en `x -21` y `x 9`.
- Manzanas nuevas: 2 columnas × 4 filas viejas + 8 columnas × 2 filas nuevas
  = 24. Todas `kind: "district"` en `blocks()`; `city.ts` delega esas a
  `district.ts`. Las manzanas viejas no cambian de tipo ni de seed.
- Selva: los cinturones oeste y sur se corren a los bordes nuevos; el cinturón
  norte no cambia.

### Tipos de manzana del distrito (`district.ts`)

Por `rng` con pesos, salvo la obra que es fija:

- **Torre de vidrio (40 %).** Dos o tres cuerpos apilados sobre el zócalo:
  base `w×d` completa (60 % de h), segundo cuerpo inset 2 (30 %), corona
  inset 4 (10 %). h total 16..24. Material `curtain`, fachada
  `{ floors: h/3, cols: w/2.5, floorH: 0.4, sill: 0.1 }` (muro cortina:
  losas finas, ventanas `glass` casi continuas). Sin piso encendido. Remate:
  helipuerto (cilindro `paving` r 3, h 0.3, luz `amberMid` r 0.6) o terraza
  verde (`ground` `leafDark` sobre la corona más 3..5 conos `leaf`). Baliza
  `amberMid` r 0.5 en toda torre ≥ 20.
- **Clásico grande (30 %).** Prisma `stone` 12..18 con fachada
  `{ floors: h/3.5, cols: 4..5, sill: 0.6, base: "portico" }`, pilastras
  (prismas `stone` 0.6×0.4 entre columnas de la planta baja), cornisa pesada
  (`officeDark`, saliente 0.8, h 1) y corona: techo `step` o cubierta `copper`
  a dos aguas (`gable`, h 3) sobre el cuerpo. Un reloj: acento `amberBleed`
  poly circular r 1.2 en el hastial.
- **Campus de startups (20 %).** Tres edificios `office` de 6..8 (fachada
  2..3 pisos, base `glass`) en tres lados del zócalo, y en el centro un
  **patio verde**: `ground` `leafDark` 10×8 con `toneOffset` sesgado, 4..6
  conos `leaf` y un sendero `paving` en cruz. Cartel luminoso: acento poly
  `amber` 4×1.2 vertical sobre el borde del techo del edificio norte más halo
  `amberBleed`. Mesas: 4 prismas `paving` 1×1×0.7.
- **Obra en construcción (fija, manzana `(-18, 272)`).** Esqueleto: cinco
  losas `concrete` 16×12×0.3 a z 3k, la última partida (8×12); seis columnas
  `steel` 0.6×0.6 hasta la losa 5; núcleo `concrete` 4×4×16; grúa torre
  `towerCrane((-12, 282), 22, 20, "e")`, tres luces `amber` en la losa alta,
  cerco `strip` `paving` 0.3 en el borde del zócalo, dos contenedores de obra
  `rust`.

Reglas comunes: zócalo `paving` como toda manzana; cornisa con material
contrario; ningún edificio pisa vereda (`SIDEWALK`). **Piso encendido
visible:** toda manzana cuya caja de pantalla (`screenBounds`) se superpone
con la del piso encendido de la torre y está delante (`isBehind`) limita h a
10; reemplaza la regla de "fila 3" fija y la contiene. Tope 24; el único > 24
sigue siendo la torre (30) y el mástil de la obra (esbelto).

Tests (`district.test` y `city.test`): determinismo; 24 manzanas de distrito;
≥ 4 torres de vidrio, ≥ 2 clásicos, ≥ 2 campus, 1 obra; todo campus tiene
`ground` `leafDark` dentro de su zócalo; nada supera 24 salvo torre y mástil;
nada delante del piso encendido supera 10; materiales nuevos solo en Resume;
Resume ≥ 450 sólidos elevados; la avenida llega a `x -54`.

## 7. Blog: punta, faro, mar y barcos (`src/scenes/sea.ts`, `sea-anim.ts`, `sea-animator.ts`)

Hereda el §6 de la spec del mundo; lo que sigue lo precisa o lo corrige.

### Punta y faro (estáticos)

- **Roca.** Tres afloramientos `poly` `rock` (5..6 vértices, h 2..3) a
  z 6..8 sobre la punta; `reef`: 20 conos `rock` r 1.5, h 1, sides 5, sobre
  celdas `reef`, sin pisar rutas.
- **Sendero.** `rock`, no `paving` (ruling de Resume): diez tramos de `strip`
  de 1.5 de ancho, cada uno a `headlandZ(x) + 0.15` de su centro, de
  (332, 115) a (393, 118). Escalonado porque la punta sube de 1 a 7.
- **Casa del farero.** Prisma `whitewash` 8×6×4 con `gable` en (372, 108),
  z `headlandZ(372)`; ventana: acento poly `magentaBleed` 1.2×1 en la cara sur.
- **Faro.** En (396, 118), base z 7. Seis cilindros apilados r 3.2 → 2.2
  (paso 0.2), h 4, alternando `whitewash` y `rust` (24). Galería: cilindro
  `steel` r 3, h 0.6, con 8 postes `steel` 0.3×0.3×1.2. Linterna: cilindro
  `glass` r 1.6, h 3. Cono `steel` r 1.8, h 2. Total ≈ 29.6 sobre la roca.
- **Haz.** Acento poly: cuña de 24 u y 14° a z 7 + 26.1 (centro de la
  linterna), `magentaBleed` alpha 0.5, con cuña interior de 12 u en `magenta`.
  360° cada 8 s. Con `reduced-motion`, fija apuntando al este.
- **Boyas.** Dos cilindros `rust` r 0.8, h 1.5 en (420, 80) y (430, 160)
  con luz `magentaMid` r 0.8 que parpadea (encendida 1 s, apagada 1 s,
  desfasadas). **Boya del pecio** en (470, 160): cilindro `steel` r 1, h 2,
  luz `magentaMid` r 1 fija, anillo de `foam` (`ground` de 8 triángulos, r 2.5).
- **Pecio.** `hull` 40×8×4 `hull`, heading 30°, a z -3 en (466, 156): asoma
  1 u. Mástil `rust` 0.6×0.6×6, vertical (no hay inclinación de sólidos).

### Mar

- Tres cuerpos: `shore` (`water`), `sea` (`waterDeep`), `abyss` (`abyss`).
  Todos z -1. Espuma: los triángulos de `shore` a menos de 2 u del arrecife o
  de la roca llevan `foam`-tone: `toneOffset +2` alternando con +1 cada 500 ms.
- **Onda.** Como el río: `toneOffset = round(sin(centro/8 - fase))` cada
  100 ms en `shore` y `sea` (ciclo 4 s); en `abyss`, `round(0.6 · sin(centro/14 - fase))`
  cada 200 ms (ciclo 8 s). El sangrado de mar no se anima.
- **Presupuesto.** El mar del contenido son ≈ 4.700 triángulos. Se parte en
  tres bandas por x (capas `sea.band0..2`, cada una `kind: "water"`), y cada
  tick redibuja a lo sumo una banda (round-robin): el costo por frame se
  divide por tres. Meta: peor redibujo ≤ 6 ms. Si al medir se supera, el
  paso sube a 150 ms antes que bajar la amplitud.

### Barcos

- **Motor.** `hull` suma `heading?: number` (radianes, 0 = proa al este): los
  puntos del casco se rotan alrededor de `at` antes de emitir caras. Helper
  `ship(kind, at, heading)` en `src/scenes/ships.ts` arma cada barco como
  `hull` + `poly` con huellas rotadas + cilindros: piezas de escala del
  astillero.
- **Flota.** Carguero: `hull` 60×10×5, superestructura `steel` 10×8×6 en popa,
  chimenea `rust` r 1.2 h 3, grúa de cubierta (`steel` 1×1×8 + pluma 6).
  Remolcador: `hull` 18×6×3, caseta `steel` 5×4×3. Barcaza: `hull` 40×9×2,
  seis contenedores 6×2.4×2.4 `rust`/`steel`. Luz de mástil `magentaMid` r 0.7
  y luces de posición (`magenta` r 0.4 a babor, `cyanMid` a estribor).
- **Ruta.** *Desvío: reemplazado por los carriles semirrectos de #87
  (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63,
  con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Una sola polilínea `ROUTE`: (290, -6) → (380, 56) → (432, 118)
  → (470, 172) → (530, 224) → (600, 260). Cumple: `x > 430` mientras
  `|y − 118| < 40`; nace en la bahía (agua de `inMouth`); cruza la fosa
  (`abyssX(172) ≈ 450 < 470`); termina en el sangrado este. Heading = dirección
  del tramo, interpolado en los 20 u alrededor de cada vértice.
- **Marcha.** *Desvío: reemplazado por los carriles semirrectos de #87
  (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63,
  con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Velocidades 1.2 / 2 / 0.8 u/s, fases 0 / 0.4 / 0.75 del ciclo.
  Desvanecido: alpha 0 → 1 en los primeros 30 u y 1 → 0 en los últimos 30 u
  (bruma). Al llegar al final se recicla al inicio. Sombra y estela siguen
  el alpha. `Graphics` propias por barco (sombra en `shadowSlot`).
- **Estelas.** Capa `kind: "water"` por barco: 4 triángulos `foam` `up` en V
  detrás, alpha del barco, longitud 25 u, regenerados con el barco.
- **Profundidad.** La ruta pasa siempre al este de la punta y del faro, así
  cada barco queda delante en pantalla; el sólido animado se dibuja después
  del estático, y el test verifica que ningún punto de la ruta está detrás de
  un sólido estático que se le superponga (`isBehind` + `screenBounds`).

### Animator

`seaAnimator(scene, terrain, opts)`, ids: `sea.band0..2` (water),
`sea.ship0..2` (solid), `sea.wake0..2` (water), `sea.beam` (accent),
`sea.buoys` (accent), `sea.foam` (su propia capa `water`, dibujada después
de `sea.band0..2` y `sea.abyss`).

Tests (`sea.test`, `sea-anim.test`): determinismo; cilindros del faro = 6 y
altura total del faro 29..30 sobre z 7; casa sobre la punta; sendero entero
sobre celdas `headland`; ≥ 250 sólidos elevados; ≥ 8 materiales; materiales
del Blog solo en Blog salvo `hull`/`steel`/`rust`; boyas y pecio sobre agua;
ruta entera sobre `water`/`sea`/`abyss`; ningún punto de ruta detrás de un
sólido estático; alpha exactamente 0 en el último punto; cada barco vuelve a
su posición tras un ciclo; haz 8 s por vuelta, fijo con `reduced-motion`;
parpadeo de boyas nunca dos ticks apagadas seguidas; `hull` con heading π/2
tiene la proa al sur (+y).

## 8. Laboratorio y runtime (`lab/`, `src/lab/`)

- `lab/blog.html` → `bootWorldPage(undefined, "blog")`: el mundo entero
  encuadrado en Blog (los barcos nacen en la bahía y rodean la punta, que son
  Portfolio). Las otras páginas no cambian de zonas. Tecla `4` encuadra el
  rectángulo *cover* 16:9 para inspeccionar el sangrado.
- `runtime.ts`: `bleedGround` se pinta antes que el agua; `shadowSlot` y
  `coreSlot` con `AlphaFilter`; las sombras de sólidos animados van ahí.
- `page.ts`: suma `factoryAnimator` y `seaAnimator` cuando la escena trae
  fábrica o mar.
- Presupuesto: primer dibujo < 150 ms (el terreno pasa de 8.400 a ≈ 19.000
  triángulos; medir en frío y en caliente); peor redibujo ≤ 6 ms.

## 9. Piso de calidad y verificación

| Métrica | Portfolio (astillero + fábrica) | Resume (ciudad + distrito) | Blog |
|---|---|---|---|
| Sólidos elevados | ≥ 400 | ≥ 450 | ≥ 250 |
| Materiales distintos | ≥ 12 | ≥ 10 | ≥ 8 |
| Animaciones | ≥ 4 (carro, río, chispas, humo) | ≥ 3 | ≥ 4 (mar, barcos, haz, boyas) |
| Hundido / elevado | dique seco / selva y lomas | derrumbe / distrito | pecio / punta |
| Altura máx. no esbelta | 18 (grúa 24) | 24 (torre 30) | 18 (faro ~30) |

- **Exclusión.** `dist/` sigue sin nada de `lab/`.
- **Visual.** Capturas de `world.html` (tecla 0 y tecla 4), `portfolio.html`,
  `resume.html` y `blog.html` a 1600×900 2x, publicadas como artifact al
  cerrar cada parte. Criterios: sin cielo dentro del rectángulo *cover*,
  sombras sin manchas, skyline con vidrio y piedra mezclados, patios verdes,
  humo saliendo de las tres chimeneas, barcos delante del faro.

## 10. Orden de implementación sugerido

1. Sombras (independiente; primer commit).
2. `WORLD`, sangrado, `worldZoneAt` por geografía, `abyss`; lab con tecla 4.
3. Fábrica y humo.
4. Grilla ampliada y distrito.
5. Punta, faro, boyas, pecio (estáticos).
6. `heading` en `hull`, barcos, mar animado, `seaAnimator`, `lab/blog.html`.
7. Presupuesto, capturas, docs (README, estados de las specs anteriores, memoria).

## 11. Fuera de alcance

- Reintegración al sitio: cámara *cover* y su comportamiento en móvil, hover
  y dim por zona, zoom a landmark, panel de contenido. Esta spec deja
  `coverFrame`, `worldZoneAt` y `LANDMARKS` listos para ella.
- Rotación general de sólidos (solo `hull.heading`), texturas, sonido.
