# Helpers del test de agua: canal rojo, piso de `blueShare` y `hullBlue` (#122) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** limpiar tres inconsistencias previas en `src/map/palette-iso.test.ts`. `rgb` de `aguaYDestello` pasa a enmascarar el rojo. El piso `0.4` de `blueShare` queda con nombre y con su origen escrito. La aserción de forma de `hullBlue` pasa al test de forma de claves.

**Architecture:** solo cambia el archivo de test, y ninguna aserción se debilita: los valores que comparan son los mismos. `rgb` se enmascara en el mismo lugar en que está definido. El `0.4` se convierte en la constante `CRESTA_AZUL`, junto a las otras tres constantes del bloque, con un comentario aparte que dice que es un ratio y por eso no se escala. `hullBlue` se suma a la lista del test "materiales exclusivos de ciudad y costa".

**Tech Stack:** TypeScript, Vitest 5 (`npm test` = `vitest run`), `tsc --noEmit` (`npm run typecheck`).

**Spec:** issue #122 (follow-up de #21). Precedente: `docs/plans/2026-10-18-21-umbrales-agua-darken.md`, que introdujo `aguaYDestello`.

## Global Constraints

- "`rgb` extracts the red channel as `c >> 16` without `& 255`, while `lum` in the same file masks it": queda como `(c >> 16) & 255`.
- "`blueShare(up) > 0.4` is a magic number with no comment saying where 0.4 comes from. Today the closest material is `shallow`, at 0.415. It is a ratio, so it is correctly unaffected by `DARKEN`": el número queda igual, recibe nombre y comentario, y no se escala por `factor`.
- "The `hullBlue` key-shape assertion […] would read better next to the other key-shape test ("materiales exclusivos de ciudad y costa")".
- No se cambian colores: no se tocan `palette-base.ts` ni `palette-iso.ts`.
- Comentarios y nombres en castellano, como el resto del archivo.
- `npm test` y `npm run typecheck` en verde (`.factory/config.toml`).

## Review Focus

1. Relación agua/destello invertida: el test "agua y destello fallan si se invierte la relación" tiene que seguir fallando por una aserción, con `toThrow(/expected/)`. La primera aserción que cae es justo la del piso azul: lo dice la decisión 4 de `docs/plans/2026-10-18-21-umbrales-agua-darken.md`. El test no se toca, y el paso 5 lo corre.
2. Otro oscurecimiento (factor 0,6): el test "agua y destello aguantan otro oscurecimiento" tiene que seguir en verde. Si alguien escalara `CRESTA_AZUL` por `factor`, el piso bajaría a 0,24 con ese factor (0,28 con `DARKEN`) y dejaría pasar casi cualquier color. El paso 3 pide no escalarlo. Ningún test lo detectaría, así que lo cubre un chequeo del eval.
3. Cobertura de `hullBlue`: la aserción se mueve y no se pierde. El eval del paso 5 lo comprueba.
4. Literal suelto: `0.4` aparece una sola vez en el archivo, en la declaración de `CRESTA_AZUL`. El eval del paso 5 lo comprueba.
5. Typecheck: el cambio no agrega `any` ni `as` nuevos.

---

### Task 1: los tres arreglos en `palette-iso.test.ts`

**Files:**
- Modify: `src/map/palette-iso.test.ts`. Hoy las constantes están en la línea 12, `rgb` en la 15, el `0.4` en la 22, la lista de claves en la 69 y `hullBlue` en la 89.

**Interfaces:**
- Consumes: `aguaYDestello(tones: AguaPaleta, factor: number): void` y las constantes `CRESTA_SUTIL`, `DESTELLO_CALIDO` y `DESTELLO_CLARO`, ya presentes en el archivo.
- Produces: la constante del archivo `CRESTA_AZUL = 0.4`, que no se exporta.

- [ ] **Step 1: eval rojo.** Correr `.scratch/evals-122.sh`. El script lo crea el stage 3 del pipeline y no se commitea: `.scratch/` va a `.git/info/exclude`. Hace seis chequeos sobre `src/map/palette-iso.test.ts`:
  - (a) no queda ningún `c >> 16]` ni `[c >> 16,` sin máscara;
  - (b) existe `const CRESTA_AZUL = 0.4;`;
  - (c) `0.4` aparece exactamente una vez en el archivo;
  - (d) no existe `CRESTA_AZUL * factor`;
  - (e) `hullBlue` aparece una sola vez, dentro de la lista del test "materiales exclusivos de ciudad y costa";
  - (f) `npx vitest run src/map/palette-iso.test.ts` pasa.

  Hoy fallan (a), (b), (c) y (e).

- [ ] **Step 2: enmascarar el rojo.** En `aguaYDestello`, `rgb` pasa a ser `(c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const`, la misma forma que tiene el `rgb` del test de la fábrica.

- [ ] **Step 3: nombrar el piso azul.** Declarar `const CRESTA_AZUL = 0.4;` debajo de la línea de las otras tres constantes. Va con su propio comentario, que tiene que decir cuatro cosas:
  - es la fracción de azul `b / (r + g + b)`;
  - es un ratio y por eso no se escala por el factor;
  - un gris neutro da 1/3 y el coral de `glint.top` da ≈0,19, así que 0,4 exige que el azul domine con claridad;
  - el material más justo hoy es `shallow.up`, con ≈0,415.

  En la aserción, poner `toBeGreaterThan(CRESTA_AZUL)` en lugar del `0.4` y conservar el comentario de línea. No multiplicar por `factor`.

- [ ] **Step 4: mover `hullBlue`.** La aserción del bucle, `expect(Object.keys(ISO_TONES[m]).sort()).toEqual(["down", "lit", "shade", "top", "up"])`, es idéntica a la de la línea 89, así que la cobertura no cambia. El test es un solo `it` con un `for`, no un `it.each`, así que el número de tests tampoco cambia. Sacar la línea `expect(Object.keys(ISO_TONES.hullBlue)…)` del test "agua: cuatro profundidades…" y agregar `"hullBlue"` al final de la lista del test "materiales exclusivos de ciudad y costa". El test de agua queda con una sola línea, `aguaYDestello(ISO_TONES, DARKEN);`.

- [ ] **Step 5: verificar.**
  - Correr `.scratch/evals-122.sh`. Se espera que todos los chequeos den OK y que el script salga con 0.
  - Correr `npx vitest run src/map/palette-iso.test.ts`. Se espera PASS, con el mismo número de tests que antes (sin altas ni bajas).
  - Correr `npm test && npm run typecheck`. Se espera verde.

- [ ] **Step 6: commit.**

```bash
git add src/map/palette-iso.test.ts
git commit -m "test(#122): rojo enmascarado, CRESTA_AZUL con origen y hullBlue en el test de claves"
```

## Assumptions

1. **Una sola tarea.** Son tres ediciones de pocas líneas en un archivo, y comparten la misma verificación. Un revisor no aprobaría una y rechazaría otra por separado.
2. **`rgb` se queda local.** Se descartó subir un `rgb` compartido al nivel del módulo para que lo usen `aguaYDestello` y el test de la fábrica. Habría tocado un test que el issue no menciona, y el issue pide consistencia, no deduplicar.
3. **`hullBlue` se suma a la lista.** Se descartó agregar un `expect` suelto después del bucle: la lista ya es "materiales de forma estándar", y `hullBlue` es el casco de los barcos del puerto (costa).
4. **El 0,4 no se recalibra.** El issue lo pide documentado, no cambiado. El commit que lo introdujo (0dec5f1) no deja escrito de dónde sale. El comentario dice lo que se puede medir (gris 1/3, `glint` ≈0,19, `shallow` ≈0,415) y no inventa una derivación.
5. **Medidas del comentario.** Se tomaron en el stage 0 con un test descartable que leía `ISO_TONES`. `blueShare` de `up` y `top`: `shallow` 0,415/0,435; `water` 0,433/0,455; `waterDeep` 0,471/0,496; `abyss` 0,505/0,542; `glint.top` 0,189.
6. **El nombre `CRESTA_AZUL`.** En el archivo, "cresta" es el tono `up` del agua. Lo muestran el comentario de la línea 22 ("la cresta no es un destello") y `CRESTA_SUTIL`, que acota `lum(up) − lum(top)`. El piso acota el azul de esa cresta.
7. **El rojo enmascarado no cambia resultados.** Todos los colores de la paleta son literales de 24 bits (`0x……`, por ejemplo `src/map/palette-base.ts:11-34`), y `darken` produce valores por canal. Por eso `c >> 16` ya era `≤ 255` y la máscara no cambia ningún resultado.

## Grilling

- Rounds: 1. The second round was skipped because the changes were small: no step was added or removed, and the seam stayed the same.
- Questions: 16. By source:
  - CODE: 9 (2, 4, 5, 6, 7, 10, 11, 14, 16);
  - DOC: 2 (3, preceding plan; 12);
  - technical assumption: 5 (1, 8, 9, 13, 15, all settled in the eval).
- Changes to the plan:
  - The eval now spells out its six checks, including one that rejects `CRESTA_AZUL * factor`.
  - The step references in Review Focus are fixed.
  - Assumptions 5–7 are added.
- Issues opened: none.
