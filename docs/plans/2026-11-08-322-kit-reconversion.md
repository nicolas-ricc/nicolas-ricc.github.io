# Kit de reconversión (#322) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: `subagent-driven-development` (tarea por tarea). Los pasos usan casillas (`- [ ]`).

**Objetivo:** la familia `reconversion` del kit (ocho recetas: `loftHall`, `vaultLoft`, `brewery`, `sheetLoft`, `derelictHall`, `coveredMarket`, `freightShed`, `openDock`) y los barrios `warehouses`, `freight` y `harbor` en `STYLES` y `CATALOGUE`, sin que cambie ninguna escena.

**Arquitectura:** un módulo nuevo `src/kit/forms/reconversion.ts` con las ocho recetas y tres ayudantes chicos (marco del frente, ventanas a partir de placas, ventanas de los dientes); reusa `sawtooth`, `stackContainers`, `storeroom` de `industrial.ts`, `ribs` de `plate.ts`, `neonSlot` de `lowrise.ts` (se exporta) y los props. Los estilos y catálogos se suman en `styles.ts` / `zoning.ts`; el lab pone la fila nueva con estilos fijos.

**Stack:** TypeScript estricto (`noUnusedLocals`), Vitest. Sin dependencias nuevas.

**Spec:** el issue #322 (manda) y la spec de la historia `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` §5.2 (contexto). Plan de la historia: comentario de #56 con `Branch: feature/56-costura-90`.

## Restricciones globales

- Código, comentarios, nombres de tests en inglés (`src/english.test.ts`); este documento en castellano.
- Colores solo desde `src/map/palette-iso.ts` (`palette-guard.test.ts`); nada de literales hex.
- Sin `Math.random`: toda aleatoriedad del `Rng` recibido. `src/iso/` y `src/scenes/` no importan Pixi.
- Recetas puras: dibujan dentro del lote (+0.8), relativas a `lot.z`, alturas ≤ `recipeCap(lot)` (= `min(lot.maxH, 18)`), deterministas, `lot.z + 0.3` = salida desplazada 0.3 (`kit.test.ts`).
- `tone = shiftTone(style.tone, rng.int(-1, 1))` por pieza, aplicado como en `industrial.ts` (`tonePiece`).
- Ninguna escena cambia: `world(7)` produce exactamente los mismos sólidos y acentos que en la base.
- Commits en inglés: `feat(#322): …` / `test(#322): …`, con `Co-Authored-By`.
- `npm test` y `npm run typecheck` en verde al final de cada tarea.

## Decisiones técnicas (declaradas; el issue no las fija)

1. **Contrato de ventanas del kit.** Hoy `kit.test` exige que `Window.building` apunte a un sólido con `facade`. El issue pide ventanas publicadas a partir de placas (`glass`) de dientes (`ramp`) y de naves `gable`, que no admiten `facade` (`solids.ts`: "`facade` does not apply to `roof: "gable"`"). El contrato pasa a: el sólido tiene `facade` **o** una placa de `mat: "glass"`. `Window.building` es el índice del sólido que lleva la placa (así `lights.ts` lo excluye de sus propios oclusores).
2. **Paneles de los dientes.** En un lote de 21 de ancho, dos tercios del techo (14) dan 3 dientes (`sawtooth`: `floor(w/4)`), y el test pide ≥ 4 ventanas en el piso 2. Cada placa de diente se publica partida en `max(2, round(0.9·d / 4))` paneles iguales a lo largo de la placa, con 0.2 de separación entre paneles.
3. **Piso de las ventanas de los dientes:** el número de pisos del cuerpo (`loftHall`: 2, como pide el issue; `coveredMarket`: 1).
4. **Marco del frente.** Las recetas con frente (`vaultLoft`, `brewery`, `coveredMarket`, `freightShed`, `openDock`) aceptan cualquier `open[0]` (`n`, `e`, `s`, `w`; sin `open`, `s`): el mercado fijo de #325 mira a la calle de la estación (este). Se construyen en coordenadas del frente `u` (a lo largo, en +x o +y) y `v` (desde el borde del frente hacia adentro).
5. **`loftHall`:** los dientes van en los dos tercios del este (`sawtooth` sobre `{x + w/3, y, 2w/3, d}`), la terraza (`rooftopGarden`) en el tercio oeste, 0.5 adentro del borde. `h = min(rng.int(7, 9), cap − 2.3)` (la terraza mide 2.3: losa 0.3 + conos 2). Dientes `style.roof`, 2 de alto.
6. **`vaultLoft`:** cuerpo de `min(18, len − 2)` a lo largo del frente por `min(10, depth − 3)` de fondo, a 2 del borde del frente y centrado; `vault` con `len` = largo del cuerpo, `w` = fondo, `axis` `"x"` si el frente es `n`/`s` y `"y"` si es `e`/`w`, `segments` 6. Hastial vidriado: placa `glass` `u 0.25..0.75`, `z lot.z + 0.2 .. lot.z + h − 0.2`, `toneOffset +1`, en la pared del frente. Entrepiso: solo la parte que asoma, `prism` `deck` del ancho de la placa, 1 de fondo hacia afuera de la pared, 0.3 de espesor con base en `lot.z + 2.5`. `h = min(4, cap − 3)`.
7. **`brewery`:** la "nave gable con facade" es un cuerpo plano `style.mat` h `min(6, cap − 2.1)` con `facade { floors: 1, cols: 3 }` (vía `addBuilding`) más `gableRoof(f, 1.5, style.roof)` encima (un `gable` no dibuja fachada). Franjas desde el frente: terraza `v 0..2.5`, ventanal `glass` `v 2.5..2.8` (h 4, todo el largo del frente), tanques con centro en `v 4.2`, nave en la mitad trasera (`v depth/2 .. depth`). Tanques: `n = min(rng.int(3, 5), floor((len + 1) / 3.4))` centrados a lo largo, separados 1; cada uno `cylinder` `copper` r 1.2 h 4.5 y tapa `cone` `copper` r 1.2 h 1. Terraza: dos postes `steel` 0.2×0.2×3 en `u 1` y `u len − 1`, `v 0.5`; `garland` de tapa a tapa con un punto medio 0.4 más bajo; 2..3 mesas (`table`) con dos sillas (`chair`) cada una entre los postes. Dos slots `neon` con `neonSlot` de `lowrise.ts` (se exporta), uno por mitad del ventanal, ancho 3, `shop` 0 y 1 (`lights.ts` deduplica por `owner:shop`).
8. **`sheetLoft`:** `gable` de `mat` `sheetGreen`/`sheetTeal` (rng) y `roofMat` igual, `h = min(6, cap / (1 + GABLE_RATIO))`, `ribs` en las dos paredes largas (como `sheetHall`), después 3 placas `glass` por pared larga, `rect` de 2.5 centradas en `(k + 0.5)/3`, `z lot.z + 1 .. lot.z + min(4.5, h − 0.5)`. Sin puerta.
9. **`derelictHall`:** cuerpo `style.mat` sin `facade`, `h = min(rng.int(6, 9), cap − 2)`, `tone` del cuerpo = tono de la pieza − 1 ("paredes `toneOffset −1`"). `n = min(rng.int(4, 5), floor(w / 4))` dientes centrados (se arma un `rect` de ancho `4n` y se llama a `sawtooth`), se quitan `min(rng.int(1, 2), n − 1)` distintos por rng; en cada hueco: una viga cumbrera `beam` `steel` 0.3×0.3 a lo largo de y en `x = x0 + 4(k + 1)`, `z = base + 2`, y dos cabios de `(x0 + 4k, y_j, base)` a `(x0 + 4(k + 1), y_j, base + 2)` en `y_j = y + 0.5` y `y + d − 0.5`. Selva: `jungle` de `src/scenes/flora.ts`, 4..6 conos repartidos en los huecos (área `x0 + 4k + 2` fijo, `y + 2 .. y + d − 2`, z = techo), y después cada cono con `r = min(r, 2)` y `h = min(h, cap − (techo − lot.z))`.
10. **`coveredMarket`:** sin cuerpo cerrado. Paredes `style.mat` de 0.3 en los lados que no son `open[0]`/`open[1]`, cortadas 0.4 antes de cada lado abierto; en los lados abiertos, pilares `steel` 0.4×0.4×(h − 0.3) cada `len / round(len / 3.5)` incluidas las dos esquinas (las esquinas tapan el corte de las paredes); losa de techo `style.trim` 0.3 sobre todo el lote en `z h − 0.3`; dientes (`sawtooth`, `style.roof`) sobre la losa; toldos (`awning`) entre pilares a `z 3`, hacia afuera; `garland` a lo largo del frente `open[0]` a `z h − 0.6`; 6..9 puestos `prism` 2×1.5×1.8 (`whitewash`/`copper`/`rust` por rng) en filas paralelas al frente a `v 2` y `v 5.5` (y siguientes de a 3.5), uno por vano entre pilares, llenando primero la fila del frente. `h = min(6, cap − 2)`.
11. **`freightShed`: los camiones no entran delante de la nave.** Un camión acoplado de culata perpendicular al andén mide 8 (caja 6 + cabina 2) y la franja libre es 3: en 21×10 no hay lugar, y sacarlos del lote rompería el contrato y la regla del tren (`y_max ≤ 130.8`). Decisión: el andén corre a lo largo de **todo** el frente (1.5 de fondo, h 1.2, `concrete`, `v 0..1.5`); la nave ocupa el fondo del lote dejando 3 libres al frente, en el lado oeste (o norte, para frentes `e`/`w`), de largo `len − yard`; en el patio que queda al costado, `yard = n·2.4 + (n − 1) + 1`, `n = rng.int(2, 3)` camiones perpendiculares al andén con la culata contra su cara interior (`v 1.5`) y la cabina hacia el fondo. Pallets `deck` 1.2×1×0.5 sobre el andén (2..4). Nave: `gable` `style.mat`, `h = min(rng.int(5, 7), cap / (1 + GABLE_RATIO))`, `ribs` en las paredes largas y 2 placas `glass` por pared larga de 1.5 de ancho en `(k + 1)/3`, `z lot.z + 1 .. lot.z + h − 1`.
12. **`openDock`:** `storeroom` del kit en la esquina del fondo-oeste (sub-lote 6×5); 2..3 contenedores de una altura (`stackContainers(at, 1, along, rng)`, a lo largo del frente) en una fila a `v depth/2`, sin solaparse con el depósito ni entre sí; autoelevador `prism` 2×3×2 `rust` y 2..4 pallets en la franja del frente; `fence` del kit sin el tramo del frente (de sus cuatro `prism` se descarta el que corre sobre `open[0]`). Nada pasa de 3.
13. **Lab:** `kitScene` usa `STYLES.industrial` en la fila `industrial`, `STYLES.freight` para `freightShed` y `openDock` y `STYLES.warehouses` para el resto de la fila `reconversion`; las teclas `1..4` no cambian.
14. **"Ninguna escena cambia"** se verifica con un script fuera del repo (`.scratch/world-hash.ts`, `npx tsx`): hash de `JSON.stringify(world(7))` en la base y en la rama. No se commitea un test de hash: los hijos siguientes de #56 cambian el mundo a propósito (#56, decisión 8).

## Foco de revisión

1. **Frente que no es el sur** (`open: ["e"]`, `["w"]`, `["n"]`): el mercado fijo de #325 mira al este. Esperado: todo dentro del lote, slots y paredes abiertas del lado pedido. Test: tarea 9, "every frontage recipe honours open[0] on all four sides".
2. **Lote más hondo que ancho** (15×21): `sawtooth` solo pone dientes a lo largo de x. Esperado: el contrato se cumple igual. Test: tarea 9, "a 15×21 lot keeps the contract".
3. **Ventanas de los dientes tapadas por el diente vecino** (`lights.ts` ocluye por caja): esperado, ningún sólido de la pieza tapa una ventana de diente publicada. Test: tarea 2 (`loftHall`) y tarea 7 (`coveredMarket`), con `hides(lightBox(w.pts), bounds(s))`.
4. **Neones de la cervecería deduplicados**: dos slots con el mismo `shop` serían uno solo. Test: tarea 4, `shop` 0 y 1.
5. **Lote sin `open`**: esperado, frente al sur. Test: tarea 9, "no open side falls back to the south".

---

### Tarea 1: estilos, familia y barrios

**Archivos:** Modificar `src/kit/types.ts`, `src/kit/styles.ts`, `src/city/zoning.ts`, `src/city/zoning.test.ts`, `src/kit/forms/industrial.test.ts` (si fija la lista de estilos). Crear `src/kit/forms/reconversion.test.ts`.

**Interfaces:**
- Produce: `StyleId` suma `"warehouses" | "freight" | "harbor"`; `RecipeDef.family` suma `"reconversion"`; `STYLES.warehouses/freight/harbor`; `CATALOGUE.warehouses/freight/harbor`.

- [ ] **Paso 1: tests que fallan.** En `reconversion.test.ts`, `describe("reconversion family: styles")`: `expect(STYLES.warehouses).toEqual({ id: "warehouses", mat: "brick", trim: "steel", roof: "sheetGreen", tone: 0, floorH: 3.5, window: "windowWarm" })`, `STYLES.freight` = `{ id: "freight", mat: "sheetGreen", trim: "steel", roof: "sheetTeal", tone: 0, floorH: 3, window: "windowCool" }`, `STYLES.harbor` = `{ id: "harbor", mat: "brick", trim: "copper", roof: "sheetTeal", tone: 0, floorH: 3, window: "windowWarm" }`. En `zoning.test.ts`: `NEIGHBORHOODS` suma los tres; "catalogues" espera `weights("harbor")` `{}`, y en `lights` `warehouses: { on: 0.6, warm: 0.8 }`, `freight: { on: 0.3, warm: 0.2 }`, `harbor: { on: 0.6, warm: 0.85 }`; `CATALOGUE[z].style === z` sigue valiendo.
- [ ] **Paso 2:** `npx vitest run src/kit/forms/reconversion.test.ts src/city/zoning.test.ts` → FALLA.
- [ ] **Paso 3:** sumar los tipos, `STYLES` y `CATALOGUE` (`harbor: { recipes: [], style: "harbor", lights: { on: 0.6, warm: 0.85 } }`; `warehouses` y `freight` con `recipes: []` y sus luces hasta la tarea 9).
- [ ] **Paso 4:** `npm test && npm run typecheck` → verde (`lights.test` cuenta 0 en los barrios nuevos).
- [ ] **Paso 5:** commit `feat(#322): warehouses, freight and harbor styles and neighborhoods`.

### Tarea 2: `loftHall`, ayudantes de ventanas y contrato del kit

**Archivos:** Crear `src/kit/forms/reconversion.ts`. Modificar `src/kit/index.ts` (`RECIPES` suma `...RECONVERSION`), `src/kit/kit.test.ts` (contrato, decisión 1), `src/kit/forms/reconversion.test.ts`.

**Interfaces:**
- Produce en `reconversion.ts`:
  - `plateWindows(r: { at: Vec3; w: number; d: number }, plate: Plate, floor: number, building: number, panes = 1): Window[]` — puntos sobre el borde `plate.wall` del rectángulo (`0` NW→NE, `1` NE→SE, `2` SE→SW, `3` SW→NW, como `rect` en `solids.ts`), en orden `[(u0,z0), (u1,z0), (u1,z1), (u0,z1)]`, `wall` = normal hacia afuera (`0,-1,0` / `1,0,0` / `0,1,0` / `-1,0,0`), partido en `panes` con 0.2 entre paneles (decisión 2).
  - `publishGlass(p: Piece, building: number, floor: number, panes = 1): void` — publica las placas `glass` del sólido `p.solids[building]` en las paredes 1 y 2 (las que miran a la cámara).
  - `export const RECONVERSION: readonly RecipeDef[]` (orden final: `loftHall, vaultLoft, brewery, sheetLoft, derelictHall, coveredMarket, freightShed, openDock`).
  - `loftHall(lot, rng, style): Piece` (decisión 5).

- [ ] **Paso 1: tests que fallan** (`describe("loftHall")`, lotes `LOTS` de `industrial.test.ts`, 20 semillas, `STYLES.warehouses`): ≥ 4 ventanas con `floor === 2`, todas con `wall` `(1,0,0)` y `building` apuntando a una `ramp` con placa `glass`; el cuerpo es un `prism` `brick` con `facade` `{ floors: 2, cols: round(w/3.5), base: "glass" }`; hay un `prism` `leafDark` de 0.3 en `z = techo` dentro del tercio oeste y ningún diente en ese tercio; ningún sólido de la pieza distinto del dueño cumple `hides(lightBox(w.pts), bounds(s))` para las ventanas del piso 2 (foco 3). En `kit.test.ts` el contrato: `expect(s && (("facade" in s && s.facade) || ("plates" in s && s.plates?.some((q) => q.mat === "glass")))).toBeTruthy()`. En `reconversion.test.ts`: `plateWindows` sobre `{ at: v3(0,0,0), w: 10, d: 4 }` con placa `{ wall: 2, u0: 0.2, u1: 0.4, z0: 1, z1: 2 }` da `[v3(8,4,1), v3(6,4,1), v3(6,4,2), v3(8,4,2)]` y `wall` `(0,1,0)`; con `panes: 2` da dos ventanas que no se solapan y suman `0.2·10 − 0.2` de largo.
- [ ] **Paso 2:** `npx vitest run src/kit` → FALLA.
- [ ] **Paso 3:** implementar ayudantes, `loftHall` y el registro.
- [ ] **Paso 4:** `npm test && npm run typecheck` → verde (el genérico corre `loftHall`).
- [ ] **Paso 5:** commit `feat(#322): loftHall and windows from glass plates`.

### Tarea 3: `vaultLoft` y marco del frente

**Archivos:** Modificar `reconversion.ts`, `reconversion.test.ts`.

**Interfaces:**
- Produce: `frontFrame(lot: Lot): { side: Side; wall: number; len: number; depth: number; rect(u: number, v: number, du: number, dv: number): Rect; point(u: number, v: number): Vec2 }` — `side = lot.open[0] ?? "s"`, `wall` = índice de placa del lado (`n 0, e 1, s 2, w 3`), `len`/`depth` a lo largo y hacia adentro; `rect` con `v` desde el borde del frente (para `s`: `x = lot.x + u`, `y = lot.y + lot.d − v − dv`; `n`: `y = lot.y + v`; `e`: `x = lot.x + lot.w − v − dv`, `y = lot.y + u`; `w`: `x = lot.x + v`, `y = lot.y + u`).
- Produce: `vaultLoft(lot, rng, style): Piece` (decisión 6).

- [ ] **Paso 1: tests que fallan:** `frontFrame` para los cuatro lados mapea `rect(0, 0, 2, 1)` a la franja pegada al borde del frente (cuatro `expect(...).toEqual(...)` sobre el lote `{ x: 0, y: 0, w: 20, d: 10 }`). `vaultLoft`: hay un `vault` `style.roof` de `len` ≤ 18 con base en `lot.z + h` y `axis` `"x"` con `open ["s"]` / `"y"` con `open ["e"]`; el cuerpo tiene una placa `glass` con `toneOffset 1` en `wall` = índice de `open[0]`; hay un `prism` `deck` con `h 0.3`, base `lot.z + 2.5`, que sale 1 de la pared del frente.
- [ ] **Paso 2:** FALLA. **Paso 3:** implementar y registrar. **Paso 4:** `npm test && npm run typecheck` verde.
- [ ] **Paso 5:** commit `feat(#322): vaultLoft`.

### Tarea 4: `brewery`

**Archivos:** Modificar `reconversion.ts`, `reconversion.test.ts`, `src/kit/forms/lowrise.ts` (exportar `neonSlot`, sin otro cambio).

**Interfaces:** Consume `frontFrame`, `neonSlot(r: Rect, side: Side, width: number, z: number, shop: number): Slot`. Produce `brewery(lot, rng, style): Piece` (decisión 7).

- [ ] **Paso 1: tests que fallan:** exactamente dos `slots`, ambos `kind "neon"`, `side === open[0]`, `shop` `[0, 1]`, todos sus puntos con `z − lot.z` en `[2.4, 3.6]`; 3..5 `cylinder` `copper` r 1.2 h 4.5, cada uno con un `cone` `copper` encima; un `prism` `glass` de 0.3 de espesor y h 4; hay acentos `dot` `amber` (guirnalda) y dos postes `steel` de 3; el cuerpo con `facade { floors: 1, cols: 3 }` está en la mitad trasera. Con `open ["e"]` los slots quedan sobre la cara este del ventanal.
- [ ] **Paso 2:** FALLA. **Paso 3:** implementar y registrar. **Paso 4:** verde.
- [ ] **Paso 5:** commit `feat(#322): brewery`.

### Tarea 5: `sheetLoft`

**Archivos:** Modificar `reconversion.ts`, `reconversion.test.ts`.

**Interfaces:** Consume `publishGlass`, `ribs`. Produce `sheetLoft(lot, rng, style): Piece` (decisión 8).

- [ ] **Paso 1: tests que fallan:** un `prism` `gable` `sheetGreen` o `sheetTeal`; ≥ 6 costillas por pared larga; 3 placas `glass` por pared larga de ancho `2.5` (`(u1 − u0)·len`), `z0 = lot.z + 1`, `z1 ≤ lot.z + 4.5`; las ventanas publicadas son exactamente las placas `glass` de las paredes 1 y 2 (mismos puntos que `plateWindows`).
- [ ] **Paso 2:** FALLA. **Paso 3:** implementar y registrar. **Paso 4:** verde.
- [ ] **Paso 5:** commit `feat(#322): sheetLoft`.

### Tarea 6: `derelictHall`

**Archivos:** Modificar `reconversion.ts`, `reconversion.test.ts`.

**Interfaces:** Consume `sawtooth`, `jungle`. Produce `derelictHall(lot, rng, style): Piece` (decisión 9).

- [ ] **Paso 1: tests que fallan:** `ridges` = `beam` `steel` con `from.y !== to.y` (a lo largo de y): `ridges.length` en `[1, 2]`; `ramps.length + ridges.length` en `[4, 5]`; ninguna `ramp` tiene `at.x + 4` igual (1e-9) al `x` de una cumbrera; 4..6 `cone` con `r ≤ 2` dentro del lote; `windows` vacío y ningún sólido con `facade`; el cuerpo tiene `tone` = tono de la pieza − 1 (con `style.tone 0` y `rng` sembrado, comparar contra `shiftTone`).
- [ ] **Paso 2:** FALLA. **Paso 3:** implementar y registrar. **Paso 4:** verde.
- [ ] **Paso 5:** commit `feat(#322): derelictHall`.

### Tarea 7: `coveredMarket`

**Archivos:** Modificar `reconversion.ts`, `reconversion.test.ts`.

**Interfaces:** Consume `frontFrame`, `sawtooth`, `publishGlass`, `awning`, `garland`. Produce `coveredMarket(lot, rng, style): Piece` (decisión 10).

- [ ] **Paso 1: tests que fallan:** con `open ["s"]` y `["e"]`: ningún sólido de altura (`max.z − min.z`) ≥ 3 llega al borde de `open[0]` (`max.y ≥ lot.y + lot.d − 1e-9` para `s`; `max.x ≥ lot.x + lot.w − 1e-9` para `e`) salvo los pilares `steel` 0.4×0.4; hay ≥ 2 pilares en ese borde; 6..9 puestos (`prism` 2×1.5×1.8 de `whitewash`/`copper`/`rust`); hay `awning` y acentos de guirnalda; publica ventanas de los dientes (`floor 1`, dueño una `ramp`), y ningún sólido ajeno las tapa (foco 3).
- [ ] **Paso 2:** FALLA. **Paso 3:** implementar y registrar. **Paso 4:** verde.
- [ ] **Paso 5:** commit `feat(#322): coveredMarket`.

### Tarea 8: `freightShed` y `openDock`

**Archivos:** Modificar `reconversion.ts`, `reconversion.test.ts`, `src/kit/index.ts` (`LAB_LOTS.freightShed = { w: 21, d: 10 }`, `LAB_LOTS.openDock = { w: 21, d: 10 }`).

**Interfaces:** Consume `frontFrame`, `publishGlass`, `ribs`, `stackContainers`, `storeroom`, `fence`. Produce `freightShed`, `openDock` (decisiones 11 y 12).

- [ ] **Paso 1: tests que fallan** (lote `{ x: 1.5, y: 1.5, w: 21, d: 10, z: 0, open: ["s"], maxH: 24 }`, 20 semillas, `STYLES.freight`): `freightShed` tiene un `prism` `concrete` h 1.2 de 1.5 de fondo pegado al borde sur y de largo 21; 2..3 camiones (`prism` 6 de largo en y, 2.4, 2.8, `rust`/`steel`) cada uno con una cabina `steel` 2×2.4×2.2 alineada, perpendiculares al andén (largo en y) y con la culata en `y = lot.y + lot.d − 1.5`; una nave `gable` con 2 placas `glass` por pared larga y ventanas publicadas; los camiones no se solapan en planta con la nave; todo dentro del lote sin margen (`min ≥ lot − 1e-9`, `max ≤ lot + w/d + 1e-9`). `openDock`: `max.z ≤ lot.z + 3` de todo sólido; 2..3 contenedores; un `prism` `rust` 2×3×2; exactamente 3 tramos de cerco `officeDark` h 1.2 y ninguno sobre el borde del frente; las cajas en planta de contenedores, depósito y autoelevador no se solapan. `LAB_LOTS` con los dos lotes.
- [ ] **Paso 2:** FALLA. **Paso 3:** implementar y registrar. **Paso 4:** verde (el genérico los corre en 21×10).
- [ ] **Paso 5:** commit `feat(#322): freightShed and openDock`.

### Tarea 9: catálogos, lab y bordes

**Archivos:** Modificar `src/city/zoning.ts`, `src/city/zoning.test.ts`, `src/lab/kit-scene.ts`, `src/lab/kit-scene.test.ts`, `src/kit/forms/reconversion.test.ts`, `README.md` (la fila `reconversion` en el párrafo de `/lab/kit.html`).

**Interfaces:** Consume `RECONVERSION`. Produce `CATALOGUE.warehouses.recipes`, `CATALOGUE.freight.recipes`.

- [ ] **Paso 1: tests que fallan:** `weights("warehouses")` = `{ loftHall: 30, vaultLoft: 20, brewery: 25, sheetLoft: 15, derelictHall: 10 }`, `weights("freight")` = `{ freightShed: 60, openDock: 40 }`. `kit-scene.test`: la fila `reconversion` existe con las ocho en orden; el cuerpo de `loftHall` es `brick` con estilo `downtown` elegido; la nave de `freightShed` es `sheetGreen`. `reconversion.test`: "registers the eight recipes in order"; "every frontage recipe honours open[0] on all four sides" (las ocho en lotes 21×15 y 24×18 con `open` `["n"]`, `["e"]`, `["w"]`: contrato de lote + 0.8 y cap; `brewery` con slots en ese lado; `coveredMarket` sin pared en ese borde); "a 15×21 lot keeps the contract"; "no open side falls back to the south" (`open: []` da lo mismo que `["s"]` para `brewery` y `vaultLoft`).
- [ ] **Paso 2:** FALLA. **Paso 3:** implementar. **Paso 4:** `npm test && npm run typecheck` verde.
- [ ] **Paso 5:** `npx tsx .scratch/world-hash.ts` en la base y en la rama → mismo hash (decisión 14).
- [ ] **Paso 6:** commit `feat(#322): warehouses and freight catalogues and the reconversion row in the kit lab`.
