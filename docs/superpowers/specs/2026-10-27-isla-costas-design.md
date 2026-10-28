# Isla: costas naturales en las puntas norte y sur

**Fecha:** 2026-10-27
**Estado:** aprobado, listo para agente
**Alcance:** reemplazar los bordes rectos de la "isla" entre el río/estuario
y el mar por costas irregulares de aspecto natural, con más polígonos, sin
mover lo construido. Ítems 1 y 2 de la captura anotada
(`assets/2026-10-27-anotaciones/mapa-anotado.jpg`, recortes `isla-1.jpg` e
`isla-2.jpg`).

## 1. Qué es "la isla" en el código

No hay un polígono de isla. La franja de tierra entre el río/estuario (oeste)
y el mar (este) es lo que queda entre varios cortes del clasificador,
casi todos rectos:

| Borde | Hoy | Dónde |
|---|---|---|
| **Punta norte** (ítem 2) | recta `y = 24` (`MOUTH_Y`), x ≈ 279..344 | `inMouth`, `src/map/geo.ts:87-91`; usado en `shipyardTerrainAt`, `src/scenes/terrain-classify.ts:26` |
| **Costa este, mitad norte** | recta `x = 344` de y 24 a 158 | despacho `x ≥ ZONE_SPLIT_X` en `terrainAt` (`terrain-classify.ts:57-60`) |
| Costa oeste, mitad norte | ya curva (`eastBank(y)`, suma de senos) | `geo.ts:7-9, 143` — **no se toca** |
| **Costa oeste, mitad sur** | diagonal recta `estuaryEast(y) = 241 + 0.35·max(0, y−146)` | `src/scenes/city-grid.ts:47-49` |
| **Punta sur** (ítem 1) | en el sangrado: entre `estuaryEast(y)` y `spitEast(y)`, que se afina linealmente hasta y ≈ 363, en celdas de **18 u** (los cuadrados blancos y verdes grandes de la captura) | `spitEast`/`estuaryWater`, `src/scenes/sprawl-grid.ts:46-49`; `bleedTerrainAt` |
| Malecón (costa este, mitad sur) | muro `paving` x 334..344, y 158..326 | `MALECON`, `city-grid.ts:31` — **queda recto**: es un muro construido |
| Punta del faro | polígono `HEADLAND` | `geo.ts:94-96` — **no se toca** |

La malla del terreno clasifica cada celda por su centro: 6 u dentro de
`WORLD` (`buildTerrain`, `src/scenes/terrain.ts:193-224`) y 18 u en el
sangrado (`buildBleed`, `:151-186`). La costa dibujada es siempre una
escalera de bordes de celda; la espuma (`FOAM_W = 9`) y las bandas de
profundidad (`depthAt`, `src/scenes/depth-map.ts`) siguen solas a la máscara
de tierra.

## 2. Objetivo y criterio de éxito

Que ningún tramo de la costa de la isla, salvo el malecón y los muelles
construidos, se lea como una raya: puntas, caletas, entrantes y salientes
de escala variada, como una costa de río o de delta.

Éxito medible (test nuevo, §6): recorriendo el borde tierra/agua de la isla
celda a celda, **ningún tramo recto supera 30 u (5 celdas de 6 u)**, salvo
las excepciones nombradas (malecón y, si se agrega, el muelle de la punta
norte, §4.1). Éxito visual: en la vista *cover* del sitio (1600×900 a 2x),
las puntas 1 y 2 se leen redondeadas e irregulares, con la espuma
siguiéndolas, sin cuadrados de 18 u.

## 3. Reglas

- **Una sola fuente de verdad** para la costa de la isla, en
  `src/map/geo.ts`: funciones de borde (o un polígono con ruido) que usan
  `shipyardTerrainAt`, `cityTerrainAt`, `seaTerrainAt` (para el lado mar),
  `estuaryWater` y lo que hoy usa `inMouth`/`MOUTH_Y`/`spitEast`. Nada de
  copias de la curva en cada clasificador.
- **Determinista y sin rng**: suma de senos de periodos distintos (como
  `riverCenter`, `shoreWidth`, `reachAt`) más, si hace falta, un hash entero
  por celda (como `cellNoise` en `terrain.ts:87-91`). La forma no depende de
  la semilla del mundo ni del orden de consumo del rng de ninguna escena.
- **Escala variada**: al menos dos frecuencias (una que haga caletas de
  ~30–60 u y otra de detalle de ~8–15 u). Amplitud suficiente para que se
  note en la vista cover: entrantes/salientes de al menos 2 celdas.
- **Lo construido se queda en tierra** (ver §5): la costa nueva puede
  avanzar hacia el agua o retroceder hacia tierra, pero nunca dejar sobre el
  agua un sólido existente ni acercarse a menos de 3 u de su pie.
- **Nada alto toca un sólido**: el terreno y los sólidos no se ordenan por
  profundidad entre sí (`2026-09-14-mundo-isometrico-design.md`); la tierra
  nueva usa la altura de su material actual (`east`, `jungle`), sin lomas.

## 4. Diseño por tramo

### 4.1 Punta norte (ítem 2)

Hoy la boca del río corta la isla en `y = 24` recto, y los galpones de
alistamiento del astillero (`prism(x, 24, 0, 8, 92, 6, gable)` para
x ∈ {304, 316}, `src/scenes/shipyard.ts:204`) apoyan sus piñones norte
justo sobre esa raya.

- Reemplazar `y = 24` por una costa irregular entre aproximadamente
  y 6 y y 30, con una punta redondeada hacia el NE (hacia el mar) y una
  caleta hacia el NO (hacia la boca del río). La costa sigue cerrando la
  boca del río: `inMouth(343, y < 24)` puede cambiar, pero el agua de la
  boca tiene que seguir conectando río y mar (el test
  `terrain.test.ts:155` pide triángulos de agua con y < 24 y x > 300).
- Los galpones: si la costa nueva queda al norte de y 24 frente a ellos,
  ganan un pie de tierra; si queda al sur, se **acortan** (y0 hasta 36 como
  máximo) o se les pone delante un **muelle de piedra** corto (≤ 24 u,
  `paving` o `concrete`) como pieza construida recta. Elegir lo que lea
  mejor en la captura y anotarlo en los desvíos.
- Escollera: cuando la orilla de la punta norte queda contra el astillero,
  sumar conos de piedra a lo largo de la costa nueva, como
  `fittingOut()` en `eastBank(y)+1.5` (`shipyard.ts:207`).

### 4.2 Costa este, mitad norte (x = 344, y 24..158)

Hoy es el corte recto `x ≥ 344 → mar`.

- Reemplazarlo por una costa irregular que se mueve entre x ≈ 330 (galpones hasta x 324, chatarra hasta x 326: 3 u de pie libre) y
  `344 + shoreWidth(y) − 1`. **Nunca más al este**: el test
  `terrain.test.ts:69-76` (ninguna celda de tierra clickea Blog) y
  `geo.test.ts:12-26` atan la tierra a `worldZoneAt`. Mover `worldZoneAt`
  queda **fuera de alcance**.
- La punta del faro (`HEADLAND`, x ≥ 330, y 97..134) no cambia: la costa
  nueva empalma con su base en x 330..344.
- Los sólidos del astillero en esa franja (selva en x 332..340, chatarra
  x 302..326 y 130..140, cilindro (310, 122) r 4) se quedan; la selva que caiga
  al agua se descarta como hace `jungleOnLand` en `city.ts:310-317`. Ningún
  otro sólido queda a menos de 3 u del agua.

### 4.3 Costa oeste, mitad sur (`estuaryEast`)

Hoy es una diagonal recta de (241, 146) a (307.5, 336).

- Sumarle ruido **solo hacia el oeste** (hacia el estuario):
  `estuaryEast'(y) = estuaryEast(y) − w(y)` con `0 ≤ w(y) ≤ 10`. Así las
  manzanas, que deben quedar a `≥ estuaryEast + STREET`
  (`city-grid.test.ts:33-34`), no pierden calle. Si las manzanas se calculan
  desde `estuaryEast`, usar la función sin ruido para ellas y la ruidosa para
  el terreno.
- `w(y) = 0` en y 200..224, para que el puente (`BRIDGE`, y 207..217,
  aterriza en x 276) siga apoyando en el mismo lugar
  (`city-grid.test.ts:45-48`).
- La selva de la ribera del distrito (`greenery()`, `city.ts:319-331`) llena
  la tierra nueva; no se agregan edificios.

### 4.4 Punta sur (ítem 1)

Hoy la lengua de selva entre el estuario y el mar se afina en línea recta
hasta y ≈ 363 y se dibuja en celdas de 18 u.

- Rediseñar la punta como un extremo redondeado e irregular, con una o dos
  puntas menores, y con el mismo ruido de la §4.3 en su lado oeste. Se
  permite alargarla hasta y ≈ 380.
- **Resolución:** subdividir a 6 u las celdas del sangrado en la caja de la
  punta (aprox. x 270..380, y 336..400: tierra, orilla y agua a menos de
  18 u de la tierra), como hace el velo en las costuras de zona
  (`src/world/veil.ts`). Afuera de esa caja el agua del sangrado sigue en
  18 u (regla medida en `terrain.ts:20-23`; `terrain.test.ts:142-175` sigue
  fijando celdas de 18 u en (264, −348) y (858, 660)). `depthAt` y la
  espuma tienen que verse continuas en el borde de la caja.
- Los tests que fijan la punta (`terrain.test.ts:88-90`: `bleedTerrainAt(330,340)`
  selva, `(338,400)` río, `(346,400)` orilla) se actualizan a la forma
  nueva **a propósito**, con valores que la describan.

## 5. Lo que no se mueve

- Lanes de los barcos (`LANE_OUT`, `LANE_BACK`, `src/scenes/sea-anim.ts:35,41`),
  boyas (398, 150) y (392, 200), pecio (490, 262). Los tests
  `sea-anim.test.ts:43-139` (agua, `depthAt ≥ 6`, zona Blog, oclusión)
  tienen que seguir pasando sin mover vértices.
- `HEADLAND`, faro, casa del farero, `MALECON` (x 334..344, y 158..326),
  puente, `EAST_COLS`, galpones de alistamiento (salvo el acortamiento de la
  §4.1), `ZONE_SPLIT_X/Y`, `WORLD`, `BLEED`, `worldZoneAt`.
- Cotas de escenas: todo sólido del astillero con x ≤ 345 e y ≤ 147
  (`shipyard.test.ts:18-25`); todo sólido de `sea.ts` con x ≥ 330
  (`sea.test.ts:24`).

## 6. Tests

- **Nuevo, tramos rectos:** recorrer la máscara tierra/agua (6 u) del borde
  de la isla (de la punta norte a la punta sur por ambos lados, incluida la
  caja subdividida de la §4.4) y verificar que ningún tramo recto de borde
  de celda supera 30 u, excepto el malecón (y 158..326) y el muelle de la
  §4.1 si existe.
- **Nuevo, sólidos en tierra:** ningún sólido del astillero ni de la ciudad
  (salvo selva descartada y conos de escollera) tiene su pie a menos de 3 u
  del agua nueva.
- **Nuevo, sin rng:** la función de costa es pura (mismo resultado con dos
  semillas del mundo distintas).
- Actualizar a propósito: `terrain.test.ts:13-53` (puntos fijados cerca de
  y 24 y x 344 que cambien de clase), `:88-90` (punta), `geo.test.ts:34-41`
  (`MOUTH_Y`, `inMouth`) si cambia la API. Cada valor nuevo con un comentario
  que diga qué punto de la costa describe.
- Siguen pasando sin cambios: `sea-anim.test.ts`, `terrain.test.ts:69-76`,
  `geo.test.ts:12-26`, `city-grid.test.ts`, `veil.test.ts`.

## 7. Storybook y capturas

- Dos exhibits de región nuevos en `src/lab/exhibits.ts` (y en `CATALOG` de
  `exhibits.test.ts` y el índice del spec del storybook): `punta-norte`
  (aprox. x 270..350, y 0..60) y `punta-sur` (aprox. x 270..380,
  y 300..400; requiere el mundo sin filtro de zonas).
- El PR trae capturas **antes/después**: vista *cover* del sitio
  (`http://localhost:5173/`, 1600×900 a 2x) y recortes de las puntas 1 y 2
  a la misma escala que `assets/2026-10-27-anotaciones/isla-1.jpg` e
  `isla-2.jpg`; más los dos exhibits nuevos. Guardarlas en
  `docs/superpowers/specs/assets/2026-10-27-isla/`.
- Medir polígonos estáticos del terreno antes/después (panel del storybook o
  `__PIXI_DEVTOOLS_WRAPPER__.rendering.capture()`, ver `CLAUDE.md`) y anotar
  el delta. La subdivisión de la §4.4 suma triángulos: que el aumento total
  del terreno no pase de **+3 %**.

## 8. Criterios de aceptación

- [ ] `npm run typecheck` y `npm test` pasan.
- [ ] Test de tramos rectos (≤ 30 u) y test de sólidos en tierra en verde.
- [ ] La punta sur se dibuja en celdas de 6 u, sin cuadrados de 18 u en tierra ni espuma.
- [ ] Malecón, lanes, faro y puente sin cambios; tests de zona y lanes sin tocar.
- [ ] Capturas antes/después en el PR y en `assets/2026-10-27-isla/`.
- [ ] Delta de polígonos del terreno ≤ +3 %, anotado en el PR.
- [ ] Sección "Desvíos" al final de este spec si algo se resolvió distinto.

## 9. Fuera de alcance

- Mover `worldZoneAt`, el velo o los encuadres por zona.
- Lomas o acantilados en la isla.
- Cambiar la costa oeste de la mitad norte (`eastBank`) o el malecón.
- Islotes sueltos nuevos (si el agente los ve necesarios, follow-up).
