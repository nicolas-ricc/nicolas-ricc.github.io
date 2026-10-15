# Costura en y 90: Portfolio denso, barrio de galpones, dársena y feria — diseño

**Fecha:** 2026-10-15
**Estado:** aprobada en conversación (grilling); pendiente de plan
**Antecede:** `2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` (kit,
paleta de nueve tonos, zonificación, luces por ventana),
`2026-09-14-mundo-2-fabrica-distrito-blog-design.md` (fábrica),
`2026-09-15-margenes-urbanos-design.md` (sangrado, cinturón verde),
`2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md` §4.3 (feria).
**Depende de:** pasos 1–3 de Resume nivel 2 (motor y paleta, kit, `zoning.ts`).
Esta spec usa la escalera de nueve tonos, `dome`/`vault`/`hip`, el kit de
`src/kit/` y el catálogo por barrio; no los redefine.

## 1. Problema

1. **Proporción.** En el contenido al oeste de `x 344` (`y −60..336`, 396 u),
   Portfolio ocupa `y −60..146` (52 %) y Resume `y 146..336` (48 %). Se pide
   Resume ≈ 60–66 %, Portfolio ≈ 33–40 %.
2. **Densidad de Portfolio.** 401 sólidos elevados (astillero 298 + fábrica 103,
   seed 7) en 83 224 u²: **0.48 por 100 u²**, contra 1.16 de Resume. Hay
   vacíos grandes (playa de prefabricados, columna oeste, ribera este entre el
   río y los galpones de alistamiento) y casi todo es `concrete`/`steel`/`rust`
   con cinco tonos.
3. **Feria.** Ocho atracciones y ocho puestos idénticos (`booths`: mismo prisma
   4×3, tres materiales en rotación). Se pide más atracciones y puestos variados.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Medida del 60/40 | Franja del contenido al oeste de `x 344`, sin sangrado |
| Costura | `ZONE_SPLIT_Y = 90` (múltiplo de 6 y de 18). Resume 246 u = **62 %**, Portfolio 150 u = **38 %** |
| Mecanismo | Correr la costura; la grilla de Resume (filas `164..302`) no se mueve, se suman tres filas al norte |
| Punta del faro | Sigue siendo Portfolio (excepción geográfica de `worldZoneAt`, como hoy) |
| Estuario | Anclado en `y 146`: constante nueva `ESTUARY_Y0 = 146`, desacoplada de la costura. El río no se mueve |
| Borde | Corredor ferroviario E-O en `y 84..90`, del lado de Portfolio |
| Producción del astillero | Se muda comprimida a la columna oeste (`x −36..0, y 0..84`) y al hueco de la franja de la fábrica |
| Franja nueva de Resume (oeste del río) | **Barrio de galpones reconvertidos**, filas `92, 116, 140` sobre `WEST_COLS` |
| Hito del barrio | **Chimenea de ladrillo conservada** de la calderería vieja, en su lugar (`x 176, y 104`) |
| Ribera este nueva de Resume (`x 257..344, y 90..146`) | **Dársena reconvertida**: mercado de pescado y food hall en galpones `vault` |
| Sangrado oeste | El límite industrial/urbano se corre con la costura; el cinturón verde pasa a `y 66..90` |
| Densidad de Portfolio | ≈ **2×** la de hoy: 0.96 por 100 u² → ≈ 580 sólidos en 60 600 u² |
| Subzonas nuevas de Portfolio | Patio de contenedores; dique flotante y grúas de muelle |
| Feria | Suma tren fantasma, casa de espejos, tobogán gigante, tronco acuático, hilera de puestos variados (incluye food trucks) |
| Luces de Portfolio | Faroles cian, ventanas `windowCool` y chispas de soldadura animadas. El guard pasa de cantidades fijas a reglas |
| Materiales nuevos de Portfolio | Chapa ondulada (dos tonos) y contenedores (cinco colores) |

## 3. Geografía y costura

### Constantes (`src/map/geo.ts`, `city-grid.ts`)

- `ZONE_SPLIT_Y = 90`.
- `ESTUARY_Y0 = 146` nueva en `city-grid.ts`. `SEAM_CY`, `estuaryEast` y
  `estuaryReaches` pasan a usar `ESTUARY_Y0` en vez de `ZONE_SPLIT_Y`. Al
  norte de `y 146` la ribera este sigue siendo `eastBank(y)` y la oeste,
  `QUAY_X`.
- `terrain-classify.ts`: la elección `cityTerrainAt` / `shipyardTerrainAt`
  pasa a `y ≥ 90`. `cityTerrainAt` aprende la franja `y 90..146`: el canal es
  el del astillero (`QUAY_X..eastBank`) y no el estuario.
- `CITY_EDGE.north` pasa de 158 a **90**. El cinturón de selva de la costura
  (`y 147..158`, `city.ts:320`) desaparece; esa franja pasa a ser calle (§5).
- `shipyard.ts`: `AREA_H = 90`. `BOTTOM` no cambia (es el fondo del muelle
  dragado, no la costura).
- `frame.ts`: el encuadre de zona usa la costura, así que se corre solo.
  `LANDMARKS.portfolio` (grúa pórtico, `150, 50`) y `LANDMARKS.cv` (torre)
  no cambian.
- `worldZoneAt`: sin cambios de lógica; la punta (`y 97..134`) y su orilla
  siguen siendo Portfolio aunque queden al sur de la costura. Test: un punto
  en la punta es `portfolio` y uno en `x 300, y 120` (dársena) es `cv`.

### Corredor ferroviario (`src/scenes/corridor.ts`, Portfolio)

El borde de Lynch entre las dos zonas. Del lado de Portfolio para que la
primera fila de Resume (`y 92`) no lo pise.

- Dos vías E-O en `y 86` y `y 89` desde `WORLD.x0` hasta `x 196` (tope con
  paragolpes contra el muelle). Reemplazan las vías del oeste
  (`RAIL_Y = [131, 134]` pasa a `[86, 89]`); el hinterland las sigue
  prolongando hacia el oeste con el mismo `RAIL_Y`.
- Terraplén `ballast` de `y 84..90`, durmientes cada 2.
- Paso a nivel en la calle de transferencia (`x 100..108`): barreras, dos
  cruces de San Andrés y garita. La calle termina ahí; del lado de Resume
  sigue como la calle `x 96..102` de la grilla (§5).
- Cerco de malla del lado de Portfolio (`y 84`), postes cada 6, con dos
  portones: la calle de transferencia y la playa de vías.
- Tren de carga estacionado: locomotora + 6 vagones, posición por rng.
- Empalme con la playa de vías N-S (`RAIL_YARD_X`): las tres vías bajan hasta
  `y 80` y curvan al corredor (reemplaza el empalme de `y 128..134`).
- El ramal embebido en la calle (`SPUR_Y`) arranca en el corredor
  (`y 86`) en vez de en `y 131`.
- Faroles cian cada 24 sobre el cerco.

## 4. Portfolio (`y −60..90`): subzonas

Mismo método que Resume nivel 2: mapa de subzonas a mano en
`src/shipyard/zoning.ts`, catálogo de recetas con peso por subzona, piezas
singulares fijas, `tone` por rng (−1..+1) por pieza. Las recetas nuevas
industriales van a `src/kit/forms/industrial.ts` (§4.3).

### 4.1 Mapa

| # | Subzona | Rect (x, y) | Hoy | Después |
|---|---|---|---|---|
| P1 | **Fábrica** | `−60..205, −60..0` | planta, chimeneas, torre de enfriamiento, grúa torre, desvío, cinta, subestación, playa de camiones | igual + **nave de pintura** y **talleres** (de P6 vieja) en el hueco `x −36..18, y −60..−12`; estacionamiento de camiones con 8..12 camiones; segunda cinta |
| P2 | **Playa de vías** | `−60..−36, 0..84` | tres vías N-S, vagones, acopios de mineral, selva | vías y vagones; acopios fuera (van al hinterland); empalme al corredor en `y 80` |
| P3 | **Producción** (mudada) | `−36..0, 0..84` | acopios, nada | **calderería** girada 24×56 (`x −34..−10, y 8..64`, dientes de sierra con cara vertical al este), dos chimeneas `x −4, y 22 / 44`, granja de tres tanques `y 70..80`, torre de agua sobre patas `x −4, y 74`, rack de cañerías N-S en `x −8`, autoelevadores |
| P4 | **Patio de material** | `0..98, 0..30` | chapas, caños, bobinas, secciones, dos silos | igual + recetas de acopio por rng (§4.3) en los huecos; puente grúa de patio sobre `x 8..98` |
| P5 | **Dique seco** | `120..198, 0..32` | dique, casco, compuerta, casa de bombas | igual + andamios en el casco, dos grúas torre chicas a los lados, contenedores de obra |
| P6 | **Naves y gradas** | `0..198, 32..76` | dos naves, calle, dos gradas, grúa pórtico | igual + vagones del ramal, cajas y chatarra entre naves (`y 52..56`), ventanas `windowCool` en las naves |
| P7 | **Franja de servicio** | `0..198, 76..84` | talleres (y 80..94) | pañoles, contenedores de herramientas, autoelevadores, pilas de pallets, baños químicos: props ≤ 3 de alto, por catálogo |
| P8 | **Corredor** | `−60..198, 84..90` | — | §3 |
| P9 | **Dique flotante** | río, `x 204..246, y 74..88` | agua | **dique flotante** 42×14 con un casco a medio pintar (`hull` con banda `rust`), dos torres de servicio, pasarela al muelle oeste. No pisa la ruta de `ships.ts` (test) |
| P10 | **Patio de contenedores** | ribera este, `x eastBank+2..300, y 28..82` | escollera, vacío | pilas de 1..4 alturas en filas E-O de 6×2.4×2.6, pasillos de 4, un pórtico RTG sobre dos filas, dos straddle carriers, garita |
| P11 | **Muelle de alistamiento** | `300..330, 24..84` | dos galpones `x 304/316, y 24..116` | galpones recortados a `y 24..80`; **dos grúas de muelle** (level-luffing, h 18) sobre la ribera este en `y 34` y `y 62`; silo `x 310, y 76` |
| P12 | **Punta del faro** | `HEADLAND` | faro, galería, balizas | sin cambios |

La zona de producción vieja (`x 112..200, y 98..140`) **desaparece** de
Portfolio salvo la chimenea norte, que queda como hito de Resume (§5).

### 4.2 Densidad

| Medida | Hoy | Objetivo | Tope |
|---|---|---|---|
| Sólidos elevados de Portfolio (contenido) | 401 | ≈ 580 | 700 |
| Sólidos por 100 u² | 0.48 | ≈ 0.96 | 1.15 |

Regla de legibilidad: nada nuevo tapa en pantalla la grúa pórtico, el dique
seco ni las chimeneas de P1 y P3 (test de oclusión con la función de
`lights.ts`, §7 de Resume nivel 2). El relleno se limita a h ≤ 3 dentro de las
subzonas P4, P6 y P7.

### 4.3 Recetas industriales (`src/kit/forms/industrial.ts`)

| Receta | Descripción |
|---|---|
| **nave de dientes de sierra** | prisma + N `ramp` con cara vertical al este y banda `glass` en la cara vertical; reemplaza las copias de `factory.ts` y de la calderería |
| **nave de chapa** | prisma `sheetGreen` o `sheetTeal` + `gable`, fachada `ribs` (§6) |
| **pila de contenedores** | 1..4 alturas, color por rng con pesos, una puerta (`poly` `toneOffset −2`) en la cara visible |
| **acopio** | chapas apiladas con desfase, mazos de caños, bobinas o secciones de casco (lo de `materialYard` hoy, como catálogo) |
| **tanque** | cylinder + anillo + escalera; 1..3 por grupo |
| **grúa de muelle** | pórtico sobre rieles, cabina, pluma inclinada; `light` cian en la punta |
| **pórtico RTG** | cuatro patas con ruedas, viga, carro |
| **pañol** | prisma 4×3×2.6 `sheetGreen`/`steel` + puerta |

### 4.4 Luces

- Faroles cian como hoy, más los del corredor y de P10.
- Ventanas `windowCool` en las naves (P6), la calderería (P3), la planta
  (P1) y los galpones de alistamiento (P11): 30 % encendidas, con la misma
  oclusión por cajas de `lights.ts`.
- **Chispas de soldadura**: acento nuevo `spark` (`0xffb347`, no se
  oscurece). Solo en la capa animada `shipyard.sparks`: 1..3 chispas a la vez
  en `weldSpots` (los de hoy más el casco del dique flotante), `pulse` de
  `neon.ts` 80..200 ms. Nunca en la Graphics estática. Frame 0 sin chispas;
  `reducedMotion` sin ids.
- `portfolio-accents.test.ts` deja de fijar cantidades: exige colores
  estáticos ⊆ `{cyan, cyanMid, cyanBleed, windowCool}`, ≥ 30 faroles cian en
  astillero + fábrica + corredor, y `spark` solo en la capa animada.

## 5. Resume: franja nueva `y 90..146`

### 5.1 Grilla

- `ROWS` suma `92, 116, 140` al frente: `[92, 116, 140, 164, 188, …]`.
  Mismo `BLOCK_W 24 × BLOCK_D 18`, calles de 6. La calle `y 158..164`, que hoy
  es selva de costura, pasa a ser calle común.
- `WEST_COLS` sin cambios (`−48..162`, hasta `x 186`); la vereda del muelle
  (`x 186..192`) y `WEST_QUAY` siguen hacia el norte hasta `y 90`.
- `EAST_COLS` (`280, 310`) suma las filas `92, 116, 140` solo donde la
  manzana no pisa la punta (`HEADLAND` + `SHORE_W`): quedan `280×{92,116,140}`
  y `310×140`.
- `EAST_RING` y la calle del malecón siguen hacia el norte hasta `y 90`.
  `MALECON.y0` no cambia (158): al norte del malecón está la punta.

### 5.2 Barrio de galpones (zoning: `galpones`)

Manzanas: filas `92, 116, 140` × `WEST_COLS` (24 manzanas), menos la plaza de
la chimenea.

| Sub-barrio | Manzanas | Carácter | Catálogo (peso) | Estilo | Luces |
|---|---|---|---|---|---|
| **Lofts** | filas `92, 116` × cols `−48..72` | naves de diente de sierra convertidas en lofts y estudios | nave de lofts 35, loft en `vault` 20, nave de chapa con ventanales 20, patio de servicio con tanque 15, nave abandonada 10 | `brick`/`concrete`/`sheetGreen`, `tone` −1..+1 | 55 % encendidas, 75 % cálidas |
| **Cervecerías** | filas `116, 140` × cols `102..162`, menos la plaza | cervecerías y mercado de diseño frente al agua; sigue al barrio de bares de la fila 164 | cervecería 35, mercado de diseño `vault` 25, patio de food trucks 20, galería 20 | `brick`/`plaster`/`copper` | 70 % encendidas, 90 % cálidas; neones (abajo) |
| **Obrero** | fila `140` × cols `−48..72` | casas obreras de ladrillo y talleres de artistas; transición al residencial de patios | casas en hilera de ladrillo 40, taller con patio 30, patio residencial 30 | `brick`/`plaster`/`terracotta` | 55 % encendidas, 95 % cálidas |
| **Plaza de la chimenea** | `162, 92` + fila `92` × cols `102, 132` | nodo del barrio | fijo | `brick`/`paving` | fachadas bañadas |

Recetas nuevas en `src/kit/forms/industrial.ts` (reconversión):

| Receta | Descripción |
|---|---|
| **nave de lofts** | nave de diente de sierra; la banda `glass` de los dientes lleva ventanas publicadas; planta baja con puertas grandes vidriadas; terraza verde en un tercio del techo |
| **loft en vault** | `vault` de 18 de largo + hastial vidriado hacia la calle `open` + entrepiso visible |
| **cervecería** | nave a dos aguas + tres a cinco tanques de fermentación `copper` visibles detrás de un ventanal + terraza con mesas y guirnalda; publica `slots` de neón en el frente `open` |
| **mercado de diseño** | `vault` 24×14 + toldos laterales + puestos adentro visibles por el hastial |
| **patio de food trucks** | 4..6 food trucks (prisma 5×2.2×2.6 de color por rng + toldo + ventanilla encendida), mesas, guirnalda en zigzag |
| **nave abandonada** | nave de diente de sierra con dientes faltantes (vigas a la vista) y `jungle` adentro |

**Plaza de la chimenea** (fija): la chimenea de ladrillo `x 176, y 104`
(r 2.2, h 25 + base) queda donde estaba, pasa de `rust` a `brick` con banda
`copper` y lleva un **cartel de neón vertical** (amber, 6 de alto) en la cara
oeste. Alrededor: baldosas `paving`, bancos, árboles de calle, un kiosco, dos
tanques viejos pintados como esculturas. La manzana `162, 92` es la plaza; las
`102, 92` y `132, 92` son el **mercado cubierto de los galpones** (la
calderería vieja reconvertida: nave de diente de sierra 54×18 que une las dos
manzanas, como `PLAZA` en la avenida).

**Neones**: la regla de Resume nivel 2 §4 ("neones a nivel de calle solo en el
barrio de bares") se amplía al sub-barrio **cervecerías**, solo en frentes
`open` hacia la plaza de la chimenea o la calle del muelle. Tope 10 en el
sub-barrio (sumado al tope de 24 del barrio de bares). Colores con los mismos
pesos.

### 5.3 Dársena reconvertida (zoning: `darsena`)

Ribera este `x 257..330, y 90..146`, entre el río y la punta.

- **Dársena**: un entrante de agua `x 278..302, y 96..112`, abierto al río
  por la calle `EAST_RING` con un puente levadizo chico de `steel`.
  `terrain-classify` lo marca `water`; los barcos no entran (no es ruta).
- `280, 116`: **mercado de pescado**, `vault` 24×18 con hastiales vidriados y
  toldo hacia la dársena, cajones y balanzas en la vereda.
- `280, 140` y `310, 140`: **food hall**, dos galpones `vault` gemelos unidos
  por un patio techado con guirnaldas.
- Muelle de la dársena: tres botes de pesca (`hull` chico) amarrados, bolardos,
  redes (prismas bajos `rust`), una grúa de muelle vieja chica.
- Estilo `brick`/`sheetTeal`/`copper`. Luces 60 % encendidas, 85 % cálidas;
  sin neones a nivel de calle; guirnaldas en el food hall.
- Se conecta con el mercado de la ribera este (`280, 188`) por la calle
  `EAST_RING`, que sigue hasta `y 90`.

### 5.4 Presupuesto de Resume

| Métrica | Tope de Resume nivel 2 | Tope nuevo |
|---|---|---|
| Sólidos elevados de Resume (contenido) | 2 200 | 2 900 |
| Acentos estáticos de Resume | 900 | 1 150 |
| `strip` de Resume | 150 | 190 |

## 6. Paleta: materiales nuevos

Valores de **base** (`palette-base.ts`, sin oscurecer); cinco tonos con la
regla "ciudad y costa", los cuatro nuevos con la regla de Resume nivel 2 §4,
`npm run palette` los oscurece ×0.7. Test de luminancia monótona por material.

| Material | `top` objetivo (base) | Uso |
|---|---|---|
| `sheetGreen` | verde gris `0x6a7a6e` | chapa ondulada de galpones y pañoles |
| `sheetTeal` | azul petróleo `0x4a6a76` | chapa ondulada de galpones del alistamiento y la dársena |
| `boxRust` | rojo óxido `0x8a4a32` | contenedores |
| `boxBlue` | azul `0x3e5c80` | contenedores |
| `boxGreen` | verde `0x4e6e4a` | contenedores |
| `boxGrey` | gris `0x707070` | contenedores |
| `boxOrange` | naranja `0xb0703a` | contenedores |

Pesos de color de contenedor: `boxRust 30, boxBlue 25, boxGrey 20, boxGreen
15, boxOrange 10`.

**Fachada `ribs`** (nueva, `src/iso/facade.ts`): sobre paredes de chapa,
franjas verticales de 0.5 de ancho cada 1.0 que alternan `toneOffset 0` y
`−1`; en la cara que da al sol, `+1` y `0`. Simula la onda sin geometría.
Tope: solo paredes ≥ 6 de largo, máximo 24 franjas por pared.

Acento nuevo: `spark` `0xffb347` (§4.4). `palette-guard`: `spark` no aparece
en ninguna Graphics estática.

## 7. Sangrado

- `builtAt`: `y < ZONE_SPLIT_Y` (90) es industrial, el resto urbano; la regla
  ya depende de la constante.
- `GREEN_BELT` pasa de `y 110..158` a **`y 66..90`**: separa el hinterland del
  distrito tecnológico a la altura del corredor.
- Hinterland: todo lo que quede en `y ≥ 66` se descarta (hoy ahí solo hay
  selva y las vías del oeste, que se corren a `y 86/89` y siguen atravesando
  el cinturón). `hinterland.ts:155` (selva de la mitad de Portfolio del
  cinturón) pasa a `y 68..80`. Los acopios de mineral de P2 se mudan junto a
  las vías del oeste del hinterland, `x −120..−70, y 20..60`.
- Distrito tecnológico: `suburbBlocks` recorre las filas nuevas
  (`92, 116, 140`) sobre `SUBURB_COLS`; el catálogo sigue siendo el de hoy
  (torres cerca del contenido, campus después). `tech.ts:187` (selva del
  cinturón) pasa a `y 90..` hasta la primera fila.
- Tope de sólidos del distrito tecnológico: de 1 186 a 1 500.

## 8. Feria (`fair.ts`)

`FAIR = { x0: 84, y0: −312, y1: −168 }` no cambia. Las posiciones de abajo
son de partida; el plan las valida en `lab/world.html` con el test
existente de "nada estático delante de la rueda" y uno nuevo de "ninguna
huella nueva pisa una existente".

| Pieza | Posición (centro) | Descripción |
|---|---|---|
| **Tren fantasma** | `x 108, y −252` (20×12) | fachada `stone` con torre gótica (`cone` 4 lados), calavera en el frontón (poly), marquesina con cartel de neón magenta y entrada/salida con puertas batientes; vía que entra y sale por la fachada |
| **Casa de espejos** | `x 132, y −252` (16×12) | fachada `whitewash` con columnas `arcade`, frontón con espejos (poly `glass` `toneOffset +2`), cartel cian, guirnalda de `dot` |
| **Tobogán gigante** | `x 118, y −292` | torre `deck` de 14 de alto con techo `cone`, rampa helicoidal de 3 vueltas (`rotBox` por tramo, como la montaña rusa), escalera exterior |
| **Tronco acuático** | canal desde `x 160, y −296` hasta la bahía | canal `deck` elevado con agua (`shallow`) adentro, subida con cadena, caída a la bahía con salpicadura (`dot` blanco), dos troncos (`hull` `deck`); los troncos se mueven en la capa animada `fair.logs` |
| **Hilera de puestos** | reemplaza `booths` (`y −294..−210`, contra el paseo) | catálogo con pesos: comida con toldo rayado 30, **food truck** 20, tiro al blanco con premios colgados 15, algodón de azúcar 10, adivina (carpa `cone`) 10, boletería 10, juego de aros 5. Toldo y tono por rng; 12..16 puestos; no repite tipo en dos vecinos |
| **Patio de food trucks** | `x 100..160, y −176..−170` (entrada, del lado de adentro de la portada) | 5 food trucks con ventanilla encendida, mesas y guirnalda |

Neones nuevos: marquesinas del tren fantasma (magenta, `flip`) y de la casa de
espejos (cyan, `chase`), con `neon.ts`. La feria sigue siendo la única
excepción de tres colores; no entra en el guard de Portfolio.

Tope de sólidos de la feria: de 278 a 520.

## 9. Tests

- `geo.test`: `ZONE_SPLIT_Y = 90`; `worldZoneAt` en la punta es `portfolio`,
  en `x 300, y 120` es `cv`, en `x 100, y 80` es `portfolio`, en `x 100, y 95`
  es `cv`.
- `city-grid.test`: `estuaryEast(146)` igual a hoy (el río no se movió);
  `ROWS` empieza en 92; ninguna manzana de `EAST_COLS` pisa la punta.
- `terrain.test`: la franja `y 90..146` al oeste del río es ciudad; el canal
  `QUAY_X..eastBank` sigue siendo agua; la dársena es agua; los vértices de la
  costura comparten grilla (múltiplos de 6 y 18).
- `shipyard/zoning.test`: toda pieza de Portfolio cae en una subzona; las fijas
  donde dice §4.1; nada de Portfolio en `y ≥ 90` salvo la punta y P9 (el
  dique flotante termina en `y 88`); sólidos 520..700; nada tapa la grúa
  pórtico, el dique seco ni las chimeneas.
- `ships.test` (suma): la ruta de los barcos no cruza el dique flotante ni la
  dársena.
- `portfolio-accents.test`: reglas de §4.4 en lugar de cantidades.
- `kit.test` (suma): las recetas industriales y de reconversión cumplen las
  reglas del kit (dentro del lote, determinismo, ventanas solo en paredes que
  miran a la cámara).
- `zoning.test` (Resume, suma): las 24 manzanas nuevas tienen barrio; la
  plaza de la chimenea y el mercado de los galpones son fijos; neones de
  cervecerías ≤ 10 y solo en lados `open`.
- `fair.test` (suma): las piezas nuevas existen; ninguna huella nueva pisa
  otra; nada estático delante de la rueda; puestos 12..16 sin tipo repetido en
  vecinos.
- `hinterland.test` / `tech.test`: nada industrial en `y ≥ 66` del sangrado;
  manzanas del distrito tecnológico en las filas nuevas.
- `palette-iso.test`: los materiales nuevos con nueve tonos y luminancia
  monótona; `spark` presente.

### Presupuesto global

| Métrica | Tope de Resume nivel 2 | Tope nuevo |
|---|---|---|
| Polígonos estáticos del mundo | 46 000 | 56 000 |
| Primer dibujo caliente, lab `world.html` (mediana de 10) | 230 ms | 260 ms |
| Primer dibujo caliente, sitio `/` (mediana de 5) | 270 ms | 300 ms |
| Peor redibujo en 5 s, lab | 22 ms | 22 ms |
| Bloom: promedio tick + render en 60 frames | ≤ 15 ms | ≤ 15 ms |

Si se pasa: recortar primero `ribs` (franjas cada 1.5), después las pilas de
contenedores a 3 alturas, después el relleno de P7; nunca las subzonas.

## 10. Orden de implementación

Después de los pasos 1–3 de Resume nivel 2. Cada paso deja `npm test` y
`npm run typecheck` verdes.

1. **Costura y geografía** (§3, §7): `ZONE_SPLIT_Y = 90`, `ESTUARY_Y0`,
   terreno, corredor ferroviario, sangrado (cinturón, hinterland, tecnológico).
   La franja nueva de Resume queda como asfalto vacío.
2. **Portfolio** (§4, §6): materiales y `ribs`, recetas industriales,
   `shipyard/zoning.ts`, mudanza de la producción, contenedores, dique
   flotante, grúas, luces y chispas, guard nuevo.
3. **Barrio de galpones y dársena** (§5): recetas de reconversión, filas
   nuevas en `zoning.ts`, plaza de la chimenea, mercado de los galpones,
   dársena.
4. **Feria** (§8).
5. **Cierre**: presupuesto, capturas de `lab/portfolio.html`,
   `lab/resume.html` y `lab/world.html` a 1600×900, estado de esta spec.

## 11. Fuera de alcance

- Blog y el mar; la punta del faro.
- Rotar luz o cámara, texturas, shaders, sonido.
- Mover el río o el estuario.
