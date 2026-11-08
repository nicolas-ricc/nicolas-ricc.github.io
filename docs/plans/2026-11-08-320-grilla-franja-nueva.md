# Grilla de Resume en la franja nueva (#320) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** construir la franja `y 90..158` de Resume: fila de manzanas `92`, cinco lotes de carga (`freight`) en `y 116`, playas ferroviarias con cercos y cuatro pasos a nivel, dos manzanas del este en `(280, 116)` y `(280, 140)`, y sus calles.

**Architecture:** `src/scenes/city-grid.ts` sigue siendo la única fuente de verdad de la grilla: `blocks()` suma las manzanas nuevas y el tipo `freight`; los consumidores (`zoning.ts`, `city.ts`, `fixed.ts`) las tratan según su `kind`. `rail-lands.ts` suma cercos y pasos a nivel alrededor de la vía; `streets.ts` suma las líneas de la franja. Dos exhibits nuevos en el storybook.

**Tech Stack:** TypeScript estricto, Vitest, PixiJS v8 (solo en el runtime; `src/scenes/` e `src/iso/` no lo importan).

**Spec:** issue #320 (manda) y `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` (historia #56). ADR `docs/adr/0002-seam-at-90-station-land-stays-portfolio.md`.

## Global Constraints

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`); ids de exhibits en castellano, agregados a `EXHIBIT_IDS` (`src/english.test.ts`) y a `CATALOG` (`src/lab/exhibits.test.ts`).
- `src/iso/` y `src/scenes/` no importan Pixi; colores solo por `Material` de `src/map/palette-iso.ts`; nada de literales hex; nada de `Math.random` (toda aleatoriedad del `Rng` recibido). Sin dependencias nuevas. `noUnusedLocals`.
- Regla del tren: todo sólido estático con altura > 0.4 y `y_min > 134.2` cumple `y_min − 1.4·z_max ≥ 134.5`; al norte de la vía, `y_max ≤ 130.8` (salvo altura ≤ 0.4). `src/scenes/train-occlusion.test.ts` barre el mundo.
- Presupuesto (`src/scenes/city-budget.test.ts`): sólidos elevados ≤ 2 900, `strip` ≤ 190, acentos estáticos ≤ 1 150, polígonos estáticos del mundo ≤ 56 000. No subir topes; si no entra, recortar.
- Decisiones del issue "no reabrir": se copian tal cual en cada tarea.
- Commits en inglés, `feat(#320): …` / `test(#320): …`.

## Review Focus

1. **Manzanas de distrito en la fila 92.** `DISTRICT_COLS = [−48, −18]` marca como `district` toda manzana de esas columnas; la fila 92 tiene que salir `kind: "block"` (el issue pide 36 `block` = 29 + 5 + 2 y cinco `residential`). Test en la Tarea 1.
2. **Orden del rng.** `assign()` y `cars()` consumen rng por manzana en el orden de `blocks()`: sumar la fila 92 al principio corre todas las tiradas. Los tests que fijan recetas por semilla (`zoning.test`, `fixed.test`, `lights.test`) pueden cambiar de valor sin que haya un error: se ajustan solo si el cambio es de tirada, no de regla (Tarea 2).
3. **Tablones al sur de la vía.** El tablón `y 134.3..135.4` (h 0.3) no cumple `y_min − 1.4·z_max ≥ 134.5`; la regla del tren exime todo lo de altura ≤ 0.4 (`train-occlusion.test.ts`). El test de `rail-lands` aplica la regla solo a sólidos de altura > 0.4 (Tarea 3).
4. **Calles E-O "como hoy".** Con `ROWS` nuevo, `ROWS.slice(1)` incluiría `161` (calle `158..164`), que hoy no existe. Las E-O siguen siendo 185, 239, 269, 299, 322 más la 113 (oeste) y la 137 (este) (Tarea 4).
5. **Lotes de carga sin edificio.** `freight` no recibe receta ni autos, pero sí zócalo `paving` de `b.w × b.d`; `neighborhoodOf` los clasifica `residential` por descarte y nadie debe construir con eso (Tarea 2).

---

### Task 1: Grilla — filas, constantes y `blocks()`

**Files:**
- Modify: `src/scenes/city-grid.ts`
- Test: `src/scenes/city-grid.test.ts`

**Interfaces:**
- Consumes: `STATION_LAND`, `ZONE_SPLIT_Y`, `ESTUARY_Y0`, `eastBank`, `distToHeadland`, `SHORE_W` de `src/map/geo.ts`.
- Produces: `ROWS = [92, 164, 188, 218, 242, 272, 302] as const`; `FREIGHT_ROW = { y: 116, d: 13 } as const`; `RAIL_LANDS = { y0: 129, y1: 158 } as const`; `RING_Y0 = 120`; `HARBOR = { x0: EAST_RING.x0, x1: 306, y0: ZONE_SPLIT_Y, y1: ESTUARY_Y0 } as const`; `BlockKind` con `"freight"`; `blocks()` con las manzanas nuevas; `PLAZA` sigue siendo `Rect` y el bloque plaza sale con `row: 3`.

- [ ] **Step 1: Tests (ya en la rama desde la etapa de evals; si no, escribirlos)** en `city-grid.test.ts`:
  - `ROWS[0] === 92`; las manzanas con `y === 92` son cinco, `x` = `[−48, −18, 12, 42, 72]`, todas `kind "block"`, `bank "west"` y `x + w ≤ STATION_LAND.x0`.
  - cinco `kind === "freight"` con `y 116`, `d 13`, `w 24`, `bank "west"`, `row −1`, mismas `x`; `FREIGHT_ROW`, `RAIL_LANDS`, `RING_Y0`, `HARBOR` con `toEqual` de los valores de arriba.
  - existen `(280, 116)` y `(280, 140)` `bank "east"`, `kind "block"`; no existe `(280, 92)`; ninguna del este con `y < ROWS[1]` tiene `x ≥ 310`.
  - ninguna manzana se superpone a `STATION_LAND`; las cuatro esquinas de toda manzana tienen `distToHeadland ≥ SHORE_W`.
  - la de calle mínima (≥ `STREET` entre vecinas) sigue igual y cubre los `freight` (distan 6 de la fila 92).
  - `blocks().filter(kind === "block")` tiene 36; `ROWS[2] + BLOCK_D === AVENUE.y0`, `ROWS[3] === AVENUE.y1`; el bloque plaza tiene `row 3` y `ROWS[3] === PLAZA.y`.
  - "every block falls on city land": `b.y ≥ CITY_EDGE.north + 2` (la fila 92 queda a 2 de la costura; el resto sigue a ≥ 6, comprobarlo con `b.y === ROWS[0] || b.y ≥ CITY_EDGE.north + STREET`); para el este con `b.y < ESTUARY_Y0`, `b.x ≥ eastBank(b.y) + 1` en lugar de `estuaryEast` (`eastBank(116) = 273`).
- [ ] **Step 2:** `npx vitest run src/scenes/city-grid.test.ts` → FAIL.
- [ ] **Step 3: Implementar en `city-grid.ts`.** En `blocks()`: la fila `ROWS[0]` solo pone columnas oeste con `x + BLOCK_W <= STATION_LAND.x0`, siempre `kind "block"` (el distrito empieza en `ROWS[1]`); el este, para `y < ROWS[1]`, solo `(280, 116)` y `(280, 140)`, con `row: −1` como los `freight` (no están en `ROWS`; el único lector de `row` era `maxHeightFor`, que pasa a comparar `y`); los cinco `freight` con `row: −1`; la plaza con `row: 3`. Comentario corto en cada constante nueva.
- [ ] **Step 4:** `npx vitest run src/scenes/city-grid.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#320): grid rows, freight lots and east blocks of the new strip`.

### Task 2: Consumidores de la grilla — zonificación, zócalos y autos

**Files:**
- Modify: `src/city/zoning.ts`, `src/scenes/city.ts`, `src/city/fixed.ts`
- Test: `src/city/zoning.test.ts`, `src/scenes/city.test.ts` (y ajustar valores de tirada en `fixed.test.ts` / `lights.test.ts` si cambian)

**Interfaces:**
- Consumes: Tarea 1 (`ROWS`, `blocks()`, `kind "freight"`).
- Produces: `assign()` sin `freight`; `maxHeightFor(b)` por `b.y === 242`; `openSides(b)` con `"s"` para `b.y === ROWS[0]` y `"n"` para `(280, 116)`.

- [ ] **Step 1: Tests.** `zoning.test.ts`: el helper `cells` excluye `plaza` **y** `freight`; `residential` pasa a incluir las cinco de la fila 92 (comentario: provisorio, #322 cambia el barrio); `riverside` sigue siendo todo el este (incluye las dos nuevas); `openSides(blockAt(12, 92))` contiene `"s"`; `openSides(blockAt(280, 116))` contiene `"n"` y `"w"`; `maxHeightFor(blockAt(102, 242)) === FRONT_CAP_H`; ningún `Placed` de `assign()` tiene `block.kind === "freight"`. `city.test.ts`: `ROW_SOUTH = ROWS[4]`; zócalos `24 × 18` ≥ 45; exactamente cinco zócalos `paving` `24 × 13` de `PLINTH_H` en `z 0`, en `y 116`; ningún sólido no cono con `min.y < 89` (ya existe con `ZONE_SPLIT_Y − 1`); ningún auto (`car`) toca un `freight`.
- [ ] **Step 2:** `npx vitest run src/city/zoning.test.ts src/scenes/city.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** `zoning.ts`: `assign()` salta `kind === "freight"` junto a `plaza` y `collapsed`; `maxHeightFor` compara `b.y === 242`; `openSides` suma las dos reglas (sin duplicar lados). `city.ts`: después del bucle de `assign()`, recorrer `blocks()` y por cada `freight` empujar `prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving")`. `fixed.ts` `cars()`: `if (b.kind === "freight") continue;` junto a la plaza. `neighborhoodOf` no cambia.
- [ ] **Step 4:** `npm test` → los tests de esta tarea en verde; si `fixed.test` / `lights.test` fallan solo por valores de tirada (receta o conteo en una celda), actualizar el valor esperado y anotarlo en el commit; si fallan por una regla, arreglar el código.
- [ ] **Step 5:** commit `feat(#320): zoning, plinths and cars for the new strip`.

### Task 3: Playas ferroviarias — cercos y pasos a nivel

**Files:**
- Modify: `src/city/rail-lands.ts`
- Test: `src/city/rail-lands.test.ts`

**Interfaces:**
- Consumes: `RAIL_LANDS` (Tarea 1), `MAIN_LINE`, `RAIL_Y`.
- Produces: `railLands(ground, solids)` con la misma firma; exporta `CROSSINGS: readonly { x0: number; x1: number }[] = [{−24, −18}, {6, 12}, {36, 42}, {66, 72}]` (calles N-S del barrio) para el test y para `streets.ts` si le sirve.

- [ ] **Step 1: Tests** en `rail-lands.test.ts` (los existentes de rieles/balasto quedan; el de durmientes filtra `mat === "rust"`; el de "nothing taller than 0.4" pasa a mirar solo durmientes y tablones):
  - cerco norte: prismas `steel` `h 1`, `at.y 129.5`, `d 0.3`, que cubren `[−54, 96]` menos los cuatro huecos exactos `CROSSINGS` (cinco tramos: `[−54,−24]`, `[−18,6]`, `[12,36]`, `[42,66]`, `[72,96]`); cerco sur igual en `at.y 136`.
  - tablones: 12 prismas `deck` `h 0.3`, tres por cruce, `y` `[129.6,130.7]`, `[131.3,133.7]`, `[134.3,135.4]`, `x` = el ancho del cruce.
  - postes: 8 prismas `steel` 0.3×0.3; norte `h 3` en `(x0 − 0.6, 128.6)`, sur `h 2` en `(x1 + 0.3, 137.8)`.
  - regla del tren: todo sólido con altura > 0.4 y `y_min > 134.2` cumple `y_min − 1.4·z_max ≥ 134.5`; ninguno con altura > 0.4 tiene `y_max > 130.8` y `y_min < 134.2`.
- [ ] **Step 2:** `npx vitest run src/city/rail-lands.test.ts` → FAIL.
- [ ] **Step 3: Implementar** en `railLands`: cercos (función local que corta un tramo `[x0, x1]` por los huecos), tablones y postes; los durmientes no cambian (quedan debajo de los tablones, misma altura: es el piso del cruce). Actualizar el docstring (`y 129..137`, cercos y cruces; el desvío viene con el barrio).
- [ ] **Step 4:** `npx vitest run src/city/rail-lands.test.ts src/scenes/train-occlusion.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#320): railyard fences and level crossings`.

### Task 4: Calles de la franja

**Files:**
- Modify: `src/city/streets.ts`
- Test: `src/city/streets.test.ts`

**Interfaces:**
- Consumes: `ROWS`, `RING_Y0`, `HARBOR`, `RAIL_LANDS` (Tarea 1), `eastBank`, `ESTUARY_Y0`, `STATION_LAND`.
- Produces: `streets()` con la misma firma.

- [ ] **Step 1: Tests** en `streets.test.ts`:
  - el test "N-S center lines start at…" pasa a: oeste con `cx < STATION_LAND.x0` arranca en `CITY_EDGE.north`, oeste con `cx ≥ 96` en `ESTUARY_Y0 + 12`; el anillo (`RING_X`) arranca en `RING_Y0`; la de `307` en `ESTUARY_Y0 + 12`.
  - ninguna línea N-S de `cx ∈ {−21, 9, 39, 69}` tiene un punto con `y` en `(128, 137)` (abierto) y cada una tiene un tramo que termina en `128` y otro que arranca en `137`.
  - ninguna línea (de ningún ancho) tiene un punto estrictamente dentro de `STATION_LAND`.
  - hay una E-O en `y 113` que va de `CITY_EDGE.west` a `STATION_LAND.x0` y ninguna en 113 con `x > 96`.
  - hay una E-O en `y 137` de `ceil(eastBank(137)) + 1` (247) a `HARBOR.x1 − 2` (304), y ninguna E-O en 137 al oeste del río.
  - no hay E-O en `y 161`; el test "no E-W line north of the first block row" queda con `ROWS[0]`.
  - el conteo total sigue en `[80, 150]`.
- [ ] **Step 2:** `npx vitest run src/city/streets.test.ts` → FAIL.
- [ ] **Step 3: Implementar** en `lanes()`: N-S de `cx < STATION_LAND.x0` en dos tramos `[CITY_EDGE.north, 128]` y `[137, AVENUE.y0]`; el anillo desde `RING_Y0`; el resto desde `ESTUARY_Y0 + 12`. `rowsY` = `ROWS.slice(2)` − 3 más `CITY_EDGE.south − 2` (las de hoy); aparte, la 113 de `CITY_EDGE.west` a `STATION_LAND.x0` y la 137 de `ceil(eastBank(137)) + 1` a `HARBOR.x1 − 2`. Para el inicio este de las E-O con `cy < ESTUARY_Y0` usar `eastBank(cy)`, si no `estuaryEast(cy)`. Nombrar `128`/`137` como constantes locales derivadas de los tablones (`RAIL_LANDS`/`CROSSINGS` de la Tarea 3 si encaja; si no, literales con comentario).
- [ ] **Step 4:** `npx vitest run src/city/streets.test.ts src/scenes/city-budget.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#320): streets of the new strip`.

### Task 5: Exhibits, tecnológico y cierre

**Files:**
- Modify: `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts`, `src/english.test.ts`
- Check: `src/scenes/tech-zoning.ts` (sin cambios esperados)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: exhibits `galpones` y `playa-carga` (grupo `city`, zona `cv`, después de `punta-sur`).

- [ ] **Step 1: Tests.** `exhibits.test.ts`: `CATALOG.city` = `[…, "punta-sur", "galpones", "playa-carga"]`; `ANIMATED` suma `"playa-carga"`. `english.test.ts`: `EXHIBIT_IDS` suma `galpones|playa-carga`.
- [ ] **Step 2:** `npx vitest run src/lab/exhibits.test.ts` → FAIL.
- [ ] **Step 3: Implementar** en `exhibits.ts`, después de `punta-sur`: `{ id: "galpones", title: "Warehouse strip", zone: "cv", group: "city", kind: "region", box: { x0: −54, y0: 90, x1: 98, y1: 130 }, h }` y `{ id: "playa-carga", title: "Freight railyard", …, box: { x0: −54, y0: 126, x1: 98, y1: 160 }, h }`. `h` = el menor entero que pasa "framing" y "neighbors" con `measure` (correr el test con un `h` provisorio y leer el rango que pide); comentario con lo que lo fija. El probe de la etapa de plan confirmó que la caja de `playa-carga` recorta el animador `rail` en su estado inicial.
- [ ] **Step 4:** `rowStep` de `tech-zoning.ts`: con `ROWS` de largo 7, `k − ROWS.length` da −6..−1 para las filas viejas (igual que antes) y −7 para la 92; no cambia nada. Correr `npx vitest run src/scenes/tech` → PASS.
- [ ] **Step 5:** `npm test` y `npm run typecheck` → todo verde, presupuesto incluido.
- [ ] **Step 6:** commit `feat(#320): galpones and playa-carga exhibits`.
