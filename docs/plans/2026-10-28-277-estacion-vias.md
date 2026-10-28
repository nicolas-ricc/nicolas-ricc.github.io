# Estación, parte 1: vías, abanico, andenes, marquesinas, topes, semáforos y paso a nivel (#277) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar la calderería del astillero y construir, en un módulo nuevo `src/scenes/station.ts`, todo lo de vías y andenes de la estación cabecera (vías 1–3 con tercer riel, abanico, tres andenes, marquesinas, topes, cerco, semáforos y paso a nivel estáticos), con los exhibits `estacion` y `paso-a-nivel`.

**Architecture:** `station(out, accents)` es puro y determinista (sin rng) y `shipyard()` lo llama donde llamaba a `factory()`; sus `strip` terminan en `ground` por el filtro que ya hay al final de `shipyard()`. Las constantes exportadas son el contrato con los hijos #278–#281. Los tests (stage 3) los escribe el orquestador en rojo; cada tarea los pone en verde. Las capturas "antes" las saca el orquestador en stage 3, antes de tocar código.

**Tech Stack:** TypeScript, Vitest, tsx (para re-medir).

**Spec:** issue #277 (texto completo: "Qué hacer", "Reglas que hereda", criterios) y `docs/superpowers/specs/2026-10-27-estacion-terminal-design.md` §1, §4, §5.3, §6.1, §6.2. Contexto: plan de la historia en el comentario de #239 (decisiones 1, 2, 9). Fotos: `assets/estacion-refs/estacion/06`, `07`, `08`.

## Global Constraints

- Rama base `feature/239-estacion-tigre`; el PR va contra esa rama.
- Las constantes exportadas de `station.ts` llevan **exactamente** los valores del issue (`STATION`, `GAUGE`, `RAIL_W`, `RAIL_Z`, `TRACKS_Y`, `TRACK_X0`, `LADDER`, `BUFFER_X`, `BUFFER_H`, `STOP_X`, `ISLAND`, `SIDE`, `HEAD`, `FENCE_Y`, `CROSSING`, `SIGNALS`, `TRAIN_CLEAR`), copiadas del bloque `ts` del issue.
- `station()` sin rng; `src/scenes/` sin pixi; sin hex fuera de la paleta.
- Detalle en caras +x, +y y techo; tamaño mínimo 0.15 u.
- Reglas de oclusión (issue, "Qué hay hoy"): al sur `y_min − 1.4·z_max ≥ 134.5`; al norte `y_max ≤ 130.8`; al este del tope `x_min − y_max ≥ 27.2` o `x_min − 1.4·z_max ≥ 158`.
- Comentarios y docstrings en castellano rioplatense, densidad como `shipyard.ts` (un comentario corto por pieza).
- Al final de cada tarea: sus tests en verde y `npm run typecheck` en verde (los tests de stage 3 de tareas posteriores pueden seguir rojos). Al final de Task 5: `npm test` entero en verde.

## Review Focus

1. **Semáforo de entrada contra el borde x 96.** Con la cabeza de 0.5 centrada en un poste de 0.3 anclado en `SIGNALS.in`, la cabeza arrancaría en x 95.9 y rompería la caja de `STATION` ampliada (x ≥ 96). Convención decidida (A1); la cubre el test de "todo cae en STATION".
2. **Tercer riel cruzando la calle.** La vía 3 recta arranca en x 104, dentro de la calle (x 100..108): un tercer riel ahí cruzaría el paso a nivel. Decidido en A2; test en stage 3: ningún `strip` `whitewash` de la estación tiene un punto con x < `CROSSING.x1` (108).
3. **Fajas en muros de altura 0.** El muro sur de la rampa sur y el norte de la rampa norte tienen altura 0: una placa ahí hereda normal nula y `tessellate` la descarta (`solids.ts`, comentario de `RAMP_WALL_EDGE`). Decidido en A3; test en stage 3: cada rampa `canopy` de marquesina, teselada sola, da al menos una cara `whitewash` con `normal.x > 0` (la placa este no se pierde), y por cada marquesina de andén hay un prisma `whitewash` de 0.25 de alto pegado a su borde sur (y0 = y1 de la marquesina).
4. **Empalme de la vía del oeste con la estación.** Los rieles de `parkingAndRails` terminan en x 104 y los de la vía 3 empiezan en x 104, en las mismas y (131, 134): sin hueco ni solape. Test en `shipyard.test.ts` (stage 3).
5. **El rng antes de la estación no cambia.** Los cinco autos de la playa siguen iguales con seed 7; la chatarra de `fittingOut` cambia y se re-mide. Test "el rng…" (stage 3).

## Assumptions

- **A1. Anclaje de semáforos y postes.** `SIGNALS.in/out` y `CROSSING.north/south` son la esquina NO (min x, min y) de su caja. Semáforo: cabeza `asphalt` x..x+0.5, y..y+0.5, z 3.5..4.7; poste `steel` 0.3×0.3 centrado bajo la cabeza (x+0.1..x+0.4, y+0.1..y+0.4), z 0..3.5. Postes del paso a nivel: x..x+0.3, y..y+0.3. Así el semáforo de entrada queda en x 96..96.5 (dentro de x ≥ 96) y su y máximo 130.1 ≤ 130.8.
- **A2. Tercer riel** de cada vía desde `max(TRACK_X0[i], CROSSING.x1)` hasta `BUFFER_X`: la vía 3 lo arranca en x 108 (los terceros rieles se cortan en los pasos a nivel); vías 1 y 2 desde 134 y 121.
- **A3. Faja de las marquesinas.** Placas `rect` `whitewash` de 0.25 en el muro este (`wall 1`) de cada rampa, solo en la mitad del muro de más de 0.25 de alto (rampa `dir "n"`: `u 0.5..1`; `dir "s"`: `u 0..0.5`), z 4.2..4.45. La faja sur no puede ser placa (muro de altura 0): es un prisma `whitewash` x0..x1 de la marquesina, y y1..y1+0.15, z 3.95..4.2, por fuera de la rampa (sobre la isla: y ≤ 129.65 ≤ 130.8).
- **A4. Columnas y luces.** Columnas centradas en x = x0 + 2.5 + 5k mientras x + 0.15 ≤ x1 (isla: 127.5…157.5, siete; lateral: 140.5…155.5, cuatro), en el eje del andén. Cabriada en cada columna: `beam` transversal y0→y1 a z 4 (w 0.2, h 0.2) y dos diagonales `beam` (w 0.15, h 0.15) de (x, y0, 4) y (x, y1, 4) a (x, ymid, 4.1), bajo la base de la rampa (z 4.2). Las piezas de una cabriada se tocan con la columna: no cuentan para "ningún sólido pisa otro", que se verifica en las vecindades nombradas. Luces `cyanMid` r 0.8 a z 3.9 en x = x0 + 5 + 10k < x1 (isla 130, 140, 150; lateral 143, 153) sobre el eje; en `HEAD`, bajo su techo plano (z 3.5), a z 3.4 en (163.75, 109 / 119 / 129).
- **A5. Durmientes de vías 1 y 2** en x = TRACK_X0[i] + 2, de 4 en 4, mientras x < BUFFER_X − 1 (vía 1: 136…156; vía 2: 123…155); los de la vía 3, x 110…158 como dice el issue.
- **A6. Franja amarilla** (`safety` 0.3 × 0.15 a z 1): `ISLAND` en sus dos bordes largos (y0..y0+0.3 y y1−0.3..y1), `SIDE` en el sur (y1−0.3..y1), `HEAD` en el oeste (x0..x0+0.3), que da a los topes. Columnas de `HEAD` en x 161.8..162.1, y 104 + 6k (104…128), z 1..3.5.
- **A7. Excepción "sobre la vía 3"** del test de oclusión: se exceptúa todo sólido con `min.x ≥ BUFFER_X` (topes y andén transversal con lo que lleva encima); el andén transversal cumple la regla del este (161.5 − 131 = 30.5).
- **A8. Materiales compartidos.** Medido con `world(7)`: la estación agrega a los sólidos de Portfolio `asphalt` (cabezas de semáforo; ciudad) y `deck` (tablones; Blog). `paving` no se usa. `safety`, `canopy` y `signal` no están en la ciudad ni en el Blog.
- **A10. Docstring de `shipyard.ts`.** Se conserva "la fábrica de Portfolio queda entre la calle y la playa de vías": habla de `factory.ts` (la fábrica, x < 100), no de la calderería. Se reemplaza solo lo que describe la zona al sur de las gradas. Alternativa descartada: reescribir el docstring entero.
- **A11. Corridas por tarea.** Cada tarea corre sus tests filtrados y `npm run typecheck`; la suite entera, al final de Task 5 y del stage 4. Alternativa descartada: `npm test` verde en cada commit, imposible con los tests de stage 3 de tareas posteriores todavía rojos.
- **A12. `h` de los exhibits** medido corriendo el test, no con una copia de `measure()`. Alternativa descartada: exportar `measure()` desde un módulo de producción solo para medir.
- **A9. Acentos del astillero tras el cambio:** `{ cyan: 7, cyanMid: 8, magenta: 3 }` (5 faroles de la calle + 2 del muelle; 3 + 2 + 3 luces de marquesina; 3 luces de tope).

## Tests de stage 3

Los escribe el orquestador antes de Task 1, en rojo. Lista cerrada (el detalle de cada aserción es el de la sección "Tests" del issue; acá, lo que el issue deja abierto):

- `src/scenes/station.test.ts` (nuevo): "constantes" (igualdad con los literales del issue: contrato con #278–#281); "determinista"; "todo cae en STATION (x 96..197, y 80..142) y nada elevado pasa z 6"; "vías: rieles, durmientes y tercer riel" (A2, A5); "abanico"; "andenes y franjas"; "marquesinas: columnas, cabriadas, fajas y luces" (A3, A4; Review Focus 3; 8 `cyanMid`); "topes con luz magenta" (3); "cerco"; "semáforos" (A1); "paso a nivel: tablones, postes y barreras" (A1, cuatro tramos por barrera); "oclusión: reglas sur, norte, este y sobre la vía 3" (A7: las reglas se aplican por geometría a todo sólido no plano de alto > 0.4, no por grupo); vecindades "marquesinas ↔ vías", "andenes ↔ vías", "paso a nivel ↔ calle", "estación ↔ playa", "estación ↔ faroles de la calle y camión" (cajas disjuntas en x, y o z con 1e-9).
- `src/scenes/shipyard.test.ts`: "la vía del oeste llega a x 104 y la estación la continúa hasta 160" (Review Focus 4); acentos (fuera de la estación cian; en la estación cian, cyanMid o magenta); "el rng…" sin prefabricados y con la chatarra re-medida con `tsx` sobre el código de Task 1 (autos iguales a hoy: `parkingAndRails` siembra los autos antes del bucle borrado, y `factory()` no recibe rng); "no queda nada de la calderería"; "faroles" sin cambios; faroles del muelle en y 20 y 80, ninguno en y 120.
- `src/scenes/portfolio-accents.test.ts`: `shipyard` → `{ cyan: 7, cyanMid: 8, magenta: 3 }` (A9).
- `src/scenes/world.test.ts` "no comparten materiales": `asphalt` a la lista de la ciudad y `deck` a la del Blog (A8).
- `src/lab/exhibits.test.ts`: `CATALOG.astillero` suma `"estacion", "paso-a-nivel"`.

Medición de A8 (`world(7)` en la base, `tsx`): Portfolio `brick concrete glass hull rust signal steel stockbrick whitewash`; ciudad `asphalt curtain leaf leafDark office officeDark paving plaza rust steel stone`; Blog `deck glass hull rock rust steel whitewash`.

---

### Task 1: Calderería fuera y `station.ts` con las constantes

**Files:**
- Modify: `src/scenes/shipyard.ts` (borrar `factory()` y el bucle de prefabricados de `parkingAndRails`; `quay(out, accents)` gana los faroles de y 20 y 80; docstring; llamada a `station`)
- Create: `src/scenes/station.ts` (constantes + `station()` vacío con docstring)
- Test: `src/scenes/shipyard.test.ts`, `src/scenes/station.test.ts` (stage 3)

**Interfaces:**
- Produces: las constantes del issue y `export function station(out: Solid[], accents: Accent[]): void`. Tasks 2–4 la llenan.

- [ ] **Step 1:** `npx vitest run src/scenes/shipyard.test.ts` → FAIL ("no queda nada de la calderería", "el rng…", acentos).
- [ ] **Step 2:** borrar `factory()` y el bucle de secciones prefabricadas; faroles del muelle (y 20, 80) en `quay()`, mismo poste y luz que hoy; `shipyard()` llama `station(solids, accents)` en lugar de `factory`. Docstring: la zona de producción al sur de las gradas es ahora la estación cabecera (`station.ts`), no la calderería; la frase "la fábrica de Portfolio queda entre la calle y la playa de vías" se conserva si sigue siendo cierta.
- [ ] **Step 3:** `station.ts` con el bloque de constantes del issue y docstring (estación cabecera tipo Tigre al final de la vía del oeste; las constantes son el contrato con los hijos siguientes; reglas de oclusión de `TRAIN_CLEAR`).
- [ ] **Step 4:** `npx vitest run src/scenes/shipyard.test.ts src/scenes/station.test.ts -t "constantes|calderería|rng|faroles|vía del oeste"` → los de esta tarea PASS.
- [ ] **Step 5:** Commit `feat(#277): calderería fuera; station.ts con las constantes`.

### Task 2: Vías, abanico, tercer riel y durmientes

**Files:** Modify `src/scenes/station.ts`. Test: `station.test.ts` ("vías…", "abanico", Review Focus 2 y 4).

**Interfaces:** Consumes las constantes de Task 1.

- [ ] **Step 1:** tests rojos `npx vitest run src/scenes/station.test.ts -t "vías|abanico|tercer riel"`.
- [ ] **Step 2:** por vía i, dos `strip` `rail` (ancho `RAIL_W`, z `RAIL_Z`) de `TRACK_X0[i]` a `BUFFER_X` en `TRACKS_Y[i] ± GAUGE/2`; durmientes `rust` 1×5×0.3 en (x, eje − 2.5) según A5 y el issue; tercer riel `strip` `whitewash` ancho 0.3, z 0.05, en eje + 2.1 según A2. Abanico: dos `strip` `rail` de `LADDER[0]` a `LADDER[1]` corridos ±1.5 en perpendicular al eje de la diagonal, sin durmientes.
- [ ] **Step 3:** los tests de Step 1 → PASS. Commit `feat(#277): vías, abanico y tercer riel de la estación`.

### Task 3: Andenes, marquesinas, topes y cerco

**Files:** Modify `src/scenes/station.ts`. Test: `station.test.ts` ("andenes", "marquesinas", "topes", "cerco", oclusión, vecindades marquesinas/andenes ↔ vías).

- [ ] **Step 1:** tests rojos `-t "andenes|marquesinas|topes|cerco"`.
- [ ] **Step 2:** andenes `concrete` h 1 en `ISLAND`, `SIDE`, `HEAD`; franjas `safety` (A6); baranda `canopy` x 165.8..166, y 104..131, z 1..2. Marquesinas de isla (x 125..158) y lateral (x 138..158): rampas `canopy` según el issue, columnas, cabriadas, fajas y luces según A3–A4. `HEAD`: prisma `canopy` x 161.5..166, y 104..131, z 3.5, h 0.3, columnas (A6), luces (A4). Topes `steel` x 160..161.5, eje ±1.5, h 1.2, placas `rect` en `wall 1` y `wall 2` en cuatro franjas alternadas `safety`/`asphalt` (u 0..0.25, 0.25..0.5, …, z 0..1.2), luz `magenta` r 0.35 en (160.75, eje, 1.5). Cerco `steel` x 110..160, y 136..136.3, h 1.
- [ ] **Step 3:** tests de Step 1 + "oclusión" → PASS. Commit `feat(#277): andenes, marquesinas, topes y cerco`.

### Task 4: Semáforos y paso a nivel

**Files:** Modify `src/scenes/station.ts`. Test: `station.test.ts` ("semáforos", "paso a nivel", vecindades paso a nivel ↔ calle, playa, faroles, camión; "todo cae en STATION").

- [ ] **Step 1:** tests rojos `-t "semáforos|paso a nivel|STATION|vecindad"`.
- [ ] **Step 2:** semáforos según A1. Paso a nivel: tablones `deck` z 0..0.3 en x 100..108 (y 131.3..133.7, 129.6..130.7, 134.3..135.4); postes `steel` h 3 (norte) y h 2 (sur) según A1; barreras: cuatro `beam` 0.25×0.25 a z 1 por barrera, tramos iguales alternando `signal`/`whitewash` empezando por `signal` junto al poste (norte x 99.7→107.7 en y 128.75; sur x 108.3→100.3 en y 137.75).
- [ ] **Step 3:** `npx vitest run src/scenes` → PASS. Commit `feat(#277): semáforos y paso a nivel estáticos`.

### Task 5: Exhibits, listas de materiales y acentos

**Files:** Modify `src/lab/exhibits.ts` (dos regiones tras `punta-norte`, comentario de una línea cada una como sus vecinos). Tests ya ajustados en stage 3: `exhibits.test.ts` (`CATALOG`), `world.test.ts`, `portfolio-accents.test.ts`.

- [ ] **Step 1:** `npx vitest run src/lab/exhibits.test.ts src/scenes/world.test.ts src/scenes/portfolio-accents.test.ts` → FAIL solo por `CATALOG` (los otros dos pasan desde Task 4).
- [ ] **Step 2:** `estacion` `{ x0: 108, y0: 98, x1: 198, y1: 143 }` y `paso-a-nivel` `{ x0: 98, y0: 124, x1: 112, y1: 142 }`, grupo `astillero`, zona `portfolio`, `h` = el menor entero que pasa "encuadre" y "vecinos". `measure()` no se exporta (vive en `exhibits.test.ts`): no se duplica; se baja `h` de a uno corriendo `npx vitest run src/lab/exhibits.test.ts -t astillero` hasta el menor que pasa, y el comentario dice que se midió así (como `punta-norte`).
- [ ] **Step 3:** `npm test && npm run typecheck` → PASS. Commit `feat(#277): exhibits estacion y paso-a-nivel`.

Después de Task 5, el orquestador saca `estacion-vias.png` (exhibit `#estacion`, 1600×900 a 2x) y corre `.scratch/evals-277.md`.

## Grilling

- Rondas: 1 (los cambios agregan detalle sin cambiar ninguna tarea ni ninguna costura: no hubo segunda ronda). Griller: `fable`.
- 18 preguntas: 6 respondidas con el issue (constantes, reglas de oclusión por geometría, `RAIL_Z` y tablones, `CROSSING` y barreras, vecindades nombradas, región `STATION`); 6 con el código (`shipyard.ts:258` filtra por `kind === "strip"`; autos antes del bucle borrado y `factory()` sin rng; `measure()` sin exportar en `exhibits.test.ts`; #276 ya en la base, con `canopy`/`tile`/`livery` en `palette-iso.ts`; `palette-guard.test.ts` y `pixi-free.test.ts`; las listas de `world.test.ts:68,72` y `portfolio-accents.test.ts`); 6 sin fuente, todas supuestos técnicos.
- Supuestos agregados: A10–A12, la sección "Tests de stage 3", Review Focus 3 endurecido (la placa este se verifica en la rampa sola), el conteo de 8 `cyanMid` fijado en `station.test.ts` y la corrida por tarea en Global Constraints.
- Ambigüedades de spec: ninguna. Issues abiertos: ninguno.
- Resultado: `ok`.
