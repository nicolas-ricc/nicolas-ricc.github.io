# Materiales dibujados en el panel de lectura (#111): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que `readout` (`src/lab/crop.ts`) liste los materiales de las caras que devuelve `tessellate`, no los campos `mat`/`topMat` de cada sólido.

**Architecture:** el bucle de `readout` ya llama `tessellate(s)` para contar caras. Se guarda ese resultado, se suma su largo a `faces` y se agrega el `mat` de cada cara al conjunto de materiales. Desaparecen las dos líneas que leen `s.mat` y `s.topMat`.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #111 y su Agent Brief (comentario de triage).

## Global Constraints

- Decisión del brief: "materiales usados" son los materiales de las caras dibujadas.
- Criterio 1 (brief): "En el test del módulo de recorte, un exhibit con una noria con góndolas lista el material de las góndolas, y uno con casco con `topMat` lista `deck`."
- Criterio 2 (brief): "La lista esperada actual del test se actualiza en consecuencia."
- Criterio 3 (brief): "`npm test` y `npm run typecheck` en verde."
- Fuera de alcance (brief): materiales de acentos; el panel de acentos ya es aparte.
- Commits `test(#111): …`, `fix(#111): …`. Comentarios y nombres de tests en castellano, como el resto del repo.

## Datos

- `src/lab/crop.ts:150-174`: `readout`. Hoy: `faces += tessellate(s).length; mats.add(s.mat); if (s.kind === "hull" && s.topMat) mats.add(s.topMat);`.
- `src/iso/solids.ts:243-246`: `tessellate` = `tessellateAll` con descarte de caras traseras (`dot(normal, VIEW_DIR) > 0`) salvo en sólidos planos. Lo que devuelve es lo que se pinta: es la misma función que ya cuenta `faces`.
- `src/iso/solids.ts:151-154`: un casco con `topMat` pinta la cubierta en `"deck"`; sin `topMat`, la cubierta va en `s.mat`.
- `src/iso/solids.ts:211-216`: una rueda con `gondolas` extruye una góndola por lado en `gondolas.mat`. La noria de la feria (`src/scenes/fair.ts:54`) usa `mat: "steel"` y `gondolas.mat: "rust"`.
- Medido con `tessellate` (tsx, en `main` 749ef0d): el casco del test actual (`hullBlue`/`steel`) da `deck, hullBlue, steel`; una rueda `steel` con góndolas `rust` da `steel, rust`; sin góndolas, solo `steel`; el prisma `concrete` y la malla `paving` dan su propio `mat`.
- `src/lab/crop.test.ts:158-207`: `describe("readout")`. La lista esperada hoy (línea 198) es `["brick", "concrete", "hullBlue", "paving", "steel"]`.
- `src/lab/storybook.ts:51`: único consumidor; imprime `r.materials.join(", ")`. No cambia.

## Decisiones técnicas (declaradas)

1. **Caras de `tessellate`, no de `tessellateAll`.** El brief pide "los materiales que efectivamente se dibujan" y "dentro del mismo bucle que ya cuenta caras", que usa `tessellate`. Un material que solo aparece en caras traseras descartadas no se pinta y no se lista.
2. **El criterio 1 se cubre con sólidos sueltos dentro del test de `readout`**, no con los exhibits del catálogo: "exhibit" en el brief es la escena que recibe `readout`. Se agrega una rueda con góndolas a la escena del test y se comprueba que la lista incluye `rust` (góndolas) y `deck` (casco con `topMat`). Se agrega además un caso aparte, un casco con `topMat` solo, para que `deck` no dependa de los otros sólidos de la escena.
3. **Un `tessellate` por sólido.** Se guarda el resultado en una constante del bucle en vez de llamar dos veces.

## Review Focus

1. Un casco **sin** `topMat` no debe listar `deck`: la cubierta va en `s.mat`. Test en la Task 1.
2. Una rueda **sin** góndolas no debe listar material de góndolas (no hay campo): queda cubierto por la rueda del test con góndolas más el caso sin ellas. Test en la Task 1.
3. `faces` debe seguir siendo el conteo de `tessellate` sobre los mismos sólidos, ahora con la rueda incluida: el test existente "las caras son las de tessellate…" recorre `all`, que se amplía con la rueda.
4. Capas `solid` de animadores (la noria gira en una capa animada): sus sólidos pasan por el mismo bucle; la rueda se pone en la capa animada del test para cubrirlo.
5. Escena vacía: sigue dando `materials: []` (test existente).

---

### Task 1: materiales desde las caras de `tessellate`

**Files:**
- Modify: `src/lab/crop.ts:154-160`
- Test: `src/lab/crop.test.ts:158-207`

**Interfaces:**
- Consumes: `tessellate(s: Solid): Face[]` de `src/iso/solids.ts`; `Face.mat: Material`.
- Produces: `readout(scene, animators).materials` = materiales de las caras dibujadas, ordenados y sin repetidos. La firma de `readout` y el tipo `Readout` no cambian.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/lab/crop.test.ts`, dentro de `describe("readout")`:

a) Agregar una rueda con góndolas a la capa animada `"s"` y a `all`. Reemplazar la definición de `anim` y de `all`:

```ts
  const wheel: Solid = { kind: "wheel", at: v3(0, -3, 6), r: 2, width: 0.5, mat: "steel", sides: 8, angle: 0, gondolas: { mat: "rust", w: 0.6, d: 0.4, h: 0.5 } };
  const anim: Animator = {
    ids: ["s", "a", "w"],
    layer: (id) => id === "s"
      ? { kind: "solid", solids: [{ kind: "prism", at: v3(-2, 0, 0), w: 1, d: 1, h: 8, mat: "brick" }, wheel] }
      : id === "a"
        ? { kind: "accent", accents: [{ kind: "dot", at: v3(0, 0, 9), r: 1, color: "cyan" }, { kind: "dot", at: v3(0, 0, 9), r: 1, color: "magenta" }] }
        : { kind: "water", water: [prism(50, 50)] },
    tick: () => new Set(),
  };
```

`all` no cambia de forma (`[pad, prism(1, 1), hull, ...solids de "s"]`) y ahora incluye la rueda. El test de conteo pasa a esperar 5 sólidos:

```ts
  it("cuenta suelo, sólidos y capas sólidas animadas; ni terreno ni agua", () => {
    expect(r.solids).toBe(5);
  });
```

Los tests de caja usan `all` y valores `-2` y `8`; la rueda (x −2..2, z 4..8) no los cambia. Verificarlo al correr.

b) Reemplazar el test de materiales:

```ts
  it("materiales de las caras dibujadas, ordenados y sin repetidos: cubierta del casco y góndolas incluidas", () => {
    expect(r.materials).toEqual(["brick", "concrete", "deck", "hullBlue", "paving", "rust", "steel"]);
  });
  it("un casco con topMat lista deck; sin topMat, no", () => {
    const only = (s: Solid) => readout({ ...scene, ground: [], solids: [s], accents: [] } as WorldScene, []).materials;
    expect(only(hull)).toEqual(["deck", "hullBlue", "steel"]);
    expect(only({ kind: "hull", at: v3(5, 5, -1), len: 6, beam: 2, h: 2, mat: "hullBlue" })).toEqual(["hullBlue"]);
  });
  it("una noria con góndolas lista su material; sin góndolas, solo el de la rueda", () => {
    const only = (s: Solid) => readout({ ...scene, ground: [], solids: [s], accents: [] } as WorldScene, []).materials;
    expect(only(wheel)).toEqual(["rust", "steel"]);
    expect(only({ kind: "wheel", at: v3(0, -3, 6), r: 2, width: 0.5, mat: "steel", sides: 8, angle: 0 })).toEqual(["steel"]);
  });
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/lab/crop.test.ts`
Expected: FAIL en "materiales de las caras dibujadas…" (falta `deck` y `rust`), "un casco con topMat…" (falta `deck`) y "una noria con góndolas…" (falta `rust`). El resto pasa.

- [ ] **Step 3: Commit de los tests**

```bash
git add src/lab/crop.test.ts
git commit -m "test(#111): evals"
```

- [ ] **Step 4: Implementación mínima**

En `src/lab/crop.ts`, dentro del bucle de `readout`, reemplazar:

```ts
    faces += tessellate(s).length;
    mats.add(s.mat);
    if (s.kind === "hull" && s.topMat) mats.add(s.topMat);
```

por:

```ts
    const fs = tessellate(s);
    faces += fs.length;
    for (const f of fs) mats.add(f.mat);
```

Y en el docstring de `readout`, sumar que los materiales son los de las caras que se dibujan:

```ts
/**
 * Lo que el panel del storybook cuenta de un exhibit: suelo y sólidos de la
 * escena más el estado actual de las capas `solid` y `accent` de los
 * animadores. El terreno y las capas de agua no cuentan. Los materiales son
 * los de las caras que dibuja `tessellate` (cubierta de casco y góndolas
 * incluidas), no los campos `mat`/`topMat`.
 */
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `npx vitest run src/lab/crop.test.ts`
Expected: PASS todo el archivo.

- [ ] **Step 6: Suite y typecheck**

Run: `npm test && npm run typecheck`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/lab/crop.ts
git commit -m "fix(#111): readout lists the materials tessellate draws"
```
