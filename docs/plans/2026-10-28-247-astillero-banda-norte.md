# Astillero en la banda norte (#247) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (`.agents/skills/subagent-driven-development/SKILL.md`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rearmar en la banda norte que dejó la fábrica (`x 0..195, y −60..−13`) las dos naves de montaje, los dos talleres y el patio de material del astillero, con el exhibit `naves` y el orden de llamadas de `main`.

**Architecture:** Solo cambia `src/scenes/shipyard.ts`: vuelven `halls()`, `workshops()` (solo los talleres) y `materialYard(out, rng)` con las posiciones nuevas, y `shipyard()` recupera el orden de `main`, con `parkingAndRails` justo después de `workshops` (en `main` era el resto de `workshops()`, así que el rng se consume igual). `src/lab/exhibits.ts` suma `naves`. Los tests se escriben primero (stage de evals) y fijan posiciones, vecindad y el rng.

**Tech Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** issue #247 ("Qué hacer", "Reglas que hereda" y criterios de aceptación); contexto en `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` §2.3, §3.4, §5 y en el comentario de plan de #238 (decisión 4). Código de referencia: `git show origin/main:src/scenes/shipyard.ts` (`halls()`, `materialYard()`, `workshops()`).

## Global Constraints

- Rama base `feature/238-fabrica-mudanza`; el PR va contra esa rama.
- Constantes: `HALL_X = 10`, `HALL_W = 90`, `HALL_H = 10`, `HALL_ROWS_Y = [-52, -32] as const`; las naves usan `ROW_H` (16). `ROW_Y = [36, 56]` sigue solo para gradas y pórtico.
- Naves: prismas `gable` `concrete` 90×16×10 en `(HALL_X, y, 0)` por cada `y` de `HALL_ROWS_Y`; autoelevadores `rust` 2×3×2 en `(HALL_X + HALL_W − 8, y + 2, 0)` y `steel` 3×2×2 en `(HALL_X + 2, y + ROW_H − 5, 0)`. Cumbrera z 13.5.
- Talleres: `step` `concrete` 24×14×7 en `(x, −33, 0)` para `x` 106 y 134; equipos `steel` 2×2×1 en `(x + 3, −30, 7)` y `(x + 18, −23, 7)`.
- Patio: el `materialYard` de `main` trasladado (+94, −64), mismas llamadas a rng y mismo orden: chapas (104, −58), (118, −58), (104, −50), (118, −50), (132, −56) con `rng.int(2, 4)` capas; caños (104, −42), (122, −42), (140, −44); bobinas `(149 + 5·(i % 3), −57 + 5·⌊i/3⌋)` r 1.5 h 1.5 `rust` sides 8; secciones `step` 9×4×3 `steel` en `(150 + 12·(i % 2), −46 + 6·⌊i/2⌋)`; cilindros `concrete` (174, −54) r 5 h 8 y (186, −42) r 4 h 6.
- Orden de `shipyard()`: quay, materialYard, dryDock, halls, street, slipways, gantry, workshops, parkingAndRails, factory, fittingOut, jungle, lamps.
- Exhibit `naves`: `{ id: "naves", title: "Naves de montaje", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 7, y0: -55, x1: 102, y1: -14 }, h: 14 }`, después de `calle-faroles`.
- No cambian: gradas, pórtico, dique, muelle, calle, camión, playa, secciones prefabricadas, vías del oeste (terminan en x 104) y durmientes; acentos del astillero `{cyan: 10}` (`portfolio-accents.test.ts` sin tocar); fábrica entera.
- Docstrings, comentarios y tests en castellano rioplatense.
- Al cerrar cada task: sus propios tests y los que ya estaban verdes en la rama base, verdes; `npm run typecheck` sin errores. Los evals de las tasks siguientes pueden seguir rojos (ver Assumptions). `npm test` entero verde al cerrar el stage de implementación.

## Review Focus

1. El orden de rng: si `materialYard` no va primero o `parkingAndRails` no sigue a `workshops`, autos, secciones prefabricadas y chatarra cambian respecto de `main` — lo fija el test dorado de seed 7 (Task 3).
2. Un sólido de la banda que toque el desvío (strips de `factory.ground` en y −9..−7), los vagones, la locomotora o la grúa torre — test de vecindad en `world.test.ts` (Task 4).
3. Un sólido del patio que baje hacia el hinterland (y ≤ −66) — `min.y ≥ −60` en `world.test.ts` y banda y ≥ −59 en `shipyard.test.ts` (Task 4).
4. Naves, talleres y patio solapados entre sí (p. ej. caños de (140, −44) contra el taller de x 134) — test de cajas disjuntas (Task 4).
5. La caja de `naves` recorta el contrapeso de la grúa (z 19.8, y −13) o el patio (x ≥ 104) y rompe "vecinos" — `exhibits.test.ts` (Task 5).

## Decisiones técnicas declaradas

- **Cota sur del patio.** El issue da la extensión "x 104..192, y −58..−35.7", pero también fija los centros: el cilindro (174, −54) r 5 llega a y −58.62 (teselado) y las bobinas de y −57 r 1.5 a ≈ −58.5. Mandan las posiciones (son el patio de `main` trasladado). El test de banda de `shipyard.test.ts` usa `y ≥ −59`; el de `world.test.ts`, `min.y ≥ −60` como pide el issue. La extensión medida es x 104..189.7, y −58.62..−36.
- **`parkingAndRails` queda como función propia** (la separó #242) y se llama justo después de `workshops`: el consumo de rng es idéntico al de `main`, donde ese código era el final de `workshops()`.
- **Test dorado del rng.** "es determinística por seed" solo compara seed 7 contra sí misma; para probar el criterio "con el orden de llamadas de `main`" se suma un test que fija autos, secciones prefabricadas y chatarra de seed 7 a los valores que da `origin/main` (medidos con `tsx` sobre un worktree de `main`). La selva no entra: en `main` se filtra con `clearOfWater` (#237), que la rama todavía no tiene.

## Assumptions

Salieron del grilling (ronda 1). Cada una es técnica: cualquier opción cumple el issue.

- **Suite roja entre tasks.** Los evals de todas las tasks se commitean juntos en el stage 3 (lo pide el pipeline). Por eso una task cierra con sus tests y los preexistentes en verde, no con la suite entera. Se descartó escribir los tests task por task, porque contradice el stage de evals.
- **Ante un choque de geometría manda el issue.** Los tests no se aflojan y las coordenadas del issue no se mueven. Se descartó que el implementador "corrija la geometría", porque esas coordenadas son criterio de aceptación.
- **El test dorado se regenera así:** `git worktree add /tmp/main origin/main` (a34dec0), `ln -s /work/node_modules /tmp/main/node_modules` (`package.json` y `package-lock.json` no difieren entre `main` y la rama base), y `npx tsx .scratch/rng.ts` filtrando autos `h 1.5 w 3`, prefabricados `steel 9×5×3` y chatarra `3×2×1 x ≥ 302`. El script queda en `.scratch/` (no se commitea) y el comando, en el PR.
- **Por qué los valores de `main` se pueden reproducir.** En `shipyard.ts`, `street(out)`, `factory(out, accents)` (la calderería local del astillero, no `scenes/factory.ts`), `lamps`, `halls`, `slipways`, `gantry`, `dryDock` y `quay` no reciben `rng`. En `main`, el `workshops(out, rng)` llamaba a rng por primera vez recién en el loop de autos, después de los talleres. Lo prueban `git show origin/main:src/scenes/shipyard.ts` (`workshops`) y `src/scenes/shipyard.ts` en la rama base (`parkingAndRails`). Así, la única fuente de rng antes de los autos es `materialYard`, idéntica a la de `main`.
- **`h: 14` en `naves`.** El test "encuadre" pide `h ≥` el máximo adentro (cumbrera 13.5) y `h ≤` máximo + 8. 14 es el valor del issue y el que tenía `naves` en `main` (`{5, 33, 101, 75}` h 14).
- **Cota sur canónica.** Los centros del issue y la medición (−58.62) mandan. La decisión queda en este plan y en el comentario del stage 2 de #247. El docstring dice "banda `y −58..−16`" tal como lo pide el ítem 5 del issue, porque es la banda de las naves y de las chapas, no la caja exacta del patio.

---

### Task 1: Naves de montaje

**Files:**
- Modify: `src/scenes/shipyard.ts` (constantes, `halls()`, `shipyard()`)
- Test: `src/scenes/shipyard.test.ts` (escrito en el stage de evals)

**Interfaces:**
- Consumes: nada.
- Produces: `halls(out: Solid[]): void` privada; constantes `HALL_X`, `HALL_W`, `HALL_H`, `HALL_ROWS_Y` privadas.

- [ ] **Step 1: Test (ya escrito, fallando)** "naves a dos aguas en la banda norte": prismas `gable` con `w 90, d 16, h 10` y `mat concrete` → exactamente 2, con `at` `(10, −52, 0)` y `(10, −32, 0)`; 4 autoelevadores: `rust` 2×3×2 en (92, −50) y (92, −30), `steel` 3×2×2 en (12, −41) y (12, −21). El test de #242 "no quedan naves…" se reemplaza por "lo viejo no vuelve a su lugar viejo": ningún prisma `gable` 90×16 con `at.y` 36 o 56, ningún `step` 24×14 con `at.y` 80, ningún cilindro en (80, 10) o (92, 22) y ninguna chata `w 4.4 d 8 h 3`. Las chatas (x 100.3..104.7) son lo único viejo fuera de la región x 4..99, que cubre el resto.
- [ ] **Step 2:** `npx vitest run src/scenes/shipyard.test.ts` → FAIL en naves.
- [ ] **Step 3: Implementar** `halls()` como en `main`, iterando `HALL_ROWS_Y` en vez de `ROW_Y`, y llamarla entre `dryDock` y `street`.
- [ ] **Step 4:** test → PASS; `npm run typecheck` sin errores.
- [ ] **Step 5:** commit `feat(#247): naves de montaje en la banda norte`.

### Task 2: Talleres

**Files:**
- Modify: `src/scenes/shipyard.ts` (`workshops()`, `shipyard()`)
- Test: `src/scenes/shipyard.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `workshops(out: Solid[]): void` privada, sin rng.

- [ ] **Step 1: Test (ya escrito)** "talleres con techo escalonado y equipos en el techo": prismas `step` 24×14×7 `concrete` con `at.y === −33` → exactamente 2, en x 106 y 134; equipos `steel` 2×2×1 a z 7 → 4, en (109, −30), (124, −23), (137, −30), (152, −23).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar** `workshops(out)` y llamarla después de `gantry`, antes de `parkingAndRails`.
- [ ] **Step 4:** PASS; typecheck.
- [ ] **Step 5:** commit `feat(#247): talleres en la banda norte`.

### Task 3: Patio de material y orden de llamadas de `main`

**Files:**
- Modify: `src/scenes/shipyard.ts` (`materialYard()`, `shipyard()`)
- Test: `src/scenes/shipyard.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `materialYard(out: Solid[], rng: Rng): void` privada.

- [ ] **Step 1: Tests (ya escritos)**
  - "patio de material: tanques cilíndricos y pilas apiladas": cilindros con `r ≥ 4` → ≥ 3; prismas con `0 < at.z < 3` y `h ≤ 1` → ≥ 5; además 5 pilas de chapas (prisma 10×2×0.5 a z 0 en las 5 posiciones), 12 caños 14×1×1, 6 bobinas r 1.5, 4 secciones `step` 9×4×3, cilindros `concrete` (174, −54) r 5 h 8 y (186, −42) r 4 h 6; la caja de todo eso cae en x 104..192, y −59..−35.7 (la cota norte del issue, −35.7, es una cota superior: lo medido llega a −36).
  - "el rng da lo mismo que en main (seed 7)": autos (`h 1.5, w 3`) `[[65,102,"steel"],[73,116,"steel"],[53,116,"rust"],[57,102,"steel"],[73,102,"rust"]]`; secciones prefabricadas (`steel` 9×5×3) `[[112,82],[136,82],[148,82],[112,90],[124,90],[136,90],[148,90]]`; chatarra (`3×2×1`, x ≥ 302) `[[303,140],[315,136],[319,140],[317,140],[322,130],[306,133]]`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar** `materialYard(out, rng)` con las posiciones de Global Constraints y ordenar `shipyard()` como allí se indica.
- [ ] **Step 4:** PASS, incluido "es determinística por seed"; typecheck.
- [ ] **Step 5:** commit `feat(#247): patio de material en la banda norte y orden de main`.

### Task 4: Vecindad de la banda

**Files:**
- Test: `src/scenes/shipyard.test.ts`, `src/scenes/world.test.ts` (escritos en el stage de evals; esta task solo los hace pasar o corrige geometría si fallan)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: nada nuevo.

- [ ] **Step 1: Tests (ya escritos)**
  - `shipyard.test.ts` "naves ↔ talleres ↔ patio apartados": caja de cada nave, cada taller (con sus equipos) y la del patio entero, disjuntas dos a dos (`a.max ≤ b.min + 1e-9` en x o y).
  - `shipyard.test.ts` "la banda norte: todo sólido con max.y < 0, salvo muelle (min.x ≥ 198) y conos, cae en x 10..192, y −59..−13 y no supera z 22".
  - `shipyard.test.ts` "la región x 4..99, y −4..99 queda vacía salvo conos" (ya existe, se queda).
  - `world.test.ts` "el astillero en la banda norte no toca el desvío, los vagones, la locomotora ni la grúa torre (#247)": obstáculos = strips de `factory.ground` con `min.y ≥ −9.01 && max.y ≤ −6.99` más sólidos de `factory.solids` con `min.y ≥ −13.1 && max.y ≤ −6.7` (≥ 8 en total); cada sólido de `shipyard.solids` con `max.y < 0`, salvo `min.x ≥ 198` y conos, es disjunto (1e-9) de cada obstáculo y tiene `min.y ≥ −60`.
  - Los dos tests de banda exigen además ≥ 40 sólidos en la banda (hoy en la rama base solo hay bolardos del muelle con `max.y < 0`, que se excluyen: sin esa cota pasarían vacíos).
- [ ] **Step 2:** `npx vitest run src/scenes/shipyard.test.ts src/scenes/world.test.ts` → PASS. Si falla, primero revisar que la implementación respete las posiciones de Global Constraints; si las posiciones del issue mismas producen el choque, no se mueve nada: es ambigüedad de spec, se comenta en #247 y se para.
- [ ] **Step 3:** sin commit propio: estos tests quedan verdes con las Tasks 1–3, y si alguno no, el arreglo va en un commit nuevo `fix(#247): …` encima (no se reescriben commits).

### Task 5: Exhibit `naves` y docstring

**Files:**
- Modify: `src/lab/exhibits.ts` (después de `calle-faroles`), `src/scenes/shipyard.ts` (docstring)
- Test: `src/lab/exhibits.test.ts` (`CATALOG.astillero` con `naves` al final, escrito en el stage de evals)

**Interfaces:**
- Consumes: Task 1.
- Produces: exhibit `naves` (hash `#naves`).

- [ ] **Step 1: Test (ya escrito)** `CATALOG.astillero = ["gradas", "darsena", "grua-portico", "calle-faroles", "naves"]`; los tests "encuadre", "vecinos" y "no-vacío" del grupo cubren la caja.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar.** Entrada `naves` de Global Constraints, con un comentario de una línea: "las dos naves de montaje: x 10..100, filas y −52 y −32 de 16; y1 −14 deja afuera el contrapeso de la grúa (z 19.8) y x1 102 el patio (x ≥ 104)". Docstring de `shipyard.ts`: reescribir la línea de producción — naves de montaje, talleres y patio de material al norte, detrás de la fábrica, en la banda `y −58..−16`; gradas al este de la calle de transferencia; la fábrica de Portfolio entre la calle y la playa de vías — y borrar la nota transitoria "Las naves de montaje… en otro hijo de #238".
- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts src/scenes/portfolio-accents.test.ts` → PASS; `npm test`; typecheck.
- [ ] **Step 5:** commit `feat(#247): exhibit naves y docstring del astillero`.

### Task 6: Capturas (la hace el orquestador, no un implementador)

**Files:**
- Create: `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/naves-antes.png`, `naves-despues.png`, `mundo-banda-antes.png`, `mundo-banda-despues.png`

- [ ] `naves-antes.png`: `/lab/storybook.html#naves` desde un worktree de `origin/main` servido en el puerto 5174. `mundo-banda-antes.png`: `/lab/world.html`, tecla `1`, desde la rama base antes de este hijo. Los `-despues` desde la rama con el trabajo, puerto 5173. agent-browser a 1600×900 escala 2 (CLAUDE.md).
- [ ] commit `docs(#247): capturas antes/después de naves y de la banda`.

## Grilling

Una ronda, con el griller en `fable`. Fueron 17 preguntas. La revisión no agregó tasks ni cambió la costura: sumó Assumptions, la no-vacuidad de los tests de banda y el reemplazo explícito del test de #242. Por eso no hubo segunda ronda.

| # | Respuesta | Fuente |
|---|---|---|
| 1 | `street(out)`, `factory(out, accents)` y `lamps(out, accents)` no reciben rng | CODE `src/scenes/shipyard.ts` (firmas de las funciones y de `shipyard()`) |
| 2 | Talleres sin rng; el primer `rng.` es el loop de autos | CODE `git show origin/main:src/scenes/shipyard.ts` (`workshops`) |
| 3 | Script y comando en Assumptions | NO SOURCE → supuesto técnico |
| 4 | Suite roja entre tasks | NO SOURCE → supuesto técnico |
| 5 | Ante un choque manda el issue; si es del issue, bloquea | ISSUE: "Nada pisa el desvío…" / supuesto |
| 6 | Criterios → tasks: 1 → T1–T3; 2 → T4; 3 → T3; 4 → T5; 5 → T5; 6 → T6 (capturas) y `portfolio-accents` sin tocar; 7 → todas. Hinterland: `min.y ≥ −60` (T4); z 22 (T4); acentos `{cyan: 10}` (sin cambios) | ISSUE: "Criterios de aceptación" |
| 7 | Mástil, pluma, contrapeso (52..54, −13..−11, z 18.5..20), gancho, vagones (−9.2..−6.8) y locomotora (−9.3..−6.7) caen dentro del filtro: 14 sólidos más las 2 strips del desvío. El único afuera es un vagón N-S de la playa de vías (x −41, y −18..−11), lejos de la banda | CODE medido con `bounds` sobre `factory(createRng(7))` |
| 8 | En la rama base, los únicos sólidos del astillero con `max.y < 0` son los 5 bolardos del muelle (x 199.4..200.6), que se excluyen; se suma la cota de ≥ 40 sólidos | CODE medido sobre `shipyard(createRng(7))` |
| 9 | Nada llega a −35.7; es cota superior; lo medido es −36 | CODE medido |
| 10 | `main` tiene `naves` `{5, 33, 101, 75}` h 14 (lo quitó #242), así que `#naves` existe en `main`. La tecla `1` está en `src/lab/page.ts:12` | CODE `git show origin/main:src/lab/exhibits.ts:99`, `src/lab/page.ts:12` |
| 11 | "encuadre" pide `h ≥ max(inside, accents)` y `h ≤ max(withAnim, accents) + 8`; "vecinos" pide que lo cortado por el borde no supere `h`; "no-vacío" pide ≥ 1 sólido | CODE `src/lab/exhibits.test.ts:100-113` |
| 12 | Se reemplaza por "lo viejo no vuelve a su lugar viejo"; la región x 4..99 cubre el resto | CODE `src/scenes/shipyard.test.ts:117-129` |
| 13 | Cota sur canónica | NO SOURCE → supuesto técnico |
| 14 | El test de T3 fija cada `at` nuevo; el offset se compara contra `main` en el stage 4 | ISSUE: "el de `main` trasladado (+94, −64)" |
| 15 | Sin reescribir commits: un commit `fix` encima | NO SOURCE → supuesto técnico |
| 16 | `Rng` sale de `src/map/seed`; los tests usan `createRng(7)` | CODE `src/scenes/shipyard.ts:5`, `shipyard.test.ts:6-9` |
| 17 | Worktree en a34dec0 (`origin/main`) con `node_modules` enlazado; `package.json` y el lock no difieren | CODE `git diff --stat origin/main HEAD -- package.json package-lock.json` (vacío) |

Conteo: CODE 10, ISSUE 3, DOC 0, NO SOURCE 4 (los 4 son supuestos técnicos). Ambigüedades de spec: ninguna. Issues abiertos: ninguno. Estado: `ok`.
