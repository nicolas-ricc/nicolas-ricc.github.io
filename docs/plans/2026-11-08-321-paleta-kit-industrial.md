# Paleta y kit industrial (#321) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** sumar a la paleta siete materiales (chapa ondulada y contenedores) y el acento `spark`, el generador de placas `ribs`, el prop `foodTruck` y la familia `industrial` del kit con ocho recetas visibles en `lab/kit.html`, sin cambiar ninguna escena.

**Arquitectura:** todo es aditivo. La paleta se edita en `palette-base.ts` y se pegan los literales que imprime `npm run palette`. `ribs` es una función pura de `src/iso/plate.ts`. La familia `industrial` vive en `src/kit/forms/industrial.ts` (como las otras familias, un `RecipeDef[]` exportado y registrado en `RECIPES`), con builders puros exportados para que los reusen los hijos #322–#327. Ninguna escena importa nada nuevo, así que `world(7)` no cambia.

**Stack:** TypeScript estricto (`noUnusedLocals`), Vitest, Vite. Sin dependencias nuevas.

**Spec:** el issue #321 (manda sobre la spec de la historia, `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` §4.3 y §6).

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- Ningún literal hex fuera de `src/map/palette-iso.ts`, `palette-base.ts` y `seed.ts` (`palette-guard.test.ts`).
- Toda aleatoriedad sale del `Rng` recibido; `Math.random` prohibido.
- `src/iso/` y `src/scenes/` no importan Pixi.
- Ninguna escena cambia: `world(7)` produce los mismos sólidos y acentos que en `origin/feature/56-costura-90`.
- Contrato del kit (`kit.test.ts`): todo sólido dentro del lote ±0.8, nada bajo `lot.z`, altura ≤ `min(lot.maxH, RECIPE_MAX_H)` (también con `maxH 10`), determinismo, ventanas y paredes solo de caras que miran a la cámara de un edificio con fachada, ningún acento `windowWarm`/`windowCool`, nada en huecos cóncavos, y `lot.z + 0.3` desplaza la salida exactamente 0.3 en z.
- Tono por pieza: `tone = style.tone + rng.int(−1, 1)` (primera tirada del `rng` en cada receta), recortado con `shiftTone` a −2..+2, aplicado al final de cada receta a todos sus sólidos con un helper interno `tonePiece(p: Piece, tone: number): Piece` (se omite el campo cuando vale 0, como hace `prism`). Los builders exportados no llevan tono: lo pone la receta (o la escena que los reuse).
- Cada tarea registra en `INDUSTRIAL` solo las recetas que implementa; cada commit deja `npm test` en verde salvo los tests de la etapa 3 de tareas aún no hechas.
- Commits `feat(#321): …` / `test(#321): …` con `Co-Authored-By`.

## Decisiones técnicas declaradas (el issue no las fija o se contradice)

0. **Fuentes:** `recipeCap` es altura sobre `lot.z` (`src/kit/piece.ts`: "Height cap above `lot.z`"); `RECIPE_MAX_H = 18`; `addBuilding` calcula `floorH = alto de la pared / f.floors`; paredes de `prism`: 0 N, 1 E, 2 S, 3 O (`src/iso/plate.ts`); `TO_SUN` apunta al OSO (`src/iso/light.ts`), así que sur y oeste son `lit`; `palette-guard.test` no mira `*.test.ts`; los tests de paleta recorren `Object.keys(ISO_TONES)`; `kitScene` ya arma una fila por familia; `neighborhoodOf` nunca devuelve `industrial` y `lights.ts` no tira del `rng` por barrio, así que sumar el barrio no cambia `world(7)`.
1. **Dientes de sierra:** en `RampDir`, `"e"` quiere decir "baja hacia el este" (arista alta al oeste, ver `ramp()` en `solids.ts`). Con `dir: "e"` la cara vertical queda al **oeste**, y una placa en `wall 1` (este) cae sobre la pared de altura 0 y `tessellate` la descarta. El issue pide "cara vertical al este" y la placa `glass` en `wall 1`: se respeta la cara y se usa **`dir: "w"`**.
2. **`foodTruck` dentro de 5×2.2:** caja de carga `mat` de 3.8 de largo + cabina `steel` de 1.2 de largo y 2 de alto en el extremo este (`dir: "s"`) o sur (`dir: "e"`). Entre las dos ocupan 5×2.2×2.6 sin solaparse. El toldo y la ventanilla sobresalen hasta 0.8 hacia `dir`.
3. **Puertas de contenedor:** una placa puerta en la cara visible de **cada contenedor** de la pila: la cara del extremo, este si `along: "x"` y sur si `along: "y"`.
4. **`quayCraneAt` y `rtgAt` llevan un `z` opcional** al final (`z = 0`), para que la receta respete `lot.z`.
5. **`sawtooth(..., glass: Material)`:** `glass` es el material de la placa de la cara vertical (la receta pasa `"glass"`).
6. **Fila `industrial` del lab:** siempre usa `STYLES.industrial`, sea cual sea el estilo elegido con las teclas `1..4`.

## Review Focus

1. **Lote mínimo/estrecho:** `sheetHall` y `sawtoothHall` en un lote de lado < 6 no deben generar `ribs` (`[]`) ni dientes (N = 0) y siguen cumpliendo el contrato. Test en las tareas 2 y 4.
2. **Tope bajo (`maxH 10`):** las pilas de 4 contenedores (10.4), la nave a dos aguas (`h·1.35`) y la grúa (18) tienen que recortarse para entrar en el tope. El test genérico del kit lo cubre; las tareas 4–6 deben recortar la altura, no confiar en el rango nominal.
3. **`ribs` con `len` enorme:** con `len = 100` salen 24 franjas y ninguna excede `u 1`. Test en la tarea 2.
4. **`world(7)` intacto:** comparar el hash de `JSON.stringify(world(7))` antes y después (verificación de la etapa 4, no un test del repo).
5. **`spark` solo animado:** que ningún acento estático de `world(7)` sea `spark`. Test en la tarea 1.

---

### Tarea 1: paleta — siete materiales y el acento `spark`

**Archivos:**
- Modificar: `src/map/palette-base.ts` (siete entradas al final de `BASE_TONES`, bajo el comentario `// #56: corrugated sheet and containers`)
- Modificar: `src/map/palette-iso.ts` (los nueve tonos de cada material con el mismo comentario; `ISO_COLORS.spark = 0xffb347`; `"spark"` al final de `ACCENT_COLORS`; una línea en el docstring: los materiales de #56 siguen la regla ciudad y costa)
- Tests: `src/map/palette-base.test.ts`, `src/map/palette-iso.test.ts`, `src/scenes/portfolio-accents.test.ts`

**Interfaces:**
- Produce: `Material` suma `"sheetGreen" | "sheetTeal" | "boxRust" | "boxBlue" | "boxGreen" | "boxGrey" | "boxOrange"`; `AccentColor` suma `"spark"`.

- [ ] **Paso 1: tests (escritos en la etapa 3)**
  - `palette-base.test`: `"the seven #56 materials come from cityLadder"`: para cada `top` de `{ sheetGreen: 0x6a7a6e, sheetTeal: 0x4a6a76, boxRust: 0x8a4a32, boxBlue: 0x3e5c80, boxGreen: 0x4e6e4a, boxGrey: 0x707070, boxOrange: 0xb0703a }`, `BASE_TONES[m][k]` es `cityLadder(top)[k]` (±1) para los cinco tonos, y `ISO_TONES[m].top === darken(top, DARKEN)`.
  - `palette-iso.test`: `ACCENT_COLORS` termina en `"spark"`; `ISO_COLORS.spark === 0xffb347`; la lista de acentos no oscurecidos pasa a doce valores y termina en `0xffb347`. Los tests existentes de nueve tonos con luminancia estrictamente creciente, sombra más azul y "late dusk" ±1 ya cubren los siete materiales.
  - `portfolio-accents.test`: `"no static accent of the world is spark"`: `world(7).accents.every((a) => a.color !== "spark")`.
- [ ] **Paso 2:** `npx vitest run src/map src/scenes/portfolio-accents.test.ts scripts/darken-palette.test.ts` → FALLA (faltan los materiales y `spark`).
- [ ] **Paso 3:** pegar en `BASE_TONES` `cityLadder(top)` como literales de cinco tonos; correr `npm run palette` y pegar las siete líneas nuevas de `ISO_TONES` tal cual las imprime (la regla `darken-palette.test` "lo impreso es lo que está pegado" lo exige). El orden de claves de `ISO_TONES` debe ser el de `BASE_TONES`.
- [ ] **Paso 4:** los mismos tests → PASAN; `npm run typecheck` → limpio.
- [ ] **Paso 5:** commit `feat(#321): corrugated sheet and container materials, spark accent`.

### Tarea 2: `ribs` en `plate.ts`

**Archivos:**
- Modificar: `src/iso/plate.ts`
- Test: `src/iso/plate.test.ts` (nuevo)

**Interfaces:**
- Produce: `export const RIB_W = 0.5, RIB_STEP = 1, RIB_MAX = 24, RIB_MIN_LEN = 6;` y `export function ribs(wall: number, len: number, z0: number, z1: number, lit: boolean, mat: Material): Plate[]`.

- [ ] **Paso 1: tests (etapa 3)**, en `describe("ribs")`:
  - `len 5.9`, `0`, `−3` y `NaN` → `[]`; `len 6` → 6 franjas.
  - `len 10` → 10 franjas, la k-ésima con `u0 = k/10`, `u1 = u0 + 0.05`, `shape "rect"`, `wall`, `mat`, `z0`, `z1` los pasados.
  - `len 100` → exactamente 24 franjas, paso `100/24` en unidades (`u0 = k·(100/24)/100`), todas con `0 ≤ u0 < u1 ≤ 1`.
  - Tonos: sin `lit`, `toneOffset` alterna `0, −1, 0, −1…`; con `lit`, `1, 0, 1, 0…`.
- [ ] **Paso 2:** `npx vitest run src/iso/plate.test.ts` → FALLA.
- [ ] **Paso 3:** implementar. Si `!(len >= RIB_MIN_LEN)` (incluye `NaN` y negativos) devuelve `[]`; si no, `n = min(RIB_MAX, floor(len / RIB_STEP))`, `step = max(RIB_STEP, len / RIB_MAX)`; franja k: `u0 = k·step/len`, `u1 = u0 + RIB_W/len`; `toneOffset = (lit ? 1 : 0) − (k % 2)`. Docstring: corrugated sheet; `lit` es la pared con `shadeTone(normal) === "lit"`.
- [ ] **Paso 4:** PASA.
- [ ] **Paso 5:** commit `feat(#321): ribs plate generator`.

### Tarea 3: `foodTruck` en `props.ts`

**Archivos:**
- Modificar: `src/kit/props.ts`
- Test: `src/kit/props.test.ts`

**Interfaces:**
- Produce: `export function foodTruck(at: Vec3, mat: Material, dir: "s" | "e"): Lit` (`at` = esquina NO).

- [ ] **Paso 1: tests (etapa 3)**, `"foodTruck: box, steel cab, awning toward dir and a lit amber hatch on the dir face"`, para `dir` `"s"` y `"e"`:
  - Hay un prisma de `mat` de alto 2.6 y un prisma `steel` cuyo largo a lo largo del vehículo es 1.2; la unión de sus cajas mide 5×2.2 (`"s"`) o 2.2×5 (`"e"`) en planta, desde `at`.
  - Hay un `ramp` `awning` con vuelo 0.8 hacia `dir`, `dir` igual al del camión, base a `at.z + 2.2`, pegado a la cara `dir` (`at.y + 2.2` o `at.x + 2.2`).
  - `accents` es un solo `poly` `amber` con `alpha 0.9`, cuatro puntos en el plano `at.y + 2.2 + 0.02` (o `at.x + 2.2 + 0.02`), 1.6 de ancho y z de `at.z + 1.2` a `at.z + 2`, sobre el tramo de la caja de carga.
- [ ] **Paso 2:** FALLA.
- [ ] **Paso 3:** implementar con `prism` y `awning()`. Caja de carga desde el extremo oeste/norte, cabina al otro extremo.
- [ ] **Paso 4:** PASA.
- [ ] **Paso 5:** commit `feat(#321): foodTruck prop`.

### Tarea 4: familia `industrial` — estilo, catálogo, lab y las naves (`sawtoothHall`, `sheetHall`, `storeroom`)

**Archivos:**
- Modificar: `src/kit/types.ts` (`StyleId` y `RecipeDef.family` suman `"industrial"`)
- Modificar: `src/kit/styles.ts` (`industrial: { id: "industrial", mat: "concrete", trim: "steel", roof: "sheetGreen", tone: 0, floorH: 4, window: "windowCool" }`)
- Modificar: `src/city/zoning.ts` (`industrial: { recipes: [], style: "industrial", lights: { on: 0.3, warm: 0 } }`)
- Crear: `src/kit/forms/industrial.ts` (`export const INDUSTRIAL: RecipeDef[]`)
- Modificar: `src/kit/index.ts` (`...INDUSTRIAL` al final de `RECIPES`; `LAB_LOTS.storeroom = { w: 6, d: 5 }`)
- Modificar: `src/lab/kit-scene.ts` (la familia `industrial` usa `STYLES.industrial`)
- Tests: `src/kit/forms/industrial.test.ts` (nuevo), `src/city/zoning.test.ts`, `src/lab/kit-scene.test.ts`

**Interfaces:**
- Produce: `export function sawtooth(out: Solid[], rect: Rect, z: number, h: number, toothH: number, mat: Material, glass: Material): void` — empuja `N = floor(rect.w / 4)` rampas `dir: "w"` de 4×`rect.d`×`toothH` a `z + h`, centradas en x (sobrante repartido a ambos lados), cada una con `plates: [{ wall: 1, shape: "rect", u0: 0.05, u1: 0.95, z0: z + h + 0.3·toothH, z1: z + h + 0.9·toothH, mat: glass }]`.
- Produce: `INDUSTRIAL` con los nombres, en este orden: `sawtoothHall, sheetHall, containerStack, stockpile, tankGroup, quayCrane, rtgGantry, storeroom` (las tareas 5 y 6 agregan las suyas en su lugar).
- Produce: helper interno `door(wall, len, width, z0, h): Plate` (rect centrado, `mat` el de la pared, `toneOffset −2`), que reusan las tareas 5 y 6.

- [ ] **Paso 1: tests (etapa 3)**
  - `zoning.test` "catalogues": `NEIGHBORHOODS` suma `"industrial"`, `weights("industrial")` es `{}` y `lights.industrial` es `{ on: 0.3, warm: 0 }`.
  - `kit-scene.test`: `"the industrial row is there, in the industrial style, whatever the chosen style"`: los lotes de las ocho recetas comparten una fila `y`; con `kitScene(7, "downtown")` el cuerpo de `sawtoothHall` (el prisma con `facade`) es de `concrete`.
  - `industrial.test`: (verde recién en la tarea 6) el registro tiene las ocho recetas de la familia en orden; `STYLES.industrial` es el del issue; `sawtoothHall` (lote 21×15, 20 semillas, estilo `industrial`): publica ventanas, hay `floor(lado/4)` rampas `dir "w"` sobre el cuerpo y cada una lleva una placa `glass` en `wall 1` con z al 30–90 % del diente; `sawtooth` sobre un rect de 3 de ancho no empuja nada; `sheetHall`: prisma `gable` `sheetGreen` o `sheetTeal` con placas `ribs` (algún `toneOffset ≠ 0`) en cada pared larga de largo ≥ 6, la del sur con `lit` (offsets `1/0`) y la del norte sin él (`0/−1`), y una placa puerta `toneOffset −2` de 4 de ancho en el lado `open[0]`; `storeroom`: un prisma 4×3×2.6 `sheetGreen` o `steel` con una placa puerta `toneOffset −2`.
- [ ] **Paso 2:** FALLA.
- [ ] **Paso 3:** tipos, estilo, catálogo, `kit-scene` y las tres recetas:
  - `sawtoothHall`: `toothH = 2`, `h = min(rng.int(6, 9), cap − toothH)` con `cap = recipeCap(lot)`; cuerpo `prism` `style.mat` que llena el lote con `facade { floors: 1, cols: max(1, round(w/4)) }` vía `addBuilding`; dientes con `sawtooth(..., style.roof, "glass")`.
  - `sheetHall`: `h = min(rng.int(5, 8), cap / (1 + GABLE_RATIO))`; `prism` `gable` (`roofMat` el mismo) de `rng.pick(["sheetGreen", "sheetTeal"])` que llena el lote; `ribs` en las dos paredes largas (`wide`: 0 y 2; `deep`: 3 y 1), `lit` según `shadeTone` de la normal de la pared, z de `lot.z` a `lot.z + h`; después la puerta de 4 de ancho y alto `min(4, h − 1)` en `open[0]` (o `"s"`).
  - `storeroom`: centrado en el lote, puerta 1.2 × 2 en la cara sur.
- [ ] **Paso 4:** PASA, incluido el contrato genérico de `kit.test` para las tres recetas.
- [ ] **Paso 5:** commit `feat(#321): industrial family with sawtooth and sheet halls and storeroom`.

### Tarea 5: patios — `containerStack` y `stockpile`

**Archivos:**
- Modificar: `src/kit/forms/industrial.ts`
- Test: `src/kit/forms/industrial.test.ts`

**Interfaces:**
- Produce: `export const CONTAINER = { len: 6, w: 2.4, h: 2.6 } as const;`
- Produce: `export const CONTAINER_COLORS: readonly { mat: Material; weight: number }[]` = `boxRust 30, boxBlue 25, boxGrey 20, boxGreen 15, boxOrange 10`; `export const STACK_HEIGHTS: readonly { n: number; weight: number }[]` = `1: 30, 2: 35, 3: 25, 4: 10`; `export function containerColor(rng: Rng): Material`; `export function stackHeight(rng: Rng): number`.
- Produce: `export function stackContainers(at: Vec3, n: number, along: "x" | "y", rng: Rng): Solid[]` — `n` prismas apilados (`at` = esquina NO de la base), color `containerColor(rng)` por contenedor, puerta `rect` `toneOffset −2` en la cara del extremo (`wall 1` si `along "x"`, `wall 2` si `"y"`), u 0.1..0.9 y z del 5 al 95 % del contenedor.
- Produce: `export function sheetStack(at: Vec3, layers: number): Solid[]` (prismas `steel` 10×2×0.5, capa l en `at + (0.4l, 0.4l, 0.5l)`), `export function pipeBundle(at: Vec3, len: number): Solid[]` (cuatro prismas `rust` `len`×1×1 cada 1.2 en y), `export function coils(at: Vec3, n: number): Solid[]` (`n` cilindros `rust` r 1.5 h 1.5, 8 lados, en filas de 2, centros cada 3.4; `at` = esquina NO de la caja), `export function hullSections(at: Vec3, n: number): Solid[]` (`n` prismas `steel` 9×4×3 `roof: "step"` en fila según x, cada 9.4).

- [ ] **Paso 1: tests (etapa 3)**
  - `"container colors follow their weights over 2000 draws (±5 %)"`: con `createRng(1)`, la frecuencia de cada material está a ≤ 0.05 de `weight/100`; lo mismo para `stackHeight` con `STACK_HEIGHTS`.
  - `stackContainers(v3(0,0,0.3), 3, "x", rng)`: tres prismas de 6×2.4×2.6 apilados desde z 0.3, cada uno con una placa `wall 1` `toneOffset −2`; con `"y"`, 2.4×6 y `wall 2`.
  - `containerStack` (dos lotes del contrato, 20 semillas): ninguna pila supera 4 contenedores (contar prismas por columna `(at.x, at.y)`), todo contenedor es de un material `box*`, y con `maxH 10` ninguna pila supera 3.
  - `stockpile` (21×15 y 24×18, 20 semillas): agrupando los sólidos cuyas cajas en planta están a < 0.5 entre sí quedan entre 3 y 6 grupos, y dos grupos distintos nunca se tocan.
- [ ] **Paso 2:** FALLA.
- [ ] **Paso 3:**
  - `containerStack`: contenedores según x en bloques de 6 de largo separados por pasillos de 4 en x, centrados en el lote; en cada bloque, pilas contiguas en y cada 2.6 (2.4 + 0.2). Alto `min(stackHeight(rng), floor(cap / 2.6))`.
  - `stockpile`: elegir `rng.int(3, 6)` grupos de `rng.pick` sobre los cuatro builders (capas 2..4, caños `len` 8..14, bobinas 2..4, secciones 1..2) y ubicarlos por rechazo (hasta 60 intentos por grupo) dentro del lote y a ≥ 1 de los ya puestos. Para que siempre haya ≥ 3, los tres primeros grupos se ubican antes que el resto y, si alguno no entra en 60 intentos, se reemplaza por `coils(at, 2)` (6.4×3) y luego `sheetStack(at, 2)` (10.4×2.4); el test de 20 semillas en los dos lotes lo comprueba empíricamente. El huelgo interno de cada builder es < 0.5 (caños 0.2, bobinas 0.4, secciones 0.4).
- [ ] **Paso 4:** PASA (más el contrato genérico).
- [ ] **Paso 5:** commit `feat(#321): container stack and stockpile recipes`.

### Tarea 6: estructuras — `tankGroup`, `quayCrane`, `rtgGantry`

**Archivos:**
- Modificar: `src/kit/forms/industrial.ts`, `src/kit/index.ts` (`LAB_LOTS.quayCrane = { w: 8, d: 8 }`, `LAB_LOTS.rtgGantry = { w: 12, d: 18 }`)
- Test: `src/kit/forms/industrial.test.ts`

**Interfaces:**
- Produce: `export const QUAY_CRANE_H = 18, RTG_H = 10;`
- Produce: `export function quayCraneAt(at: Vec2, dir: "w" | "e" | "s", out: Solid[], accents: Accent[], z = 0): void` — `at` = centro del pórtico. Pórtico de cuatro patas `steel` 0.8×0.8 en `at ± 3` (huella de 6.8), alto 9.2, con dos vigas 0.8² a z 9.2..10 sobre las patas a lo largo de los rieles; dos `strip` `rail` de ancho 0.6 y largo 8 bajo cada línea de patas, perpendiculares a `dir`, a `z + 0.02`; cabina 2×2×2 a z 10..12; mástil 0.4² hasta z 15; pluma `beam` 0.6×0.6 desde el borde de la cabina hacia `dir` (z 12) hasta la punta a 4.4 del centro en planta y z 17.5; tirante `beam` 0.2 del tope del mástil a la punta; `dot` `cyan` r 1 en la punta. Nada pasa de `z + 18`.
- Produce: `export function rtgAt(x0: number, x1: number, y: number, out: Solid[], z = 0): void` — patas 1.2×1.2 en `x0` y `x1` (esquina NO), pares en `y` e `y + 6`; rueda `cylinder` `rust` r 0.6 h 1.2 bajo cada pata; patas de z 1.2 a 9; dos vigas transversales `steel` de `x0` a `x1 + 1.2`, 1.2 de profundidad, z 9..10, en `y` e `y + 6`; carro `rust` 3×(6 − 1.2)×1.4 entre las vigas, centrado en x, a z 8.6..10. Alto total 10.

- [ ] **Paso 1: tests (etapa 3)**
  - `quayCrane` (lote propio con `maxH 24`, 20 semillas, cualquier estilo): `max z ≤ lot.z + 18` y `> lot.z + 16`; con `maxH 10`, `max z ≤ lot.z + 10`; exactamente un acento, `dot` `cyan` de r 1; con `open: ["e"]` la punta queda al este del centro y con `["n"]` al oeste.
  - `rtgGantry`: `max z === lot.z + 10` (±1e-9) y cuatro cilindros `rust` de r 0.6.
  - `tankGroup` (dos lotes del contrato, 20 semillas): 1..3 cilindros principales `steel` o `rust` de r 3..5 y h 4..8 (con h recortado al tope), cada uno con un anillo de `r + 0.2` y h 0.3 a media altura, y un `strip` que los rodea.
- [ ] **Paso 2:** FALLA.
- [ ] **Paso 3:**
  - `tankGroup`: `n = rng.int(1, 3)`, radios `rng.int(3, 5)` y alto `min(rng.int(4, 8), cap)`; si no entran en fila según el lado largo con 1 de separación y 1 de margen para el muro, bajar `n` (y si con uno no entra, recortar `r` al lado corto). Escalera: prisma 0.3×0.3 de alto h pegado al lado sur de cada tanque y travesaños `beam` 0.1×0.1 cada 1 de alto. Muro: `strip` `concrete` de ancho 0.6 cerrado alrededor del grupo, a `lot.z + 0.02`.
  - `quayCrane`: `quayCraneAt` en el centro del lote, y la pieza pasa por `fitToCap(p, lot)` (con `maxH 10` la grúa se aplana a 10), `dir` = `open[0]` si es `w`, `e` o `s`, si no `"w"`.
  - `rtgGantry`: `rtgAt(lot.x + 0.5, lot.x + lot.w − 1.7, lot.y + (lot.d − 7.2)/2, …)` y debajo, entre las patas, una pila `stackContainers` según x de `min(stackHeight(rng), 3)`.
- [ ] **Paso 4:** PASA (más el contrato genérico).
- [ ] **Paso 5:** commit `feat(#321): tank group, quay crane and RTG gantry recipes`.

## Verificación final (etapa 4)

- `npm test` y `npm run typecheck` en verde.
- Hash de `JSON.stringify(world(7))` igual al de la base.
- `lab/kit.html` con agent-browser a 1600×900 escala 2: la fila `industrial` muestra las ocho recetas (script en `.scratch/evals-321.md`).

## Assumptions

- `dir: "w"` en los dientes (la cara vertical al este que pide el issue); rechazado: `dir: "e"` literal, que deja la cara vertical al oeste, invisible, y la placa de `wall 1` descartada.
- `foodTruck` = caja de 3.8 + cabina de 1.2 dentro de 5×2.2; rechazado: caja de 5 con cabina solapada (dos sólidos solapados rompen el orden por profundidad) o cabina fuera de 5×2.2.
- Una puerta por contenedor; rechazado: una sola puerta por pila.
- `z` opcional al final de `quayCraneAt`/`rtgAt`; rechazado: forzar `z = 0` (rompe el contrato `lot.z + 0.3`).
- `glass: Material` en `sawtooth`; rechazado: un booleano.
- La fila `industrial` del lab siempre con `STYLES.industrial` (el issue: "fila `industrial` en `lab/kit.html`, con el estilo `industrial`"); rechazado: seguir las teclas `1..4`.
- `quayCrane` pasa por `fitToCap`: con tope < 18 se aplana; rechazado: dejarla en 18 (rompe el contrato del kit).
- Tono por pieza aplicado al final de la receta (`tonePiece`); los builders no llevan tono.

## Grilling

- Rondas: 1 (los cambios fueron correcciones dentro de las tareas existentes, sin tareas nuevas ni quitadas). Griller: `fable`.
- Preguntas: 16. Respondidas con ISSUE: 4 (9, 10, 15, y parte de 1); CODE: 10 (1, 3, 4, 7, 11, 12, 13, 14, 15, 16); NO SOURCE → supuesto técnico: 4 (2, 5, 6, 8), registrados arriba y corregidos en el plan.
- Issues abiertos: ninguno (nada quedó fuera de alcance ni ambiguo en la spec).
