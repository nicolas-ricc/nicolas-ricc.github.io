# Piezas fijas I: puente de la avenida y derrumbe (#47) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `bridge` y `collapsed` de `src/city/fixed.ts` sobre el kit: puente con tres arcos de piedra escalonados, pilas con tajamar, balaustrada y cuatro obeliscos con luz; derrumbe con un fragmento de cúpula caído en el agua. Mismas huellas que hoy.

**Architecture:** El arco escalonado del puente peatonal (`src/kit/forms/landmarks.ts` `footbridge`) se extrae a `stoneArch` en `src/kit/props.ts`, con el perfil del borde inferior como parámetro; `footbridge` y `bridge` lo usan. `bridge` cambia los pilotes `plaza` por pilas `poly` con tajamar, las barandas `officeDark` por balaustrada `stone` y los dos faroles por cuatro obeliscos con `dot` ámbar. `collapsed` suma un `dome` `officeDark` en el agua. Tablero, rampas, estribo y autos no cambian.

**Tech Stack:** TypeScript estricto, Vitest, sin Pixi en tests.

**Spec:** issue #47 (manda) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §8.

## Global Constraints

- `src/iso/` no importa Pixi; todo color sale de `src/map/palette-iso.ts` (sin literales hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts`).
- `Math.random` prohibido: toda aleatoriedad sale del `Rng` recibido. `collapsed` consume el `rng` igual que hoy (una sola llamada `rng.int(2, 3)`), así el resto de la escena no se desalinea.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo; sin dependencias nuevas.
- `src/scenes/city-grid.ts` no cambia (`BRIDGE`, `STREET`, `WEST_QUAY`, `COLLAPSED`, `FALLEN_BLOCK`, `estuaryEast`).
- Ninguna pieza del puente sale de `BRIDGE.x0 − STREET .. BRIDGE.x1 + STREET` (186..282) × `BRIDGE.y0 − 1 .. BRIDGE.y1 + 1` (206..218).
- `npm test` y `npm run typecheck` en verde al final de cada tarea.

## Decisiones técnicas (supuestos declarados)

1. **Pilas.** "cuatro pilas `stone` en `x = 192 + 21·k` para `k = 1..3` más … una pila en `x = 274`" se lee como cuatro pilas centradas en `x = 213, 234, 255, 274`; el estribo oeste (prisma `plaza` de hoy) es el otro apoyo y queda igual. Los tres arcos van entre pilas consecutivas: vanos `214..233`, `235..254`, `256..273` (18 losas). El tramo estribo → primera pila (`198..212`) queda sin arco, con el tablero encima como hoy.
2. **Perfil del arco.** Se sigue la fórmula del issue al pie de la letra: borde inferior `z = BRIDGE.z − r·sin(π·(k + 0.5)/6)` con `r = min(vano/2, BRIDGE.z + 1)` = 2.2, y su test ("las losas centrales de cada vano bajan más que las de los extremos"). Es el perfil inverso del puente peatonal (cuyas losas centrales son las más cortas), así que `stoneArch` recibe el perfil del borde inferior como función: `footbridge` pasa `s => z + rise·s` y `bridge` pasa `s => BRIDGE.z − r·s`. La construcción compartida es la de las seis losas (ancho `vano/6`, fondo `d − 0.4`, centradas en y, tope en el tablero).
3. **Firma de `stoneArch`.** `stoneArch(x, y, w, d, zTop, bottom)`, con ancho en lugar de `x1` (como el resto de las props: esquina NO + medidas); así el `footbridge` reproduce exacto sus losas de hoy.
4. **Balaustrada.** Postes de punta a punta entre obeliscos (de `x0 + 1.2` a `x1 − 1.2`), cada 3 o menos como en el puente peatonal: 29 por borde, 58 en total. Pasamanos centrado sobre los postes, `z = tope + 0.9`, a lo largo del mismo tramo.
5. **Obeliscos.** En las cuatro esquinas del tablero, dentro de él (esquina NO en `x0`/`x1 − 1.2`, `y0`/`y1 − 1.2`); el remate es un `cone` `stone` de 4 lados r 0.6 h 1 centrado; la luz es un `dot` `amber` r 0.6 a `z = tope + 4 + 1 + 0.3`. No se usa `props.lamp` (el issue lo descarta: un farol de 5 sobre un obelisco de 4 es demasiado).
6. **Cúpula del derrumbe.** El `at` del issue, `(COLLAPSED.x − 9, COLLAPSED.y + 12)` = `(271, 254)`, cae dentro de la losa hundida grande (`266..274 × 250..256`) y viola la condición del mismo issue "sin tocar los tres bloques hundidos". Se mueve al lugar libre más cercano que cumple las tres condiciones (en agua, al oeste del labio de la rampa en `x = 274`, sin solaparse con los bloques): `at = (COLLAPSED.x − 9.5, COLLAPSED.y + 17.5, −0.9)` = `(270.5, 259.5, −0.9)`; caja con `r` = `267.5..273.5 × 256.5..262.5`, al sur de la losa grande y al este del cascote `264..267 × 258..262`. `estuaryEast(256.5) ≈ 279.7 > 273.5`.
7. `tone: −1` en la cúpula (campo `tone` de `Solid`).

## Review Focus

- El orden de pintado (`sortByDepth`, `src/iso/depth.ts`, por caja AABB): los obeliscos y los postes se apoyan sobre el tablero; pilas y losas viven debajo, dentro de `y0 − 1 .. y1 + 1`. El test de contención solo cubre x/y; el orden real se verifica en la captura de `lab/resume.html` (guion de la etapa 3).
- Las luces de los obeliscos tienen que seguir pasando el test de faroles de `city.test.ts` (`onAvenue`: `AVENUE.y0 − 3 .. AVENUE.y1 + 3` = 203..221; los `dot` quedan en `y 207.6` y `216.4`) → Task 3 corre ese test.
- `footbridge` no puede cambiar ni un número al pasar a `stoneArch` → Task 1 suma a `landmarks.test.ts` un test que fija `x`, `y + 0.2`, `d − 0.4` y ancho de cada losa con la fórmula de hoy.
- La cúpula no puede pisar los bloques hundidos ni salir del agua; una lectura de bordes por centro en lugar de por caja la dejaría tocando → Task 4 usa `bounds()` y `r`.
- El rng del derrumbe: agregar la cúpula no puede consumir rng → Task 4 compara el estado del rng después de `collapsed` con el de un rng que solo hizo `int(2, 3)`.

---

### Task 1: `stoneArch` en el kit; el puente peatonal lo usa

**Files:**
- Modify: `src/kit/props.ts` (agregar `ARCH_SLABS` y `stoneArch` cerca de `garland`)
- Modify: `src/kit/forms/landmarks.ts:173-196` (`footbridge` usa `stoneArch`; se va la constante local `SLABS`)
- Test: `src/kit/props.test.ts`

**Interfaces:**
- Produces: `export const ARCH_SLABS = 6;` y `export function stoneArch(x: number, y: number, w: number, d: number, zTop: number, bottom: (s: number) => number): Solid[]` — seis prismas `stone`; la losa `k` va de `x + k·w/6` con ancho `w/6`, `y + 0.2` con fondo `d − 0.4`, desde `z = bottom(sin(π·(k + 0.5)/6))` hasta `zTop`.

- [ ] **Step 1: test que falla** (en `src/kit/props.test.ts`, importando `stoneArch, ARCH_SLABS` de `./props`)

```ts
describe("stoneArch", () => {
  it("seis losas de piedra de punta a punta, centradas en y, del perfil al tope", () => {
    const slabs = stoneArch(10, 20, 12, 5, 3, (s) => 3 - 2 * s);
    expect(slabs).toHaveLength(ARCH_SLABS);
    slabs.forEach((sl, k) => {
      if (sl.kind !== "prism") throw new Error("losa no prisma");
      expect(sl.mat).toBe("stone");
      expect(sl.at.x).toBeCloseTo(10 + k * 2, 9);
      expect(sl.w).toBeCloseTo(2, 9);
      expect(sl.at.y).toBeCloseTo(20.2, 9);
      expect(sl.d).toBeCloseTo(4.6, 9);
      expect(sl.at.z).toBeCloseTo(3 - 2 * Math.sin((Math.PI * (k + 0.5)) / 6), 9);
      expect(sl.at.z + sl.h).toBeCloseTo(3, 9);
    });
  });
});
```

El puente peatonal ya tiene su red en `src/kit/forms/landmarks.test.ts` ("puente en 54×5 a z −1 …", "puente: el borde inferior de las losas es un arco derecho …"): cuatro pilas, 18 losas, simetría por vano y clave más alta. Esos tests no se tocan y tienen que seguir en verde después del refactor. Ninguno fija la posición en planta de las losas, así que se suma uno (usa `LOT`, `slabs`, `recipe`, `EPS` del archivo):

```ts
it("puente: cada losa arranca donde la ponía la construcción de hoy, con 0.2 de retiro y d − 0.4 de fondo", () => {
  const lot = { ...LOT, x: 0, y: 0, w: 54, d: 5, z: -1 }, s = slabs(recipe("footbridge")(lot, createRng(1), STYLES.ribera), lot);
  const span = (54 - 4 * 1.2) / 3;
  s.forEach((q, n) => {
    if (q.kind !== "prism") throw new Error("losa no prisma");
    const i = Math.floor(n / 6), k = n % 6;
    expect(q.at.x).toBeCloseTo(1.2 + i * (span + 1.2) + (k * span) / 6, 9);
    expect(q.w).toBeCloseTo(span / 6, 9);
    expect(q.at.y).toBeCloseTo(0.2, 9);
    expect(q.d).toBeCloseTo(4.6, 9);
  });
});
```

(Si `slabs` no devuelve las losas ordenadas por x, ordenarlas antes.)

- [ ] **Step 2:** `npx vitest run src/kit/props.test.ts` → FAIL (`stoneArch` no existe).

- [ ] **Step 3: implementación**

```ts
/** Losas de un arco escalonado de piedra. */
export const ARCH_SLABS = 6;

/**
 * Arco escalonado de piedra a lo largo de x: seis losas verticales `stone` de `w/6`
 * de ancho y `d − 0.4` de fondo centradas en `y..y+d`, del borde inferior `bottom(s)`
 * hasta `zTop`; `s = sin(π·(k + 0.5)/6)` vale ≈ 0.26 en los extremos y ≈ 0.97 en el centro.
 */
export function stoneArch(x: number, y: number, w: number, d: number, zTop: number, bottom: (s: number) => number): Solid[] {
  return Array.from({ length: ARCH_SLABS }, (_, k) => {
    const z = bottom(Math.sin((Math.PI * (k + 0.5)) / ARCH_SLABS));
    return prism(x + (k * w) / ARCH_SLABS, y + 0.2, z, w / ARCH_SLABS, d - 0.4, zTop - z, "stone");
  });
}
```

En `footbridge`:

```ts
for (let i = 0; i < 3; i++) p.solids.push(...stoneArch(x + PIER_W + i * (span + PIER_W), y, span, d, deck, (s) => z + rise * s));
```

y `const DECK_Z = 2.2, DECK_H = 0.4, PIER_W = 1.2, ARCH_RING = 0.4, POST_STEP = 3;` (sin `SLABS`).

- [ ] **Step 4:** `npx vitest run src/kit` → PASS (incluye los tests existentes del puente peatonal y `city.test.ts` "torre de agua … y puente peatonal de piedra").
- [ ] **Step 5:** commit `feat(#47): stoneArch en el kit, el puente peatonal lo usa`.

### Task 2: puente de la avenida, pilas con tajamar y tres arcos

**Files:**
- Modify: `src/city/fixed.ts` (`bridge`)
- Create: `src/city/fixed.test.ts`
- Modify: `src/scenes/city.test.ts:154-165` (test "puente…")

**Interfaces:**
- Consumes: `stoneArch` de Task 1.
- Produces: `bridge(solids, accents)` con la misma firma.

- [ ] **Step 1: tests que fallan** (`src/city/fixed.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { BRIDGE, EAST_RING, STREET, WEST_QUAY } from "../scenes/city-grid";
import { bridge } from "./fixed";

const built = () => { const solids: Solid[] = [], accents: Accent[] = []; bridge(solids, accents); return { solids, accents }; };
const top = BRIDGE.z + BRIDGE.deckH;

describe("bridge", () => {
  it("tablero, rampas y estribo como hoy", () => {
    const { solids } = built();
    const deck = solids.find((s) => s.kind === "prism" && s.mat === "asphalt" && s.w > 60);
    expect(deck).toMatchObject({ at: { x: WEST_QUAY.x0, y: BRIDGE.y0, z: BRIDGE.z }, w: EAST_RING.x1 - WEST_QUAY.x0, d: BRIDGE.y1 - BRIDGE.y0, h: BRIDGE.deckH });
    const ramps = solids.filter((s) => s.kind === "ramp" && s.mat === "asphalt");
    expect(ramps.map((r) => r.kind === "ramp" && r.dir).sort()).toEqual(["e", "w"]);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "plaza" && s.at.x === WEST_QUAY.x0 && s.at.z === 0.6)).toBe(true);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "plaza" && s.at.z === -1)).toBe(false); // los pilotes de hoy se fueron
  });

  it("al menos cuatro pilas de piedra con tajamar, del fondo al tablero", () => {
    const piers = built().solids.filter((s) => s.kind === "poly" && s.mat === "stone");
    expect(piers.length).toBeGreaterThanOrEqual(4);
    for (const p of piers) {
      if (p.kind !== "poly") continue;
      expect(p.footprint).toHaveLength(6);
      expect(p.z).toBe(-1);
      expect(p.z + p.h).toBeCloseTo(BRIDGE.z, 9);
    }
  });

  it("18 losas de arco bajo el tablero; las centrales de cada vano bajan más que las de los extremos", () => {
    const slabs = built().solids
      .filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && s.at.z < BRIDGE.z)
      .sort((a, b) => a.at.x - b.at.x);
    expect(slabs).toHaveLength(18);
    for (const s of slabs) { const b = bounds(s); expect(b.min.z).toBeGreaterThanOrEqual(-1); expect(Math.abs(b.max.z - BRIDGE.z)).toBeLessThan(1e-6); }
    for (let i = 0; i < 3; i++) {
      const span = slabs.slice(i * 6, i * 6 + 6).map((s) => s.at.z);
      expect(Math.max(span[2]!, span[3]!)).toBeLessThan(Math.min(span[0]!, span[5]!));
    }
  });
});
```

En `src/scenes/city.test.ts`, el test "puente…" cambia la línea de los pilotes por:

```ts
const piers = s.solids.filter((x) => x.kind === "poly" && x.mat === "stone" && x.z === -1 && bounds(x).min.y >= BRIDGE.y0 - 1 && bounds(x).max.y <= BRIDGE.y1 + 1);
expect(piers.length).toBeGreaterThanOrEqual(4);
```

y el título pasa a "puente: tablero sobre el agua de muelle a anillo, pilas de piedra hasta el fondo, rampas en las cabeceras".

- [ ] **Step 2:** `npx vitest run src/city/fixed.test.ts src/scenes/city.test.ts` → FAIL (no hay pilas `poly`).

- [ ] **Step 3: implementación** en `fixed.ts` (importar `stoneArch` de `../kit/props` y `type Vec2` de `../iso/geometry`):

```ts
/** Pilas del puente de la avenida: tres en el agua cada 21 desde el estribo y una bajo la cabecera este. */
const BRIDGE_PIERS = [213, 234, 255, 274] as const;

/** Pila con tajamar centrada en `cx`: hexágono de 2 en x y del tablero + 1 de punta al norte y al sur. */
function cutwater(cx: number, y0: number, y1: number, z: number): Solid {
  const footprint: Vec2[] = [{ x: cx, y: y0 - 1 }, { x: cx + 1, y: y0 }, { x: cx + 1, y: y1 }, { x: cx, y: y1 + 1 }, { x: cx - 1, y: y1 }, { x: cx - 1, y: y0 }];
  return { kind: "poly", footprint, z: -1, h: z + 1, mat: "stone" };
}
```

En `bridge`, reemplazar la línea de los pilotes por:

```ts
for (const cx of BRIDGE_PIERS) solids.push(cutwater(cx, y0, y1, z));
// tres arcos entre pilas; el borde inferior baja hacia el centro del vano (issue #47), sin pasar de z −1
for (let i = 0; i < BRIDGE_PIERS.length - 1; i++) {
  const a = BRIDGE_PIERS[i]! + 1, span = BRIDGE_PIERS[i + 1]! - 1 - a, r = Math.min(span / 2, z + 1);
  solids.push(...stoneArch(a, y0, span, d, z, (s) => z - r * s));
}
```

- [ ] **Step 4:** `npx vitest run src/city src/scenes/city.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#47): puente de la avenida con pilas de tajamar y tres arcos de piedra`.

### Task 3: balaustrada y obeliscos con luz

**Files:**
- Modify: `src/city/fixed.ts` (`bridge`)
- Test: `src/city/fixed.test.ts`

**Interfaces:**
- Consumes: `bridge` de Task 2.

- [ ] **Step 1: tests que fallan** (sumar al `describe("bridge")`)

```ts
it("balaustrada de piedra: al menos 50 postes sobre el tablero y dos pasamanos; sin barandas officeDark", () => {
  const { solids } = built();
  const posts = solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.w === 0.3 && s.d === 0.3 && s.h === 0.9 && s.at.z === top);
  expect(posts.length).toBeGreaterThanOrEqual(50);
  const rails = solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.d === 0.2 && s.h === 0.2 && s.w > 60);
  expect(rails).toHaveLength(2);
  expect(solids.some((s) => s.kind === "prism" && s.mat === "officeDark")).toBe(false);
});

it("cuatro obeliscos en las esquinas, cada uno con su remate y un dot ámbar encima; sin faroles", () => {
  const { solids, accents } = built();
  const obelisks = solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && s.w === 1.2 && s.d === 1.2 && s.h === 4);
  expect(obelisks).toHaveLength(4);
  const dots = accents.filter((a) => a.kind === "dot" && a.color === "amber");
  expect(dots).toHaveLength(4);
  for (const o of obelisks) {
    const cx = o.at.x + 0.6, cy = o.at.y + 0.6;
    expect(solids.some((s) => s.kind === "cone" && s.mat === "stone" && s.sides === 4 && s.at.x === cx && s.at.y === cy && s.at.z === o.at.z + 4)).toBe(true);
    expect(dots.some((a) => a.kind === "dot" && a.at.x === cx && a.at.y === cy && a.at.z > o.at.z + 5)).toBe(true);
  }
  expect(solids.some((s) => s.kind === "prism" && s.mat === "steel" && s.h === 5)).toBe(false); // los dos faroles de hoy se fueron
});

it("autos: dos, de la medida de props.car", () => {
  const cars = built().solids.filter((s) => s.kind === "prism" && (s.mat === "steel" || s.mat === "rust") && s.h === 1.2);
  expect(cars).toHaveLength(2);
});

it("ninguna pieza sale de la huella del puente con sus rampas", () => {
  const { solids, accents } = built();
  const inside = (x: number, y: number) => x >= BRIDGE.x0 - STREET - 1e-6 && x <= BRIDGE.x1 + STREET + 1e-6 && y >= BRIDGE.y0 - 1 - 1e-6 && y <= BRIDGE.y1 + 1 + 1e-6;
  for (const s of solids) { const b = bounds(s); expect(inside(b.min.x, b.min.y) && inside(b.max.x, b.max.y)).toBe(true); }
  for (const a of accents) if (a.kind === "dot") expect(inside(a.at.x, a.at.y)).toBe(true);
});
```

- [ ] **Step 2:** `npx vitest run src/city/fixed.test.ts` → FAIL.

- [ ] **Step 3: implementación** — reemplazar las barandas y los dos `place(… lamp …)` de `bridge` por:

```ts
const OBELISK = 1.2, POST_STEP = 3;
```

(constantes de módulo junto a `BRIDGE_PIERS`) y en `bridge`:

```ts
// balaustrada entre obeliscos: postes cada 3 o menos de punta a punta y un pasamanos encima
const run = x1 - x0 - 2 * OBELISK, posts = Math.ceil((run - 0.3) / POST_STEP), step = (run - 0.3) / posts;
for (const ry of [y0, y1 - 0.3]) {
  for (let i = 0; i <= posts; i++) solids.push(prism(x0 + OBELISK + i * step, ry, top, 0.3, 0.3, 0.9, "stone"));
  solids.push(prism(x0 + OBELISK, ry + 0.05, top + 0.9, run, 0.2, 0.2, "stone"));
}
// obeliscos en las cuatro esquinas del tablero, con remate piramidal y una luz ámbar encima
for (const ox of [x0, x1 - OBELISK]) for (const oy of [y0, y1 - OBELISK]) {
  const cx = ox + OBELISK / 2, cy = oy + OBELISK / 2;
  solids.push(prism(ox, oy, top, OBELISK, OBELISK, 4, "stone"), { kind: "cone", at: v3(cx, cy, top + 4), r: 0.6, h: 1, mat: "stone", sides: 4 });
  accents.push({ kind: "dot", at: v3(cx, cy, top + 5.3), r: 0.6, color: "amber" });
}
```

Quitar `lamp`/`place` de los imports de `fixed.ts` solo si ya no se usan (las siguen usando `plazaAndTower` y `malecon`).

- [ ] **Step 4:** `npx vitest run src/city src/scenes` → PASS (incluye "faroles solo en avenida, puente, plaza y malecón": los `dot` quedan en `y 207.6`/`216.4`, dentro de `onAvenue`).
- [ ] **Step 5:** commit `feat(#47): balaustrada y obeliscos con luz en el puente de la avenida`.

### Task 4: derrumbe con fragmento de cúpula

**Files:**
- Modify: `src/city/fixed.ts` (`collapsed`)
- Test: `src/city/fixed.test.ts`

- [ ] **Step 1: test que falla**

```ts
describe("collapsed", () => {
  const built = () => { const solids: Solid[] = []; collapsed(solids, createRng(3)); return solids; };

  it("un fragmento de cúpula hundido, entero en agua, al oeste del labio de la rampa y sin tocar los bloques hundidos", () => {
    const solids = built();
    const domes = solids.filter((s): s is Solid & { kind: "dome" } => s.kind === "dome");
    expect(domes).toHaveLength(1);
    const d = domes[0]!;
    expect(d).toMatchObject({ mat: "officeDark", sides: 8, rings: 2, tone: -1 });
    expect(d.at.z).toBeLessThan(0);
    expect(d.h).toBeLessThan(d.r);
    expect(d.at.x + d.r).toBeLessThan(estuaryEast(d.at.y - d.r)); // la ribera se abre hacia el sur: el borde norte es el más justo
    expect(d.at.x + d.r).toBeLessThanOrEqual(COLLAPSED.x - 6);   // labio bajo de la rampa
    const box = { x0: d.at.x - d.r, x1: d.at.x + d.r, y0: d.at.y - d.r, y1: d.at.y + d.r };
    const sunk = solids.filter((s) => s.kind === "prism" && s.mat === "officeDark" && s.at.z < 0);
    expect(sunk).toHaveLength(3);
    for (const s of sunk) {
      const b = bounds(s);
      expect(box.x0 < b.max.x && box.x1 > b.min.x && box.y0 < b.max.y && box.y1 > b.min.y).toBe(false);
    }
  });

  it("la cúpula no consume rng: el resto del derrumbe es el de siempre", () => {
    const rest = built().filter((s) => s.kind !== "dome");
    expect(rest).toHaveLength(7); // rampa, plataforma, ruina, tres bloques hundidos, bloque en la calle (fixed.ts, collapsed de hoy)
    const a = createRng(3), b = createRng(3);
    collapsed([], a); b.int(2, 3); // la única tirada de hoy: el alto de la ruina
    expect(a.next()).toBe(b.next());
  });
});
```

(imports a sumar: `collapsed` de `./fixed`, `createRng` de `../map/seed`, `COLLAPSED, estuaryEast` de `../scenes/city-grid`.)

- [ ] **Step 2:** `npx vitest run src/city/fixed.test.ts` → FAIL (no hay `dome`).

- [ ] **Step 3: implementación** — al final de `collapsed`:

```ts
// fragmento de cúpula caído: casquete hundido en el agua, al sur de la losa grande (el (x − 9, y + 12) del issue cae dentro de ella)
solids.push({ kind: "dome", at: v3(c.x - 9.5, c.y + 17.5, -0.9), r: 3, h: 1.3, mat: "officeDark", sides: 8, rings: 2, tone: -1 });
```

- [ ] **Step 4:** `npx vitest run src/city src/scenes` → PASS.
- [ ] **Step 5:** commit `feat(#47): derrumbe con fragmento de cúpula en el agua`.

## Verificación final (etapa 4 del pipeline)

- `npm test` y `npm run typecheck` en verde.
- `npm run dev -- --host --port 5173`; abrir `/lab/resume.html` en agent-browser a 1600×900 DPR 2; acercar al puente (y 207..217, x 192..276) y al derrumbe (x 260..304, y 242..263); captura para el PR. Guion en `.scratch/evals-47.md`.

## Assumptions

Supuestos técnicos declarados en la revisión del plan (van a la descripción del PR):

1. **Posición de la cúpula** (decisión 6). El issue da `at = (COLLAPSED.x − 9, COLLAPSED.y + 12, −0.9)` y, en la misma frase y en su test, "sin tocar los tres bloques hundidos"; ese `at` cae dentro de la losa `266..274 × 250..256` (`src/city/fixed.ts:96`). Gana la condición que el issue vuelve test; la cúpula se corre lo mínimo para cumplirla: `(270.5, 259.5, −0.9)`. Descartado: apoyarla contra la losa (rompe el test del issue) o mover la losa (el issue pide el derrumbe "igual que hoy").
2. **Pilas en sus centros** (decisión 1). `x = 213, 234, 255, 274` son centros del hexágono (2 de ancho, puntas al norte y al sur, simétrico en x). Descartado: esquinas oeste (el hexágono no tiene esquina en x = 213 natural y correría el tajamar 1 al este).
3. **Arcos entre pilas, no entre apoyos.** El issue dice "Entre pilas, el arco" y pide 18 losas (tres arcos); los apoyos de cabecera incluyen el estribo, que no es pila. El vano estribo → 213 queda sin arco. Descartado: cuatro arcos (24 losas, contra el test del issue).
4. **Firma de `stoneArch`.** El issue sugiere `stoneArches(x0, x1, y, d, zTop, zBase, spans)`; con un `zBase` fijo no se pueden expresar los dos perfiles (el peatonal sube hacia la clave, el de la avenida baja según la fórmula del issue). Se usa `stoneArch(x, y, w, d, zTop, bottom)` por vano. Descartado: un flag de perfil.
5. **Perfil del arco de la avenida**: la fórmula del issue al pie de la letra (decisión 2), con su test ("las losas centrales de cada vano bajan más que las de los extremos").
6. **Postes "cada 3"**: repartidos de punta a punta con paso ≤ 3 entre obeliscos, como el puente peatonal (`src/kit/forms/landmarks.ts:191`).

## Grilling

- Rondas: 1 (los cambios no movieron ninguna costura ni agregaron tareas: dos tests más y una línea del Review Focus corregida).
- Preguntas: 16. Fuentes: ISSUE 7, CODE 13, DOC 2 (varias respuestas citan más de una); NO SOURCE 4 (1, 2-centros, 13, 14-paso), todas supuestos técnicos.
- Supuestos: los seis de "Assumptions".
- Issues abiertos: ninguno.

## Revisión de código (etapa 6)

- **Perfil del arco corregido.** La revisión mostró en la captura que la fórmula literal (`z − r·s`) dejaba un delantal de piedra colgado, más hondo en el centro del vano: un arco invertido. Prevalecen el criterio de aceptación ("tres arcos de piedra escalonados"), el "reutilizar la misma construcción" del puente peatonal, la spec §8 y la decisión 10 de #35. El borde inferior pasa a `z − r + (r − 0.4)·s`: arranca en `z − r` = −1 y sube hacia la clave, con 0.4 de losa en la clave como el peatonal. Se conservan las 18 losas, `min.z ≥ −1` y `max.z = BRIDGE.z`, y el test de `fixed.test.ts` invierte la desigualdad. Reemplaza la decisión 2 y el supuesto 5.
- El salto de cono de piedra en `city.test.ts` queda acotado a la huella del puente.
