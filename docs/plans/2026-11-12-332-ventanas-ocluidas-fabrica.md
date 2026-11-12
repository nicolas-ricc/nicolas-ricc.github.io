# Ventanas windowCool de Portfolio: la fábrica también ocluye (#332) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que ninguna ventana `windowCool` de las naves, talleres y galpones del astillero se encienda si la tapa un sólido elevado de la fábrica (vagones del desvío, locomotora, grúa torre), además de los del astillero.

**Arquitectura:** opción (a) del issue. `windowCandidates` y `portfolioWindows` (`src/scenes/portfolio-lights.ts`) reciben un parámetro opcional `extraOccluders: Solid[] = []`, que solo ocluye (nunca es dueño de ventanas). `shipyard(rng, occluders: Solid[] = [])` se lo pasa. `world()` construye la fábrica antes que el astillero (cada una tiene su `Rng` de `zoneRng`, así que el orden de construcción no cambia ninguna de las dos) y le pasa `fa.solids` a `shipyard()`. El orden en que se vuelcan `ground`, `solids` y `accents` (`[sy, fa]`) no cambia. `shipyard.ts` no importa `factory.ts`: no hay ciclo, y `src/scenes/` sigue sin Pixi.

**Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** el issue #332 (Agent Brief del triage). Reemplaza la decisión de #324 "la oclusión mira solo el astillero" (`docs/plans/2026-11-08-324-portfolio-centro.md`, Review Focus 1).

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- Toda aleatoriedad sale del `Rng` recibido. La semilla derivada de las ventanas sigue siendo `createRng(rng.int(0, SEED_MAX))`, sacada al final de `shipyard()`: el resto de la semilla no se corre.
- Orden de candidatas sin cambios (dueño en orden de `solids`, pared, ventana).
- Fuera de alcance: ventanas en la fábrica, el 30 %, las fachadas (`cols`), qué sólidos son candidatos, oclusión por tiras de suelo, `src/city/lights.ts`.
- Sin cambios de presupuesto: `city-budget.test.ts`, astillero ≤ 900 y astillero + fábrica ≤ 1 700 sólidos.
- Commits `test(#332): …` / `feat(#332): …`, con `Co-Authored-By`.

## Decisiones técnicas declaradas

1. **Opción (a), no (b).** Mover la llamada a `world()` obligaría a sacar la semilla derivada fuera de `shipyard()` (un campo nuevo en `Scene`) y dejaría a `shipyard()` sin ventanas cuando se usa solo (tests, animadores). Con (a) `shipyard(rng)` a secas da exactamente lo mismo que hoy.
2. **Los oclusores extra se filtran con `!isFlat`**, como los del astillero. `fa.solids` ya excluye las tiras, pero el filtro no cuesta y cubre otros planos.
3. **Las claves del rng siguen siendo una por candidata visible**, en orden. Con 2 visibles menos, las claves de las visibles que vienen después se corren y el conjunto encendido cambia algo. Rechazado: sacar una clave por cada candidata (ocultas incluidas). Eso cambiaría el conjunto encendido para todas las semillas, y el issue pide conservar el algoritmo (orden de candidatas y rng derivado), no un conjunto fijo.
4. **Medida (2026-11-12, `main` en `f108dbf`):** las 64 candidatas de `world(7)` incluyen 26 ocultas por el astillero, y 2 más quedan tapadas solo por la fábrica. Con las semillas 1, 2, 3, 8 y 42 también salen 2 más (28, 30, 29, … ocultas por el astillero según la semilla, porque el relleno es aleatorio). Los tests usan los conteos calculados, salvo el "+2" de `world(7)` que fija el issue.

## Review Focus

1. **Semilla sin ventana tapada encendida:** con `world(7)` puede pasar que ninguna de las 2 se encienda, y entonces el test de "ninguna tapada" pasaría también sin el arreglo. Por eso el test recorre las semillas `1..12` con `world(seed, { zones: ["portfolio"] })`. En la etapa 3 se comprueba que falla sin el arreglo en al menos una semilla (tarea 2).
2. **El astillero usado solo no cambia:** `shipyard(createRng(7))` sin oclusores tiene que dar el mismo JSON que antes (los tests `shipyard.test.ts` lo cubren), y con oclusores, `ground` y `solids` idénticos y los mismos acentos salvo las `windowCool` de fachada. Test en la tarea 2.
3. **Un oclusor extra nunca es dueño:** si se le pasa al astillero como extra un sólido que es nave, no tiene que generar candidatas. Test en la tarea 1.

---

### Tarea 1: `extraOccluders` en `portfolio-lights.ts`

**Archivos:**
- Modificar: `src/scenes/portfolio-lights.ts`
- Test: `src/scenes/portfolio-lights.test.ts`

**Interfaces:**
- Produce: `windowCandidates(solids: Solid[], extraOccluders: Solid[] = []): WindowCandidate[]` y `portfolioWindows(solids: Solid[], rng: Rng, extraOccluders: Solid[] = []): Accent[]`.

- [ ] **Paso 1: tests (etapa 3).** En el archivo, `const fa = w.factory!` y `const candsF = windowCandidates(sy.solids, fa.solids)`.
  - `"factory solids hide the 2 factory-only candidates of world(7)"`: `candsF` tiene 64; las ocultas de `candsF` son las de `cands` + 2. Cada candidata que pasa de visible a oculta tiene un sólido de `fa.solids` que la tapa (`overlaps(screenBounds(box), screenBounds(bounds(s))) && hides(box, bounds(s))`, con `box = lightBox(pts)`), y el orden de los `pts` de `candsF` es el de `cands`.
  - `"extra occluders never own windows"`: `windowCandidates([], sy.solids)` está vacío.
  - `"deterministic by seed"` pasa a usar `fa.solids` como tercer argumento.
- [ ] **Paso 2:** corre y falla (el segundo argumento se ignora: "+2" no se cumple).
- [ ] **Paso 3:** `occluders` = los no planos de `solids` y de `extraOccluders`; los dueños se siguen sacando solo de `solids`. El docstring del módulo deja de decir que la fábrica está fuera (#332).
- [ ] **Paso 4:** pasa. Commit `feat(#332): extra occluders for the Portfolio windows`.

### Tarea 2: la fábrica llega a `shipyard()` desde `world()`

**Archivos:**
- Modificar: `src/scenes/shipyard.ts` (`shipyard`), `src/scenes/world.ts` (`world`)
- Test: `src/scenes/portfolio-lights.test.ts`

**Interfaces:**
- Consume: `portfolioWindows(solids, rng, extraOccluders)` de la tarea 1.
- Produce: `shipyard(rng: Rng, occluders: Solid[] = []): Scene`.

- [ ] **Paso 1: tests (etapa 3).**
  - El test `"25..35 %…"` cuenta las visibles con `candsF`: `lit` tiene `Math.round(0.3 * visibleF.length)`.
  - `"no lit window is hidden by another raised shipyard or factory solid"` reemplaza al de "shipyard solid": para cada `seed` de `1..12`, con `world(seed, { zones: ["portfolio"] })`, ninguna `windowCool` encendida de fachada de `shipyard.accents` está tapada por un sólido no plano de `shipyard.solids` (salvo el dueño) ni de `factory.solids`.
  - `"occluders only change the lit facade windows"`: `shipyard(createRng(7))` y `shipyard(createRng(7), w.factory!.solids)` dan el mismo JSON de `ground` y `solids`, y los mismos acentos una vez quitadas las `poly windowCool` que coinciden con una candidata.
- [ ] **Paso 2:** corre y falla (al menos una semilla de `1..12` enciende una tapada por la fábrica; si ninguna, ampliar el rango hasta que falle y anotarlo).
- [ ] **Paso 3:** `shipyard(rng, occluders = [])` pasa `occluders` a `portfolioWindows`. `world()` llama `fa = factory(zoneRng(seed, "portfolio", 1))` antes de `sy = shipyard(zoneRng(seed, "portfolio"), fa.solids)` y sigue volcando `[sy, fa]` en ese orden.
- [ ] **Paso 4:** pasan los tests del archivo, `portfolio-accents.test.ts`, `shipyard.test.ts`, `city-budget.test.ts`, y `npm test` y `npm run typecheck` completos. Commit `feat(#332): factory solids occlude the shipyard windows`.

## Verificación manual

No hay criterio visual que no cubran los tests. El arreglo no se ve en el navegador de forma determinista: depende de que la semilla del sitio encienda una de las 2 ventanas.
