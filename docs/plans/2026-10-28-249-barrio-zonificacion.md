# Barrio costero: zonificación, `tile`, `roofMat`, `tech.homes`, presupuesto y exhibits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el distrito tecnológico sin `lab` ni `atrium`, con el tipo de cada manzana decidido en un pre-pase (`zoneKinds`), los siete tipos nuevos del barrio como marcadores mínimos en módulos propios, el material `tile`, `roofMat` en los techos a dos aguas, la capa de luces `tech.homes`, el presupuesto de caras con sus tests y los siete exhibits del storybook.

**Architecture:** `tech-zoning.ts` (puro) decide `Kind[]` para `suburbBlocks()` antes de construir; `tech()` despacha cada tipo del barrio a un módulo `barrio-*.ts` / `costanera.ts` que recibe un `BarrioCtx` compartido. Las ventanas del barrio son `HomeWindow` (acentos, no caras) que `tech-anim.ts` anima con un reloj de pared. `tech-budget.ts` mide caras con `tessellate`.

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (solo en el render; todo lo de este plan es puro).

**Spec:** issue #249 (es la spec de esta tarea, con los valores exactos) y `docs/superpowers/specs/2026-10-27-barrio-costero-design.md` (historia #240). Leer el cuerpo del issue: `gh issue view 249 --repo nicolas-ricc/nicolas-ricc.github.io`.

## Global Constraints

- `npm test` y `npm run typecheck` en verde al final de cada tarea (incluida `palette-guard.test.ts`: ningún literal `0x…` de 6 dígitos fuera de `palette-base.ts`/`palette-iso.ts`).
- Determinismo: mismo rng → misma escena (`JSON.stringify` igual).
- Estilo del repo: comentarios y docstrings en castellano, líneas largas de una sola expresión como en `tech.ts`, docstring corto por función. Los identificadores son los que fija el issue (`lawn`, `homeWindow`, `HomeWindow`, `facesIn`, `blockRect`, `HOMES_GAP_MS`…), aunque mezclen idiomas como ya hace el código (`pickKind`, `quay`).
- Medido en `b9550c5` (rama base, igual a `main`) con `tech(zoneRng(SEED, "cv", 2))`, sólidos + suelo, `tessellate(s).length`: **`TECH_FACES_BEFORE = 8458`** (7198 de sólidos), **`REGION_FACES_BEFORE = 1286`** (región `{ x0: 42, y0: 472, x1: 186, y1: 610 }`, `bounds` dentro del rect inflado 0.5). El issue estimaba ≈ 1316; se usa el medido.
- Resume sigue ámbar: ninguna luz nueva cian ni magenta.
- No tocar `TELECOM`/`ARENA`/`AUDITORIUM`, `tower`, `campus`, `park`, `telecom`, `arena`, `auditorium`, `avenue`.

## Review Focus

1. Ciclo de imports `tech.ts` ↔ `tech-zoning.ts`: `zoneKinds` necesita `TOWER_D` y los hitos. Decisión: `TOWER_D`, `TELECOM`, `ARENA`, `AUDITORIUM` se definen en `tech-zoning.ts` y `tech.ts` los reexporta (los importadores actuales, p. ej. `src/lab/exhibits.ts`, no cambian). Test: `tech-zoning.test.ts` importa los hitos desde `./tech` y desde `./tech-zoning` y son el mismo objeto.
2. Dos plazas vecinas en el barrio ((132,472) y (132,496)) tienen firmas de variedad iguales si el marcador no depende de la paridad: los faroles de la plaza van en posiciones distintas según `blockParity` (Task 5). Lo pin‑ea el test de variedad (Task 6).
3. Nombres de grupo de `HomeWindow` únicos en todo el mundo (si dos manzanas reusan `"0"`, invertir un grupo apagaría ventanas de otra manzana). Test en Task 4/5: todos los grupos de una manzana llevan el prefijo `${b.x},${b.y}` salvo los fijos `"escuela-escalera"` y `"club-gimnasio"`.
4. Orden del rng en `createTechAnim`: el `homesRng` se deriva **después** de inicializar todo el estado existente (`lit`, `blinkTimer`, `flipTimer`), para no mover las tiradas de torres y coronas. Test (Task 7): con una escena sin `homes`, `windows()`/`neon()` tras N ticks son iguales a los de la misma escena con `homes` (las ventanas de torres no dependen de las luces del barrio).
5. `tick` con `dtMs` no finito (NaN/Infinity) colgaría el `while`: igual que `city-anim.ts`, `!Number.isFinite(dtMs) || dtMs <= 0` → nada cambia. Test en Task 7.

---

### Task 1: material `tile`

**Files:**
- Modify: `src/map/palette-base.ts` (al final de `BASE_TONES`), `src/map/palette-iso.ts` (al final de `ISO_TONES`)
- Test: `src/map/palette-iso.test.ts`

**Interfaces:** Produces: `Material` incluye `"tile"`.

- [ ] Step 1: test `"tile es cálido: teja terracota"` en `palette-iso.test.ts`: con `t = BASE_TONES.tile.top`, `r = t >> 16 & 255` etc., `expect(r).toBeGreaterThan(b + 60)` y `expect(r).toBeGreaterThan(g + 40)`.
- [ ] Step 2: `npx vitest run src/map/palette-iso.test.ts` → FAIL (`tile` no existe / typecheck).
- [ ] Step 3: `tile: { top: 0xb0603c, lit: 0x904725, shade: 0x462824, up: 0xcc6c3d, down: 0x975438 }` en `BASE_TONES` (verificar con la regla ciudad/costa del docstring de `palette-iso.ts`; usar los recalculados si difieren en ±1). `npm run palette` y pegar la línea `tile` impresa en `ISO_TONES` precedida de `// barrio costero (#240): teja`. Si `tile` ya existiera, no tocarlo.
- [ ] Step 4: `npx vitest run src/map` → PASS (incluye la guarda y los 5 tonos ordenados).
- [ ] Step 5: commit `feat(#249): material tile`.

### Task 2: `roofMat` en el techo a dos aguas

**Files:**
- Modify: `src/iso/solids.ts` (tipo `Solid` prism, `gable()`, `tessellateAll`), `src/scenes/city-pieces.ts` (`Extra`, `prism()`)
- Test: `src/iso/solids.test.ts`, `src/scenes/city-pieces.test.ts` si existe (si no, en `solids.test.ts`)

**Interfaces:** Produces: prism `roofMat?: Material`; `Extra = { roof?; facade?; roofMat?: Material }`.

- [ ] Step 1: tests en `solids.test.ts`:
  - `"gable sin roofMat: caras idénticas a hoy"`: `expect(tessellateAll({ kind: "prism", at: v3(1, 2, 0), w: 5, d: 4, h: 3, mat: "whitewash", roof: "gable" })).toMatchInlineSnapshot()` y lo mismo con `w: 4, d: 5` (generar el snapshot **antes** de tocar `gable()`).
  - `"gable con roofMat: solo las dos vertientes llevan roofMat"`: para ambas orientaciones, `faces.filter(f => f.mat === "tile")` tiene longitud 2 y cada una tiene `normal.z > 0` y no es la base (`normal.z` ≠ la de la base); las otras 5 caras son `whitewash`; `bounds` igual con y sin `roofMat`.
  - `prism(0, 0, 0, 5, 4, 3, "whitewash", { roof: "gable", roofMat: "tile" }).roofMat === "tile"`; sin `roofMat` la clave no existe.
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: `gable(at, w, d, h, mat, roofMat = mat)`: las dos vertientes con `roofMat`; `tessellateAll` pasa `s.roofMat`. `prism()` copia `roofMat` solo si viene.
- [ ] Step 4: `npx vitest run src/iso src/scenes/city-pieces*` → PASS.
- [ ] Step 5: commit `feat(#249): roofMat en techos a dos aguas`.

### Task 3: zonificación en pre-pase (`src/scenes/tech-zoning.ts`)

**Files:**
- Create: `src/scenes/tech-zoning.ts`, `src/scenes/tech-zoning.test.ts`
- Modify: `src/scenes/tech.ts` (solo mover `TOWER_D`, `TELECOM`, `ARENA`, `AUDITORIUM` a `tech-zoning.ts` y reexportarlos: `export { ARENA, AUDITORIUM, TELECOM, TOWER_D } from "./tech-zoning"`; `pickKind` sigue hasta Task 6)

**Interfaces:**
- Consumes: `SprawlBlock`, `suburbBlocks()` (`sprawl-grid.ts`), `Rect` (`city-grid.ts`), `WORLD` (`map/geo.ts`), `inCoverQuad` (`map/geo.ts`), `Rng`.
- Produces:
  - `export type Kind = "tower" | "campus" | "monoblock" | "casas" | "park" | "plaza" | "escuela" | "club" | "telecom" | "arena" | "auditorium"`
  - `export const TOWER_D = 60, MONOBLOCK_D = 130`; `TELECOM = { x: -114, y: 242 }`, `ARENA = { x: 102, y: 448 }`, `AUDITORIUM = { x: 12, y: 352 }` (as const, valores de hoy)
  - `export const SCHOOL = { x: 102, y: 520 } as const, CLUB = { x: 132, y: 544 } as const, PLAZAS = [{ x: 132, y: 496 }, { x: 72, y: 472 }] as const`
  - `export const inBarrio = (b: SprawlBlock): boolean => b.y > WORLD.y1 && b.dist >= TOWER_D`
  - `export const blockParity = (b: Rect): 0 | 1 => (Math.round((b.x + 84) / 30) + Math.round((b.y - 328) / 24)) & 1`
  - `export function zoneKinds(rng: Rng, blocks: readonly SprawlBlock[]): Kind[]`

- [ ] Step 1: `tech-zoning.test.ts` (rng del mundo `zoneRng(SEED, "cv", 2)` de `./world`, bloques `suburbBlocks()`):
  - ningún tipo devuelto es `"lab"` ni `"atrium"` (comparar como `string`), y todos están en la lista de `Kind`;
  - con semillas `createRng(1)`, `createRng(7)`, `zoneRng(SEED, "cv", 2)`: el bloque en `SCHOOL` → `escuela`, `CLUB` → `club`, cada `PLAZAS` → `plaza`, `TELECOM`/`ARENA`/`AUDITORIUM` → sus tipos (y los cuatro bloques fijos existen en `suburbBlocks()`);
  - visibles en el cover (`inCoverQuad(b.x + 12, b.y + 9, 16 / 9, 0)`): ≥ 2 `monoblock`, ≥ 4 `casas`, 1 `escuela`, 1 `club`, ≥ 2 `plaza`;
  - (132,448) es `monoblock`, (132,520) es `casas`;
  - ningún `monoblock` tiene vecino `monoblock` (vecino: mismo `y` y |dx| = 30, o mismo `x` y 0 < |dy| ≤ 30);
  - ningún `park` con `inBarrio(b)`;
  - rng espía (`{ ...rng, chance: (p) => { calls++; return rng.chance(p) }, next/int/pick contados también }`): llamadas totales = `blocks.length − fijas` (fijas = bloques en hitos, `SCHOOL`, `CLUB`, `PLAZAS`), todas a `chance(0.12)`;
  - tabla del mundo (`toEqual` sobre los conteos; verificada por el orquestador con este algoritmo antes de planificar): 34 tower, 15 campus, 18 monoblock, 17 casas, 7 plaza, 10 park, 1 escuela, 1 club, 1 telecom, 1 arena, 1 auditorium; visibles en el cover 13 monoblock, 8 casas, 1 escuela, 1 club, 4 plaza;
  - toda pareja de vecinas con `inBarrio` en las dos tiene paridad distinta (las únicas vecinas de igual paridad del distrito están a ambos lados de la avenida, y 242 → 272, fuera del barrio);
  - `TELECOM` importado de `./tech` es el mismo objeto que el de `./tech-zoning`.
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: implementar `zoneKinds` exactamente con este orden por manzana, en el orden recibido: hito → su tipo (sin rng); `SCHOOL` → `escuela`, `CLUB` → `club`, `PLAZAS` → `plaza` (sin rng); si no, **un** `rng.chance(0.12)` → `inBarrio(b) ? "plaza" : "park"`; si no, `b.dist < TOWER_D` → `tower`; `b.dist < MONOBLOCK_D` → `blockParity(b) === 0 ? "monoblock" : "campus"`; resto `casas`.
- [ ] Step 4: `npx vitest run src/scenes/tech-zoning.test.ts src/scenes/tech.test.ts src/lab` → PASS; `npm run typecheck`.
- [ ] Step 5: commit `feat(#249): zonificación del barrio en pre-pase`.

### Task 4: contexto del barrio y marcadores de escuela, club y costanera

**Files:**
- Create: `src/scenes/barrio.ts`, `src/scenes/barrio.test.ts`, `src/scenes/barrio-escuela.ts` (+ `.test.ts`), `src/scenes/barrio-club.ts` (+ `.test.ts`), `src/scenes/costanera.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `prism` de `city-pieces.ts`; `WEST_QUAY`, `CITY_EDGE` de `city-grid.ts`; `REACH` de `sprawl-grid.ts`; `WORLD`.
- Produces:
  - `export const ALWAYS_LIT: ReadonlySet<string> = new Set(["escuela-escalera", "club-gimnasio"])`: grupos que la capa `tech.homes` nunca apaga (plan de #240, decisión 9: "bandas del gimnasio y caja de escalera de la escuela siempre `lit`").
  - `export interface HomeWindow { pts: Vec3[]; lit: boolean; group: string }`
  - `export interface BarrioCtx { solids: Solid[]; ground: Solid[]; accents: Accent[]; homes: HomeWindow[]; rng: Rng }`
  - `export function lawn(ctx: BarrioCtx, b: Rect): void` — un `prism(b.x, b.y, 0, b.w, b.d, 0.05, "leafDark")` a `ctx.solids`
  - `export function homeWindow(ctx: BarrioCtx, pts: Vec3[], lit: boolean, group: string): void` — `ctx.homes.push({ pts, lit, group })`
  - `export function escuela(ctx: BarrioCtx, b: SprawlBlock): void`, `club(ctx, b)`, `costanera(ctx: BarrioCtx): void`
  - Helper local permitido en `barrio.ts`: `export function wallWindow(...)` que arma los 4 puntos de un rectángulo sobre una pared `x = cte` o `y = cte` (los usan Tasks 4 y 5; firma a criterio, documentada).

- [ ] Step 1: tests mínimos, cada uno con un ctx nuevo (`createRng(7)`) y la manzana real del módulo (`suburbBlocks().find(...)`):
  - `barrio.test.ts`: `lawn` agrega 1 prisma `leafDark` h 0.05 del tamaño de la manzana; `homeWindow` agrega una entrada con los valores dados.
  - `barrio-escuela.test.ts` (manzana `SCHOOL`): no vacío; todo `bounds` dentro de la manzana ±0.5; zócalo `paving` 0.3 de la manzana entera y prisma `whitewash` 6×16×5.6 en `(x+2, y+1, 0.3)`; exactamente una `HomeWindow`, `lit: true`, grupo `"escuela-escalera"`, 4 puntos con `x = b.x + 8`, 1×1; caras (`tessellate`) ≤ 120.
  - `barrio-club.test.ts` (manzana `CLUB`): zócalo `paving` 0.3 + prisma `stone` 10×6×9 en `(x+2, y+11, 0.3)`; una `HomeWindow` `lit: true`, grupo `"club-gimnasio"`, puntos con `y = b.y + 17`; dentro de la manzana; caras ≤ 150.
  - `costanera.test.ts`: el primer sólido es `prism(WEST_QUAY.x0, CITY_EDGE.south, -1, WEST_QUAY.x1 - WEST_QUAY.x0, WORLD.y1 + REACH.s - CITY_EDGE.south, 1.6, "plaza")` (`toEqual`); el resto son los bolardos `cylinder` `rust` r 0.4 h 0.8 `sides 6` en `x0 + 3`, y desde `CITY_EDGE.south + 8` cada 24 mientras `y < WORLD.y1 + REACH.s` (la misma fórmula de `quay()` hoy, `tech.ts:162-166`); no toca `ctx.rng` (rng espía sin llamadas), ni `ground`, `accents`, `homes`; caras ≤ 350; `bounds.max.x ≤ 198`.
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: implementar. `costanera` es `quay()` movida tal cual a `ctx.solids` (en `tech.ts` todavía no se borra `quay`; lo cambia Task 6).
- [ ] Step 4: correr los cuatro tests → PASS; `npm run typecheck`.
- [ ] Step 5: commit `feat(#249): contexto del barrio, escuela, club y costanera como marcadores`.

### Task 5: marcadores de monoblock, casas y plaza

**Files:**
- Create: `src/scenes/barrio-monoblock.ts`, `src/scenes/barrio-casas.ts`, `src/scenes/barrio-plaza.ts`, cada uno con `.test.ts`

**Interfaces:**
- Consumes: Task 3 `blockParity`; Task 4 `BarrioCtx`, `lawn`, `homeWindow`, `wallWindow`; `lamp`, `prism` de `city-pieces.ts`.
- Produces: `monoblock(ctx: BarrioCtx, b: SprawlBlock): void`, `casas(ctx, b)`, `plaza(ctx, b)`.

Geometría (del issue; los grupos de `HomeWindow` llevan prefijo `${b.x},${b.y}:`):
- **monoblock:** `lawn`; zócalo `paving` 20×5×0.3 en `(b.x + 2, py, 0.05)` con `py = b.y + 2` si paridad 0, `b.y + 11` si 1; placa `whitewash` 20×5×h encima (z 0.35), `h = ctx.rng.pick([12, 15, 18])`; ventanas por piso de 3 u (`h / 3` pisos), 8 de 0.9×0.9 en la pared sur (`y = py + 5`) y 2 en la este (`x = b.x + 22`), centradas en cada vano (vanos de 2.5 u), centro vertical a 1.5 u del piso; `lit = ctx.rng.chance(0.38)`; un grupo por ventana; `lamp()` en `(b.x + 23, b.y - 1.5)` y `(b.x + 1, b.y + 18.6)`.
- **casas:** `lawn`; `n = 4 + ctx.rng.int(0, 2)` casas `prism(..., "whitewash", { roof: "gable", roofMat: "tile" })` h 3 en z 0.05, `w 5, d 4` si paridad 0, `w 4, d 5` si 1; lotes de 8 u: los 6 lotes en orden fila `y + 2` columnas `x + 1.5 + 8k` (k = 0..2), después fila `y + 10`, se usan los `n` primeros; una ventana 0.7×0.8 centrada en la pared sur de cada casa, `lit = ctx.rng.chance(0.27)`; `lamp()` en `(b.x + 23, b.y - 1.5)` y `(b.x + 1, b.y + 18.6)`.
- **plaza:** `lawn`; dos `strip` `paving` ancho 1.2 a `ctx.ground` en z 0.08: NO→SE `(x, y)→(x+w, y+d)` y SO→NE `(x, y+d)→(x+w, y)`; `cylinder` `signal` r 1.6 h 0.4 `sides 8` en z 0.05, centro `(x + 18, y + 4.5)` (NE) si paridad 0 o `(x + 6, y + 13.5)` (SO) si 1; faroles por paridad (Review Focus 2): paridad 0 en `(b.x + 23, b.y - 1.5)` y `(b.x + 1, b.y + 18.6)`, paridad 1 en `(b.x + 1, b.y - 1.5)` y `(b.x + 23, b.y + 18.6)`.

- [ ] Step 1: tests por módulo, sobre (132,448) para monoblock, (132,520) y su vecina (102,520)… usar una manzana de cada paridad (`{ x: 132, y: 520 }` y `{ x: 132, y: 496 }` construidas a mano como `SprawlBlock` con `w 24, d 18, dist` cualquiera) para casas y plaza:
  - no vacío; todo `bounds` dentro de `x−2..x+26, y−2..y+20` (incluye faroles); caras (`tessellate`, sólidos + suelo) ≤ tope: monoblock 115, casas 64, plaza 60;
  - monoblock: `homes.length === (h / 3) * 10`; cada ventana con 4 puntos en `y = py + 5` o `x = b.x + 22`; grupos únicos y con prefijo `${b.x},${b.y}:`;
  - casas: `n` casas en 4..6, cada una gable con `roofMat: "tile"`; `homes.length === n`; las dos paridades dan huellas distintas (w/d invertidos);
  - plaza: 2 strips, un cilindro `signal`; los faroles de paridad 0 y 1 caen en posiciones distintas.
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: implementar.
- [ ] Step 4: tests → PASS; typecheck.
- [ ] Step 5: commit `feat(#249): marcadores de monoblock, casas y plaza`.

### Task 6: `tech()` sin labs ni atrios, despacho al barrio y tests de la escena

**Files:**
- Modify: `src/scenes/tech.ts`, `src/scenes/tech.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces: `TechScene` suma `homes: HomeWindow[]`; `TECH_MATS` suma `"tile", "brick", "whitewash", "signal", "safety", "hullBlue", "sand"`.

- [ ] Step 1: en `tech.test.ts` (además de lo que ya hay):
  - quitar las expectativas de "> 40 rampas glass" y de "> 3 cajas officeDark h 5 w 20" (el resto de ese `it` se queda, con título sin laboratorios); tope de sólidos elevados `< 2500`;
  - fachada: "cada prisma de h ≥ 3 y w,d ≥ 4 de material `curtain`, `office`, `officeDark` o `glass` lleva `facade`" (ajustar el `> 80` al conteo real si hace falta, dejando un mínimo > 0 con comentario);
  - **variedad** sobre `tech(zoneRng(SEED, "cv", 2))` con `zoneKinds(zoneRng(SEED, "cv", 2), suburbBlocks())` para los tipos: firma = `kind + "|" + n + "|" + huellas`, `n` = sólidos no planos con `bounds` en `blockRect(b)` (definir `blockRect` local o importarlo de Task 8 si ya está; si no, `{ x0: b.x − 2, y0: b.y − 2, x1: b.x + 26, y1: b.y + 20 }`), huellas = `x, y, w, d` relativas a la manzana redondeadas a 0.5 de los `prism`/`poly`/`ramp` con h ≥ 1, ordenadas; para todo par de vecinas (definición de Task 3) con `inBarrio` en ambas, firmas distintas;
  - **luces**: las ventanas de un mismo `group` tienen todas el mismo `lit` en la escena; toda `HomeWindow` tiene 4 puntos coplanares en `x = cte` o `y = cte`; fracción `lit` de las ventanas dentro de manzanas `monoblock` en [0.30, 0.45]; `casas` en [0.15, 0.40]; todas las de `escuela`/`club` `lit`;
  - no hay `prism` `officeDark` 20×13×5 ni pares `curtain` 9×13 (labs/atrios) en la escena.
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: en `tech()`: `const kinds = zoneKinds(rng, blocks)` antes de construir nada; luego un solo recorrido en el mismo orden y el mismo `rng`; `ctx: BarrioCtx = { solids, ground, accents, homes, rng }`; `monoblock`/`casas`/`escuela`/`club`/`plaza` a sus módulos; `costanera(ctx)` en lugar de `quay()`. Borrar `pickKind`, `atrium`, `lab`, `LAB_FACADE`, `quay`, `CAMPUS_D` (sin otros usos en `src/`) y el import `tiles`/`plazaTone` si queda sin uso. Docstring de `tech.ts`: barrio residencial costero al sur (monoblocks, casas, escuela, club, plazas, costanera) en lugar de laboratorios y atrios; remite además a `docs/superpowers/specs/2026-10-27-barrio-costero-design.md`.
- [ ] Step 4: `npx vitest run src/scenes src/world src/lab` → PASS (`world.test.ts`, `animators.test.ts`, `tech-animator.test.ts` incluidos); typecheck.
- [ ] Step 5: commit `feat(#249): el distrito construye el barrio en lugar de labs y atrios`.

### Task 7: capa de luces `tech.homes`

**Files:**
- Modify: `src/scenes/tech-anim.ts`, `src/scenes/tech-animator.ts`, `src/scenes/tech-anim.test.ts`, `src/scenes/tech-animator.test.ts`

**Interfaces:**
- Consumes: `TechScene.homes` (Task 6).
- Produces: `export const HOMES_GAP_MS: [number, number] = [3000, 7000]`; `TechAnimChanges.homes: boolean`; `TechAnim.homes(): Accent[]` y `TechAnim.fired(): { homes: number }`; capa `"tech.homes"` en `techAnimator`.

- [ ] Step 1: tests en `tech-anim.test.ts` (escena `tech(createRng(7))`, anim `createRng(3)`):
  - frame 0: `anim.homes()` es exactamente `scene.homes.filter(h => h.lit).map(h => ({ kind: "poly", pts: h.pts, color: "amber", alpha: 1 }))`;
  - tras `HOMES_GAP_MS[1] + 100` ms en ticks de 100: algún `tick().homes` fue `true`, `fired().homes ≥ 1`, y en todo momento las ventanas de un mismo grupo comparten estado (comparar el conjunto de `pts` encendidos con los grupos de `scene.homes`);
  - troceado: dos animadores con la misma semilla; uno `tick(60000)`, el otro 600 × `tick(100)`: `fired().homes` igual y `homes()` igual;
  - `reducedMotion`: 100 ticks de 100 → `homes()` igual al frame 0 y `tick().homes` siempre `false`;
  - `tick(NaN)`, `tick(Infinity)`, `tick(0)`, `tick(-5)`: no cambia nada y termina (Review Focus 5);
  - `ALWAYS_LIT`: en 120 s de ticks de 100 ms las ventanas de `"escuela-escalera"` y `"club-gimnasio"` siguen en `homes()` siempre;
  - sin homes (`{ ...scene, homes: [] }`): `homes()` es `[]` y en 60 s de ticks `homes` nunca es `true`;
  - Review Focus 4: misma secuencia de ticks sobre `scene` y `{ ...scene, homes: [] }` → `windows()` y `neon()` iguales;
  - actualizar el test de reduced-motion existente para el objeto con `homes: false`.
  - `tech-animator.test.ts`: los ids ordenados suman `"tech.homes"`.
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: implementar con el patrón de `city-anim.ts`: `const SEED_MAX = 2 ** 32 - 1` (con el comentario de por qué no `0x…`); estado `lit` por grupo copiado de `scene.homes` (la escena garantiza que un grupo es homogéneo, test de Task 6); la lista de grupos que el reloj sortea excluye `ALWAYS_LIT`; `homesRng = createRng(rng.int(0, SEED_MAX))` derivado **después** del estado existente; en `tick`, tras la guarda `opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0`: `homesTimer -= dtMs; while (homesTimer <= 0 && groups.length > 0) { homesTimer += homesRng.int(...HOMES_GAP_MS); invertir groups[homesRng.int(0, groups.length − 1)]; homesFired++; c.homes = true }`. Docstring del módulo: una línea sobre las ventanas del barrio.
- [ ] Step 4: `npx vitest run src/scenes src/world` → PASS; typecheck.
- [ ] Step 5: commit `feat(#249): capa tech.homes con reloj de pared`.

### Task 8: presupuesto de caras (`src/scenes/tech-budget.ts`)

**Files:**
- Create: `src/scenes/tech-budget.ts`
- Modify: `src/scenes/tech.test.ts` (tests de presupuesto); si Task 6 definió un `blockRect` local, reemplazarlo por el de acá

**Interfaces:**
- Produces: `facesIn(solids: readonly Solid[], r: { x0: number; y0: number; x1: number; y1: number }): number`; `blockRect(b: Rect)`; `BARRIO_REGION = { x0: 42, y0: 472, x1: 186, y1: 610 }`; `COSTANERA_RECT = { x0: 186, y0: 324, x1: 198.5, y1: 624 }`; `TECH_FACES_BEFORE = 8458`; `REGION_FACES_BEFORE = 1286` (comentario: medidos en `b9550c5`, rama base = `main`, con `tech(zoneRng(SEED, "cv", 2))`, sólidos + suelo, `tessellate`); `FACE_CAPS: Record<"monoblock" | "casas" | "plaza" | "escuela" | "club" | "costanera", number> = { monoblock: 115, casas: 64, plaza: 60, escuela: 120, club: 150, costanera: 350 }`; `ACCENT_CAP = 1300`.

- [ ] Step 1: tests en `tech.test.ts` sobre `tech(zoneRng(SEED, "cv", 2))`, `todo = [...solids, ...ground]`:
  - `facesIn` cuenta un prisma adentro (3 caras visibles) y no cuenta uno que asoma 0.6 afuera (unitario);
  - `facesIn(todo, { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 }) ≤ Math.floor(TECH_FACES_BEFORE * 1.10)`;
  - `facesIn(todo, BARRIO_REGION) ≤ Math.floor(REGION_FACES_BEFORE * 1.25)`;
  - por cada manzana de tipo `monoblock|casas|plaza|escuela|club` (según `zoneKinds`): `facesIn(todo, blockRect(b)) ≤ FACE_CAPS[kind]`;
  - `facesIn(todo, COSTANERA_RECT) ≤ FACE_CAPS.costanera`;
  - acentos: `scene.accents.length + Σ layer(id).accents.length` de `techAnimator(scene, createRng(SEED + 5), { reducedMotion: false })` en el frame 0 ≤ `ACCENT_CAP`.
- [ ] Step 2: correr → FAIL (módulo inexistente).
- [ ] Step 3: implementar.
- [ ] Step 4: tests → PASS. Imprimir una vez (y anotar en el reporte, sin commitear el `console.log`) el total y la región después de los marcadores.
- [ ] Step 5: commit `feat(#249): presupuesto de caras del distrito`.

### Task 9: exhibits del barrio en el storybook

**Files:**
- Modify: `src/lab/exhibits.ts` (grupo `tecnologico`, después de `torres`), `src/lab/exhibits.test.ts` (`CATALOG.tecnologico`), `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` (fila "Resume: tecnológico" de §3 y la de §10 si existe)

**Interfaces:** Consumes: `SCHOOL`, `CLUB`, `PLAZAS` de `tech-zoning.ts`; `BLOCK_W`, `BLOCK_D`; `M = 3`.

- [ ] Step 1: `CATALOG.tecnologico = ["mastil", "arena", "auditorio", "torres", "monoblock", "casas", "escuela", "club", "plaza-barrio", "costanera", "barrio"]`.
- [ ] Step 2: `npx vitest run src/lab/exhibits.test.ts` → FAIL.
- [ ] Step 3: exhibits `kind: "region"`, `zone: "cv"`, `group: "tecnologico"`, en este orden: `monoblock` "Monoblock" caja manzana (132, 448) ± M (`x0 = x − M, y0 = y − M, x1 = x + BLOCK_W + M, y1 = y + BLOCK_D + M`); `casas` "Casas con techo de teja" (132, 520) ± M; `escuela` "Escuela" `SCHOOL` ± M; `club` "Club" `CLUB` ± M; `plaza-barrio` "Plaza de barrio" `PLAZAS[0]` ± M; `costanera` "Costanera" `{ x0: 184, y0: 480, x1: 199, y1: 560 }`; `barrio` "Barrio costero" `{ x0: 40, y0: 470, x1: 199, y1: 612 }`. `h` de cada uno: el mínimo que pasa los tests de encuadre y vecinos (medir con el propio test; punto de partida monoblock 21, casas 8, escuela 9, club 12, plaza 7, costanera 4, barrio 14). Comentario de una línea por exhibit como los vecinos. Agregar los siete a la fila de §3 de la spec del storybook (y §10 si tiene tabla).
- [ ] Step 4: `npx vitest run src/lab` → PASS; typecheck.
- [ ] Step 5: commit `feat(#249): exhibits del barrio costero`.

### Fuera de las tareas (lo hace el orquestador)

- `cover-antes.png` ya tomada sobre `b9550c5` (antes de tocar código) en `docs/superpowers/specs/assets/2026-10-27-barrio/`.
- Tras Task 9: dev server, script `.scratch/evals-249.md` con agent-browser, captura `cover-zonificacion.png` y comprobación de los exhibits nuevos.

## Assumptions

- **Fijos siempre encendidos.** `ALWAYS_LIT` en `barrio.ts` excluye `"escuela-escalera"` y `"club-gimnasio"` del sorteo de `tech.homes` (fuente: plan de #240, decisión 9). Alternativa descartada: un campo `fixed?` en `HomeWindow`, que cambiaría la interfaz que fija el issue.
- **Valor medido sobre el estimado.** `REGION_FACES_BEFORE = 1286` (medido) en lugar de ≈ 1316 (el issue pide "verificar" y `<medido>`).
- **Tonos de `tile`.** Si el recálculo difiere de los valores del issue en más de ±1, mandan los del issue (son los únicos escritos).
- **Secuencia de rng.** Derivar `homesRng` en la construcción corre en uno las tiradas de `rng` de las torres y coronas respecto de `main`; ningún test fija esa secuencia (no hay snapshot de `tech`/`tech-anim`; los tests son de comportamiento) y los ticks no dependen de `homes` (Review Focus 4).
- **Si un test de Task 6 sale rojo** (variedad, fracción de luces): se corrigen los marcadores de Tasks 4–5 dentro de la geometría del issue; nunca se aflojan los umbrales del issue.
- **`quay` y `CAMPUS_D`** no tienen otros usos en `src/` (`grep`: `shipyard.ts` tiene su propio `quay` local).

## Grilling

- Rondas: 1 (el plan no cambió de costura: se agregaron dos tests, `ALWAYS_LIT` y el detalle del test de costanera). Griller: model fable.
- Preguntas: 17. Fuentes: ISSUE 9, CODE 12, DOC 1 (varias respuestas citan más de una fuente); NO SOURCE 4, todos supuestos técnicos (arriba). Ninguna ambigüedad de spec, nada fuera de alcance: sin issues abiertos.
