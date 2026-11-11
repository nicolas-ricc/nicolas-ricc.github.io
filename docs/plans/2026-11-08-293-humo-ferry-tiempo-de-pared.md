# Humo de la fábrica y lancha del ferry con tiempo de pared (#293): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un tick largo y el mismo tiempo troceado dejen el mismo estado en el humo de `factory-anim` y en la lancha de `sea-anim`.

**Architecture:** se aplica el patrón de #23/#125. En `createFactoryAnim` (`src/scenes/factory-anim.ts`) cada humo avanza por tiempo restante, como los papeles de `city-anim`, y se recicla las veces que haga falta dentro del tick. Sortea con su propio `Rng`, derivado al final de la construcción. En `createSeaAnim` (`src/scenes/sea-anim.ts`) la lancha gasta el tiempo del tick en un bucle de dos fases, pausa y tramo: lo que sobra de la pausa se gasta en avanzar, y lo que sobra al llegar a un extremo se descuenta de la pausa siguiente. Los dos `tick` ignoran un `dtMs` no finito.

**Tech Stack:** TypeScript, Vitest. Los dos archivos son lógica pura, sin Pixi.

**Spec:** issue #293 y su Agent Brief (comentario de triage).

## Global Constraints

- Criterio 1: `puffs(k)` tras `[60000]` es igual (`toBeCloseTo`) a tras 600 × 100 ms y a tras un troceo irregular de la misma suma. Ningún humo pasa la distancia `PUFF_RANGE`.
- Criterio 2: la posición y el rumbo de `ferry()` tras `[5000]`, `[60000]` y `[600000]` coinciden con sus troceos en 100 ms.
- Criterio 3: `tick(NaN)` y `tick(Infinity)` no cambian nada ni cuelgan, en los dos animadores.
- Criterio 4: los tests actuales de `factory-anim.test.ts` y `sea-anim.test.ts` siguen en verde. Si un snapshot cambia por los streams nuevos, el PR lo explica.
- Criterio 5: `npm test` y `npm run typecheck` en verde.
- Guarda: `opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0`, igual que `city-anim.ts:122`.
- Semilla derivada: `createRng(rng.int(0, SEED_MAX))` con `const SEED_MAX = 2 ** 32 - 1;` local al archivo y el comentario de `city-anim.ts:37` (sin literal `0x…`, por la guarda de paleta).
- No cambia ninguna constante (`PUFF_*`, `FERRY_SPEED`, `FERRY_PAUSE_MS`, `FERRY_ROUTE`) ni ninguna interfaz exportada. Los comentarios del código van en inglés y los nombres de los tests, en inglés, como en los dos archivos de test actuales. Commits `test(#293): …` / `fix(#293): …`.
- Fuera de alcance: los barcos de `SHIPS`, la rueda del excavador, las boyas, el haz y el neón del faro, y los temporizadores de `city-anim` (#192).

## Decisiones técnicas (declaradas)

1. **Streams del humo.** `fresh` pasa a recibir el `Rng`: `fresh(r: Rng): Puff`. La construcción inicial sigue sorteando del `rng` compartido, en el mismo orden, así que el frame 0 queda idéntico. Después, en último lugar, se crea `const puffRngs = all.map((ps) => ps.map(() => createRng(rng.int(0, SEED_MAX))));`, un stream por humo. El reciclado sortea de `puffRngs[k][i]`. La fábrica recibe `createRng(SEED + 4)` propio (`src/world/assemble.ts:29`), así que estos sorteos extra no corren los de ningún otro animador. No hay snapshots de humo (`find src -name '*.snap'` solo da `src/iso/__snapshots__/solids.test.ts.snap`, que no usa animadores).
2. **Bucle del humo.** El mismo bucle que los papeles de `city-anim.ts:132-139`: `v = PUFF_SPEED * p.speed`, `toEnd = (PUFF_RANGE - p.dist) / v`. Si `toEnd > left`, avanza `v * left` y termina. Si no, resta `toEnd`, recicla con `Object.assign(p, fresh(puffRngs[k][i]))` (que deja `dist: 0`) y repite. Al salir, `dist < PUFF_RANGE`. Si el tick cae justo en el borde (`toEnd === left`), el humo se recicla y queda en la boca con `dist 0`, que ya tiene su caso en `puffAt` (`side = 0`).
3. **El vaivén lateral** depende de `clock` y de `p.phase`. `clock` es una suma de `dtMs` y ya no depende del troceo (con dt enteros es exacta). No cambia.
4. **Bucle del ferry.** Con `let left = dtMs`, mientras `left > 0`:
   - si `ferryPause > 0`: `used = Math.min(ferryPause, left)`, resta `used` de los dos y sigue;
   - si no: `toEnd = ((ferryDir > 0 ? ferryLen - ferryDist : ferryDist) / FERRY_SPEED) * 1000` ms. Si `toEnd > left`, avanza `ferryDir * FERRY_SPEED * left / 1000` y termina. Si no, resta `toEnd`, fija `ferryDist` en el extremo (`ferryLen` o `0`), invierte `ferryDir` y pone `ferryPause = FERRY_PAUSE_MS`.
   - `c.ferry = true` en cada iteración de la rama de tramo, igual que hoy: con la lancha en pausa todo el tick no se marca.
   La pausa nunca queda negativa. Con un tick que termina justo al acabar la pausa (`ferryPause === 0`), la lancha arranca en el tick siguiente, igual que con el tiempo continuo.
5. **Cambio de semántica visible.** Hoy `tick(FERRY_PAUSE_MS + 100)` deja la lancha quieta en el muelle; ahora la deja a 0,3 u. El test "fair launch" de `sea-anim.test.ts` solo pide que llegue a los dos muelles y no se meta detrás de sólidos, así que sigue valiendo sin cambios.
6. **NaN/Infinity.** La guarda va antes de `first = false` en `sea-anim`, así que un `tick(NaN)` tampoco consume el "primer tick marca todo".
7. **Igualdad en coma flotante.** Las comparaciones usan `toBeCloseTo(x, 6)` sobre coordenadas y rumbo. Los troceos son de dt enteros. No se compensa la deriva fina: la distancia de cada humo es una suma de unos pocos cientos de términos y el error es del orden de 1e-12.

## Review Focus

1. Tick muy largo, `tick(600000)`, en los dos animadores (el lab multiplica `deltaMS` por `?speed=`): termina y coincide con su troceo. En el humo, cada uno se recicla ~40 veces dentro del tick. Tests en las Tasks 1 y 2 (`[600000]`; para el humo, la invariante `dist < PUFF_RANGE` tras `tick(600000)`).
2. Tick que termina en mitad de la pausa y otro que la cruza: `tick(FERRY_PAUSE_MS - 100)` y luego `tick(1100)` dejan la lancha a `FERRY_SPEED · 1 s` del muelle de salida, y ese segundo tick marca `ferry: true`. Test en la Task 2.
3. Tick que cruza un extremo: el sobrante se descuenta de la pausa siguiente. La lancha sigue en el extremo, con el rumbo invertido, hasta que se agota la pausa. Lo cubre el troceo `[60000]` (L ≈ 179 u, ~60 s por tramo), y además hay un test explícito en la Task 2: tras llegar, un tick de `FERRY_PAUSE_MS - 1` no la mueve y marca `ferry: false`.
4. `tick(NaN)` o `tick(Infinity)` después de algunos ticks normales y también como primer tick: no cambia `puffs`/`ferry`/`beam`/`state`, devuelve todo en `false` y no consume el marcado del primer tick. Tests en las Tasks 1 y 2.
5. Reduced motion: sin cambios (ya cubierto por los tests actuales de los dos archivos).

---

### Task 1: humo de la fábrica

**Files:**
- Modify: `src/scenes/factory-anim.ts` (import de `createRng`, `SEED_MAX`, `fresh`, construcción, `tick`)
- Test: `src/scenes/factory-anim.test.ts`

**Interfaces:**
- Consumes: `createFactoryAnim(stacks, rng, opts)`, `createRng(seed)` de `../map/seed`.
- Produces: nada nuevo; `FactoryAnim` no cambia.

- [ ] **Step 1: tests que fallan** (se escriben en la etapa de evals). Dentro de un `describe("smoke tick chunking", …)`, con un helper `run(chunks: number[])` que crea `createFactoryAnim(stacks, createRng(1), { reducedMotion: false })`, aplica los ticks y devuelve el animador, y un helper `chop(total, pattern)` que repite `pattern` y cierra con el resto para sumar `total` exacto:
  - `"one 60 s tick leaves the puffs where 600 × 100 ms and an irregular chunking do"`: para `k` en `[0, 1]` y cada puff, `at.x`, `at.y`, `at.z` y `r` de `run([60000])` son `toBeCloseTo(…, 6)` a los de `run(Array(600).fill(100))` y a los de `run(chop(60000, [16, 33, 100, 250, 1000, 5000, 7000, 33]))`.
  - `"no puff goes past PUFF_RANGE, even after one 600 s tick"`: tras `tick(60000)` y, en otra instancia, `tick(600000)`, para cada puff de los dos stacks, su radio `r` es < `PUFF_R1`. `r` es función solo de `dist` (`factory-anim.ts:34,37`: `t = p.dist / PUFF_RANGE`, `r = PUFF_R0 + (PUFF_R1 - PUFF_R0) * t`), así que `r < PUFF_R1` ⇔ `dist < PUFF_RANGE`. `NNE` no se exporta y el test no lo usa.
  - `"tick(NaN) and tick(Infinity) change nothing"`: tras `tick(1234)`, se guarda `JSON.stringify([a.puffs(0), a.puffs(1), a.angle()])`; `a.tick(NaN)` y `a.tick(Infinity)` devuelven `{ smoke: false, wheel: false }` y el snapshot sigue idéntico; un `tick(100)` posterior sigue devolviendo `smoke: true`.
- [ ] **Step 2:** `npx vitest run src/scenes/factory-anim.test.ts`. Debe dar FAIL en los dos primeros tests (el tick largo recicla una sola vez y deja humos a ~120 u). El de NaN/Infinity también falla o cuelga: `Infinity` deja `dist` en `Infinity`. Si cuelga, el test lleva `{ timeout: 2000 }`.
- [ ] **Step 3: implementar** las decisiones 1 y 2 y la guarda en `src/scenes/factory-anim.ts`. Comentario corto junto a `puffRngs`: "one per puff, last: recycling does not depend on the chunking" (como `city-anim.ts:78`).
- [ ] **Step 4:** `npx vitest run src/scenes/factory-anim.test.ts src/scenes/excavator.test.ts src/scenes/animators.test.ts src/lab/exhibits.test.ts` en PASS (los otros llamadores de `createFactoryAnim`/`factoryAnimator`), después `npm test` y `npm run typecheck`.
- [ ] **Step 5: commit** `fix(#293): factory smoke by remaining time, one Rng per puff`.

### Task 2: lancha del ferry

**Files:**
- Modify: `src/scenes/sea-anim.ts` (guarda y bloque del ferry dentro de `tick`, líneas ~187 y ~202-207)
- Test: `src/scenes/sea-anim.test.ts`

**Interfaces:**
- Consumes: `createSeaAnim(scene, opts)` y el helper `setup()` existente del test; `FERRY_ROUTE`, `FERRY_SPEED`, `FERRY_PAUSE_MS`.
- Produces: nada nuevo; `SeaAnim` no cambia.

- [ ] **Step 1: tests que fallan** (en la etapa de evals). Dentro de `describe("fair launch tick chunking", …)`, con un helper `hullOf(f: ShipFrame)` que devuelve `{ x, y, heading }` del sólido `kind: "hull"` (el rumbo viaja en `hull.heading`):
  - `"position and heading after one tick match the 100 ms chunking"`: para `T` en `[5000, 60000, 600000]`, `hullOf(a.ferry())` tras `a.tick(T)` y tras `T / 100` ticks de 100 en otra instancia tienen `x`, `y` y `heading` `toBeCloseTo(…, 6)`.
  - `"the leftover of the pause is spent moving"`: `tick(FERRY_PAUSE_MS - 100)` y luego `tick(1100)` (la lancha arranca con `ferryPause = FERRY_PAUSE_MS`, `sea-anim.ts:139`): el casco está a `toBeCloseTo(FERRY_SPEED, 6)` u de `FERRY_ROUTE[0]` y el segundo tick devuelve `ferry: true`.
  - `"the leftover at an end comes off the next pause"`: con `L` = longitud de `polyline(FERRY_ROUTE)` y `tArrive = FERRY_PAUSE_MS + (L / FERRY_SPEED) * 1000`, `tick(tArrive + 500)` deja el casco en el último punto de `FERRY_ROUTE` (`toBeCloseTo(…, 6)`); luego `tick(FERRY_PAUSE_MS - 501)` devuelve `ferry: false` y no lo mueve; y otro `tick(1001)` lo deja a `toBeCloseTo(FERRY_SPEED, 6)` u del extremo, de vuelta.
  - `"a non-finite first tick does not use up the first-tick marking"`: en una instancia nueva, `tick(NaN)` devuelve todo en `false` y el `tick(100)` siguiente devuelve `buoys: true`, `neon: true`, `ferry: true` (el "primer tick marca todo", `sea-anim.ts:188-192`).
  - `"tick(NaN) and tick(Infinity) change nothing"`: tras `tick(4500)`, se guarda `JSON.stringify([a.ferry(), a.beam(), a.buoys(), a.neon(), [0, 1, 2].map(a.state)])`; `tick(NaN)` y `tick(Infinity)` devuelven `{ ships: [false, false, false], beam: false, buoys: false, ferry: false, neon: false }` y el snapshot sigue idéntico.
- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts`: FAIL en los troceos (la pausa descarta lo que sobra) y en el de NaN/Infinity (`clock` se vuelve NaN).
- [ ] **Step 3: implementar** la decisión 4 y la guarda en `src/scenes/sea-anim.ts`. El comentario del bloque dice que el tiempo que sobra de la pausa y del tramo pasa a la fase siguiente dentro del mismo tick.
- [ ] **Step 4:** `npx vitest run src/scenes/sea-anim.test.ts src/scenes/sea-animator.test.ts` en PASS, después `npm test` y `npm run typecheck`.
- [ ] **Step 5: commit** `fix(#293): ferry pause and route by remaining time`.

## Assumptions

- **`SEED_MAX` local.** Se declara en el archivo, como ya hacen `city-anim.ts:37`, `tech-anim.ts:27` y `shipyard-anim.ts:19`. Alternativa rechazada: exportarlo de `map/seed.ts`, que sería un refactor de tres archivos fuera del diff.
- **La guarda corta todo el `tick` de `sea-anim`**, no solo el ferry: barcos, haz, boyas y neón tampoco avanzan con `NaN`/`Infinity`, porque el issue pide "`tick(NaN)` y `tick(Infinity)` no cambian nada". La forma del retorno es la de hoy con `dtMs <= 0` (`sea-anim.ts:187`). Alternativa rechazada: proteger solo el bucle del ferry y dejar que `clock` se vuelva NaN.
- **Terminación.** `fresh` da `speed ∈ [0.8, 1.2)` (`factory-anim.ts:28`, con `next() ∈ [0, 1)` según `map/seed.ts:13-19`), así que `toEnd > 0` y cada vuelta recicla o termina. Para el ferry, `ferryLen = polyline(FERRY_ROUTE).length` ≈ 179 u > 0 y `FERRY_PAUSE_MS = 4000` (`sea-anim.ts:74-75`, constantes del módulo). No se protege `ferryLen === 0` ni una pausa de 0: no son estados alcanzables.
- **Sin chequeo en el lab.** La verificación es por tests unitarios. El time-lapse de CLAUDE.md no lo pide el issue y la lógica es pura, sin Pixi.

## Grilling

- Rondas: 1, con 15 preguntas. El plan solo cambió en detalles de los tests y en los comandos de verificación, sin pasos nuevos ni otra costura, así que no hubo segunda ronda.
- Fuentes: CODE 13, ISSUE 3 (Q5, Q15 y el criterio de NaN), DOC 0. Q13 y Q15b quedaron como NO SOURCE, en el bucket de supuesto técnico.
- Supuestos: los de la sección anterior.
- Ambigüedades de spec: ninguna. Issues abiertos: ninguno.
- Cambios al plan: `FERRY_PAUSE_MS - 100` en lugar de 3900; el test del radio ya no depende de `NNE`; test del primer tick no finito; `exhibits.test.ts` y la suite completa en la Task 1.
