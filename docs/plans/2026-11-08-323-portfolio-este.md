# Portfolio este: dique flotante, patio de contenedores, grúas de muelle y galpones de chapa — plan (#323)

> **Para agentes:** sub-skill requerida: `subagent-driven-development`. Los pasos usan casillas (`- [ ]`).

**Goal:** poblar la ribera este del astillero (Portfolio, `y < 90`) con un dique flotante en el río, un patio de contenedores con RTG y straddle carriers, dos grúas de muelle hacia el río y los galpones de alistamiento en chapa `sheetTeal`, en un módulo nuevo `src/scenes/shipyard-east.ts` que `shipyard()` llama.

**Architecture:** `shipyard-east.ts` exporta un builder por pieza (`floatingDock`, `containerYard`, `quayCranes`, `fittingOutSheds`) y un orquestador `shipyardEast` que `shipyard()` llama **al final** (después de `jungle`, para que el rng de la selva no cambie). Reusa el kit industrial de #321 (`stackContainers`, `stackHeight`, `quayCraneAt`, `rtgAt`, `ribs`, `door`). La escollera de `fittingOut()` deja de poner las rocas que caen sobre la losa del patio o las patas de las grúas (`RIPRAP_KEEP_OUT`). El storybook suma tres exhibits.

**Tech Stack:** TypeScript estricto, Vitest; motor puro `src/iso/` y `src/scenes/` (sin Pixi).

**Spec:** issue #323 (manda) y `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` §4.1 P9–P11.

## Global Constraints

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`); ids de exhibits en castellano, agregados a `EXHIBIT_IDS` (english.test) y a `CATALOG` (exhibits.test).
- `src/iso/` y `src/scenes/` no importan Pixi; ningún literal hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts`; nada de `Math.random`: toda aleatoriedad sale del `Rng` recibido. Sin dependencias nuevas; `noUnusedLocals`.
- Regla de Portfolio: todo sólido elevado con `max.y ≤ 90.5` o dentro de `STATION_LAND`.
- Presupuesto: `city-budget.test.ts` ≤ 56 000 polígonos estáticos; no se suben topes.
- Commits en inglés `feat(#323): …` / `test(#323): …`.

## Decisiones técnicas tomadas acá (desvíos medidos contra el mapa)

Medido con seed 7 sobre `feature/56-costura-90` (b363425):

1. **Grúas un entero al este (`x 284`).** La pata oeste de la grúa en `y 34` (`x 279.6..280.4, y 30.6..31.4`) pisa la roca de la escollera del río `x 276.9..279.79, y 28.48..31.52`. El issue prevé ese caso: las dos grúas pasan a `quayCraneAt({ x: 284, y: 34 }, "w")` y `({ x: 284, y: 62 }, "w")` (pórtico `x 281..287`, patas `280.6..287.4`). La punta de la pluma queda en `x 279.6 < 280`.
2. **La escollera de la caleta cede a la losa y a las grúas.** La escollera de la caleta (`x 283..300` cada 3, en `northCoastY(x) + 1.5`) tiene tres rocas sobre lo nuevo: `x 284.4..287.29, y 30.11..33.15` (pata este de la grúa norte), `x 287.4..290.29, y 30.87..33.91` y `x 290.4..293.29, y 26.98..30.03` (esquina NO de la losa y la pila de `y 32`). `fittingOut()` salta toda roca (río o caleta) cuya caja corte una de las `RIPRAP_KEEP_OUT` (la losa del patio y las dos huellas de patas de grúa). Rocas: 27 → 24.
3. **Rieles de las grúas en los ejes de las patas (`x 281` y `x 287`, ancho 0.5) y de `y 31` a `y 82`.** Los `x 280.5 / 285.5` del issue no caen bajo las patas (centros en `at.x ± 3`); y en `y 28..30.5` el riel este cruzaría el agua de la caleta (`terrainAt(287, 28) = water`).
4. **RTG sobre los carriles 2 y 3: `rtgAt(292.1, 302.1, 50, out, 0.2)`.** Con `rtgAt(288.4, 296.6, 50)` la pata oeste (`x 288.4..289.6`) cae dentro del carril 1 (`x 289..291.4`) y pisa las pilas de `y 46` y `y 53`: el oeste del carril 1 solo deja 1 u de losa. Entre carriles hay 2.6 u y al este del carril 3 también: las patas van centradas en esos huecos (`292.1..293.3` y `302.1..303.3`). Las pilas debajo de la viga (carriles 2 y 3, huecos `y 46` y `y 53`) se limitan a 3 contenedores (techo 8.0 < viga a 9.2).
5. **Todo lo que está sobre la losa arranca en `z 0.2`** (su cara superior), así nada se solapa con ella.
6. **La garita (`prism concrete 3×3×2.8` con esquina NO en `(296, 81)`) llega a `y 84`;** el test del patio usa `y 30..84` (el `y1: 84` de la región `patio-contenedores` del issue ya lo prevé), no `30..82`.
7. **Cian +6, no +4:** a los cuatro faroles (dos del dique, dos del patio) se suman las luces de punta de las dos grúas (`quayCraneAt` las emite). `windowCool` +1.
8. **Torres de servicio del dique sobre la cubierta, contra la cara sur del muro norte** (`x 204` y `x 243`, `y 75.5`, `z 1.3`, 3×3×8): si ocuparan `y 74..77` se solaparían con el muro (`y 74..75.5`) y `sortByDepth` no podría ordenarlos.
9. **Test de oclusión con casco en pantalla:** un par cuenta como solapado si `overlaps(screenBounds)` **y** `hullsOverlap(screenHull)`; el rectángulo solo da falsos positivos con cajas largas en diagonal (#83). Igual que la rueda en `fair.test.ts`, se exige `isBehind(protegida, nueva) === false`.
10. **`door` del kit industrial pasa a exportarse** para el portón de los galpones.

## File Structure

- Create `src/scenes/shipyard-east.ts`: constantes y builders de la ribera este.
- Create `src/scenes/shipyard-east.test.ts`: tests de dique, patio, grúas, galpones y oclusión.
- Modify `src/scenes/shipyard.ts`: `fittingOut()` sin los galpones y con `RIPRAP_KEEP_OUT`; `shipyard()` llama `shipyardEast` al final.
- Modify `src/kit/forms/industrial.ts`: `export function door`.
- Modify tests: `shipyard.test.ts`, `portfolio-accents.test.ts`, `world.test.ts` (si cambia la intersección), `ships.test.ts`, `src/lab/exhibits.test.ts`, `src/english.test.ts`.
- Modify `src/lab/exhibits.ts`: tres exhibits nuevos, `darsena.y1 = 72`, `h` de `punta-norte` re-medido.

## Review Focus

1. **Cruce con la escollera:** cualquier roca (`cone rock`) que toque una pata de grúa o la losa → test "no crane leg and no yard solid touches a riprap rock" (Task 3).
2. **Oclusión de la grúa pórtico, el dique seco y las chimeneas** por lo nuevo (dique alto en `y 74`) → test de Task 5.
3. **Solapes dentro del patio** (RTG contra pilas, straddle carriers contra vecinos, faroles) → test por pares AABB (Task 2).
4. **Encuadre del storybook** en `punta-norte` y `darsena`, que ahora recortan grúas y pilas → tests de framing/neighbors del grupo `shipyard` (Task 6).
5. **Determinismo y rng de la selva:** `shipyardEast` va al final; "is deterministic by seed" y los conos de selva siguen (Task 1).

---

### Task 1: Módulo `shipyard-east.ts` y dique flotante

**Files:** Create `src/scenes/shipyard-east.ts`, `src/scenes/shipyard-east.test.ts`; Modify `src/scenes/shipyard.ts`.

**Interfaces — Produces:**
- `export const FLOATING_DOCK = { x0: 204, y0: 74, x1: 246, y1: 88 } as const` (pontón).
- `export function floatingDock(out: Solid[], accents: Accent[], weldSpots: Vec3[]): void`
- `export function shipyardEast(out: Solid[], accents: Accent[], weldSpots: Vec3[], rng: Rng): void` — en esta task solo llama `floatingDock`; las tasks 2–4 suman sus builders.

Piezas (issue, "Dique flotante"): pontón `prism steel (204, 74, −1.2) 42×14×2.5`; muros `prism steel` 42×1.5×6 en `(204, 74, 1.3)` y `(204, 86.5, 1.3)` con placas `safety/asphalt` alternadas (cuatro franjas, como `buffers()` de `station.ts`) en `wall 1` y `wall 2`; casco `{ kind: "hull", at: (208, 81, 1.3), len 30, beam 7, h 4, mat "rust", topMat "hull" }`; superestructura `prism concrete (210, 79, 5.3) 6×4×2.5`; torres `prism steel 3×3×8` en `(204, 75.5, 1.3)` y `(243, 75.5, 1.3)`; poste `prism steel 0.6×0.6×5` en el centro de cada torre a `z 9.3` y `dot cyan r 1.2` en `z 14.3`; pasarela `prism steel (202, 80, 1.3) 2×1.5×0.3`; cuatro `weldSpots` en `z 5.3`: `(218, 77.5)`, `(228, 77.5)`, `(218, 84.5)`, `(228, 84.5)`.

- [ ] **Step 1: tests (fallan)** en `shipyard-east.test.ts`, `describe("floating dock")`:
  - `"pontoon and two walls span x 204..246"`: un prism steel `h 2.5` con `at.z −1.2`, dos prism steel `w 42, d 1.5, h 6` en `y 74` y `y 86.5`, todos con `min.x 204, max.x 246`; los muros llevan placas `safety` y `asphalt` en `wall 1` y `wall 2`.
  - `"half-painted hull inside the walls"`: un `hull` `mat rust, topMat hull`, su caja dentro de `y 75.5..86.5` y `x 204..246`.
  - `"two service towers with cyan lamps"`: dos prism steel `3×3×8`; dos `dot cyan` sobre ellas (`z > 9.3`).
  - `"gangway touches the quay at x 202"`: prism steel `h 0.3` con `min.x 202`, `max.x 204`.
  - `"four new weld spots on the hull sides"`: `shipyard(createRng(7)).weldSpots` incluye las cuatro de arriba (z 5.3).
  - `"everything but the gangway floats"`: `terrainAt` del centro de cada sólido (menos la pasarela) es `"water"`; `max.y ≤ 88.5` para todos.
- [ ] **Step 2:** `npx vitest run src/scenes/shipyard-east.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** implementar `floatingDock` y `shipyardEast`; en `shipyard()` llamar `shipyardEast(solids, accents, weldSpots, rng)` después de `seamFence` (último).
- [ ] **Step 4:** `npx vitest run src/scenes/shipyard-east.test.ts src/scenes/shipyard.test.ts` → PASS (el determinismo y los conos de selva siguen).
- [ ] **Step 5:** commit `feat(#323): floating dock`.

### Task 2: Patio de contenedores y escollera

**Files:** Modify `shipyard-east.ts`, `shipyard-east.test.ts`, `shipyard.ts`.

**Interfaces:**
- Consumes: `stackContainers`, `stackHeight`, `rtgAt`, `CONTAINER` de `src/kit/forms/industrial.ts`.
- Produces: `export const YARD = { x0: 288, y0: 30, x1: 304, y1: 80 } as const`; `export const YARD_LANES_X = [289, 294, 299] as const`; `export const YARD_SLOTS_Y = [32, 39, 46, 53, 60, 67, 74] as const`; `export const RIPRAP_KEEP_OUT: readonly { x0: number; y0: number; x1: number; y1: number }[]` (en esta task, `[YARD]`); `export function containerYard(out: Solid[], accents: Accent[], rng: Rng): void`.

Piezas: losa `prism concrete (288, 30, 0) 16×50×0.2`; 21 huecos (carril × posición); el rng elige dos huecos distintos para los straddle carriers; en los otros 19 `stackContainers((x, y, 0.2), n, "y", rng)` con `n = stackHeight(rng)`, limitado a 3 si el hueco es de los carriles 2–3 en `y 46` o `53` (decisión 4); RTG `rtgAt(292.1, 302.1, 50, out, 0.2)`; straddle carrier en hueco `(x, y)`, con `cx = x + 1.2`: cuatro patas `prism steel 0.4×0.4×5` en las esquinas del bastidor, bastidor `prism safety (cx − 1.5, y − 0.5, 5.2) 3×7×0.6`, cabina `prism steel 1×1×1` en `z 5.8` sobre el extremo norte del bastidor; garita `prism concrete (296, 81, 0) 3×3×2.8` con `poly windowCool alpha 0.85` en su cara sur (`y 84`, `x 296.8..298.2`, `z 1.2..2.2`); faroles: poste `prism steel 0.6×0.6×5` en `(288.5, 30.5, 0.2)` y `(303, 79, 0.2)` con `dot cyan r 1.2` en `(+0.3, +0.3, 5.2)`. En `shipyard.ts`, `fittingOut()` salta toda roca cuya caja corte una caja de `RIPRAP_KEEP_OUT`.

- [ ] **Step 1: tests (fallan)**, `describe("container yard")` sobre `containerYard(out, accents, createRng(7))`:
  - `"19 stacks of 1..4 box containers in lanes 289/294/299"`: agrupar los prism `box*` de `2.4×6×2.6` por `(at.x, at.y)`: 19 grupos, cada uno de 1..4, `at.x ∈ YARD_LANES_X`, `at.y ∈ YARD_SLOTS_Y`.
  - `"RTG with four legs 10 tall"`: cuatro prism steel `1.2×1.2×7.8` cuyo `max.z` es `10.2` (z 0.2 + 10).
  - `"two straddle carriers on slots without a stack"`: dos prism `safety` `3×7×0.6`; el hueco bajo cada uno no tiene contenedores.
  - `"gatehouse with a window"`: prism concrete `3×3×2.8` y un accent `poly windowCool` con `alpha 0.85`.
  - `"nothing overlaps"`: por pares, ninguna intersección de cajas con interior > 1e-9 en x, y y z.
  - `"inside x 288..304, y 30..84 and under z 10.6"`.
  - `"the riprap leaves the yard slab"` (en `shipyard.test.ts`, "fitting-out quay"): ninguna `cone rock` corta `YARD`; rocas `> 20`.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3:** implementar `containerYard`, `RIPRAP_KEEP_OUT` y el salto en `fittingOut()`; `shipyardEast` llama `containerYard(out, accents, rng)`.
- [ ] **Step 4:** `npx vitest run src/scenes/shipyard-east.test.ts src/scenes/shipyard.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#323): container yard`.

### Task 3: Grúas de muelle

**Files:** Modify `shipyard-east.ts`, `shipyard-east.test.ts`.

**Interfaces:**
- Consumes: `quayCraneAt` (industrial.ts), `RIPRAP_KEEP_OUT` (Task 2).
- Produces: `export const QUAY_CRANES = [{ x: 284, y: 34 }, { x: 284, y: 62 }] as const`; `export const CRANE_RAILS = { x: [281, 287], y0: 31, y1: 82 } as const`; `export function quayCranes(out: Solid[], accents: Accent[]): void`; `RIPRAP_KEEP_OUT` suma las huellas de patas de cada grúa (`x 280.6..287.4`, `y at.y − 3.4..at.y + 3.4`).

- [ ] **Step 1: tests (fallan)**, `describe("quay cranes")`:
  - `"two gantries with a cyan light at the west tip"`: dos `dot cyan` de `quayCranes` con `at.x < 280`.
  - `"rails from y 31 to 82 under the legs"`: dos `strip rail` de ancho 0.5 con `path` `x 281` y `x 287`, `y 31..82`.
  - `"no crane leg touches a riprap rock"`: con `shipyard(createRng(7))`, las patas (prism steel `0.8×0.8×9.2`) no cortan ninguna `cone rock`.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3:** implementar; `shipyardEast` llama `quayCranes`.
- [ ] **Step 4:** correr → PASS.
- [ ] **Step 5:** commit `feat(#323): quay cranes`.

### Task 4: Galpones de alistamiento en chapa

**Files:** Modify `shipyard-east.ts`, `shipyard.ts`, `src/kit/forms/industrial.ts`, tests.

**Interfaces:**
- Consumes: `ribs` (`src/iso/plate.ts`), `shadeTone` (`src/iso/light.ts`), `door` (exportada ahora desde industrial.ts, firma sin cambios: `door(wall, len, width, z0, h, mat): Plate`).
- Produces: `export function fittingOutSheds(out: Solid[]): void`.

Piezas: `prism(x, 24, 0, 8, 56, 6, "sheetTeal", { roof: "gable", roofMat: "sheetTeal" })` para `x 304` y `316`, con `plates`: `ribs(1, 56, 0, 6, shadeTone(v3(1,0,0)) === "lit", "sheetTeal")`, `ribs(2, 8, 0, 6, shadeTone(v3(0,1,0)) === "lit", "sheetTeal")` y `door(2, 8, 4, 0, 4, "sheetTeal")` (último). `fittingOut()` ya no los emite; el silo `(310, 86)` sigue en `shipyard.ts`.

- [ ] **Step 1: tests (fallan)**: en `shipyard.test.ts` "fitting-out quay" exige 2 gables `sheetTeal` con `at.x > 300`; en `shipyard-east.test.ts` `"sheds carry ribs on walls 1 and 2 and a door"`: placas con `toneOffset` en `wall 1` y `wall 2`, y una placa `rect` `toneOffset −2` en `wall 2`.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** correr → PASS.
- [ ] **Step 5:** commit `feat(#323): sheet-metal fitting-out sheds`.

### Task 5: Reglas transversales

**Files:** Modify `shipyard-east.test.ts`, `shipyard.test.ts`, `portfolio-accents.test.ts`, `world.test.ts`, `ships.test.ts`.

- [ ] **Step 1: tests:**
  - `shipyard-east.test.ts` `"nothing new hides the gantry crane, the dry dock or the factory chimneys"`: nuevos = todo lo que emiten `floatingDock`, `containerYard`, `quayCranes`, `fittingOutSheds` (no planos); protegidos = sólidos de `shipyard(createRng(7))` en la caja de la grúa pórtico (`x 150..153`, `max.z ≥ 24` o las patas), del dique seco (`DOCK` ± 2 en planta, incluye casco y compuerta) y de las chimeneas (`factory(createRng(7))`, cilindros dentro de `r + 1` de cada `STACKS`). Para cada par con `overlaps(screenBounds)` y `hullsOverlap(screenHull)`: `isBehind(protegida, nueva) === false`.
  - `ships.test.ts` `"no lane segment crosses the floating dock"`: ningún segmento de `LANE_OUT` ni `LANE_BACK` corta el rectángulo `FLOATING_DOCK` (test de segmento contra rectángulo: extremo dentro o cruce con alguno de los cuatro lados).
  - `shipyard.test.ts`: la regla de acentos fuera de la estación acepta dots cian y **un** `poly windowCool` (la garita); `"raised solids of the shipyard ≤ 900"`.
  - `portfolio-accents.test.ts` shipyard: `cyan 15 → 21`, `windowCool: 1` (decisión 7).
  - `world.test.ts`: la intersección Portfolio ∩ ciudad debe seguir siendo la lista exacta; si aparece un material nuevo se agrega con su motivo en el comentario.
- [ ] **Step 2:** `npm test` → todo PASS salvo lo que falte implementar; si la oclusión falla, mover la pieza nueva, no relajar el test.
- [ ] **Step 3:** commit `test(#323): cross-cutting rules`.

### Task 6: Storybook

**Files:** Modify `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts`, `src/english.test.ts`.

**Interfaces — Consumes:** `quayCraneAt`.

- [ ] **Step 1: tests (fallan):** `CATALOG.shipyard` = `[..., "estacion", "paso-a-nivel", "dique-flotante", "patio-contenedores"]`; piezas: suma `"grua-muelle": "portfolio"` ("the twelve pieces"); `EXHIBIT_IDS` suma `dique-flotante|patio-contenedores|grua-muelle`; test `"darsena ends at y 72"`.
- [ ] **Step 2:** correr `npx vitest run src/lab/exhibits.test.ts src/english.test.ts` → FAIL.
- [ ] **Step 3:** en `EXHIBITS`, después de `paso-a-nivel`: región `dique-flotante` `{ x0: 202, y0: 72, x1: 248, y1: 90 }`, región `patio-contenedores` `{ x0: 278, y0: 27, x1: 305, y1: 84 }`, pieza `grua-muelle` (`quayCraneAt({ x: 0, y: 0 }, "w", out, accents)`, `pad: "concrete"`), grupo `shipyard`. `darsena.box.y1 = 72`. `h` de las dos regiones nuevas y de `punta-norte` (que ahora recorta una grúa y pilas): el menor entero que pasa framing y neighbors, medido con `measure` de `exhibits.test.ts`; anotar el valor en el comentario como en `punta-norte`.
- [ ] **Step 4:** correr → PASS; luego `npm test` y `npm run typecheck` completos.
- [ ] **Step 5:** commit `feat(#323): storybook exhibits`.
