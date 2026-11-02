# tech-anim, shipyard-anim y papeles de city-anim con tiempo de pared (#125): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que los temporizadores de `tech-anim` y `shipyard-anim`, y el reciclado de los papeles de `city-anim`, dependan del tiempo acumulado y no de cómo se trocea en ticks: un tick largo da lo mismo que el mismo tiempo en ticks cortos.

**Architecture:** el patrón de #23 (`src/scenes/city-anim.ts`, plan `docs/plans/2026-10-18-23-city-anim-overshoot.md`): al vencer, el temporizador suma el intervalo nuevo al resto negativo y se itera con `while` mientras siga ≤ 0, de modo que un tick largo dispara varios eventos; cada flujo de eventos saca sus tiradas de un `Rng` propio derivado al construir con `createRng(rng.int(0, SEED_MAX))`, así el orden de los eventos de un flujo no mueve las tiradas de otro. Cada animador expone en `fired()` contadores de disparos para que los tests comparen troceos.

**Tech Stack:** TypeScript, Vitest. Los tres `*-anim.ts` son lógica pura, sin Pixi.

**Spec:** issue #125 (texto y comentario del dueño que suma #124). Criterio: "un tick largo da lo mismo que el mismo tiempo en ticks cortos".

## Global Constraints

- Fix de #23: "carries the overshoot in a `while` loop and gives each timer its own `Rng` (`createRng(rng.int(0, 0xffffffff))`)". En el código se escribe `SEED_MAX = 2 ** 32 - 1` (sin literal `0x…`: el guard de paleta lo tomaría por color), como en `city-anim.ts:28`.
- Equivalencia de troceo: con la misma semilla, `tick(60000)` y `600 × tick(100)` (y un troceo irregular de igual suma) dejan iguales los contadores de `fired()` y el estado visible (acentos) de cada capa tocada. Posiciones de papeles: iguales a `1e-6`.
- `tick` con `reducedMotion`, `dt ≤ 0`, `NaN` o `Infinity` no cambia nada ni cuenta disparos (los `while` colgarían con `Infinity`). `tech-anim` y `city-anim` ya lo hacen; `shipyard-anim` lo gana.
- Frame 0 no cambia: las tiradas de construcción que deciden el estado inicial (pisos encendidos de las torres, papeles escalonados, colores) quedan en el mismo orden.
- Fuera de alcance: `factory-anim`, `fair-anim`, `rail-anim`, `sea-anim`, `water-anim` (el issue nombra solo `tech-anim.ts:50-52`, `:63-64`, `shipyard-anim.ts:67-76` y, por el comentario del dueño, `city-anim.ts:110`). El humo de `factory-anim` y la pausa del ferry de `sea-anim` repiten el patrón: #293.
- `npm test` y `npm run typecheck` en verde.

## Assumptions

Decididas en la revisión del plan (stage 2), sin fuente escrita; cualquiera cumple el criterio del issue:

- `fired()` nuevo en `ShipyardAnim` y campos nuevos en `TechAnim`/`CityAnim`: seam de test, como hizo #23 con `CityAnim.fired()`. Alternativa descartada: comparar solo acentos (no distingue "disparó dos veces" de "ninguna").
- Papeles: al reciclar, el tiempo sobrante se recorre a la velocidad nueva (avance por tiempo). Alternativa descartada: `p.dist -= PAPER_RANGE` (arrastra el exceso a la velocidad vieja; un tick largo y uno troceado siguen dando posiciones distintas).
- Chispas: `burst()` se llama en cada cuadro aunque el tick largo lo saltee, para que las tiradas no dependan del troceo. Alternativa descartada: saltear los cuadros invisibles (más barato, pero el jitter final cambia según el troceo).
- `sparkRng` propio aunque `assemble.ts:25` ya le da a shipyard un `Rng` exclusivo: así el animador no depende de que el llamador no comparta su `rng`.
- Tolerancias de los tests: `1e-6` en posiciones de papeles (sumas en coma flotante en distinto orden); `0.8` = velocidad mínima de un papel (`0.8 + rng.next() * 0.4`, `city-anim.ts:54`; la cota inferior de reciclados usa la más lenta); `PAPER_RANGE + PAPER_SIDE` = alcance máximo en el plano.
- Sin cambios de README ni docs: no describen estos temporizadores; se actualizan los docstrings.

## Review Focus

1. Escena sin torres / sin coronas / sin cuadernas en un tick de 10 min: el `while` tiene que avanzar el temporizador igual y terminar. Tests: "sin torres un tick largo no se cuelga" (Task 1) y el troceo con `weldSpots` vacío no aplica (`rng.pick` de `[]` ya rompía antes; la escena siempre trae cuadernas, no se agrega rama).
2. Chispas: un tick largo que cae a mitad de un evento debe dejar en `sparks()` el mismo flicker que los ticks cortos (mismo cuadro, mismo jitter). Test de equivalencia de `sparks()` en Task 2.
3. Chispas con ticks cortos (100 ms) siguen durando tres cuadros y nunca más: el test existente "duran tres frames" queda en verde.
4. Papeles: un tick de 10 min recicla cada papel muchas veces y sus posiciones siguen dentro de `[0, PAPER_RANGE)`. Test en Task 3.
5. `dt` no finito en `shipyard-anim` no cuelga: test en Task 2.

---

### Task 1: tech-anim — ventanas y coronas con exceso arrastrado y Rng propio

**Files:**
- Modify: `src/scenes/tech-anim.ts` (temporizadores `blinkTimer`, `flipTimer`; `fired()`; docstring)
- Test: `src/scenes/tech-anim.test.ts`

**Interfaces:**
- Produces: `TechAnim.fired(): { homes: number; windows: number; crowns: number }`. `windows` = vencimientos del temporizador con al menos una torre (cada uno sortea una torre y la apaga con `chance(0.3)` o le cambia el piso; puede no verse si ya estaba apagada); `crowns` = cambios de color de corona (solo con coronas).

- [ ] **Step 1: tests que fallan** en un `describe("tech-anim: troceo (#125)")`:
  - `"un tick de 60 s deja lo mismo que 600 ticks de 100 ms"`: `a.tick(60000)`, `b` con 600×100; `expect(a.fired()).toEqual(b.fired())`, `expect(a.fired().windows).toBeGreaterThanOrEqual(60000 / TECH_BLINK_GAP_MS[1] - 1)`, `expect(a.fired().crowns).toBeGreaterThanOrEqual(60000 / CROWN_FLIP_GAP_MS[1] - 1)`, `expect(a.windows()).toEqual(b.windows())`, `expect(a.neon()).toEqual(b.neon())`.
  - `"un tick de 10 min dispara como 600 de 1 s"`: `fired()` iguales y `windows` entre `600000 / TECH_BLINK_GAP_MS[1] - 1` y `600000 / TECH_BLINK_GAP_MS[0]`.
  - `"un troceo irregular deja lo mismo que su suma"`: dts `[16, 33, 100, 250, 1000, 5000, 7000, 33, 12000]`; `fired()`, `windows()` y `neon()` iguales.
  - `"sin torres ni coronas un tick largo no se cuelga y no cuenta"`: con `sinTorres()`, `tick(600000)`; `fired().windows === 0`, `fired().crowns === 0`.
  - En el test existente de dt no válido, `fired()` queda `{ homes: 0, windows: 0, crowns: 0 }`.
- [ ] **Step 2:** `npx vitest run src/scenes/tech-anim.test.ts` → FAIL (`fired().windows` undefined / distintos).
- [ ] **Step 3: implementar.** `blinkRng` y `flipRng` = `createRng(rng.int(0, SEED_MAX))` en el lugar exacto donde hoy se sortean `blinkTimer` y `flipTimer` (una tirada de `rng` por otra: no cambian las tiradas de `lit` ni la semilla de `homesRng`). Toda tirada de esos eventos (torre, `chance(0.3)`, piso, corona) sale de su flujo. `blinkTimer -= dtMs; while (blinkTimer <= 0) { blinkTimer += nextGap(); … }`, igual para `flipTimer`; el temporizador avanza aunque no haya torres o coronas. Docstring: "los temporizadores cuentan tiempo de pared, un tick largo dispara varios".
- [ ] **Step 4:** `npx vitest run src/scenes/tech-anim.test.ts src/scenes/tech-animator.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#125): tech-anim con tiempo de pared`.

### Task 2: shipyard-anim — chispas con exceso arrastrado y Rng propio

**Files:**
- Modify: `src/scenes/shipyard-anim.ts`
- Test: `src/scenes/shipyard-anim.test.ts`

**Interfaces:**
- Produces: `ShipyardAnim.fired(): { sparks: number }` = eventos de soldadura arrancados (cada uno con sus tres cuadros).

- [ ] **Step 1: tests que fallan** en `describe("shipyard-anim: troceo (#125)")`:
  - `"un tick de 60 s deja lo mismo que 600 ticks de 100 ms"`: `fired()` iguales y `> 0`, `sparks()` iguales (`toEqual`), `scene.trolley.at.y` iguales (cada uno con su escena).
  - `"un troceo irregular deja lo mismo que su suma"`: dts `[16, 33, 100, 250, 1000, 5000, 7000, 33, 1234]`; `fired()` y `sparks()` iguales.
  - `"un tick largo que termina a mitad de un evento muestra el mismo cuadro"`: avanzar `a` y `b` con 100 ms hasta que `b.sparks().length > 0`, contando `t`; luego `a2.tick(t)` desde cero; `expect(a2.sparks()).toEqual(b.sparks())`.
  - `"10 min de una vez: tantos eventos como 6000 ticks de 100 ms"`: `fired().sparks` iguales y entre `600000 / (SPARK_GAP_MS[1] + 300) - 1` y `600000 / SPARK_GAP_MS[0]` (exportar `SPARK_GAP_MS`).
  - `"dt no válido no cambia nada"`: `tick(0)`, `tick(-5)`, `tick(NaN)`, `tick(Infinity)` → `{ trolley: false, sparks: false }`, `fired().sparks === 0`, `trolley.at.y` igual.
- [ ] **Step 2:** `npx vitest run src/scenes/shipyard-anim.test.ts` → FAIL.
- [ ] **Step 3: implementar.** Guard de `#23`: `if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return …`. `sparkRng = createRng(rng.int(0, SEED_MAX))` al construir; todas las tiradas (pausa, cuaderna, jitter) salen de él. Un solo `sparkTimer -= dtMs; while (sparkTimer <= 0) { … }` que recorre la máquina idle → cuadro 0 → 1 → 2 → idle: arrancar suma `SPARK_FRAME_MS`, cada cuadro llama a `burst()` (así las tiradas de jitter son las mismas con cualquier troceo) y suma `SPARK_FRAME_MS`, apagar suma `nextGap()`. `changes.sparks` si hubo algún paso.
- [ ] **Step 4:** `npx vitest run src/scenes/shipyard-anim.test.ts src/scenes/shipyard-animator.test.ts` → PASS (incluye "duran tres frames").
- [ ] **Step 5:** commit `feat(#125): shipyard-anim con tiempo de pared`.

### Task 3: city-anim — papeles reciclan con el tiempo sobrante (#124)

**Files:**
- Modify: `src/scenes/city-anim.ts` (bucle de papeles en `tick`, `respawn`, `fired()`, docstring)
- Test: `src/scenes/city-anim.test.ts`

**Interfaces:**
- Produces: `CityAnim.fired(): { lit: number; neon: number; papers: number }`, `papers` = reciclados de papeles.

- [ ] **Step 1: tests que fallan** (usan `troceado`/`veces` del archivo):
  - `"papeles: un tick de 60 s deja los papeles donde 600 de 100 ms"`: `fired().papers` iguales y `> 0`; cada `dot(a.papers()[i]).at` y `r` igual a `b` con `toBeCloseTo(_, 6)`.
  - `"papeles: un troceo irregular y su suma dejan lo mismo"` con dts `[16, 33, 100, 250, 1000, 5000, 7000, 33, 20000]`.
  - `"papeles: tras 10 min de una vez siguen dentro del recorrido"`: `fired().papers ≥ n · 600000 / (PAPER_RANGE / (PAPER_SPEED * 0.8)) - n` (velocidad mínima) con `n = papers().length`, y cada papel a distancia de la ventana, en el plano (`Math.hypot(x - w.x, y - w.y)`), `≤ PAPER_RANGE + PAPER_SIDE`.
  - Los `toEqual({ lit: 0, neon: 0 })` existentes pasan a `{ lit: 0, neon: 0, papers: 0 }`; el troceo de 7000/1000 con 50 semillas sigue comparando `fired()` completo.
- [ ] **Step 2:** `npx vitest run src/scenes/city-anim.test.ts` → FAIL.
- [ ] **Step 3: implementar.** Cada papel lleva su `Rng`, derivado al final de la construcción (después de `signRng`, así no cambian las tiradas iniciales ni las semillas de `blinkRng`/`signRng`); `respawn` tira de él después del arranque. Avance por tiempo, no por distancia, porque la velocidad cambia al reciclar:

  ```ts
  let left = dtMs;
  for (;;) {
    const v = PAPER_SPEED * p.speed, toEnd = (PAPER_RANGE - p.dist) / v;
    if (toEnd > left) { p.dist += v * left; break; }
    left -= toEnd; respawn(p); recycled++;
  }
  ```
  Docstring: el papel que llega al final renace en la ventana y sigue con el tiempo que sobra.
- [ ] **Step 4:** `npx vitest run src/scenes/city-anim.test.ts src/scenes/city-animator.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#125): papeles de city-anim con tiempo de pared`.

### Task 4: verificación final

- [ ] `npm test` y `npm run typecheck` → verdes.

## Grilling

- Rondas: 1 (los cambios fueron aclaraciones; no se agregaron ni quitaron pasos). Griller: `fable`.
- Preguntas: 18. Fuentes: ISSUE 1 (alcance: cuerpo de #125 y comentario del dueño), CODE 14 (`tech-anim.ts:30-80`, `shipyard-anim.ts:13-78`, `city-anim.ts:16-122`, `seed.ts:22` (`int` consume un `next()`), `shipyard.ts:73-86,213-218` (las cuadernas salen siempre de `slipways`), `palette-guard.test.ts:8-30`, `tech-anim.test.ts:7-8`, `city-anim.test.ts:11-17`, tests de animadores "mismo seed → misma secuencia", que comparan dos instancias iguales), NO SOURCE 3 → supuestos técnicos (ver Assumptions). Ambigüedades de spec: 0.
- Corrección del plan: `fired().windows` cuenta vencimientos con torres, no cambios visibles (el `chance(0.3)` puede apagar una torre ya apagada).
- Issues abiertos: #293 (humo de `factory-anim` y pausa del ferry de `sea-anim`).
