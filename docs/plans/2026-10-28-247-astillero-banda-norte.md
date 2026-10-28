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
- `npm test` y `npm run typecheck` verdes al cerrar cada task.

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

---

### Task 1: Naves de montaje

**Files:**
- Modify: `src/scenes/shipyard.ts` (constantes, `halls()`, `shipyard()`)
- Test: `src/scenes/shipyard.test.ts` (escrito en el stage de evals)

**Interfaces:**
- Consumes: nada.
- Produces: `halls(out: Solid[]): void` privada; constantes `HALL_X`, `HALL_W`, `HALL_H`, `HALL_ROWS_Y` privadas.

- [ ] **Step 1: Test (ya escrito, fallando)** "naves a dos aguas en la banda norte": prismas `gable` con `w 90, d 16, h 10` y `mat concrete` → exactamente 2, con `at` `(10, −52, 0)` y `(10, −32, 0)`; 4 autoelevadores: `rust` 2×3×2 en (92, −50) y (92, −30), `steel` 3×2×2 en (12, −41) y (12, −21). El test de #242 "no quedan naves…" se reemplaza por los de esta task y las siguientes.
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
  - "patio de material: tanques cilíndricos y pilas apiladas": cilindros con `r ≥ 4` → ≥ 3; prismas con `0 < at.z < 3` y `h ≤ 1` → ≥ 5; además 5 pilas de chapas (prisma 10×2×0.5 a z 0 en las 5 posiciones), 12 caños 14×1×1, 6 bobinas r 1.5, 4 secciones `step` 9×4×3, cilindros `concrete` (174, −54) r 5 h 8 y (186, −42) r 4 h 6; la caja de todo eso cae en x 104..192, y −59..−35.7.
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
- [ ] **Step 2:** `npx vitest run src/scenes/shipyard.test.ts src/scenes/world.test.ts` → PASS (si falla, corregir la geometría, no el test).
- [ ] **Step 3:** commit junto con la task que lo deje verde.

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
