# Umbrales del test de agua y destello escalados por DARKEN (#21) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el test "agua: cuatro profundidades…" de `src/map/palette-iso.test.ts` exprese sus tres umbrales absolutos como `base × DARKEN`, así sigue al factor de oscurecimiento en vez de quedar calibrado a la paleta previa a #12.

**Architecture:** solo cambia el archivo de test. Las aserciones de agua y destello se mueven a una función local `aguaYDestello(tones, factor)` que recibe los tonos y el factor de oscurecimiento, y calcula los tres umbrales como `30 × factor`, `120 × factor` y `30 × factor`. El test existente la llama con `ISO_TONES` y `DARKEN`. Dos tests nuevos la usan con paletas armadas en el momento: la base oscurecida a otro factor (debe pasar) y la paleta actual con la relación agua/destello invertida (debe fallar).

**Tech Stack:** TypeScript, Vitest 5 (`npm test` = `vitest run`), `tsc --noEmit` como typecheck.

**Spec:** issue #21 (con su Agent Brief).

## Global Constraints

- "El test no contiene los literales 30 y 120 sueltos; los umbrales se expresan como `base × DARKEN`."
- "El test sigue pasando con la paleta actual y falla si se invierte la relación agua/destello."
- "Un comentario en el test explica que los valores base son los previos al oscurecimiento."
- "`npm test` en verde." Además `npm run typecheck` en verde (es la única compuerta estática del repo, `.factory/config.toml`).
- Fuera de alcance: "Cambiar los colores de la paleta." No se toca `palette-base.ts` ni `palette-iso.ts`.
- Comentarios y nombres de tests en castellano, como el resto del archivo. Commits `test(#21): …` / `plan(#21): …`.

## Decisiones técnicas (declaradas)

1. **Opción elegida: escalar por `DARKEN`.** El issue ofrece escalar por `DARKEN` o usar ratios de la luminancia del `top`; el Agent Brief elige la primera ("Los tres umbrales se escalan por el factor `DARKEN`"). Se sigue el brief.
2. **Por qué una función con `factor`.** Con el factor como parámetro la verificación "falla si se invierte la relación" deja de ser manual: se arma una paleta invertida y se espera que `aguaYDestello` lance. Y se puede probar el motivo del issue: otro pase de oscurecimiento no rompe el test. El parámetro tiene dos valores distintos en uso (`DARKEN` y el factor de la prueba), no es una opción especulativa.
3. **Factor de la prueba de "otro oscurecimiento": 0,6.** Medido sobre `BASE_TONES`: con 0,6, `lum(glint.top) − lum(shallow.up)` da ≈29, que cae bajo el piso absoluto viejo de 30 y sobre el escalado de 18; el resto de las aserciones del bloque pasa. Con 0,5 el redondeo por canal empata `warmth(abyss.up)` y `warmth(abyss.top)` (−24 y −24) y rompe una aserción que no tiene umbral; por eso no se usa.
4. **Cómo se invierte la relación.** Se intercambian `glint.top` y `shallow.up` en una copia de `ISO_TONES`. El destello pasa a ser agua y la cresta del bajío pasa a ser coral: falla al menos `warmth(glint.top) > warmth(top) + 84`.
5. **Tipo de la paleta.** `aguaYDestello` recibe `Record<WaterMat | "glint", Record<"top" | "up" | "lit" | "down", number>>`, con `WaterMat = "shallow" | "water" | "waterDeep" | "abyss"`. `ISO_TONES` cumple ese tipo sin casts, y las paletas de prueba se arman como literales, sin `as`.
6. **Las aserciones que no tienen umbral numérico no cambian.** `blueShare(up) > 0.4` es un ratio, no depende del brillo; queda igual.

## Review Focus

1. Paleta oscurecida otra vez (otro `DARKEN`): el test debe seguir pasando si la relación se mantiene. Lo cubre el test "otro oscurecimiento" de Task 1.
2. Relación agua/destello invertida: el test debe fallar. Lo cubre el test "relación invertida" de Task 1.
3. Literales sueltos que vuelven a aparecer: `grep` del paso 6 de Task 1 sobre el bloque de agua.
4. La paleta actual (`ISO_TONES`, `DARKEN`) sigue pasando: lo cubre el test existente, que ahora llama a `aguaYDestello`.
5. Typecheck: la función nueva no debe introducir `any` ni `as`. Paso 5 de Task 1.

---

### Task 1: umbrales del bloque de agua como `base × factor`

**Files:**
- Modify: `src/map/palette-iso.test.ts` (test "agua: cuatro profundidades…", hoy líneas 49-67; import de `palette-base` en la línea 3)

**Interfaces:**
- Consumes: `ISO_TONES` (`./palette-iso`), `BASE_TONES`, `DARKEN`, `darken(color, factor)` (`./palette-base`), `lum` (ya definida arriba en el archivo).
- Produces: función local del archivo `aguaYDestello(tones: AguaPaleta, factor: number): void`, que lanza (vía `expect`) si alguna relación no se cumple.

- [ ] **Step 1: escribir los tests que fallan**

Dentro de `describe("paleta isométrica", …)`, después del test de agua, agregar:

```ts
  it("agua y destello aguantan otro oscurecimiento: los umbrales siguen al factor", () => {
    const factor = 0.6;
    const tonos = (m: WaterMat | "glint") => ({
      top: darken(BASE_TONES[m].top, factor), up: darken(BASE_TONES[m].up, factor),
      lit: darken(BASE_TONES[m].lit, factor), down: darken(BASE_TONES[m].down, factor),
    });
    const tones: AguaPaleta = {
      shallow: tonos("shallow"), water: tonos("water"), waterDeep: tonos("waterDeep"), abyss: tonos("abyss"), glint: tonos("glint"),
    };
    aguaYDestello(tones, factor);
  });

  it("agua y destello fallan si se invierte la relación", () => {
    const tones: AguaPaleta = {
      ...ISO_TONES,
      shallow: { ...ISO_TONES.shallow, up: ISO_TONES.glint.top },
      glint: { ...ISO_TONES.glint, top: ISO_TONES.shallow.up },
    };
    expect(() => aguaYDestello(tones, DARKEN)).toThrow();
  });
```

- [ ] **Step 2: correr y ver que fallan**

Run: `npx vitest run src/map/palette-iso.test.ts`
Expected: FAIL en los dos tests nuevos con `ReferenceError: aguaYDestello is not defined` (o `AguaPaleta` sin definir en el typecheck).

- [ ] **Step 3: implementar `aguaYDestello` y reescribir el test de agua**

Agregar `darken` y `BASE_TONES` al import si no están (ya están en la línea 3). Antes de `describe("paleta isométrica", …)`, definir:

```ts
type WaterMat = "shallow" | "water" | "waterDeep" | "abyss";
type AguaPaleta = Record<WaterMat | "glint", Record<"top" | "up" | "lit" | "down", number>>;

// Los umbrales base (30 y 120) se calibraron sobre la paleta previa al oscurecimiento de #12;
// se escalan por el factor para que el test siga la relación y no el brillo absoluto.
const CRESTA_SUTIL = 30, DESTELLO_CALIDO = 120, DESTELLO_CLARO = 30;

function aguaYDestello(tones: AguaPaleta, factor: number): void {
  const rgb = (c: number) => [c >> 16, (c >> 8) & 255, c & 255] as const;
  const warmth = (c: number) => rgb(c)[0] - rgb(c)[2];
  const blueShare = (c: number) => rgb(c)[2] / (rgb(c)[0] + rgb(c)[1] + rgb(c)[2]);
  const mats = ["shallow", "water", "waterDeep", "abyss"] as const;
  for (let i = 1; i < mats.length; i++) expect(lum(tones[mats[i]!].top)).toBeLessThan(lum(tones[mats[i - 1]!].top));
  for (const m of mats) {
    expect(warmth(tones[m].up)).toBeGreaterThan(warmth(tones[m].top)); // apenas más cálida
    expect(blueShare(tones[m].up)).toBeGreaterThan(0.4); // pero azul: la cresta no es un destello
    expect(lum(tones[m].up) - lum(tones[m].top)).toBeLessThan(CRESTA_SUTIL * factor); // y sutil
    expect(warmth(tones.glint.top)).toBeGreaterThan(warmth(tones[m].top) + DESTELLO_CALIDO * factor); // el destello sí es coral
    expect(lum(tones.glint.top)).toBeGreaterThan(lum(tones[m].up) + DESTELLO_CLARO * factor);
    expect(blueShare(tones[m].lit)).toBeGreaterThan(blueShare(tones[m].top));
    expect(lum(tones[m].lit)).toBeLessThan(lum(tones[m].down));
    expect(lum(tones[m].down)).toBeLessThan(lum(tones[m].top));
  }
}
```

Y el test existente queda:

```ts
  it("agua: cuatro profundidades que se oscurecen, seno frío y cresta clara que sigue siendo agua; el sol va en glint", () => {
    aguaYDestello(ISO_TONES, DARKEN);
    expect(Object.keys(ISO_TONES.hullBlue).sort()).toEqual(["down", "lit", "shade", "top", "up"]);
  });
```

Con esto, los literales 30 y 120 viven solo en las constantes base nombradas, junto al comentario, y nunca se comparan sueltos.

- [ ] **Step 4: correr y ver que pasan**

Run: `npx vitest run src/map/palette-iso.test.ts`
Expected: PASS, incluidos los dos tests nuevos.

- [ ] **Step 5: suite y typecheck**

Run: `npm test && npm run typecheck`
Expected: todo en verde, sin errores de tipo.

- [ ] **Step 6: verificar los literales**

Run: `grep -nE "(<|>|\+) *(30|120)\b|\((30|120)\)" src/map/palette-iso.test.ts`
Expected: sin coincidencias (los literales solo aparecen en la declaración de las constantes base).

- [ ] **Step 7: commit**

```bash
git add src/map/palette-iso.test.ts
git commit -m "test(#21): umbrales de agua y destello escalados por DARKEN"
```
