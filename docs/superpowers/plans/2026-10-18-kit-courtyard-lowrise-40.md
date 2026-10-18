# Kit: familias `courtyard` y `lowrise` (#40) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al kit dos familias de recetas, `courtyard` (O, U, C, patio residencial) y `lowrise` (hilera de locales con slots de neón, casas en hilera, ruina devorada), registrarlas en `RECIPES` y verlas en `lab/kit.html`.

**Architecture:** Dos archivos nuevos en `src/kit/forms/`, cada uno con sus recetas puras `(lot, rng, style) => Piece` y su arreglo `RecipeDef[]`. Las manzanas con patio se arman con un helper `ring()` que parte el lote en alas rectangulares disjuntas (nunca un anillo, por el orden de pintado de `sortByDepth`). La hilera de locales y las casas se orientan con el lado del frente (`lot.open[0]`, por defecto `"s"`) mediante helpers chicos (`frontLen`, `frontRect`, `wallOf`). El registro suma una línea por familia; el test genérico `kit.test.ts` las cubre solo.

**Tech Stack:** TypeScript estricto, Vitest (`npm test`), `npm run typecheck`. Sin Pixi fuera de `src/lab/kit.ts`.

**Spec:** issue #40 (manda donde difiera) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §5.

## Global Constraints

- `src/iso/` no importa Pixi; ningún test importa Pixi.
- Ningún literal hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts` (`palette-guard.test.ts`).
- `Math.random` prohibido: toda aleatoriedad sale del `Rng` recibido.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo.
- Nada de dependencias nuevas. Commits `feat(#40): …` / `test(#40): …` / `docs(#40): …`.
- Reglas del contrato (las verifica `src/kit/kit.test.ts`, no se tocan): sólidos y `ground` dentro del lote + 0.8; nada bajo `lot.z`; `max.z ≤ lot.z + min(lot.maxH, 18)` (ninguna receta nueva es `landmark`), también con `maxH 10`; determinista; ventanas/paredes solo con normal `x > 0` o `y > 0`; sin `windowWarm`/`windowCool` en `accents`; nada ajeno en el hueco de un `poly` cóncavo; salida con `lot.z = 0.3` = salida con `lot.z = 0` desplazada.
- Las recetas deben funcionar con cualquier `w ≥ 16`, `d ≥ 12`.
- `npm test` y `npm run typecheck` en verde al final de cada task.

## Decisiones de implementación (declaradas)

1. **Tope de altura.** Cada receta topa su cuerpo para que el remate entre: cornisa 0.4 (`h ≤ floor(cap − 0.4)`), `hipRoof` 1.5 (`h ≤ floor(cap − 1.5)` o pisos reducidos). `cap = min(lot.maxH, RECIPE_MAX_H)`. El rng se consume igual (se sortea y después se topa).
2. **`courtyardC` con lotes reales.** Con alas de 5 la C no entra en 15 de fondo (ala central en `d/2 − 2.5` choca con el ala norte). Se arma en cinco bandas: ala norte, patio norte, ala central, patio sur, ala sur; el ala central tiene fondo `cd = min(5, d/3)` centrado (con `d ≥ 15` cae exactamente en `d/2 − 2.5`), alas norte/sur y patios de `(d − cd)/4`. Las dos alas laterales cortas van al oeste (ancho 5), así los dos patios abren al este, hacia la cámara.
3. **Baldosas del patio O.** "`tiles` 2×2" se lee como el helper `tiles()` existente (baldosa `TILE` = 6) sobre el rect del patio; no se agrega un tamaño de baldosa nuevo.
4. **Pasaje del ala sur en O.** Las dos mitades llevan cornisa con vuelo de 0.5 salvo del lado del pasaje (huella de la cornisa recortada 0.5), así ninguna AABB invade el hueco de 3.
5. **Hilera de locales con frente corto.** Si el frente mide menos de 16 (frente `e`/`w` en un lote de 12..15 de fondo), `n = min(rng.int(4, 5), floor(len / 4))`; los anchos arrancan en 4 y el resto se reparte de a 1 entre locales que no llegaron a 6; si todos llegaron a 6, el resto se reparte parejo.
6. **Tono de locales y casas.** `tone = style.tone + rng.int(−1, 1)`: conserva la variación por manzana que pondrá la zonificación.
7. **Slots de neón.** Rectángulo centrado en la pared del local, ancho `local.w − 1` (sobre la pared lateral de un local de esquina, el mismo ancho, centrado), z `lot.z + 2.4 .. lot.z + 3.6`, puntos sobre el plano de la pared. El segundo lado se publica solo si es adyacente al frente (un lado opuesto no tiene local de esquina). Las paredes que miran al norte u oeste también publican si son frente: filtrar por visibilidad es trabajo de `lights.ts` (#45).
8. **Toldo** de largo `local.w − 1` centrado sobre la vidriera, base a `lot.z + 2`, tope 2.4 (debajo del slot).
9. **Casas en hilera** se orientan por `lot.open[0]` como los locales (frente; jardín de 5 al fondo); se centran a lo largo del frente. Árboles: `floor(n / 2)`, uno en el centro del jardín de cada par.
10. **Ruina devorada** sobre el lote (no la manzana con vereda): losas a fracciones del lote para no pisarse con `d ≥ 12`; `jungle` con área retranqueada 4 del borde (r ≤ 4 ⇒ ningún cono sale del lote).
11. **Ventanas sobre paredes compartidas** (local contra local, ala contra ala) se publican igual que hoy en `addBuilding`: la oclusión por cajas de #45 las descarta. No se agrega filtro acá.
12. **`kit-scene.test.ts`**: el test del zócalo pasa a decidir por la presencia de `ground` de cada receta (no por el nombre `campus`), porque `eatenRuin` y algunos `courtyardO` traen `ground`.

## Review Focus

- Lote mínimo `w 16 × d 12` en todas las recetas: alas, patios y locales con medidas positivas y dentro del lote → test en Task 1, 2 y 3 con `{w:16, d:12}`.
- `open` con frente `e`/`w`/`n` en `shopRow` y `courtyardU`: slots sobre la pared correcta y U abierta del lado pedido → tests en Task 2 y 3.
- `maxH` bajo (10): cubierto por el genérico.
- Segundo lado opuesto (`["s", "n"]`): sin slot extra → test en Task 3.
- Árboles/banco del patio con patios angostos (2 de fondo): dentro del rect publicado → cubierto por el test de patio con lote mínimo.

---

### Task 1: `courtyard.ts` con `ring()` y `courtyardO`, registro y lab

**Files:**
- Create: `src/kit/forms/courtyard.ts`
- Modify: `src/kit/index.ts` (una línea)
- Modify: `src/lab/kit-scene.test.ts` (test del zócalo por presencia de `ground`)
- Test: `src/kit/forms/courtyard.test.ts`

**Interfaces:**
- Produces: `ring(r: Rect, t: number, sides: readonly Side[]): { wings: { side: Side; rect: Rect }[]; patio: Rect }`; `courtyardO: Recipe`; `COURTYARD: readonly RecipeDef[]` (Task 2 le suma tres entradas).

- [ ] **Step 1: tests** (los escribe la etapa de evals): en `courtyard.test.ts`, para cada receta con patio, con lotes `{1.5,1.5,21,15}`, `{0,0,24,18}` y `{0,0,16,12}` y 20 seeds: las alas (sólidos con `facade`) tienen AABB disjuntas en planta (solape > 1e-6 en x y en y = falla); `courtyard` definido y sin solape con ningún ala; todo `cone` y todo banco (prisma `paving` h 0.5) cae dentro de `courtyard` (± 1e-6). `courtyardO`: con `cx = lot.x + lot.w/2`, ningún sólido cuya AABB cruza en y la franja `[lot.y + lot.d − 5, lot.y + lot.d]` invade en x el intervalo abierto `(cx − 1.5, cx + 1.5)`.
- [ ] **Step 2: correr** `npx vitest run src/kit/forms/courtyard.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: implementar**

```ts
const CORNICE_H = 0.4, PASSAGE = 3;

/** Alas de ancho `t` sobre `r` en los lados pedidos: norte y sur a lo ancho, este y oeste entre ellas. Prismas disjuntos, nunca un anillo. */
export function ring(r: Rect, t: number, sides: readonly Side[]) {
  const has = (s: Side) => sides.includes(s);
  const y0 = r.y + (has("n") ? t : 0), y1 = r.y + r.d - (has("s") ? t : 0);
  const x0 = r.x + (has("w") ? t : 0), x1 = r.x + r.w - (has("e") ? t : 0);
  const wings: { side: Side; rect: Rect }[] = [];
  if (has("n")) wings.push({ side: "n", rect: { x: r.x, y: r.y, w: r.w, d: t } });
  if (has("s")) wings.push({ side: "s", rect: { x: r.x, y: y1, w: r.w, d: t } });
  if (has("w")) wings.push({ side: "w", rect: { x: r.x, y: y0, w: t, d: y1 - y0 } });
  if (has("e")) wings.push({ side: "e", rect: { x: x1, y: y0, w: t, d: y1 - y0 } });
  return { wings, patio: { x: x0, y: y0, w: x1 - x0, d: y1 - y0 } };
}

/** Ala con fachada de `style.mat` y cornisa; `flush` deja la cornisa sin vuelo de ese lado (borde del pasaje). */
function wing(p: Piece, r: Rect, z: number, h: number, cols: number, style: Style, flush?: "e" | "w"): void {
  const facade: Facade = { floors: Math.max(1, Math.round(h / style.floorH)), cols };
  addBuilding(p, prism(r.x, r.y, z, r.w, r.d, h, style.mat, { facade, tone: style.tone }), facade);
  const f = { x: r.x + (flush === "w" ? 0.5 : 0), y: r.y, w: r.w - (flush ? 0.5 : 0), d: r.d, z: z + h };
  p.solids.push(...cornice(f, style.trim));
}

/** `n` árboles de patio dentro de `r`, a 1 del borde (su radio). */
function patioTrees(p: Piece, rng: Rng, r: Rect, n: number, z: number): void {
  for (let k = 0; k < n; k++) p.solids.push(...patioTree(v3(r.x + 1 + rng.next() * Math.max(0, r.w - 2), r.y + 1 + rng.next() * Math.max(0, r.d - 2), z)));
}

export function courtyardO(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H);
  const h = Math.min(rng.int(7, 12), Math.floor(cap - CORNICE_H));
  const { wings, patio } = ring(lot, 5, ["n", "s", "w", "e"]);
  for (const { side, rect } of wings) {
    const cols = rng.int(3, 4);
    if (side !== "s") { wing(p, rect, lot.z, h, cols, style); continue; }
    const half = (rect.w - PASSAGE) / 2; // pasaje centrado: el fondo es el patio
    wing(p, { ...rect, w: half }, lot.z, h, cols, style, "e");
    wing(p, { ...rect, x: rect.x + half + PASSAGE, w: half }, lot.z, h, cols, style, "w");
  }
  if (rng.chance(0.5)) p.ground.push(tiles(rng, patio, lot.z + 0.05, "paving"));
  else { p.solids.push(prism(patio.x, patio.y, lot.z, patio.w, patio.d, 0.3, "leafDark")); patioTrees(p, rng, patio, rng.int(2, 3), lot.z + 0.3); }
  p.courtyard = patio;
  return p;
}

export const COURTYARD: readonly RecipeDef[] = [{ name: "courtyardO", recipe: courtyardO, family: "courtyard" }];
```

`index.ts`: `export const RECIPES: readonly RecipeDef[] = [...MODERN, ...COURTYARD];`

`kit-scene.test.ts`, test del zócalo: reemplazar el filtro por nombre por uno por `ground`:

```ts
const withGround = new Set(RECIPES.filter((r, i) => r.recipe({ x: 0, y: 0, w: 24, d: 18, z: PLINTH_H, open: ["s", "e"], maxH: 24 }, createRng(7 * 1000 + i), STYLES.centro).ground.length > 0).map((r) => r.name));
for (const l of lots.filter((q) => !withGround.has(q.name))) { … }
```
(mismo rng que `kitScene`: `createRng(seed * 1000 + i)`; título del test: "los lotes de receta sin ground llevan …").

- [ ] **Step 4:** `npx vitest run src/kit src/lab` → PASS. `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#40): courtyardO con alas y pasaje, registro COURTYARD`.

### Task 2: `courtyardU`, `courtyardC`, `patioResidential`

**Files:** Modify `src/kit/forms/courtyard.ts`; Test `src/kit/forms/courtyard.test.ts`.

**Interfaces:** Consumes `ring`, `wing`, `patioTrees` de Task 1. Produces tres recetas más en `COURTYARD` (orden: O, U, C, patioResidential).

- [ ] **Step 1: tests** (etapa de evals): los de alas/patio de Task 1 corren sobre las cuatro recetas. Más: `courtyardU` con `open: ["e"]` no tiene ala cuya AABB toque `x = lot.x + lot.w` salvo norte y sur, y el patio llega al borde este; con `open: []` el patio llega al borde sur; tiene 2 conos y 1 banco. `courtyardC` publica el patio sur (`courtyard.y > lot.y + lot.d/2`) y tiene 5 alas. `patioResidential`: 2..4 conos, un `prism` `roof: "hip"` de `style.roof` por ala (4), alas de 4.5.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: implementar**

```ts
const HIP_H = 1.5;

export function courtyardU(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), open = lot.open[0] ?? "s";
  const h = Math.min(rng.int(6, 10), Math.floor(cap - CORNICE_H));
  const { wings, patio } = ring(lot, 5, (["n", "s", "w", "e"] as const).filter((s) => s !== open));
  for (const { rect } of wings) wing(p, rect, lot.z, h, rng.int(3, 4), style);
  patioTrees(p, rng, patio, 2, lot.z);
  p.solids.push(...bench(v3(patio.x + patio.w / 2 - 1, patio.y + patio.d / 2 - 0.3, lot.z)));
  p.courtyard = patio;
  return p;
}

/** Dos patios en cinco bandas (decisión 2): ala norte, patio, ala central, patio, ala sur; dos alas cortas al oeste. */
export function courtyardC(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(6, 9), Math.floor(cap - CORNICE_H));
  const cd = Math.min(5, d / 3), t = (d - cd) / 4, side = 5;
  const bars: Rect[] = [{ x, y, w, d: t }, { x, y: y + 2 * t, w, d: cd }, { x, y: y + d - t, w, d: t }];
  for (const r of bars) wing(p, r, z, h, rng.int(3, 4), style);
  for (const r of [{ x, y: y + t, w: side, d: t }, { x, y: y + 2 * t + cd, w: side, d: t }]) wing(p, r, z, h, 2, style);
  p.courtyard = { x: x + side, y: y + 2 * t + cd, w: w - side, d: t };
  return p;
}

export function patioResidential(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H);
  const h = Math.min(rng.int(6, 9), Math.floor(cap - HIP_H));
  const { wings, patio } = ring(lot, 4.5, ["n", "s", "w", "e"]);
  for (const { rect: r } of wings) {
    const facade: Facade = { floors: Math.max(1, Math.round(h / style.floorH)), cols: rng.int(2, 3) };
    addBuilding(p, prism(r.x, r.y, lot.z, r.w, r.d, h, style.mat, { facade, tone: style.tone }), facade);
    p.solids.push(...hipRoof({ ...r, z: lot.z + h }, style.roof));
  }
  patioTrees(p, rng, patio, rng.int(2, 4), lot.z);
  p.courtyard = patio;
  return p;
}
```

Registro: sumar `{ name: "courtyardU", … }`, `{ name: "courtyardC", … }`, `{ name: "patioResidential", … }` con `family: "courtyard"`.

- [ ] **Step 4:** `npx vitest run src/kit src/lab` → PASS; typecheck.
- [ ] **Step 5:** commit `feat(#40): courtyardU, courtyardC y patioResidential`.

### Task 3: `lowrise.ts` con `shopRow`, registro

**Files:** Create `src/kit/forms/lowrise.ts`; Modify `src/kit/index.ts`; Test `src/kit/forms/lowrise.test.ts`.

**Interfaces:** Produces `frontLen(lot, side)`, `frontRect(lot, side, s0, s1, back): Rect`, `wallOf(r, side)`, `shopRow: Recipe`, `LOWRISE: readonly RecipeDef[]` (Task 4 suma dos).

- [ ] **Step 1: tests** (etapa de evals), lote `{1.5,1.5,21,15,z:0,maxH:24}` y 20 seeds: `open: ["s"]` → 4..5 slots `neon`, `side: "s"`, todos los z en `[2.4, 3.6]`, todos los puntos con `y = lot.y + lot.d` ± 1e-6, `local` distintos 0..n−1; `open: []` → sin slots; `open: ["s", "e"]` → al menos un slot `side: "e"` con `x = lot.x + lot.w`; `open: ["s", "n"]` → solo slots `s`; `open: ["e"]` con lote 16×12 → slots `side: "e"` con `x = lot.x + lot.w`, al menos 3; cada local (sólido con `facade`) tiene `facade.base === "glass"`, y hay tantos `ramp` `awning` como locales; slot y toldo no se cruzan (toldo `max.z ≤ lot.z + 2.4`).
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: implementar**

```ts
const SHOP_MIN = 4, SHOP_MAX = 6, SHOP_BACK = 3, NEON_Z0 = 2.4, NEON_H = 1.2, AWNING_Z = 2, HIP_H = 1.5;

const alongX = (side: Side): boolean => side === "n" || side === "s";
export const frontLen = (lot: Lot, side: Side): number => (alongX(side) ? lot.w : lot.d);

/** Franja `s0..s1` a lo largo del frente `side`, pegada a él, con todo el fondo menos `back`. */
export function frontRect(lot: Lot, side: Side, s0: number, s1: number, back: number): Rect {
  const deep = (alongX(side) ? lot.d : lot.w) - back;
  switch (side) {
    case "s": return { x: lot.x + s0, y: lot.y + back, w: s1 - s0, d: deep };
    case "n": return { x: lot.x + s0, y: lot.y, w: s1 - s0, d: deep };
    case "e": return { x: lot.x + back, y: lot.y + s0, w: deep, d: s1 - s0 };
    case "w": return { x: lot.x, y: lot.y + s0, w: deep, d: s1 - s0 };
  }
}

/** Pared del lado `side` de `r`: extremos a→b en planta y normal hacia afuera. */
export function wallOf(r: Rect, side: Side): { a: Vec2; b: Vec2; normal: Vec3 } {
  switch (side) {
    case "s": return { a: { x: r.x, y: r.y + r.d }, b: { x: r.x + r.w, y: r.y + r.d }, normal: v3(0, 1, 0) };
    case "n": return { a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y }, normal: v3(0, -1, 0) };
    case "e": return { a: { x: r.x + r.w, y: r.y }, b: { x: r.x + r.w, y: r.y + r.d }, normal: v3(1, 0, 0) };
    case "w": return { a: { x: r.x, y: r.y }, b: { x: r.x, y: r.y + r.d }, normal: v3(-1, 0, 0) };
  }
}

/** Slot de neón de ancho `width` centrado en la pared `side` de `r`, z `lot.z + 2.4 .. + 3.6`. */
function neonSlot(r: Rect, side: Side, width: number, z: number, local: number): Slot {
  const { a, b, normal } = wallOf(r, side), len = Math.hypot(b.x - a.x, b.y - a.y);
  const at = (t: number, zz: number) => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, zz);
  const t0 = (len - width) / 2 / len, t1 = 1 - t0, z0 = z + NEON_Z0, z1 = z0 + NEON_H;
  return { pts: [at(t0, z0), at(t1, z0), at(t1, z1), at(t0, z1)], wall: normal, side, kind: "neon", local };
}

/** Toldo de `len` centrado sobre la pared `side` de `r`, bajando hacia la calle. */
function shopAwning(r: Rect, side: Side, len: number, z: number): Solid[] {
  const { a } = wallOf(r, side), pad = (alongX(side) ? r.w : r.d) / 2 - len / 2, za = z + AWNING_Z;
  const at = side === "s" ? v3(a.x + pad, a.y, za) : side === "n" ? v3(a.x + pad, a.y - 0.8, za) : side === "e" ? v3(a.x, a.y + pad, za) : v3(a.x - 0.8, a.y + pad, za);
  return awning(at, len, side);
}

/** Anchos de `n` locales que suman `len` (decisión 5). */
function shopWidths(rng: Rng, len: number): number[] {
  const n = Math.min(rng.int(4, 5), Math.floor(len / SHOP_MIN));
  const ws = Array.from({ length: n }, () => SHOP_MIN);
  let rest = len - n * SHOP_MIN;
  while (rest > 1e-9) {
    const free = ws.flatMap((w, i) => (w < SHOP_MAX ? [i] : []));
    if (free.length === 0) { for (let i = 0; i < n; i++) ws[i]! += rest / n; break; }
    const i = rng.pick(free), add = Math.min(1, rest, SHOP_MAX - ws[i]!);
    ws[i]! += add; rest -= add;
  }
  return ws;
}

/** El local de esquina hacia `second`: el último si `second` está al final del eje del frente, el primero al principio, ninguno si es el lado opuesto. */
function cornerLocal(front: Side, second: Side, n: number): number | undefined {
  if (alongX(front) === alongX(second)) return undefined;
  return second === "e" || second === "s" ? n - 1 : 0;
}

export function shopRow(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), front = lot.open[0] ?? "s", second = lot.open[1];
  const ws = shopWidths(rng, frontLen(lot, front));
  const corner = second ? cornerLocal(front, second, ws.length) : undefined;
  let s0 = 0;
  ws.forEach((lw, k) => {
    const r = frontRect(lot, front, s0, s0 + lw, SHOP_BACK); s0 += lw;
    const floors = Math.min(rng.int(2, 3), Math.max(1, Math.floor((cap - HIP_H) / style.floorH))), h = floors * style.floorH;
    const facade: Facade = { floors, cols: Math.max(1, Math.round(lw / 2.5)), base: "glass" };
    addBuilding(p, prism(r.x, r.y, lot.z, r.w, r.d, h, style.mat, { facade, tone: style.tone + rng.int(-1, 1) }), facade);
    const roof = { ...r, z: lot.z + h };
    p.solids.push(...(rng.chance(0.5) ? hipRoof(roof, style.roof) : cornice(roof, style.trim)));
    p.solids.push(...shopAwning(r, front, lw - 1, lot.z));
    if (lot.open.length === 0) return; // sin frente abierto: sur sin neones
    p.slots.push(neonSlot(r, front, lw - 1, lot.z, k));
    if (k === corner) p.slots.push(neonSlot(r, second!, lw - 1, lot.z, k));
  });
  return p;
}

export const LOWRISE: readonly RecipeDef[] = [{ name: "shopRow", recipe: shopRow, family: "lowrise" }];
```

`index.ts`: `[...MODERN, ...COURTYARD, ...LOWRISE]`.

- [ ] **Step 4:** `npx vitest run src/kit src/lab` → PASS; typecheck.
- [ ] **Step 5:** commit `feat(#40): shopRow con slots de neón por local, registro LOWRISE`.

### Task 4: `rowHouses` y `eatenRuin`

**Files:** Modify `src/kit/forms/lowrise.ts`; Test `src/kit/forms/lowrise.test.ts`.

**Interfaces:** Consumes `frontLen`, `frontRect` de Task 3. Produces `rowHouses`, `eatenRuin` en `LOWRISE` (orden: shopRow, rowHouses, eatenRuin).

- [ ] **Step 1: tests** (etapa de evals): `rowHouses` 4..5 casas (sólidos con `facade`, `floors` 2 con `maxH 24`, `cols: 1`, `base: "portico"`), anchos 4..5, sin solape; un `hip` de `style.roof` por casa; `floor(n/2)` conos; sin slots. `eatenRuin`: `ground` con un `ground` `leafDark`; ≥ 6 conos; un prisma `officeDark` 5×4; 2..3 prismas `paving` de `PLINTH_H`; sin ventanas, paredes ni slots.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: implementar**

```ts
const HOUSE_BACK = 5; // jardín trasero

/** Punto a `along` sobre el eje del frente y a `fromBack` del fondo del lote. */
function backPoint(lot: Lot, side: Side, along: number, fromBack: number): Vec2 {
  switch (side) {
    case "s": return { x: lot.x + along, y: lot.y + fromBack };
    case "n": return { x: lot.x + along, y: lot.y + lot.d - fromBack };
    case "e": return { x: lot.x + fromBack, y: lot.y + along };
    case "w": return { x: lot.x + lot.w - fromBack, y: lot.y + along };
  }
}

export function rowHouses(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), front = lot.open[0] ?? "s", len = frontLen(lot, front);
  const n = Math.min(rng.int(4, 5), Math.floor(len / 4));
  const ws = Array.from({ length: n }, () => rng.int(4, 5));
  for (let i = n - 1, sum = ws.reduce((a, b) => a + b, 0); sum > len && i >= 0; i--) if (ws[i] === 5) { ws[i] = 4; sum--; }
  const floors = 2 * style.floorH + HIP_H <= cap ? 2 : 1, h = floors * style.floorH;
  const facade: Facade = { floors, cols: 1, base: "portico" }; // la puerta: planta baja oscura
  let s = (len - ws.reduce((a, b) => a + b, 0)) / 2;
  const starts: number[] = [];
  for (const hw of ws) {
    starts.push(s);
    const r = frontRect(lot, front, s, s + hw, HOUSE_BACK), tone = style.tone + rng.int(-1, 1);
    addBuilding(p, prism(r.x, r.y, lot.z, r.w, r.d, h, style.mat, { facade, tone }), facade);
    p.solids.push(...hipRoof({ ...r, z: lot.z + h }, style.roof).map((q) => (tone ? { ...q, tone } : q)));
    s += hw;
  }
  for (let j = 0; j + 1 < n; j += 2) {
    const c = backPoint(lot, front, (starts[j]! + starts[j + 1]! + ws[j + 1]!) / 2, HOUSE_BACK / 2);
    p.solids.push(...patioTree(v3(c.x, c.y, lot.z)));
  }
  return p;
}

/** La manzana devorada: suelo de selva, losas sueltas, una ruina sin fachada y selva encima. */
export function eatenRuin(lot: Lot, rng: Rng, _style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  p.ground.push(tiles(rng, lot, z + 0.05, "leafDark"));
  p.solids.push(prism(x, y, z, 0.4 * w, 0.4 * d, PLINTH_H, "paving"), prism(x + 0.6 * w, y + 0.55 * d, z, 0.4 * w, 0.45 * d, PLINTH_H, "paving"));
  if (rng.chance(0.5)) p.solids.push(prism(x, y + 0.65 * d, z, 0.3 * w, 0.35 * d, PLINTH_H, "paving"));
  p.solids.push(prism(x + 0.45 * w, y + 1, z + 0.05, 5, 4, rng.int(2, 3), "officeDark")); // ruina, sin pisar ninguna losa
  jungle(p.solids, rng, { x0: x + 4, x1: x + w - 4, y0: y + 4, y1: y + d - 4 }, rng.int(6, 9), z + 0.05); // r ≤ 4: ningún cono sale del lote
  return p;
}
```

Registro: sumar `rowHouses` y `eatenRuin` (`family: "lowrise"`).

- [ ] **Step 4:** `npm test` y `npm run typecheck` → verde.
- [ ] **Step 5:** commit `feat(#40): rowHouses y eatenRuin`.

### Task 5: capturas del lab

**Files:** Create `docs/superpowers/specs/assets/2026-10-15-resume-nivel-2/kit-40-residencial.png`, `kit-40-bares.png`.

- [ ] Dev server `npm run dev -- --host --port 5173`; `agent-browser` a `/lab/kit.html` (o `/map/lab/kit.html` según base), 1600×900; tecla `3` (residencial) → captura; tecla `2` (bares) → captura. Verificar que hay filas `courtyard` y `lowrise` (7 lotes nuevos) y consola sin errores.
- [ ] commit `docs(#40): capturas de lab/kit.html con courtyard y lowrise`.
