# Kit: familias `composite` y `curved` (#41) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al kit nueve recetas en dos familias nuevas, `composite` (podio+torre, gemelas, déco, chaflán, L con torre) y `curved` (torre cilíndrica, rotonda, nave abovedada, galería), registradas en `RECIPES` para que el test genérico y `lab/kit.html` las cubran solos.

**Architecture:** Cada receta es una función pura `(lot, rng, style) => Piece` en `src/kit/forms/composite.ts` o `src/kit/forms/curved.ts`, construida con `emptyPiece`/`addBuilding` (`src/kit/piece.ts`), los techos de `src/kit/roofs.ts` y las props de `src/kit/props.ts`. Antes de las recetas, una task de base: `offsetFootprint` en `roofs.ts`, el cartel sur compartido (`southSign`) y las alturas de props como constantes, `shiftTone` en `piece.ts`, y el oráculo del hueco cóncavo de `kit.test.ts` corregido para no contar como intruso un punto sobre el borde de la huella.

**Tech Stack:** TypeScript estricto, Vitest (`npm test`), `npm run typecheck`.

**Spec:** issue #41 (manda donde difiera) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §5.

## Global Constraints

- `src/iso/` no importa Pixi; ningún test importa Pixi.
- Ningún literal hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts`.
- `Math.random` prohibido: toda aleatoriedad sale del `Rng` recibido.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo.
- Nada de dependencias nuevas. Commits `feat(#41): …` / `test(#41): …` / `docs(#41): …`.
- `npm test` y `npm run typecheck` en verde al final de cada task.
- Contrato de toda receta (`src/kit/kit.test.ts`): sólidos dentro del lote + 0.8; nada bajo `lot.z`; `max.z ≤ lot.z + min(lot.maxH, 18)` (ninguna receta nueva es `landmark`); determinista; ventanas/paredes solo con normal `x > 0` o `y > 0`, de un sólido con fachada; acentos sin `windowWarm`/`windowCool`; ningún sólido en el hueco de un `poly` cóncavo; salida con `lot.z = 0.3` = la de `lot.z = 0` desplazada.
- Toda receta funciona con `w ≥ 16`, `d ≥ 12` y respeta `lot.maxH`: si no entra, baja alturas; nunca excede. Las alturas se topan **contando los remates** (cornisa, tanque, antena, cúpula, chapitel, helipuerto).

## Decisiones de implementación (declaradas)

1. **Oráculo del hueco cóncavo con borde tolerante.** `concaveIntruders` cuenta un punto como intruso si está en el casco y no en la huella; el ray casting da "afuera" para puntos exactamente sobre el borde (p. ej. el vértice reflejo de una L). Un sólido a ras de la cara del hueco (la cornisa de la L, la torre sobre el codo) no está en el hueco. Se agrega `onEdge` y un caso al test del oráculo. El caso existente (cono en el hueco ⇒ intruso) sigue igual.
2. **L con torre: brazo 8, no 7.** La torre 8×8 tiene que apoyar sobre el codo de la L sin entrar al hueco (test del issue y oráculo genérico). Con brazo 7 una torre de 8 sobresale 1 al hueco o 1 al vacío del lado de atrás. Se elige brazo = torre = 8: la torre apoya sobre la cornisa en el codo, a ras de las caras del hueco. Brazos al norte y al oeste: el hueco queda al sureste, hacia la cámara.
3. **Cornisa de la L en dos losas prisma**, una por brazo, que vuelan 0.5 hacia afuera y quedan a ras de las caras del hueco. Un `poly` agrandado con `offsetFootprint` (lo que el issue pide para el chaflán) sería cóncavo y el ala L caería en su hueco: lo prohíbe el oráculo.
4. **Esquina del chaflán.** "Hacia el lado `open[0]`": la esquina de ese lado que toca la otra calle abierta si es contigua (`["s","e"]` ⇒ SE); si no hay, la que mira a la cámara (`n`/`s` ⇒ con `e`; `e`/`w` ⇒ con `s`). Sin `open`, SE.
5. **`h` es la altura total sobre `lot.z` del cuerpo principal**; los remates suman encima y la altura se topa en `min(maxH, 18) − remates`. Excepción: la déco ("el chapitel cuenta") y `podiumTower`/`lTower` ("h total": la torre incluye el podio/ala).
6. **`tone` propio / creciente** = `shiftTone(style.tone, k)` (suma y recorta a −2..+2): torre del podio y galería `+1`, cuerpos de la déco `+0, +1, +2`, torre de la L `+1`.
7. **Gemelas**: torres a lo largo de x, ancho `min(8, (w − 3)/2)` para entrar en `w = 16`; profundidad `min(10, d − 2)`. La antena va en la más alta. Puente de `style.trim`.
8. **Nave abovedada**: los cuerpos laterales (h 3) van al norte y al sur de la nave (al este y oeste solo queda 1); profundidad `min(3, (d − 9)/2)`. Llevan su propia fachada `arcade` de un piso (la arcada de la nave queda tapada por el lateral sur).
9. **Galería**: dos prismas apilados con la misma huella (lote − 1 por lado): planta baja `arcade` de 3 y dos pisos de `min(style.floorH, …)`; los pisos de una `Facade` son iguales, por eso dos sólidos.
10. **`southSign` pasa de `modern.ts` a `piece.ts`** (lo usan `modern` y `podiumTower`); las alturas de remates salen de constantes exportadas (`CORNICE_H` en `roofs.ts`; `WATER_TANK_H`, `MACHINE_ROOM_H`, `ANTENNA_H`, `HELIPAD_H` en `props.ts`), usadas también por las props mismas.
11. **Gemelas: 12..13.6 en vez de 12..16** (revisión de código). 16 + cornisa 0.4 + antena 4 = 20.4 pasa el tope de 18 del contrato; se topa contando la antena. No se usa una antena más corta: la spec §5 pide "una sola medida por rol" para las props.
12. **Déco sobre base cuadrada** (`min(w, d) − 2`): "rectángulo con las cuatro esquinas cortadas" incluye el cuadrado, y el cuerpo concéntrico escalonado se lee como torre déco; sobre la base del lote (21×15) los tres cuerpos serían losas anchas. El tono de los cuerpos es `style.tone − 1, +0, +1` para que crezca estricto con `tone` −1..1.
13. **Nave abovedada con al menos dos pisos** y el lateral norte sin paredes publicadas (revisión de código): con `civico` (`floorH 3.5`) la nave de 5 tenía un solo piso de arcada, sin ventanas y tapado por el lateral sur; la cara sur del lateral norte queda enterrada contra la nave y una luz ahí flotaría.

## Review Focus

1. **Lote mínimo 16×12** (el issue lo exige; el genérico corre 21×15 y 24×18): cada familia tiene un test de contrato sobre `16×12` (Tasks 2, 5).
2. **`style.tone = 2`**: los tonos crecientes no pasan de 2 (Task 2, test de `shiftTone`).
3. **`open` sin `s`/`e`** (`["n"]`, `["w"]`, `[]`): la esquina del chaflán (Task 3).
4. **`maxH` 10**: torres que no llegan a 12 no publican cartel (Task 2) y nada pasa el tope (genérico).
5. **Estilo `civico` (`floorH 3.5`)**: pisos ≥ 1 en cuerpos bajos (genérico, `floor ≥ 0`, `floorH > 0`).

---

### Task 1: Base compartida: `offsetFootprint`, constantes de remates, `southSign`, `shiftTone`, oráculo tolerante

**Files:**
- Modify: `src/kit/roofs.ts`, `src/kit/roofs.test.ts`, `src/kit/props.ts`, `src/kit/piece.ts`, `src/kit/forms/modern.ts`, `src/kit/kit.test.ts`

**Interfaces:**
- Produces: `offsetFootprint(fp: Vec2[], m: number): Vec2[]`; `CORNICE_H = 0.4` (roofs); `WATER_TANK_H = 3.1`, `MACHINE_ROOM_H = 2`, `ANTENNA_H = 4`, `HELIPAD_H = 0.3` (props); `southSign(x, southY, w, z0): Slot`, `shiftTone(t: number, k: number): number` (piece).

- [ ] **Step 1: tests que fallan**

En `src/kit/roofs.test.ts`:

```ts
it("offsetFootprint: agranda la huella m hacia afuera en cualquier sentido de giro", () => {
  const r = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
  const big = [{ x: -0.5, y: -0.5 }, { x: 10.5, y: -0.5 }, { x: 10.5, y: 8.5 }, { x: -0.5, y: 8.5 }];
  const close = (a: Vec2[], b: Vec2[]) => a.forEach((p, i) => { expect(p.x).toBeCloseTo(b[i]!.x, 9); expect(p.y).toBeCloseTo(b[i]!.y, 9); });
  close(offsetFootprint(r, 0.5), big);
  close(offsetFootprint([...r].reverse(), 0.5), [...big].reverse());
  // chaflán a 45°: el lado cortado se corre 0.5 sobre su normal
  const cut = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 6, y: 8 }, { x: 0, y: 8 }];
  const o = offsetFootprint(cut, 0.5), a = o[2]!, b = o[3]!;
  const n = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  expect((a.x - 10) * n.x + (a.y - 4) * n.y).toBeCloseTo(0.5, 9);
  expect((b.x - 6) * n.x + (b.y - 8) * n.y).toBeCloseTo(0.5, 9);
});
```

En `src/kit/kit.test.ts`, dentro de `describe("kit: el oráculo del hueco cóncavo")`:

```ts
it("un sólido a ras de las caras del hueco (sobre el borde de la huella) no es intruso", () => {
  const L: Solid = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }], z: 0, h: 6, mat: "plaster" };
  const slab: Solid = { kind: "prism", at: { x: -0.5, y: -0.5, z: 6 }, w: 11, d: 4.5, h: 0.4, mat: "stone" };
  const tower: Solid = { kind: "prism", at: { x: 0, y: 0, z: 6.4 }, w: 4, d: 4, h: 8, mat: "plaster" };
  expect(concaveIntruders([L, slab, tower])).toBe(0);
});
```

Y un test de `shiftTone` en un nuevo `src/kit/piece.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shiftTone } from "./piece";

describe("piece", () => {
  it("shiftTone suma y recorta a −2..+2", () => {
    expect(shiftTone(0, 1)).toBe(1);
    expect(shiftTone(2, 1)).toBe(2);
    expect(shiftTone(-2, -1)).toBe(-2);
    expect(shiftTone(1, 2)).toBe(2);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/kit` ⇒ FAIL (`offsetFootprint`/`shiftTone` no existen; el oráculo cuenta el vértice reflejo).

- [ ] **Step 3: implementación**

`src/kit/roofs.ts`:

```ts
export const CORNICE_H = 0.4;
export const cornice = (f: Footprint, mat: Material): Solid[] => [prism(f.x - 0.5, f.y - 0.5, f.z, f.w + 1, f.d + 1, CORNICE_H, mat)];

/** Huella corrida `m` hacia afuera (inglete en cada vértice): el vuelo de la cornisa de un `poly`. Conserva el orden de los vértices. */
export function offsetFootprint(fp: Vec2[], m: number): Vec2[] {
  let area = 0;
  for (let i = 0; i < fp.length; i++) { const p = fp[i]!, q = fp[(i + 1) % fp.length]!; area += p.x * q.y - q.x * p.y; }
  const s = area > 0 ? 1 : -1; // en el orden canónico la normal de a→b es (dy, −dx)
  const normal = (a: Vec2, b: Vec2): Vec2 => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (s * (b.y - a.y)) / l, y: (s * (a.x - b.x)) / l }; };
  return fp.map((p, i) => {
    const n1 = normal(fp[(i - 1 + fp.length) % fp.length]!, p), n2 = normal(p, fp[(i + 1) % fp.length]!);
    const k = m / (1 + n1.x * n2.x + n1.y * n2.y);
    return { x: p.x + (n1.x + n2.x) * k, y: p.y + (n1.y + n2.y) * k };
  });
}
```

(importar `type Vec2` de `../iso/geometry`).

`src/kit/props.ts`: `export const WATER_TANK_H = 3.1, MACHINE_ROOM_H = 2, ANTENNA_H = 4, HELIPAD_H = 0.3;` y usarlas en `waterTank` (patas 1.1 + tanque `WATER_TANK_H − 1.1`), `machineRoom`, `antenna`, `helipad`.

`src/kit/piece.ts`: mover `southSign` de `modern.ts` (exportado, mismo cuerpo y comentario) y agregar

```ts
/** Tono desplazado `k` y recortado al rango de `Solid.tone` (−2..+2). */
export const shiftTone = (t: number, k: number): number => Math.max(-2, Math.min(2, t + k));
```

`modern.ts` importa `southSign` de `../piece`.

`src/kit/kit.test.ts`:

```ts
/** Punto sobre algún lado del polígono (a 1e-6): está en la huella, no en el hueco. */
function onEdge(p: Vec2, poly: Vec2[]): boolean {
  return poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length]!, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    return t >= -1e-9 && t <= 1 + 1e-9 && Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / Math.sqrt(l2) < 1e-6;
  });
}
```

y en `concaveIntruders`: `if (inPoly(p, hull) && !inPoly(p, s.footprint) && !onEdge(p, s.footprint)) n++;`

- [ ] **Step 4:** `npm test && npm run typecheck` ⇒ PASS (la salida de `modern` no cambia: el test de determinismo y los de `district` siguen verdes).
- [ ] **Step 5:** commit `feat(#41): offsetFootprint, remates como constantes, southSign compartido y oráculo del hueco con borde`.

### Task 2: `composite.ts`: `podiumTower` y `twinTowers`, registro

**Files:**
- Create: `src/kit/forms/composite.ts`, `src/kit/forms/composite.test.ts`
- Modify: `src/kit/index.ts` (`RECIPES = [...MODERN, ...COMPOSITE]`)

**Interfaces:**
- Consumes: Task 1. Produces: `export const COMPOSITE: readonly RecipeDef[]` (esta task: `podiumTower`, `twinTowers`; Tasks 3–4 agregan `decoStepped`, `chamfer`, `lTower` en ese orden).

- [ ] **Step 1: tests que fallan** (`composite.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { RECIPES, recipe } from "../index";
import { RECIPE_MAX_H } from "../piece";
import { STYLES } from "../styles";
import type { Lot } from "../types";

const LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
const SMALL: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: ["s"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-6;
const withFacade = (ss: Solid[]) => ss.filter((s) => "facade" in s && s.facade);

describe("kit: familia composite", () => {
  it("entra en el lote mínimo 16×12 respetando el contrato", () => {
    for (const def of RECIPES.filter((r) => r.family === "composite")) for (const seed of SEEDS) {
      const p = def.recipe(SMALL, createRng(seed), STYLES.centro);
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(-0.8 - EPS); expect(b.min.y).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(16.8 + EPS); expect(b.max.y).toBeLessThanOrEqual(12.8 + EPS);
        expect(b.max.z).toBeLessThanOrEqual(RECIPE_MAX_H + EPS);
      }
    }
  });

  it("con style.tone 2 ningún sólido pasa de tono 2", () => {
    for (const def of RECIPES.filter((r) => r.family === "composite")) for (const seed of SEEDS)
      for (const s of def.recipe(LOT, createRng(seed), { ...STYLES.centro, tone: 2 }).solids) expect(s.tone ?? 0).toBeLessThanOrEqual(2);
  });

  it("podiumTower: el podio cubre el lote, la torre queda dentro del podio y el cartel sur solo con h ≥ 12", () => {
    for (const seed of SEEDS) {
      const p = recipe("podiumTower")(LOT, createRng(seed), STYLES.centro);
      const [podium, tower] = withFacade(p.solids);
      const pb = bounds(podium!), tb = bounds(tower!);
      expect([pb.min.x, pb.min.y, pb.max.x, pb.max.y].map((v, i) => Math.abs(v - [1.5, 1.5, 22.5, 16.5][i]!) < EPS)).toEqual([true, true, true, true]);
      expect(tb.min.x).toBeGreaterThanOrEqual(pb.min.x + 1 - EPS); expect(tb.min.y).toBeGreaterThanOrEqual(pb.min.y + 1 - EPS);
      expect(tb.max.x).toBeLessThanOrEqual(pb.max.x - 1 + EPS); expect(tb.max.y).toBeLessThanOrEqual(pb.max.y - 1 + EPS);
      expect(tb.min.z).toBeGreaterThanOrEqual(pb.max.z - EPS);
      for (const s of p.slots) expect(s).toMatchObject({ kind: "sign", side: "s" });
    }
    expect(recipe("podiumTower")({ ...LOT, maxH: 10 }, createRng(1), STYLES.centro).slots).toEqual([]);
  });

  it("twinTowers: el puente toca las dos torres, a media altura", () => {
    for (const seed of SEEDS) {
      const p = recipe("twinTowers")(LOT, createRng(seed), STYLES.centro);
      const towers = withFacade(p.solids).map(bounds).sort((a, b) => a.min.x - b.min.x);
      expect(towers).toHaveLength(2);
      expect(Math.abs((towers[0]!.max.z - towers[1]!.max.z))).toBeLessThanOrEqual(1 + EPS);
      const bridge = p.solids.find((s) => s.kind === "prism" && s.h === 2)!;
      const bb = bounds(bridge);
      expect(bb.min.x).toBeCloseTo(towers[0]!.max.x, 9);
      expect(bb.max.x).toBeCloseTo(towers[1]!.min.x, 9);
      expect(bb.max.x - bb.min.x).toBeCloseTo(3, 9);
      expect(bb.max.y - bb.min.y).toBeCloseTo(3, 9);
      expect(bb.min.z).toBeGreaterThan(0);
      expect(bb.max.z).toBeLessThanOrEqual(Math.min(towers[0]!.max.z, towers[1]!.max.z) + EPS);
      expect(p.solids.filter((s) => s.kind === "cylinder" && s.r === 0.2)).toHaveLength(1); // una antena
    }
  });
});
```

- [ ] **Step 2:** `npx vitest run src/kit/forms/composite.test.ts` ⇒ FAIL (recetas desconocidas).

- [ ] **Step 3: implementación** (`composite.ts`)

```ts
import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import { prism } from "../../scenes/city-pieces";
import { RECIPE_MAX_H, addBuilding, emptyPiece, shiftTone, southSign } from "../piece";
import { ANTENNA_H, MACHINE_ROOM_H, WATER_TANK_H, antenna, machineRoom, waterTank } from "../props";
import { CORNICE_H, cornice } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/**
 * Familia `composite` (spec §5, issue #41): cuerpos compuestos. Toda altura
 * se topa en min(lot.maxH, 18) contando los remates.
 */
export const SIGN_MIN_H = 12;
const cap = (lot: Lot): number => Math.min(lot.maxH, RECIPE_MAX_H);
const floors = (h: number, style: Style): number => Math.max(1, Math.round(h / style.floorH));

/** Podio que cubre el lote con vidriera y cornisa; torre descentrada en una esquina, 1 adentro del podio. */
export function podiumTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const ph = rng.int(4, 6);
  const pf: Facade = { floors: floors(ph, style), cols: Math.max(2, Math.round(w / 4)), base: "glass" };
  addBuilding(p, prism(x, y, z, w, d, ph, style.mat, { facade: pf, tone: style.tone }), pf);
  p.solids.push(...cornice({ x, y, w, d, z: z + ph }, style.trim));
  const size = Math.min(rng.int(10, 12), w - 2, d - 2);
  const corner = rng.int(0, 3); // 0 NO, 1 NE, 2 SE, 3 SO
  const tx = corner === 1 || corner === 2 ? x + w - 1 - size : x + 1, ty = corner >= 2 ? y + d - 1 - size : y + 1;
  const tank = rng.chance(0.5);
  const total = Math.min(rng.int(12, 18), cap(lot) - (tank ? WATER_TANK_H : MACHINE_ROOM_H));
  const base = ph + CORNICE_H, th = total - base;
  const tf: Facade = { floors: floors(th, style), cols: rng.int(3, 4) };
  addBuilding(p, prism(tx, ty, z + base, size, size, th, style.mat, { facade: tf, tone: shiftTone(style.tone, 1) }), tf);
  const top = z + total, cx = tx + size / 2, cy = ty + size / 2;
  p.solids.push(...(tank ? waterTank(v3(cx, cy, top)) : machineRoom(v3(cx - 2, cy - 1.5, top))));
  if (total >= SIGN_MIN_H) p.slots.push(southSign(tx, ty + size, size, z + base + th / 2 - 0.8));
  return p;
}

const TWIN_GAP = 3, BRIDGE_W = 3, BRIDGE_H = 2;

/** Dos torres iguales ±1 separadas 3, con un puente a media altura; antena en la más alta. */
export function twinTowers(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const hMax = cap(lot) - CORNICE_H - ANTENNA_H;
  const h1 = Math.min(rng.int(12, 16), hMax), h2 = Math.min(h1 + rng.int(-1, 1), hMax);
  const tw = Math.min(8, (w - TWIN_GAP) / 2), td = Math.min(10, d - 2);
  const x0 = x + (w - 2 * tw - TWIN_GAP) / 2, y0 = y + (d - td) / 2;
  const cols = rng.int(3, 4);
  [h1, h2].forEach((h, i) => {
    const tx = x0 + i * (tw + TWIN_GAP), f: Facade = { floors: floors(h, style), cols };
    addBuilding(p, prism(tx, y0, z, tw, td, h, style.mat, { facade: f, tone: style.tone }), f);
    p.solids.push(...cornice({ x: tx, y: y0, w: tw, d: td, z: z + h }, style.trim));
  });
  const low = Math.min(h1, h2), tall = h1 >= h2 ? 0 : 1, hTall = Math.max(h1, h2);
  p.solids.push(prism(x0 + tw, y0 + (td - BRIDGE_W) / 2, z + low / 2 - BRIDGE_H / 2, TWIN_GAP, BRIDGE_W, BRIDGE_H, style.trim));
  p.solids.push(...antenna(v3(x0 + tall * (tw + TWIN_GAP) + tw / 2, y0 + td / 2, z + hTall + CORNICE_H)));
  return p;
}

export const COMPOSITE: readonly RecipeDef[] = [
  { name: "podiumTower", recipe: podiumTower, family: "composite" },
  { name: "twinTowers", recipe: twinTowers, family: "composite" },
];
```

(importar `type Rng` de `../../map/seed`.) `index.ts`: `import { COMPOSITE } from "./forms/composite";` y `RECIPES = [...MODERN, ...COMPOSITE]`.

- [ ] **Step 4:** `npm test && npm run typecheck` ⇒ PASS (incluye el genérico y `src/lab/kit-scene.test.ts` con la fila nueva).
- [ ] **Step 5:** commit `feat(#41): composite podiumTower y twinTowers`.

### Task 3: `decoStepped` y `chamfer`

**Files:** Modify `src/kit/forms/composite.ts`, `src/kit/forms/composite.test.ts`

**Interfaces:**
- Consumes: Task 1 (`offsetFootprint`, `CORNICE_H`, `MACHINE_ROOM_H`), Task 2 (helpers `cap`, `floors`).
- Produces: `chamferCorner(open: Side[]): "nw" | "ne" | "se" | "sw"`, `cutCorner(x, y, w, d, corner, c): Vec2[]`, `chamferedRect(x, y, w, d, c): Vec2[]`; `COMPOSITE` gana `decoStepped`, `chamfer`.

- [ ] **Step 1: tests que fallan**

```ts
it("decoStepped: tres poly con fachada de 8 vértices, apilados y de tono creciente, más un cono de 4 lados arriba; total ≤ 18", () => {
  for (const seed of SEEDS) {
    const p = recipe("decoStepped")(LOT, createRng(seed), STYLES.centro);
    const polys = p.solids.filter((s) => s.kind === "poly" && s.facade && s.footprint.length === 8);
    expect(polys).toHaveLength(3);
    expect(p.solids.filter((s) => s.kind === "poly")).toHaveLength(3);
    const cones = p.solids.filter((s) => s.kind === "cone");
    expect(cones).toHaveLength(1);
    expect(cones[0]).toMatchObject({ sides: 4, r: 1.5, h: 3 });
    for (let k = 1; k < 3; k++) {
      const a = polys[k - 1]!, b = polys[k]!;
      if (a.kind !== "poly" || b.kind !== "poly") throw new Error("poly");
      expect(b.z).toBeCloseTo(a.z + a.h, 9);
      expect(b.tone ?? 0).toBeGreaterThan(a.tone ?? 0);
    }
    expect(Math.max(...p.solids.map((s) => bounds(s).max.z))).toBeLessThanOrEqual(18 + EPS);
  }
});

it("chamferCorner: la esquina sobre open[0], hacia la otra calle abierta o hacia la cámara; SE sin open", () => {
  expect(chamferCorner(["s", "e"])).toBe("se");
  expect(chamferCorner(["s", "w"])).toBe("sw");
  expect(chamferCorner(["s"])).toBe("se");
  expect(chamferCorner(["n"])).toBe("ne");
  expect(chamferCorner(["e"])).toBe("se");
  expect(chamferCorner(["w", "n"])).toBe("nw");
  expect(chamferCorner([])).toBe("se");
});

it("chamfer: un poly de 5 vértices con fachada cuya esquina cortada mira al lado open, cornisa agrandada 0.5 y sala de máquinas", () => {
  const facing: Record<string, (n: { x: number; y: number }) => boolean> = { s: (n) => n.y > 0, n: (n) => n.y < 0, e: (n) => n.x > 0, w: (n) => n.x < 0 };
  for (const open of [["s"], ["n"], ["e"], ["w"], ["s", "e"]] as Side[][]) for (const seed of SEEDS.slice(0, 5)) {
    const p = recipe("chamfer")({ ...LOT, open }, createRng(seed), STYLES.centro);
    const body = p.solids.find((s) => s.kind === "poly" && s.facade);
    if (!body || body.kind !== "poly") throw new Error("sin cuerpo");
    expect(body.footprint).toHaveLength(5);
    // el lado cortado es el único que no es paralelo a un eje
    const i = body.footprint.findIndex((a, k) => { const b = body.footprint[(k + 1) % 5]!; return a.x !== b.x && a.y !== b.y; });
    const a = body.footprint[i]!, b = body.footprint[(i + 1) % 5]!;
    const n = { x: b.y - a.y, y: a.x - b.x }; // normal hacia afuera en el orden canónico
    expect(facing[open[0]!]!(n)).toBe(true);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(4 * Math.SQRT2, 9);
    const top = p.solids.find((s) => s.kind === "poly" && !s.facade);
    expect(top).toMatchObject({ h: 0.4, mat: STYLES.centro.trim, z: body.z + body.h });
    expect(p.solids.some((s) => s.kind === "prism" && s.w === 4 && s.d === 3 && s.h === 2)).toBe(true);
  }
});
```

(importar `chamferCorner` de `./composite` y `type Side` de `../types`.)

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementación**

```ts
const CHAMFER = 1.5, TIER_INSET = 1.5, SPIRE_H = 3, SPIRE_R = 1.5;

/** Rectángulo con las cuatro esquinas cortadas `c`, en el orden canónico (desde el norte, horario en pantalla). */
export const chamferedRect = (x: number, y: number, w: number, d: number, c: number): Vec2[] => [
  { x: x + c, y }, { x: x + w - c, y }, { x: x + w, y: y + c }, { x: x + w, y: y + d - c },
  { x: x + w - c, y: y + d }, { x: x + c, y: y + d }, { x, y: y + d - c }, { x, y: y + c },
];

/** Déco escalonada: tres cuerpos concéntricos con chaflán (0.5, 0.3 y 0.2 de la altura sin el chapitel), tono creciente, chapitel de cuatro caras. */
export function decoStepped(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const body = Math.min(rng.int(12, 18), cap(lot)) - SPIRE_H, s0 = Math.min(w, d) - 2;
  let zt = z;
  [0.5, 0.3, 0.2].forEach((share, k) => {
    const th = body * share, s = s0 - 2 * TIER_INSET * k, f: Facade = { floors: floors(th, style), cols: 2 };
    addBuilding(p, { kind: "poly", footprint: chamferedRect(x + (w - s) / 2, y + (d - s) / 2, s, s, CHAMFER), z: zt, h: th, mat: style.mat, facade: f, tone: shiftTone(style.tone, k) }, f);
    zt += th;
  });
  p.solids.push({ kind: "cone", at: v3(x + w / 2, y + d / 2, zt), r: SPIRE_R, h: SPIRE_H, mat: style.roof, sides: 4 });
  return p;
}

type Corner = "nw" | "ne" | "se" | "sw";

/** Esquina del chaflán: la de `open[0]` que toca otra calle abierta contigua; si no hay, la que mira a la cámara (este o sur). SE sin `open`. */
export function chamferCorner(open: Side[]): Corner {
  const a = open[0];
  if (!a) return "se";
  if (a === "n" || a === "s") return a === "n" ? (open.includes("w") ? "nw" : "ne") : (open.includes("w") ? "sw" : "se");
  return a === "e" ? (open.includes("n") ? "ne" : "se") : (open.includes("n") ? "nw" : "sw");
}

/** Rectángulo en orden canónico con la esquina `corner` cortada `c` (cinco vértices). */
export function cutCorner(x: number, y: number, w: number, d: number, corner: Corner, c: number): Vec2[] {
  const full: Record<Corner, Vec2[]> = { nw: [{ x, y }], ne: [{ x: x + w, y }], se: [{ x: x + w, y: y + d }], sw: [{ x, y: y + d }] };
  const cut: Record<Corner, Vec2[]> = {
    nw: [{ x, y: y + c }, { x: x + c, y }], ne: [{ x: x + w - c, y }, { x: x + w, y: y + c }],
    se: [{ x: x + w, y: y + d - c }, { x: x + w - c, y: y + d }], sw: [{ x: x + c, y: y + d }, { x, y: y + d - c }],
  };
  return (["nw", "ne", "se", "sw"] as const).flatMap((k) => (k === corner ? cut[k] : full[k]));
}

const CHAMFER_CUT = 4;

/** Chaflán: una esquina cortada 4 hacia la calle, fachada en todas las paredes, cornisa agrandada 0.5 y sala de máquinas. */
export function chamfer(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(8, 14), cap(lot) - CORNICE_H - MACHINE_ROOM_H);
  const bx = x + 1, by = y + 1, bw = w - 2, bd = d - 2;
  const fp = cutCorner(bx, by, bw, bd, chamferCorner(lot.open), CHAMFER_CUT);
  const f: Facade = { floors: floors(h, style), cols: 3 };
  addBuilding(p, { kind: "poly", footprint: fp, z, h, mat: style.mat, facade: f, tone: style.tone }, f);
  p.solids.push({ kind: "poly", footprint: offsetFootprint(fp, 0.5), z: z + h, h: CORNICE_H, mat: style.trim });
  p.solids.push(...machineRoom(v3(bx + bw / 2 - 2, by + bd / 2 - 1.5, z + h + CORNICE_H)));
  return p;
}
```

Registrar `decoStepped` y `chamfer` después de `twinTowers` en `COMPOSITE`. Imports: `type Vec2` de `../../iso/geometry`, `offsetFootprint` de `../roofs`, `type Side` de `../types`.

- [ ] **Step 4:** `npm test && npm run typecheck` ⇒ PASS.
- [ ] **Step 5:** commit `feat(#41): composite decoStepped y chamfer`.

### Task 4: `lTower`

**Files:** Modify `src/kit/forms/composite.ts`, `src/kit/forms/composite.test.ts`

**Interfaces:** Produces `lFootprint(x, y, w, d, arm): Vec2[]`; `COMPOSITE` gana `lTower` (último).

- [ ] **Step 1: test que falla**

```ts
it("lTower: ala L de 6 vértices con fachada, torre sobre el codo con baliza, y el hueco de la L vacío", () => {
  for (const lot of [LOT, SMALL]) for (const seed of SEEDS) {
    const p = recipe("lTower")(lot, createRng(seed), STYLES.centro);
    const wing = p.solids.find((s) => s.kind === "poly");
    if (!wing || wing.kind !== "poly") throw new Error("sin ala");
    expect(wing.footprint).toHaveLength(6);
    expect(wing.facade).toBeDefined();
    const hole = { x0: lot.x + 8, y0: lot.y + 8, x1: lot.x + lot.w, y1: lot.y + lot.d };
    for (const s of p.solids) {
      if (s === wing) continue;
      const b = bounds(s);
      const inside = b.max.x > hole.x0 + EPS && b.min.x < hole.x1 - EPS && b.max.y > hole.y0 + EPS && b.min.y < hole.y1 - EPS;
      expect(inside).toBe(false);
    }
    const tower = p.solids.find((s) => s.kind === "prism" && s.facade);
    if (!tower || tower.kind !== "prism") throw new Error("sin torre");
    expect(tower).toMatchObject({ w: 8, d: 8, at: { x: lot.x, y: lot.y } });
    expect(tower.at.z).toBeCloseTo(wing.z + wing.h + 0.4, 9);
    expect(p.accents.some((a) => a.kind === "dot" && a.color === "amberMid")).toBe(true);
  }
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementación**

```ts
const L_ARM = 8;

/** L de seis vértices en orden canónico, brazos de ancho `arm` al norte y al oeste: el hueco queda al sureste, hacia la cámara. */
export const lFootprint = (x: number, y: number, w: number, d: number, arm: number): Vec2[] => [
  { x, y }, { x: x + w, y }, { x: x + w, y: y + arm }, { x: x + arm, y: y + arm }, { x: x + arm, y: y + d }, { x, y: y + d },
];

/**
 * L con torre: ala baja en L con fachada y cornisa; torre de L_ARM × L_ARM
 * apoyada sobre el codo, a ras de las caras del hueco. El hueco queda vacío
 * (regla de profundidad); por eso la cornisa son dos losas, una por brazo, y
 * no un poly agrandado, que sería cóncavo y tendría al ala en su hueco.
 */
export function lTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const wh = rng.int(5, 7), wf: Facade = { floors: floors(wh, style), cols: 3 };
  addBuilding(p, { kind: "poly", footprint: lFootprint(x, y, w, d, L_ARM), z, h: wh, mat: style.mat, facade: wf, tone: style.tone }, wf);
  const top = z + wh;
  p.solids.push(prism(x - 0.5, y - 0.5, top, w + 1, L_ARM + 0.5, CORNICE_H, style.trim), prism(x - 0.5, y + L_ARM, top, L_ARM + 0.5, d - L_ARM + 0.5, CORNICE_H, style.trim));
  const total = Math.min(rng.int(12, 16), cap(lot)), th = total - wh - CORNICE_H;
  const tf: Facade = { floors: floors(th, style), cols: 3 };
  addBuilding(p, prism(x, y, top + CORNICE_H, L_ARM, L_ARM, th, style.mat, { facade: tf, tone: shiftTone(style.tone, 1) }), tf);
  p.accents.push(...beacon(v3(x + L_ARM / 2, y + L_ARM / 2, z + total)).accents);
  return p;
}
```

Registrar `lTower` al final de `COMPOSITE`; importar `beacon`.

- [ ] **Step 4:** `npm test && npm run typecheck` ⇒ PASS (el genérico con el oráculo tolerante de Task 1 debe dar 0 intrusos).
- [ ] **Step 5:** commit `feat(#41): composite lTower`.

### Task 5: `curved.ts`: `cylinderTower` y `rotunda`, registro

**Files:**
- Create: `src/kit/forms/curved.ts`, `src/kit/forms/curved.test.ts`
- Modify: `src/kit/index.ts` (`RECIPES = [...MODERN, ...COMPOSITE, ...CURVED]`)

**Interfaces:** Produces `export const CURVED: readonly RecipeDef[]` (esta task: `cylinderTower`, `rotunda`; Task 6 agrega `vaultedHall`, `gallery`).

- [ ] **Step 1: tests que fallan** (`curved.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { bounds } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { RECIPES, recipe } from "../index";
import { RECIPE_MAX_H } from "../piece";
import { STYLES } from "../styles";
import type { Lot } from "../types";

const LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
const SMALL: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: ["s"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-6;

describe("kit: familia curved", () => {
  it("entra en el lote mínimo 16×12 respetando el contrato", () => {
    for (const def of RECIPES.filter((r) => r.family === "curved")) for (const seed of SEEDS) {
      for (const s of def.recipe(SMALL, createRng(seed), STYLES.civico).solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(-0.8 - EPS); expect(b.min.y).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(16.8 + EPS); expect(b.max.y).toBeLessThanOrEqual(12.8 + EPS);
        expect(b.max.z).toBeLessThanOrEqual(RECIPE_MAX_H + EPS);
      }
    }
  });

  it("cylinderTower: un cylinder de 16 lados con fachada de vidriera, losa de remate y helipuerto", () => {
    for (const seed of SEEDS) {
      const p = recipe("cylinderTower")(LOT, createRng(seed), STYLES.centro);
      const body = p.solids.filter((s) => s.kind === "cylinder" && s.facade);
      expect(body).toHaveLength(1);
      const c = body[0]!;
      if (c.kind !== "cylinder") throw new Error("cylinder");
      expect(c.sides).toBe(16);
      expect(c.facade).toMatchObject({ cols: 1, base: "glass" });
      expect(p.solids.some((s) => s.kind === "cylinder" && s.r === c.r + 0.4 && s.at.z === c.at.z + c.h && s.mat === STYLES.centro.trim)).toBe(true);
      expect(p.windows.length).toBeGreaterThan(0);
    }
  });

  it("rotunda: dome de 12 lados sobre el cilindro con arcada y linterna arriba", () => {
    for (const seed of SEEDS) {
      const p = recipe("rotunda")(LOT, createRng(seed), STYLES.civico);
      const cyl = p.solids.find((s) => s.kind === "cylinder" && s.facade), dome = p.solids.find((s) => s.kind === "dome");
      if (cyl?.kind !== "cylinder" || dome?.kind !== "dome") throw new Error("falta cilindro o cúpula");
      expect(cyl).toMatchObject({ sides: 12, r: 6, facade: { base: "arcade" } });
      expect(dome.at.z).toBe(cyl.at.z + cyl.h);
      expect(dome).toMatchObject({ r: 6, h: 3.5, sides: 12, rings: 3, mat: STYLES.civico.roof });
      expect(p.solids.some((s) => s.kind === "cylinder" && s.r === 1 && s.h === 1.2 && s.at.z === dome.at.z + dome.h)).toBe(true);
    }
  });
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementación** (`curved.ts`)

```ts
import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Rng } from "../../map/seed";
import { RECIPE_MAX_H, addBuilding, emptyPiece } from "../piece";
import { HELIPAD_H, helipad, place } from "../props";
import { CORNICE_H, domeRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/** Familia `curved` (spec §5, issue #41): cilindros, cúpulas y bóvedas. Alturas topadas en min(lot.maxH, 18) contando los remates. */
const cap = (lot: Lot): number => Math.min(lot.maxH, RECIPE_MAX_H);
const floors = (h: number, style: Style): number => Math.max(1, Math.round(h / style.floorH));

/** Torre cilíndrica de 16 lados con vidriera, losa de remate de `trim` (vuela 0.4) y helipuerto. */
export function cylinderTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const r = Math.min(rng.int(6, 7), Math.min(w, d) / 2);
  const h = Math.min(rng.int(12, 18), cap(lot) - CORNICE_H - HELIPAD_H);
  const cx = x + w / 2, cy = y + d / 2, f: Facade = { floors: floors(h, style), cols: 1, base: "glass" };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r, h, mat: style.mat, sides: 16, facade: f, tone: style.tone }, f);
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + h), r: r + 0.4, h: CORNICE_H, mat: style.trim, sides: 16 });
  place(p.solids, p.accents, helipad(v3(cx, cy, z + h + CORNICE_H)));
  return p;
}

const ROTUNDA_R = 6, DOME_H = 3.5, LANTERN_R = 1, LANTERN_H = 1.2;

/** Rotonda: tambor de 12 lados con arcada, cúpula de `roof` y linterna. */
export function rotunda(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(6, 8), cap(lot) - DOME_H - LANTERN_H);
  const cx = x + w / 2, cy = y + d / 2, f: Facade = { floors: floors(h, style), cols: 1, base: "arcade" };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r: ROTUNDA_R, h, mat: style.mat, sides: 12, facade: f, tone: style.tone }, f);
  p.solids.push(...domeRoof({ x: cx - ROTUNDA_R, y: cy - ROTUNDA_R, w: 2 * ROTUNDA_R, d: 2 * ROTUNDA_R, z: z + h }, DOME_H, style.roof));
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + h + DOME_H), r: LANTERN_R, h: LANTERN_H, mat: style.trim, sides: 8 });
  return p;
}

export const CURVED: readonly RecipeDef[] = [
  { name: "cylinderTower", recipe: cylinderTower, family: "curved" },
  { name: "rotunda", recipe: rotunda, family: "curved" },
];
```

- [ ] **Step 4:** `npm test && npm run typecheck` ⇒ PASS.
- [ ] **Step 5:** commit `feat(#41): curved cylinderTower y rotunda`.

### Task 6: `vaultedHall` y `gallery`

**Files:** Modify `src/kit/forms/curved.ts`, `src/kit/forms/curved.test.ts`

**Interfaces:** `CURVED` gana `vaultedHall`, `gallery` (en ese orden).

- [ ] **Step 1: tests que fallan**

```ts
it("vaultedHall: vault a lo largo de x sobre el techo de la nave con arcada, y dos laterales bajos de 3", () => {
  for (const lot of [LOT, SMALL]) for (const seed of SEEDS) {
    const p = recipe("vaultedHall")(lot, createRng(seed), STYLES.civico);
    const nave = p.solids.find((s) => s.kind === "prism" && s.d === 9 && s.facade);
    const vault = p.solids.find((s) => s.kind === "vault");
    if (nave?.kind !== "prism" || vault?.kind !== "vault") throw new Error("falta nave o bóveda");
    expect(nave.facade).toMatchObject({ base: "arcade" });
    expect(vault.at.z).toBe(nave.at.z + nave.h);
    expect(vault).toMatchObject({ axis: "x", len: lot.w - 2, w: 9, h: 3, segments: 6, mat: STYLES.civico.roof, at: { x: nave.at.x, y: nave.at.y } });
    expect(p.solids.filter((s) => s.kind === "prism" && s.h === 3)).toHaveLength(2);
  }
});

it("gallery: planta baja con arcada de 3 en el frente, dos pisos con ventanas encima y techo hip de roof, tono propio", () => {
  for (const seed of SEEDS) {
    const p = recipe("gallery")(LOT, createRng(seed), STYLES.civico);
    const [ground, upper] = p.solids.filter((s) => s.kind === "prism" && s.facade);
    if (ground?.kind !== "prism" || upper?.kind !== "prism") throw new Error("faltan cuerpos");
    expect(ground).toMatchObject({ h: 3, facade: { base: "arcade" }, tone: 1 });
    expect(upper.facade).toMatchObject({ floors: 2 });
    expect(upper.facade!.cols).toBeGreaterThanOrEqual(4); expect(upper.facade!.cols).toBeLessThanOrEqual(5);
    expect(upper.at.z).toBe(ground.at.z + 3);
    expect(p.walls.some((w) => w.normal.y > 0.99 && w.building === p.solids.indexOf(ground))).toBe(true); // frente sur con arcada
    expect(p.solids.some((s) => s.kind === "prism" && s.roof === "hip" && s.mat === STYLES.civico.roof && s.at.z === upper.at.z + upper.h)).toBe(true);
    expect(p.windows.every((w) => w.building === p.solids.indexOf(upper))).toBe(true);
  }
});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementación**

```ts
const NAVE_D = 9, NAVE_H = 5, VAULT_H = 3, AISLE_H = 3;

/** Nave abovedada a lo largo del lado largo, con arcada, y dos naves laterales bajas al norte y al sur (cada una con su arcada: la de la nave queda detrás). */
export function vaultedHall(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const bx = x + 1, len = w - 2, by = y + (d - NAVE_D) / 2, nh = Math.min(NAVE_H, cap(lot) - VAULT_H);
  const f: Facade = { floors: floors(nh, style), cols: Math.max(2, Math.round(len / 3)), base: "arcade" };
  addBuilding(p, prism(bx, by, z, len, NAVE_D, nh, style.mat, { facade: f, tone: style.tone }), f);
  p.solids.push({ kind: "vault", at: v3(bx, by, z + nh), len, w: NAVE_D, h: VAULT_H, axis: "x", mat: style.roof, segments: 6 });
  const ad = Math.min(3, (d - NAVE_D) / 2), af: Facade = { floors: 1, cols: f.cols, base: "arcade" };
  for (const ay of [by - ad, by + NAVE_D]) addBuilding(p, prism(bx, ay, z, len, ad, AISLE_H, style.mat, { facade: af, tone: style.tone }), af);
  return p;
}

const ARCADE_H = 3, HIP_H = 1.5 * (1 + GABLE_RATIO);

/** Galería: planta baja con arcada de 3 y dos pisos encima (dos sólidos: los pisos de una fachada son iguales), techo a cuatro aguas. */
export function gallery(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const bx = x + 1, by = y + 1, bw = w - 2, bd = d - 2, tone = shiftTone(style.tone, 1);
  const fh = Math.min(style.floorH, (cap(lot) - ARCADE_H - HIP_H) / 2);
  const gf: Facade = { floors: 1, cols: Math.max(2, Math.round(bw / 3)), base: "arcade" };
  addBuilding(p, prism(bx, by, z, bw, bd, ARCADE_H, style.mat, { facade: gf, tone }), gf);
  const uf: Facade = { floors: 2, cols: rng.int(4, 5) };
  addBuilding(p, prism(bx, by, z + ARCADE_H, bw, bd, 2 * fh, style.mat, { facade: uf, tone }), uf);
  p.solids.push(...hipRoof({ x: bx, y: by, w: bw, d: bd, z: z + ARCADE_H + 2 * fh }, style.roof));
  return p;
}
```

Imports nuevos: `GABLE_RATIO` de `../../iso/solids`, `prism` de `../../scenes/city-pieces`, `shiftTone` de `../piece`, `hipRoof` de `../roofs`. Registrar en `CURVED`.

Nota: el test del galería asume `STYLES.civico.tone === 0` ⇒ `tone: 1`.

- [ ] **Step 4:** `npm test && npm run typecheck` ⇒ PASS.
- [ ] **Step 5:** commit `feat(#41): curved vaultedHall y gallery`.

### Verificación visual (al cierre, no es task de subagente)

`npm run dev -- --host --port 5173`, abrir `http://localhost:5173/map/lab/kit.html`: dos filas nuevas (`composite` con 5 lotes, `curved` con 4). Capturas a 1600×900 con estilo `centro` (tecla 1) y `civico` (tecla 4), adjuntas al PR.

## Assumptions

Decididas como técnicas en la revisión del plan (sin fuente escrita; cualquier opción razonable cumple el issue):

- **Brazo de la L = 8 (issue: 7).** El issue pide a la vez "torre 8×8 en la esquina interior de la L" y "El hueco de la L queda **vacío**", y el contrato genérico prohíbe todo sólido en el hueco de un `poly` cóncavo. Con brazo 7 la torre de 8 entra 1 al hueco (falla el test del issue) o sobresale 1 al vacío por detrás (una lonja flotante visible en la cara sur). Descartadas: torre 7×7 (cambia la medida del elemento dominante) y brazo 9 con retranqueo (más lejos del issue).
- **Cornisa de la L en dos losas** en lugar de un `poly` agrandado: el issue manda `offsetFootprint` solo para la cornisa del **chaflán** ("el vuelo de la cornisa de un poly se hace con un poly igual agrandado 0.5"), que es convexo y lo usa. En la L un poly agrandado es cóncavo y el ala cae en su hueco. Descartada: L sin cornisa (el issue la pide).
- **Oráculo tolerante al borde.** El ray casting de `inPoly` da "afuera" en el vértice reflejo; sin la corrección, ningún sólido puede quedar a ras de las caras del hueco. Es una corrección del oráculo (un punto del borde pertenece a la huella), no del contrato; el caso "cono dentro del hueco ⇒ intruso" queda igual. Descartado: un épsilon mágico en la receta (cornisa 0.001 más corta).
- **Torre del podio muy baja con `maxH 10`** (p. ej. 0.5 de cuerpo con podio 6 y tanque): se acepta; `maxH 10` es una guarda que hoy ninguna manzana pide (`src/scenes/district.ts:18-30`). Descartado: bajar también el podio (consume rng distinto según el tope).
- **Regla de la esquina del chaflán** (Decisión 4): el issue dice "hacia el lado `open[0]` (si no hay, la esquina SE)"; un lado tiene dos esquinas y la elección de la que mira a la otra calle abierta, o a la cámara, es técnica. Las caras visibles son las de normal `x > 0` o `y > 0` (`src/kit/piece.ts` `addBuilding`).
- **Granularidad de reversión**: un commit por task, cada uno verde; las exportaciones nuevas de Task 1 sin uso solo existen entre commits de este mismo PR.

## Grilling

Rounds: 1 (the plan did not change its seams; only `## Assumptions` was added). Questions: 18.

| # | Answer |
|---|---|
| 1 | ISSUE: "si algo acá contradice la spec, acá se anota como decisión de implementación" + "El hueco de la L queda **vacío** (regla de profundidad)" + "torre 8×8 en la esquina interior de la L". The issue's own numbers conflict with its own emptiness rule ⇒ NO SOURCE for the resolution ⇒ technical assumption (see Assumptions). No acceptance criterion is lost: the criteria are "nueve recetas registradas", the lab rows/captures, and green tests. |
| 2 | ISSUE criteria: "Nueve recetas registradas; `lab/kit.html` muestra dos filas nuevas (captura con estilo `centro` y otra con `civico`)" and "Tests nuevos y el genérico en verde". Registration: Tasks 2–6. Rows: CODE `src/lab/kit-scene.ts:20-33` builds one row per family from `RECIPES`, pinned by `src/lab/kit-scene.test.ts:7-15`. Captures: manual verification (stage 4 browser run, listed in PR). |
| 3 | CODE `src/kit/piece.ts:5` — `RECIPE_MAX_H = 18`. |
| 4 | CODE `src/kit/types.ts:25` — `family: "modern" \| "courtyard" \| "composite" \| "curved" \| "lowrise" \| "landmarks"`. Rows: `src/lab/kit-scene.ts:21-24` (`families = [...new Set(RECIPES.map(r => r.family))]`). |
| 5 | CODE `src/kit/kit.test.ts:33-49` — 5×5 grid over each other solid's AABB (i, j = 0..4). For `lTower` the cornice slabs' and tower's grid points with `y = arm` (x > arm) or `x = arm` (y > arm) lie on the hole faces; the slabs' outer overhang points lie outside the hull. Handled by `onEdge` (Task 1). |
| 6 | CODE `src/kit/piece.ts:10-19` — `addBuilding` uses `visibleWalls` and skips `normal.x <= 1e-9 && normal.y <= 1e-9`; CODE `src/iso/solids.ts:305` cylinder → `extrude` + `withFacade`; `extrude` normals are `normalize(...)` (`solids.ts:57-60`), unit length. |
| 7 | CODE `src/iso/facade.ts:62-67` — `windowPatches` returns `[]` for floor 0 with `portico`/`arcade`; `facadeWindows` starts at floor 1 when `base` is set (`facade.ts:73-78`). Floor height is `wall height / floors` (`facade.ts:56`), so `floors·floorH` never exceeds `h`; column width is a fraction of the wall (`facade.ts:69-72`), any wall width works. |
| 8 | Generic CODE `src/kit/kit.test.ts:103-108` runs every registered recipe with `maxH: 10`. Tiny tower: technical assumption (see Assumptions). |
| 9 | CODE `src/map/seed.ts:19` — `int: (min, max) => min + Math.floor(next() * (max - min + 1))`, inclusive both ends, works with negative `min`. |
| 10 | CODE `src/scenes/city-pieces.ts:1-6,19-25` — imports only `iso`, `map`, `city-grid` (no Pixi); `prism(x, y, z, w, d, h, mat, extra)`. CODE `src/kit/roofs.ts` `hipRoof` = prism h 1.5 `roof: "hip"`; ridge `eave + h·GABLE_RATIO` at `src/iso/solids.ts:95-97` ⇒ `HIP_H = 1.5·(1 + GABLE_RATIO)` uses the same exported constant. |
| 11 | CODE `src/kit/roofs.ts` `domeRoof` → `{ kind: "dome", r: min(w,d)/2, h, sides: 12, rings: 3 }`; `src/kit/props.ts` `antenna` r 0.2 h 4, `beacon` dot `amberMid`, `helipad` returns `Lit`, `place(solids, accents, lit)` is exported. |
| 12 | CODE `src/kit/types.ts:15` — `Lot { x, y, w, d, z, open: Side[], maxH }`. CODE `src/kit/kit.test.ts:11-16` — lots with `maxH: 24`, styles `centro, bares, residencial, civico`; `maxH: 10` variant at `:103`. |
| 13 | CODE `src/scenes/district.ts:18,26-30` — `FRONT_CAP_H = 10`, the lowest cap; tests of `vaultedHall` use `maxH 24`, so `nh = 5`. |
| 14 | CODE `src/iso/solids.ts:10-21` — all those fields exist; `bounds()` (`:336-343`) iterates `tessellateAll`, which includes `vault` (`:236-250`, `axis` handled in `P`). |
| 15 | CODE `src/scenes/district.test.ts` and `src/kit/kit.test.ts` "familia modern" tests pin sign geometry (`toMatchObject` on `kind/side/local/wall`, 4 coplanar points); `southSign` is moved verbatim (pure move), so output is identical by construction. |
| 16 | CODE `src/kit/piece.ts:10` — camera-facing walls are `normal.x > 0` or `normal.y > 0` (also spec §5: "normal con componente `+x` o `+y`"). Tie-break: technical assumption. |
| 17 | NO SOURCE ⇒ technical assumption: one commit per task, all in one PR. |
| 18 | CODE `src/lab/kit.ts:13` — `KEY_STYLE = { "1": "centro", …, "4": "civico" }`; rows have any length (`kit-scene.ts:22` places by index in family). |

Per source: ISSUE 2, CODE 16, DOC 0, NO SOURCE 4 (all technical assumptions; 0 spec ambiguities; 0 out of scope). Issues opened: none.
