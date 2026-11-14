# Chequeo de interpenetración también con maxH 10 (#354) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que el test "with maxH 10 (the block facing the lit floor) it also respects the cap" del contrato genérico (`src/kit/kit.test.ts`) corra el mismo `interpenetrations` que el test de maxH 24 y que toda receta lo pase.

**Arquitectura:** una línea más en el test de maxH 10, que reusa el helper `interpenetrations` de #152 (no se escribe una segunda copia). La única receta que falla, `quayCrane`, se corrige en su geometría, dentro de la receta: no se toca `fitToCap`.

**Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** el issue #354, el Agent Brief del triage del 2026-11-12.

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- Misma regla de exención que #152: un par se excusa solo si **los dos** sólidos llevan `interlocks`. No se toca `OVERLAP_EPS` (1e-6) ni se saltean recetas.
- Fuera de alcance: el chequeo de maxH 24, la semántica de `interlocks`, `fitToCap` y los valores del tope.
- La salida de las recetas con maxH 24 no cambia: los tests existentes siguen pasando sin tocarlos.
- `npm test` y `npm run typecheck` en verde.
- Commits `test(#354): …` / `fix(#354): …`, con `Co-Authored-By`.

## Decisiones técnicas declaradas

1. **Medida (2026-11-14, `main` en `55c9897`).** Con el chequeo agregado al test de maxH 10, falla solo `quayCrane`, en los 2 lotes, los 4 estilos y las 20 semillas, siempre con los mismos 4 pares: cada pata × su viga transversal (`[0,2] [1,2] [4,6] [5,6]`).
2. **Causa.** `fitToCap` escala las z (incluido el eje `from`/`to` de una viga) y el `h` de prismas y cilindros, pero el `h` (la sección) de una `beam` no cambia (`mapZ` en `src/kit/piece.ts`). Con maxH 24 la viga transversal (eje en z + 9.6, `h` 0.8) apoya a ras sobre la pata (alto 9.2) y bajo la cabina (z + 10). Con maxH 10, k = 10/18: la pata termina en 5.111 y la viga empieza en 9.6·k − 0.4 = 4.933, 0.18 dentro de la pata. Contra lo que supone el issue ("Uniform `fitToCap` flattening preserves non-overlap"), el aplastado uniforme no preserva el no solape de las vigas: su sección no escala.
3. **Corrección en la geometría, no una marca.** #152 decidió que las patas y las vigas transversales de `quayCrane` no llevan `interlocks` (test "the cabin, mast, boom, stay and light housing interlock; legs and cross beams do not"). Lo correcto es que con k < 1 la viga transversal escale también su `h`: queda entre 9.2·k y 10·k, a ras de la pata y de la cabina, como con maxH 24.
4. **Dónde.** En la receta `quayCrane` (`src/kit/forms/industrial.ts`), después de `fitToCap`: k = (tope aplastado − lot.z) / (tope original − lot.z). Las vigas transversales son las únicas vigas horizontales del piece (`from.z === to.z`); la pluma y el estay suben y están marcados. `quayCraneAt` no cambia, así que la grúa de `src/scenes/shipyard-east.ts` y el exhibit del lab tampoco. Con maxH 24 k = 1 y el JSON queda igual.

## Review Focus

1. Lote con `z` ≠ 0: k se mide desde `lot.z`; el test "with lot.z = 0.3 the output is that of lot.z = 0 shifted 0.3 in z" del contrato lo cubre (usa maxH 24, k = 1). El test de la tarea 2 corre también con `z: 0.3`.
2. Pluma y estay (vigas inclinadas): no deben cambiar de sección. Lo cubre la aserción de la tarea 2 sobre las vigas marcadas.
3. maxH ≥ 18: sin aplastar, salida idéntica. Lo cubren los tests de `quayCrane` existentes y el de determinismo.
4. Rumbo de la pluma (`open[0]` w/e/s): las vigas transversales siguen horizontales en los tres; el contrato usa `open` `["s"]` y `["s","e"]`, la tarea 2 corre las tres direcciones.
5. Ninguna otra receta falla hoy; si una futura falla, el mensaje del test nombra receta, lote, estilo y semilla, como el de maxH 24.

---

### Task 1: el chequeo en el test de maxH 10 (eval, rojo)

**Files:**
- Modify: `src/kit/kit.test.ts:200-205`

**Interfaces:**
- Consumes: `interpenetrations(solids: Solid[]): [number, number][]` (ya en `kit.test.ts`).

- [ ] **Step 1: Agregar la aserción** dentro del bucle del test "with maxH 10 …", después de la del tope:

```ts
expect(interpenetrations(p.solids), `${def.name} on ${lot.x},${lot.y} ${id} seed ${seed} maxH 10`).toEqual([]);
```

- [ ] **Step 2: Correr** `npx vitest run src/kit/kit.test.ts`. Esperado: falla solo `quayCrane > with maxH 10 …`.
- [ ] **Step 3: Commit** `test(#354): evals`.

### Task 2: las vigas transversales de quayCrane escalan su sección al aplastarse

**Files:**
- Modify: `src/kit/forms/industrial.ts` (`quayCrane`)
- Test: `src/kit/forms/industrial.test.ts` (`describe("quayCrane")`)

**Interfaces:**
- Consumes: `fitToCap(p: Piece, lot: Lot): Piece`, `bounds`.
- Produces: nada nuevo; la firma de `quayCrane` no cambia.

- [ ] **Step 1: Test que falla** en `describe("quayCrane")`: `"under maxH 10 the cross beams sit flush on the legs and under the cabin"`. Para cada semilla de `SEEDS`, cada `open` de `[["w"], ["e"], ["s"]]` y `z` de `[0, 0.3]`, con `lot = ownLot("quayCrane", { open, z })` y `low = recipe("quayCrane")({ ...lot, maxH: 10 }, createRng(seed), STYLES.industrial)`:
  - `cross` = vigas sin `interlocks`, `legs` = prismas sin `interlocks`, `cab` = el primer prisma con `interlocks`; `cross` tiene 2 elementos;
  - para cada viga de `cross`: `bounds(b).min.z` ≈ `bounds(legs[0]).max.z` y `bounds(b).max.z` ≈ `bounds(cab).min.z` (`toBeCloseTo(…, 9)`);
  - las vigas marcadas conservan las secciones de maxH 24: `h` 0.4 y 0.2.
- [ ] **Step 2: Correr** `npx vitest run src/kit/forms/industrial.test.ts -t "cross beams"`. Esperado: FAIL (min.z 4.933 contra 5.111).
- [ ] **Step 3: Implementar** en `quayCrane`: `const fit = fitToCap(p, lot)`; solo si `fit !== p` (hubo aplastado), k = (tope de `fit` − lot.z) / (tope de `p` − lot.z), con tope = máximo de `bounds(s).max.z` sobre `solids`, y las vigas con `from.z === to.z` de `fit.solids` pasan a `h * k`. Un comentario de una línea con el porqué (fitToCap escala el eje de una viga, no su sección).
- [ ] **Step 4: Correr** `npx vitest run src/kit` y `npm run typecheck`. Esperado: verde, incluida la tarea 1.
- [ ] **Step 5: Commit** `fix(#354): quayCrane cross beams keep flush under maxH 10`.

## Assumptions

1. **Corrección local, no en `mapZ`.** El issue deja fuera "Changing `fitToCap` or the cap values"; escalar la sección de toda viga en `mapZ` cambiaría las piezas aplastadas de otras recetas. Descartado: tocar `mapZ`. El riesgo genérico queda en un follow-up.
2. **k solo cuando hubo aplastado.** `fitToCap` devuelve el mismo objeto si el piece cabe (`src/kit/piece.ts:52`), así que con `fit === p` no se mapea nada y la salida de maxH 24 queda byte a byte igual; con `fit !== p` el tope original es 18 > tope (no hay división por 0). `mapZ` crea objetos nuevos (`piece.ts:61-74`), así que `p` sigue intacto para medir. Descartado: el literal 18 (duplicaría el tope de `quayCraneAt`).
3. **La regla `from.z === to.z`** elige las mismas 2 vigas que el test de #152 cuenta como no marcadas (`industrial.test.ts:236-246`); la pluma y el estay son inclinadas (`industrial.ts:229-231`). El test de la tarea 2 fija que `cross` tiene 2 elementos. Descartado: elegir por índice.
4. **z 0.3 bajo maxH 10:** basta con que las vigas queden a ras; no se agrega una igualdad desplazada con maxH 10 (no la pide el issue).
5. **Commit rojo de la tarea 1:** lo prescribe el pipeline (etapa 3, evals que fallan antes de implementar); el verde se exige al cerrar la tarea 2.

## Grilling

- Rondas: 1 (los cambios no alteran tareas ni costura).
- Preguntas: 15. Fuentes: CODE 10, ISSUE 3, NO SOURCE 2 (supuestos técnicos 4 y 5) — más los supuestos 1-3 que ordenan respuestas con fuente.
- Supuestos: los cinco de arriba.
- Issues abiertos: #358 (sección de las vigas en `fitToCap`).
