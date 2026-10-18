# Mundo isométrico: Resume, Blog y unión de las tres zonas — diseño

**Fecha:** 2026-09-14
**Estado:** partes 1 y 2 implementadas; Blog implementado en
`2026-09-14-mundo-2-fabrica-distrito-blog-design.md`
**Antecede:** `2026-09-13-portfolio-isometrico-design.md` (astillero en el laboratorio)
y `2026-09-09-mapa-rpg-sitio-personal-design.md` (plan urbano original de las tres zonas)

## 1. Objetivo

Llevar las otras dos zonas del mapa al mismo estilo 2.5D isométrico low-poly
del astillero, con el astillero como **piso de calidad**, y unir las tres en
una sola escena de mundo coherente. Se sigue trabajando en el laboratorio; la
reintegración al sitio (hover, cámara, panel) queda para una spec aparte.

Historia que cuenta el mundo, de izquierda a derecha: en el astillero se
fabrican barcos (Portfolio), al sur está la ciudad de oficinas tragada por la
selva (Resume), y al este el mar abierto con el faro en la punta y los barcos
recién botados alejándose (Blog).

### Piso de calidad (medido sobre el astillero, seed 7)

| Métrica | Astillero | Mínimo por zona nueva |
|---|---|---|
| Sólidos elevados | 302 | ≥ 250 (Blog compensa con roca y estelas) |
| Franjas de suelo | 27 | — |
| Polígonos al boot | ~4.100 | — |
| Materiales distintos | 12 | ≥ 8 |
| Animaciones | 3 | ≥ 2 |
| Elemento hundido / terreno elevado | dique seco / selva con jitter | uno de cada uno |
| Altura máxima | 25 | 18 salvo el landmark |

Criterios de éxito:

- `lab/world.html` muestra las tres zonas sin grietas en las costuras, con un
  solo sol, un solo cielo y un acento de luz por zona (cian, ámbar, magenta).
- Cada zona se distingue por color **y** por geometría: astillero horizontal y
  largo, ciudad vertical en grilla, mar plano y abierto.
- Ningún material de construcción o suelo se comparte entre zonas; solo
  naturaleza y barcos.
- El motor sigue sin Pixi y cubierto por tests; ningún color fuera del atlas.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Fachadas | Procedurales, como caras extra emitidas por el motor (enfoque A). Descartadas texturas en `Mesh` (rompe motor puro y guard de colores) y ventanas solo como acentos (cajas lisas, bajo el piso) |
| Resume | Ciudad de oficinas en grilla, tragada por la selva, con la torre del piso encendido como landmark. Su borde este es costa: malecón y una manzana derrumbada |
| Blog | Casi todo agua. La única tierra es la punta que sale del muelle de alistamiento del astillero y termina en el faro. Barcos hechos con las mismas piezas del astillero se alejan hacia el este. Sin descampado, sin autopista, sin carteles caídos |
| Materiales | Set exclusivo por zona. Compartidos a propósito: `leaf`, `leafDark`, `rock`, `water` (naturaleza) y `hull`, `steel`, `rust` en vehículos y barcos |
| Sombras | Tope `SHADOW_MAX_H = 18`: nada proyecta como si midiera más de 18. Evita que una torre de 30 tape tres manzanas |
| Mundo | Un solo sistema de coordenadas de 560×270, una sola malla de terreno, seed por zona |
| Alturas | Solo los tres landmarks superan 18 (torre 30, faro ~29, grúa 24 ya existente) |

## 3. Motor (`src/iso/`)

Todo puro, sin Pixi.

- **Fachadas.** `prism` acepta `facade?: Facade` con
  `{ floors, cols, floorH?, sill?, litFloor?, base?: "glass" | "portico" }`.
  Al teselar una pared vertical visible, después de la cara de pared se
  emiten: una banda de losa por piso (material del edificio, tono un paso más
  oscuro, 0.3 u de alto) y las ventanas en grilla (`glass`, tono por la misma
  normal). Las ventanas del piso `litFloor` se emiten además como acentos que
  la escena recoge. Cornisa y planta baja son prismas que agrega la escena.
- **Prisma de huella libre.** `{ kind: "poly"; footprint: Vec2[]; z; h; mat }`.
  `extrude` ya lo hace; solo se expone. Para roca, la punta del faro y la
  escollera. `bounds` funciona igual (AABB).
- **Rampa N/S.** `dir: "n" | "s"` además de `"e" | "w"`.
- **Acentos.** `Accent` se muda de la escena al motor y se vuelve unión:
  `{ kind: "dot"; at; r; color }` o `{ kind: "poly"; pts: Vec3[]; color; alpha? }`.
  Los polígonos de acento se proyectan como las caras.
- **Colores.** `ISO_COLORS` suma `amber`, `amberMid`, `amberBleed`,
  `magenta`, `magentaMid`, `magentaBleed`. `AccentColor` se amplía.
- **Materiales nuevos** en `ISO_TONES`, cinco tonos literales cada uno:
  `office` (hormigón gris violeta, frío), `officeDark`, `glass`, `asphalt`,
  `paving`, `plaza`, `whitewash`, `foam`. `waterDeep` ya existe.
- **Sombras.** `shadowPoint` usa `min(z, SHADOW_MAX_H)`.
- **Render list.** `Layer` suma `"accent"`; el runtime la dibuja con
  `blendMode: "add"`. `sortByDepth` no cambia.

Fuera de alcance: rotación de sólidos, texturas, cilindro cónico (el faro se
apila).

Ruling: `ramp.dir` es hacia dónde baja la rampa (convención existente):
`dir: "n"` tiene el borde alto al sur.

## 4. Mundo y terreno compartido

- **Coordenadas.** `WORLD_W = 560`, `WORLD_H = 270`, unidades del mapa viejo.
  Portfolio x 0..344, y 0..146 (como hoy). Resume x 0..344, y 146..270.
  Blog x 344..560, y 0..270. `geo.ts` conserva `riverCenter` y `splitX` y
  suma dos formas: `HEADLAND`, la punta que nace en el muelle de alistamiento
  (x 330..344, y 100..130) y llega hasta x≈400, y≈118, con el faro en la
  punta; y `MOUTH`, la desembocadura: en el mapa viejo el río corría de norte
  a sur sin tocar el mar, así que ahora dobla al este en su tramo norte
  (y < 24) y desemboca en una bahía en la esquina NE del astillero. Es la
  única salida de los barcos al mar. Toca al astillero: el tanque en
  (310, 10) y la selva del borde norte-este se mueven al sur de la bahía.
- **Un clasificador, una malla.** `src/scenes/terrain.ts` exporta
  `terrainAt(x, y): Terrain`, que despacha por `zoneAt` a
  `shipyardTerrainAt`, `cityTerrainAt`, `seaTerrainAt`. `buildTerrain(rng)`
  genera una sola grilla de `CELL = 6` (94×45 celdas, ~8.500 triángulos) con
  jitter por tipo; los vértices en las costuras se comparten, sin grietas.
  El `buildTerrain` de `shipyard.ts` se muda acá; `shipyard()` deja de
  generar terreno.
- **Tipos de terreno.** Los actuales más `asphalt`, `plaza`, `sea`
  (`waterDeep`, z = -1), `shore` (`water`, a menos de 12 u de tierra),
  `headland` (roca, z 4..8, jitter fuerte, cae al mar en una celda), `reef`
  (roca a z 0.5 alrededor de la punta). Río y mar salen como dos `ground`
  distintos para animarse por separado.
- **Costuras.** Portfolio/Resume: cinturón de selva de 12 u a cada lado de
  y = 146. Resume/Blog: malecón de `paving` a z 1.5 con parapeto sobre el río;
  del otro lado, mar. Portfolio/Blog: la escollera del muelle de alistamiento
  continúa como base de la punta.
- **Escena del mundo.** `src/scenes/world.ts` exporta `world(seed): WorldScene`
  con `terrain`, `water: { river, sea }`, `solids`, `accents`, `landmarks`
  (coordenadas de mundo, para que la reintegración proyecte con `project()`) y
  los sólidos animados con nombre. Cada escena recibe `createRng(seed ^ hash(zoneId))`.

#### Rulings de la parte 1

- **Río en Resume:** `cityTerrainAt` no usa un río angosto en
  `riverCenter ± RIVER_HALF`: hereda el ancho del canal del astillero en la
  costura y = 146 (x 198..eastBank≈241) y se abre hacia el sur
  (`ESTUARY_FLARE`). Motivo: continuidad del agua en la costura. `estuaryEast`
  vive ahora en `src/scenes/city-grid.ts` (se mudó de `terrain.ts` en el
  plan 2, junto con el resto de la grilla de la ciudad).
- **Orden de capas:** el agua se dibuja **debajo** del suelo (no "entre el
  suelo y las sombras" como dice §7): con la cámara al SE el suelo alto
  proyecta sobre el agua que tiene al norte y el agua (z = -1) nunca puede
  estar delante de un suelo. Si no, el mar tapaba la punta.
- **Orilla frente a la bahía:** la franja `shore` continúa frente a la
  desembocadura (bajío) y su borde exterior ondula (`shoreWidth(y)`), para
  que la costa recta del límite de zona no se lea como una raya.
- **Altura de la punta:** la punta nace a z ≈ 1 junto al muelle de
  alistamiento y sube hasta z ≈ 7 desde x ≈ 355 (`headlandZ(x)` en
  `terrain.ts`); así ningún suelo alto queda pegado a los galpones (el suelo
  no se ordena en profundidad con los sólidos).
- **Suelo y sólidos no se ordenan en profundidad entre sí:** el terreno se
  pinta entero antes que los sólidos (y el agua antes que el terreno). Por
  eso nada alto del terreno puede quedar pegado a un sólido, y por eso la
  punta nace baja. Si una escena futura necesita edificios junto a suelo
  alto, hay que ordenar suelo y sólidos en una sola lista de profundidad.

## 5. Resume: ciudad de oficinas (`src/scenes/city.ts`, `city-anim.ts`)

Bajado a detalle e implementado en `2026-09-14-resume-ciudad-design.md`; ese
documento manda donde difiera de esta sección.

- **Grilla.** Manzanas de 30×24, calles de 6 (`asphalt` a z -0.4), veredas de
  1.5 u a z 0.3 en `paving`, cordón como escalón. Avenida principal E-O de
  10 u a la altura del landmark con boulevard central de selva. Carriles como
  `strip` discontinuas de 0.4 en `paving`; sendas peatonales en las esquinas
  de la avenida. Tres o cuatro cráteres de selva que rompen el asfalto
  (`ground` de `leafDark` con `toneOffset` y conos encima).
- **Manzanas.** Cuatro tipos por `rng` con pesos: torre única (12..18,
  `office`, fachada 4..6 pisos), dos edificios medianos (7..10), edificio bajo
  con techo `step` y patio, manzana devorada por la selva (20 %). Toda
  manzana construida lleva cornisa (prisma fino saliente), planta baja con
  vidriera o pórtico, losas entre pisos, y un detalle de techo: tanque de
  agua, sala de máquinas, antena o selva en la terraza.
- **Landmark.** Torre de 30 en `officeDark` sobre plaza (`plaza` con
  baldosas rotas por `toneOffset`), fachada 8 pisos × 4 columnas, un solo
  piso encendido en `amber`, sala de máquinas y antena con luz `amberMid`.
  Selva trepando: conos en la base y prismas finos de `leaf` sobre dos aristas.
- **Selva.** En manzanas devoradas, boulevard y cinturón de costura. Nunca
  sobre calles.
- **Costa este.** Malecón con parapeto de 0.8 y escalera al agua; una manzana
  derrumbada: `ramp` hacia el río y bloques de `officeDark` a z -0.5 asomando.
- **Autos y postes.** Autos 3×1.5×1.2 en cordón, `steel`/`rust`; semáforos
  apagados; faroles ámbar solo en la avenida.
- **Animaciones.** Parpadeo del piso encendido (un frame apagado cada 4..9 s,
  nunca dos seguidos). Papeles: 5..8 puntos `amberMid` que salen de una
  ventana del piso encendido, derivan al ENE con seno y se reciclan a 30 u.
  Luz de antena: pulso lento de radio 0.8..1.4.

## 6. Blog: mar, faro y barcos que se van (`src/scenes/sea.ts`, `sea-anim.ts`)

- **Punta.** `poly` de roca sobre las celdas `headland`, dos o tres
  afloramientos (`poly` a z 6..9), `reef` de conos chatos de `rock`. Sendero
  de `rock` desde la escollera hasta el faro (ruling de la spec de Resume:
  `paving` es exclusivo de la ciudad). Casa del farero: prisma
  `whitewash` con `gable` y ventana `magentaBleed`.
- **Faro.** Seis cilindros apilados (r 3.2 → 2.2, h 4) alternando `whitewash`
  y `rust`: 24 u. Galería: cilindro r 3, h 0.6 en `steel` con 8 postes.
  Linterna: cilindro `glass` r 1.6, h 3, cono `steel` encima. ~29 u en total.
- **Barcos.** Cuatro, con las piezas del astillero: carguero (`hull` 60×10×5,
  superestructura en popa, chimenea, grúa de cubierta), remolcador (`hull`
  18×6×3 con caseta), barcaza (`hull` 40×9×2 con contenedores `rust`/`steel`),
  y un pecio fijo a z -3 junto al arrecife. Los que navegan llevan luz de
  mástil `magentaMid` y luces de posición.
- **Rutas.** *Desvío: reemplazado por los carriles semirrectos de #87
  (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63,
  con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Nacen en la desembocadura (`MOUTH`, esquina NE del astillero),
  rodean la punta por el este, siempre con x mayor que el extremo de la roca
  mientras |y - 118| < 40, y siguen al sudeste hasta el borde este del mundo.
  Al rodear la punta por el este quedan delante del faro en profundidad:
  nunca pasan detrás de él ni de la roca. Velocidades 1.2 / 2 / 0.8 u/s,
  fases distintas. En los últimos 30 u antes del borde el barco, su sombra y
  su estela bajan el alpha a 0 (bruma de distancia); al cruzar el borde se
  reciclan en la desembocadura con alpha subiendo de 0 a 1 en 30 u. Nada se
  dibuja fuera de la malla de mar, así el diorama conserva sus bordes.
  `Graphics` propias por barco para casco y sombra.
- **Estelas.** 3..5 triángulos `up` de `waterDeep` detrás de cada barco, en la
  capa de mar, en V, desvanecidos a 25 u. Se regeneran con el barco.
- **Mar.** `waterDeep` mar adentro, `water` en `shore`. Onda diagonal de tono
  como el río, fase 4 s y amplitud mayor. Espuma: banda de `foam` de 1 u en
  los triángulos junto al arrecife, `toneOffset` alternando cada 500 ms. Dos
  boyas con luz `magentaMid`.
- **Haz.** Acento `poly`: cuña de 24 u y 14° de apertura a la altura de la
  linterna, 360° cada 8 s, con una cuña interior más corta en `magenta`.
  Con `reduced-motion`, fija apuntando al mar.

## 7. Laboratorio y runtime (`lab/`, `src/lab/`)

- **Páginas.** `lab/resume.html`, `lab/blog.html` y `lab/world.html`, misma
  estructura que `portfolio.html`. Las de sección renderizan su zona con su
  tramo de terreno y costuras; la del mundo valida costuras, sombras cruzadas
  y encuadre. Todas fuera del build: el test de exclusión cubre `lab/*`.
- **Runtime común.** `src/lab/portfolio.ts` se generaliza en
  `src/lab/runtime.ts`: recibe una `WorldScene` (o filtro por zona) y una
  lista de `Animator`, y arma las capas. Cada página es un entry corto que
  elige seed y filtro.
- **Capas.** `ground`, `river`, `sea` (animadas por separado), `shadow` y
  `solid` estáticos, un par `shadow`/`solid` por sólido animado (carro, cada
  barco), `accent` estático y una `Graphics` por acento animado (chispas,
  lámpara, papeles, haz, parpadeos). Regla: ningún sólido estático queda
  delante de uno animado; un test lo verifica con `isBehind` sobre las rutas.
- **Animator.** Interfaz única `{ tick(dtMs): Set<string>; draw(id): void }`
  para las tres escenas, en lugar del `AnimChanges` de campos fijos. Cada
  animación se registra con id y `Graphics`; el loop redibuja solo los ids
  devueltos.
- **Encuadre.** `fitTransform` sobre la geometría estática del mundo; las
  rutas de los barcos no la extienden porque terminan en el borde de la
  malla. En `world.html`, teclas `1`, `2`, `3`, `0` encuadran cada zona o el
  mundo.
- **Presupuesto.** Primer dibujo < 150 ms en desktop; redibujos animados
  < 3 ms por frame. Medido con `performance.now()` e impreso en consola en dev.

## 8. Tests y verificación

- **Motor.** `solids.test`: prisma con fachada 3 × 2 emite por pared visible
  3 losas y 6 ventanas después de la pared; `poly` de 5 vértices emite techo +
  5 lados y descarta ocultos; `ramp` `dir: "n"` tiene el borde alto al norte.
  `light.test`: la sombra de un prisma de 30 mide como una de 18.
  `render-list.test`: `accent` va después de `solid`; ningún color fuera del
  atlas, tríadas nuevas incluidas. `palette-iso.test`: cinco tonos por
  material nuevo y escalera `shade < lit < down < top < up` en luminancia.
- **Terreno.** Determinista; una sola clase por celda; los vértices sobre
  y = 146 y sobre `splitX` reciben la misma altura vengan de la zona que
  vengan; `headland` a z ≥ 4 y `sea` a z = -1.
- **Escenas.** Patrón de `shipyard.test`: determinismo; conteos mínimos
  (manzanas ≥ 30, edificios con fachada ≥ 25, barcos = 4, cilindros del faro
  = 6); nada apoyado fuera de su zona salvo selva; ningún edificio pisa una
  calle; ningún sólido de ciudad usa materiales del astillero salvo
  `steel`/`rust` en vehículos; nada supera 18 salvo los tres landmarks.
- **Animación.** Rutas enteramente sobre `sea`/`shore`/`MOUTH`, ningún punto
  detrás de un sólido estático que se le superponga en pantalla (`isBehind` +
  `screenBounds`), alpha 0 exactamente en el borde, cada barco vuelve a su
  posición tras un ciclo. Haz: 8 s
  por vuelta, fijo con `reduced-motion`. Papeles a ≤ 30 u de la ventana.
  Parpadeo: nunca dos frames apagados seguidos.
- **Exclusión.** `dist/` no contiene nada de `lab/`.
- **Visual.** Al cerrar cada escena, captura de su lab y del mundo a 1600×900
  publicada como artifact. Criterio de cierre: la tabla del piso.

## 9. Orden de implementación sugerido

1. Motor: fachadas, `poly`, rampa N/S, acentos, colores, materiales, tope de sombra.
2. Terreno compartido y `world.ts`; `shipyard()` deja de generar terreno y recibe la desembocadura al NE; lab del mundo con solo el astillero.
3. Resume (comparte selva y borde con el astillero).
4. Blog.
5. Runtime común, páginas de lab, presupuesto, capturas.

## 10. Fuera de alcance

- Reintegración al sitio: hover/dim por zona, cámara sobre landmarks, cartel
  de bienvenida, panel de contenido. Spec aparte.
- Rotar luz o cámara en runtime; sprites o texturas; sonido.
