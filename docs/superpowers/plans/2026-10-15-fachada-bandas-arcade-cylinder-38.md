# Fachada: bandas por altura, arcade, cylinder y facadeWindows (#38) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la fachada procedural emita un gradiente de tono por altura, una planta baja con arcos (`base: "arcade"`), que funcione sobre `cylinder`, y que exponga sus ventanas con el piso al que pertenecen (`facadeWindows`).

**Architecture:** Todo vive en `src/iso/facade.ts` (motor puro, sin Pixi). `facadeFaces` sigue trabajando pared por pared y sus polígonos siguen coplanares a la pared y después de ella; solo cambia el contenido por piso (banda → pórtico/arcada → ventanas → losa). En `src/iso/solids.ts` el `cylinder` gana `facade?` y los tres sólidos con fachada (`prism`, `poly`, `cylinder`) comparten un único helper que inserta las caras de fachada detrás de cada pared.

**Tech Stack:** TypeScript estricto, Vitest (`npm test`), `npm run typecheck`.

**Spec:** `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §3 "Fachada", y el issue #38 (sus "Decisiones" mandan sobre la spec donde difieran).

## Global Constraints

- Alcance de código: solo `src/iso/facade.ts`, el `tessellateAll`/`facesOf` de `src/iso/solids.ts` para `cylinder`, y tests.
- `src/iso/` no importa Pixi (`src/iso/pixi-free.test.ts`).
- Ningún literal hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts` (`src/map/palette-guard.test.ts`).
- `Math.random` prohibido.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo.
- Nada de dependencias nuevas.
- Commits `feat(#38): …` / `test(#38): …`.
- Todo polígono de fachada es coplanar a la pared (misma `normal`, mismo `tone`) y va después de ella en la lista.
- `facadeAccents` y `windowPatches` no cambian de firma ni de salida (salvo `windowPatches(floor 0)` con `base: "arcade"`, que devuelve `[]` como `portico`).

## Decisiones de implementación (declaradas)

- **Conteo de puntos del arco: 9, no 11.** El issue pide "11 puntos (4 del rectángulo menos la arista superior compartida más 7 del arco)", pero esa cuenta da 4 − 2 + 7 = 9: las dos esquinas superiores del rectángulo son los extremos del semicírculo. Se emite el polígono sin vértices duplicados: `[abajo-izq, abajo-der, arco j = 0..6 de derecha a izquierda]` = 9 puntos. El test documenta el conteo exacto, como pide el issue.
- **Semicírculo en coordenadas de pared:** semiancho horizontal = `0.35 · cw` (mitad del ancho de arco `0.7 · cw`), semialto = `fh · 0.35` (de `0.45 fh` a `0.8 fh`). Es un semióvalo en mundo; con columnas de ancho distinto de `0.7 · fh` no es un círculo exacto. Se acepta: el issue fija ambos extremos.
- **Bandas y `tone` del sólido se suman:** una banda `+2` en un sólido con `tone: +2` pide `+4`; `stepTone` clampea, no hay que hacer nada.

## Assumptions

- **`withFacade` también en `prism` y `poly`.** El issue limita `solids.ts` al `tessellateAll` "para `cylinder`"; el helper solo extrae el `flatMap` que hoy está inline en `prism` (`solids.ts:303`) y `poly` (`solids.ts:308`) sin cambiar su salida (lo fijan los tests existentes de `facade.test.ts` y `solids.test.ts` "poly con facade"). Alternativa descartada: copiar el `flatMap` por tercera vez en `cylinder`.
- **Arco de 9 puntos** (ver "Decisiones"): mismo polígono visible que 11 con dos vértices duplicados; se elige sin duplicados.
- **Escalera de cinco tonos:** hasta que #36 traiga los nueve tonos, `stepTone` clampea en `shade`/`up` (`palette-iso.ts:80-83`), así que sobre una pared `lit` pilares (−1) y arcos (−2) caen ambos en `shade`. Se mantienen los offsets que fija el issue; el color final lo resuelve la paleta de #36.
- **Sin validación de `floors`/`cols`** (0, no enteros): `Facade` es entrada interna de recetas con literales; con `floors: 0` o `cols: 0` los bucles no emiten nada, como hoy.
- **Presupuesto de polígonos:** las bandas suman una cara por piso y pared visible; el presupuesto de la spec §9 se mide en el cierre (#49), no acá.

## Review Focus

1. **Fachada de 1 piso** (`floors: 1`): una sola banda a `0`; con `base`, ninguna ventana. Test en Task 1 (banda) y Task 4 (`facadeWindows` vacío con base y 1 piso).
2. **Varias columnas de arcos** (`cols: 3`): los arcos de los extremos siguen dentro de la pared (`s ∈ [0, 1]`). Cubierto por el test "ningún polígono sale de la pared" de Task 2.
3. **Pared con base en z ≠ 0** (sólido elevado, `at.z = 2`): bandas, arcos y ventanas con piso calculados desde `pts[0].z`, no desde 0. Test en Task 4 (`facadeWindows` sobre un prisma a `z = 2`).
4. **Cilindro con fachada que no mira a la cámara:** `tessellate` descarta paredes de espaldas, y también sus caras de fachada (misma normal). Test en Task 3.
5. **`bands: false` junto con `arcade`:** sin banda, el piso 0 empieza por los pilares. Test en Task 2.

---

### Task 1: Bandas por altura y `bands: false`

**Files:**
- Modify: `src/iso/facade.ts`
- Test: `src/iso/facade.test.ts`

**Interfaces:**
- Produces: `Facade.bands?: false`; `export function bandTone(floor: number, floors: number): number`; orden por piso en `facadeFaces`: banda, pórtico, ventanas, losa. Helper interno `at(wall, s, z): Vec3` que usa `patch` (lo reutiliza Task 2).

- [ ] **Step 1: Escribir los tests que fallan** (reemplazar el primer test de `facade.test.ts` y sumar los nuevos dentro del `describe("fachada")`; agregar `bandTone` al import)

```ts
const zspan = (f: Face) => Math.max(...f.pts.map((p) => p.z)) - Math.min(...f.pts.map((p) => p.z));

it("por cada pared visible: la pared, luego por piso una banda, 2 ventanas de vidrio y una losa oscura", () => {
  const vis = tessellate(tower);
  const walls = vis.filter((f) => isWall(f) && f.mat === "office" && zspan(f) === tower.h);
  expect(walls).toHaveLength(2);
  expect(vis).toHaveLength(3 + 2 * 12); // techo + 2 paredes, y por pared 3 bandas + 6 ventanas + 3 losas
  for (const wall of walls) {
    const i = vis.indexOf(wall);
    const after = vis.slice(i + 1, i + 13);
    expect(after.map((f) => (f.mat === "glass" ? "v" : zspan(f) === 2 ? "b" : "l")).join("")).toBe("bvvlbvvlbvvl");
    for (const f of after) expect(f.normal).toEqual(wall.normal); // coplanares: se pintan encima
  }
});

it("bandas por altura: 0, 1, 2 por tercios en 6 pisos; 0, 1, 1 en 3; 0 en 1", () => {
  const bands = (floors: number) => {
    const f: Facade = { floors, cols: 2 };
    const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
    const fh = tower.h / floors;
    return facadeFaces(wall, f).filter((x) => x.mat === "office" && Math.abs(zspan(x) - fh) < 1e-9).map((x) => x.toneOffset);
  };
  expect(bands(6)).toEqual([0, 0, 1, 1, 2, 2]);
  expect(bands(3)).toEqual([0, 1, 1]);
  expect(bands(1)).toEqual([0]);
  expect([4, 5, 9].map((n) => Array.from({ length: n }, (_, i) => bandTone(i, n)))).toEqual([[0, 0, 1, 2], [0, 0, 1, 1, 2], [0, 0, 0, 1, 1, 1, 2, 2, 2]]);
});

it("cada banda cubre su piso entero, de lado a lado de la pared", () => {
  const wall = tessellateAll(tower).find((f) => isWall(f) && f.pts.every((p) => p.y === 4))!; // pared sur, x 0..4
  const bands = facadeFaces(wall, tower.facade!).filter((x) => x.mat === "office" && zspan(x) === 2);
  expect(bands.map((b) => [Math.min(...b.pts.map((p) => p.z)), Math.max(...b.pts.map((p) => p.z))])).toEqual([[0, 2], [2, 4], [4, 6]]);
  for (const b of bands) expect([Math.min(...b.pts.map((p) => p.x)), Math.max(...b.pts.map((p) => p.x))]).toEqual([0, 4]);
});

it("bands: false reproduce la fachada sin gradiente: por piso ventanas y losa", () => {
  const f: Facade = { ...tower.facade!, bands: false };
  const wall = tessellateAll({ ...tower, facade: f }).find(isWall)!;
  const faces = facadeFaces(wall, f);
  expect(faces.map((x) => (x.mat === "glass" ? "v" : x.toneOffset === -1 ? "l" : "?")).join("")).toBe("vvlvvlvvl");
  expect(facadeFaces(wall, tower.facade!).filter((x) => !(x.mat === "office" && zspan(x) === 2))).toEqual(faces);
});
```

El test existente "las ventanas quedan dentro de su piso y las losas arriba de cada piso" filtra losas por `toneOffset === -1`: sigue valiendo (las bandas de 3 pisos son 0, 1, 1). No cambiarlo.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/iso/facade.test.ts`
Expected: FAIL (`bandTone` no exportado; conteos 21 vs 27).

- [ ] **Step 3: Implementación mínima en `src/iso/facade.ts`**

Interfaz y doc:

```ts
/**
 * Fachada procedural de un prisma: pisos iguales, `cols` ventanas por piso,
 * una losa oscura arriba de cada piso. Cada piso lleva debajo una banda de
 * pared cuyo tono sube con la altura (`bands: false` la apaga). La planta baja
 * puede ser vidriera (una banda de vidrio) o pórtico (banda muy oscura). Las
 * caras salen coplanares a la pared, después de ella, así se pintan encima.
 */
export interface Facade { floors: number; cols: number; litFloor?: number; base?: "glass" | "portico"; window?: { w: number; h: number }; bands?: false }
```

Reemplazar `patch` por un punto sobre la pared más el rectángulo:

```ts
/** Punto de la pared: s a lo largo de la base (0..1), z absoluto. La base de la pared es pts[0]→pts[1]. */
function at(wall: Face, s: number, z: number): Vec3 {
  const a = wall.pts[0]!, b = wall.pts[1]!;
  return v3(a.x + (b.x - a.x) * s, a.y + (b.y - a.y) * s, z);
}

/** Rectángulo sobre la pared: s0..s1 a lo largo de la base, z0..z1 absolutos. */
function patch(wall: Face, s0: number, s1: number, z0: number, z1: number): Vec3[] {
  return [at(wall, s0, z0), at(wall, s1, z0), at(wall, s1, z1), at(wall, s0, z1)];
}

/** Tono de la banda del piso: por tercios con 4 o más pisos, 0 y +1 con 2..3, 0 con uno. */
export function bandTone(floor: number, floors: number): number {
  if (floors >= 4) return Math.floor((3 * floor) / floors);
  return floors >= 2 && floor > 0 ? 1 : 0;
}
```

En `facadeFaces`, primera línea del cuerpo del `for`, después de `const z0 = …`:

```ts
    if (f.bands !== false) out.push(mk(patch(wall, 0, 1, z0, z0 + fh), wall.mat, bandTone(i, f.floors)));
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run src/iso/facade.test.ts src/iso/solids.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/iso/facade.ts src/iso/facade.test.ts
git commit -m "feat(#38): bandas de fachada con tono creciente por altura"
```

---

### Task 2: `base: "arcade"`

**Files:**
- Modify: `src/iso/facade.ts`
- Test: `src/iso/facade.test.ts`

**Interfaces:**
- Consumes: `at(wall, s, z)`, `patch(...)`, `bandTone` (Task 1).
- Produces: `Facade.base?: "glass" | "portico" | "arcade"`; `export const ARCH_SEGMENTS = 6`; con `arcade`, piso 0 = banda, pilares (`−1`), `cols` arcos (`−2`), losa; `windowPatches(wall, f, 0)` devuelve `[]`.

- [ ] **Step 1: Tests que fallan**

```ts
describe("arcada", () => {
  const f: Facade = { floors: 2, cols: 3, base: "arcade" };
  const wall = tessellateAll({ ...tower, facade: f }).find((x) => isWall(x) && x.pts.every((p) => p.y === 4))!; // pared sur, x 0..4, z 0..6
  const faces = facadeFaces(wall, f);
  const fh = 3;
  const arches = faces.filter((x) => x.toneOffset === -2);

  it("un arco por columna, cada uno un polígono de 9 puntos: 2 de la base del rectángulo y los 7 del semicírculo de 6 segmentos", () => {
    expect(arches).toHaveLength(3);
    // las dos esquinas superiores del rectángulo son los extremos del semicírculo: 4 − 2 + 7 = 9
    for (const a of arches) expect(a.pts).toHaveLength(2 + ARCH_SEGMENTS + 1);
    for (const a of arches) {
      expect(a.mat).toBe("office");
      expect(Math.min(...a.pts.map((p) => p.z))).toBeCloseTo(0);
      expect(Math.max(...a.pts.map((p) => p.z))).toBeCloseTo(fh * 0.8);
      expect(a.pts[2]!.z).toBeCloseTo(fh * 0.45); // arranque del arco
      expect(a.pts[8]!.z).toBeCloseTo(fh * 0.45);
    }
  });

  it("arcos de 0.7 del ancho de columna, centrados en su columna", () => {
    const cw = 4 / 3;
    arches.forEach((a, k) => {
      const xs = a.pts.map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.7 * cw);
      expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo((k + 0.5) * cw);
    });
  });

  it("pilares a −1 emitidos antes de los arcos, después de la banda; sin ventanas en el piso 0", () => {
    const iPillar = faces.findIndex((x) => x.toneOffset === -1 && Math.max(...x.pts.map((p) => p.z)) === fh * 0.85);
    expect(iPillar).toBe(1); // 0 es la banda del piso
    expect(faces.findIndex((x) => x.toneOffset === -2)).toBe(2);
    expect(faces.filter((x) => x.mat === "glass")).toHaveLength(3); // solo el piso 1
    expect(windowPatches(wall, f, 0)).toEqual([]);
    expect(facadeAccents([wall], { ...f, litFloor: 0 }, "amber")).toEqual([]); // como el pórtico: el piso 0 no tiene ventanas que encender
  });

  it("ningún polígono sale de la pared ni de su piso", () => {
    for (const x of faces.slice(0, 2 + 3)) { // banda, pilares y los 3 arcos del piso 0
      for (const p of x.pts) {
        expect(p.y).toBe(4);
        expect(p.x).toBeGreaterThanOrEqual(-1e-9);
        expect(p.x).toBeLessThanOrEqual(4 + 1e-9);
        expect(p.z).toBeGreaterThanOrEqual(-1e-9);
        expect(p.z).toBeLessThanOrEqual(fh + 1e-9);
      }
    }
  });

  it("con bands: false el piso 0 empieza por los pilares", () => {
    const raw = facadeFaces(wall, { ...f, bands: false });
    expect(raw[0]!.toneOffset).toBe(-1);
    expect(raw.slice(1, 4).every((x) => x.toneOffset === -2)).toBe(true);
  });
});
```

Agregar `ARCH_SEGMENTS` al import.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/iso/facade.test.ts`
Expected: FAIL (typecheck de `"arcade"` en vitest no falla, pero `ARCH_SEGMENTS` es `undefined` y no hay caras a −2).

- [ ] **Step 3: Implementación**

```ts
export const ARCH_SEGMENTS = 6;
const ARCH_W = 0.7;      // fracción del ancho de columna
const ARCH_SPRING = 0.45; // arranque del arco, fracción de la altura del piso
const ARCH_TOP = 0.8;     // clave del arco
const PILLAR_H = 0.85;    // banda de pilares

/** Arco de medio punto en la columna k: base del rectángulo y el semicírculo de derecha a izquierda (sus extremos son las esquinas superiores). */
function arch(wall: Face, f: Facade, k: number, z0: number, fh: number): Vec3[] {
  const cw = 1 / f.cols, sc = (k + 0.5) * cw, hw = (ARCH_W * cw) / 2;
  const zs = z0 + fh * ARCH_SPRING, rz = fh * (ARCH_TOP - ARCH_SPRING);
  const pts = [at(wall, sc - hw, z0), at(wall, sc + hw, z0)];
  for (let j = 0; j <= ARCH_SEGMENTS; j++) {
    const t = (j / ARCH_SEGMENTS) * Math.PI;
    pts.push(at(wall, sc + hw * Math.cos(t), zs + rz * Math.sin(t)));
  }
  return pts;
}
```

`Facade.base` pasa a `"glass" | "portico" | "arcade"` y el doc menciona "o arcada (arcos oscuros sobre pilares)".
`windowPatches`: `if (floor === 0 && (f.base === "portico" || f.base === "arcade")) return [];`
En `facadeFaces`, después de la línea del pórtico:

```ts
    if (i === 0 && f.base === "arcade") {
      out.push(mk(patch(wall, 0, 1, z0, z0 + fh * PILLAR_H), wall.mat, -1)); // pilares: los arcos se pintan encima
      for (let k = 0; k < f.cols; k++) out.push(mk(arch(wall, f, k, z0, fh), wall.mat, -2));
    }
```

Nota: en `j = ARCH_SEGMENTS`, `Math.sin(π)` no es 0 exacto; el test usa `toBeCloseTo`, alcanza.

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run src/iso/facade.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/iso/facade.ts src/iso/facade.test.ts
git commit -m "feat(#38): planta baja con arcada (base arcade)"
```

---

### Task 3: Fachada en `cylinder`

**Files:**
- Modify: `src/iso/solids.ts` (variante `cylinder` del tipo `Solid`, `facesOf`)
- Test: `src/iso/facade.test.ts`

**Interfaces:**
- Produces: `{ kind: "cylinder"; …; facade?: Facade }`.

- [ ] **Step 1: Tests que fallan** (en `facade.test.ts`)

```ts
describe("fachada en cylinder", () => {
  const drum: Solid = { kind: "cylinder", at: v3(0, 0, 0), r: 4, h: 6, mat: "office", sides: 12, facade: { floors: 3, cols: 1 } };
  const plain: Solid = { ...drum, facade: undefined };

  it("cada pared lleva su fachada: 3 bandas, 3 ventanas y 3 losas detrás de ella", () => {
    const all = tessellateAll(drum), walls = tessellateAll(plain).filter(isWall);
    expect(walls).toHaveLength(12);
    expect(all).toHaveLength(2 + 12 * (1 + 9));
    for (const wall of walls) {
      const i = all.findIndex((f) => JSON.stringify(f.pts) === JSON.stringify(wall.pts));
      const after = all.slice(i + 1, i + 10);
      expect(after.filter((f) => f.mat === "glass")).toHaveLength(3);
      for (const f of after) expect(f.normal).toEqual(all[i]!.normal);
    }
  });

  it("tessellate descarta las paredes de espaldas junto con su fachada", () => {
    const vis = tessellate(drum), visWalls = tessellate(plain).filter(isWall);
    expect(vis).toHaveLength(1 + visWalls.length * 10); // techo + cada pared visible con sus 9 caras
  });
});
```

Los tests de `solids.test.ts` del cilindro sin fachada (líneas ~89 y ~95) no se tocan.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/iso/facade.test.ts`
Expected: FAIL (el cilindro ignora `facade`: 14 caras).

- [ ] **Step 3: Implementación en `src/iso/solids.ts`**

Tipo: `| { kind: "cylinder"; at: Vec3; r: number; h: number; mat: Material; sides?: number; facade?: Facade }`

Helper único antes de `facesOf`, reemplazando los dos `flatMap` inline de `prism` y `poly`:

```ts
/** Inserta las caras de fachada detrás de cada pared, así se pintan encima. */
const withFacade = (faces: Face[], f?: Facade): Face[] => (f ? faces.flatMap((x) => (isWall(x) ? [x, ...facadeFaces(x, f)] : [x])) : faces);
```

```ts
    case "prism": {
      …
      const box = withFacade(extrude(rect(s.at.x, s.at.y, s.w, s.d), s.at.z, s.h, s.mat), s.facade);
      …
    }
    case "poly": return withFacade(extrude(s.footprint, s.z, s.h, s.mat), s.facade);
    case "cylinder": return withFacade(extrude(regular(s.at.x, s.at.y, s.r, s.sides ?? 8), s.at.z, s.h, s.mat), s.facade);
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run src/iso && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/iso/solids.ts src/iso/facade.test.ts
git commit -m "feat(#38): fachada sobre cylinder"
```

---

### Task 4: `facadeWindows` con piso

**Files:**
- Modify: `src/iso/facade.ts`
- Test: `src/iso/facade.test.ts`

**Interfaces:**
- Consumes: `windowPatches`, `floorHeight`.
- Produces: `export function facadeWindows(wall: Face, f: Facade): { pts: Vec3[]; floor: number }[]` — ventanas de los pisos ≥ 1 y, sin `base`, también del piso 0; nunca vidriera, pórtico ni arcada. Lo consumirá el kit (#39) para publicar `windows`.

- [ ] **Step 1: Tests que fallan**

```ts
describe("facadeWindows", () => {
  const wallOf = (s: Solid) => tessellateAll(s).find((x) => isWall(x) && x.pts.every((p) => p.y === 4))!;

  it("cols · floors sin base; cols · (floors − 1) con cualquier base", () => {
    expect(facadeWindows(wallOf(tower), tower.facade!)).toHaveLength(2 * 3);
    for (const base of ["glass", "portico", "arcade"] as const) {
      const f: Facade = { floors: 3, cols: 2, base };
      expect(facadeWindows(wallOf({ ...tower, facade: f }), f)).toHaveLength(2 * 2);
    }
    const one: Facade = { floors: 1, cols: 4, base: "glass" };
    expect(facadeWindows(wallOf({ ...tower, facade: one }), one)).toEqual([]);
  });

  it("cada ventana lleva su piso y cae dentro de él, también con la pared elevada", () => {
    const raised = { ...tower, at: v3(0, 0, 2) };
    const f: Facade = { floors: 3, cols: 2, base: "portico" };
    const ws = facadeWindows(wallOf({ ...raised, facade: f }), f);
    expect(ws.map((w) => w.floor)).toEqual([1, 1, 2, 2]);
    for (const w of ws) {
      const z0 = 2 + w.floor * 2;
      expect(Math.min(...w.pts.map((p) => p.z))).toBeGreaterThan(z0);
      expect(Math.max(...w.pts.map((p) => p.z))).toBeLessThan(z0 + 2);
    }
  });

  it("coinciden con las ventanas de vidrio de facadeFaces", () => {
    const f: Facade = { floors: 3, cols: 2, base: "arcade" };
    const wall = wallOf({ ...tower, facade: f });
    expect(facadeWindows(wall, f).map((w) => w.pts)).toEqual(facadeFaces(wall, f).filter((x) => x.mat === "glass").map((x) => x.pts));
  });
});
```

Agregar `facadeWindows` al import.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/iso/facade.test.ts`
Expected: FAIL (`facadeWindows is not a function`).

- [ ] **Step 3: Implementación** (después de `windowPatches`)

```ts
/** Las ventanas de la fachada con su piso: la planta baja solo si no tiene `base` (la vidriera no es ventana). */
export function facadeWindows(wall: Face, f: Facade): { pts: Vec3[]; floor: number }[] {
  const out: { pts: Vec3[]; floor: number }[] = [];
  for (let floor = f.base ? 1 : 0; floor < f.floors; floor++) for (const pts of windowPatches(wall, f, floor)) out.push({ pts, floor });
  return out;
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run src/iso/facade.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/iso/facade.ts src/iso/facade.test.ts
git commit -m "feat(#38): facadeWindows devuelve las ventanas con su piso"
```

---

### Task 5: Suite completa y escenas

**Files:**
- Posibles ajustes: `src/scenes/*.test.ts` que cuenten caras o `toneOffset` de fachada (a hoy ninguno lo hace: `city.test`, `district.test`, `tech.test`, `fair.test`, `hinterland.test`, `ships.test` solo miran `s.facade` en el sólido).

- [ ] **Step 1:** `npm test && npm run typecheck`. Expected: PASS. Si algún test de escena falla por conteo de caras o `toneOffset`, ajustarlo con un comentario que diga que las bandas de #38 agregan una cara por piso y pared.
- [ ] **Step 2:** Si hubo ajustes, commit `test(#38): escenas con bandas de fachada`.

La verificación visual (captura de `lab/resume.html` con el gradiente en las torres) la hace el pipeline después del flujo, con `agent-browser` y el script de `.scratch/evals-38.md`; no es una tarea de código.

## Grilling

Una ronda (los cambios fueron menores: un `expect` en Task 2 y la sección Assumptions). 16 preguntas del griller.

| # | Respuesta | Fuente |
|---|---|---|
| 1 | `withFacade` en `prism`/`poly` | NO SOURCE → assumption (sección Assumptions); `CODE: src/iso/solids.ts:303,308` — los dos `flatMap` inline |
| 2 | Caras de un sólido se pintan en orden de lista | `CODE: src/iso/render-list.ts:38` — `for (const s of sortByDepth(raised)) for (const f of tessellate(s))`: se ordenan sólidos, no caras |
| 3 | Rectángulo rematado por el semicírculo | `ISSUE: "rectángulo desde z0 hasta z0 + fh · 0.45, rematado por un semicírculo de 6 segmentos (7 puntos)"` — 9 vs 11 es assumption |
| 4 | Criterios: Tasks 1–4 → "Bandas…; arcade; cylinder; facadeWindows"; Task 5 → "npm test y npm run typecheck"; la captura la hace la etapa de verificación visual. `lab/resume.html` dibuja la ciudad con torres con fachada | `ISSUE: "captura de lab/resume.html mostrando el gradiente por altura en las torres"`; `CODE: src/scenes/city.test.ts:69` — torre con `facade { floors: 8, cols: 4, litFloor: 5, base: "portico" }` |
| 5 | Orden de vértices de pared | `CODE: src/iso/solids.ts:58-70` — `extrude` lleva la huella al orden canónico y emite `[a z0, b z0, b z0+h, a z0+h]`; `cylinder` y `poly` pasan por `extrude` |
| 6 | Normal copiada | `CODE: src/iso/facade.ts:47` — `mk` usa `normal: wall.normal`; `tessellate` filtra por `f.normal` (`solids.ts:321`) |
| 7 | Ventana relativa | `CODE: src/iso/facade.ts:15-16` — `WINDOW_W = 0.5` fracción del ancho de columna; siempre dentro de la pared |
| 8 | 2..3 pisos | `ISSUE: "con floors 2..3, 0 en el piso 0 y +1 en los demás; con 1 piso, 0"` |
| 9 | Clamp | `CODE: src/map/palette-iso.ts:80-83` — `stepTone` clampea a `TONE_LADDER` de 5; pilares y arcos pueden fundirse en `shade` hasta #36 → assumption |
| 10 | Pórtico estricto | `CODE: src/iso/facade.ts:51` — `i === 0 && f.base === "portico"` |
| 11 | `facadeAccents` con arcade y `litFloor: 0` | `CODE: src/iso/facade.ts:63-66` — usa `windowPatches(…, litFloor)` → `[]`; se agregó el `expect` en Task 2 |
| 12 | Vidriera no es ventana | `ISSUE: "nunca la vidriera ni la banda de pórtico/arcada"`; el test de conteo cubre `glass` |
| 13 | `cols`/`floors` 0 | NO SOURCE → assumption (sin validación, entrada interna) |
| 14 | Escenas y presupuesto | `CODE:` grep de `facade|toneOffset` en `src/scenes/*.test.ts`: solo miran `s.facade` del sólido (city 53/69/82, district 36-77, tech 41, fair 50, hinterland 68, ships 28-51); `ISSUE (#35, nicolas-ricc): "#49 Cierre: presupuesto, capturas…"` |
| 15 | Fixture y floats | `CODE: src/iso/facade.test.ts:6` — `tower` `h 6, floors 3, cols 2`; `src/iso/facade.ts:14` — `SLAB_H = 0.3`; `extrude` es puro y determinista |
| 16 | Ajustar conteos de escena | `ISSUE: "si alguno cuenta caras o toneOffset de fachada, ajustarlo documentando por qué"` |

Por fuente: ISSUE 4, CODE 10, NO SOURCE 2 (ambas technical assumptions). Spec ambiguities: 0. Issues abiertos: ninguno.

Assumptions: `withFacade` compartido; arco de 9 puntos; escalera de cinco tonos hasta #36; sin validación de `floors`/`cols`; presupuesto medido en #49.

Resultado: `ok`.
