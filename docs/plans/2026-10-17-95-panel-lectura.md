# Storybook 4 (#95): panel de lectura — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** al elegir un exhibit en `/lab/storybook.html`, el `<aside id="readout">` muestra sólidos, caras, acentos, caja (min/max en x, y, z, más ancho, fondo y alto en u), materiales ordenados y colores de acento ordenados, recalculados solo al cambiar de exhibit.

**Architecture:** `src/lab/crop.ts` (puro, sin Pixi) suma `readout(scene, animators): Readout`, que cuenta sobre la escena ya recortada y las capas iniciales de los animadores ya recortados. `src/lab/storybook.ts` lo llama dentro de `show()` (una vez por exhibit, nunca en el ticker) y vuelca el objeto a un `<dl>` en `#readout`; `lab/storybook.html` suma unas reglas de CSS para el `<dl>`.

**Tech Stack:** TypeScript estricto, Vite, PixiJS v8 (solo en la página), Vitest (sin Pixi en los tests).

**Spec:** issue #95 (manda donde difiera); `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` §7 (lectura).

## Global Constraints

- `src/lab/crop.ts` no importa Pixi.
- Todo color sale de `src/map/palette-iso.ts` (`palette-guard.test.ts` prohíbe hex fuera de la paleta); `Math.random` prohibido.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo; sin Pixi en tests.
- Sin dependencias nuevas. Commits `feat(#95): …`.
- `buildStage` sin cambios; `lab/world.html` y el sitio no cambian.
- `npm test` y `npm run typecheck` en verde.

## Decisiones técnicas (declaradas)

1. **Qué cuenta como sólido.** `scene.ground` + `scene.solids` + los `solids` de cada capa `kind: "solid"` de cada animador (`a.ids.map(a.layer)`). El terreno (`scene.terrain`) no cuenta, como dice la spec §7. Las capas `water` no cuentan (el issue nombra solo `solid` y `accent`).
2. **Caras.** `tessellate(s).length` (solo lo que mira a la cámara, lo que el stage dibuja), sumado sobre los mismos sólidos.
3. **Acentos.** `scene.accents.length` + los `accents` de cada capa `kind: "accent"`.
4. **Caja.** min/max componente a componente de `bounds(s)` sobre los mismos sólidos (incluido el pad de las piezas, que está en `scene.ground`); `w = max.x − min.x`, `d = max.y − min.y`, `h = max.z − min.z`. Sin sólidos, `box: null` y la página muestra `—`.
5. **Materiales.** Distintos de `s.mat` y, en `hull`, `s.topMat` si está; ordenados con `sort()` (orden de código, determinista). Tal cual el issue: no se miran los materiales que `tessellate` agrega por su cuenta (cubierta `deck` de los cascos, góndolas de la noria).
6. **Colores de acento.** Distintos de `a.color` sobre los mismos acentos, ordenados con `sort()`.
7. **"Iniciales".** Las capas se leen en el momento de `show()`, sin tickear: los animadores del mundo son compartidos y ya corrieron mientras se miraba el exhibit anterior, así que "inicial" es el estado al entrar al exhibit. El panel no se toca en el ticker.
8. **Volcado.** `<dl>` con pares `<dt>`/`<dd>`, armado con `document.createElement` y `textContent` (sin `innerHTML`). Números de la caja con `toFixed(1)`; listas separadas por coma. CSS en el `<style>` existente de `lab/storybook.html`, sin colores nuevos (opacidad, como los `h2` del índice).

## Review Focus

1. Un mismo material o color repetido en escena y en capa animada aparece una sola vez (test en Task 1).
2. Un animador con capa `water` no suma sólidos (test en Task 1).
3. Una escena vacía no produce `Infinity` en la caja (test en Task 1: `box: null`).
4. Cambiar de exhibit reemplaza el panel en vez de sumarle filas (Task 2, agent-browser: un solo `<dl>` en `#readout`).
5. El panel no cambia entre ticks del mismo exhibit (Task 2, agent-browser: dos lecturas de `#readout` separadas 2 s son iguales).

---

### Task 1: `readout` en `src/lab/crop.ts`

**Files:**
- Modify: `src/lab/crop.ts`
- Test: `src/lab/crop.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Readout {
  solids: number;
  faces: number;
  accents: number;
  box: { min: Vec3; max: Vec3; w: number; d: number; h: number } | null;
  materials: Material[];
  accentColors: AccentColor[];
}
export function readout(scene: WorldScene, animators: readonly Animator[]): Readout;
```

(`Animator` de `../scenes/animator`; `ZonedAnimator` lo extiende, así que la página le pasa lo que devuelve `cropAnimators`.)

- [ ] **Step 1: tests que fallan** (los escribe la etapa de evals; verificar que estén) — en `crop.test.ts`, importar `readout` de `./crop`, `tessellate` de `../iso/solids` y `Animator` de `../scenes/animator`:

```ts
describe("readout", () => {
  const hull: Solid = { kind: "hull", at: v3(5, 5, -1), len: 6, beam: 2, h: 2, mat: "hullBlue", topMat: "steel" };
  const pad: Solid = { kind: "ground", mat: "paving", tris: [tri(0, 0)] };
  const scene = {
    ...pieceScene(() => {}),
    terrain: { ground: [prism(100, 100)], bleed: [], water: [], foam: { kind: "ground", mat: "foam", tris: [] } },
    ground: [pad],
    solids: [prism(1, 1), hull],
    accents: [{ kind: "dot", at: v3(1, 1, 3), r: 1, color: "cyan" }, { kind: "poly", pts: [v3(0, 0, 0)], color: "amber" }],
  } as WorldScene;
  const anim: Animator = {
    ids: ["s", "a", "w"],
    layer: (id) => id === "s"
      ? { kind: "solid", solids: [{ kind: "prism", at: v3(-2, 0, 0), w: 1, d: 1, h: 8, mat: "brick" }] }
      : id === "a"
        ? { kind: "accent", accents: [{ kind: "dot", at: v3(0, 0, 9), r: 1, color: "cyan" }, { kind: "dot", at: v3(0, 0, 9), r: 1, color: "magenta" }] }
        : { kind: "water", water: [prism(50, 50)] },
    tick: () => new Set(),
  };
  const r = readout(scene, [anim]);
  const all = [pad, prism(1, 1), hull, ...(anim.layer("s") as { solids: Solid[] }).solids];

  it("cuenta suelo, sólidos y capas sólidas animadas; ni terreno ni agua", () => {
    expect(r.solids).toBe(4);
  });
  it("las caras son las de tessellate sobre los mismos sólidos", () => {
    expect(r.faces).toBe(all.reduce((n, s) => n + tessellate(s).length, 0));
  });
  it("cuenta acentos estáticos más los de capas de acentos", () => {
    expect(r.accents).toBe(4);
  });
  it("la caja abarca los bounds de todos los sólidos, con ancho, fondo y alto", () => {
    const bs = all.map(bounds);
    const min = v3(Math.min(...bs.map((b) => b.min.x)), Math.min(...bs.map((b) => b.min.y)), Math.min(...bs.map((b) => b.min.z)));
    const max = v3(Math.max(...bs.map((b) => b.max.x)), Math.max(...bs.map((b) => b.max.y)), Math.max(...bs.map((b) => b.max.z)));
    expect(r.box).toEqual({ min, max, w: max.x - min.x, d: max.y - min.y, h: max.z - min.z });
    expect(r.box!.min.x).toBe(-2);
    expect(r.box!.max.z).toBe(8);
  });
  it("materiales de mat y topMat, ordenados y sin repetidos", () => {
    expect(r.materials).toEqual(["brick", "concrete", "hullBlue", "paving", "steel"]);
  });
  it("colores de acento ordenados y sin repetidos", () => {
    expect(r.accentColors).toEqual(["amber", "cyan", "magenta"]);
  });
  it("una escena sin sólidos ni animadores da caja nula y listas vacías", () => {
    const empty = { ...scene, ground: [], solids: [], accents: [] } as WorldScene;
    expect(readout(empty, [])).toEqual({ solids: 0, faces: 0, accents: 0, box: null, materials: [], accentColors: [] });
  });
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `npx vitest run src/lab/crop.test.ts`
Expected: FAIL (`readout` no exportado / no es función).

- [ ] **Step 3: implementación mínima** — en `crop.ts` (sumar a los imports `tessellate` de `../iso/solids`, `AccentColor` de `../map/palette-iso`, `Animator` de `../scenes/animator`; `Vec3` ya está):

```ts
export interface Readout {
  solids: number;
  faces: number;
  accents: number;
  box: { min: Vec3; max: Vec3; w: number; d: number; h: number } | null;
  materials: Material[];
  accentColors: AccentColor[];
}

/**
 * Lo que el panel del storybook cuenta de un exhibit: suelo y sólidos de la
 * escena más el estado actual de las capas `solid` y `accent` de los
 * animadores. El terreno y las capas de agua no cuentan.
 */
export function readout(scene: WorldScene, animators: readonly Animator[]): Readout {
  const layers = animators.flatMap((a) => a.ids.map((id) => a.layer(id)));
  const solids = [...scene.ground, ...scene.solids, ...layers.flatMap((l) => (l.kind === "solid" ? l.solids : []))];
  const accents = [...scene.accents, ...layers.flatMap((l) => (l.kind === "accent" ? l.accents : []))];
  const mats = new Set<Material>();
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  let faces = 0;
  for (const s of solids) {
    faces += tessellate(s).length;
    mats.add(s.mat);
    if (s.kind === "hull" && s.topMat) mats.add(s.topMat);
    const b = bounds(s);
    min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y); min.z = Math.min(min.z, b.min.z);
    max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y); max.z = Math.max(max.z, b.max.z);
  }
  return {
    solids: solids.length,
    faces,
    accents: accents.length,
    box: solids.length ? { min, max, w: max.x - min.x, d: max.y - min.y, h: max.z - min.z } : null,
    materials: [...mats].sort(),
    accentColors: [...new Set(accents.map((a) => a.color))].sort(),
  };
}
```

- [ ] **Step 4: correr y ver que pasa**

Run: `npx vitest run src/lab/crop.test.ts && npm run typecheck`
Expected: PASS, sin errores de tipos.

- [ ] **Step 5: commit**

```bash
git add src/lab/crop.ts src/lab/crop.test.ts
git commit -m "feat(#95): readout puro en crop.ts"
```

### Task 2: panel `#readout` en la página

**Files:**
- Modify: `src/lab/storybook.ts` (dentro de `show()`, más una función de volcado al nivel del módulo)
- Modify: `lab/storybook.html` (CSS del `<dl>`)

**Interfaces:**
- Consumes: `readout(scene, animators): Readout` y `type Readout` de `./crop` (Task 1).

- [ ] **Step 1: verificación que falla** — con el dev server (`npm run dev -- --host --port 5173`) correr el script `.scratch/evals-95.md` (etapa de evals): `#readout` está vacío, así que falla.

- [ ] **Step 2: implementación** — en `storybook.ts`:

1. Import: `import { cropAnimators, cropScene, pieceScene, type Readout, readout, solidsBox } from "./crop";`
2. Junto a `nav`: `const panel = document.getElementById("readout") as HTMLElement;`
3. Función de módulo (antes de `boot`):

```ts
const n1 = (x: number): string => x.toFixed(1);

/** Vuelca la lectura de un exhibit al aside, reemplazando la anterior. */
function renderReadout(r: Readout): void {
  const b = r.box;
  const rows: [string, string][] = [
    ["Sólidos", String(r.solids)],
    ["Caras", String(r.faces)],
    ["Acentos", String(r.accents)],
    ["Caja x", b ? `${n1(b.min.x)} … ${n1(b.max.x)}` : "—"],
    ["Caja y", b ? `${n1(b.min.y)} … ${n1(b.max.y)}` : "—"],
    ["Caja z", b ? `${n1(b.min.z)} … ${n1(b.max.z)}` : "—"],
    ["Ancho × fondo × alto", b ? `${n1(b.w)} × ${n1(b.d)} × ${n1(b.h)} u` : "—"],
    ["Materiales", r.materials.join(", ") || "—"],
    ["Colores de acento", r.accentColors.join(", ") || "—"],
  ];
  const dl = document.createElement("dl");
  for (const [k, v] of rows) {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = k; dd.textContent = v;
    dl.append(dt, dd);
  }
  panel.replaceChildren(dl);
}
```

4. En `show()`, cada rama guarda en `src` la escena y los animadores que le pasa a `buildStage`; `addChild` y el log del primer dibujo quedan donde están (la lectura no entra en ese tiempo) y justo después del log se vuelca la lectura con esos mismos objetos:

```ts
    let src: [WorldScene, ZonedAnimator[]];
    if (e.kind === "region") {
      // la misma caja a ambos: el memo del recorte se indexa por identidad de Box
      src = [cropScene(scene, e.box), cropAnimators(animators, e.box)];
      stage = buildStage(...src);
      frame = { box: e.box, h: e.h };
    } else {
      const piece = pieceScene(e.build, e.pad);
      src = [piece, []];
      stage = buildStage(...src);
      frame = solidsBox([...piece.ground, ...piece.solids]);
    }
    app.stage.addChild(stage.container);
    if (log) console.info(/* sin cambios */);
    renderReadout(readout(...src));
```

`buildStage` recibe `ZonedAnimator[]` (`stage.ts:44`), de ahí el tipo de `src`; imports de tipo de `../scenes/world` y `../world/assemble`.

5. En `lab/storybook.html`, reemplazar `#readout { padding: 1rem; }` por:

```css
      #readout { padding: 1rem; overflow-y: auto; }
      #readout dl { margin: 0; }
      #readout dt { font-size: 0.8rem; text-transform: uppercase; opacity: 0.6; margin-top: 0.6rem; }
      #readout dd { margin: 0.1rem 0 0; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 3: correr la verificación** — `npm test`, `npm run typecheck` y el script `.scratch/evals-95.md` con agent-browser. Expected: todo en verde; captura del panel (agent-browser `set viewport 1600 900 2`, como pide `CLAUDE.md`) en `docs/superpowers/specs/assets/95-storybook/`, como hicieron #92 y #94 (`docs/superpowers/specs/assets/92-storybook/`, `94-storybook/`).

- [ ] **Step 4: commit**

```bash
git add src/lab/storybook.ts lab/storybook.html docs/superpowers/specs/assets/95-storybook
git commit -m "feat(#95): panel de lectura en el storybook"
```

## Assumptions

- **A1. "Iniciales" = estado al entrar al exhibit.** Los animadores del mundo se arman una vez y son compartidos (`storybook.ts`: `assembleWorld` al nivel del módulo); `cropAnimators` ya llama "estado inicial" al que tienen al recortar (`crop.ts:85-91`). Descartado: reconstruir el mundo o reiniciar los animadores para leer el estado previo a todo tick (costo de `assembleWorld` por exhibit, y el issue no lo pide).
- **A2. Error en `buildStage`.** Si `show()` tira, el panel queda con el exhibit anterior, igual que el canvas hoy (`storybook.ts` no maneja errores en `show()`). Descartado: limpiar el panel antes de armar el stage (agrega un estado intermedio sin pedido del issue).
- **A3. Costo de `tessellate` por exhibit.** Sin presupuesto en el issue ni en la spec. Se acepta: `buildStage` ya teselea los mismos sólidos una vez (`src/iso/render-list.ts:30,38`), así que la lectura cuesta del orden del primer dibujo, una vez por exhibit. Descartado: reutilizar las caras del stage (exige cambiar `buildStage`, que la historia deja sin cambios).
- **A4. `buildStage(...src)` en ambas ramas** de `show()`, para que el stage y la lectura reciban por construcción los mismos objetos.

## Grilling

Una ronda (el plan no cambió de forma sustancial: solo A4 y la nota de viewport). 18 preguntas.

1. ISSUE: "el `<aside>` de la derecha muestra: sólidos, caras, acentos, caja (min y max en x, y, z) con ancho, fondo y alto en u, la lista ordenada de materiales usados y la lista ordenada de colores de acento". Criterios: `crop.test.ts` → Task 1; "El panel cambia al cambiar de exhibit; captura con el panel visible en el PR" → Task 2 + etapa de PR; `npm test`/`typecheck` → ambas tareas. Ninguno queda sin tarea.
2. ISSUE: "cuenta `ground` + `solids` más los sólidos iniciales de las capas `solid` animadas". DOC: spec §7, tabla: "Sólidos | `scene.ground.length + scene.solids.length` más los sólidos iniciales de las capas animadas". Ninguno nombra `terrain` ni capas `water`; el test lo fija.
3. ISSUE: "Se recalcula solo al cambiar de exhibit, nunca por tick". CODE: `src/lab/crop.ts:85-91` — `cropAnimators` usa el mismo estado "inicial" al recortar. NO SOURCE para "antes de todo tick" → A1.
4. CODE: `src/world/assemble.ts:16` — `ZonedAnimator = Animator & { zone }`; `src/lab/crop.ts:85-91` — el `layer` envuelto devuelve `cropLayer(a.layer(id), box)`; `crop.test.ts` "las capas devuelven solo lo que cae adentro".
5. CODE: `src/iso/solids.ts:242-246` — "Solo lo que mira a la cámara"; `src/iso/render-list.ts:30,38` — el stage dibuja `tessellate(s)`, así que las caras de `deck` y góndolas ya están en ese conteo.
6. ISSUE: "materiales de `mat` y `topMat`". Se sigue literal.
7. CODE: `src/lab/crop.test.ts:1-11` — `prism` (`mat: "concrete"`), `tri`, `v3`, `bounds`, `pieceScene` definidos o importados. CODE: `src/map/palette-iso.ts` `ISO_TONES` incluye `foam`, `paving`, `hullBlue`, `steel`, `brick`, `concrete`.
8. CODE: `src/lab/crop.ts:2,4` importan `Vec3` y `Material`; `src/map/palette-iso.ts:74` exporta `type AccentColor`.
9. CODE: `src/map/palette-iso.ts:72-74` — uniones de literales `string`; `.sort()` sin comparador tipa. Orden UTF-16 por primer carácter: b < c < h < p < s; a < c < m.
10. CODE: `src/scenes/animator.ts:9-13` — `AnimLayer` con exactamente `solid` (`solids`), `accent` (`accents`), `water` (`water: Solid[]`).
11. CODE: `src/lab/crop.ts:111-133` — `pieceScene` pone el pad en `ground`. `buildStage(...src)` en ambas ramas → A4.
12. NO SOURCE → A2.
13. Pipeline: la etapa 3 (evals) escribe los tests de Task 1 y `.scratch/evals-95.md` antes de implementar; Task 2 Step 1 corre ese script.
14. DOC: `CLAUDE.md` — "agent-browser set viewport 1600 900 2". Precedente: `docs/superpowers/specs/assets/92-storybook/` y `94-storybook/` (planes de #92/#94, decisión 8).
15. CODE: `src/map/palette-guard.test.ts:5` — recorre solo `src/`; no lee `lab/*.html`. CODE: `lab/storybook.html` — `#exhibits h2 { … opacity: 0.6 … }`.
16. CODE: `src/lab/storybook.ts` `show()` — `t0 = performance.now()` antes de armar y el `console.info` del primer dibujo; `renderReadout` va después de esa línea.
17. ISSUE de #93: test de no-vacío por región; CODE: `src/lab/crop.ts:111-133` — toda pieza lleva pad. Ningún exhibit da cero sólidos; `box: null` queda como defensa de la función pura (test).
18. NO SOURCE → A3.

Fuentes: ISSUE 5, CODE 13, DOC 2, NO SOURCE 3 (las tres, supuestos técnicos A1–A3). Ambigüedades de spec: ninguna. Issues abiertos: ninguno.
