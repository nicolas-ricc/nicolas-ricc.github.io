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
4. **Cómo se invierte la relación.** Se intercambian `glint.top` y `shallow.up` en una copia de `ISO_TONES` (el issue dice "cambiando un tono"; acá se cambian dos en una copia, sin tocar la paleta). El destello pasa a ser agua y la cresta del bajío pasa a ser coral. La primera aserción que cae es `blueShare(shallow.up) > 0.4` (la cresta coral ya no es azul), y también caerían las de calidez y brillo del destello. Se exige `toThrow(/expected/)`, el mensaje de las aserciones de Vitest, para que un `TypeError` no cuente como "falló la relación".
5. **Tipo de la paleta.** `aguaYDestello` recibe `Record<WaterMat | "glint", Record<"top" | "up" | "lit" | "down", number>>`, con `WaterMat = "shallow" | "water" | "waterDeep" | "abyss"`. `ISO_TONES` cumple ese tipo sin casts, y las paletas de prueba se arman como literales, sin `as`.
6. **Las aserciones que no tienen umbral numérico no cambian.** `blueShare(up) > 0.4` es un ratio, no depende del brillo; queda igual.

## Review Focus

1. Paleta oscurecida otra vez (otro `DARKEN`): el test debe seguir pasando si la relación se mantiene. Lo cubre el test "otro oscurecimiento" de Task 1.
2. Relación agua/destello invertida: el test debe fallar por una aserción y no por un error de otra clase. Lo cubre el test "relación invertida" de Task 1, con `toThrow(/expected/)`.
3. Literales sueltos que vuelven a aparecer: el `grep -nw` del paso 6 de Task 1 sobre todo el archivo.
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
    expect(() => aguaYDestello(tones, DARKEN)).toThrow(/expected/);
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

Run: `grep -nwE "30|120" src/map/palette-iso.test.ts`
Expected: una sola línea, la declaración `const CRESTA_SUTIL = 30, DESTELLO_CALIDO = 120, DESTELLO_CLARO = 30;`. Hoy da tres (líneas 58-60, las comparaciones sueltas).

- [ ] **Step 7: commit**

```bash
git add src/map/palette-iso.test.ts
git commit -m "test(#21): umbrales de agua y destello escalados por DARKEN"
```

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas en el grilling (van también a la descripción del PR):

1. **"Sueltos" = comparados sin escalar.** El brief pide "los umbrales se expresan como `base × DARKEN`". Los valores base quedan declarados una vez como constantes con nombre (`CRESTA_SUTIL`, `DESTELLO_CALIDO`, `DESTELLO_CLARO`) y solo se usan multiplicados por el factor. Se descartó escribir `30 * DARKEN` en cada aserción, porque repite el literal tres veces.
2. **El factor 0,6 es un ejemplo, no una garantía para todo factor.** El test prueba que un pase más de oscurecimiento no rompe los umbrales escalados. No promete que las aserciones estrictas sin umbral (`warmth(up) > warmth(top)`) sobrevivan al redondeo con cualquier factor: con 0,5 empatan en `abyss`, y eso no es un umbral de este issue.
3. **El "rojo" de TDD es un `ReferenceError`.** Las dos pruebas nuevas llaman a una función que todavía no existe. Ese es el fallo esperado en el paso 2 y en el commit de evals.
4. **`ISO_TONES` como `AguaPaleta`.** `ISO_TONES` es un literal inferido sin anotación (`palette-iso.ts:22`). Las claves de más (`shade`, otros materiales) no impiden asignarlo a un `Record` más chico. Si `tsc` lo rechazara, se cambia el tipo del parámetro, nunca se recurre a `as`.
5. **Las mediciones se rehacen en el test.** Los números de la decisión 3 y del comentario de la etapa 0 del issue salieron de un test descartable. Lo que queda versionado son los dos tests nuevos, que fallan si esos márgenes dejan de valer.

## Grilling

Una ronda (los cambios no agregaron ni quitaron pasos ni movieron el corte; no hace falta una segunda). 15 preguntas: ISSUE 2, CODE 8, DOC 1, sin fuente 4. Las cuatro sin fuente son supuestos técnicos y no hubo ambigüedades de spec ni temas fuera de alcance, así que no se abrieron issues.

1. ¿Los cuatro `up − top` quedan bajo 21? CODE: `palette-iso.test.ts:58`. Medido en la etapa 0 del issue: máximo 9,5 (`shallow`). El paso 4 lo confirma.
2. ¿`ISO_TONES` es `darken(BASE_TONES, DARKEN)`? ¿Existe `glint` con los cuatro tonos? CODE: `palette-iso.ts:18-20` ("los de `palette-base.ts` × 0.7 por canal (`DARKEN`)"), `palette-iso.test.ts:85-92` (lo exige con ±1) y `palette-base.ts:34` (`glint` con `top/lit/shade/up/down`).
3. ¿Qué significa "suelto"? ISSUE (Agent Brief): "los umbrales se expresan como `base × DARKEN`". Supuesto 1.
4. El empate con 0,5: supuesto 2.
5. ¿Qué aserción dispara el `toThrow`? Sin fuente. La decisión 4 queda corregida y el test pasa a `toThrow(/expected/)`.
6. ¿Cuál es el tipo de `ISO_TONES`? CODE: `palette-iso.ts:22`, literal sin anotación. Supuesto 4.
7. ¿Qué es "invertir la relación"? ISSUE (Agent Brief): "verificar a mano cambiando un tono y revirtiendo". La decisión 4 lo automatiza sobre una copia.
8. ¿Las mediciones se pueden reproducir? Supuesto 5.
9. ¿`rgb`, `warmth` y `blueShare` se mueven o se duplican? CODE: `palette-iso.test.ts:50-52`. Hoy son locales del test de agua, así que se mueven.
10. ¿Las líneas y el export están verificados? CODE: `palette-iso.test.ts:3` importa `BASE_TONES, DARKEN, darken`, y `palette-base.ts:2` declara `export const DARKEN = 0.7`.
11. ¿Qué prueba el grep? CODE: `palette-iso.test.ts:58-60` son los únicos `30` y `120` del archivo. El paso 6 pasa a `grep -nw` y espera una sola línea, la de la declaración.
12. ¿El `!` sirve para algo? ¿`as const` es un `as`? CODE: `tsconfig.json:7` tiene `noUncheckedIndexedAccess: true`, así que el `!` hace falta. `as const` no es un escape de tipos: ya lo usa `palette-iso.test.ts:50-53`.
13. ¿Un `ReferenceError` vale como rojo? Supuesto 3.
14. ¿Por qué queda la aserción de `hullBlue`? CODE: hoy vive en `palette-iso.test.ts:66`. No es un umbral y el issue no pide tocarla, así que queda igual.
15. ¿De dónde salen las convenciones? DOC: `.factory/config.toml` define `lint = "npm run typecheck"` ("the repo's only static gate"). Los prefijos de commit salen del historial (`git log`: `docs(#97)`, `feat(#96)`) y el castellano, de los tests del mismo archivo.
