# Resume centro costero — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rehacer la ribera oeste de Resume como el centro de una ciudad
costera. Lleva una plaza larga sobre la costanera, avenidas en abanico, un
gradiente de barrios porteño a moderno, el hotel con el cartel RESUME en su
fachada, y una grilla continua hacia el sur (barrio costero) y hacia el oeste
(ex distrito tecnológico).

**Architecture:**
- Un módulo puro y sin rng, `src/scenes/city-plan.ts`, define el trazado: grilla
  rotada a ninguna parte (sigue los ejes del mundo), ejes oblicuos como
  segmentos con ancho, plazas y parcelas poligonales con su barrio.
- El terreno, las calles, la zonificación, las luces, `city.ts` y `tech.ts` leen
  de ahí, como hoy leen de `city-grid.ts`.
- El plan es una **historia**: cada tarea es un ticket que deja el sitio andando
  y que el planificador de factory detalla paso a paso (TDD) al tomarlo.

**Tech Stack:** TypeScript, Vite, Vitest, PixiJS v8. Motor iso propio en
`src/iso/` y kit de recetas en `src/kit/`.

**Spec:** `docs/superpowers/specs/2026-11-22-resume-centro-costero-design.md`.
Plano de referencia: `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/plano.html`.
Las funciones de geometría del plano (`clipHalf`, `clipLand`, `subtract`,
`segRect`, `chamfer`, `clipSeg`, `segX`) se pueden portar tal cual.

## Global Constraints

- Proyección `sx = x − y`, `sy = (x + y)/2 − 1.4 z`. Cámara desde `+x +y`.
- Grilla: manzana `24 × 24`, calle `6`, paso `30`, origen `gx 13`, `gy 21`.
- Plaza Mayor `(132, 206, 54 × 85)`; centro de los barrios `(159, 248)`.
- Ejes (from → to, w):
  - Costanera `(188,160)→(188,480)`, 8.
  - Avenida de la Plaza `(132,228)→(−440,228)`, 12.
  - Diagonal Norte `(132,210)→(−14,169)`, 10; termina en la Avenida de las Vías.
  - Diagonal Sur `(132,291)→(−420,522)`, 10.
  - Bulevar Central `(10,160)→(10,480)`, 20.
  - Avenida de las Vías `(184,169)→(−440,169)`, 10.
  - Avenida del Sur `(184,318)→(−440,318)`, 10.
  - Avenida del Barrio `(184,378)→(−440,378)`, 10.
- Plazas de cruce: octógono de radio 11 en cada cruce de una diagonal con una
  avenida o el bulevar, a más de 50 del centro y a más de 26 de otra.
- Barrios por distancia `d` al centro:
  - clásico si `d < 105`, transición si `d < 205`, si no moderno;
  - al sur de `y 318`, bajo; al sur de `y 380`, residencial;
  - lo clásico al sur de 318 pasa a bajo; lo moderno al sur de `y 290` pasa a
    transición.
- Hotel:
  - lote `(73, 234, 54 × 51)`, basamento `z 0..10`;
  - placa `64 × 8` a lo largo de `u = (1,−1)/√2`, centrada en `(100, 259.5)`,
    hasta `z 51`;
  - cartel en la cara sureste, cap `12.7` (piso `12`), `z ≈ 31.5..49`.
- Intocables:
  - el muelle oeste `x 192..198`, la costura `y 90`, `STATION_LAND`;
  - las playas ferroviarias `y 129..158` y la franja verde `y 116..158`;
  - el puente `y 207..217`, la ribera este y la costura `x 344`.
- Ningún edificio de Resume tapa en pantalla `STATION_LAND`.
- Presupuesto: los topes de `city-budget.test.ts` y `tech-budget` solo se mueven
  con un número medido y escrito en el test. Antes de subirlos, se cachea lo
  estático.
- Los docs y el glosario que nombran sitios (`docs.test.ts`,
  `docs-glossary.test.ts`) se actualizan en el mismo ticket que mueve el sitio.

## Review Focus

1. **Parcelas degeneradas** donde una diagonal corta una manzana en cuña. Se
   espera que se descarten las de área < 70 o radio de inercia < 3.4, y que
   ninguna receta reciba un polígono con menos de 3 vértices o con
   autointersección. Test en la tarea 1:
   `every parcel is a simple polygon with area ≥ 70`.
2. **Aspectos de pantalla extremos** (el más angosto y el más ancho de
   `coverView`). Se espera que el cartel quede entero dentro de la vista de la
   zona Resume y que la estación de Portfolio no quede tapada. Test en la
   tarea 2, para cada aspecto soportado.
3. **Autos y trenes animados** que hoy siguen la avenida del puente y las calles
   de `city-grid`. Se espera que circulen por los ejes nuevos sin atravesar
   manzanas ni la plaza. Test en la tarea 1: `no car path crosses a parcel or
   the plaza`.
4. **El enlace de la zona** (clic en el cartel). Se espera que la caja de clic
   siga al cartel nuevo. Test en la tarea 2, sobre `world/signs.ts`.
5. **La semilla del mundo:** cambiar el dueño de las manzanas del oeste y del
   sur no debe alterar Portfolio ni Writing. Test en la tarea 4b: el snapshot de
   sólidos de Portfolio y Writing queda igual.

---

### Task 1: Trazado (`city-plan.ts`), terreno y calles

**Files:**
- Create: `src/scenes/city-plan.ts`, `src/scenes/city-plan.test.ts`
- Modify:
  - `src/scenes/city-grid.ts`: el oeste pasa a reexportar desde `city-plan`; la
    ribera este queda;
  - `src/scenes/terrain-classify.ts`;
  - `src/city/streets.ts`, `src/city/zoning.ts`, `src/city/fixed.ts`;
  - `src/scenes/city-anim.ts` (autos), `src/scenes/city.ts`.
- Test: los existentes de esos módulos, reescritos con el trazado nuevo.

**Interfaces:**
- Produces (`city-plan.ts`):
  - `PITCH = 30`, `BLOCK = 24`, `STREET = 6`, `GRID_ORIGIN = { x: 13, y: 21 }`.
  - `PLAZA_MAYOR: Rect`, `PLAZA_CENTER: Vec2`, `HOTEL_LOT: Rect`.
  - `type AxisKind = "costanera" | "avenue" | "diagonal" | "boulevard"`.
  - `interface Axis { id: string; name: string; from: Vec2; to: Vec2; w: number; kind: AxisKind }`.
  - `AXES: readonly Axis[]`, con los valores de Global Constraints.
  - `crossingPlazas(): Vec2[][]`, los octógonos.
  - `type Barrio = "clasico" | "transicion" | "moderno" | "bajo" | "residencial"`.
  - `interface Parcel { poly: Vec2[]; c: Vec2; area: number; d: number; barrio: Barrio }`.
  - `parcels(bounds: { x0: number; y0: number; x1: number; y1: number }): Parcel[]`:
    manzanas de la grilla recortadas por los ejes, las plazas, el muelle y la
    tierra. `HOTEL_LOT` sale como una sola parcela.
  - `barrioAt(c: Vec2): Barrio`.
  - `onRoad(x: number, y: number): boolean` y `inPlaza(x: number, y: number): boolean`.
- `Parcel` no reemplaza a `Lot` del kit: la zonificación convierte el
  rectángulo envolvente en `Lot` y pasa el polígono aparte (ver tarea 3).

- [ ] **Step 1:** tests en `city-plan.test.ts`:
  - `AXES match the spec table` (valores exactos);
  - `the Diagonal Norte ends on the Avenida de las Vías` (`to.y === 169`);
  - `every parcel is a simple polygon with area ≥ 70`;
  - `no parcel intersects an axis, the plaza or a crossing plaza`;
  - `HOTEL_LOT is one parcel`;
  - `barrioAt(PLAZA_CENTER) === "clasico"`, `barrioAt({x:100,y:400}) === "residencial"`;
  - `no parcel reaches y < 158 or x > 192`.
- [ ] **Step 2:** correr `npx vitest run src/scenes/city-plan.test.ts` y ver que falla.
- [ ] **Step 3:** implementar `city-plan.ts`, portando la geometría del plano.
- [ ] **Step 4:** el terreno de la ribera oeste es asfalto. Las parcelas se
  dibujan como plintos y la plaza como baldosa (`cityTerrainAt` y `blocks()`
  leen de `parcels`).
- [ ] **Step 5:** `streets.ts` pinta los ejes oblicuos: línea central, carriles
  en avenidas, cantero y árboles en el bulevar, cruces peatonales y semáforos
  en cada cruce de un eje con otro eje. Test: `every axis crossing has a crosswalk`.
- [ ] **Step 6:** `zoning.ts` asigna las recetas actuales por barrio, con
  `clasico→downtown`, `transicion→residential`, `moderno→district` y
  `bajo/residencial→residential`, sobre el rectángulo envolvente de cada
  parcela. La torre y el cartel de hoy se quedan en una isla provisoria.
- [ ] **Step 7:** autos por los ejes. Test: `no car path crosses a parcel or the plaza`.
- [ ] **Step 8:** `npm test` y `npm run typecheck` (ver `.factory/config.toml`),
  y una captura del sitio en `/` con el recipe de GPU de memoria.
- [ ] **Step 9:** commit.

### Task 2: Hotel y cartel RESUME en la fachada

**Files:**
- Create: `src/scenes/sign-hotel.ts` (reemplaza a `sign-crown.ts`),
  `src/scenes/sign-hotel.test.ts`.
- Modify:
  - `src/city/fixed.ts`: se van la torre y la plaza vieja; entra el hotel;
  - `src/world/signs.ts`, `src/lab/exhibits.ts`;
  - `src/city/lights.ts` y `src/scenes/city-anim.ts`: el piso encendido pasa a
    ventanas del hotel;
  - `src/scenes/city-budget.test.ts`, docs y glosario.
- Delete: `src/scenes/sign-crown.ts` y su uso de `TOWER`, `TOWER_H`,
  `LIT_FLOOR`.

**Interfaces:**
- Consumes: `HOTEL_LOT` (tarea 1).
- Produces:
  - `HOTEL_SLAB = { center: {x:100,y:259.5}, half: 32, thick: 8, z0: 10, z1: 51 }`;
  - `SIGN_SITE: Vec3`, centro de la línea de base sobre la cara sureste;
  - `HOTEL_CAP = 12.7`;
  - `RESUME_SIGN: SignSpec` (mismo nombre: lo consume `world/signs.ts`);
  - `hotel(out: Solid[], accents: Accent[]): void`.

- [ ] **Step 1:** tests:
  - `RESUME_SIGN passes the legibility oracle` (mismo criterio que hoy);
  - `the sign panel lies on the slab's southeast face (diagonalWall, offset ≤ 0.2)`;
  - `cap ≥ 12 and ink fits within 64`;
  - `no solid in front of the sign rises above its bottom edge on screen`;
  - `for every coverView aspect the sign is inside the Resume zone view and no Resume solid covers STATION_LAND on screen`;
  - `the zone link hitbox follows SIGN_SITE`.
- [ ] **Step 2:** verlos fallar.
- [ ] **Step 3:** el hotel lleva basamento clásico con ochavas y portal hacia la
  plaza, placa de ventanas en banda, testeros ciegos y sala de máquinas al ras.
  Va sin helipuerto.
- [ ] **Step 4:** el cartel usa las letras marquesina `MARQUEE_RESUME` con focos y
  panel oscuro de margen mínimo. Si el oráculo pide margen, se baja el cap (no
  menos de 12).
- [ ] **Step 5:** si el test de la estación falla, se bajan juntos la placa y el
  cartel. Si con cap 12 sigue fallando, se para y se consulta.
- [ ] **Step 6:** se mide el presupuesto de acentos y se actualiza el número en
  `city-budget.test.ts`. Se actualizan docs y glosario (`CROWN_SITE`,
  `towerCrown` → nombres nuevos).
- [ ] **Step 7:** `npm test`, typecheck, captura del sitio y de `/lab/resume.html`.
- [ ] **Step 8:** commit.

### Task 3: Barrios y kit porteño

**Files:**
- Create: recetas en `src/kit/forms/porteno.ts` (cúpula de esquina, mansarda,
  balcón, basamento con portal) con su test.
- Modify:
  - `src/kit/types.ts`: `Lot` acepta `poly?: Vec2[]`, que las recetas usan para
    recortar el volumen y ochavar;
  - `src/kit/forms/*.ts` que tengan que aceptar cuñas;
  - `src/city/zoning.ts`: catálogo por `Barrio` y piezas singulares de §6.3;
  - `src/kit/styles.ts`.

**Interfaces:**
- Consumes: `Parcel` y `barrioAt` (tarea 1).
- Produces: `CATALOGUE` indexado por `Barrio` y `FIXED` con las piezas
  singulares reubicadas por parcela.

- [ ] **Step 1:** tests:
  - `every recipe builds inside its parcel polygon (no solid footprint outside poly)`;
  - `classic and transition parcels are chamfered (corner cut ≥ 2)`;
  - `heights per barrio stay in the spec ranges`;
  - `no two neighbouring parcels differ by more than one barrio step`;
  - `towers only north of y 290`;
  - `civic palace, theatre and library front the plaza or the axis`;
  - `bars front the costanera north of the bridge`;
  - `no crater on an axis`.
- [ ] **Step 2:** verlos fallar.
- [ ] **Step 3:** las recetas porteñas se arman con prismas sobre la grilla, con
  más detalle que hoy (§6.2). Cúpula en la esquina que mira a la plaza o a un
  eje.
- [ ] **Step 4:** se reasignan el catálogo y las piezas singulares.
- [ ] **Step 5:** `npm test`, typecheck, medición del presupuesto y captura.
- [ ] **Step 6:** commit.

### Task 4: Barrio costero en la grilla nueva

**Files:**
- Modify: `src/scenes/tech.ts`, `src/scenes/tech-zoning.ts`,
  `src/scenes/sprawl-grid.ts`, `src/scenes/neighborhood*.ts` y sus tests.

**Interfaces:**
- Consumes: `parcels`, `AXES` y `barrioAt` (tarea 1). `tech.ts` construye solo
  las parcelas con `c.y > 318`.

- [ ] **Step 1:** tests:
  - `tech builds only parcels south of y 318`;
  - `the Avenida del Barrio, the Diagonal Sur, the costanera and the bulevar continue inside the barrio`;
  - `school, club, plazas and monoblocks still exist`;
  - `auditorium and arena sit on parcels, not on an axis`;
  - `bajo/residencial heights within spec`.
- [ ] **Step 2:** verlos fallar.
- [ ] **Step 3:** implementar. Al sur de `y ≈ 475`, la misma grilla y el mismo
  programa hasta donde hoy llega el barrio.
- [ ] **Step 4:** `npm test`, typecheck, `tech-budget` medido y captura.
- [ ] **Step 5:** commit.

### Task 4b: El oeste en la grilla nueva

**Files:**
- Modify: `src/scenes/tech.ts` (pierde el oeste), `src/scenes/city.ts`,
  `src/city/zoning.ts`, `src/scenes/city-grid.ts` (`CITY_EDGE.west` pasa a ser
  el borde de la vista con el margen de `sprawl-grid`), los presupuestos.

**Interfaces:**
- Consumes: tareas 1 y 3. Corre en paralelo con la 4.

- [ ] **Step 1:** tests:
  - `city builds every parcel north of y 318 inside the view, west of x −54 included`;
  - `tech builds nothing north of y 318`;
  - `TELECOM sits on a moderno parcel`;
  - `Portfolio and Writing solids snapshot unchanged`;
  - `budget moved, not raised` (la suma city + tech es menor o igual que antes,
    con el número medido).
- [ ] **Step 2:** verlos fallar.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm test`, typecheck y captura.
- [ ] **Step 5:** commit.

### Task 5: Luces, mobiliario y presupuesto final

**Files:**
- Modify: `src/city/lights.ts`, `src/city/streets.ts` (faroles de los ejes),
  `src/scenes/city-budget.test.ts`. Si hace falta, un caché estático en el
  stage (ver memoria: el costo es CPU `stage.tick`).

- [ ] **Step 1:** tests:
  - `every axis has lamps every 12 on one sidewalk`;
  - `classic and bajo windows warm, moderno cool`;
  - `hotel shows lit rooms`;
  - topes de `city-budget` y `tech-budget` con el número medido.
- [ ] **Step 2:** medir el FPS en la GPU NVIDIA (recipe de memoria) antes y
  después. Si empeora de forma visible, se agrega el caché de lo estático antes
  de subir topes.
- [ ] **Step 3:** `npm test`, typecheck y captura de noche.
- [ ] **Step 4:** commit.
