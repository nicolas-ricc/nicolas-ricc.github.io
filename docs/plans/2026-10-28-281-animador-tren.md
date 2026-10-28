# Animador del tren: ciclo entrada-espera-salida, luces, paso a nivel, semáforos, reducedMotion y exhibit tren (#281) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un EMU de 4 coches entre por la vía del oeste desde el borde del sangrado, frene con el frente en `STOP_X`, espere 30 s y salga invirtiendo las luces, con el paso a nivel titilando y los semáforos de entrada y salida, sin Pixi y al reloj de pared; y exhibirlo en el storybook (`tren`, `estacion`, `paso-a-nivel`).

**Architecture:** `src/scenes/rail-anim.ts` es puro: constantes, `trainStateAt(ms)`, `crossingActive`, `signalAspects` y `createRailAnim({ reducedMotion })`, con un reloj acumulado en `tick` que detecta cambios por capa (modelo: `sea-anim.ts`). `src/scenes/rail-animator.ts` lo adapta al contrato `Animator` (capas `rail.*`) y además exporta `trainPieceAnimator` para el storybook. `assemble.ts` lo arma con zona `portfolio` cuando hay `scene.shipyard`. `Exhibit` de pieza gana `animate?` y `storybook.ts` lo etiqueta con `tag` (que pasa a exportarse).

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (solo en `storybook.ts`; nada de Pixi en `src/scenes/`).

**Spec:** issue #281, el texto entero; `docs/superpowers/specs/2026-10-27-estacion-terminal-design.md` §6.2, §6.3, §7 y §8; decisiones 2, 5, 7 y 8 del plan de la historia, en el comentario de #239.

## Global Constraints

- Rama base `feature/239-estacion-tigre`; el PR va contra esa rama.
- Constantes literales del issue: `ENTRY_X = WEST_RAIL_X0` (−402), `LINE_SPEED = 24` (u/s), `BRAKE_U = 60`, `DWELL_MS = 30000`, `OFF_MS = 20000`, `FADE_U = 30`, `BLINK_MS = 500`, `CROSSING_NEAR_U = 30`, `PRE_DEPART_MS = 5000`, `TRACK_Y = TRACKS_Y[2]` (132.5) y `LEN = trainLen(4)` (46.8).
- No se mueven `STOP_X` (158), `BUFFER_X` (160), `TRACKS_Y`, `SIGNALS`, `CROSSING`, `STREET_EDGE` (108) ni la caja del tren (y ± 1.7, z ≤ 5.7).
- Puro y sin Pixi en `src/scenes/`. Sin `setTimeout`/`setInterval`/`Date`/`performance`: el tiempo es el `dtMs` acumulado en `tick` (#192). Sin rng: nada es aleatorio.
- Acentos solo de la paleta: `cyan` (faros), `magenta` (rojas, paso a nivel, semáforo rojo), `cyanMid` (semáforo verde), `amber`. Nada de hex fuera de `palette-base.ts` y `palette-iso.ts` (guarda de paleta).
- Comentarios y docstrings en castellano rioplatense, con la densidad de `sea-anim.ts` y `train.ts`.
- Al final de cada tarea: sus tests y `npm run typecheck` en verde. Al final de la Task 4: `npm test` entero en verde.

## Review Focus

1. **Bordes de fase.** `trainStateAt` en `IN_MS`, `IN_MS + DWELL_MS`, `IN_MS + DWELL_MS + OUT_MS` y `CYCLE_MS − 1`: sin saltos de x0 entre fases (continuidad a 1e-6) y la fase nueva empieza exactamente en el borde. Test "continuidad en los bordes de fase" en la Task 1.
2. **`dtMs` grande o cero.** Con un `tick(CYCLE_MS * 3 + 1234)` el reloj da la vuelta con módulo y el estado coincide con `trainStateAt(1234)`. Con `tick(0)` (o negativo) no hay cambios ni avanza nada, salvo que ya se haya hecho el primer tick. Test en la Task 2.
3. **`reducedMotion` desde el primer tick.** `tick` devuelve vacío también en la primera llamada: `assemble.test.ts` exige 0 redibujos. Test en las Tasks 2 y 3.
4. **Recorte del storybook en el estado inicial.** `cropAnimators` descarta el animador que no tiene nada en la caja en su estado inicial. En `ms = 0` el tren está en x0 −448.8 y el paso a nivel está apagado, así que en `paso-a-nivel` (x 98..112) solo puede quedar algo si entra un semáforo. Ver A3. Test "recorta rail.*" en la Task 4.
5. **Luces de la pieza `tren` sin doble dibujo.** Si `build` empujara también las luces de `emu`, faros y rojas quedarían fijos debajo de los animados y la inversión no se vería. Ver A4. Test en la Task 4.

## Assumptions

- **A1. Cinemática.** Crucero de 24 u/s desde el frente en −402 hasta 98 (`STOP_X − BRAKE_U`): 500 u en 20 833.3 ms. Frenado uniforme con `a = 24²/120 = 4.8 u/s²` en 5000 ms. `IN_MS = 25 833.3`. La salida es simétrica: la cola arranca en 158, acelera 60 u en 5000 ms y hace crucero 500 u hasta que la cola llega a −402. `OUT_MS = 25 833.3`. `CYCLE_MS = 101 666.7` (≈ 102 s; el issue dice "≈ 104 s" como aproximación, y el número sale de las constantes, que son literales).
- **A2. Luces del paso a nivel.** En cada poste (`CROSSING.north`, `CROSSING.south`), dos posiciones: `(p.x + 0.15, p.y + 0.15 ± 0.5, p.h − 0.4)`. `crossing()` devuelve solo la encendida de cada poste: `flip(step, −0.5, +0.5)`, con `step = floor(cicloMs / BLINK_MS)`. Así "nunca están las dos encendidas". Activo: 2 dots; inactivo: `[]`.
- **A3. Caja de `paso-a-nivel`.** Pasa de `x0: 98` a `x0: 95`, para que el semáforo de entrada (poste en x 96.1..96.4, cabeza 96..96.5) quede adentro. Sin eso, `cropAnimators` descarta el animador del tren en `ms = 0` y el exhibit no anima nunca. `h` se vuelve a medir con `measure` (el tope es el farol a z 5; el semáforo llega a 4.7). El comentario de la caja se actualiza.
- **A4. Pieza `tren`.** `build` empuja solo los sólidos de `emu(−LEN/2, 0, { cars: 4, lead: "e", lit: true })`. Las luces (salón, cartel, faros y rojas) las da entera la capa `tren.lights` de `trainPieceAnimator`. Sin animador (tests de pieza), la pieza no tiene acentos.
- **A5. `tag`** se exporta desde `src/world/assemble.ts` para que `storybook.ts` etiquete el animador de la pieza con la zona del exhibit.
- **A6. Semáforos.** Un dot por semáforo en `(s.x + 0.25, s.y + 0.25)`, el centro del poste: rojo `magenta` r 0.4 a z 4.4, verde `cyanMid` r 0.4 a z 3.9. Orden: `[in, out]`.
- **A7. Capa `rail.train` en `off`.** Sigue emitiendo los sólidos en el x0 final de `out` con `alpha 0`. No hay cambio de `x0`/`lead`/`alpha` durante `off`, así que no redibuja.
- **A8. Capturas** `tren.png`, `paso-a-nivel.png` y `tren-llegando.png` en `docs/superpowers/specs/assets/2026-10-27-estacion/`, a 3200×1800 (viewport 1600×900, escala 2). Las toma el orquestador al final de stage 4 con agent-browser. Para el paso a nivel con el tren cerca se usa el método del CLAUDE.md: avanzar el ticker con `deltaMS` fijo. No es tarea de un implementador.

## Tests de stage 3

Los escribe el orquestador antes de la Task 1, en rojo: `src/scenes/rail-anim.test.ts`, `src/scenes/rail-animator.test.ts`, los cambios de `assemble.test.ts`, `animators.test.ts` y `exhibits.test.ts`. Los implementadores no los debilitan. Si uno está mal, lo reportan.

---

### Task 1: estado puro del ciclo (`trainStateAt`, `crossingActive`, `signalAspects`)

**Files:**
- Create: `src/scenes/rail-anim.ts`
- Test: `src/scenes/rail-anim.test.ts` (bloques "ciclo", "invariantes", "paso a nivel: activo", "semáforos")

**Interfaces:**
- Consumes: `WEST_RAIL_X0` (`hinterland.ts`), `STOP_X`, `BUFFER_X`, `TRACKS_Y`, `SIGNALS`, `CROSSING` (`station.ts`), `STREET_EDGE` (`shipyard.ts`), `trainLen` (`train.ts`).
- Produces: las constantes de Global Constraints más `IN_MS`, `OUT_MS`, `CYCLE_MS`; `type Phase = "in" | "dwell" | "out" | "off"`; `interface TrainState { phase: Phase; x0: number; lead: "e" | "w"; alpha: number }`; `trainStateAt(ms: number): TrainState`; `phaseStart(phase: Phase): number` (ms del ciclo en que arranca la fase; lo usan `createRailAnim` y los tests para `msInPhase`); `crossingActive(s: TrainState, msInPhase: number): boolean`; `signalAspects(s: TrainState, msInPhase: number): { in: Aspect; out: Aspect }` con `type Aspect = "red" | "green"`.

- [ ] **Step 1:** Tests de stage 3 (ya escritos):
  - "ciclo": `trainStateAt(0)` con `x0 + LEN === ENTRY_X` y `alpha 0`; `trainStateAt(IN_MS)` con `phase "dwell"`, `x0 + LEN` a 1e-6 de `STOP_X` y `alpha 1`; muestras de la espera en `STOP_X − LEN` con `lead "e"`; `trainStateAt(phaseStart("off") − 1e-6)` con `x0 + LEN ≤ ENTRY_X + 1e-6` y `alpha 0`; en `off`, `alpha 0`; `trainStateAt(CYCLE_MS − 1).phase === "off"`; `lead` es `"e"` en `in` y `"w"` en `out`; `IN_MS ≈ 25833.33`, `CYCLE_MS ≈ 101666.67`.
  - "continuidad en los bordes de fase" (Review Focus 1).
  - "invariantes" cada 250 ms: `x0 + LEN ≤ BUFFER_X`; `alpha` en [0, 1]; `alpha` monótono no decreciente mientras el frente avanza los primeros `FADE_U` u y no creciente mientras la cola recorre los últimos `FADE_U` u.
  - "paso a nivel: activo": inactivo en `ms = 0` y a mitad de la espera; activo en `dwell` con `msInPhase = DWELL_MS − PRE_DEPART_MS`; activo en `in` cuando el frente pasa x 70 y en `out` mientras la formación corta [70, 138]; inactivo en `out` cuando la cola pasa por debajo de 70.
  - "semáforos": entrada verde en `ms = 0` y roja apenas el frente pasa 96; salida roja al principio de la espera y verde desde `DWELL_MS − PRE_DEPART_MS`; en `out`, verde mientras `x0 + LEN ≥ 108` y roja cuando la cola pasa por debajo de 108; en `off`, los dos rojos.
- [ ] **Step 2:** `npx vitest run src/scenes/rail-anim.test.ts` → FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar en `rail-anim.ts`. Cinemática de A1, por tramos con fórmulas cerradas (sin integrar). `alpha = clamp((x0 + LEN − ENTRY_X) / FADE_U, 0, 1)`. `crossingActive` corta `[x0, x0 + LEN]` contra `[CROSSING.x0 − CROSSING_NEAR_U, CROSSING.x1 + CROSSING_NEAR_U]`. El docstring del módulo explica el ciclo y anota el desvío de §7 (el paso a nivel no titila durante la espera salvo los últimos 5 s).
- [ ] **Step 4:** `npx vitest run src/scenes/rail-anim.test.ts -t "ciclo|continuidad|invariantes|activo|semáforos"` → PASS; `npm run typecheck` → limpio.
- [ ] **Step 5:** Commit `feat(#281): ciclo puro del tren: trainStateAt, paso a nivel y semáforos`.

### Task 2: `createRailAnim`: frames, parpadeo, reducedMotion y detección de cambios

**Files:**
- Modify: `src/scenes/rail-anim.ts`
- Test: `src/scenes/rail-anim.test.ts` (bloques "luces", "parpadeo", "tick", "reducedMotion", "tope de caras", "oclusión con posiciones reales")

**Interfaces:**
- Consumes: Task 1; `emu`, `trainBox` (`train.ts`); `flip` (`neon.ts`).
- Produces: `interface RailChanges { train: boolean; crossing: boolean; signals: boolean }`; `interface RailAnim { train(): { solids: Solid[]; lights: Accent[]; alpha: number }; crossing(): Accent[]; signals(): Accent[]; state(): TrainState; tick(dtMs: number): RailChanges }`; `createRailAnim(opts: { reducedMotion: boolean }): RailAnim`.

- [ ] **Step 1:** Tests de stage 3 (ya escritos):
  - "luces": tras avanzar a un instante de `in`, los dots `cyan` de `train().lights` tienen x mayor que todo sólido (punta este) y los `magenta` x menor; en `out`, al revés; los dos `amber` están uno en cada punta.
  - "parpadeo": con el paso a nivel activo, `crossing()` da 2 dots `magenta` r 0.45, uno por poste, a z `h − 0.4`; tras `BLINK_MS` cada dot cambia de y por 1 (y la x queda igual). Inactivo, `[]`.
  - "semáforos (acentos)": dot `magenta` a z 4.4 si es rojo y `cyanMid` a z 3.9 si es verde, en `(s.x + 0.25, s.y + 0.25)`.
  - "tick": el primer tick marca los tres; a mitad de `dwell` (no en los últimos 5 s) un tick de 100 ms no marca nada; en `in`, `train` marca en cada tick; `crossing` marca al cambiar el paso de parpadeo; `tick(CYCLE_MS * 3 + 1234)` deja `state()` igual a `trainStateAt(1234)` (Review Focus 2); `tick(0)` después del primero no marca.
  - "reducedMotion": `tick` vacío también en la primera llamada; `state()` es `{ phase: "dwell", x0: STOP_X − LEN, lead: "e", alpha: 1 }`; `train().lights` trae `cyanBleed` (salón encendido); `crossing()` es `[]`; `signals()` da dos `magenta`.
  - "invariantes de sólidos": en muestras de 250 ms, cada sólido de `train().solids` cae en y 130.8..134.2 y z 0..5.7.
  - "tope de caras": `train().solids` tesela en ≤ 600 caras en 20 muestras repartidas en el ciclo.
  - "oclusión con posiciones reales": para cada muestra de 500 ms con `alpha > 0`, `trainBox(x0, TRACK_Y, 4)` contra `world(7).solids` de alto > 0.4 (`screenBounds`/`overlaps`, `screenHull`/`hullsIntersect`, `isBehind` de `depth.ts`): nada delante.
- [ ] **Step 2:** `npx vitest run src/scenes/rail-anim.test.ts` → FAIL (`createRailAnim` no existe).
- [ ] **Step 3:** Implementar `createRailAnim`. Hay un reloj de ciclo `ms` (módulo `CYCLE_MS`). `tick` vale `!reducedMotion && dtMs > 0`; el primero marca todo. `train` marca si cambian `x0`, `lead` o `alpha`; `crossing`, si cambian el activo o (estando activo) el paso `floor(ms / BLINK_MS)`; `signals`, si cambia un aspecto. `train()` arma `emu(x0, TRACK_Y, { cars: 4, lead, lit: true })` y lo memoriza por estado (mismo x0/lead → mismo objeto). Las luces del paso a nivel siguen A2; las de los semáforos, A6.
- [ ] **Step 4:** `npx vitest run src/scenes/rail-anim.test.ts` → PASS; `npm run typecheck` → limpio.
- [ ] **Step 5:** Commit `feat(#281): createRailAnim: frames, parpadeo, reducedMotion y cambios por capa`.

### Task 3: adaptador `railAnimator` y armado en el mundo

**Files:**
- Create: `src/scenes/rail-animator.ts`
- Modify: `src/world/assemble.ts` (armar el animador; `export const tag`)
- Modify: `src/world/assemble.test.ts`, `src/scenes/animators.test.ts` (stage 3)
- Test: `src/scenes/rail-animator.test.ts`

**Interfaces:**
- Consumes: `createRailAnim` (Task 2), `layerLookup` (`animator.ts`).
- Produces: `railAnimator(opts: { reducedMotion: boolean }): Animator` con `ids` `["rail.train", "rail.lights", "rail.crossing", "rail.signals"]`. `rail.train` es `{ kind: "solid", solids, alpha }`; `rail.lights` es `{ kind: "accent", accents: lights, alpha, zone: "portfolio" }`; `rail.crossing` y `rail.signals` son `{ kind: "accent", accents, zone: "portfolio" }`. `tick` marca `rail.train` y `rail.lights` juntos con `train`, `rail.crossing` con `crossing` y `rail.signals` con `signals`. `assemble.ts`: `export const tag`.

- [ ] **Step 1:** Tests de stage 3 (ya escritos):
  - `rail-animator.test.ts`: los ids; la capa desconocida lanza `Capa desconocida en railAnimator: x`; `rail.lights`, `rail.crossing` y `rail.signals` declaran `zone: "portfolio"`; `rail.train` y `rail.lights` llevan el mismo `alpha`; el primer tick marca los cuatro ids; a mitad de la espera no marca nada.
  - `assemble.test.ts`: 4 de Portfolio en el mundo entero; 3 con `["portfolio"]`; test nuevo: las tres capas de luces `rail.*` declaran `zone: "portfolio"`.
  - `animators.test.ts`: `["railAnimator", () => railAnimator(opts)]`.
- [ ] **Step 2:** `npx vitest run src/scenes/rail-animator.test.ts src/world/assemble.test.ts src/scenes/animators.test.ts` → FAIL.
- [ ] **Step 3:** Implementar el adaptador como `sea-animator.ts`. En `assemble.ts`, después del astillero: `if (scene.shipyard) animators.push(tag(railAnimator({ reducedMotion }), "portfolio"));`, con un comentario de una línea (con el filtro `["portfolio"]` también: la cola sale del terreno por el oeste, es el lab). Exportar `tag`.
- [ ] **Step 4:** Mismo comando → PASS; `npm run typecheck` → limpio.
- [ ] **Step 5:** Commit `feat(#281): railAnimator y armado en assemble con zona portfolio`.

### Task 4: storybook: `Exhibit.animate`, pieza `tren`, `ANIMATED` y caja del paso a nivel

**Files:**
- Modify: `src/scenes/rail-animator.ts` (`trainPieceAnimator`, `PIECE_FLIP_MS`)
- Modify: `src/lab/exhibits.ts` (tipo `Exhibit`, exhibit `tren` después de `farol`, caja de `paso-a-nivel`)
- Modify: `src/lab/storybook.ts` (usa `animate`)
- Modify: `src/lab/exhibits.test.ts` (stage 3)

**Interfaces:**
- Consumes: `emu`, `trainLen` (`train.ts`); `flip` (`neon.ts`); `tag` (Task 3).
- Produces: `PIECE_FLIP_MS = 4000`; `trainPieceAnimator(opts: { reducedMotion: boolean }): Animator` con el id `"tren.lights"` (`accent`, `zone: "portfolio"`): las luces de `emu(−trainLen(4)/2, 0, { cars: 4, lead, lit: true })`, con `lead = flip(floor(clock / PIECE_FLIP_MS), "e", "w")`, fijo en `"e"` con `reducedMotion`. `tick` marca la capa en el primer tick y cuando cambia la punta. En `Exhibit` de pieza: `animate?: (opts: { reducedMotion: boolean }) => Animator`.

- [ ] **Step 1:** Tests de stage 3 (ya escritos), en `exhibits.test.ts`:
  - "las once piezas": suma `tren: "portfolio"`; `tren` va justo después de `farol`; `pad "paving"`.
  - "la pieza tren tesela en ≤ 600 caras" y no empuja acentos en `build` (A4).
  - "con animate, tras 4 s la capa cambia de punta": los dots `cyan` de `tren.lights` pasan de x > 0 a x < 0 tras `tick(4000)`; con `reducedMotion` siguen en x > 0 y `tick` no marca.
  - `ANIMATED` suma `estacion` y `paso-a-nivel`; test nuevo: en las dos cajas, `cropAnimators` deja un animador con `rail.train` entre sus ids.
  - `CATALOG` sin cambios de orden.
- [ ] **Step 2:** `npx vitest run src/lab/exhibits.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `trainPieceAnimator`, el campo `animate` y el exhibit `tren` (A4). En `storybook.ts`, guardar `reducedMotion` en una constante; en la rama de pieza, `src = [piece, e.animate ? [tag(e.animate({ reducedMotion }), e.zone)] : []]`. Caja de `paso-a-nivel`: `x0: 95` (A3) y comentario actualizado; volver a medir `h` de `estacion` y `paso-a-nivel` con los tests "encuadre" y "vecinos" de `exhibits.test.ts`. Si alguno falla, ajustar `h` al menor entero que pasa y anotar en el comentario de la caja qué lo fija.
- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts` → PASS; `npm run typecheck` → limpio; `npm test` → todo verde.
- [ ] **Step 5:** Commit `feat(#281): exhibit tren animado, Exhibit.animate y rail.* en estacion y paso-a-nivel`.

### Cierre del orquestador (stage 4, después de la Task 4)

- Dev server y el script `.scratch/evals-281.md` con agent-browser: `/lab/world.html?speed=4` con `1`, `/lab/storybook.html#tren`, `#paso-a-nivel` y `#estacion`.
- Capturas de A8, commiteadas en `docs/superpowers/specs/assets/2026-10-27-estacion/`.
