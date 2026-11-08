# Portfolio centro: relleno del patio, dique seco y servicio; ventanas windowCool; chispas spark; guard por reglas (#324) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** llenar el centro del astillero de Portfolio (acopios y puente grúa en el patio de material, andamios, grúas torre y contenedores en el dique seco, franja de servicio entre las gradas y la estación), encender ventanas `windowCool` en naves, talleres y galpones, pasar las chispas de soldadura a `spark` y reescribir el guard de acentos de Portfolio como reglas.

**Arquitectura:** un módulo nuevo `src/scenes/shipyard-fill.ts` con tres funciones puras que `shipyard()` llama después de `fittingOut()` y antes de `jungle()`. Otro módulo nuevo, `src/scenes/portfolio-lights.ts`, elige las ventanas con la oclusión de `src/iso/depth.ts`, y `shipyard()` las suma al final de `accents`. Las chispas cambian de color en `shipyard-anim.ts`. El guard de `portfolio-accents.test.ts` deja de contar.

**Stack:** TypeScript estricto (`noUnusedLocals`), Vitest, Vite. Sin dependencias nuevas.

**Spec:** el issue #324 (manda sobre la spec de la historia, `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` §4.1 P4/P5/P7, §4.2 y §4.4).

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- Ningún literal hex fuera de `src/map/palette-iso.ts`, `palette-base.ts` y `seed.ts`. Para la semilla derivada se usa `2 ** 32 - 1`, como en `shipyard-anim.ts` (`SEED_MAX`).
- Toda aleatoriedad sale del `Rng` recibido; `Math.random` está prohibido. `src/iso/` y `src/scenes/` no importan Pixi.
- Portfolio: todo sólido elevado `max.y ≤ 90.5` o dentro de `STATION_LAND` (`seam-90.test.ts`). Todo lo nuevo queda en `y ≤ 80`.
- Presupuesto: `city-budget.test` ≤ 56 000 polígonos estáticos; no se suben topes.
- Commits `test(#324): …` / `feat(#324): …`, con `Co-Authored-By`.

## Decisiones técnicas declaradas (el issue no las fija o se contradice)

1. **`Scene.fill`:** el astillero expone `fill: { yard: Solid[][]; dock: Solid[][]; service: Solid[][] }`, una lista de piezas por función (cada pieza es un grupo de acopio, el puente grúa, una fila de andamios, una grúa torre, una pila de contenedores, un pallet apilado…). Son los mismos objetos que están en `solids` (o en `ground`, los rieles). Sin esto los tests no pueden distinguir lo nuevo de lo viejo. Las funciones devuelven sus piezas y además las empujan a `out`: `yardFill(out, rng): Solid[][]`, `dockWorks(out, accents, rng): Solid[][]`, `serviceStrip(out, rng): Solid[][]`.
2. **`dockWorks` recibe `rng`:** el issue escribe `dockWorks(out, accents)`, pero `stackContainers(…, 1, "x", rng)` necesita un `Rng`.
3. **Las tres funciones usan el `rng` del astillero** en el orden yard → dock → service, antes de `jungle()`. La selva puede cambiar de lugar; los tests de selva solo piden `≥ 5` conos.
4. **Tablones de andamio sin solaparse con los postes:** el poste ocupa `y 8.5..8.9` (fila norte) y `27..27.4` (fila sur). El tablón `8×0.6×0.2` a `z 0` va pegado al poste del lado del pozo: `y 8.9..9.5` en la fila norte y `26.4..27.0` en la sur, en `x p..p+8` para cada poste `p` salvo el último (seis tablones por fila).
5. **"Solapar" es AABB 3D estricto (1e-9) entre sólidos no planos de piezas distintas.** Dentro de una pieza se toca o se cruza (la grúa torre cruza mástil y cabina, por ejemplo). Los rieles son tiras (`strip`) y van al `ground`: no cuentan.
6. **Colocación por rechazo** (patio y servicio): caja en planta del grupo contra la caja en planta de **todo** `out` (incluidas las tiras, para no apoyar acopios sobre los rieles) y de lo ya colocado, con 0.5 de margen; 30 intentos por grupo con `rng.next()` para x y para y, y si ninguno entra se desiste.
7. **Ventanas candidatas solo en paredes rectangulares de planta baja:** `visibleWalls(s)` con `pts.length === 4`, `pts[0].z === pts[1].z === s.at.z` y normal `x > 0` o `y > 0`. El hastial de una nave (pentágono, con `pts[0]→pts[1]` vertical) y el segundo nivel del techo escalonado quedan fuera, porque `facadeWindows` asume la base en `pts[0]→pts[1]`. De los galpones, solo la pared este (`normal.x > 0`). Medido con `world(7)`: 64 candidatas, 28 ocultas por el astillero y 36 visibles.
8. **Identificación de los dueños de ventanas en `solids`:** las naves son `prism` `gable` `concrete` 90×16×10, los talleres `prism` `step` `concrete` 24×14×7 y los galpones `prism` `gable` 8×56 con `at.x ≥ 300` (de cualquier material, por si #323 los pasa a `sheetTeal`).
9. **Caja de una ventana:** `lightBox(pts)` de `src/city/lights.ts` (AABB ±0.05). El sólido dueño se excluye de los oclusores.
10. **Prueba de "no tapan" de lo nuevo** (como la rueda en `fair.test.ts`): por cada protegido `P` y cada sólido nuevo `N` no plano, si `overlaps(screenBounds(P), screenBounds(N))` entonces `isBehind(P, N)` es `false`. Protegidos: patas y viga del pórtico, el carro en los dos extremos de `trolleyRange`, el casco y la superestructura del dique seco, y las tres chimeneas (`STACKS`, cilindros de la fábrica de `world(7)`). Los trabajos del dique (andamios, grúas, contenedores) se prueban contra el pórtico y las chimeneas, no contra el casco del dique: están ahí para verse delante y encima de él.
11. **Franja de servicio:** si la prueba 10 falla para la semilla 7 por la pata sur del pórtico (`x 150..153, y 73..76`), se amplía el tramo saltado hacia el este (`x 147..160`) y se anota el desvío en el PR.

## Review Focus

1. **Ventana tapada por la fábrica:** la oclusión mira solo el astillero, y la fábrica tapa 2 de las 64 candidatas. Una encendida ahí brillaría a través del vagón o la grúa. Test en la tarea 5: con `world(7)`, ninguna ventana encendida queda oculta (`hides`) por un sólido elevado de `w.factory`.
2. **Determinismo con otra semilla:** el patio y el servicio desisten si no entra un grupo; con `shipyard(createRng(8))` también se cumplen los límites y el no-solapamiento. Test en las tareas 2 y 4 (semillas 7 y 8).
3. **El guard sin conteos tiene que poder fallar:** cada regla se prueba también con un acento intruso (un `amber` en el patio, un `spark` estático), es decir, la función que valida la regla se prueba sobre una lista con ese intruso. Test en la tarea 6.
4. **Chispas con `reducedMotion`:** nunca hay chispas y la capa queda vacía. Ya cubierto en `shipyard-anim.test.ts`, que se conserva.
5. **Exhibits recortados:** la grúa torre del sur (contrapluma en `x 108..116`) entra en `calle-faroles` (`x 99..111`). `exhibits.test` ("framing" / "neighbors") obliga a subir su `h` al valor medido. Tarea 3.

---

### Tarea 1: chispas `spark`

**Archivos:** modificar `src/scenes/shipyard-anim.ts` (`burst()`); tests en `src/scenes/shipyard-anim.test.ts`.

**Interfaces:** sin cambios de firma.

- [ ] **Paso 1: test (etapa 3)** `"the sparks are spark dots of r 0.6"`: igual que `"the sparks appear at a rib…"`, recorrer 20 000 ms de a 100; toda chispa vista es `dot`, `color === "spark"`, `r === 0.6`; y `seen > 5`. Los tests de frame 0 sin chispas y de `reducedMotion` se conservan.
- [ ] **Paso 2:** `npx vitest run src/scenes/shipyard-anim.test.ts` → FALLA (`cyan`).
- [ ] **Paso 3:** `burst()` emite `color: "spark"`. El `sparkRng.chance(0.6)` que elegía el color **se conserva** (el consumo del rng no cambia, ni los tests de chunking).
- [ ] **Paso 4:** el test pasa. Commit `feat(#324): welding sparks are spark`.

### Tarea 2: patio de material — acopios y puente grúa (`yardFill`)

**Archivos:** crear `src/scenes/shipyard-fill.ts`; modificar `src/scenes/shipyard.ts` (`Scene.fill`, la llamada); tests en `src/scenes/shipyard-fill.test.ts` (nuevo) y `src/scenes/shipyard.test.ts`.

**Interfaces:**
- Produce: `export interface Fill { yard: Solid[][]; dock: Solid[][]; service: Solid[][] }`; `Scene.fill: Fill`; `export const YARD = { x0: 104, y0: -59, x1: 192, y1: -36 }`; `export function yardFill(out: Solid[], rng: Rng): Solid[][]` (primero el puente grúa, después los acopios).

- [ ] **Paso 1: tests (etapa 3)** en `shipyard-fill.test.ts`, para `shipyard(createRng(seed))` con `seed ∈ {7, 8}`:
  - `"yard: 3..5 stock groups inside the yard, none above 3"`: `fill.yard.length - 1 ∈ [3, 5]` cuando entran (semilla 7: `≥ 3`); todo sólido de los grupos tiene la caja dentro de `x 104..192, y −59..−36` y `max.z ≤ 3`.
  - `"yard gantry: two rails, two steel legs 1×1×9 on the rails, a 1×24×1 beam at z 9 and a rust trolley at z 8"`: la primera pieza de `fill.yard` tiene dos `strip` `rail` con `path` de `(104, y)` a `(192, y)` para `y ∈ {−59.5, −35.5}`; patas `prism steel` `w 1 d 1 h 9` en `at (150, −59.5, 0)` y `(150, −36.5, 0)`, y cada una contiene en `[min.y, max.y]` la `y` de un riel; viga `prism steel` `at (150, −59.5, 9)` `1×24×1`; carro `prism rust 2×2×1` `at.z === 8` con la caja en `y −58.5..−36.5`, sin solaparse con las patas.
  - `"yard pieces do not overlap each other or the old solids"` (decisión 5).
  - En `shipyard.test.ts`, ajustes: el test de la banda norte pasa a `min.y ≥ −60`. El test `"material yard…"` pasa de igualdad a `arrayContaining` en chapas, caños, bobinas y secciones, y `pipes` a `≥ 12`. `yard()` del test de grupos disjuntos suma `fill.yard.flat()` sin tiras, y su caja queda en `x 104..192, y −60..−35.5`. Siguen siendo cinco grupos disjuntos.
- [ ] **Paso 2:** `npx vitest run src/scenes/shipyard-fill.test.ts src/scenes/shipyard.test.ts` → FALLA (no existe el módulo).
- [ ] **Paso 3:** `yardFill` arma el puente grúa (rieles `strip` de ancho 0.5 a `z 0.05`, como los del pórtico; carro en `at (149.5, −48.5, 8)`) y después `rng.int(3, 5)` grupos. Cada grupo es `rng.pick` de cuatro hacedores que tiran su tamaño una vez: `sheetStack(at, rng.int(2, 4))`, `pipeBundle(at, rng.int(8, 14))`, `coils(at, rng.int(2, 4))`, `hullSections(at, rng.int(1, 2))`. La colocación sigue la decisión 6 dentro de `YARD`. `shipyard()` crea `fill` y lo devuelve en el `Scene`.
- [ ] **Paso 4:** los tests de la tarea pasan y `npm test` no rompe nada más (selva: `≥ 5` conos). Commit `feat(#324): material yard fill and yard gantry`.

### Tarea 3: dique seco — andamios, grúas torre y contenedores (`dockWorks`)

**Archivos:** `src/scenes/shipyard-fill.ts`, `src/scenes/shipyard.ts`; tests en `src/scenes/shipyard-fill.test.ts`; `src/lab/exhibits.ts` (`h` de `calle-faroles` u otro que lo pida).

**Interfaces:**
- Consume: `Fill`, `DOCK` (`src/map/geo.ts`), `towerCrane` (`src/scenes/pieces.ts`), `stackContainers` (`src/kit/forms/industrial.ts`).
- Produce: `export function dockWorks(out: Solid[], accents: Accent[], rng: Rng): Solid[][]` → piezas en orden: fila norte de andamios, fila sur, grúa (116, 5), grúa (116, 31), contenedor (124, 2.5), contenedor (132, 2.5).

- [ ] **Paso 1: tests (etapa 3)**
  - `"dock scaffolding: two rows of steel 0.4 posts every 8 from z −6 to 0.5 and deck planks at z 0"`: dos filas; cada una tiene 7 postes `prism steel 0.4×0.4` con `at.z −6`, `h 6.5`, `at.x ∈ {128, 136, …, 176}` y `at.y` 8.5 o 27, y 6 tablones `prism deck 8×0.6×0.2` con `at.z 0` (decisión 4).
  - `"two small tower cranes with the mast in x 115.4..116.6"`: hay exactamente dos mástiles `prism steel` `w 1.2 h 14` en `fill.dock` con `min.x 115.4` y `max.x 116.6` (±1e-9), centrados en `y 5` y `y 31`, y hay dos acentos `dot cyan` nuevos en la punta (`x 128`).
  - `"site containers on the slab north of the dock"`: dos piezas de un `prism` 6×2.4×2.6 en `at (124, 2.5, 0)` y `(132, 2.5, 0)`.
  - `"nothing of the dock works stands in the pit except the scaffolding"`: todo sólido de grúas y contenedores tiene `min.z ≥ 0` o queda fuera de `x DOCK.x..DOCK.x+DOCK.w, y DOCK.y..DOCK.y+DOCK.d` en planta.
  - Decisión 5 para `fill.dock`.
- [ ] **Paso 2:** FALLA.
- [ ] **Paso 3:** `dockWorks` según el issue: `towerCrane(piece, accents, { at: { x: 116, y }, mastH: 14, jibLen: 12, dir: "e", light: "cyan" })`; contenedores `stackContainers(v3(x, 2.5, 0), 1, "x", rng)`.
- [ ] **Paso 4:** `npx vitest run src/scenes src/lab`. Si `exhibits.test` falla en "framing" o "neighbors", se sube el `h` del exhibit al valor medido (redondeado hacia arriba, dentro de `SLACK`) con un comentario `#324`. Commit `feat(#324): dry dock scaffolding, tower cranes and site containers`.

### Tarea 4: franja de servicio (`serviceStrip`) e invariantes del relleno

**Archivos:** `src/scenes/shipyard-fill.ts`, `src/scenes/shipyard.ts`; tests en `src/scenes/shipyard-fill.test.ts`.

**Interfaces:**
- Consume: `storeroom(lot, rng, style)` con `lot = { x, y: 76.5, w: 4, d: 3, z: 0, open: ["s"], maxH: 3 }` y `STYLES.industrial` (`src/kit/styles.ts`), y `stackContainers`.
- Produce: `export const SERVICE = { x0: 112, y0: 76.5, x1: 196, y1: 79.5, skip: [147, 156] }`; `export function serviceStrip(out: Solid[], rng: Rng): Solid[][]` → 12 piezas como máximo: 2 depósitos, 2 autoelevadores (`prism rust 2×3×2`), 3 pilas de pallets (`prism deck 1.2×1×0.5` × `rng.int(1, 4)` apilados), 3 baños químicos (`prism boxBlue 1×1×2.2`) y 2 contenedores de herramientas (`stackContainers(…, 1, "x", rng)`).

- [ ] **Paso 1: tests (etapa 3)**
  - `"service strip: inside x 112..196, y 76.5..79.5, never in x 147..156, none above 3"`, semillas 7 y 8; con la semilla 7 se colocan las 12 piezas. Las cuentas por tipo se verifican por forma.
  - `"the fill does not overlap itself or the old solids"`: decisión 5 sobre `[...yard, ...dock, ...service]`.
  - `"the fill does not cover the gantry, the dry dock hull or the chimneys on screen"`: decisión 10.
- [ ] **Paso 2:** FALLA.
- [ ] **Paso 3:** cada pieza se coloca por rechazo en el tramo (decisión 6), con `x` en `[x0, x1 − fw]` y la `y` fija en `76.5` (todas miden ≤ 3 de fondo). Se rechazan las posiciones que cruzan `skip`. Se coloca en el orden de la lista de arriba.
- [ ] **Paso 4:** pasa; si falla la prueba de pantalla, decisión 11. Commit `feat(#324): service strip between the slipways and the station`.

### Tarea 5: ventanas `windowCool` (`portfolioWindows`)

**Archivos:** crear `src/scenes/portfolio-lights.ts`; modificar `src/scenes/shipyard.ts`; tests en `src/scenes/portfolio-lights.test.ts` (nuevo).

**Interfaces:**
- Consume: `visibleWalls`, `facadeWindows`, `overlaps`, `screenBounds`, `hides`, `lightBox`, `WINDOW_ALPHA`.
- Produce: `export interface WindowCandidate { pts: Vec3[]; owner: Solid; hidden: boolean }`; `export function windowCandidates(solids: Solid[]): WindowCandidate[]`; `export function portfolioWindows(solids: Solid[], rng: Rng): Accent[]`. Facades: naves `{ floors: 1, cols: 12 }`, talleres `{ floors: 1, cols: 5 }`, galpones `{ floors: 1, cols: 10 }`.

- [ ] **Paso 1: tests (etapa 3)**, con `world(7)` y `windowCandidates(w.shipyard!.solids)`:
  - `"candidates: south walls of the halls, east and south of the workshops, east of the sheds"`: 64 candidatas, 36 visibles (las medidas de la decisión 7).
  - `"25..35 % of the visible candidates are lit, all windowCool polys with WINDOW_ALPHA"`: las `poly windowCool` de `w.shipyard.accents` son `round(0.3·36)`; cada una tiene `alpha === WINDOW_ALPHA` y coincide punto a punto con una candidata visible.
  - `"no lit window is hidden by another raised shipyard solid"`.
  - `"no lit window is hidden by a raised factory solid"` (Review Focus 1).
  - `"deterministic by seed"`: `portfolioWindows(solids, createRng(5))` da lo mismo dos veces y algo distinto con `createRng(6)`.
- [ ] **Paso 2:** FALLA.
- [ ] **Paso 3:** `windowCandidates` aplica las decisiones 7–9. `portfolioWindows` toma las visibles, saca una clave `rng.next()` por ventana en orden y enciende las `round(0.3·n)` de clave menor, conservando el orden de las candidatas. `shipyard()`, al final, hace `accents.push(...portfolioWindows(raised, createRng(rng.int(0, 2 ** 32 - 1))))`. Si falla el test de la fábrica: no se cambia la firma; se anota el caso y lo decide la etapa 5/6.
- [ ] **Paso 4:** pasa. Commit `feat(#324): windowCool windows in halls, workshops and sheds`.

### Tarea 6: guard por reglas y presupuestos

**Archivos:** reescribir `src/scenes/portfolio-accents.test.ts`; `src/scenes/world.test.ts` (presupuesto nuevo; `sharedWithCity` si cambia); `src/scenes/city-budget.test.ts` (solo verificar).

**Interfaces:** consume `STATION` (`station.ts`), `excavatorBox()` (`excavator.ts`) y `shipyardAnimator`.

- [ ] **Paso 1: tests (etapa 3)**
  - Un helper puro en el test, `ruleViolations(accents: Accent[]): string[]`, con el punto del acento (`at`, o `pts[0]`). Regla 1: color ∈ `{cyan, cyanMid, cyanBleed, windowCool, amber, amberBleed, magenta}`; y `amber`/`amberBleed`/`magenta` solo si el punto cae dentro de `STATION` (`x0 ≤ x ≤ x1`, `y0 ≤ y ≤ y1`), o tiene `z ≥ 20` (boca de chimenea), o cae dentro de `excavatorBox()` en planta.
  - `"rule 1: static colors of shipyard, factory and hinterland"`: `ruleViolations([...])` es `[]`.
  - `"rule 1 catches intruders"`: un `dot amber` en `(150, −50, 1)` y un `dot spark` dan dos violaciones (Review Focus 3).
  - `"rule 2: at least 30 cyan dots across the three scenes"`.
  - `"rule 3: no static accent of the world is spark"` (se conserva).
  - `"rule 4: windowCool only as poly, at least 6 in the shipyard"`.
  - `"rule 5: the shipyard.sparks layer only emits spark"`: `shipyardAnimator(w.shipyard, createRng(3), { reducedMotion: false })`, `tick(100)` hasta 20 000 ms; todas las chispas de `layer("sparks")` son `spark`, y hay al menos un evento.
  - `world.test.ts`: `"Portfolio budget: shipyard ≤ 900 raised solids, shipyard + factory ≤ 1 700"` (hoy, 380 y 775).
- [ ] **Paso 2:** reglas 1/2/3/4 pasan o fallan según el estado; la regla 5 FALLA hasta la tarea 1 y la regla 4 hasta la tarea 5.
- [ ] **Paso 3:** sin código de producción. Si `world.test` "no comparten materiales" falla porque `deck`, `boxBlue`, `boxRust`… o `sheetGreen` entran en la intersección con la ciudad, se agrega el material a `sharedWithCity` con el motivo en el comentario (`#324: …`).
- [ ] **Paso 4:** `npm test` y `npm run typecheck` en verde; `city-budget` ≤ 56 000. Commit `test(#324): Portfolio accent guard by rules and budgets`.

## Verificación visual (etapa 4)

`npm run dev -- --host --port 5173`. Con agent-browser a 1600×900 escala 2: `/lab/portfolio.html?speed=5` (patio, puente grúa, andamios, grúas chicas, franja de servicio, ventanas frías y chispas naranjas en las cuadernas); `/lab/world.html` (tecla `1`); `/lab/storybook.html#naves`, `#gradas` y `#calle-faroles`.
