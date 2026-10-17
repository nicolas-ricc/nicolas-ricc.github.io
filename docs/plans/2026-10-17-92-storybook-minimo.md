# Storybook 1 (#92): página mínima con recorte por región — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/lab/storybook.html` muestra un exhibit de región a la vez (chimeneas, noria, torre, faro), recortado del mundo real por una caja de mundo, encuadrado grande y animado, con índice HTML, hash en la URL y flechas.

**Architecture:** Dos módulos puros nuevos en `src/lab/` (`crop.ts` recorta escena y animadores por caja; `exhibits.ts` es el catálogo y la selección por hash), un encuadre nuevo `boxFrame` en `src/world/frame.ts` y una página fina `src/lab/storybook.ts` que arma el mundo una vez y, por exhibit, destruye y rearma el `Stage` con `buildStage` sin cambios de dibujo.

**Tech Stack:** TypeScript estricto, Vite, PixiJS v8 (solo en la página), Vitest (sin Pixi en los tests nuevos).

**Spec:** `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` §3, §4, §6; issue #92 (manda sobre la spec donde difieren).

## Global Constraints

- `src/lab/crop.ts` y `src/lab/exhibits.ts` no importan Pixi; `src/iso/` no importa Pixi.
- Todo color de `src/**/*.ts` sale de `src/map/palette-iso.ts` (`palette-guard.test.ts`); `Math.random` prohibido. El `<style>` de `lab/storybook.html` puede llevar colores CSS, como `lab/world.html`.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo.
- Sin dependencias nuevas. Commits `feat(#92): …`.
- `lab/storybook.html`: `<meta name="robots" content="noindex" />` y `src="/src/lab/storybook.ts"`; fondo `#100e19`; `aria-label` con las teclas.
- Log en DEV: `[storybook] <id>: primer dibujo N ms, M polígonos estáticos`.
- `lab/world.html` y el sitio no cambian.

## Decisiones técnicas (declaradas)

1. **Terreno por triángulo.** `terrain.ground` son seis mallas `ground` que cubren el mundo entero y `terrain.water`/`foam` igual: filtrarlas por `bounds` del sólido entero conservaría todo el terreno. Los sólidos `kind: "ground"` se recortan por triángulo (se conserva cada triángulo entero cuya caja solapa; nunca se corta un triángulo); si no queda ninguno el sólido se descarta. El resto de los sólidos se conserva entero o se descarta por `overlaps(bounds(s), box)`. `foam`, campo obligatorio, queda como `ground` sin triángulos cuando no solapa.
2. **Identidad de los reclamos.** El runtime excluye del agua estática los cuerpos reclamados por identidad (`Set`, `src/world/stage.ts:90-93`). `cropSolid` (puro, sin memo) se usa en las capas animadas; `cropShared` lo envuelve con memo por `(box, solid)` en `WeakMap`s y se usa **solo** para `terrain.*` en `cropScene` y para `claims` en `cropAnimators`, así `terrain.water[i]` recortado y su reclamo son el mismo objeto. Las capas animadas no se memoizan: `water-anim.ts:113` reasigna `glintSolids[k].tris` en el mismo objeto en cada paso, y un memo por identidad devolvería destellos viejos.
3. **`Box` vive en `src/world/frame.ts`** (lo consume `boxFrame`; `src/world/` no importa de `src/lab/`). `exhibits.ts` y `crop.ts` lo importan de ahí.
4. **Chimeneas:** la caja se estira al norte `PUFF_RANGE` (28 u, `factory-anim.ts`) para que la columna de humo no se corte a los 3 u de la boca.
5. **Navegación circular:** desde el último, “siguiente” va al primero y viceversa.
6. **Hash:** se decodifica con `decodeURIComponent` (un `URIError` por hash mal formado cuenta como desconocido) y se ignora el `#` inicial; desconocido o vacío → primer exhibit y `history.replaceState` corrige el hash sin agregar entrada al historial.
7. **Bloom tras cambiar de exhibit.** `attachBloom` guarda el `stage` que recibe y aplica el veredicto diferido con `stage.setBloom` (`bloom-runtime.ts:39`). La página le pasa un adaptador `{ get bloom(), setBloom(m) }` que delega en el stage vigente, así el veredicto nunca toca un contenedor destruido.
8. **`zoneFrame` delega en `boxFrame`.** El issue pide `boxFrame` "al lado de `zoneFrame`"; delegar evita duplicar la proyección. Los tests existentes de `zoneFrame` (`frame.test.ts`, describe `zoneFrame`) más uno nuevo que compara `boxFrame(WORLD)` con `zoneFrame("all")` garantizan que el sitio no cambia.
9. **Colores del html.** `palette-guard.test.ts` solo revisa `0x[0-9a-fA-F]{6}` en `src/**/*.ts` (no tests); el `<style>` de `lab/*.html` queda fuera, como el `#100e19` de `lab/world.html`.

## Review Focus

1. Hash desconocido, vacío, sólo `#` o con mayúsculas → primer exhibit y hash corregido (test en Task 4, `pickExhibit`).
2. Flecha en el último/primer exhibit → da la vuelta, no se queda ni explota (test en Task 4, `stepExhibit`).
3. Una caja donde el agua reclamada por el animador queda recortada: el agua no se pinta dos veces (estática + animada) — misma identidad entre `cropScene` y `cropAnimators` (test en Task 3).
4. Un animador cuya capa animada luego sale de la caja (humo, barcos) o que reasigna el contenido del mismo objeto (destellos del agua): por tick `layer(id)` filtra de nuevo, sin memo (tests en Task 3: tras `tick`, y con un sólido `ground` mutado en el lugar).
5. Cambiar de exhibit varias veces no acumula stages en `app.stage` (verificación con agent-browser en Task 5: `stage.children.length === 1` tras tres cambios).
6. Hash mal formado (`#%E0%A4%A`) → primer exhibit, sin excepción (test en Task 4).

---

### Task 1: `Box` y `boxFrame` en `src/world/frame.ts`

**Files:**
- Modify: `src/world/frame.ts` (al lado de `zoneFrame`)
- Test: `src/world/frame.test.ts`

**Interfaces:**
- Produces: `export interface Box { x0: number; y0: number; x1: number; y1: number }`; `export function boxFrame(box: Box, h?: number): RenderItem[]` (`h` por defecto `FRAME_H` = 30).

- [ ] **Step 1: test que falla** — agregar a `frame.test.ts` (importar `boxFrame`):

```ts
describe("boxFrame", () => {
  it("proyecta las cuatro esquinas de la caja y la norte lleva h", () => {
    const [it] = boxFrame({ x0: 10, y0: 20, x1: 30, y1: 50 }, 12);
    expect(it!.pts).toHaveLength(8);
    const n = project(v3(10, 20, 12));
    expect(it!.pts.slice(0, 2)).toEqual([n.x, n.y]);
    const rest = [[30, 20], [30, 50], [10, 50]].flatMap(([x, y]) => { const p = project(v3(x!, y!, 0)); return [p.x, p.y]; });
    expect(it!.pts.slice(2)).toEqual(rest);
  });
  it("sin h usa el alto de referencia de zoneFrame", () => {
    const [a] = boxFrame({ x0: WORLD.x0, y0: WORLD.y0, x1: WORLD.x1, y1: WORLD.y1 });
    expect(a!.pts).toEqual(zoneFrame("all")[0]!.pts);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/world/frame.test.ts` → FAIL (`boxFrame` no existe).
- [ ] **Step 3: implementación** — `zoneFrame` pasa a delegar en `boxFrame`:

```ts
/** Caja de mundo en x/y; z no cuenta. */
export interface Box { x0: number; y0: number; x1: number; y1: number }

/** Caja de mundo proyectada, como RenderItem para fitTransform: `h` en la esquina norte (la que sube en pantalla), las otras tres a z 0. */
export function boxFrame(box: Box, h = FRAME_H): RenderItem[] {
  const { x0, y0, x1, y1 } = box;
  const pts: number[] = [];
  for (const [x, y, z] of [[x0, y0, h], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]] as const) { const p = project(v3(x, y, z)); pts.push(p.x, p.y); }
  return [{ layer: "ground", pts, color: 0 }];
}
```

y en `zoneFrame`, tras calcular `[x0, y0, x1, y1]`: `return boxFrame({ x0, y0, x1, y1 });`.
- [ ] **Step 4:** `npx vitest run src/world/frame.test.ts` → PASS (incluidos los tests viejos de `zoneFrame`).
- [ ] **Step 5:** `git add src/world/frame.ts src/world/frame.test.ts && git commit -m "feat(#92): boxFrame encuadra una caja de mundo"`

### Task 2: `overlaps`, `cropSolid` y `cropScene` en `src/lab/crop.ts`

**Files:**
- Create: `src/lab/crop.ts`
- Test: `src/lab/crop.test.ts`

**Interfaces:**
- Consumes: `Box` de `../world/frame`; `bounds`, `Bounds`, `Solid`, `Tri` de `../iso/solids`; `Accent` de `../iso/accent`; `WorldScene` de `../scenes/world`.
- Produces:
  - `export function overlaps(b: Bounds, box: Box): boolean` — solape cerrado en x e y (tocar el borde cuenta); z no cuenta.
  - `export function cropSolid(s: Solid, box: Box): Solid | null` — puro, sin memo.
  - `export function cropShared(s: Solid, box: Box): Solid | null` — `cropSolid` memoizado por `(box, s)`; solo para terreno y reclamos.
  - `export function cropSolids(solids: readonly Solid[], box: Box): Solid[]`
  - `export function cropAccents(accents: readonly Accent[], box: Box): Accent[]` — `dot` por `at`, `poly` por cualquier vértice dentro de la caja (bordes incluidos).
  - `export function cropScene(scene: WorldScene, box: Box): WorldScene`

- [ ] **Step 1: tests que fallan** (`crop.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { WorldScene } from "../scenes/world";
import { cropAccents, cropScene, cropShared, overlaps } from "./crop";

const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
const prism = (x: number, y: number, w = 2): Solid => ({ kind: "prism", at: v3(x, y, 0), w, d: w, h: 3, mat: "concrete" });
const tri = (x: number, y: number) => ({ pts: [v3(x, y, 0), v3(x + 1, y, 0), v3(x, y + 1, 0)] as [ReturnType<typeof v3>, ReturnType<typeof v3>, ReturnType<typeof v3>] });

describe("overlaps", () => {
  it("una caja que toca el borde solapa; una separada no", () => {
    expect(overlaps({ min: v3(10, 3, 0), max: v3(12, 4, 9) }, box)).toBe(true);
    expect(overlaps({ min: v3(10.1, 3, 0), max: v3(12, 4, 9) }, box)).toBe(false);
    expect(overlaps({ min: v3(3, -5, 0), max: v3(4, -0.1, 0) }, box)).toBe(false);
  });
});

describe("cropScene", () => {
  const water: Solid = { kind: "ground", mat: "water", tris: [tri(1, 1), tri(50, 50)] };
  const scene = {
    terrain: { ground: [{ kind: "ground", mat: "concrete", tris: [tri(2, 2), tri(40, 40)] }], bleed: [{ kind: "ground", mat: "concrete", tris: [tri(90, 90)] }], water: [water], foam: { kind: "ground", mat: "foam", tris: [tri(70, 70)] } },
    ground: [prism(1, 1), prism(30, 30)],
    solids: [prism(9, 9, 4), prism(20, 20)],
    accents: [],
    landmarks: { portfolio: v3(0, 0, 0), cv: v3(0, 0, 0), blog: v3(0, 0, 0) },
    shipyard: null, city: null, factory: null, sea: null, hinterland: null, tech: null, fair: null,
  } as unknown as WorldScene;
  const out = cropScene(scene, box);

  it("conserva entero un sólido que cruza el borde y descarta uno de afuera", () => {
    expect(out.solids).toEqual([scene.solids[0]]);
    expect(out.ground).toEqual([scene.ground[0]]);
  });
  it("el terreno se filtra por triángulo y una malla vacía desaparece", () => {
    expect(out.terrain.ground).toHaveLength(1);
    expect((out.terrain.ground[0] as Solid & { kind: "ground" }).tris).toEqual([tri(2, 2)]);
    expect(out.terrain.bleed).toEqual([]);
    expect((out.terrain.water[0] as Solid & { kind: "ground" }).tris).toEqual([tri(1, 1)]);
  });
  it("la espuma de afuera queda como suelo sin triángulos", () => {
    expect(out.terrain.foam).toMatchObject({ kind: "ground", mat: "foam", tris: [] });
  });
  it("el mismo sólido y la misma caja devuelven el mismo recorte", () => {
    expect(cropShared(water, box)).toBe(out.terrain.water[0]);
  });
});

describe("cropAccents", () => {
  it("dot por su punto, poly por cualquier vértice adentro", () => {
    const inDot: Accent = { kind: "dot", at: v3(5, 5, 20), r: 1, color: "cyan" };
    const outDot: Accent = { kind: "dot", at: v3(11, 5, 0), r: 1, color: "cyan" };
    const crossPoly: Accent = { kind: "poly", pts: [v3(9, 9, 0), v3(30, 9, 0), v3(30, 30, 0)], color: "amber" };
    const outPoly: Accent = { kind: "poly", pts: [v3(20, 20, 0), v3(30, 20, 0), v3(30, 30, 0)], color: "amber" };
    expect(cropAccents([inDot, outDot, crossPoly, outPoly], box)).toEqual([inDot, crossPoly]);
  });
});
```

(Los materiales y colores del fixture existen en `palette-iso.ts`; el cast `as unknown as WorldScene` del fixture es aceptable en el test.)

- [ ] **Step 2:** `npx vitest run src/lab/crop.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: implementación:**

```ts
import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid, type Tri } from "../iso/solids";
import type { WorldScene } from "../scenes/world";
import type { Box } from "../world/frame";

/** Solape en x e y, bordes incluidos; z no cuenta. */
export function overlaps(b: Bounds, box: Box): boolean {
  return b.min.x <= box.x1 && b.max.x >= box.x0 && b.min.y <= box.y1 && b.max.y >= box.y0;
}

const inside = (p: Vec3, box: Box): boolean => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;

// sin arrays intermedios: corre por tick sobre las bandas de agua del mundo entero
function triOverlaps({ pts: [a, b, c] }: Tri, box: Box): boolean {
  return Math.min(a.x, b.x, c.x) <= box.x1 && Math.max(a.x, b.x, c.x) >= box.x0 && Math.min(a.y, b.y, c.y) <= box.y1 && Math.max(a.y, b.y, c.y) >= box.y0;
}

/**
 * Un sólido dentro de la caja: entero si solapa, `null` si no. Las mallas
 * `ground` (terreno, agua, espuma) cubren el mundo entero: se filtran por
 * triángulo, sin cortar ninguno.
 */
export function cropSolid(s: Solid, box: Box): Solid | null {
  if (s.kind !== "ground") return overlaps(bounds(s), box) ? s : null;
  const tris = s.tris.filter((t) => triOverlaps(t, box));
  return tris.length === s.tris.length ? s : tris.length ? { ...s, tris } : null;
}

// el stage reconoce el agua reclamada por identidad: terreno y reclamos tienen que recortar al mismo objeto
const memo = new WeakMap<Box, WeakMap<Solid, Solid | null>>();

/** `cropSolid` memoizado por (caja, sólido), para el terreno y los reclamos. Las capas animadas no: mutan sus sólidos. */
export function cropShared(s: Solid, box: Box): Solid | null {
  let m = memo.get(box);
  if (!m) memo.set(box, (m = new WeakMap()));
  if (!m.has(s)) m.set(s, cropSolid(s, box));
  return m.get(s)!;
}

export function cropSolids(solids: readonly Solid[], box: Box, crop = cropSolid): Solid[] {
  return solids.flatMap((s) => crop(s, box) ?? []);
}

export function cropAccents(accents: readonly Accent[], box: Box): Accent[] {
  return accents.filter((a) => (a.kind === "dot" ? inside(a.at, box) : a.pts.some((p) => inside(p, box))));
}

/** La escena reducida a la caja. Las subescenas y `landmarks` pasan tal cual: el stage no las lee. */
export function cropScene(scene: WorldScene, box: Box): WorldScene {
  const { terrain } = scene;
  return {
    ...scene,
    terrain: {
      ground: cropSolids(terrain.ground, box, cropShared),
      bleed: cropSolids(terrain.bleed, box, cropShared),
      water: cropSolids(terrain.water, box, cropShared),
      foam: cropShared(terrain.foam, box) ?? { kind: "ground", mat: "foam", tris: [] },
    },
    ground: cropSolids(scene.ground, box),
    solids: cropSolids(scene.solids, box),
    accents: cropAccents(scene.accents, box),
  };
}
```

Nota: si `cropShared(terrain.foam)` es `null`, el reclamo también es `null` y se descarta; la espuma vacía de reemplazo no tiene triángulos y no dibuja nada aunque quede como agua estática.
- [ ] **Step 4:** `npx vitest run src/lab/crop.test.ts` → PASS; `npm run typecheck` → limpio.
- [ ] **Step 5:** `git add src/lab/crop.ts src/lab/crop.test.ts && git commit -m "feat(#92): recorte de la escena por caja de mundo"`

### Task 3: `cropAnimators` en `src/lab/crop.ts`

**Files:**
- Modify: `src/lab/crop.ts`
- Test: `src/lab/crop.test.ts`

**Interfaces:**
- Consumes: `cropShared`, `cropSolids`, `cropAccents` (Task 2); `ZonedAnimator` de `../world/assemble`; `AnimLayer` de `../scenes/animator`.
- Produces: `export function cropAnimators(animators: readonly ZonedAnimator[], box: Box): ZonedAnimator[]`.

- [ ] **Step 1: tests que fallan** (agregar a `crop.test.ts`; importar `cropAnimators`, `type ZonedAnimator` de `../world/assemble`):

```ts
describe("cropAnimators", () => {
  // un animador de juguete: un sólido que se mueve en x 1 u por tick, más acentos fijos
  const toy = (x0: number, claims: Solid[] = []): ZonedAnimator => {
    let x = x0;
    return {
      zone: "portfolio",
      ids: ["toy.solid", "toy.acc"],
      claims,
      layer: (id) => id === "toy.solid"
        ? { kind: "solid", solids: [prism(x, 1), prism(40, 40)], alpha: 0.5 }
        : { kind: "accent", accents: [{ kind: "dot", at: v3(x, 1, 0), r: 1, color: "cyan" }] },
      tick: () => { x += 1; return new Set(["toy.solid"]); },
    };
  };

  it("el envuelto conserva ids, zona y el resultado de tick", () => {
    const [a] = cropAnimators([toy(1)], box);
    expect(a!.ids).toEqual(["toy.solid", "toy.acc"]);
    expect(a!.zone).toBe("portfolio");
    expect([...a!.tick(16)]).toEqual(["toy.solid"]);
  });
  it("las capas devuelven solo lo que cae adentro, también después de tick", () => {
    const [a] = cropAnimators([toy(1)], box);
    expect(a!.layer("toy.solid")).toMatchObject({ kind: "solid", alpha: 0.5, solids: [prism(1, 1)] });
    for (let i = 0; i < 12; i++) a!.tick(16);
    expect(a!.layer("toy.solid")).toMatchObject({ solids: [] });
    expect(a!.layer("toy.acc")).toMatchObject({ accents: [] });
  });
  it("filtra claims con la misma identidad que cropScene", () => {
    const water: Solid = { kind: "ground", mat: "water", tris: [tri(1, 1), tri(50, 50)] };
    const far: Solid = { kind: "ground", mat: "water", tris: [tri(50, 50)] };
    const [a] = cropAnimators([toy(1, [water, far])], box);
    expect(a!.claims).toEqual([cropShared(water, box)]);
    expect(a!.claims![0]).toBe(cropShared(water, box));
  });
  it("una capa que reasigna los triángulos del mismo sólido se recorta de nuevo en cada llamada", () => {
    const glint: Solid & { kind: "ground" } = { kind: "ground", mat: "glint", tris: [tri(1, 1)] };
    const a0: ZonedAnimator = { zone: null, ids: ["g"], layer: () => ({ kind: "water", water: [glint] }), tick: () => new Set(["g"]) };
    const [a] = cropAnimators([a0], box);
    glint.tris = [tri(2, 2), tri(60, 60)];
    expect(a!.layer("g")).toMatchObject({ water: [{ tris: [tri(2, 2)] }] });
  });
  it("descarta el animador sin contenido inicial en la caja", () => {
    expect(cropAnimators([toy(30)], box)).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lab/crop.test.ts` → FAIL (`cropAnimators` no existe).
- [ ] **Step 3: implementación:**

```ts
function cropLayer(l: AnimLayer, box: Box): AnimLayer {
  if (l.kind === "solid") return { ...l, solids: cropSolids(l.solids, box) };
  if (l.kind === "accent") return { ...l, accents: cropAccents(l.accents, box) };
  return { ...l, water: cropSolids(l.water, box) };
}

const isEmpty = (l: AnimLayer): boolean => (l.kind === "solid" ? l.solids : l.kind === "accent" ? l.accents : l.water).length === 0;

/**
 * Cada animador envuelto: mismos ids, zona y tick; `layer` y `claims` filtrados
 * con las reglas de `cropScene`. Se descarta el que no tiene nada en la caja en
 * su estado inicial (no hace falta tickear el mar entero para mirar una chimenea).
 */
export function cropAnimators(animators: readonly ZonedAnimator[], box: Box): ZonedAnimator[] {
  return animators.flatMap((a) => {
    const layer = (id: string): AnimLayer => cropLayer(a.layer(id), box);
    if (a.ids.every((id) => isEmpty(layer(id)))) return [];
    return [{ zone: a.zone, ids: a.ids, claims: a.claims && cropSolids(a.claims, box, cropShared), layer, tick: (dt: number) => a.tick(dt) }];
  });
}
```

Nota: `claims` puede quedar `undefined` (el tsconfig no activa `exactOptionalPropertyTypes`); `buildStage` usa `a.claims ?? []` (`stage.ts:90`).
- [ ] **Step 4:** `npx vitest run src/lab/crop.test.ts` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5:** `git add src/lab/crop.ts src/lab/crop.test.ts && git commit -m "feat(#92): animadores recortados por caja"`

### Task 4: catálogo `src/lab/exhibits.ts` con selección por hash

**Files:**
- Create: `src/lab/exhibits.ts`
- Test: `src/lab/exhibits.test.ts`

**Interfaces:**
- Consumes: `Box` (Task 1); `cropScene`, `cropAnimators` (Tasks 2–3, solo en el test); `assembleWorld` de `../world/assemble` (test); constantes `STACKS`, `STACK_BASE_H` (`../scenes/factory`), `PUFF_RANGE`, `PUFF_LIFT` (`../scenes/factory-anim`), `WHEEL` (`../scenes/fair`), `TOWER`, `TOWER_H` (`../scenes/city-grid`), `LIGHTHOUSE` (`../scenes/sea`); `WorldZone` de `../map/geo`; `Solid`, `Accent`.
- Produces:
  - `export type Exhibit = { id: string; title: string; zone: WorldZone } & ({ kind: "region"; box: Box; h?: number } | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void })`
  - `export const EXHIBITS: readonly Exhibit[]` (en este hijo solo `region`; orden del índice: chimeneas, noria, torre, faro)
  - `export function pickExhibit(hash: string, list?: readonly Exhibit[]): Exhibit` — `#` inicial opcional, `decodeURIComponent` (mal formado = desconocido); desconocido → `list[0]`.
  - `export function stepExhibit(id: string, delta: 1 | -1, list?: readonly Exhibit[]): Exhibit` — circular.
  - `export const ZONE_TITLE: Record<WorldZone, string>` = `{ portfolio: "Portfolio", cv: "Resume", blog: "Blog" }` para el índice.

- [ ] **Step 1: tests que fallan** (`exhibits.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { BLEED, WORLD } from "../map/geo";
import { assembleWorld } from "../world/assemble";
import { cropAnimators, cropScene } from "./crop";
import { EXHIBITS, pickExhibit, stepExhibit } from "./exhibits";

const regions = EXHIBITS.flatMap((e) => (e.kind === "region" ? [e] : []));

describe("catálogo de exhibits", () => {
  it("ids únicos con el patrón del hash", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("al menos cuatro regiones y una por zona", () => {
    expect(regions.length).toBeGreaterThanOrEqual(4);
    expect(new Set(regions.map((e) => e.zone))).toEqual(new Set(["portfolio", "cv", "blog"]));
  });
  it("cada caja cae dentro del mundo más el sangrado y no está invertida", () => {
    for (const { box } of regions) {
      expect(box.x0).toBeLessThan(box.x1); expect(box.y0).toBeLessThan(box.y1);
      expect(box.x0).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(box.x1).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(box.y0).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(box.y1).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
    }
  });
  const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
  it("contra el mundo real cada región recorta al menos un sólido y un animador que no es el agua", () => {
    for (const e of regions) {
      expect(cropScene(scene, e.box).solids.length, e.id).toBeGreaterThan(0);
      expect(cropAnimators(animators, e.box).some((a) => a.zone !== null), e.id).toBe(true);
    }
  });
});

describe("selección por hash", () => {
  const [first, second] = EXHIBITS;
  it("acepta el hash con o sin #", () => {
    expect(pickExhibit(`#${second!.id}`)).toBe(second);
    expect(pickExhibit(second!.id)).toBe(second);
  });
  it("vacío, solo # o desconocido → el primero", () => {
    for (const h of ["", "#", "#nada", "#%E0%A4%A", `#${second!.id.toUpperCase()}`]) expect(pickExhibit(h)).toBe(first);
  });
  it("las flechas dan la vuelta en los extremos", () => {
    const last = EXHIBITS[EXHIBITS.length - 1]!;
    expect(stepExhibit(first!.id, 1)).toBe(second);
    expect(stepExhibit(first!.id, -1)).toBe(last);
    expect(stepExhibit(last.id, 1)).toBe(first);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lab/exhibits.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: implementación** — cajas derivadas de constantes, margen 3 u:

```ts
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import type { WorldZone } from "../map/geo";
import { TOWER, TOWER_H } from "../scenes/city-grid";
import { STACK_BASE_H, STACKS } from "../scenes/factory";
import { PUFF_LIFT, PUFF_RANGE } from "../scenes/factory-anim";
import { WHEEL } from "../scenes/fair";
import { LIGHTHOUSE } from "../scenes/sea";
import type { Box } from "../world/frame";

/** Una estructura para mirar sola: una caja sobre el mundo real o una pieza reubicable armada en el origen. */
export type Exhibit = { id: string; title: string; zone: WorldZone } & (
  | { kind: "region"; box: Box; h?: number }
  | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void }
);

const M = 3; // margen: veredas, faroles y sombras cortas

const stacksX = STACKS.map((s) => s.x), stacksY = STACKS.map((s) => s.y), stackR = Math.max(...STACKS.map((s) => s.r));
const stackTop = Math.max(...STACKS.map((s) => s.h)) + STACK_BASE_H;

export const ZONE_TITLE: Record<WorldZone, string> = { portfolio: "Portfolio", cv: "Resume", blog: "Blog" };

export const EXHIBITS: readonly Exhibit[] = [
  // el humo deriva al NNE hasta PUFF_RANGE: la caja se estira al norte para no cortar la columna
  { id: "chimeneas", title: "Chimeneas de la fábrica", zone: "portfolio", kind: "region",
    box: { x0: Math.min(...stacksX) - stackR - M, y0: Math.min(...stacksY) - stackR - PUFF_RANGE, x1: Math.max(...stacksX) + stackR + M + PUFF_RANGE / 2, y1: Math.max(...stacksY) + stackR + M },
    h: stackTop + PUFF_RANGE * PUFF_LIFT },
  { id: "noria", title: "Noria de la feria", zone: "portfolio", kind: "region",
    box: { x0: WHEEL.x - WHEEL.r - M, y0: WHEEL.y - WHEEL.r - M, x1: WHEEL.x + WHEEL.r + M, y1: WHEEL.y + WHEEL.r + M }, h: WHEEL.hub + WHEEL.r },
  { id: "torre", title: "Torre de la ciudad", zone: "cv", kind: "region",
    box: { x0: TOWER.x - M, y0: TOWER.y - M, x1: TOWER.x + TOWER.w + M, y1: TOWER.y + TOWER.d + M }, h: TOWER_H + 6 },
  { id: "faro", title: "Faro", zone: "blog", kind: "region",
    box: { x0: LIGHTHOUSE.x - 8, y0: LIGHTHOUSE.y - 8, x1: LIGHTHOUSE.x + 8, y1: LIGHTHOUSE.y + 8 }, h: LIGHTHOUSE.z + 32 },
];

/** El exhibit del hash (`#id` o `id`); vacío o desconocido, el primero. */
export function pickExhibit(hash: string, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  let id: string;
  try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch { id = ""; } // %-escape roto: como desconocido
  return list.find((e) => e.id === id) ?? list[0]!;
}

/** Vecino en el orden del índice, dando la vuelta en los extremos. */
export function stepExhibit(id: string, delta: 1 | -1, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  const i = list.findIndex((e) => e.id === id);
  return list[(i + delta + list.length) % list.length]!;
}
```

Verificar que `TOWER`/`TOWER_H` estén exportados de `src/scenes/city-grid.ts` (lo están: `export const TOWER`, `export const TOWER_H`). Si el test de no-vacío falla para un exhibit, ajustar su caja, no el test.
- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5:** `git add src/lab/exhibits.ts src/lab/exhibits.test.ts && git commit -m "feat(#92): catálogo de exhibits de región y selección por hash"`

### Task 5: página `lab/storybook.html` + `src/lab/storybook.ts`

**Files:**
- Create: `lab/storybook.html`, `src/lab/storybook.ts`
- Modify: `src/lab/lab-excluded.test.ts` (sumar `"storybook"` a la lista de entradas de dev)

**Interfaces:**
- Consumes: `EXHIBITS`, `ZONE_TITLE`, `pickExhibit`, `stepExhibit`, `Exhibit` (Task 4); `cropScene`, `cropAnimators` (Tasks 2–3); `boxFrame`, `fitTransform` (Task 1 / `frame.ts`); `assembleWorld`; `buildStage`, `Stage`, `BloomMode`; `scheduleIdle`; `attachBloom`, `BloomProbe`; `bloomFromSearch`, `nextBloomMode` de `./page`; `ISO_COLORS`.

- [ ] **Step 1: test que falla** — en `lab-excluded.test.ts`, la lista pasa a `["portfolio", "resume", "blog", "world", "storybook"]`. `npx vitest run src/lab/lab-excluded.test.ts` → FAIL.
- [ ] **Step 2: `lab/storybook.html`:**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Lab: Storybook de estructuras</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #100e19; /* = ISO_COLORS.sky en src/map/palette-iso.ts */ color: #d8d4e8; font: 14px/1.4 system-ui, sans-serif; }
      body { display: grid; grid-template-columns: 14rem 1fr 16rem; }
      #exhibits { overflow-y: auto; padding: 1rem; }
      #exhibits h2 { font-size: 0.8rem; text-transform: uppercase; opacity: 0.6; margin: 1rem 0 0.3rem; }
      #exhibits ul { list-style: none; margin: 0; padding: 0; }
      #exhibits a { color: inherit; text-decoration: none; display: block; padding: 0.15rem 0.4rem; border-radius: 3px; }
      #exhibits a[aria-current="page"] { background: rgba(255, 255, 255, 0.12); }
      #lab-host { min-width: 0; height: 100%; }
      #lab-host canvas { display: block; }
      #readout { padding: 1rem; }
    </style>
  </head>
  <body>
    <nav id="exhibits" aria-label="Exhibits"></nav>
    <div id="lab-host" aria-label="Storybook de estructuras: un exhibit a la vez. Flechas o j/k cambian de exhibit. Tecla 6 rota el bloom: off, on, fallback."></div>
    <aside id="readout" aria-label="Lectura del exhibit"></aside>
    <script type="module" src="/src/lab/storybook.ts"></script>
  </body>
</html>
```

(El color de texto `#d8d4e8` vive en el html, no en `src/`: `palette-guard.test.ts` mira `src/`; si el guard mirara también `lab/`, usar `color: white; opacity` en su lugar.)
- [ ] **Step 3: `src/lab/storybook.ts`:**

```ts
import { Application } from "pixi.js";
import { ISO_COLORS } from "../map/palette-iso";
import { assembleWorld } from "../world/assemble";
import { scheduleIdle } from "../world/bloom";
import { attachBloom, type BloomProbe } from "../world/bloom-runtime";
import { boxFrame, fitTransform } from "../world/frame";
import { type BloomMode, buildStage, type Stage } from "../world/stage";
import { cropAnimators, cropScene } from "./crop";
import { EXHIBITS, type Exhibit, ZONE_TITLE, pickExhibit, stepExhibit } from "./exhibits";
import { bloomFromSearch, nextBloomMode } from "./page";

/**
 * Storybook de estructuras: un exhibit a la vez, recortado del mundo por su
 * caja. El hash elige el exhibit; flechas y j/k solo escriben el hash. 6 rota
 * el bloom; ?bloom= lo fuerza y ?speed= escala el reloj, como en page.ts.
 */
const host = document.getElementById("lab-host") as HTMLDivElement;
const nav = document.getElementById("exhibits") as HTMLElement;
const log = import.meta.env.DEV;
const { scene, animators } = assembleWorld(undefined, { reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });

// índice agrupado por zona, en el orden del catálogo
for (const zone of new Set(EXHIBITS.map((e) => e.zone))) {
  const h = document.createElement("h2");
  h.textContent = ZONE_TITLE[zone];
  const ul = document.createElement("ul");
  for (const e of EXHIBITS.filter((x) => x.zone === zone)) {
    const a = document.createElement("a");
    a.href = `#${e.id}`; a.textContent = e.title; a.dataset.id = e.id;
    const li = document.createElement("li"); li.appendChild(a); ul.appendChild(li);
  }
  nav.append(h, ul);
}

void boot();

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: host, background: ISO_COLORS.sky, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  host.appendChild(app.canvas);
  app.ticker.maxFPS = 30;

  let stage: Stage | null = null, current: Exhibit | null = null, bloom: BloomProbe | null = null;
  const fit = (): void => {
    if (!stage || !current || current.kind !== "region") return;
    const f = fitTransform(boxFrame(current.box, current.h), host.clientWidth, host.clientHeight);
    stage.container.position.set(f.x, f.y);
    stage.container.scale.set(f.scale);
  };
  const show = (e: Exhibit): void => {
    if (e.kind !== "region") return; // en este hijo EXHIBITS solo tiene regiones; las piezas llegan con #94
    const mode = stage?.bloom ?? "off";
    stage?.container.destroy({ children: true });
    const t0 = performance.now();
    stage = buildStage(cropScene(scene, e.box), cropAnimators(animators, e.box));
    app.stage.addChild(stage.container);
    if (log) console.info(`[storybook] ${e.id}: primer dibujo ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} polígonos estáticos`);
    stage.setBloom(mode);
    current = e;
    fit();
    for (const a of nav.querySelectorAll<HTMLAnchorElement>("a")) a.toggleAttribute("aria-current", a.dataset.id === e.id) && a.setAttribute("aria-current", "page");
  };
  const fromHash = (): void => {
    const e = pickExhibit(location.hash);
    if (location.hash !== `#${e.id}`) history.replaceState(null, "", `#${e.id}`);
    show(e);
  };
  fromHash();
  window.addEventListener("hashchange", fromHash);
  app.renderer.on("resize", fit);
  // diferido como en page.ts, sobre el primer stage; los siguientes heredan el modo en show()
  // attachBloom guarda el stage y aplica el veredicto más tarde: se le pasa el vigente, no el primero (que se destruye al cambiar)
  const live = { get bloom() { return stage!.bloom; }, setBloom(m: BloomMode) { stage!.setBloom(m); } };
  scheduleIdle(() => { bloom = attachBloom({ app, stage: live, log, prefix: "storybook", force: bloomFromSearch(location.search) }); });

  const NEXT = new Set(["ArrowRight", "ArrowDown", "j"]), PREV = new Set(["ArrowLeft", "ArrowUp", "k"]);
  window.addEventListener("keydown", (ev) => {
    if (current && (NEXT.has(ev.key) || PREV.has(ev.key))) { ev.preventDefault(); location.hash = stepExhibit(current.id, NEXT.has(ev.key) ? 1 : -1).id; }
    if (ev.key === "6" && stage) { stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[storybook] bloom: ${stage.bloom}`); }
  });

  const speed = Number(new URLSearchParams(location.search).get("speed")) || 1;
  let worst = 0, since = 0;
  app.ticker.add((ticker) => {
    if (!stage) return;
    const t = performance.now();
    stage.tick(ticker.deltaMS * speed);
    const dt = performance.now() - t;
    bloom?.tick(dt);
    worst = Math.max(worst, dt);
    since += ticker.deltaMS;
    if (log && since > 5000) { console.info(`[storybook] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
  });
}
```

Detalles a respetar: `aria-current="page"` solo en el enlace del exhibit actual (escribirlo claro: `if (a.dataset.id === e.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");`). El adaptador `live` hace que el veredicto del bloom caiga sobre el stage vigente aunque se haya cambiado de exhibit durante la medición. `npm run typecheck` limpio.
- [ ] **Step 4:** `npm test` y `npm run typecheck` → verdes.
- [ ] **Step 5: verificación visual** — `npm run dev -- --host --port 5173` y agent-browser (viewport 1600 900 2) sobre `http://localhost:5173/lab/storybook.html` (`vite.config.ts` tiene `base: "/"`; si responde 404 probar `/map/lab/storybook.html` como dice `CLAUDE.md`): ver `.scratch/evals-92.md`. Capturas de dos exhibits para el PR. Confirmar que `lab/world.html` se ve igual que en `main`.
- [ ] **Step 6:** `git add lab/storybook.html src/lab/storybook.ts src/lab/lab-excluded.test.ts && git commit -m "feat(#92): página del storybook con índice, hash y flechas"`

## Fuera de alcance (otros hijos de #91)

Catálogo completo y test de no-vacío del catálogo entero (#93), exhibits de pieza y `pieceScene` (#94), lectura y `readout` (#95), `setLayer` y teclas `g`/`h`/`a` (#96), README y estado de la spec (#97).

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas y declaradas (van a la descripción del PR):

- Terreno recortado por triángulo (alternativa descartada: por `bounds` del sólido entero, que conserva todo el terreno del mundo).
- Memo solo para terreno y reclamos (`cropShared`); capas animadas sin memo (alternativa descartada: memo general, que devuelve destellos viejos).
- Adaptador `live` para `attachBloom` (alternativa descartada: volver a llamar `attachBloom` por exhibit, que remediría y la spec dice "sin volver a medir").
- `URIError` del hash = hash desconocido (alternativa descartada: dejar propagar la excepción en `hashchange`).
- Navegación circular en los extremos (alternativa descartada: quedarse quieto).
- `Box` en `src/world/frame.ts` (alternativa descartada: en `exhibits.ts`, que haría importar `src/lab/` desde `src/world/`).

## Grilling

Dos rondas (griller `fable`), 16 + 16 preguntas.

**Ronda 1.** Fuentes: ISSUE 4, CODE 10, DOC 1, NO SOURCE 3 (todas técnicas). Cambios: memo partido en `cropSolid`/`cropShared` (`water-anim.ts:113` reasigna `glintSolids[k].tris` en el mismo objeto); adaptador `live` para `attachBloom` (`bloom-runtime.ts:15,39` guarda el stage y aplica el veredicto después); `URIError` del hash como desconocido; restricción de colores precisada (`palette-guard.test.ts` mira solo `0x…` en `src/**/*.ts`); URL del dev server con `base: "/"` (`vite.config.ts:4`).

**Ronda 2.** Fuentes: ISSUE 3, CODE 11, DOC 1, NO SOURCE 1 (técnica: coste por tick del recorte del agua → `triOverlaps` sin arrays; solo se recortan las capas que `tick` marca, una banda de seis cada 150 ms, `water-anim.ts:128-130`). Respuestas clave:
- Criterios de #92 → tareas: archivos y `lab-excluded` (T5), `crop.test.ts` (T2–T3), `frame.test.ts` (T1), cuatro regiones animadas (T4 + capturas T5), `npm test`/`typecheck` (todas).
- Variante `piece` del tipo: ISSUE "tipo `Exhibit` con `kind: "region"` … y `kind: "piece"` (`build`); en este hijo solo entradas `region`".
- Descarte de animadores sin contenido inicial: spec §4 "Si ninguna capa del animador tiene contenido dentro de la caja en su estado inicial, el animador se descarta". En el faro sobrevive el animador del mar por `sea.beam` (`sea-animator.ts:9`); los barcos se filtran por tick.
- Humo con contenido inicial: `factory-anim.ts:9-10,26` (bocanadas escalonadas en el frame 0); deriva `NNE = { x: 0.45, y: -0.893 }` (`factory-anim.ts:18`); `PUFF_LIFT` es z por unidad recorrida (`factory-anim.ts:14`).
- `buildStage` no muta sólidos: arma listas nuevas (`render-list.ts` `buildRenderList`); `drawLayer` con lista vacía no dibuja; la espuma vacía no llega a `bounds`.
- `Stage` no registra listeners ni texturas propias: el filtro del bloom vive en `bloomSlot`, hijo del contenedor (`stage.ts:122-160`); `container.destroy({ children: true })` lo libera.
- `AnimLayer` tiene tres variantes (`animator.ts:9-13`); `ZonedAnimator = Animator & { zone: WorldZone | null }` (`assemble.ts:16`), `claims?: readonly Solid[]` (`animator.ts:17`).
- `assembleWorld(zones | undefined, { reducedMotion })` (`assemble.ts:22`) ya corre bajo Vitest en `assemble.test.ts`; `BLEED = { x, y }` (`geo.ts:28`).
- Comandos: `.factory/config.toml` `test = "npm test"`, `lint = "npm run typecheck"`.
- `zoneFrame` tras delegar: lo fijan los tests existentes de mínimos/máximos exactos (`frame.test.ts` describe `zoneFrame`) y `coverFrame` contiene a `zoneFrame("all")`.

Supuestos: ver `## Assumptions`. Issues abiertos: ninguno.
