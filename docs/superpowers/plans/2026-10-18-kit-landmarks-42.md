# Kit: familia `landmarks` (mercado, estación, teatro, palacio cívico, biblioteca, torre de agua, puente peatonal) (#42) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al kit la familia `landmarks` (`src/kit/forms/landmarks.ts`): siete recetas singulares con `landmark: true`, registradas en `RECIPES`, con su fila en `lab/kit.html` (la torre de agua y el puente peatonal en lotes propios, tabla `LAB_LOTS`).

**Architecture:** Cada receta es una función pura `(lot, rng, style) => Piece` como las de `src/kit/forms/modern.ts`: arma sólidos con medidas fijas dentro del lote, publica paredes y ventanas con `addBuilding`, y `landmarkTop` en su punto más alto. Un helper nuevo `fitToCap` (en `src/kit/piece.ts`) achata en z la pieza ya armada cuando no entra en `min(lot.maxH, 24)`, así medidas fijas cumplen el contrato con manzanas topadas. `LAB_LOTS` (en `src/kit/index.ts`) da su lote a las dos recetas que no van en el lote estándar; lo leen el test genérico y la escena del lab.

**Tech Stack:** TypeScript estricto, Vitest (`npm test`), `npm run typecheck`, Pixi v8 solo en `src/lab/kit.ts` (no se toca).

**Spec:** issue #42 (manda donde difiera) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §5.

## Global Constraints

- `src/iso/` no importa Pixi; ningún test importa Pixi.
- Ningún literal hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts` (`src/map/palette-guard.test.ts`).
- `Math.random` prohibido: toda aleatoriedad sale del `Rng` recibido.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo.
- Nada de dependencias nuevas.
- Commits `feat(#42): …` / `test(#42): …` / `docs(#42): …`.
- `npm test` y `npm run typecheck` en verde al final de cada task (salvo los tests de evals de tasks posteriores, que siguen en rojo hasta su task).
- Contrato de toda receta (`src/kit/kit.test.ts`): todo sólido y `ground` dentro del lote ampliado 0.8; nada bajo `lot.z`; `max.z ≤ lot.z + min(lot.maxH, 24)` para landmarks; determinista; ventanas/paredes solo con normal `x > 0` o `y > 0` y de un sólido con fachada; sin `windowWarm`/`windowCool` en `accents`; ningún sólido ajeno en el hueco de un `poly` cóncavo; salida en `lot.z + 0.3` = salida desplazada 0.3.
- `sortByDepth` ordena por AABB: los sólidos de una receta se tocan pero no se interpenetran (ninguna caja entra en otra).

## Decisiones de implementación (declaradas)

1. **`fitToCap(p, lot)`** en `src/kit/piece.ts`: si el punto más alto de sólidos y suelo pasa `lot.z + min(lot.maxH, 24)`, escala toda coordenada z de la pieza (sólidos, suelo, acentos, ventanas, paredes y su `floorH`, slots, `landmarkTop`) relativa a `lot.z` por `k = cap / alto`. Las normales no se tocan. Las siete recetas lo aplican al final. Sin tope bajo (lo de hoy: `maxH 24`) no cambia nada: todas miden ≤ 18.5.
2. **`landmarkTop`** = punto más alto de los sólidos de la pieza (los acentos no cuentan). En el puente: centro del tablero en x/y, a la altura del tope de la baranda (el issue pide "en el medio del tablero" y "el punto más alto ±1e-6"; las dos se cumplen así).
3. **Mercado en lote de 15 de fondo**: nave central 9 + dos laterales de 4 suman 17 > 15 + 2·0.8. Las naves laterales miden `min(4, (d − 9)/2)` (3 en la ciudad, 4 en el lab), bóveda del mismo ancho que su nave. La nave sur mide `w − 5` para dejar la torre del reloj en la esquina SE; la torre ocupa la esquina SE del conjunto.
4. **Estación**: "hall 11×d" con `d` = fondo del edificio = fondo del lote menos una franja de 3 del lado del frente (marquesina de vuelo 2 y faroles, que si no saldrían del lote). Frente = `lot.open[0] ?? "s"`, cualquiera de los cuatro lados. La bóveda del hall se parte en dos medias bóvedas (norte y sur) y el tambor de la cúpula (r 4, h 3.5) arranca del techo del hall en el medio: así ninguna caja entra en otra. Bóveda h 3. Alas a cada lado del hall con 0.5 de separación que cierra el vuelo de `hipRoof`. Hall con fachada `floors 2, cols 2, base "arcade"` (las dos columnas dejan libre el centro de la cara sur para el reloj), alas `floors 1, cols 3`.
5. **Teatro mirando al este**: tambor (diámetro 12.56) + columnata (5) + escalinata (2) suman 19.56 de fondo: no entran en 15 ni en 18, sí en 21 y 24 de ancho. El conjunto se arma de oeste a este con la columnata de 15 a lo largo de y y el frente al este (cara que mira a la cámara). El cartel `props.sign` solo miraba al sur: gana un parámetro `face: "s" | "e"` (por defecto `"s"`, salida idéntica).
6. **Palacio cívico**: chaflán de 3 en la esquina SE (la que mira a la cámara, entre los frentes sur y este); escalinata al sur. "`hipRoof` perimetral" = cuatro alas de cubierta a cuatro aguas de 2.5 de ancho alrededor del techo, que no se solapan (a `hipRoof` se le pasa la huella achicada 0.5 para que con su vuelo quede justa); cúpula sobre tambor en el hueco del medio, apoyada en la cornisa. El edificio ocupa todo el fondo menos 2 de escalinata (el hueco tiene que medir ≥ 7.73 para el tambor de r 4). Los dos faroles flanquean la escalinata al pie.
7. **Biblioteca**: alas oeste, norte y este de 5 (h 7, `marble`, `floors 2`, `base "arcade"`), pórtico al sur de 3 de fondo (h 4, `base "portico"`). Cornisa (h 0.4) que vuela 0.5 solo hacia afuera, así el patio queda libre de sólidos. `courtyard` = el rectángulo entre alas y pórtico; baldosas `paving` en `ground` y dos `patioTree` a 1/3 y 2/3 del patio.
8. **Puente peatonal — arcos**: la fórmula del issue (`z = tablero − r·sin(π(k+0.5)/6)` con `r = vano/2 = 8.2` en 54) pone las losas del medio 6 por debajo de `lot.z` y cuelga el arco al revés (el centro más bajo). Se conserva la construcción (seis losas verticales de ancho `vano/6` y fondo `d − 0.4` por vano, borde inferior en medio arco escalonado) con el arco derecho y achatado a lo que hay entre `lot.z` y el tablero: la losa `k` arranca en `z = lot.z + R·sin(π(k+0.5)/6)` con `R = 2.2 − 0.4` y sube hasta el tablero (0.4 de anillo en la clave). Pilas en `x + i·(vano + 1.2)`, `vano = (w − 4·1.2)/3`.
9. **Puente — baranda y guirnalda**: "baranda 0.3 × 0.3 × 1" = postes de 0.3×0.3 h 1 cada 3 sobre los dos bordes del tablero. "tablero" en las fórmulas es la cara inferior del tablero (`lot.z + 2.2`): guirnalda a `lot.z + 3.4` sobre la línea de postes del borde sur.
10. **Reloj compartido**: el octógono `amberBleed` alpha 0.9 de `classic` pasa a `props.clock(cx, southY, cz)` y lo usan `classic` (salida idéntica), `market` y `station`.
11. **Materiales**: los que el issue fija van literales (`steel`, `copper`, `marble`, `stone`); el resto sale del estilo: cuerpos `style.mat` con `tone: style.tone`, bóvedas, cúpulas y techos `style.roof`, cornisas, marquesinas y escalinatas `style.trim`. `rng` solo lo usa la biblioteca (baldosas); las demás ignoran `rng` (como `constructionSite`).
12. **Lab**: lote propio de `LAB_LOTS` centrado en su celda (x: si es más angosto que 24; y: siempre). Zócalo `paving` del tamaño del lote propio. Una entrada con `z` propia (el puente, `z −1`) va sin zócalo. El puente es la última receta de su fila, así ocupa dos celdas sin correr a nadie.

## Assumptions

Respuestas sin fuente escrita de la revisión del plan, decididas como técnicas (cualquier opción razonable cumple el issue). Van también en el PR.

- **Lotes de la familia**: toda receta salvo torre y puente se diseña para lotes de 21×15 o mayores (el issue: "lote útil 21×15 salvo donde se indica"; el genérico corre 21×15 y 24×18, `src/kit/kit.test.ts:11-14`). Con menos fondo, mercado (`side < 3`) y estación (`half ≤ 0`) no tienen sentido; no se valida ni se degrada. Descartada: recetas que se adaptan a cualquier lote (ningún lote menor llega: la spec §6 los pone en manzanas fijas).
- **Desvíos de medidas del issue** (decisiones 3, 5, 8): cada uno lo fuerza una regla explícita del issue (todo dentro del lote +0.8, nada bajo `lot.z`); se elige el cambio que conserva las demás medidas literales. Descartadas: achicar el tambor del teatro para que mire al sur (cambia r 6.5); naves laterales que salen del lote; la fórmula literal del arco (slabs bajo `lot.z`, arco colgado).
- **`fitToCap` achata en lugar de recortar o fallar**: ninguna manzana landmark tiene tope bajo en la spec §6 (teatro `72, 218`, palacio `162, 218`, biblioteca `42, 242`; el tope 10 es para `row 3, x 96..162`), pero el contrato genérico corre `maxH 10` (`src/kit/kit.test.ts`, "con maxH 10"). Achatar conserva la composición; los acentos se achatan con la pieza (el reloj queda elíptico): aceptado para un caso que hoy no llega. Descartadas: recortar sólidos (rompe cúpulas), tirar error (rompe el contrato genérico), eximir a landmarks (contradice el test genérico del issue).
- **Tests de evals primero**: los tests de todas las tasks se escriben y commitean en rojo antes de implementar (`test(#42): evals`); cada task los pone en verde. Si el trabajo se corta a mitad, la rama queda con tests en rojo de las tasks pendientes y nada roto de lo existente.
- **Puente en el lab sin agua**: el lab no dibuja agua ni suelo bajo z 0 (`src/lab/kit-scene.ts`: solo zócalos `paving`); las pilas bajan a z −1 sobre el fondo. Descartado: pintar agua en el lab (no lo pide el issue).

## Review Focus

1. **Manzana topada** (`maxH` < alto natural, p. ej. 10): toda receta achatada sigue dentro del tope y `landmarkTop` sigue siendo el punto más alto. Cubierto por el test genérico con `maxH 10` (Task 2 en adelante) y el de `landmarkTop` con `maxH 10` (Tasks 2–5).
2. **Estación con frente en cualquier lado** (`open` `["e"]`, `["n"]`, `["w"]`, o vacío): sigue dentro del lote; la marquesina baja hacia ese lado. Test en Task 3.
3. **Torre de agua en el mínimo de 5×5**: cabe con el +0.8. Test en Task 2.
4. **Puente en lotes distintos de 54×5** (40×4, 60×6): tres vanos iguales, 18 losas, nada bajo `lot.z`. Test en Task 2.
5. **Arco del puente derecho, no colgado**: borde inferior de las losas simétrico en cada vano y más alto en el medio. Test en Task 2.

---

### Task 1: `props.clock`, `props.sign(face)` y `fitToCap`

**Files:**
- Modify: `src/kit/props.ts` (agregar `clock`; `sign` con `face`)
- Modify: `src/kit/forms/modern.ts` (`classic` usa `clock`)
- Modify: `src/kit/piece.ts` (agregar `fitToCap`)
- Test: `src/kit/props.test.ts`, `src/kit/piece.test.ts` (nuevo)

**Interfaces:**
- Produces: `clock(cx: number, southY: number, cz: number): Accent`; `sign(at: Vec3, w: number, h: number, face?: "s" | "e"): Lit`; `fitToCap(p: Piece, lot: Lot): Piece`.

- [ ] **Step 1: Tests (ya escritos en el commit de evals; verificar que están).** En `props.test.ts`:

```ts
  it("reloj: octógono amberBleed alpha 0.9 de radio 1.2, 0.02 delante de la cara sur", () => {
    const c = clock(5, 10, 3);
    if (c.kind !== "poly") throw new Error("reloj no poly");
    expect(c).toMatchObject({ color: "amberBleed", alpha: 0.9 });
    expect(c.pts).toHaveLength(8);
    expect(new Set(c.pts.map((p) => p.y))).toEqual(new Set([10.02]));
    for (const p of c.pts) expect(Math.hypot(p.x - 5, p.z - 3)).toBeCloseTo(1.2, 9);
  });

  it("cartel mirando al este: caja de 0.4 en x, w a lo largo de y, panel coplanar en x delante de la caja", () => {
    const s = sign(AT, 4, 1.2, "e");
    expect(only(s.solids)).toMatchObject({ kind: "prism", at: AT, w: 0.4, d: 4, h: 1.2, mat: "officeDark" });
    const a = s.accents[0]!;
    if (a.kind !== "poly") throw new Error("cartel no poly");
    expect(new Set(a.pts.map((p) => p.x))).toEqual(new Set([AT.x + 0.42]));
    expect(Math.min(...a.pts.map((p) => p.y))).toBeCloseTo(AT.y + 0.3, 9);
    expect(Math.max(...a.pts.map((p) => p.y))).toBeCloseTo(AT.y + 4 - 0.3, 9);
  });
```

En `src/kit/piece.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { bounds } from "../iso/solids";
import { prism } from "../scenes/city-pieces";
import { emptyPiece, fitToCap } from "./piece";
import type { Lot } from "./types";

const LOT: Lot = { x: 0, y: 0, w: 10, d: 10, z: 2, open: ["s"], maxH: 10 };

describe("fitToCap", () => {
  it("una pieza que entra en el tope sale igual", () => {
    const p = emptyPiece();
    p.solids.push(prism(0, 0, 2, 4, 4, 8, "stone"));
    expect(fitToCap(p, LOT)).toEqual(p);
  });

  it("una pieza más alta que el tope se achata en z relativa a lot.z: sólidos, acentos, paredes y landmarkTop", () => {
    const p = emptyPiece();
    p.solids.push(prism(0, 0, 2, 4, 4, 20, "stone"), { kind: "dome", at: v3(2, 2, 22), r: 2, h: 0, mat: "copper" });
    p.accents.push({ kind: "dot", at: v3(1, 1, 12), r: 0.5, color: "amber" });
    p.walls.push({ pts: [v3(4, 0, 2), v3(4, 4, 2), v3(4, 4, 22), v3(4, 0, 22)], normal: v3(1, 0, 0), floorH: 4, building: 0 });
    p.landmarkTop = v3(2, 2, 22);
    const q = fitToCap(p, LOT);
    expect(Math.max(...q.solids.map((s) => bounds(s).max.z))).toBeCloseTo(12, 9);
    expect(q.solids[0]).toMatchObject({ at: { x: 0, y: 0, z: 2 }, h: 10 });
    expect(q.accents[0]).toMatchObject({ at: { x: 1, y: 1, z: 7 }, r: 0.5 });
    expect(q.walls[0]!.pts.map((p) => p.z)).toEqual([2, 2, 12, 12]);
    expect(q.walls[0]!.floorH).toBeCloseTo(2, 9);
    expect(q.walls[0]!.normal).toEqual(v3(1, 0, 0));
    expect(q.landmarkTop!.z).toBeCloseTo(12, 9);
  });
});
```

Y `clock` en el import de `props.test.ts`.

En `src/kit/kit.test.ts` (bloque `modern`), fijar el reloj de `classic` para que la mudanza a `props.clock` quede verificada:

```ts
  it("clásico: el reloj es un octógono amberBleed alpha 0.9 de radio 1.2, 0.02 delante de la cara sur del cuerpo", () => {
    for (const seed of SEEDS) {
      const p = recipe("classic")(LOTS[0]!, createRng(seed), STYLES.distrito);
      const body = p.solids.find((s) => s.kind === "prism" && !!s.facade)!;
      const c = p.accents.find((a) => a.kind === "poly" && a.color === "amberBleed");
      if (!c || c.kind !== "poly" || body.kind !== "prism") throw new Error("sin reloj");
      expect(c.alpha).toBe(0.9);
      expect(c.pts).toHaveLength(8);
      for (const q of c.pts) expect(q.y).toBeCloseTo(body.at.y + body.d + 0.02, 9);
      const cx = body.at.x + body.w / 2, cz = c.pts[0]!.z;
      for (const q of c.pts) expect(Math.hypot(q.x - cx, q.z - cz)).toBeCloseTo(1.2, 9);
    }
  });
```

(este pasa antes y después del cambio: es la red de la refactorización).

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run src/kit/props.test.ts src/kit/piece.test.ts` → FAIL (`clock`/`fitToCap` no existen; el cartel "e" tiene medidas del sur).

- [ ] **Step 3: Implementar.** En `src/kit/props.ts`, reemplazar `sign` y agregar `clock` debajo:

```ts
/** Cartel: caja oscura de 0.4 de fondo y el panel ámbar 0.02 delante de su cara sur (o este, con `face: "e"`, y `w` a lo largo de y). */
export function sign(at: Vec3, w: number, h: number, face: "s" | "e" = "s"): Lit {
  const z0 = at.z + 0.2, z1 = at.z + h - 0.2;
  if (face === "e") {
    const x = at.x + 0.42;
    return {
      solids: [prism(at.x, at.y, at.z, 0.4, w, h, "officeDark")],
      accents: [{ kind: "poly", pts: [v3(x, at.y + 0.3, z0), v3(x, at.y + w - 0.3, z0), v3(x, at.y + w - 0.3, z1), v3(x, at.y + 0.3, z1)], color: "amber", alpha: 1 }],
    };
  }
  const y = at.y + 0.42;
  return {
    solids: [prism(at.x, at.y, at.z, w, 0.4, h, "officeDark")],
    accents: [{ kind: "poly", pts: [v3(at.x + 0.3, y, z0), v3(at.x + w - 0.3, y, z0), v3(at.x + w - 0.3, y, z1), v3(at.x + 0.3, y, z1)], color: "amber", alpha: 1 }],
  };
}

/** Reloj: octógono `amberBleed` de radio 1.2 centrado en (cx, cz), 0.02 delante de una cara sur en `southY`. */
export function clock(cx: number, southY: number, cz: number): Accent {
  return { kind: "poly", pts: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return v3(cx + 1.2 * Math.cos(a), southY + 0.02, cz + 1.2 * Math.sin(a)); }), color: "amberBleed", alpha: 0.9 };
}
```

En `src/kit/forms/modern.ts` (`classic`), reemplazar las dos líneas del reloj:

```ts
  const cz = top - fh / 2, cx = bx + bw / 2; // reloj en la cara sur, último piso
  p.accents.push(clock(cx, by + bd, cz));
```

(y sumar `clock` al import de `../props`).

En `src/kit/piece.ts` agregar (imports: `v3, type Vec3` de `../iso/geometry`, `bounds` de `../iso/solids`, `Lot` de `./types`):

```ts
/**
 * Si la pieza pasa el tope `min(lot.maxH, LANDMARK_MAX_H)`, la achata en z
 * (relativa a `lot.z`) para que entre justa: un landmark de medidas fijas
 * respeta así una manzana topada. Las normales no cambian.
 */
export function fitToCap(p: Piece, lot: Lot): Piece {
  const cap = Math.min(lot.maxH, LANDMARK_MAX_H);
  const top = Math.max(...[...p.solids, ...p.ground].map((s) => bounds(s).max.z)) - lot.z;
  if (top <= cap) return p;
  const k = cap / top, z = (n: number): number => lot.z + (n - lot.z) * k, P = (q: Vec3): Vec3 => v3(q.x, q.y, z(q.z));
  const solid = (s: Solid): Solid => {
    switch (s.kind) {
      case "poly": return { ...s, z: z(s.z), h: s.h * k };
      case "strip": return { ...s, z: z(s.z) };
      case "ground": return { ...s, tris: s.tris.map((t) => ({ ...t, pts: [P(t.pts[0]), P(t.pts[1]), P(t.pts[2])] })) };
      case "wheel": return { ...s, at: P(s.at) };
      default: return { ...s, at: P(s.at), h: s.h * k };
    }
  };
  return {
    ...p,
    solids: p.solids.map(solid),
    ground: p.ground.map(solid),
    accents: p.accents.map((a) => (a.kind === "dot" ? { ...a, at: P(a.at) } : { ...a, pts: a.pts.map(P) })),
    windows: p.windows.map((w) => ({ ...w, pts: w.pts.map(P) })),
    walls: p.walls.map((w) => ({ ...w, pts: w.pts.map(P), floorH: w.floorH * k })),
    slots: p.slots.map((s) => ({ ...s, pts: s.pts.map(P) })),
    ...(p.landmarkTop ? { landmarkTop: P(p.landmarkTop) } : {}),
  };
}
```

- [ ] **Step 4: Correr.** `npx vitest run src/kit` → los dos archivos en verde; `kit.test.ts` (clásico) sigue en verde. `npm run typecheck` en verde.

- [ ] **Step 5: Commit.** `git add src/kit && git commit -m "feat(#42): props.clock, sign mirando al este y fitToCap"`

---

### Task 2: `landmarks.ts` con `waterTower` y `footbridge`, `LAB_LOTS`, registro y test genérico

**Files:**
- Create: `src/kit/forms/landmarks.ts`
- Modify: `src/kit/index.ts` (`LAB_LOTS`, `LANDMARKS` en `RECIPES`)
- Modify: `src/kit/kit.test.ts` (lotes por receta)
- Test: `src/kit/forms/landmarks.test.ts` (nuevo, del commit de evals)

**Interfaces:**
- Consumes: `fitToCap`, `addBuilding`, `emptyPiece` (`../piece`); `beacon`, `garland`, `place` (`../props`); `prism` (`../../scenes/city-pieces`).
- Produces: `export const LANDMARKS: RecipeDef[]` en `landmarks.ts`; `export const LAB_LOTS: Readonly<Record<string, { w: number; d: number; z?: number }>>` en `index.ts` con `waterTower: { w: 6, d: 6 }`, `footbridge: { w: 54, d: 5, z: -1 }`.

- [ ] **Step 1: Tests (del commit de evals).** En `kit.test.ts`, el bloque por receta usa `lotsFor(def.name)` en lugar de `LOTS` (en `runs`, en "determinista", en "maxH 10" y en "lot.z = 0.3"):

```ts
/** Los lotes del contrato: los de la ciudad y el lab, o el lote propio de LAB_LOTS en esas dos posiciones. */
const lotsFor = (name: string): Lot[] => {
  const own = LAB_LOTS[name];
  return own ? LOTS.map((l) => ({ ...l, w: own.w, d: own.d, z: own.z ?? 0 })) : LOTS;
};
```

`landmarks.test.ts` cubre torre y puente:

```ts
  it("torre de agua: cabe en 6×6 y en 5×5 (+0.8), mide ≤ 16, cuatro patas steel h 9, tanque cylinder 8 lados r 2.2 h 4, cúpula copper y baliza", () => {
    for (const [w, d] of [[6, 6], [5, 5]] as const) for (const id of STYLE_IDS) {
      const lot = { ...LOT, w, d }, p = recipe("waterTower")(lot, createRng(1), STYLES[id]);
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - 0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + w + 0.8 + EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - 0.8 - EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + d + 0.8 + EPS);
      }
      expect(top(p) - lot.z).toBeLessThanOrEqual(16);
      expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.w === 0.4 && s.d === 0.4 && s.h === 9)).toHaveLength(4);
      expect(p.solids.some((s) => s.kind === "cylinder" && s.sides === 8 && s.r === 2.2 && s.h === 4 && s.mat === STYLES[id].mat)).toBe(true);
      expect(p.solids.some((s) => s.kind === "dome" && s.mat === "copper" && s.r === 2.2 && s.h === 1.2)).toBe(true);
      expect(p.accents.some((a) => a.kind === "dot" && a.at.z > top(p))).toBe(true);
    }
  });

  it("puente en 54×5 a z −1: tablero continuo de 54, cuatro pilas desde z −1, 18 losas de arco, max z ≤ lot.z + 4", () => {
    const lot = { ...LOT, x: 0, y: 0, w: 54, d: 5, z: -1 }, p = recipe("footbridge")(lot, createRng(1), STYLES.ribera);
    expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.w === 54 && s.d === 4 && s.h === 0.4 && Math.abs(s.at.z - 1.2) < EPS)).toHaveLength(1);
    expect(p.solids.filter((s) => s.kind === "prism" && s.w === 1.2 && s.d === 5 && s.at.z === -1 && Math.abs(s.h - 2.2) < EPS)).toHaveLength(4);
    expect(slabs(p, lot)).toHaveLength(18);
    expect(top(p)).toBeLessThanOrEqual(lot.z + 4 + EPS);
    expect(p.accents.length).toBeGreaterThan(0);
    expect(p.accents.every((a) => a.kind === "dot" && Math.abs(a.at.z - 2.4) < EPS && Math.abs(a.at.y - 4.35) < EPS)).toBe(true);
  });

  it("puente: el borde inferior de las losas es un arco derecho, simétrico en cada vano y más alto en la clave", () => {
    for (const [w, d] of [[54, 5], [40, 4], [60, 6]] as const) {
      const lot = { ...LOT, x: 0, y: 0, w, d, z: -1 }, s = slabs(recipe("footbridge")(lot, createRng(1), STYLES.ribera), lot);
      expect(s).toHaveLength(18);
      for (let v = 0; v < 3; v++) {
        const zs = s.slice(v * 6, v * 6 + 6).map((q) => q.at.z);
        for (let k = 0; k < 3; k++) expect(zs[k]).toBeCloseTo(zs[5 - k]!, 9);
        expect(zs[0]!).toBeLessThan(zs[1]!);
        expect(zs[1]!).toBeLessThan(zs[2]!);
        expect(zs[0]!).toBeGreaterThanOrEqual(lot.z);
      }
    }
  });
```

con, arriba del archivo:

```ts
const slabs = (p: Piece, lot: Lot) => p.solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && Math.abs(s.d - (lot.d - 0.4)) < EPS).sort((a, b) => a.at.x - b.at.x);
```

El test "con lot.z = 0.3 …" pasa a desplazar desde el `z` del lote (con el puente, `z −1`, el lote fijo en 0.3 desplazaría 1.3):

```ts
          const up = def.recipe({ ...lot, z: lot.z + 0.3 }, createRng(seed), STYLES.centro);
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run src/kit` → FAIL (`LAB_LOTS` no exportado, recetas desconocidas).

- [ ] **Step 3: Implementar** `src/kit/forms/landmarks.ts`:

```ts
import { v3 } from "../../iso/geometry";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import { emptyPiece, fitToCap } from "../piece";
import { beacon, garland, place } from "../props";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/**
 * Familia `landmarks`: las estructuras singulares que la zonificación pone en
 * manzanas fijas (spec §5, issue #42). Medidas fijas; `fitToCap` las achata si
 * la manzana tiene un tope más bajo que su alto.
 */

/** Torre de agua ornamental para un lote chico (≥ 5×5): cuatro patas, tanque, cúpula y baliza. */
export function waterTower(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, cx = lot.x + lot.w / 2, cy = lot.y + lot.d / 2;
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) p.solids.push(prism(cx + dx * 1.75 - 0.2, cy + dy * 1.75 - 0.2, z, 0.4, 0.4, 9, "steel"));
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + 9), r: 2.2, h: 4, mat: style.mat, sides: 8 }, { kind: "dome", at: v3(cx, cy, z + 13), r: 2.2, h: 1.2, mat: "copper", sides: 8, rings: 2 });
  place(p.solids, p.accents, beacon(v3(cx, cy, z + 14.7)));
  p.landmarkTop = v3(cx, cy, z + 14.2);
  return fitToCap(p, lot);
}

const DECK_Z = 2.2, DECK_H = 0.4, PIER_W = 1.2, SLABS = 6, ARCH_RING = 0.4, POST_STEP = 3;

/**
 * Puente peatonal a lo largo de x (lote ≥ 40 × 4..6): tablero sobre tres arcos
 * de piedra entre cuatro pilas. Cada vano son seis losas verticales cuyo borde
 * inferior sigue un medio arco escalonado, achatado a la altura entre `lot.z`
 * y el tablero (con 0.4 de anillo en la clave).
 */
export function footbridge(lot: Lot, _rng: Rng, _style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot, deck = z + DECK_Z;
  p.solids.push(prism(x, y + 0.5, deck, w, d - 1, DECK_H, "stone"));
  const span = (w - 4 * PIER_W) / 3, rise = DECK_Z - ARCH_RING;
  for (let i = 0; i < 4; i++) p.solids.push(prism(x + i * (span + PIER_W), y, z, PIER_W, d, DECK_Z, "stone"));
  for (let i = 0; i < 3; i++) for (let k = 0; k < SLABS; k++) {
    const sz = z + rise * Math.sin((Math.PI * (k + 0.5)) / SLABS);
    p.solids.push(prism(x + PIER_W + i * (span + PIER_W) + (k * span) / SLABS, y + 0.2, sz, span / SLABS, d - 0.4, deck - sz, "stone"));
  }
  const top = deck + DECK_H;
  for (const ry of [y + 0.5, y + d - 0.8]) for (let i = 0; i <= Math.floor((w - 0.3) / POST_STEP); i++) p.solids.push(prism(x + i * POST_STEP, ry, top, 0.3, 0.3, 1, "steel"));
  p.accents.push(...garland([v3(x, y + d - 0.65, deck + 1.2), v3(x + w, y + d - 0.65, deck + 1.2)]));
  p.landmarkTop = v3(x + w / 2, y + d / 2, top + 1);
  return fitToCap(p, lot);
}

export const LANDMARKS: readonly RecipeDef[] = [
  { name: "waterTower", recipe: waterTower, family: "landmarks", landmark: true },
  { name: "footbridge", recipe: footbridge, family: "landmarks", landmark: true },
];
```

Revisar la aritmética del test de la guirnalda: con `y 0`, `d 5`, `z −1`: `y + d − 0.65 = 4.35`, `deck + 1.2 = −1 + 2.2 + 1.2 = 2.4`.

En `src/kit/index.ts`:

```ts
import { LANDMARKS } from "./forms/landmarks";
import { MODERN } from "./forms/modern";
import type { Recipe, RecipeDef } from "./types";

/** Todas las recetas del kit. Cada familia nueva agrega su línea; el test genérico (kit.test.ts) la cubre al registrarse. */
export const RECIPES: readonly RecipeDef[] = [...MODERN, ...LANDMARKS];

/** Lote propio de las recetas que no van en el lote estándar: lo usan el lab y el test genérico. `z`: dónde apoya (el puente, sobre el agua). */
export const LAB_LOTS: Readonly<Record<string, { w: number; d: number; z?: number }>> = {
  waterTower: { w: 6, d: 6 },
  footbridge: { w: 54, d: 5, z: -1 },
};
```

(el resto de `index.ts` igual).

- [ ] **Step 4: Correr.** `npx vitest run src/kit src/lab` → verdes los tests de torre, puente y el genérico; los de recetas de Tasks 3–5 siguen en rojo. En `src/lab/kit-scene.test.ts` el test del zócalo modificado en evals sigue verde (excluye las recetas de `LAB_LOTS`); solo los dos tests nuevos de lotes propios siguen en rojo hasta Task 6. `npm run typecheck` verde.

- [ ] **Step 5: Commit.** `git add src/kit && git commit -m "feat(#42): torre de agua y puente peatonal, LAB_LOTS y registro de landmarks"`

---

### Task 3: `market` y `station`

**Files:**
- Modify: `src/kit/forms/landmarks.ts`
- Test: `src/kit/forms/landmarks.test.ts` (del commit de evals)

**Interfaces:**
- Consumes: `addBuilding`, `fitToCap`; `clock`, `lamp`, `place` (`../props`); `hipRoof`, `pyramid` (`../roofs`); `Facade` (`../../iso/facade`); `Side` (`../types`).
- Produces: `market`, `station` registradas en `LANDMARKS` antes de `waterTower`.

- [ ] **Step 1: Tests (del commit de evals).**

```ts
  it("mercado: nave central con bóveda x w 9 h 3.5 de 8 segmentos sobre cuerpo h 5 arcade, dos naves con bóveda h 1.5 de 6, torre 3×3 h 14 con pirámide y reloj", () => {
    for (const lot of [LOT, LAB]) {
      const p = recipe("market")(lot, createRng(1), STYLES.ribera);
      const vaults = p.solids.filter((s): s is Solid & { kind: "vault" } => s.kind === "vault");
      expect(vaults.filter((v) => v.axis === "x" && v.w === 9 && v.h === 3.5 && v.segments === 8 && v.len === lot.w - 4)).toHaveLength(1);
      expect(vaults.filter((v) => v.axis === "x" && v.h === 1.5 && v.segments === 6)).toHaveLength(2);
      expect(p.solids.some((s) => s.kind === "prism" && s.h === 5 && s.facade?.base === "arcade")).toBe(true);
      const tower = p.solids.find((s) => s.kind === "prism" && s.w === 3 && s.d === 3 && s.h === 14);
      expect(tower).toBeDefined();
      expect(p.solids.some((s) => s.kind === "cone" && s.sides === 4)).toBe(true);
      const clk = p.accents.find((a) => a.kind === "poly" && a.color === "amberBleed");
      expect(clk && clk.kind === "poly" && clk.pts.every((q) => Math.abs(q.y - (tower!.kind === "prism" ? tower!.at.y + 3.02 : NaN)) < EPS)).toBe(true);
    }
  });

  it("estación: hall 11 con bóveda y, cúpula r 4 h 3 de 12 lados y 3 anillos sobre tambor, dos alas h 4 con hip, reloj, marquesina h 0.4 de vuelo 2 al sur y cuatro faroles", () => {
    const p = recipe("station")(LOT, createRng(1), STYLES.centro);
    expect(p.solids.some((s) => s.kind === "prism" && s.w === 11 && s.h === 6 && !!s.facade)).toBe(true);
    expect(p.solids.filter((s) => s.kind === "vault" && s.axis === "y" && s.w === 11 && s.mat === STYLES.centro.roof).length).toBeGreaterThan(0);
    expect(p.solids.some((s) => s.kind === "dome" && s.r === 4 && s.h === 3 && s.sides === 12 && s.rings === 3)).toBe(true);
    expect(p.solids.some((s) => s.kind === "cylinder" && s.r === 4)).toBe(true);
    expect(p.solids.filter((s) => s.kind === "prism" && s.h === 4 && !!s.facade)).toHaveLength(2);
    expect(p.solids.filter((s) => s.kind === "prism" && s.roof === "hip")).toHaveLength(2);
    expect(p.accents.some((a) => a.kind === "poly" && a.color === "amberBleed")).toBe(true);
    const marquee = p.solids.filter((s) => s.kind === "ramp" && s.h === 0.4);
    expect(marquee).toHaveLength(1);
    expect(marquee[0]).toMatchObject({ dir: "s", d: 2 });
    expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 5)).toHaveLength(4);
  });

  it("estación: la marquesina va del lado open[0] y la pieza queda en el lote con cualquier frente", () => {
    for (const side of ["s", "e", "n", "w"] as const) for (const base of [LOT, LAB]) {
      const lot = { ...base, open: [side] }, p = recipe("station")(lot, createRng(1), STYLES.centro);
      expect(p.solids.find((s) => s.kind === "ramp" && s.h === 0.4)).toMatchObject({ dir: side });
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - 0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + 0.8 + EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - 0.8 - EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + 0.8 + EPS);
      }
    }
    expect(recipe("station")({ ...LOT, open: [] }, createRng(1), STYLES.centro).solids.find((s) => s.kind === "ramp" && s.h === 0.4)).toMatchObject({ dir: "s" });
  });
```

(`LAB` = `{ x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 }`.)

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run src/kit/forms/landmarks.test.ts` → FAIL (`receta desconocida: market`).

- [ ] **Step 3: Implementar** en `landmarks.ts` (antes de `waterTower`), sumando imports `type Facade` de `../../iso/facade`, `addBuilding` de `../piece`, `clock`, `lamp` de `../props`, `hipRoof`, `pyramid` de `../roofs`, `Side` de `../types`:

```ts
const NAVE_W = 9;

/** Mercado cubierto: nave central abovedada, dos naves laterales más bajas y la torre del reloj en la esquina SE. Lote de 15 de fondo o más. */
export function market(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, w, z } = lot, len = w - 4;
  const side = Math.min(4, (lot.d - NAVE_W) / 2); // en un lote de 15 las laterales de 4 no entran
  const y = lot.y + (lot.d - NAVE_W - 2 * side) / 2;
  const nave = (ny: number, nl: number, nw: number, h: number, vh: number, segments: number): void => {
    const f: Facade = { floors: 1, cols: Math.max(2, Math.round(nl / 3)), base: "arcade" };
    addBuilding(p, prism(x + 2, ny, z, nl, nw, h, style.mat, { facade: f, tone: style.tone }), f);
    p.solids.push({ kind: "vault", at: v3(x + 2, ny, z + h), len: nl, w: nw, h: vh, axis: "x", mat: style.roof, segments });
  };
  nave(y, len, side, 3.5, 1.5, 6);
  nave(y + side, len, NAVE_W, 5, 3.5, 8);
  nave(y + side + NAVE_W, len - 1, side, 3.5, 1.5, 6); // la sur termina contra la torre
  const tx = x + w - 3, ty = y + 2 * side + NAVE_W - 3;
  p.solids.push(prism(tx, ty, z, 3, 3, 14, style.mat), ...pyramid({ x: tx, y: ty, w: 3, d: 3, z: z + 14 }, 2.5, style.roof));
  p.accents.push(clock(tx + 1.5, ty + 3, z + 12.5));
  p.landmarkTop = v3(tx + 1.5, ty + 1.5, z + 16.5);
  return fitToCap(p, lot);
}

const HALL_W = 11, FRONT = 3;

/**
 * Estación: hall central abovedado con cúpula sobre tambor, dos alas con techo
 * a cuatro aguas, reloj en la cara sur del hall, marquesina y faroles del lado
 * `open[0]` (sur por defecto), en una franja de 3 que el edificio deja libre.
 * La bóveda se parte en dos para que el tambor apoye en el techo del hall.
 */
export function station(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, front: Side = lot.open[0] ?? "s", ns = front === "n" || front === "s";
  const b = { x: lot.x + (front === "w" ? FRONT : 0), y: lot.y + (front === "n" ? FRONT : 0), w: lot.w - (ns ? 0 : FRONT), d: lot.d - (ns ? FRONT : 0) };
  const hx = b.x + (b.w - HALL_W) / 2, cx = hx + HALL_W / 2, cy = b.y + b.d / 2;
  const hall: Facade = { floors: 2, cols: 2, base: "arcade" };
  addBuilding(p, prism(hx, b.y, z, HALL_W, b.d, 6, style.mat, { facade: hall, tone: style.tone }), hall);
  const half = (b.d - 8) / 2;
  for (const vy of [b.y, b.y + b.d - half]) p.solids.push({ kind: "vault", at: v3(hx, vy, z + 6), len: half, w: HALL_W, h: 3, axis: "y", mat: style.roof, segments: 8 });
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + 6), r: 4, h: 3.5, mat: style.mat, sides: 12 }, { kind: "dome", at: v3(cx, cy, z + 9.5), r: 4, h: 3, mat: style.roof, sides: 12, rings: 3 });
  const ww = (b.w - HALL_W) / 2 - 0.5, wing: Facade = { floors: 1, cols: 3 }; // el 0.5 libre lo cierra el vuelo del techo
  for (const wx of [b.x, b.x + b.w - ww]) {
    addBuilding(p, prism(wx, b.y, z, ww, b.d, 4, style.mat, { facade: wing, tone: style.tone }), wing);
    p.solids.push(...hipRoof({ x: wx, y: b.y, w: ww, d: b.d, z: z + 4 }, style.roof));
  }
  p.accents.push(clock(cx, b.y + b.d, z + 4.7));
  const mz = z + 3;
  if (ns) {
    p.solids.push({ kind: "ramp", at: v3(hx, front === "s" ? b.y + b.d : b.y - 2, mz), w: HALL_W, d: 2, h: 0.4, mat: style.trim, dir: front });
    const ly = front === "s" ? b.y + b.d + 2.2 : b.y - 2.8;
    for (let k = 0; k < 4; k++) place(p.solids, p.accents, lamp(v3(lot.x + (lot.w * (k + 0.5)) / 4 - 0.3, ly, z)));
  } else {
    p.solids.push({ kind: "ramp", at: v3(front === "e" ? b.x + b.w : b.x - 2, b.y, mz), w: 2, d: b.d, h: 0.4, mat: style.trim, dir: front });
    const lx = front === "e" ? b.x + b.w + 2.2 : b.x - 2.8;
    for (let k = 0; k < 4; k++) place(p.solids, p.accents, lamp(v3(lx, lot.y + (lot.d * (k + 0.5)) / 4 - 0.3, z)));
  }
  p.landmarkTop = v3(cx, cy, z + 12.5);
  return fitToCap(p, lot);
}
```

Registro: `{ name: "market", … }, { name: "station", … }` (ambas `family: "landmarks", landmark: true`) antes de `waterTower`.

- [ ] **Step 4: Correr.** `npx vitest run src/kit` → verdes mercado, estación y su contrato genérico. `npm run typecheck` verde.

- [ ] **Step 5: Commit.** `git commit -am "feat(#42): mercado cubierto y estación"`

---

### Task 4: `theatre` y `civicPalace`

**Files:**
- Modify: `src/kit/forms/landmarks.ts`
- Test: `src/kit/forms/landmarks.test.ts` (del commit de evals)

**Interfaces:**
- Consumes: `sign(at, w, h, "e")`, `lamp`, `place`, `hipRoof`, `addBuilding`, `fitToCap`; `Vec2` de `../../iso/geometry`.
- Produces: `theatre`, `civicPalace` registradas después de `station`.

- [ ] **Step 1: Tests (del commit de evals).**

```ts
  it("teatro: tambor cylinder 12 lados r 6.5 h 9 con fachada cols 1, cúpula copper r 6.5 h 4, columnata marble 15×5 h 5 arcade cols 5, marquesina con cartel y escalinata", () => {
    for (const lot of [LOT, LAB]) {
      const p = recipe("theatre")(lot, createRng(1), STYLES.civico);
      expect(p.solids.some((s) => s.kind === "cylinder" && s.sides === 12 && s.r === 6.5 && s.h === 9 && s.facade?.cols === 1)).toBe(true);
      expect(p.solids.some((s) => s.kind === "dome" && s.mat === "copper" && s.r === 6.5 && s.h === 4)).toBe(true);
      expect(p.solids.some((s) => s.kind === "prism" && s.mat === "marble" && s.h === 5 && s.facade?.base === "arcade" && s.facade.cols === 5 && Math.max(s.w, s.d) === 15 && Math.min(s.w, s.d) === 5)).toBe(true);
      expect(p.solids.filter((s) => s.kind === "ramp" && s.h === 0.4)).toHaveLength(1);
      expect(p.solids.filter((s) => s.kind === "ramp" && s.h === 1 && Math.min(s.w, s.d) === 2)).toHaveLength(1);
      expect(p.solids.some((s) => s.kind === "prism" && s.mat === "officeDark")).toBe(true);
      expect(p.accents.some((a) => a.kind === "poly" && a.color === "amber")).toBe(true);
      expect(p.windows.length).toBeGreaterThan(0);
    }
  });

  it("palacio cívico: poly de cinco vértices (chaflán) h 12 portico cols 5, cornisa h 1 con vuelo 0.8, cuatro hip, cúpula r 4 h 3.5 sobre tambor r 4 h 2, escalinata y dos faroles", () => {
    for (const lot of [LOT, LAB]) {
      const p = recipe("civicPalace")(lot, createRng(1), STYLES.civico);
      const body = p.solids.find((s): s is Solid & { kind: "poly" } => s.kind === "poly" && s.h === 12);
      expect(body?.footprint).toHaveLength(5);
      expect(body?.facade).toMatchObject({ base: "portico", cols: 5 });
      const cornice = p.solids.find((s): s is Solid & { kind: "poly" } => s.kind === "poly" && s.h === 1);
      expect(cornice).toBeDefined();
      const bb = bounds(body!), cb = bounds(cornice!);
      expect(bb.min.x - cb.min.x).toBeCloseTo(0.8, 9);
      expect(cb.max.y - bb.max.y).toBeCloseTo(0.8, 9);
      expect(p.solids.filter((s) => s.kind === "prism" && s.roof === "hip")).toHaveLength(4);
      expect(p.solids.some((s) => s.kind === "dome" && s.r === 4 && s.h === 3.5)).toBe(true);
      expect(p.solids.some((s) => s.kind === "cylinder" && s.r === 4 && s.h === 2)).toBe(true);
      expect(p.solids.filter((s) => s.kind === "ramp")).toHaveLength(1);
      expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 5)).toHaveLength(2);
    }
  });
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run src/kit/forms/landmarks.test.ts` → FAIL.

- [ ] **Step 3: Implementar** (después de `station`):

```ts
const DRUM_R = 6.5, DRUM_SIDES = 12;
/** Media anchura de un polígono regular con caras planas al N/S/E/O (como lo arma `cylinder`). */
const apothem = (r: number, sides: number): number => r * Math.cos(Math.PI / sides);

/**
 * Teatro: tambor con cúpula de cobre y, al este, la columnata con marquesina,
 * cartel y escalinata. Mira al este porque tambor + columnata + escalinata
 * (19.56) no entran en el fondo de un lote.
 */
export function theatre(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, half = apothem(DRUM_R, DRUM_SIDES);
  const x0 = lot.x + (lot.w - (2 * half + 5 + 2)) / 2, cx = x0 + half, cy = lot.y + lot.d / 2;
  const drum: Facade = { floors: 3, cols: 1 };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r: DRUM_R, h: 9, mat: style.mat, sides: DRUM_SIDES, facade: drum, tone: style.tone }, drum);
  p.solids.push({ kind: "dome", at: v3(cx, cy, z + 9), r: DRUM_R, h: 4, mat: "copper", sides: DRUM_SIDES, rings: 3 });
  const colX = x0 + 2 * half, colY = cy - 7.5, colonnade: Facade = { floors: 1, cols: 5, base: "arcade" };
  addBuilding(p, prism(colX, colY, z, 5, 15, 5, "marble", { facade: colonnade }), colonnade);
  const front = colX + 5;
  p.solids.push({ kind: "ramp", at: v3(front, colY, z), w: 2, d: 15, h: 1, mat: style.trim, dir: "e" }); // escalinata
  p.solids.push({ kind: "ramp", at: v3(front, cy - 4.5, z + 4), w: 1.5, d: 9, h: 0.4, mat: style.trim, dir: "e" }); // marquesina
  place(p.solids, p.accents, sign(v3(front, cy - 3.5, z + 4.4), 7, 1.5, "e"));
  p.landmarkTop = v3(cx, cy, z + 13);
  return fitToCap(p, lot);
}

const CHAMFER = 3, RING = 2.5;

/** Rectángulo x0..x1 × y0..y1 con la esquina SE cortada a 45° (`c`), crecido `o` hacia afuera. */
function chamfered(x0: number, y0: number, x1: number, y1: number, c: number, o = 0): Vec2[] {
  const k = o * (Math.SQRT2 - 1);
  return [{ x: x0 - o, y: y0 - o }, { x: x1 + o, y: y0 - o }, { x: x1 + o, y: y1 - c + k }, { x: x1 - c + k, y: y1 + o }, { x: x0 - o, y: y1 + o }];
}

/**
 * Palacio cívico: cuerpo con chaflán en la esquina SE, cornisa pesada, cubierta
 * a cuatro aguas perimetral en cuatro alas que no se tocan y, en el hueco del
 * medio, cúpula sobre tambor. Escalinata al sur con un farol a cada lado.
 */
export function civicPalace(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot;
  const x0 = lot.x + 0.5, x1 = lot.x + lot.w - 0.5, y0 = lot.y, y1 = lot.y + lot.d - 2, bw = x1 - x0, bd = y1 - y0;
  const facade: Facade = { floors: Math.max(2, Math.round(12 / style.floorH)), cols: 5, base: "portico" };
  addBuilding(p, { kind: "poly", footprint: chamfered(x0, y0, x1, y1, CHAMFER), z, h: 12, mat: style.mat, facade, tone: style.tone }, facade);
  p.solids.push({ kind: "poly", footprint: chamfered(x0, y0, x1, y1, CHAMFER, 0.8), z: z + 12, h: 1, mat: style.trim });
  const top = z + 13;
  // la huella va achicada 0.5: con el vuelo de hipRoof cada ala queda justa sobre su franja
  const rings = [[x0, y0, bw, RING], [x0, y1 - RING, bw - CHAMFER, RING], [x0, y0 + RING, RING, bd - 2 * RING], [x1 - RING, y0 + RING, RING, bd - RING - CHAMFER]] as const;
  for (const [rx, ry, rw, rd] of rings) p.solids.push(...hipRoof({ x: rx + 0.5, y: ry + 0.5, w: rw - 1, d: rd - 1, z: top }, style.roof));
  const cx = x0 + bw / 2, cy = y0 + bd / 2;
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, top), r: 4, h: 2, mat: style.mat, sides: 12 }, { kind: "dome", at: v3(cx, cy, top + 2), r: 4, h: 3.5, mat: style.roof, sides: 12, rings: 3 });
  const sx0 = x0 + 1.5, sx1 = x1 - CHAMFER - 1.5;
  p.solids.push({ kind: "ramp", at: v3(sx0, y1, z), w: sx1 - sx0, d: 2, h: 1, mat: style.trim, dir: "s" });
  for (const lx of [x0 + 0.45, sx1 + 0.45]) place(p.solids, p.accents, lamp(v3(lx, y1 + 0.7, z)));
  p.landmarkTop = v3(cx, cy, top + 5.5);
  return fitToCap(p, lot);
}
```

Imports a sumar: `sign` (props), `type Vec2` (geometry). Registro después de `station`.

- [ ] **Step 4: Correr.** `npx vitest run src/kit` → verdes teatro, palacio y su contrato. `npm run typecheck` verde.

- [ ] **Step 5: Commit.** `git commit -am "feat(#42): teatro y palacio cívico"`

---

### Task 5: `library` y orden final del registro

**Files:**
- Modify: `src/kit/forms/landmarks.ts`
- Test: `src/kit/forms/landmarks.test.ts` (del commit de evals)

**Interfaces:**
- Consumes: `tiles` (`../../scenes/city-pieces`), `patioTree` (`../props`), `addBuilding`, `fitToCap`.
- Produces: `library` registrada después de `civicPalace`; `LANDMARKS` en el orden final `market, station, theatre, civicPalace, library, waterTower, footbridge`.

- [ ] **Step 1: Tests (del commit de evals).**

```ts
  it("registra las siete recetas en el orden del issue, todas landmark", () => {
    const l = RECIPES.filter((r) => r.family === "landmarks");
    expect(l.map((r) => r.name)).toEqual(["market", "station", "theatre", "civicPalace", "library", "waterTower", "footbridge"]);
    expect(l.every((r) => r.landmark === true)).toBe(true);
  });

  it("biblioteca: tres alas marble arcade h 7 y pórtico h 4; publica courtyard sin sólidos adentro salvo árboles y baldosas", () => {
    for (const lot of [LOT, LAB]) for (const seed of SEEDS) {
      const p = recipe("library")(lot, createRng(seed), STYLES.civico), c = p.courtyard!;
      expect(c).toBeDefined();
      expect(p.solids.filter((s) => s.kind === "prism" && s.mat === "marble" && s.h === 7 && s.facade?.base === "arcade")).toHaveLength(3);
      expect(p.solids.filter((s) => s.kind === "prism" && s.h === 4 && s.facade?.base === "portico")).toHaveLength(1);
      const inside = (s: Solid) => { const b = bounds(s); return b.max.x > c.x + EPS && b.min.x < c.x + c.w - EPS && b.max.y > c.y + EPS && b.min.y < c.y + c.d - EPS; };
      const trees = p.solids.filter((s) => s.kind === "cone" && s.mat === "leaf");
      expect(trees).toHaveLength(2);
      for (const s of p.solids) if (inside(s)) expect(trees).toContain(s);
      expect(p.ground.some((g) => g.kind === "ground" && inside(g))).toBe(true);
    }
  });
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run src/kit/forms/landmarks.test.ts` → FAIL.

- [ ] **Step 3: Implementar** (después de `civicPalace`):

```ts
const WING = 5, PORTICO_D = 3;

/**
 * Biblioteca: galería en U (alas oeste, norte y este) alrededor de un patio con
 * baldosas y dos árboles, cerrada al sur por un pórtico bajo. La cornisa vuela
 * solo hacia afuera: el patio queda libre.
 */
export function library(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const wing = (wx: number, wy: number, ww: number, wd: number): void => {
    const f: Facade = { floors: 2, cols: Math.max(2, Math.round(Math.max(ww, wd) / 3)), base: "arcade" };
    addBuilding(p, prism(wx, wy, z, ww, wd, 7, "marble", { facade: f, tone: style.tone }), f);
  };
  wing(x, y, w, WING);
  wing(x, y + WING, WING, d - WING);
  wing(x + w - WING, y + WING, WING, d - WING);
  p.solids.push(
    prism(x - 0.5, y - 0.5, z + 7, w + 1, WING + 0.5, 0.4, style.trim),
    prism(x - 0.5, y + WING, z + 7, WING + 0.5, d - WING + 0.5, 0.4, style.trim),
    prism(x + w - WING, y + WING, z + 7, WING + 0.5, d - WING + 0.5, 0.4, style.trim),
  );
  const portico: Facade = { floors: 1, cols: 3, base: "portico" };
  addBuilding(p, prism(x + WING, y + d - PORTICO_D, z, w - 2 * WING, PORTICO_D, 4, "marble", { facade: portico, tone: style.tone }), portico);
  const court = { x: x + WING, y: y + WING, w: w - 2 * WING, d: d - WING - PORTICO_D };
  p.ground.push(tiles(rng, court, z + 0.05, "paving"));
  for (const f of [1 / 3, 2 / 3]) p.solids.push(...patioTree(v3(court.x + court.w * f, court.y + court.d / 2, z + 0.05)));
  p.courtyard = court;
  p.landmarkTop = v3(x + w / 2, y + WING / 2, z + 7.4);
  return fitToCap(p, lot);
}
```

Imports a sumar: `tiles` (city-pieces), `patioTree` (props). Registro después de `civicPalace`.

- [ ] **Step 4: Correr.** `npx vitest run src/kit` → todo `src/kit` verde (incluido el test de `landmarkTop` y el de bóveda/cúpula de las cuatro). `npm run typecheck` verde.

- [ ] **Step 5: Commit.** `git commit -am "feat(#42): biblioteca con patio"`

---

### Task 6: fila `landmarks` del lab con lotes propios

**Files:**
- Modify: `src/lab/kit-scene.ts`
- Test: `src/lab/kit-scene.test.ts` (del commit de evals)

**Interfaces:**
- Consumes: `LAB_LOTS` (`../kit/index`).
- Produces: `kitScene` igual en firma; las recetas de `LAB_LOTS` reciben su lote centrado en la celda.

- [ ] **Step 1: Tests (del commit de evals).** El test del zócalo excluye las recetas con `ground` (`campus`, `library`) y las de `LAB_LOTS`; dos tests nuevos:

```ts
  it("la torre de agua va en un lote 6×6 centrado en su celda, sobre un zócalo de 6×6", () => {
    const { solids, lots } = kitScene(7, "civico"), l = lots.find((q) => q.name === "waterTower")!;
    const plinth = solids.find((s) => s.kind === "prism" && s.mat === "paving" && s.at.z === 0 && s.at.x === l.x + 9 && s.at.y === l.y + 6);
    expect(plinth).toMatchObject({ w: 6, d: 6, h: PLINTH_H });
    const legs = solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 9);
    expect(legs).toHaveLength(4);
    for (const s of legs) if (s.kind === "prism") expect(s.at.z).toBe(PLINTH_H);
  });

  it("el puente peatonal va en un lote 54×5 a z −1 sin zócalo, último de su fila, y ocupa dos celdas", () => {
    const { solids, lots } = kitScene(7, "civico"), l = lots.find((q) => q.name === "footbridge")!;
    const deck = solids.find((s) => s.kind === "prism" && s.mat === "stone" && s.w === 54);
    expect(deck).toMatchObject({ at: { x: l.x, y: l.y + 6.5 + 0.5 } });
    expect(deck?.kind === "prism" && Math.abs(deck.at.z - 1.2) < 1e-9).toBe(true);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "paving" && s.at.x === l.x && s.at.y === l.y && s.at.z === 0)).toBe(false);
    expect(lots.filter((q) => q.y === l.y && q.x > l.x)).toEqual([]);
    expect(l.x + 54).toBeLessThanOrEqual(l.x + 2 * KIT_STEP.x);
  });
```

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run src/lab/kit-scene.test.ts` → FAIL (lote estándar en la torre y el puente).

- [ ] **Step 3: Implementar** en `kitScene` (`src/lab/kit-scene.ts`), import `LAB_LOTS` junto a `RECIPES`, y el cuerpo del `forEach`:

```ts
  RECIPES.forEach((def, i) => {
    const x = RECIPES.filter((r) => r.family === def.family).indexOf(def) * KIT_STEP.x, y = families.indexOf(def.family) * KIT_STEP.y;
    const own = LAB_LOTS[def.name], w = own?.w ?? KIT_LOT.w, d = own?.d ?? KIT_LOT.d;
    const lot: Lot = { x: x + Math.max(0, (KIT_LOT.w - w) / 2), y: y + (KIT_LOT.d - d) / 2, w, d, z: own?.z ?? PLINTH_H, open: ["s", "e"], maxH: 24 };
    let p = def.recipe(lot, createRng(seed * 1000 + i), STYLES[style]);
    if (p.ground.length > 0) p = def.recipe({ ...lot, z: 0 }, createRng(seed * 1000 + i), STYLES[style]);
    else if (own?.z === undefined) solids.push(prism(lot.x, lot.y, 0, w, d, PLINTH_H, "paving"));
    ground.push(...p.ground);
    solids.push(...p.solids);
    accents.push(...p.accents);
    lots.push({ x, y, name: def.name });
  });
```

y en el docstring de `kitScene` sumar: "Las recetas de `LAB_LOTS` van en su lote, centrado en la celda; la que trae `z` propia (el puente, sobre el agua) va sin zócalo."

- [ ] **Step 4: Correr.** `npm test` y `npm run typecheck` → todo verde.

- [ ] **Step 5: Verificación visual.** `npm run dev -- --host --port 5173`, abrir `http://localhost:5173/map/lab/kit.html`, tecla `4` (estilo `civico`), captura 1600×900 de la fila `landmarks` (script `.scratch/evals-42.md`).

- [ ] **Step 6: Commit.** `git commit -am "feat(#42): fila landmarks del lab con lotes propios"`

## Grilling

- Rondas: 1 (los cambios fueron menores: un test de red para el reloj, el desplazamiento del test genérico desde `lot.z`, una corrección de redacción).
- Preguntas: 18. Fuentes: ISSUE 5 (1, 2 parcial, 13, 18, 10), CODE 11 (3, 5, 6, 7, 9, 14, 15, 16, 17, 10, 8), DOC 1 (11, spec §6), NO SOURCE → supuesto técnico 5 (2, 4, 11, 12, 17).
- Hallazgos que cambiaron el plan: 8 (no había test que fijara el reloj de `classic`: agregado), 10 (el test de desplazamiento fijaba `z: 0.3` y con el puente en `z −1` desplazaría 1.3: pasa a `lot.z + 0.3`), 15 (redacción del estado de `kit-scene.test.ts` entre tasks).
- Supuestos: los cinco de `## Assumptions`.
- Issues abiertos: ninguno.
