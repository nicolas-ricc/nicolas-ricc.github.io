# Motor: `poly` por sentido de giro, `dome`, `vault`, techo `hip` y `tone` — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el motor puro de sólidos (`src/iso/solids.ts`) con orientación de paredes por sentido de giro, los sólidos `dome` y `vault`, el techo `hip` y un `tone` por sólido, sin cambiar la salida de nada existente.

**Architecture:** Todo vive en `src/iso/solids.ts` y se prueba en `src/iso/solids.test.ts`. `extrude` deja de usar el centroide para las paredes y usa la arista; los sólidos nuevos son funciones de teselado privadas que reusan `face()` (convexos) y `regular()`; `tessellateAll` pasa a ser un envoltorio que suma `s.tone` a cada cara.

**Tech Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas, sin Pixi.

**Spec:** issue #37 (manda) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §3 ("Orientación por sentido de giro", "Sólidos nuevos", "Tono por sólido").

## Global Constraints

- Solo `src/iso/solids.ts` y `src/iso/solids.test.ts`. No tocar `facade.ts`, la paleta ni las escenas.
- `src/iso/` no importa Pixi (`src/iso/pixi-free.test.ts`); sin literales hex (`src/map/palette-guard.test.ts`); sin `Math.random`.
- Comentarios y nombres de tests en castellano; TypeScript estricto; tests Vitest al lado del módulo.
- Coordenadas: x este, y sur, z arriba.
- `GABLE_RATIO`, `STEP_RATIO`, `STEP_INSET` se quedan como están.
- Commits `feat(#37): …` / `test(#37): …`.
- `npm test` y `npm run typecheck` en verde al final de cada tarea; `src/scenes/*.test.ts` y `src/world/*.test.ts` sin tocar.

## Review Focus

1. Huellas existentes (rect, `regular`, rocas de `sea.ts`, cajas rotadas de `ships.ts`, `fair.ts`) ya vienen en el orden canónico: no deben invertirse ni cambiar de tono. Lo cubren los tests de escenas que ya existen y el test de prisma.
2. Base de `dome` y de `vault`: su centroide coincide en planta con el centro del sólido; si el centro de `face()` estuviera a la misma z que la base, el producto punto daría 0 y la normal quedaría al azar. Test: base con `normal.z < 0` en los dos.
3. `hip` con `w === d`: la cumbrera degenera en un punto (trapecios con un vértice repetido). Test: ninguna normal con NaN.
4. `hip` con `d > w`: la cumbrera va por y. Test: el AABB y los cuatro faldones también con la caja girada.
5. `tone` sumado también a las caras de fachada y del segundo nivel del techo escalonado, sin tocar las caras cuando `tone` falta. Test: prisma con `facade` y prisma `roof: "step"`.

## Decisiones técnicas (declaradas)

- **Centro de orientación de `dome` y `vault`:** el issue dice centro en `at` (dome) y en el punto medio del eje a `z = at.z` (vault). Con ese centro, la base tiene su centroide justo en el centro y `face()` no puede orientarla (producto punto 0). Se usa el mismo centro en planta pero a `at.z + h / 3`, como ya hace `cone`. Las laterales siguen saliendo hacia afuera (la componente radial domina).
- **Hastiales de `vault`:** el arco de `segments + 1` puntos ya empieza y termina en las dos esquinas de la base (θ = 0 y θ = π dan z = `at.z`), así que el hastial es ese polígono, sin repetir las esquinas. Total `segments + 3` caras como pide el issue.
- **Paredes y base de `hip`:** salen de `extrude(rect(...))` sin el techo (base + cuatro paredes con normales por giro), así heredan la orientación nueva.
- **`tone` en el tipo:** `Solid` pasa a ser `( …variantes… ) & { tone?: number }`, que equivale a sumarlo en cada variante sin repetirlo nueve veces.

---

### Task 1: Paredes de `extrude` orientadas por sentido de giro

**Files:**
- Modify: `src/iso/solids.ts` (función `extrude`, nueva `signedArea2`)
- Test: `src/iso/solids.test.ts`

**Interfaces:**
- Consumes: `normalize`, `v3`, `Vec2` de `./geometry`; `shadeTone` de `./light`.
- Produces: `extrude(footprint: Vec2[], z0: number, h: number, mat: Material): Face[]` con el mismo orden de caras de hoy: `[techo, base, pared 0→1, pared 1→2, …]`, techo con normal `(0,0,1)`, base `(0,0,−1)`. La pared `a→b` tiene `pts = [a@z0, b@z0, b@z0+h, a@z0+h]` (la fachada usa `pts[0]→pts[1]` como base).

- [ ] **Step 1: Test que falla** (en `describe("tessellate")`, más un helper arriba del archivo)

```ts
/** Punto en polígono por paridad de cruces (2D). */
function inside(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

it("poly cóncavo (L): cada pared apunta hacia afuera en los dos sentidos de giro", () => {
  const L = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 }];
  for (const footprint of [L, [...L].reverse()]) {
    const walls = tessellateAll({ kind: "poly", footprint, z: 0, h: 3, mat: "concrete" }).filter((f) => Math.abs(f.normal.z) < 1e-6);
    expect(walls).toHaveLength(6);
    for (const f of walls) {
      expect(Math.hypot(f.normal.x, f.normal.y)).toBeCloseTo(1, 9);
      const cx = f.pts.reduce((s, p) => s + p.x, 0) / f.pts.length, cy = f.pts.reduce((s, p) => s + p.y, 0) / f.pts.length;
      expect(inside({ x: cx + 0.1 * f.normal.x, y: cy + 0.1 * f.normal.y }, L)).toBe(false);
    }
  }
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/iso/solids.test.ts -t "poly cóncavo"`
Expected: FAIL (la pared `(2,2)→(2,6)` sale con normal `−x`, hacia adentro).

- [ ] **Step 3: Implementación**

```ts
/** Doble del área con signo (shoelace). Positiva en el orden canónico de `rect()`: norte, este, sur, oeste. */
function signedArea2(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

/**
 * Prisma recto sobre una huella poligonal: techo, base y un cuadrilátero por lado.
 * Las paredes se orientan por el sentido de giro (sirve para huellas cóncavas):
 * la huella se lleva al orden canónico y la normal de `a→b` es `(dy, −dx)`.
 */
function extrude(footprint: Vec2[], z0: number, h: number, mat: Material): Face[] {
  const fp = signedArea2(footprint) < 0 ? [...footprint].reverse() : footprint;
  const mk = (pts: Vec3[], normal: Vec3): Face => ({ pts, normal, mat, tone: shadeTone(normal), toneOffset: 0 });
  const out = [mk(fp.map((p) => v3(p.x, p.y, z0 + h)), v3(0, 0, 1)), mk(fp.map((p) => v3(p.x, p.y, z0)), v3(0, 0, -1))];
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i]!, b = fp[(i + 1) % fp.length]!;
    out.push(mk([v3(a.x, a.y, z0), v3(b.x, b.y, z0), v3(b.x, b.y, z0 + h), v3(a.x, a.y, z0 + h)], normalize(v3(b.y - a.y, a.x - b.x, 0))));
  }
  return out;
}
```

(`a.x - b.x` en vez de `-(b.x - a.x)` evita el `−0` en paredes norte-sur. Importar `normalize` de `./geometry`.)

- [ ] **Step 4: Correr `npx vitest run src/iso/solids.test.ts` y después `npm test`** — todo verde, incluidos los tests de prisma ("sur y este visibles", "sin importar el orden de los vértices") y los de escenas.

- [ ] **Step 5: Commit** `feat(#37): extrude orienta las paredes por sentido de giro`

### Task 2: `tone` por sólido

**Files:** Modify `src/iso/solids.ts` (tipo `Solid`, `tessellateAll`). Test `src/iso/solids.test.ts`.

**Interfaces:**
- Produces: `Solid` acepta `tone?: number` en todas las variantes. `tessellateAll(s)` devuelve las mismas caras de antes con `toneOffset + (s.tone ?? 0)`.

- [ ] **Step 1: Test que falla**

```ts
describe("tone", () => {
  it("tone: 1 suma una unidad al toneOffset de todas las caras, también las de fachada y del techo escalonado", () => {
    const cases: Solid[] = [prism, { ...prism, facade: { floors: 2, cols: 2 } }, { ...prism, w: 10, d: 10, roof: "step" }];
    for (const s of cases) {
      const plain = tessellateAll(s), toned = tessellateAll({ ...s, tone: 1 });
      expect(toned).toHaveLength(plain.length);
      toned.forEach((f, i) => expect(f.toneOffset).toBe(plain[i]!.toneOffset + 1));
    }
    expect(tessellateAll({ ...prism, facade: { floors: 2, cols: 2 } }).some((f) => f.mat === "glass")).toBe(true);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/iso/solids.test.ts -t "tone"` → FAIL (typecheck de Vitest no corta; falla por `toneOffset` igual).

- [ ] **Step 3: Implementación.** Envolver la unión: `export type Solid = ( | …variantes de hoy… ) & { tone?: number };`. Renombrar el `switch` actual a `function facesOf(s: Solid): Face[]` (privada) y:

```ts
export function tessellateAll(s: Solid): Face[] {
  const faces = facesOf(s), t = s.tone ?? 0;
  return t === 0 ? faces : faces.map((f) => ({ ...f, toneOffset: f.toneOffset + t }));
}
```

- [ ] **Step 4:** `npm test && npm run typecheck` → verde.
- [ ] **Step 5: Commit** `feat(#37): tone por sólido`

### Task 3: Techo `hip` en `prism`

**Files:** Modify `src/iso/solids.ts` (tipo `roof`, nueva `hip`, caso `prism`). Test `src/iso/solids.test.ts`.

**Interfaces:**
- Consumes: `extrude`, `rect`, `face`, `GABLE_RATIO`.
- Produces: `roof?: "flat" | "gable" | "step" | "hip"`. 9 caras: base, cuatro paredes (de `extrude(...).slice(1)`), dos trapecios en los lados largos y dos triángulos en los cortos. Ignora `facade`, como `gable`.

- [ ] **Step 1: Test que falla**

```ts
describe("hip", () => {
  const hipOf = (w: number, d: number): Solid => ({ kind: "prism", at: v3(1, 2, 3), w, d, h: 4, mat: "concrete", roof: "hip" });
  it("techo a cuatro aguas: 9 caras, cuatro faldones inclinados, cumbrera a h·(1 + GABLE_RATIO)", () => {
    for (const s of [hipOf(10, 6), hipOf(6, 10)]) {
      const all = tessellateAll(s);
      expect(all).toHaveLength(9);
      expect(all.filter((f) => f.normal.z > 0.3 && f.normal.z < 0.997)).toHaveLength(4);
      expect(bounds(s).max.z).toBeCloseTo(3 + 4 * (1 + GABLE_RATIO), 9);
    }
    expect(bounds(hipOf(6, 10))).toEqual({ min: { x: 1, y: 2, z: 3 }, max: { x: 7, y: 12, z: expect.closeTo(3 + 4 * (1 + GABLE_RATIO), 9) } });
  });
  it("hip con w === d: la cumbrera es un punto y ninguna normal es NaN", () => {
    const all = tessellateAll(hipOf(6, 6));
    expect(all).toHaveLength(9);
    for (const f of all) expect([f.normal.x, f.normal.y, f.normal.z].every(Number.isFinite)).toBe(true);
    expect(all.filter((f) => f.normal.z > 0.3 && f.normal.z < 0.997)).toHaveLength(4);
  });
});
```

(importar `GABLE_RATIO` de `./solids`).

- [ ] **Step 2:** `npx vitest run src/iso/solids.test.ts -t "hip"` → FAIL (hoy devuelve 6 caras planas).
- [ ] **Step 3: Implementación**

```ts
/** Techo a cuatro aguas: paredes hasta el alero y cumbrera por el eje largo, acortada min(w, d)/2 en cada punta. */
function hip(at: Vec3, w: number, d: number, h: number, mat: Material): Face[] {
  const { x, y, z } = at;
  const eave = z + h, ridge = eave + h * GABLE_RATIO, i = Math.min(w, d) / 2;
  const c = v3(x + w / 2, y + d / 2, z + h / 2);
  const f = (pts: Vec3[]) => face(pts, mat, c);
  const nw = v3(x, y, eave), ne = v3(x + w, y, eave), se = v3(x + w, y + d, eave), sw = v3(x, y + d, eave);
  const box = extrude(rect(x, y, w, d), z, h, mat).slice(1); // base y paredes, sin el techo plano
  if (w >= d) {
    const r0 = v3(x + i, y + d / 2, ridge), r1 = v3(x + w - i, y + d / 2, ridge);
    return [...box, f([nw, ne, r1, r0]), f([sw, se, r1, r0]), f([nw, sw, r0]), f([ne, se, r1])];
  }
  const r0 = v3(x + w / 2, y + i, ridge), r1 = v3(x + w / 2, y + d - i, ridge);
  return [...box, f([nw, sw, r1, r0]), f([ne, se, r1, r0]), f([nw, ne, r0]), f([sw, se, r1])];
}
```

En `facesOf`, caso `prism`: `if (s.roof === "hip") return hip(s.at, s.w, s.d, s.h, s.mat);` junto al de `gable`.

- [ ] **Step 4:** `npm test && npm run typecheck` → verde.
- [ ] **Step 5: Commit** `feat(#37): techo hip en prism`

### Task 4: Sólido `dome`

**Files:** Modify `src/iso/solids.ts` (variante `dome`, función `dome`, caso en `facesOf`). Test `src/iso/solids.test.ts`.

**Interfaces:**
- Produces: `{ kind: "dome"; at: Vec3; r: number; h: number; mat: Material; sides?: number; rings?: number }` (más `tone?` por la intersección). Defaults `sides = 12`, `rings = 3`. `sides · rings + 1` caras, la primera es la base.

- [ ] **Step 1: Test que falla**

```ts
describe("dome", () => {
  const d: Solid = { kind: "dome", at: v3(10, 20, 2), r: 4, h: 3, mat: "concrete" };
  it("cúpula 12×3: 37 caras, laterales sin mirar al suelo, base hacia abajo y descartada", () => {
    const all = tessellateAll(d);
    expect(all).toHaveLength(37);
    const base = all.filter((f) => f.pts.every((p) => p.z === 2));
    expect(base).toHaveLength(1);
    expect(base[0]!.normal.z).toBeLessThan(0);
    for (const f of all.filter((f) => f !== base[0])) expect(f.normal.z).toBeGreaterThanOrEqual(0);
    expect(all.filter((f) => f.pts.length === 3)).toHaveLength(12);
    expect(bounds(d).max.z).toBeCloseTo(5, 9);
    const inset = 4 * Math.cos(Math.PI / 12); // `regular` deja caras planas a los cuatro vientos
    expect(bounds(d).min).toEqual({ x: expect.closeTo(10 - inset, 9), y: expect.closeTo(20 - inset, 9), z: 2 });
    expect(tessellate(d).some((f) => f.normal.z < 0)).toBe(false);
  });
  it("sides y rings configurables", () => {
    expect(tessellateAll({ ...d, sides: 16, rings: 4 })).toHaveLength(65);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/iso/solids.test.ts -t "dome"` → FAIL (`dome` no existe: el switch devuelve `undefined`).
- [ ] **Step 3: Implementación**

```ts
/** Cúpula: anillos a ángulo polar creciente (radio r·cos φ, altura h·sin φ), cuadriláteros entre anillos y triángulos al ápice. */
function dome(at: Vec3, r: number, h: number, sides: number, rings: number, mat: Material): Face[] {
  const ring = (k: number): Vec3[] => {
    const phi = (k / rings) * (Math.PI / 2), z = at.z + h * Math.sin(phi);
    return regular(at.x, at.y, r * Math.cos(phi), sides).map((p) => v3(p.x, p.y, z));
  };
  const apex = v3(at.x, at.y, at.z + h);
  const c = v3(at.x, at.y, at.z + h / 3); // con el centro a nivel de la base, la base no se podría orientar
  const out = [face(ring(0), mat, c)];
  for (let k = 0; k < rings; k++) {
    const lo = ring(k), hi = k < rings - 1 ? ring(k + 1) : null;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      out.push(face(hi ? [lo[i]!, lo[j]!, hi[j]!, hi[i]!] : [lo[i]!, lo[j]!, apex], mat, c));
    }
  }
  return out;
}
```

Variante en la unión: `| { kind: "dome"; at: Vec3; r: number; h: number; mat: Material; sides?: number; rings?: number }`. Caso: `case "dome": return dome(s.at, s.r, s.h, s.sides ?? 12, s.rings ?? 3, s.mat);`.

`shadowPolygon`, `bounds` y `sortByDepth` trabajan sobre `tessellateAll`, así que no necesitan cambios.

- [ ] **Step 4:** `npm test && npm run typecheck` → verde.
- [ ] **Step 5: Commit** `feat(#37): sólido dome`

### Task 5: Sólido `vault`

**Files:** Modify `src/iso/solids.ts` (variante `vault`, función `vault`, caso en `facesOf`). Test `src/iso/solids.test.ts`.

**Interfaces:**
- Produces: `{ kind: "vault"; at: Vec3; len: number; w: number; h: number; axis: "x" | "y"; mat: Material; segments?: number }`, default `segments = 6`. `segments + 3` caras: base, franjas, dos hastiales.

- [ ] **Step 1: Test que falla**

```ts
describe("vault", () => {
  const vx: Solid = { kind: "vault", at: v3(0, 0, 1), len: 12, w: 6, h: 3, axis: "x", mat: "concrete" };
  it("bóveda de 6 segmentos: 9 caras, hastiales verticales y opuestos, franjas hacia arriba, base hacia abajo", () => {
    const all = tessellateAll(vx);
    expect(all).toHaveLength(9);
    const gables = all.filter((f) => Math.abs(f.normal.z) < 1e-6);
    expect(gables).toHaveLength(2);
    expect(gables[0]!.normal.x + gables[1]!.normal.x).toBeCloseTo(0, 9);
    expect(Math.abs(gables[0]!.normal.x)).toBeCloseTo(1, 9);
    expect(gables.every((g) => g.pts.length === 7)).toBe(true);
    const base = all.filter((f) => f.normal.z < -1e-6);
    expect(base).toHaveLength(1);
    expect(all.filter((f) => f.normal.z > 1e-6)).toHaveLength(6);
    expect(bounds(vx)).toEqual({ min: { x: 0, y: 0, z: 1 }, max: { x: 12, y: expect.closeTo(6, 9), z: expect.closeTo(4, 9) } });
  });
  it("axis y intercambia las extensiones de la AABB", () => {
    const b = bounds({ ...vx, axis: "y" });
    expect(b.max.x).toBeCloseTo(6, 9); expect(b.max.y).toBeCloseTo(12, 9);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/iso/solids.test.ts -t "vault"` → FAIL.
- [ ] **Step 3: Implementación**

```ts
/** Bóveda de cañón: medio óvalo (semiancho w/2, alto h) en franjas a lo largo del eje, dos hastiales y la base. `at` es la esquina NO. */
function vault(s: Solid & { kind: "vault" }): Face[] {
  const { at, len, w, h, mat } = s, n = s.segments ?? 6;
  // u a lo largo del eje, v a lo ancho
  const P = (u: number, j: number): Vec3 => {
    const t = (j / n) * Math.PI, v = (w / 2) * (1 - Math.cos(t)), z = at.z + h * Math.sin(t);
    return s.axis === "x" ? v3(at.x + u, at.y + v, z) : v3(at.x + v, at.y + u, z);
  };
  const mid = s.axis === "x" ? v3(at.x + len / 2, at.y + w / 2, at.z + h / 3) : v3(at.x + w / 2, at.y + len / 2, at.z + h / 3);
  const arc = (u: number) => Array.from({ length: n + 1 }, (_, j) => P(u, j));
  const out = [face([P(0, 0), P(len, 0), P(len, n), P(0, n)], mat, mid), face(arc(0), mat, mid), face(arc(len), mat, mid)];
  for (let j = 0; j < n; j++) out.push(face([P(0, j), P(len, j), P(len, j + 1), P(0, j + 1)], mat, mid));
  return out;
}
```

Variante: `| { kind: "vault"; at: Vec3; len: number; w: number; h: number; axis: "x" | "y"; mat: Material; segments?: number }`. Caso: `case "vault": return vault(s);`.

`Math.sin(π)` no es 0 exacto (≈1.2e−16), así que el arco cierra en `at.z` por construcción: `z = j === n ? at.z : at.z + h * Math.sin(t)`. Lo mismo para `v`: `j === n ? w : …`. Así la base es exactamente horizontal y la AABB da `y = w` exacto.

- [ ] **Step 4:** `npm test && npm run typecheck` → verde.
- [ ] **Step 5: Commit** `feat(#37): sólido vault`

### Task 6: Verificación visual de `lab/world.html`

No toca código. Con `npm run dev -- --host --port 5173`, capturar `/lab/world.html` a 1600×900 en la rama base (antes) y en esta rama (después) y comparar (se esperan idénticas o con diferencias de píxel sueltas). El script de `agent-browser` vive en `.scratch/evals-37.md`. La captura "después" va al PR.
