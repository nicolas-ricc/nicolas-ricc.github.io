# Corredor de oclusión del tren: regla en flora, selvas despejadas, helpers en depth.ts y test de oclusión por la vía (#280) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ningún sólido estático de alto > 0.4 quede delante del tren de la vía 3 en ninguna posición de su recorrido (x0 de −448.8 a 111.2), descartando los conos de selva al sur de la vía con una regla de tres ejes en `flora.jungle`, y dejarlo fijado por un test de oclusión que barre el tren.

**Architecture:** Los helpers de pantalla `screenHull` y `hullsIntersect` (SAT) se mudan de `sea-anim.test.ts` a `src/iso/depth.ts`, que es puro. `Rails` de `flora.ts` gana `train?` y `jungle` descarta, después de sembrar, los conos al sur de la vía que el SAT no separa del tren. Las cuatro selvas que caen al sur de la vía (hinterland, astillero, ciudad y tecnológico) pasan `{ y: RAIL_Y, train: TRAIN_CLEAR }`. Un test nuevo, `train-occlusion.test.ts`, barre `trainBox` sobre `world(7).solids`.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #280 (bloques "Qué hay hoy", "Qué hacer", "Reglas que hereda" y "Criterios", con el texto completo); `docs/superpowers/specs/2026-10-27-estacion-terminal-design.md` §6.2; decisión 6 del plan de la historia, en el comentario de #239.

## Global Constraints

- Rama base `feature/239-estacion-tigre`; el PR va contra esa rama.
- Proyección `sx = x − y`, `sy = (x + y)/2 − 1.4z`. Ejes del SAT para cajas alineadas: `p = y − 1.4z`, `q = x − 1.4z`, `sx = x − y`.
- `TRAIN_CLEAR = { y0: 130.8, y1: 134.2, x1: 158 }` (de `station.ts`), sin cambios. Caja del tren `trainBox(x0, 132.5, 4)`, `trainLen(4) = 46.8`, `WEST_RAIL_X0 = −402`, `STOP_X = 158`.
- Regla del sur, literal del issue: con `at.y > max(rails.y)`, se descarta el cono si se cumplen las tres: `at.y − r − 1.4·(at.z + h) < train.y1 + 0.3`, `at.x − r − (at.y + r) < train.x1 − train.y0` y `at.x − r − 1.4·(at.z + h) < train.x1`.
- El rng de cada escena consume igual que hoy. La regla descarta después de sembrar, y lo que no está al sur de la vía no se mueve.
- Nada estático que no sea cono se mueve a mano. Hoy no hay ninguno: medido con un prototipo del test (ver A1).
- Sin hex. `src/iso/` y `src/scenes/` sin pixi.
- Comentarios y docstrings en castellano rioplatense, con la densidad de `flora.ts` y `depth.ts`.
- Al final de cada tarea: sus tests y `npm run typecheck` en verde. Al final de Task 3: `npm test` entero en verde.

## Review Focus

1. **Cono al norte de la vía con `train`.** No debe descartarse aunque cumpla los tres ejes; solo cuenta `at.y > max(rails.y)`. Test en Task 2.
2. **Consumo del rng.** Con o sin `train`, la siembra que sigue es idéntica: después de `jungle` sale el mismo `rng.next()`. Test en Task 2.
3. **Borde exacto de la regla.** Un cono con `at.y − r − 1.4·(z + h)` exactamente igual a 134.5 queda: la desigualdad es estricta. Test en Task 2.
4. **`sea-anim.test.ts` cambia de comportamiento al mudar los helpers.** Los tres tests que usan `expectNotBehind` y el de separación siguen en verde con el import. El test "intersects (SAT)" pasa a `depth.test.ts`. Task 1.
5. **Sólidos finos elevados** (la barrera del paso a nivel, `beam` a z 1 con 0.1 de espesor). El filtro "alto ≤ 0.4" mide la extensión en z (`max.z − min.z`), como el test "oclusión" de `station.test.ts`, no `max.z`. Medido: con cualquiera de los dos filtros, los 11 infractores de hoy son todos conos. Task 4.

## Assumptions

- **A1. Medición de hoy** (prototipo del test de Task 4 sobre `world(7)`, 4166 sólidos): 11 sólidos quedan delante del tren en alguna posición, todos conos. Hinterland: (−139, 140), (−116, 141), (−112, 140), (−90, 139) y (−42, 140). Astillero: (4, 143), (16, 142), (20, 142) y (33, 143). Tecnológico: (−156, 149). Ciudad: (134, 149). La regla los descarta a todos (se verifica en Task 3 con el test de Task 4).
- **A2. `rails.y` en las cuatro llamadas:** `{ y: RAIL_Y, train: TRAIN_CLEAR }` (el issue lo da para el hinterland). En el astillero, la ciudad y el tecnológico, la regla de las vías (`|at.y − ry| < r + 1.5`) no cambia nada en la ciudad ni en el tecnológico (y ≥ 147). En el `cluster` sur del astillero (y 139..143) la regla del tren ya descarta todo cono posible: con y 143, r 2 y h 5, `143 − 2 − 1.4·5.4 = 133.44 < 134.5`, y con x ≤ 39 los otros dos ejes también se cumplen. Ese cluster queda vacío.
- **A3. Ubicación del test de oclusión:** archivo nuevo `src/scenes/train-occlusion.test.ts` (el issue permite `station.test.ts` o este). `station.test.ts` ya es largo y este test arma `world(7)`.
- **A4. "Alto > 0.4"** es `b.max.z − b.min.z > 0.4` (Review Focus 5).
- **A5. Variante del sangrado** (punto 4 del issue): la cubre el mismo barrido, porque `world(7).solids` incluye hinterland y tech. El test lo hace explícito: afirma que hay sólidos estáticos con `b.max.x < −60` que se superponen en pantalla con el tren en algún x0, para que el barrido no pase vacío en el sangrado.
- **A6. Paso del barrido:** `for (let x0 = WEST_RAIL_X0 − trainLen(4); x0 <= STOP_X − trainLen(4) + 1e-9; x0 += 4)`. Con −448.8 + 4k, el último x0 es 107.2; además se prueba x0 = 111.2 (`STOP_X − trainLen(4)`), la posición detenida, que el paso de 4 no toca.
- **A7. Conteo por escena** para el PR: conos `leaf`/`leafDark` de `world(7)[scene].solids`, antes (rama base) y después, en hinterland, astillero, ciudad y tecnológico. Lo mide el orquestador al cierre de Task 3 con un script de un solo uso que no se commitea.
- **A8. Umbrales de los tests de conteo:** `shipyard.test.ts` tiene "≥ 20". Si baja de 20, se pone el número medido con el motivo en un comentario ("el cluster SO al sur de las vías queda vacío por el corredor del tren, #280"). `city.test.ts` tiene "> 60" y solo se toca si cae. El hinterland y el tecnológico no tienen piso numérico de conos de selva: se revisa que sigan verdes. Si el número de conos del comentario de `hinterland.ts:155` ("quedan ~30") cambia, se actualiza.
- **A9. Captura** `docs/superpowers/specs/assets/2026-10-27-estacion/corredor-sur.png`: la toma el orquestador al final de stage 4 con agent-browser (`/lab/world.html`, tecla `1`, viewport 1600×900 a 2x = 3200×1800). No es tarea de un implementador.

## Tests de stage 3

Los escribe el orquestador antes de Task 1, en rojo:

- `src/iso/depth.test.ts`: "screenHull / hullsIntersect" (los casos del issue y el de #83, ver Task 1).
- `src/scenes/flora.test.ts`: "regla del tren" (ver Task 2).
- `src/scenes/train-occlusion.test.ts`: barrido (ver Task 4). Queda en rojo hasta Task 3.

---

### Task 1: `screenHull` y `hullsIntersect` en `depth.ts`

**Files:**
- Modify: `src/iso/depth.ts`
- Modify: `src/scenes/sea-anim.test.ts:5-30` (borra las copias locales e importa de `../iso/depth`; `intersects` → `hullsIntersect`; el test "intersects (SAT)" se va a `depth.test.ts`)
- Test: `src/iso/depth.test.ts`

**Interfaces:**
- Produces: `export function screenHull(b: Bounds): Vec2[]` (envolvente convexa de los 8 vértices proyectados, vía `convexHull` y `project`) y `export function hullsIntersect(a: Vec2[], b: Vec2[]): boolean` (SAT entre convexos; tocarse cuenta como cortarse, igual que hoy: `>=`).

- [ ] **Step 1: Tests (stage 3)** en `depth.test.ts`, `describe("screenHull / hullsIntersect")`:
  - Con `sq(x, y)`, el cuadrado de lado 2: `hullsIntersect(sq(0,0), sq(1,1))` es true y `hullsIntersect(sq(0,0), sq(3,0))` es false.
  - `screenHull(bounds(box(0,0,0)))` tiene 6 vértices y todos están dentro de `screenBounds` de la misma caja.
  - #83: una caja larga en diagonal, `{min:(0,0,0), max:(4,80,13)}`, y otra a 35 u en la dirección perpendicular en pantalla. Por ejemplo, `{min:(35,35,0), max:(37,37,2)}` desplazada hasta que `overlaps(screenBounds)` dé true y `hullsIntersect(screenHull)` dé false. El implementador fija la caja concreta y la verifica en los dos predicados.
- [ ] **Step 2:** `npx vitest run src/iso/depth.test.ts` → FAIL (no exportados).
- [ ] **Step 3:** Mover las dos funciones a `depth.ts` con sus docstrings (el de `screenHull` conserva la nota de #83). Importar `convexHull` y `type Vec2` de `./geometry`.
- [ ] **Step 4:** `npx vitest run src/iso/depth.test.ts src/scenes/sea-anim.test.ts` → PASS; `npm run typecheck` → limpio.
- [ ] **Step 5:** Commit `refactor(#280): screenHull y hullsIntersect a depth.ts`.

### Task 2: regla del tren en `flora.jungle`

**Files:**
- Modify: `src/scenes/flora.ts`
- Test: `src/scenes/flora.test.ts`

**Interfaces:**
- Produces: `export interface Rails { y: readonly number[]; train?: { y0: number; y1: number; x1: number } }`. `jungle` tiene la misma firma.

- [ ] **Step 1: Tests (stage 3)** en `describe("regla del tren")`. Un helper siembra un solo cono en un área degenerada (`x0 = x1`, `y0 = y1`). Como `r` y `h` salen del rng, se usa un rng falso (`Rng` con `chance`/`int` que devuelven valores fijos: `int(a, b)` devuelve, en orden, x, y, r, h) para fijar r y h. Con `T = { y0: 130.8, y1: 134.2, x1: 158 }` y `rails = { y: [131, 134], train: T }`:
  - sur y alto: cono (100, 141), r 2, h 9, z 0.4 → descartado (`141 − 2 − 13.16 = 125.84 < 134.5`).
  - más al sur: (100, y) con `y = 134.5 + 2 + 1.4·9.4` = 149.66 → queda (borde exacto, Review Focus 3). También queda en y 150.
  - al este del frente: (180, 141), r 2, h 5 → `180 − 2 − 7.56 = 170.44 ≥ 158` → queda.
  - al este por sx: (175, 141), r 2, h 9 → `175 − 2 − 13.16 = 159.84 ≥ 158` → queda. (El eje sx da `175 − 2 − 143 = 30 ≥ 27.2` y también separa.)
  - norte: (100, 120), r 2, h 9 → queda (Review Focus 1), aunque los tres ejes no separan.
  - sin `train`: el mismo cono (100, 141) queda.
  - rng: con `createRng(5)`, área x −238..−62, y 112..141 y n 60, el `rng.next()` posterior es igual con `{ y: [131, 134] }` y con `{ y: [131, 134], train: T }`. Con `train`, la salida es un subconjunto de la de sin `train` (por JSON) y es estrictamente menor.
- [ ] **Step 2:** `npx vitest run src/scenes/flora.test.ts` → FAIL.
- [ ] **Step 3:** Implementar en `jungle` la condición de Global Constraints, después del chequeo de `rails.y`. Docstring de `Rails.train`: la caja en planta del tren (frente máximo `x1`, z 0..5.7), los tres ejes del SAT (`p = y − 1.4z` contra `y1 + 0.3`, `sx = x − y` contra `x1 − y0` y `q = x − 1.4z` contra `x1`), que alcanza con que uno separe, y por qué solo al sur: las capas animadas se pintan encima de lo estático y lo que está al norte queda detrás.
- [ ] **Step 4:** `npx vitest run src/scenes/flora.test.ts` → PASS; `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(#280): regla del tren en flora.jungle`.

### Task 3: aplicar la regla en las cuatro selvas

**Files:**
- Modify: `src/scenes/hinterland.ts:155` (`{ y: RAIL_Y, train: TRAIN_CLEAR }`; actualizar "quedan ~30" con el número medido)
- Modify: `src/scenes/shipyard.ts:186-200` (`cluster(..., n, rails?: Rails)` pasa `rails` a `flora`; solo `cluster(3, 39, 139, 143, 4, { y: RAIL_Y, train: TRAIN_CLEAR })`; comentario: el corredor del tren lo vacía, A2)
- Modify: `src/scenes/city.ts:311-321` (`jungleOnLand(out, rng, rect, n, z = 0.4, rails?: Rails)` pasa `rails` a `jungle`; solo la llamada del cinturón de costura)
- Modify: `src/scenes/tech.ts:187` (`jungle(..., 2, 0.4, { y: RAIL_Y, train: TRAIN_CLEAR })`)
- Modify, si cambian: `src/scenes/shipyard.test.ts:86`, `city.test.ts:199`, `hinterland.test.ts`, `tech.test.ts` (A8)

**Interfaces:**
- Consumes: `Rails` (Task 2); `TRAIN_CLEAR` de `./station`; `RAIL_Y` de `./shipyard` (sin ciclos: `station.ts` solo importa `train.ts`).

- [ ] **Step 1:** Medir los conos por escena antes del cambio (A7).
- [ ] **Step 2:** Aplicar los cuatro cambios.
- [ ] **Step 3:** `npx vitest run src/scenes/train-occlusion.test.ts` → PASS (antes, FAIL con los 11 conos de A1).
- [ ] **Step 4:** `npm test` y ajustar los umbrales que caigan (A8), con el motivo en un comentario. Medir los conos por escena después.
- [ ] **Step 5:** `npm test` y `npm run typecheck` → verdes. Commit `feat(#280): corredor del tren despejado en las cuatro selvas`.

### Task 4: test de oclusión por la vía

Lo escribe el orquestador en stage 3. Queda en rojo hasta Task 3.

**Files:**
- Create: `src/scenes/train-occlusion.test.ts`

**Interfaces:**
- Consumes: `screenHull`, `hullsIntersect`, `isBehind`, `overlaps`, `screenBounds` (`../iso/depth`); `trainBox`, `trainLen` (`./train`); `STOP_X`, `TRACKS_Y` (`./station`); `WEST_RAIL_X0` (`./hinterland`); `world` (`./world`).

- [ ] Test "ningún sólido estático alto queda delante del tren en todo el recorrido": statics son `world(7).solids` con la extensión en z > 0.4 (A4). Se barren los x0 de A6, con `y = TRACKS_Y[2]`. Para cada sólido con `overlaps` y `hullsIntersect`, `isBehind(tren, sólido)` es false, con el mensaje JSON del sólido y el x0. Se cuentan los pares superpuestos (> 0).
- [ ] Test "el barrido cubre el sangrado": algún sólido estático con `max.x < −60` se superpone (bounds y hull) con el tren en algún x0 (A5).
- [ ] Docstring breve: por qué (las capas animadas se pintan encima, `stage.ts`), y que §6.2 da la regla y este test la prueba sobre el mundo armado.

### Task 5 (orquestador, stage 4): captura

- [ ] `npm run dev -- --host --port 5173`, agent-browser con viewport 1600×900 a 2x, `/lab/world.html`, tecla `1`. Guardar en `docs/superpowers/specs/assets/2026-10-27-estacion/corredor-sur.png`, encuadrando el corredor al sur de la vía (A9). Commit `docs(#280): captura del corredor sur`.
