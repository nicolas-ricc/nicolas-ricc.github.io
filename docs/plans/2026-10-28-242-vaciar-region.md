# Vaciar la región nueva (#242) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (`.agents/skills/subagent-driven-development/SKILL.md`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar libre la región `x 4..99, y −4..99` del astillero para que la fábrica se mude ahí: el astillero quita naves de montaje, talleres, patio de material, ramales, chatas y rieles nave→grada; la fábrica quita la cinta larga; el storybook pierde `cinta` y `naves`.

**Architecture:** Solo se borra código de escena. `shipyard.ts` pierde `halls()` y `materialYard()`; `workshops()` se reduce a `parkingAndRails(out, rng)` (playa, autos, secciones prefabricadas, vías del oeste y durmientes); `street()` queda con la calle y el camión. `factory.ts` pierde `conveyor()` y `CONVEYOR_Z`. `exhibits.ts` pierde dos entradas. Los tests se reescriben primero (stage de evals) y fijan el vacío.

**Tech Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** issue #242 ("Qué hacer" y criterios de aceptación); contexto en `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` §2.3, §2.4, §5 y en el comentario de plan de #238.

## Global Constraints

- Rama base `feature/238-fabrica-mudanza`; el PR va contra esa rama.
- Región nueva: `min.x < 99 ∧ max.x > 4 ∧ min.y < 99 ∧ max.y > −4` — ningún sólido del astillero salvo `kind === "cone"` la cruza.
- Se quedan: calle (strip `road` x 100..108), camión (105, 88, 3×7×2.5 `rust`), faroles de la calle, playa (strip `road` y 113 w 26), líneas y 102..106, autos rng, secciones prefabricadas x 112..157 y 82..95 (rng 0.8), vías del oeste `RAIL_Y = [131, 134]` de x 0 a `STREET_X + 4 = 104` y sus durmientes, gradas, pórtico, dique, muelle de alistamiento, `ROW_Y`/`ROW_H`.
- Se va entero el ramal embutido (strips `rail` x 101 y 104 de y 30.5 a 131), el ramal `SPUR_Y` (y 30.5 y 33.5), los rieles nave→grada (y 40, 47, 60, 67) y las dos chatas.
- Las llamadas que quedan en `shipyard()` conservan su orden: quay, dryDock, street, slipways, gantry, parkingAndRails, factory, fittingOut, jungle, lamps.
- No cambian: `LABEL_AT`, zonas, velo, bloom, acentos (`portfolio-accents.test.ts`: astillero `{cyan: 10}`, fábrica `{amber 3, cyan 8, magenta 6}`), `railYard`, excavadora.
- Docstrings, comentarios y tests en castellano rioplatense.
- `npm test` y `npm run typecheck` verdes al cerrar cada task.

## Review Focus

1. Una vía del oeste que deje de llegar a x 104 o pierda durmientes al separar `parkingAndRails` — la fija el test de vía del oeste (Task 1).
2. Un sólido del astillero que quede en la región (p. ej. un farol, el camión o un auto mal ubicado) — lo fija el test de región (Task 1).
3. El orden de consumo de rng cambia al quitar `materialYard`: la selva sigue con ≥ 20 conos fuera de la losa (test existente "selva").
4. Un sólido de la fábrica con `max.y` entre 0 y 4 al este de x 0 (tolva, cinta inclinada, faroles) — lo fija `world.test` con `max.y ≤ 0` (Task 2).
5. Una caja de exhibit que quede vacía tras el vaciado (`calle-faroles`, `gradas`, `playa-camiones`) — "no-vacío" de `exhibits.test.ts` (Task 3).

## Decisión técnica declarada

- **Cómo se lee "rieles con puntos en x 101 o 104".** La vía del oeste termina, a propósito, en el punto (104, 131/134). El test nuevo prohíbe strips `rail` **verticales** con todos sus puntos en x 101 o en x 104 (el ramal embutido) y strips `rail` **horizontales** con todos sus puntos en y 40, 47, 60, 67, 30.5 o 33.5; no un punto suelto. Así la vía del oeste sigue legal.

---

### Task 1: Astillero sin naves, talleres, patio, ramales ni chatas

**Files:**
- Modify: `src/scenes/shipyard.ts` (`halls`, `materialYard`, `workshops`, `street`, `shipyard`, constantes, docstring)
- Test: `src/scenes/shipyard.test.ts` (escritos en el stage de evals)

**Interfaces:**
- Consumes: nada.
- Produces: `shipyard(rng): Scene` con la misma firma. Función privada nueva `parkingAndRails(out: Solid[], rng: Rng): void`.

- [ ] **Step 1: Tests (ya escritos, fallando)**
  - "hay naves a dos aguas…" → "hay galpones a dos aguas en alistamiento, gradas…": gable con `at.x > 300` exactamente 2 (la nave de pintura, x 112 y 126, sigue a dos aguas fuera de la región); resto igual.
  - Se borra "patio de material: tanques cilíndricos y pilas apiladas".
  - "talleres con techo escalonado…" → "autos en la playa": solo `cars ≥ 3`.
  - Nuevo "la región nueva (x 4..99, y −4..99) queda vacía salvo conos de selva": para todo `s` de `solids` con `kind !== "cone"`, `!(min.x < 99 && max.x > 4 && min.y < 99 && max.y > −4)`.
  - Nuevo "sin rieles nave→grada, ramal embutido ni ramal SPUR_Y": ningún strip `rail` de `ground` vertical con todos sus x en 101 o todos en 104, ni horizontal con todos sus y en {40, 47, 60, 67, 30.5, 33.5}.
  - Nuevo "piezas quitadas": ningún prisma `gable` 90×16, ni `step` 24×14 a y 80, ni equipos 2×2×1 a z 7, ni cilindro en (80, 10) o (92, 22), ni chapas 10×2×0.5, caños 14×1×1, bobinas r 1.5, secciones `step` 9×4×3, ni chatas `w 4.4 d 8 h 3`.
  - Nuevo "la vía del oeste termina en x 104 con durmientes; el camión de la calle sigue": strips `rail` de (0, y)→(104, y) para y 131 y 134; ≥ 20 durmientes `1×5×0.3 rust` a y 130; prisma `rust` en (105, 88) 3×7×2.5.
- [ ] **Step 2:** `npx vitest run src/scenes/shipyard.test.ts` → FAIL en región, rieles, piezas quitadas y naves.
- [ ] **Step 3: Implementar.** Borrar `halls()` y `materialYard()` y sus llamadas. `workshops()` → `parkingAndRails(out, rng)` sin los dos talleres ni equipos, con el mismo cuerpo restante y mismo orden de rng; renombrar el comentario de sección a "playa, prefabricados, vías (SO)". En `street()` dejar solo el strip de la calle y el camión (comentario del camión: "camión bajando por la calle"). Borrar `HALL_X/HALL_W/HALL_H` y `SPUR_Y`. El comentario de `RAIL_Y` y de las vías ya no dice "hasta el ramal". Docstring: sacar la línea de producción y los "talleres"; agregar una línea: "Las naves de montaje, los talleres y el patio de material se rearman en la banda norte (`y −58..−16`) en otro hijo de #238."
- [ ] **Step 4:** `npx vitest run src/scenes/shipyard.test.ts` → PASS; `npm run typecheck` → sin errores.
- [ ] **Step 5:** commit `feat(#242): astillero sin naves, talleres, patio ni ramales`.

### Task 2: Fábrica sin cinta larga

**Files:**
- Modify: `src/scenes/factory.ts` (`conveyor`, `CONVEYOR_Z`, llamada en `factory()`, docstring, comentario del portón)
- Test: `src/scenes/factory.test.ts`, `src/scenes/world.test.ts` (escritos en el stage de evals)

**Interfaces:**
- Consumes: nada. Produces: `factory(rng): FactoryScene` sin cambios de firma.

- [ ] **Step 1: Tests (ya escritos, fallando)**
  - "la torre de escalera no toca … ni el pedestal…" → "la torre de escalera no toca el pedestal de la primera chimenea (x ≥ 126.5)": sin el filtro `conveyor`.
  - "desvío con seis vagones…, cinta elevada…" → sin "cinta elevada"; las dos aserciones de la cinta se reemplazan por: ningún prisma con `at.z === 6 && h === 0.6`, ningún prisma 0.8×0.8×6.
  - `world.test.ts`: `max.y <= 0 || max.x <= 0` y el comentario de la cinta se quita.
- [ ] **Step 2:** `npx vitest run src/scenes/factory.test.ts src/scenes/world.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** Borrar `conveyor()`, `CONVEYOR_Z` y la llamada. Docstring: quitar "cinta transportadora hasta el patio de material"; el resto del docstring no se toca. Comentario del portón este: "portón este" (ya no sale la cinta).
- [ ] **Step 4:** mismo comando → PASS; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#242): fábrica sin cinta larga`.

### Task 3: Storybook sin `cinta` ni `naves`

**Files:**
- Modify: `src/lab/exhibits.ts:88-89,98-99` y los comentarios de `excavadora` (l. 85) y `calle-faroles` (l. 96) que nombran las naves
- Test: `src/lab/exhibits.test.ts` (`CATALOG`, escrito en el stage de evals)

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Test (ya escrito):** `CATALOG.fabrica = ["planta", "chimeneas", "subestacion", "playa-camiones", "playa-vias", "excavadora"]`, `CATALOG.astillero = ["gradas", "darsena", "grua-portico", "calle-faroles"]`.
- [ ] **Step 2:** `npx vitest run src/lab/exhibits.test.ts` → FAIL en el catálogo.
- [ ] **Step 3: Implementar.** Borrar las entradas `cinta` y `naves` con sus comentarios. Comentario de `excavadora`: la caja se detiene en x 4, borde oeste de la región nueva. Comentario de `calle-faroles`: "calle de transferencia x 100..108 con los faroles en 108.5, al oeste de las gradas (x ≥ 110)". Valores de caja sin cambios.
- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts src/scenes/portfolio-accents.test.ts` → PASS; luego `npm test` y `npm run typecheck` completos.
- [ ] **Step 5:** commit `feat(#242): storybook sin cinta ni naves`.

### Capturas (fuera de las tasks de código, las hace el orquestador)

`/lab/world.html` con la tecla `1`, viewport 1600×900 escala 2: `vaciar-antes.png` antes de Task 1 (stage de evals) y `vaciar-despues.png` después de Task 3, en `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/`.

## Assumptions

- **Rieles prohibidos por recta entera, no por punto suelto** (ver "Decisión técnica declarada"). Alternativa rechazada: prohibir cualquier punto en x 101/104, que rompe la vía del oeste que el issue pide conservar hasta x 104. Todos los strips `rail` del astillero son de dos puntos (`shipyard.ts:57-74,108-111`), así que "todos los puntos en x 101" equivale a "vertical en x 101".
- **El test de región recorre solo `solids`**: el issue lo pide así ("ningún sólido de `shipyard(rng).solids` salvo conos"). Los `ground` que quedan (calle x 100..108, playa y 100..126, vías y ≥ 130.75) no entran a la región de todos modos.
- **Las tasks se commitean por separado, el PR entra squash** (stage 10 del pipeline). Un estado con Task 1 y sin Task 2 vive solo en `agent/242-*`.

## Grilling

- Rondas: 1 (el plan no cambió de forma sustancial: se sumaron supuestos, ningún paso). Griller: `fable`.
- Preguntas: 17. Fuentes: ISSUE 9 (1, 2, 3, 10, 11, 15, 16, 17 parcial, 13 parcial), CODE 11 (4, 5, 6, 7, 8, 9, 12, 13, 14, 17), DOC 1 (3: pipeline/AGENTS.md). NO SOURCE: 2 → supuestos técnicos (14, 17). Ninguna ambigüedad de spec, nada fuera de alcance.
- Supuestos: los tres de arriba.
- Issues abiertos: ninguno.
