# Viga inclinada para plumas y estays (#78): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un sólido nuevo del motor iso, `beam`: una viga recta entre dos puntos 3D con sección rectangular nivelada. El carguero lo usa para sus dos plumas (una viga por pluma, en vez de tres cajas escalonadas) y para un estay fino por grúa.

**Architecture:** `beam` es una variante más de `Solid` (`src/iso/solids.ts`) y se tesela en `tessellateAll` como un prisma de 8 vértices y 6 caras, con `face()` (normales hacia afuera, tono por `shadeTone`). `bounds`, `sortByDepth` (también `worldAndFrameBounds`, el marco girado de un barco) y `shadowPolygon` leen los vértices de `tessellateAll`, así que la soportan sin código propio. Los tests de esos consumidores lo fijan. El kit de barcos (`src/scenes/ships.ts`) gana `beam(from, to, w, h, mat)` en coordenadas locales. El storybook (`src/lab/exhibits.ts`) suma un exhibit de pieza `viga`.

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (solo para las capturas).

**Spec:** issue #78, el segundo Agent Brief (comentario de triage). Vocabulario: **pluma** es el brazo inclinado de la grúa de cubierta y **estay** el cable tenso de la cabina a la punta de la pluma.

## Global Constraints

- "Un `kind` nuevo de `Solid`: una viga definida por dos puntos 3D (desde, hasta) y una sección cuadrada o rectangular (ancho y alto), con material. La sección se mantiene nivelada alrededor del eje, sin torcerse."
- "El motor la teselará en caras con sombreado coherente con el resto (tapa, lados iluminados y en sombra según su normal). La incluye en `bounds`, en el orden de profundidad, también en el marco girado de un barco, y en las sombras proyectadas."
- "Las dos plumas del carguero pasan a ser una viga cada una, de la cabina a la punta, con la misma inclinación y largo aproximados de hoy. Cada grúa gana un estay: una viga fina, de sección mucho menor que la pluma, de lo alto de la cabina a la punta de la pluma."
- "En el presupuesto de sólidos por barco, cada pluma cuenta como un sólido en vez de tres." El carguero pasa de 39 a 37 sólidos: −4 por las plumas, +2 por los estays.
- "La viga aparece en el lab como pieza inspeccionable, sola y sobre el carguero."
- Fuera de alcance: "Plumas o vigas en otros barcos, en las grúas torre o en la grúa pórtico", "Secciones redondas", "Cables con catenaria o vigas curvas".
- `npm test` y `npm run typecheck` en verde. Textos, comentarios y nombres de test en castellano, como el resto del repo. Commits `feat(#78): …`, `test(#78): …`, `docs(#78): …`.

## Datos medidos (main be29968)

- `ship("cargo", …)` tiene hoy **39** sólidos (presupuesto 40). Cada grúa: pedestal `cyl(dx, −3.9, deck, 0.5, 3)`, cabina `box(dx − 0.6, −4.5, 1.2, 1.2, deck + 3, 1)` (z de deck+3 a deck+4) y tres cajas `box(dx + 0.6 + 1.5i, −4.1, 1.8, 0.4, deck + 3.5 + 1.5i, 1.5)`. `deck` = 4, `dx` ∈ {25.3, 36.5}. La escalera va de (dx+0.6, deck+3.5) a (dx+5.4, deck+8): unos 4.8 u de avance por 4.5 de subida, 45°.
- Con la escalera de hoy, a 72 rumbos (cada 5°) la primera caja de la pluma sale **antes** que su cabina de 140° a 230° y más: arranca a deck+3.5, dentro del alto de la cabina, así que sus cajas se solapan en los tres ejes y decide la clave. La viga nueva arranca sobre el techo de la cabina (separada en z), así que la cabina queda siempre detrás. El barrido de #74 no está en `main` (#74 sigue abierto), así que el test de orden se escribe aquí.
- `restsOnHull` (`src/iso/depth.ts`) pone el casco antes de toda pieza con `min.z ≥` cubierta de crujía. La pluma y el estay quedan muy por encima.

## Decisiones de diseño (declaradas)

- **Forma:** `{ kind: "beam"; from: Vec3; to: Vec3; w: number; h: number; mat: Material }`. `w` es el ancho (lado horizontal de la sección) y `h` el alto (lado perpendicular a `w` y al eje).
- **Sección nivelada:** eje `u = (to − from)/|to − from|`. Lado `side = (−u.y, u.x, 0)/|…|` (horizontal, perpendicular al eje en planta). Arriba `up = u × side` (con z ≥ 0 si el eje no es vertical). Si el eje es vertical (`|(u.x, u.y)| < 1e-9`), `side = (0, 1, 0)`. Si el largo es 0, `u = (1, 0, 0)`: queda una placa degenerada con bounds finitos y sin NaN.
- **Caras:** dos tapas (los 4 vértices de cada extremo) y cuatro lados (cuadriláteros entre los dos anillos). Todas con `face(pts, mat, c)`, con `c` el punto medio, así que la normal sale hacia afuera y el tono sale de `shadeTone`. Ese es el sombreado coherente con el resto.
- **Pluma del carguero** (corregida tras la primera pasada del navegador, ver "Ajuste tras las capturas"): `k.beam([dx + 0.45, −3.9, deck + 4.2], [dx + 4.95, −3.9, deck + 8.7], 0.4, 0.4, "steel")`. Versión original: `k.beam([dx + 0.3, −3.9, deck + 4.2], [dx + 4.8, −3.9, deck + 8.7], 0.4, 0.5, "steel")`: 45°, 6.36 u de largo (hoy unos 6.6), en crujía de la cabina (y −3.9). La arista baja del talón queda a deck + 4.2 − 0.25·√½ ≈ deck + 4.02, apenas sobre el techo de la cabina (deck + 4). El tope queda a ≈ 12.88 (< 13, el techo de altura del test del carguero).
- **Estay:** `k.beam([dx − 0.5, −3.9, deck + 4.05], [dx + 4.8, −3.9, deck + 8.7], 0.1, 0.1, "steel")`, de la parte de atrás del techo de la cabina a la punta de la pluma. La sección es 0.1 × 0.1, contra 0.4 × 0.5 de la pluma. Sube a unos 41°, un poco más tendido que la pluma, así que en pantalla se abren desde la punta como un triángulo fino.
- **Exhibit `viga`:** pieza del grupo `mar` (zona `blog`), justo antes de `carguero`. Una viga `steel` de (−3, −1.5, 0.5) a (3, 1.5, 6.5), w 0.8, h 1 (levantada 0.5 para que ningún vértice quede bajo el pad, en z 0), girada en planta y en alto a la vez, para que se vea que la sección no se tuerce. "Sobre el carguero" lo da el exhibit `carguero`, que ya existe.

## Ajuste tras las capturas

En la primera pasada del navegador, la pluma se leía recta a rumbo 0 y a 57°, pero el estay casi no se veía. Iba en el mismo plano vertical que la pluma (y −3.9) con apenas 5° de diferencia: a rumbo 0 lo tapaba la pluma, de 0.5 de alto, y a 57° ese plano se ve casi de canto. El ajuste:
- La pluma pasa a 0.4 × 0.4, con talón en dx + 0.45 y punta en dx + 4.95. Sigue a 45° y con el mismo largo (6.36).
- El estay sale de la esquina interior de atrás del techo de la cabina, `[dx − 0.5, −3.45, deck + 4.05]`, y llega a la misma punta. El desplazamiento a lo largo de la eslora lo separa a rumbos donde el plano de la pluma se ve de frente. El desplazamiento hacia crujía lo separa a rumbos donde se ve de canto. Los dos forman una V fina que se cierra en la punta.

## Review Focus

1. Viga vertical (eje paralelo a z): sin NaN, sección de `w` sobre y y `h` sobre x, bounds de una caja. Lo pinea la Tarea 1.
2. Viga de largo cero: `tessellate`, `bounds`, `shadowPolygon` y `sortByDepth` no tiran ni dan NaN. Lo pinean las Tareas 1 y 2.
3. Viga bajando (`to.z < from.z`) o con el eje invertido (`from` y `to` intercambiados): mismas caras y mismos bounds que la original. Lo pinea la Tarea 1.
4. Barco girado: el estay también sale después de la cabina a los 72 rumbos (arranca sobre su techo). Lo pinea la Tarea 3.
5. Sombra de la pluma flotando sobre el agua: el polígono existe y contiene la proyección de la punta. Lo pinea la Tarea 2.

---

### Task 1: el sólido `beam` en el motor

**Files:**
- Modify: `src/iso/solids.ts` (unión `Solid`, función `beam`, `tessellateAll`)
- Test: `src/iso/solids.test.ts`

**Interfaces:**
- Produces: variante de `Solid` `{ kind: "beam"; from: Vec3; to: Vec3; w: number; h: number; mat: Material }`. `tessellateAll(beam)` devuelve 6 caras (2 tapas y 4 lados). `bounds(beam)` es la caja de sus 8 vértices.

- [ ] **Step 1: tests que fallan** (agregar al final de `src/iso/solids.test.ts`; importar `bounds`, `tessellateAll`, `tessellate`, `type Solid` de `./solids`, `shadeTone` de `./light` y `v3`, `dot`, `type Vec3` de `./geometry` si no están ya)

```ts
describe("viga (beam)", () => {
  const beam = (from: Vec3, to: Vec3, w: number, h: number): Solid => ({ kind: "beam", from, to, w, h, mat: "steel" });
  const corners = (s: Solid) => tessellateAll(s).flatMap((f) => f.pts);
  const finite = (s: Solid) => corners(s).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

  it("horizontal: los bounds coinciden con los de la caja equivalente", () => {
    const b = bounds(beam(v3(0, 1, 2), v3(4, 1, 2), 2, 1));
    const box = bounds({ kind: "prism", at: v3(0, 0, 1.5), w: 4, d: 2, h: 1, mat: "steel" });
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(box.min[k], 9); expect(b.max[k]).toBeCloseTo(box.max[k], 9); }
  });

  it("a 45°: los bounds son exactamente los de sus 8 vértices, con la sección nivelada", () => {
    const r = Math.SQRT1_2, w = 0.4, h = 0.6;
    // eje (1, 0, 1)/√2; lado (0, 1, 0); arriba (−1, 0, 1)/√2
    const pts: Vec3[] = [];
    for (const e of [v3(0, 0, 0), v3(3, 0, 3)]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      pts.push(v3(e.x - sz * r * h / 2, e.y + sy * w / 2, e.z + sz * r * h / 2));
    const b = bounds(beam(v3(0, 0, 0), v3(3, 0, 3), w, h));
    const ax = (k: "x" | "y" | "z") => pts.map((p) => p[k]);
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(Math.min(...ax(k)), 9); expect(b.max[k]).toBeCloseTo(Math.max(...ax(k)), 9); }
    // nivelada: cada vértice tiene su pareja de la arista de ancho a la misma z y a `w` en planta
    const all = corners(beam(v3(0, 0, 0), v3(3, 2, 3), w, h));
    for (const p of all)
      expect(all.some((q) => Math.abs(q.z - p.z) < 1e-9 && Math.abs(Math.hypot(q.x - p.x, q.y - p.y) - w) < 1e-9)).toBe(true);
  });

  it("teselación: 6 caras planas, cerradas (cada arista la comparten dos caras) y con la normal hacia afuera", () => {
    const s = beam(v3(1, 2, 0.5), v3(4, 0, 5), 0.5, 0.8);
    const faces = tessellateAll(s);
    expect(faces).toHaveLength(6);
    const key = (p: Vec3) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
    const edges = new Map<string, number>();
    const mid = v3(2.5, 1, 2.75);
    for (const f of faces) {
      expect(f.pts).toHaveLength(4);
      for (const p of f.pts) expect(dot(f.normal, v3(p.x - f.pts[0]!.x, p.y - f.pts[0]!.y, p.z - f.pts[0]!.z))).toBeCloseTo(0, 9); // plana
      expect(dot(f.normal, v3(f.pts[0]!.x - mid.x, f.pts[0]!.y - mid.y, f.pts[0]!.z - mid.z))).toBeGreaterThan(0); // hacia afuera
      f.pts.forEach((p, i) => { const q = f.pts[(i + 1) % 4]!; const e = [key(p), key(q)].sort().join("|"); edges.set(e, (edges.get(e) ?? 0) + 1); });
    }
    expect(edges.size).toBe(12);
    for (const n of edges.values()) expect(n).toBe(2);
  });

  it("sombreado coherente: la cara de arriba de una viga horizontal es 'top' y las visibles salen por tessellate", () => {
    const faces = tessellateAll(beam(v3(0, 0, 1), v3(4, 0, 1), 1, 1));
    expect(faces.filter((f) => f.tone === "top")).toHaveLength(1);
    expect(tessellate(beam(v3(0, 0, 1), v3(4, 0, 1), 1, 1)).every((f) => f.mat === "steel")).toBe(true);
  });

  it("invertir from/to da los mismos bounds; una viga que baja también", () => {
    const a = bounds(beam(v3(0, 0, 0), v3(3, 1, 3), 0.4, 0.6)), b = bounds(beam(v3(3, 1, 3), v3(0, 0, 0), 0.4, 0.6));
    for (const k of ["x", "y", "z"] as const) { expect(b.min[k]).toBeCloseTo(a.min[k], 9); expect(b.max[k]).toBeCloseTo(a.max[k], 9); }
  });

  it("vertical: sección w sobre y, h sobre x, sin NaN", () => {
    const s = beam(v3(0, 0, 0), v3(0, 0, 5), 2, 1);
    expect(finite(s)).toBe(true);
    const b = bounds(s);
    expect(b.max.y - b.min.y).toBeCloseTo(2, 9); expect(b.max.x - b.min.x).toBeCloseTo(1, 9); expect(b.max.z - b.min.z).toBeCloseTo(5, 9);
  });

  it("largo cero no rompe: vértices y bounds finitos, tessellate no tira", () => {
    const s = beam(v3(1, 1, 1), v3(1, 1, 1), 0.4, 0.4);
    expect(finite(s)).toBe(true);
    const b = bounds(s);
    for (const k of ["x", "y", "z"] as const) { expect(Number.isFinite(b.min[k])).toBe(true); expect(Number.isFinite(b.max[k])).toBe(true); }
    expect(() => tessellate(s)).not.toThrow();
    for (const f of tessellateAll(s)) expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
  });

  it("a 45°: cada cara lleva el tono que shadeTone da a su normal; la cara de arriba es vertiente", () => {
    const faces = tessellateAll(beam(v3(0, 0, 4), v3(4.5, 0, 8.5), 0.4, 0.5));
    for (const f of faces) expect(f.tone).toBe(shadeTone(f.normal));
    expect(faces.some((f) => f.tone === "up" || f.tone === "down")).toBe(true);
  });
});
```

- [ ] **Step 2: correr y ver que falla.** `npx vitest run src/iso/solids.test.ts`. Esperado: FAIL (o error de tipos de `kind: "beam"`; vitest no chequea tipos, así que los bounds dan ±Infinity y `tessellateAll` devuelve `undefined`).

- [ ] **Step 3: implementación** en `src/iso/solids.ts`.

Agregar a la unión `Solid`:

```ts
  | { kind: "beam"; from: Vec3; to: Vec3; w: number; h: number; mat: Material }
```

Función nueva (junto a `cone`):

```ts
/**
 * Viga recta de `from` a `to`, sección `w` × `h`: el lado `w` queda horizontal y perpendicular al eje en planta, así que la
 * sección no se tuerce. Eje vertical: `w` sobre y. Largo cero: eje x, una placa degenerada que no rompe bounds ni orden.
 */
function beam(s: Solid & { kind: "beam" }): Face[] {
  const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, dz = s.to.z - s.from.z, len = Math.hypot(dx, dy, dz);
  const u = len === 0 ? v3(1, 0, 0) : v3(dx / len, dy / len, dz / len);
  const plan = Math.hypot(u.x, u.y);
  const side = plan < 1e-9 ? v3(0, 1, 0) : v3(-u.y / plan, u.x / plan, 0);
  const up = v3(u.y * side.z - u.z * side.y, u.z * side.x - u.x * side.z, u.x * side.y - u.y * side.x);
  const ring = (e: Vec3): Vec3[] => ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) =>
    v3(e.x + side.x * a * s.w / 2 + up.x * b * s.h / 2, e.y + side.y * a * s.w / 2 + up.y * b * s.h / 2, e.z + side.z * a * s.w / 2 + up.z * b * s.h / 2));
  const r0 = ring(s.from), r1 = ring(s.to);
  const c = v3((s.from.x + s.to.x) / 2, (s.from.y + s.to.y) / 2, (s.from.z + s.to.z) / 2);
  const out = [face(r0, s.mat, c), face(r1, s.mat, c)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; out.push(face([r0[i]!, r0[j]!, r1[j]!, r1[i]!], s.mat, c)); }
  return out;
}
```

En `tessellateAll`, junto a `case "cone"`:

```ts
    case "beam": return beam(s);
```

- [ ] **Step 4: correr** `npx vitest run src/iso/solids.test.ts` y `npm run typecheck`. Esperado: PASS los dos. Si el typecheck marca un `switch` exhaustivo en otro archivo, agregar ahí el caso `beam`.

- [ ] **Step 5: commit.** `git add src/iso/solids.ts src/iso/solids.test.ts && git commit -m "feat(#78): sólido beam, viga recta entre dos puntos"`

### Task 2: sombra y orden de profundidad de la viga

**Files:**
- Test: `src/iso/light.test.ts`, `src/iso/depth.test.ts`
- Modify (solo si un test falla): `src/iso/light.ts`, `src/iso/depth.ts`

**Interfaces:**
- Consumes: `Solid` `kind: "beam"` de la Tarea 1.
- Produces: la garantía, fijada en tests, de que `shadowPolygon` y `sortByDepth` (con y sin `heading`) soportan `beam`.

- [ ] **Step 1: tests.** En `src/iso/light.test.ts`:

```ts
describe("sombra de la viga", () => {
  it("una pluma flotando proyecta sombra que contiene la proyección de la punta; largo cero no rompe", () => {
    const s: Solid = { kind: "beam", from: v3(0, 0, 4), to: v3(4, 0, 8), w: 0.4, h: 0.5, mat: "steel" };
    const poly = shadowPolygon(s)!;
    expect(poly.length).toBeGreaterThanOrEqual(3);
    const tip = shadowPoint(v3(4, 0, 8));
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    expect(tip.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9); expect(tip.x).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
    expect(tip.y).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-9); expect(tip.y).toBeLessThanOrEqual(Math.max(...ys) + 1e-9);
    const zero = shadowPolygon({ ...s, to: s.from });
    expect(zero!.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});
```

En `src/iso/depth.test.ts`:

```ts
describe("orden de la viga", () => {
  const cab: Solid = { kind: "prism", at: v3(-0.6, -0.6, 3), w: 1.2, d: 1.2, h: 1, mat: "whitewash" };
  const jib = (h: number): Solid => {
    const c = Math.cos(h), s = Math.sin(h), p = (x: number, z: number) => v3(x * c, x * s, z);
    return { kind: "beam", from: p(0.3, 4.2), to: p(4.8, 8.7), w: 0.4, h: 0.5, mat: "steel" };
  };
  it("una pluma apoyada sobre el techo de una caja se dibuja después, en el mundo y en el marco girado", () => {
    expect(sortByDepth([jib(0), cab]).indexOf(cab)).toBe(0);
    for (let k = 0; k < 72; k++) {
      const h = (k * 5 * Math.PI) / 180;
      const c = Math.cos(h), s = Math.sin(h);
      const box: Solid = { kind: "poly", footprint: [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]].map(([x, y]) => ({ x: x! * c - y! * s, y: x! * s + y! * c })), z: 3, h: 1, mat: "whitewash" };
      const j = jib(h);
      expect(sortByDepth([j, box], h).indexOf(box), `rumbo ${k * 5}°`).toBe(0);
    }
  });
  it("largo cero no rompe el orden", () => {
    const z: Solid = { kind: "beam", from: v3(0, 0, 5), to: v3(0, 0, 5), w: 0.4, h: 0.4, mat: "steel" };
    expect(sortByDepth([z, cab])).toHaveLength(2);
    expect(sortByDepth([z, cab], 1.2)).toHaveLength(2);
  });
});
```

(Ajustar imports: `shadowPoint`, `shadowPolygon` de `./light`, `sortByDepth` de `./depth`, `v3` de `./geometry`, `type Solid` de `./solids`, lo que falte en cada archivo.)

- [ ] **Step 2: correr** `npx vitest run src/iso/light.test.ts src/iso/depth.test.ts`. Esperado: PASS sin tocar código, porque los dos consumidores leen `tessellateAll`. Si algo falla, diagnosticar el consumidor (no el test) y corregirlo en `light.ts` o `depth.ts`.

- [ ] **Step 3: commit.** `git add src/iso/light.test.ts src/iso/depth.test.ts && git commit -m "test(#78): sombra y orden de profundidad de la viga"` (sumar los `.ts` si hubo que tocarlos, con `fix(#78): …`).

### Task 3: plumas y estays del carguero

**Files:**
- Modify: `src/scenes/ships.ts` (interfaz `Kit`, `kit()`, el lazo de grúas de `cargo`)
- Test: `src/scenes/ships.test.ts` (reemplazar el test "dos grúas en babor…" y agregar conteo y orden)

**Interfaces:**
- Consumes: `kind: "beam"` (Tarea 1); `sortByDepth(solids, heading)` de `src/iso/depth.ts`.
- Produces: `Kit.beam(from: [number, number, number], to: [number, number, number], w: number, h: number, mat: Material) => Solid`, con `from`/`to` en coordenadas locales del barco `(dx, dy, z)`.

- [ ] **Step 1: tests.** En `src/scenes/ships.test.ts`, reemplazar el `it("dos grúas en babor: pedestal, cabina y pluma de tres tramos subiendo a 45° hacia proa", …)` por:

```ts
  it("dos grúas en babor: pedestal, cabina, pluma de una viga a 45° hacia proa y estay fino de la cabina a la punta", () => {
    const pedestals = s.solids.flatMap((x) => (x.kind === "cylinder" && x.r === 0.5 && x.h === 3 ? [x] : []));
    expect(pedestals).toHaveLength(2);
    const beams = s.solids.flatMap((x) => (x.kind === "beam" ? [x] : []));
    const jibs = beams.filter((b) => b.w * b.h >= 0.15), stays = beams.filter((b) => b.w * b.h < 0.05);
    expect(jibs).toHaveLength(2); expect(stays).toHaveLength(2);
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 1.5)).toHaveLength(0); // sin escalones
    for (const p of pedestals) {
      expect(p.at.y).toBeLessThan(-3.4); expect(p.at.z).toBeCloseTo(4, 6);
      const jib = jibs.find((b) => Math.abs(b.from.x - p.at.x) < 1)!, stay = stays.find((b) => Math.abs(b.from.x - p.at.x) < 1)!;
      const run = jib.to.x - jib.from.x, rise = jib.to.z - jib.from.z;
      expect(rise).toBeCloseTo(run, 6); // 45°
      expect(Math.hypot(run, rise)).toBeGreaterThan(5.5); expect(Math.hypot(run, rise)).toBeLessThan(7.5);
      expect(jib.from.y).toBeLessThan(0); expect(bounds(jib).max.y).toBeLessThan(0);
      expect(bounds(jib).min.z).toBeGreaterThanOrEqual(p.at.z + 4 - 1e-6); // sobre el techo de la cabina
      expect(stay.to).toEqual(jib.to); // a la punta
      expect(stay.from.z).toBeGreaterThanOrEqual(p.at.z + 4); expect(stay.from.x).toBeLessThan(jib.from.x); // de lo alto de la cabina, detrás del talón
      expect(stay.w * stay.h).toBeLessThan((jib.w * jib.h) / 10); // mucho más fino
    }
  });
  it("presupuesto: 37 sólidos, 4 menos por las plumas y 2 más por los estays que los 39 de antes", () => {
    expect(s.solids).toHaveLength(37);
  });
  it("orden: a los 72 rumbos cada pluma y cada estay se dibujan después de su pedestal, su cabina y el casco", () => {
    for (let k = 0; k < 72; k++) {
      const h = (k * 5 * Math.PI) / 180, r = ship("cargo", { x: 0, y: 0 }, h).solids, o = sortByDepth(r, h);
      const at = (x: Solid) => o.indexOf(x);
      const peds = r.flatMap((x, i) => (x.kind === "cylinder" && x.r === 0.5 && x.h === 3 ? [i] : []));
      expect(peds).toHaveLength(2);
      for (const i of peds) {
        const ped = r[i]!, cab = r[i + 1]!, jib = r[i + 2]!, stay = r[i + 3]!;
        expect(jib.kind).toBe("beam"); expect(stay.kind).toBe("beam");
        for (const part of [jib, stay]) {
          expect(at(part), `rumbo ${k * 5}°`).toBeGreaterThan(at(ped));
          expect(at(part), `rumbo ${k * 5}°`).toBeGreaterThan(at(cab));
          expect(at(part), `rumbo ${k * 5}°`).toBeGreaterThan(at(r[0]!));
        }
      }
    }
  });
```

(Imports: `sortByDepth` de `../iso/depth` y `type Solid` de `../iso/solids`, si faltan.)

El orden entre pluma y estay no se fija: no lo pide el issue, y se solapan solo cerca de la punta. Las capturas de la Tarea 5 lo miran.

- [ ] **Step 2: correr** `npx vitest run src/scenes/ships.test.ts`. Esperado: FAIL (no hay `beam`, 39 sólidos).

- [ ] **Step 3: implementación** en `src/scenes/ships.ts`. En `interface Kit`, después de `cyl`:

```ts
  beam: (from: [number, number, number], to: [number, number, number], w: number, h: number, mat: Material) => Solid;
```

En `kit()`, después de `cyl`:

```ts
    beam: (from, to, w, h, mat) => { const a = local(from[0], from[1]), b = local(to[0], to[1]); return { kind: "beam", from: v3(a.x, a.y, from[2]), to: v3(b.x, b.y, to[2]), w, h, mat }; },
```

Reemplazar el lazo de grúas de `cargo` por (mismo orden: pedestal, cabina, pluma, estay; el test de orden lo usa):

```ts
  for (const dx of [25.3, 36.5]) { // grúas de cubierta en babor: pedestal, cabina, pluma a 45° hacia proa apoyada en el techo de la cabina y estay a su punta
    const tip: [number, number, number] = [dx + 4.8, -3.9, deck + 8.7];
    solids.push(k.cyl(dx, -3.9, deck, 0.5, 3, "steel"), k.box(dx - 0.6, -4.5, 1.2, 1.2, deck + 3, 1, "whitewash"));
    solids.push(k.beam([dx + 0.3, -3.9, deck + 4.2], tip, 0.4, 0.5, "steel"), k.beam([dx - 0.5, -3.9, deck + 4.05], tip, 0.1, 0.1, "steel"));
  }
```

Actualizar el comentario de cabecera de `ships.ts` (líneas 7-16): "chimeneas y mástiles como cilindros y cajas" pasa a nombrar también "plumas y estays como vigas (`beam`)".

- [ ] **Step 4: correr** `npx vitest run src/scenes` y `npm run typecheck`. Esperado: PASS. También tienen que seguir verdes "con cualquier rumbo, todas las piezas quedan en el círculo de la eslora y por debajo de z 13" y `ships-reference.test.ts`.

- [ ] **Step 5: commit.** `git add src/scenes/ships.ts src/scenes/ships.test.ts && git commit -m "feat(#78): plumas del carguero como viga y un estay por grúa"`

### Task 4: la viga en el storybook

**Files:**
- Modify: `src/lab/exhibits.ts` (entrada `viga` antes de `carguero`)
- Test: `src/lab/exhibits.test.ts` (el mapa de piezas, línea ~137)

**Interfaces:**
- Consumes: `kind: "beam"` (Tarea 1).
- Produces: exhibit `{ id: "viga", title: "Viga", zone: "blog", group: "mar", kind: "piece", pad: "water" }`, alcanzable en `/lab/storybook.html#viga`.

- [ ] **Step 1: test.** En `src/lab/exhibits.test.ts`, en el `toEqual` del mapa `pieces` (id → zona), agregar `viga: "blog"` antes de `carguero`. Agregar además:

```ts
  it("la viga es una pieza de un solo sólido beam, antes del carguero", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("viga")).toBe(ids.indexOf("carguero") - 1);
    const e = EXHIBITS.find((x) => x.id === "viga")!;
    expect(e.kind).toBe("piece");
    const out: Solid[] = [];
    if (e.kind === "piece") e.build(out, []);
    expect(out.map((s) => s.kind)).toEqual(["beam"]);
  });
```

- [ ] **Step 2: correr** `npx vitest run src/lab`. Esperado: FAIL.

- [ ] **Step 3: implementación.** En `EXHIBITS`, antes de `carguero`:

```ts
  // la viga del motor sola, girada en planta y en alto a la vez: la sección se ve nivelada; montada, en las plumas del carguero
  { id: "viga", title: "Viga", zone: "blog", group: "mar", kind: "piece", pad: "water",
    build: (out) => { out.push({ kind: "beam", from: v3(-3, -1.5, 0.5), to: v3(3, 1.5, 6.5), w: 0.8, h: 1, mat: "steel" }); } },
```

(importar `v3` de `../iso/geometry`.)

- [ ] **Step 4: correr** `npx vitest run src/lab` (pad que cubre la sombra, catálogo, docs) y `npm run typecheck`. Esperado: PASS.

- [ ] **Step 5: commit.** `git add src/lab/exhibits.ts src/lab/exhibits.test.ts && git commit -m "feat(#78): exhibit viga en el storybook"`

### Task 5: capturas antes/después

**Files:**
- Create: `docs/superpowers/specs/assets/78-viga/cargo-antes-0.png`, `cargo-despues-0.png`, `cargo-antes-rumbo.png`, `cargo-despues-rumbo.png`, `viga.png`

Las toma el orquestador con agent-browser, siguiendo `.scratch/evals-78.md` (etapa 3). Las "antes" se toman sobre `main` (be29968) con un `git worktree`. Las de rumbo de carril usan un parche temporal, sin commitear, que cambia el rumbo de `vessel("cargo")` en `exhibits.ts` a 57° (`atan2(56, 36)`, primer tramo de `LANE_OUT`).

- [ ] **Step 1:** levantar el dev server en el worktree de `main` y en la rama. Capturar `/lab/storybook.html#carguero` a 1600 × 900 a 2x, a rumbo 0 y a rumbo 57°.
- [ ] **Step 2:** capturar `/lab/storybook.html#viga`.
- [ ] **Step 3:** mirar las capturas: la pluma se lee como un brazo recto y el estay como una línea fina.
- [ ] **Step 4: commit.** `git add docs/superpowers/specs/assets/78-viga && git commit -m "docs(#78): capturas del carguero antes y después de la viga"`

## Assumptions

Decisiones técnicas sin fuente escrita, declaradas para el PR:

1. Forma del sólido `{ kind: "beam"; from; to; w; h; mat }`, con `w` horizontal. La alternativa rechazada era `{ at, len, pitch, yaw }`. El issue la define "por dos puntos 3D (desde, hasta) y una sección … (ancho y alto)".
2. Eje vertical → `w` sobre y. Largo cero → eje x. Las alternativas rechazadas eran tirar un error o devolver cero caras: el issue pide que "no rompa", y con cero caras `bounds` daría ±Infinity (`src/iso/solids.ts:251-257`).
3. La pluma se apoya sobre el techo de la cabina (talón a deck + 4.2) y no a media altura de su cara de proa como la escalera de hoy. Así queda separada en z y la cabina va antes a cualquier rumbo (`src/iso/depth.ts:30-35`). Con el talón dentro del alto de la cabina, decidiría la clave y la cabina se dibujaría después de media pluma, como hoy de 140° a 230°.
4. El orden entre pluma y estay no se fija en tests: lo decide la clave de `sortByDepth`, y lo revisan las capturas.
5. Exhibit `viga` en el grupo `mar`, antes de `carguero`. La alternativa rechazada era un grupo nuevo "motor": los grupos son la tabla de la spec del storybook (`src/lab/exhibits.ts:24`), y la viga, por ahora, solo la usa el carguero.
6. Capturas en `docs/superpowers/specs/assets/78-viga/`, la convención `<issue>-<tema>` de las carpetas vecinas (`57-barcos`, `58-faro`, `83-darsena`). El parche de 57° se aplica sobre un worktree temporal y no entra a la rama.

## Grilling

- Rondas: 1 (los cambios fueron locales: no cambió ninguna costura ni se agregaron ni quitaron tareas).
- Preguntas: 18. Fuentes: CODE 16, DOC 1 (Q15: no hay `CONTEXT.md` ni `docs/adr/`; `README.md` no enumera tipos de sólido), NO SOURCE 1 (Q7, orden pluma/estay → supuesto técnico 4).
- Cambios al plan: viga del exhibit levantada 0.5 (Q11); test de normales finitas con largo cero (Q3); test de tonos a 45° con `shadeTone` (Q12); comentario de cabecera de `ships.ts` (Q15/Q18).
- Supuestos: 6 (arriba).
- Issues abiertos: ninguno.
