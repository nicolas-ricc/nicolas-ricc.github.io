# Storybook 3 (#94): exhibits de pieza — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el índice de `/lab/storybook.html` lista ocho exhibits de pieza (carguero, remolcador, convoy con barcaza, lancha colectiva, grúa torre, farol, campus, selva), cada uno armado en el origen sobre un pad cuadrado de 1 u de espesor, sin terreno ni animadores, y encuadrado por la caja de sus propios sólidos.

**Architecture:** `src/lab/crop.ts` (puro) suma `pieceScene(build, pad)`, que arma un `WorldScene` mínimo con el pad y lo que emite `build`, y `solidsBox(solids)`, que da la caja de mundo y la altura para `boxFrame`. `src/lab/exhibits.ts` (puro) suma las ocho entradas `kind: "piece"`, cada una con un `build` que llama a la función existente (`ship`, `towerCrane`, `lamp`, `campus`, `jungle`) en posición fija. `src/lab/storybook.ts` deja de saltear las piezas: arma `buildStage(pieceScene(...), [])` y encuadra con `solidsBox`.

**Tech Stack:** TypeScript estricto, Vite, PixiJS v8 (solo en la página), Vitest (sin Pixi en los tests).

**Spec:** issue #94 (manda sobre la spec donde difieren); `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` §3 (exhibits de pieza) y §4 (`pieceScene`).

## Global Constraints

- `src/lab/crop.ts` y `src/lab/exhibits.ts` no importan Pixi.
- Todo color sale de `src/map/palette-iso.ts` (`palette-guard.test.ts`); `Math.random` prohibido: el rng de campus y selva sale de `createRng(SEED)` (`src/map/seed.ts`).
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo; sin Pixi en tests.
- Sin dependencias nuevas. Commits `feat(#94): …`.
- `buildStage` sin cambios; `lab/world.html` y el sitio no cambian.
- `npm test` y `npm run typecheck` en verde.

## Decisiones técnicas (declaradas)

1. **Pad.** `pieceScene(build, pad = "paving")`: un prisma cuadrado de 1 u de espesor centrado en el origen, de lado `2 · (r + PAD_M)` con `r` el máximo de `|x|`/`|y|` sobre `bounds` de los sólidos de `build` y `PAD_M = 3` (el mismo margen que las regiones). Así cubre la pieza aunque no esté perfectamente centrada. La cara de arriba queda en `Math.floor(min z)` de los sólidos: 0 para las piezas de tierra, −1 para los barcos (el casco arranca en `WATER_Z = -1`, `ships.ts:27`), así el pad no tapa la obra viva.
2. **Pad de agua para los barcos.** El issue deja elegir `water` para los barcos "si se ve mejor; decidirlo en la captura". El exhibit de pieza lleva `pad?: Material`; los cuatro barcos arrancan con `"water"`. Si en la captura de la Task 3 el agua se ve peor que el `paving`, se cambia a `paving` en `exhibits.ts` y se anota en el PR.
3. **Piezas centradas en el origen.** Barcos con `shipAt(kind, {x:0,y:0}, 0)` (el punto medio de la unidad, empujador incluido, cae en el origen); grúa torre con `at: {x:-8,y:0}` (pluma 24 al este y contrapluma 8 al oeste: −16..16); farol en `(-0.3, -0.3)`; campus de 21×15 con esquina en `(-10.5, -7.5)` sobre la manzana `{x:-12.5, y:-9.5, w:25, d:19}`; selva de 14 conos sobre `{x0:-12, x1:12, y0:-12, y1:12}` con base a z 0.
4. **Campus emite su suelo a `out`.** `campus(out, ground, …)` separa suelo (baldosas `leafDark`, sendas) y sólidos; `build(out, accents)` tiene un solo arreglo, así que se le pasa `out` dos veces. `buildStage` ya mezcla `terrain.ground`, `scene.ground` y `scene.solids` en una sola lista ordenada (`stage.ts:59`), así que no cambia el dibujo.
5. **Determinismo.** Cada `build` crea su `createRng(SEED)` adentro: llamarlo dos veces da lo mismo (volver a un exhibit lo rearma igual).
6. **Encuadre.** "Encuadrado por la caja de sus propios sólidos": `solidsBox([...scene.ground, ...scene.solids])` incluye el pad, así el pad entero entra en pantalla; `h` es el `max z` (lo que sube en la esquina norte de `boxFrame`). Se calcula una vez por exhibit en `show()` y `fit()` lo reutiliza en `resize`.
7. **Orden del índice.** Las piezas van detrás de las regiones de su zona: grúa torre y farol tras la noria (Portfolio: astillero), campus y selva tras la torre (Resume: ciudad), los cuatro barcos tras el faro (Blog). `storybook.ts` agrupa por zona en orden de aparición, así que el índice queda por zona aunque #93 sume regiones.
8. **Capturas.** Como en #92, las capturas del convoy y de la grúa torre se commitean en `docs/superpowers/specs/assets/94-storybook/` y el PR las enlaza con `?raw=true`.

## Review Focus

1. Volver a un exhibit de pieza (hash o flechas) lo rearma idéntico: `build` determinista (test en Task 2: dos llamadas, mismo resultado).
2. Barco sobre el pad: el pad no tapa el casco (cara de arriba en −1, no en 0) (test en Task 1 con un sólido a z −1).
3. Una pieza que no está centrada en el origen (grúa torre) queda entera sobre el pad (test en Task 1: el pad contiene los `bounds` de un sólido descentrado).
4. Las flechas recorren regiones y piezas mezcladas sin saltear ninguna (`stepExhibit` ya cubierto; verificación en el navegador, Task 3).
5. Cambiar de una pieza a una región y volver no deja stages huérfanos ni rompe el bloom (`app.stage.children.length === 1`, Task 3, agent-browser).

---

### Task 1: `pieceScene` y `solidsBox` en `src/lab/crop.ts`

**Files:**
- Modify: `src/lab/crop.ts`
- Test: `src/lab/crop.test.ts`

**Interfaces:**
- Produces:
  - `export function pieceScene(build: (out: Solid[], accents: Accent[]) => void, pad: Material = "paving"): WorldScene`
  - `export function solidsBox(solids: readonly Solid[]): { box: Box; h: number }`

- [ ] **Step 1: tests que fallan** (los escribe la etapa de evals; verificar que estén) — agregar a `crop.test.ts` (importar `pieceScene`, `solidsBox` y `bounds` de `../iso/solids`):

```ts
describe("pieceScene", () => {
  const lamp: Accent = { kind: "dot", at: v3(1, 1, 6), r: 1, color: "amber" };
  const scene = pieceScene((out, accents) => { out.push(prism(-1, -1), prism(6, 0)); accents.push(lamp); });

  it("sin terreno, subescenas en null y landmarks en el origen", () => {
    expect(scene.terrain.ground).toEqual([]);
    expect(scene.terrain.bleed).toEqual([]);
    expect(scene.terrain.water).toEqual([]);
    expect(scene.terrain.foam).toMatchObject({ kind: "ground", mat: "foam", tris: [] });
    for (const k of ["shipyard", "city", "factory", "sea", "hinterland", "tech", "fair"] as const) expect(scene[k]).toBeNull();
    for (const p of Object.values(scene.landmarks)) expect(p).toEqual(v3(0, 0, 0));
  });
  it("los sólidos y acentos de build, y un pad de paving de 1 u centrado en el origen", () => {
    expect(scene.solids).toEqual([prism(-1, -1), prism(6, 0)]);
    expect(scene.accents).toEqual([lamp]);
    expect(scene.ground).toHaveLength(1);
    const pad = scene.ground[0] as Solid & { kind: "prism" };
    expect(pad).toMatchObject({ kind: "prism", mat: "paving", h: 1 });
    expect(pad.w).toBe(pad.d);
    expect(pad.at.x + pad.w / 2).toBeCloseTo(0);
    expect(pad.at.y + pad.d / 2).toBeCloseTo(0);
    expect(pad.at.z + pad.h).toBe(0); // cara de arriba al nivel de las piezas de tierra
  });
  it("el pad contiene a una pieza descentrada", () => {
    const b = bounds(scene.ground[0]!);
    for (const s of scene.solids) {
      const sb = bounds(s);
      expect(b.min.x).toBeLessThan(sb.min.x); expect(b.max.x).toBeGreaterThan(sb.max.x);
      expect(b.min.y).toBeLessThan(sb.min.y); expect(b.max.y).toBeGreaterThan(sb.max.y);
    }
  });
  it("un barco a z −1 va sobre agua y el pad no le tapa el casco", () => {
    const boat = { kind: "prism", at: v3(-2, -1, -1), w: 4, d: 2, h: 2, mat: "hull" } as Solid;
    const s = pieceScene((out) => { out.push(boat); }, "water");
    const pad = s.ground[0] as Solid & { kind: "prism" };
    expect(pad.mat).toBe("water");
    expect(pad.at.z + pad.h).toBe(-1);
  });
});

describe("solidsBox", () => {
  it("caja en x/y de todos los sólidos y h el z más alto", () => {
    const { box, h } = solidsBox([prism(-3, 1), prism(4, -2, 4)]);
    expect(box).toEqual({ x0: -3, y0: -2, x1: 8, y1: 3 });
    expect(h).toBe(3);
  });
});
```

(`prism(x, y, w = 2)` del archivo arma un prisma de alto 3 desde z 0.)

- [ ] **Step 2:** `npx vitest run src/lab/crop.test.ts` → FAIL (`pieceScene` / `solidsBox` no existen).
- [ ] **Step 3: implementación** — en `crop.ts` (agregar imports `v3` de `../iso/geometry`, `Material` de `../map/palette-iso`):

```ts
const PAD_M = 3; // margen del pad alrededor de la pieza, el mismo que el de las regiones

/** Caja en x/y y z más alto de un conjunto de sólidos: el encuadre de una pieza. */
export function solidsBox(solids: readonly Solid[]): { box: Box; h: number } {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  let h = -Infinity;
  for (const s of solids) {
    const { min, max } = bounds(s);
    box.x0 = Math.min(box.x0, min.x); box.y0 = Math.min(box.y0, min.y);
    box.x1 = Math.max(box.x1, max.x); box.y1 = Math.max(box.y1, max.y);
    h = Math.max(h, max.z);
  }
  return { box, h };
}

/**
 * Una pieza sola: lo que emite `build`, armado en el origen, sobre un pad
 * cuadrado de 1 u de espesor centrado en el origen que la cubre con margen.
 * La cara de arriba del pad va al piso de la pieza (−1 para los barcos, que
 * flotan en `WATER_Z`). Sin terreno ni subescenas: el stage no las lee.
 */
export function pieceScene(build: (out: Solid[], accents: Accent[]) => void, pad: Material = "paving"): WorldScene {
  const solids: Solid[] = [], accents: Accent[] = [];
  build(solids, accents);
  let r = 0, floor = Infinity;
  for (const s of solids) {
    const { min, max } = bounds(s);
    r = Math.max(r, -min.x, max.x, -min.y, max.y);
    floor = Math.min(floor, min.z);
  }
  const half = r + PAD_M, top = Math.floor(floor);
  const origin = v3(0, 0, 0);
  return {
    terrain: { ground: [], bleed: [], water: [], foam: { kind: "ground", mat: "foam", tris: [] } },
    ground: [{ kind: "prism", at: v3(-half, -half, top - 1), w: 2 * half, d: 2 * half, h: 1, mat: pad }],
    solids,
    accents,
    landmarks: { portfolio: origin, cv: origin, blog: origin },
    shipyard: null, city: null, factory: null, sea: null, hinterland: null, tech: null, fair: null,
  };
}
```

- [ ] **Step 4:** `npx vitest run src/lab/crop.test.ts` → PASS; `npm run typecheck` limpio.
- [ ] **Step 5:** `git add src/lab/crop.ts src/lab/crop.test.ts && git commit -m "feat(#94): pieceScene y solidsBox"`

---

### Task 2: las ocho piezas en `src/lab/exhibits.ts`

**Files:**
- Modify: `src/lab/exhibits.ts`
- Test: `src/lab/exhibits.test.ts`

**Interfaces:**
- Consumes: nada de la Task 1 (el tipo de `build` es el mismo, escrito en `Exhibit`).
- Produces: la variante `{ kind: "piece"; build: (out: Solid[], accents: Accent[]) => void; pad?: Material }` de `Exhibit`; ocho entradas con ids `grua-torre`, `farol`, `campus`, `selva`, `carguero`, `remolcador`, `convoy`, `lancha`.

- [ ] **Step 1: tests que fallan** (los escribe la etapa de evals) — agregar a `exhibits.test.ts`:

```ts
const pieces = EXHIBITS.flatMap((e) => (e.kind === "piece" ? [e] : []));

describe("exhibits de pieza", () => {
  it("las ocho piezas, cada una en su zona", () => {
    expect(Object.fromEntries(pieces.map((e) => [e.id, e.zone]))).toEqual({
      "grua-torre": "portfolio", farol: "portfolio",
      campus: "cv", selva: "cv",
      carguero: "blog", remolcador: "blog", convoy: "blog", lancha: "blog",
    });
  });
  it("cada pieza emite al menos un sólido", () => {
    for (const e of pieces) {
      const out: Solid[] = [], accents: Accent[] = [];
      e.build(out, accents);
      expect(out.length, e.id).toBeGreaterThan(0);
    }
  });
  it("armar dos veces la misma pieza da lo mismo", () => {
    for (const e of pieces) {
      const a: Solid[] = [], b: Solid[] = [], aa: Accent[] = [], ba: Accent[] = [];
      e.build(a, aa); e.build(b, ba);
      expect(b, e.id).toEqual(a);
      expect(ba, e.id).toEqual(aa);
    }
  });
});
```

(imports de tipos: `Accent` de `../iso/accent`, `Solid` de `../iso/solids`.)

- [ ] **Step 2:** `npx vitest run src/lab/exhibits.test.ts` → FAIL (no hay piezas).
- [ ] **Step 3: implementación** — en `exhibits.ts`:
  - el tipo: `| { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void; pad?: Material }` (y el comentario del tipo menciona el pad).
  - imports: `createRng, SEED` de `../map/seed`; `Material` de `../map/palette-iso`; `campus, lamp` de `../scenes/city-pieces`; `jungle` de `../scenes/flora`; `towerCrane` de `../scenes/pieces`; `ship, shipAt, type ShipKind` de `../scenes/ships`.
  - helper:

```ts
// un barco con el punto medio de la unidad (empujador incluido) en el origen, a flote sobre agua
const vessel = (kind: ShipKind) => (out: Solid[], accents: Accent[]): void => {
  const { solids, lights } = ship(kind, shipAt(kind, { x: 0, y: 0 }, 0), 0);
  out.push(...solids); accents.push(...lights);
};
```

  - entradas, intercaladas tras la región de su zona (orden final: chimeneas, noria, grua-torre, farol, torre, campus, selva, faro, carguero, remolcador, convoy, lancha):

```ts
  // pluma 24 al este y contrapluma 8 al oeste: con el mástil en x −8 queda en −16..16
  { id: "grua-torre", title: "Grúa torre", zone: "portfolio", kind: "piece",
    build: (out, accents) => towerCrane(out, accents, { at: { x: -8, y: 0 }, mastH: 20, jibLen: 24, dir: "e", light: "amber" }) },
  { id: "farol", title: "Farol", zone: "portfolio", kind: "piece", build: (out, accents) => { lamp(out, accents, -0.3, -0.3, 0); } },
  // patio 9×9 entre tres edificios de 6: 21×15; el suelo de la manzana va a `out` con los sólidos
  { id: "campus", title: "Campus", zone: "cv", kind: "piece",
    build: (out, accents) => campus(out, out, accents, createRng(SEED), { x: -12.5, y: -9.5, w: 25, d: 19 }, -10.5, -7.5, 21, 15) },
  { id: "selva", title: "Selva", zone: "cv", kind: "piece", build: (out) => jungle(out, createRng(SEED), { x0: -12, x1: 12, y0: -12, y1: 12 }, 14, 0) },
  { id: "carguero", title: "Carguero", zone: "blog", kind: "piece", build: vessel("cargo"), pad: "water" },
  { id: "remolcador", title: "Remolcador", zone: "blog", kind: "piece", build: vessel("tug"), pad: "water" },
  { id: "convoy", title: "Convoy con barcaza", zone: "blog", kind: "piece", build: vessel("barge"), pad: "water" },
  { id: "lancha", title: "Lancha colectiva", zone: "blog", kind: "piece", build: vessel("ferry"), pad: "water" },
```

- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts` → PASS; `npm test` y `npm run typecheck` verdes (`palette-guard`, `pixi-free` incluidos).
- [ ] **Step 5:** `git add src/lab/exhibits.ts src/lab/exhibits.test.ts && git commit -m "feat(#94): exhibits de pieza en el catálogo"`

---

### Task 3: la página muestra las piezas

**Files:**
- Modify: `src/lab/storybook.ts`
- Create: `docs/superpowers/specs/assets/94-storybook/convoy.png`, `docs/superpowers/specs/assets/94-storybook/grua-torre.png`

**Interfaces:**
- Consumes: `pieceScene`, `solidsBox` (Task 1); entradas `kind: "piece"` con `build` y `pad?` (Task 2).

- [ ] **Step 1:** en `storybook.ts`:
  - importar `pieceScene, solidsBox` de `./crop` y `type Box` de `../world/frame`.
  - reemplazar `current.kind !== "region"` en `fit` por un encuadre guardado por exhibit: `let frame: { box: Box; h?: number } | null = null;` y `fit` usa `fitTransform(boxFrame(frame.box, frame.h), …)` si `stage && frame`.
  - en `show(e)`: borrar el `return` para piezas y armar según el tipo:

```ts
    if (e.kind === "region") {
      // la misma caja a ambos: el memo del recorte se indexa por identidad de Box
      stage = buildStage(cropScene(scene, e.box), cropAnimators(animators, e.box));
      frame = { box: e.box, h: e.h };
    } else {
      // pieza: armada en el origen sobre su pad, sin terreno ni animadores
      const piece = pieceScene(e.build, e.pad);
      stage = buildStage(piece, []);
      frame = solidsBox([...piece.ground, ...piece.solids]);
    }
```

  - comentario del encabezado: "un exhibit a la vez, recortado del mundo por su caja o armado solo en el origen (piezas)".
- [ ] **Step 2:** `npm test` y `npm run typecheck` → verdes.
- [ ] **Step 3: verificación visual** — `npm run dev -- --host --port 5173`; agent-browser (viewport 1600 900 2, ver `CLAUDE.md`) según `.scratch/evals-94.md`: las ocho piezas aparecen en el índice bajo su zona y cada una dibuja algo (DevTools: `rendering.capture().totals` con `graphics > 0` y sin errores en consola); `#convoy` y `#grua-torre` capturados a `docs/superpowers/specs/assets/94-storybook/`. Mirar el pad de agua de los barcos: si se ve peor que `paving`, cambiar `pad` en `exhibits.ts` (Decisión 2). Pieza → región → pieza deja `app.stage.children.length === 1`. `lab/world.html` se ve como antes.
- [ ] **Step 4:** `git add src/lab/storybook.ts docs/superpowers/specs/assets/94-storybook && git commit -m "feat(#94): el storybook muestra los exhibits de pieza"`

## Fuera de alcance (otros hijos de #91)

Catálogo completo de regiones (#93), lectura y `readout` (#95), `setLayer` y teclas `g`/`h`/`a` (#96), README y estado de la spec (#97). Recetas del kit (#39..#42): `pieceScene` es el gancho, no se adelantan.

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas y declaradas (van a la descripción del PR): pad de lado `2·(r+3)` con la cara de arriba en `floor(min z)`; `pad?: Material` por exhibit con agua para los barcos; posiciones fijas que centran cada pieza en el origen; campus con su suelo en `out`; `createRng(SEED)` dentro de cada `build`; encuadre con el pad incluido.
