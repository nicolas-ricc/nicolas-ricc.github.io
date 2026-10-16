# Remolcador como Damen ASD Tug 2810 (#61) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `tug()` en `src/scenes/ships.ts` para que reproduzca al Damen ASD Tug 2810: casco 19 × 7, caseta con timonera panorámica de vidrio a proa de la mitad, dos chimeneas laterales detrás, mástil con luces, guinche y pudding macizo a proa, defensas en bandas, proa y esquinas de popa, bitas y dos balsas en el techo.

**Architecture:** Solo cambian `SHIP_SPECS.tug`, `SHIP_MATS` (suma `asphalt`, la goma negra), el docstring y el cuerpo de `tug()` en `src/scenes/ships.ts`, más `src/scenes/ships.test.ts`. Las piezas siguen la lista de la sección `tug` de `docs/superpowers/specs/2026-10-16-barcos-referencia.md` (coordenadas locales del kit: x a proa desde la popa, y a estribor). Rutas, animador y `wake()` no se tocan: `wake` lee `SHIP_SPECS` y las rutas posicionan por el centro del casco.

**Tech Stack:** TypeScript, PixiJS (render iso propio en `src/iso/`), Vitest (`npm test`), `npm run typecheck`, `npm run build`, `agent-browser` sobre el lab de Vite.

**Spec:** issue #61 (cuerpo) + decisiones de la historia #57 (comentario de plan) + sección `tug` y "Decisiones" de `docs/superpowers/specs/2026-10-16-barcos-referencia.md`.

## Global Constraints

- `SHIP_SPECS.tug` = `{ len: 19, beam: 7, h: 2.2, sheer: 0.3, topMat: "hullBlue" }` (28.7 × 10.4 m a 1 u ≈ 1.5 m; `h` y `sheer` del documento de referencia).
- Se conserva el id `ShipKind` `"tug"`; el docstring de `ships.ts` dice qué modelo reproduce.
- Caja: eslora ≤ 60 u, manga ≤ 10 u, ningún sólido del remolcador por encima de z = 13 (agua en z −1; `deck = WATER_Z + spec.h` = 1.2).
- Presupuesto: ≤ 40 sólidos y ≤ 8 luces por barco (el test general pasa de 30 / 6 a 40 / 8). `[lab] peor redibujo en 5 s` ≤ 15 ms en `/lab/blog.html`.
- Materiales: solo claves existentes de `ISO_TONES` (`src/map/palette-iso.ts`), agregándolas a `SHIP_MATS`; no se agregan colores. Goma negra = `asphalt`.
- Luces de navegación: tope `magentaMid`, babor `magenta`, estribor `cyanMid` (en ese orden, primeras tres); ventanas encendidas como `poly` `magentaBleed`.
- `wake()` sigue devolviendo 17 triángulos; su test no cambia.
- Piezas dentro de la caja del casco en planta (margen 2) y con base sobre la cubierta (z ≥ 1.2), salvo la goma (`asphalt`: rieles de defensa, pudding, cilindros de popa), que cuelga del costado; la excepción del test pasa de "cilindros r 0.45" a "material `asphalt`".
- Capturas: `docs/superpowers/specs/assets/57-barcos/tug-antes.png` (ya tomada antes de tocar código) y `tug-despues.png`.

## Review Focus

1. Rumbos distintos de 0 (el barco navega en todas las direcciones del carril): toda pieza debe rotar con `heading` → test con rumbo π/2 que verifica que la proa (pudding) queda al sur, en y ≈ 100 + 19.
2. Piezas que flotan o se hunden en la cubierta con arrufo (la cubierta sube a proa: z ≈ 1.4 en x 15.2) → guinche, bitas de proa y amurada arrancan en z 1.4 según el documento; se revisa en la captura.
3. Superposición con otros barcos o sólidos estáticos por crecer de 18 × 6 a 19 × 7 → las rutas se validaron con la caja del carguero (60 × 10 × z 13); el suite de `sea-anim.test.ts` debe seguir verde sin tocarlo.
4. Defensas que se salen de la manga más de lo permitido (rieles en |y| 3.2–3.5 con media manga 3.5) → cubierto por el test de caja (margen 2).
5. Coste de dibujo con 27 sólidos (antes 13) y bloom → medición del log del lab con los tres barcos a la vista.

---

## Datos de la hoja de piezas (del documento de referencia)

`deck = -1 + 2.2 = 1.2`. Todas las llamadas son del kit (`k.box(dx, dy, w, d, z, h, mat, facade?)`, `k.cyl(dx, dy, z, r, h, mat)`, `k.dot(dx, dy, z, r, color)`, `k.poly(pts, color, alpha)`).

| Pieza | Llamada |
| --- | --- |
| caseta | `k.box(8.2, -2.2, 6, 4.4, deck, 1.7, "whitewash", { floors: 1, cols: 3 })` |
| timonera panorámica | `k.box(9.7, -1.9, 3.5, 3.8, deck + 1.7, 1.9, "whitewash", { floors: 1, cols: 4, base: "glass" })` |
| techo de la timonera | `k.box(9.5, -2.1, 3.9, 4.2, deck + 3.6, 0.15, "steel")` |
| chimeneas (babor, estribor) | `k.cyl(8.5, ±1.9, deck + 1.7, 0.3, 2.7, "steel")` |
| mástil | `k.box(11.2, -0.15, 0.3, 0.3, deck + 3.75, 4.9, "steel")` |
| cruceta | `k.box(11.1, -1.3, 0.25, 2.6, deck + 6.7, 0.2, "steel")` |
| radar | `k.box(10.9, -0.8, 0.3, 1.6, deck + 5, 0.2, "steel")` |
| proyectores (babor, estribor) | `k.box(12.7, -1.7, 0.5, 0.5, deck + 3.75, 0.5, "steel")`, `k.box(12.7, 1.2, 0.5, 0.5, deck + 3.75, 0.5, "steel")` |
| balsas salvavidas en el techo | `k.cyl(10, ±1.4, deck + 3.75, 0.35, 0.5, "whitewash")` |
| guinche de proa | `k.cyl(15.2, 0, 1.4, 0.6, 0.9, "steel")` |
| bitas de proa | `k.cyl(15.2, ±1.4, 1.4, 0.25, 0.5, "steel")` |
| bita de popa | `k.cyl(2.5, 0, deck, 0.35, 0.6, "steel")` |
| amurada de proa | `k.box(14.4, -2.35, 1, 0.25, 1.4, 0.8, "hullBlue")`, `k.box(14.4, 2.1, 1, 0.25, 1.4, 0.8, "hullBlue")` |
| pudding ancho / punta | `k.box(16.2, -2, 1.8, 4, 0.9, 1, "asphalt")`, `k.box(18, -0.8, 1, 1.6, 0.9, 1, "asphalt")` |
| rieles de defensa | `k.box(4.2, -3.5, 7, 0.3, 0.2, 0.5, "asphalt")`, `k.box(4.2, 3.2, 7, 0.3, 0.2, 0.5, "asphalt")` |
| cilindros de esquina de popa | `k.cyl(0.9, ±1.7, 1, 0.45, 0.9, "asphalt")` |
| luces | tope `k.dot(11.35, 0, 10, 0.7, "magentaMid")`, babor `k.dot(12, -2.1, 5.15, 0.4, "magenta")`, estribor `k.dot(12, 2.1, 5.15, 0.4, "cyanMid")`, proyectores `k.dot(12.95, ±1.45, 5.5, 0.35, "amber")`, ventanas `k.poly([[13.22, -1.7, 3.2], [13.22, 1.7, 3.2], [13.22, 1.7, 4.5], [13.22, -1.7, 4.5]], "magentaBleed", 0.8)` |

Total: casco + 26 piezas = 27 sólidos; 6 luces. La grúa opcional de popa a babor del documento no se modela (queda oculta con rumbo 0 y no está en todas las unidades). Las balsas no están en la lista del documento: las pide el issue ("dos botes/balsas en el techo").

---

### Task 1: Spec 19 × 7, goma `asphalt` y presupuesto 40 / 8

**Files:**
- Modify: `src/scenes/ships.ts` (`SHIP_SPECS.tug`, `SHIP_MATS`)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Produces: `SHIP_SPECS.tug = { len: 19, beam: 7, h: 2.2, sheer: 0.3, topMat: "hullBlue" }`; `SHIP_MATS` incluye `"asphalt"`. Test general con ≤ 40 sólidos, ≤ 8 luces y excepción de cubierta para `mat === "asphalt"`.

- [ ] **Step 1: Write the failing test.** En el primer `it` de `ships.test.ts`, cambiar `toBeLessThanOrEqual(30)` → `40`, `(6)` → `8`, el título ("≤ 40 sólidos, ≤ 8 luces") y la excepción de cubierta:

```ts
if (x.kind !== "hull" && x.mat !== "asphalt") expect(b.min.z).toBeGreaterThanOrEqual(-1 + spec.h - 0.01); // la goma (defensas, pudding) cuelga del costado
```

Agregar un `it` nuevo:

```ts
it("remolcador: casco del ASD Tug 2810 (28.7 × 10.4 m → 19 × 7 u) con goma asphalt entre los materiales", () => {
  expect(SHIP_SPECS.tug).toEqual({ len: 19, beam: 7, h: 2.2, sheer: 0.3, topMat: "hullBlue" });
  expect(SHIP_MATS).toContain("asphalt");
});
```

- [ ] **Step 2: Run** `npx vitest run src/scenes/ships.test.ts` → FAIL en el `it` nuevo (spec 18 × 6) y, por la excepción cambiada, en el primero (las defensas viejas `rust` r 0.45 quedan bajo la cubierta).
- [ ] **Step 3: Implement.** En `ships.ts`: `tug: { len: 19, beam: 7, h: 2.2, sheer: 0.3, topMat: "hullBlue" }` y agregar `"asphalt"` al final de `SHIP_MATS`. En `tug()`, cambiar el material de las 6 defensas viejas de `"rust"` a `"asphalt"` (el cuerpo entero se rehace en la Task 2; esto solo mantiene verde la suite entre tareas). Ajustar el test viejo "remolcador con defensas" que cuenta `r === 0.45` solo si falla.
- [ ] **Step 4: Run** `npx vitest run src/scenes/ships.test.ts` y `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#61): remolcador 19 × 7 y goma asphalt; presupuesto 40 sólidos / 8 luces`.

### Task 2: Caseta, timonera panorámica, chimeneas, mástil y techo

**Files:**
- Modify: `src/scenes/ships.ts` (docstring del módulo, cuerpo de `tug()`)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: Task 1 (`SHIP_SPECS.tug`, `asphalt` en `SHIP_MATS`).
- Produces: `tug()` nuevo con la superestructura y las luces de la hoja de piezas; las piezas de proa y defensas quedan para la Task 3.

- [ ] **Step 1: Write the failing test.** Reemplazar en el `it` "remolcador con defensas y timonera; barcaza…" las dos líneas del remolcador por nada (la barcaza y la lancha siguen igual; renombrar a "barcaza con diez contenedores…; lancha de dos cubiertas") y agregar:

```ts
it("remolcador ASD 2810: timonera de vidrio a proa de la mitad sobre una caseta más ancha, dos chimeneas laterales detrás, mástil como punto más alto (≤ z 13), dos balsas en el techo", () => {
  const s = ship("tug", { x: 0, y: 0 }, 0), deck = -1 + SHIP_SPECS.tug.h;
  const polys = s.solids.filter((x) => x.kind === "poly");
  const wheel = polys.find((x) => x.facade?.base === "glass")!;
  const house = polys.find((x) => x.mat === "whitewash" && x.facade && x.facade.base !== "glass")!;
  const wb = bounds(wheel), hb = bounds(house);
  expect(wheel.mat).toBe("whitewash");
  expect(wb.min.x).toBeGreaterThan(SHIP_SPECS.tug.len / 2); // a proa de la mitad
  expect(wb.min.z).toBeCloseTo(hb.max.z, 6); // apoyada sobre la caseta
  expect(hb.max.y - hb.min.y).toBeGreaterThan(wb.max.y - wb.min.y); // caseta más ancha
  const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h === 2.7);
  expect(stacks).toHaveLength(2);
  expect(stacks.map((x) => Math.sign(bounds(x).min.y + bounds(x).max.y)).sort()).toEqual([-1, 1]); // una por banda
  for (const c of stacks) expect(bounds(c).max.x).toBeLessThanOrEqual(wb.min.x); // detrás de la timonera
  const top = Math.max(...s.solids.map((x) => bounds(x).max.z));
  expect(top).toBeLessThanOrEqual(13);
  expect(top).toBeGreaterThan(wb.max.z + 3); // el mástil sobresale de la timonera
  const rafts = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "whitewash");
  expect(rafts).toHaveLength(2);
  for (const r of rafts) expect(bounds(r).min.z).toBeGreaterThanOrEqual(wb.max.z);
  expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
  expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
  expect(deck).toBeCloseTo(1.2, 6);
});
```

- [ ] **Step 2: Run** `npx vitest run src/scenes/ships.test.ts` → FAIL (timonera a popa de la mitad, una sola chimenea `rust`, sin balsas).
- [ ] **Step 3: Implement.** Reescribir `tug()` con las filas de la hoja de piezas desde "caseta" hasta "balsas" y las cinco luces + `poly` de ventanas (orden: tope, babor, estribor, proyectores, ventanas). Conservar provisoriamente de la versión vieja la bita, el pudding y las defensas (`asphalt`) para no perder piezas entre tareas; la Task 3 las reemplaza. Docstring del módulo: agregar una línea "`tug` reproduce al Damen ASD Tug 2810 (`docs/superpowers/specs/2026-10-16-barcos-referencia.md`)" y un comentario corto por pieza como en `cargo()`.
- [ ] **Step 4: Run** `npx vitest run src/scenes/ships.test.ts` y `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#61): timonera panorámica, caseta, dos chimeneas y mástil del ASD 2810`.

### Task 3: Proa (guinche, bitas, pudding, amurada) y defensas en todo el contorno

**Files:**
- Modify: `src/scenes/ships.ts` (`tug()`)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: Task 2 (`tug()` con superestructura).
- Produces: `tug()` final, 27 sólidos y 6 luces.

- [ ] **Step 1: Write the failing test.**

```ts
it("remolcador ASD 2810: guinche y bitas a proa, pudding macizo en la roda, defensas en ambas bandas, proa y esquinas de popa; rota con el rumbo", () => {
  const s = ship("tug", { x: 0, y: 0 }, 0), { len, beam } = SHIP_SPECS.tug;
  const rubber = s.solids.filter((x) => x.mat === "asphalt").map(bounds);
  expect(rubber.some((b) => b.min.y <= -beam / 2 && b.max.x - b.min.x >= 5)).toBe(true); // riel de babor
  expect(rubber.some((b) => b.max.y >= beam / 2 && b.max.x - b.min.x >= 5)).toBe(true); // riel de estribor
  expect(rubber.filter((b) => b.max.x >= len - 1)).not.toHaveLength(0); // pudding en la roda
  expect(rubber.filter((b) => b.max.x <= 2)).toHaveLength(2); // cilindros de esquina de popa
  const winch = s.solids.find((x) => x.kind === "cylinder" && x.mat === "steel" && x.r === 0.6)!;
  expect(bounds(winch).min.x).toBeGreaterThan(14); // a proa de la caseta
  const bitts = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h <= 0.6);
  expect(bitts.length).toBeGreaterThanOrEqual(3);
  expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "hullBlue")).toHaveLength(2); // amurada de proa
  expect(s.solids.length).toBeLessThanOrEqual(40); expect(s.lights.length).toBeLessThanOrEqual(8);
  const south = ship("tug", { x: 100, y: 100 }, Math.PI / 2);
  expect(Math.max(...south.solids.map((x) => bounds(x).max.y))).toBeCloseTo(100 + len, 6); // la punta del pudding es la roda
});
```

- [ ] **Step 2: Run** `npx vitest run src/scenes/ships.test.ts` → FAIL (defensas viejas son cilindros chicos, sin rieles ni guinche).
- [ ] **Step 3: Implement.** En `tug()`, reemplazar la bita, el pudding y las defensas viejas por las filas de la hoja: guinche, bitas de proa, bita de popa, amurada de proa, pudding ancho y punta, rieles de defensa y cilindros de esquina de popa.
- [ ] **Step 4: Run** `npm test` y `npm run typecheck` → PASS (incluye `sea-anim.test.ts` y `sea-animator.test.ts` sin tocarlos).
- [ ] **Step 5: Commit** `feat(#61): guinche, pudding y defensas en todo el contorno del ASD 2810`.

### Verificación en el lab (la hace el controlador al final de la etapa 4)

- Captura de cerca `tug-despues.png` con la misma página de `.scratch/` que tomó `tug-antes.png` (zoom 8 sobre el fondeadero, remolcador 20 s después de llegar).
- `/lab/blog.html` (tecla `3`, `?speed=` para tener los tres barcos a la vista): copiar `[lab] peor redibujo en 5 s` (≤ 15 ms) de la consola.
- `npm run build` en verde.
