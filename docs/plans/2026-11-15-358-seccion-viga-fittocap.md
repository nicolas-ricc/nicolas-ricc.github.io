# `fitToCap` aplasta la sección de las vigas horizontales (#358) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que `mapZ` (`src/kit/piece.ts`) escale por k el `h` de una `beam` horizontal (`from.z === to.z`), de modo que `fitToCap` deje a ras una viga apoyada sobre un sólido aplastado, y quitar el arreglo local de `quayCrane`.

**Arquitectura:** un cambio de una línea en el caso `beam` de `mapZ` más su doc comment; `liftPiece` pasa k = 1, así que no cambia. Después, `quayCrane` vuelve a ser `tonePiece(fitToCap(p, lot), tone)`, como `rtgGantry`.

**Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** el issue #358, el Agent Brief del triage del 2026-11-14.

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- Solo cambia el `h` de las vigas horizontales. Fuera de alcance (Agent Brief): el `w` de las vigas, los otros tipos de sólido en `mapZ`, recetas nuevas, el mecanismo de `interlocks`.
- Las vigas no horizontales (inclinadas o verticales) conservan su `h`.
- `npm test` y `npm run typecheck` en verde; los tests existentes pasan sin tocarlos.
- Commits `test(#358): …` / `feat(#358): …` / `refactor(#358): …`, con `Co-Authored-By`.

## Decisiones técnicas declaradas

1. **Geometría.** La sección de una `beam` está centrada en su eje (`beam()` en `src/iso/solids.ts`: el anillo usa `±h/2` sobre `up`). En una viga horizontal `up` es vertical, así que `h` es una altura: `[eje.z − h/2, eje.z + h/2]`. Con eje y `h` escalados por k desde `lot.z`, la caja de la viga es la caja original escalada por k, igual que un prisma: el contacto a ras se conserva.
2. **Inclinadas y verticales: `h` sin cambio.** En una viga inclinada `up` no es vertical y `h` no es una altura; escalarla deformaría la sección sin dejarla a ras de nada. En una vertical `up` es horizontal. Se documenta en el doc comment de `mapZ`.
3. **Criterio "horizontal": `from.z === to.z` exacto**, el mismo del arreglo de `quayCrane`. Las z de una viga horizontal salen de la misma expresión, y `mapZ` las pasa por la misma función, así que siguen iguales. Una viga de largo cero (`from` = `to`) cuenta como horizontal: `beam()` la orienta sobre x, horizontal.
4. **Qué salida cambia.** Medido en `main` (6cf0eba): solo `industrial.ts` y `landmarks.ts` llaman a `fitToCap`; las recetas de `landmarks.ts` no tienen vigas, `rtgGantry` tampoco. La única receta con vigas horizontales aplastadas es `quayCrane`, que ya escalaba su `h` por su cuenta con el mismo k (`top(fit)/top(p)` = `cap/top`). Las escenas usan `liftPiece` (k = 1) o no pasan por `mapZ`. Resultado esperado: ninguna salida de receta cambia más allá del redondeo flotante de k; la tarea 2 lo verifica comparando el JSON redondeado a 1e-6 de todas las recetas antes y después.

## Review Focus

1. `liftPiece` con vigas horizontales: k = 1, `h` igual. Test en la tarea 1.
2. Viga inclinada aplastada (pluma, estay): `h` igual. Test en la tarea 1 y el test existente "under maxH 10 the cross beams sit flush on the legs and under the cabin" (`[0.4, 0.2]`).
3. Lote con `lot.z` ≠ 0: el escalado es relativo a `lot.z`. El test de la tarea 1 usa `LOT` de `piece.test.ts` (`z: 2`).
4. Pieza que entra en el tope: `fitToCap` la devuelve igual (test existente "a piece that fits within the cap comes out unchanged").
5. `quayCrane` con maxH ≥ 18 y con maxH 10 en las tres direcciones de pluma: los tests existentes de `quayCrane` y el contrato del kit (maxH 10 y 24) cubren que no cambie.

---

### Task 1: `mapZ` escala el `h` de las vigas horizontales

**Files:**
- Modify: `src/kit/piece.ts` (caso `beam` de `mapZ`; doc comments de `fitToCap` y `mapZ`)
- Test: `src/kit/piece.test.ts` (describe `fitToCap` y describe `seat`)

**Interfaces:**
- Consumes: `fitToCap(p: Piece, lot: Lot): Piece`, `liftPiece(p: Piece, dz: number): Piece` (firmas sin cambio).
- Produces: `fitToCap` devuelve vigas horizontales con `h * k`; nada más cambia.

- [ ] **Step 1: tests que fallan** en `src/kit/piece.test.ts`:
  - En `describe("fitToCap")`, `it("a horizontal beam resting on a prism is flattened with its section and stays flush on it")`: `LOT` (z 2, maxH 10); prisma `prism(0, 0, 2, 1, 1, 17.2, "steel")` (tope en z 19.2) y viga `{ kind: "beam", from: v3(0.5, 0, 19.6), to: v3(0.5, 6, 19.6), w: 0.8, h: 0.8, mat: "steel" }` (z 19.2..20, a ras del prisma); alto de la pieza 18 sobre `lot.z`, k = 10/18. Aserciones: `h` de la viga ≈ `0.8 * 10 / 18` (`toBeCloseTo(…, 9)`); `bounds(viga).min.z` ≈ `bounds(prisma).max.z` (9 decimales); tope de la pieza ≈ 12.
  - En `describe("fitToCap")`, `it("a sloped or vertical beam keeps its section when flattened")`: viga inclinada `from` z 2 → `to` z 20, `h` 0.4; viga vertical `from` (5,5,2) → `to` (5,5,20), `h` 0.3; tras `fitToCap(p, LOT)`, `h` 0.4 y 0.3 exactos.
  - En `describe("seat")`, `it("liftPiece keeps the section of horizontal and sloped beams")`: viga horizontal `h` 0.8 y una inclinada `h` 0.4; `liftPiece(p, 2)` deja `h` 0.8 y 0.4 y sube las z 2.
- [ ] **Step 2:** `npx vitest run src/kit/piece.test.ts` — falla solo el test de la viga horizontal (h 0.8 ≠ 0.444…); los otros dos pasan ya (fijan comportamiento).
- [ ] **Step 3:** en `mapZ`, caso `beam`: `h: s.from.z === s.to.z ? s.h * k : s.h`. Doc comment de `mapZ`: "every height scaled by `k`, including the section `h` of a horizontal beam (`from.z === to.z`); a sloped or vertical beam keeps `h`, which is not a height". Doc comment de `fitToCap`: agregar que una viga horizontal apoyada a ras sigue a ras.
- [ ] **Step 4:** `npx vitest run src/kit/` — verde.
- [ ] **Step 5:** commit `feat(#358): fitToCap flattens the section of horizontal beams`.

### Task 2: `quayCrane` sin su arreglo posterior a `fitToCap`

**Files:**
- Modify: `src/kit/forms/industrial.ts` (`quayCrane`, líneas ~236-245; import de `bounds` si queda sin uso)
- Test: existentes, `src/kit/forms/industrial.test.ts` (`describe("quayCrane")`) y `src/kit/kit.test.ts` (contrato maxH 10 y 24)

**Interfaces:**
- Consumes: `fitToCap` de la tarea 1.
- Produces: `quayCrane(lot, rng, style): Piece` con el cuerpo `return tonePiece(fitToCap(p, lot), tone);` tras `quayCraneAt`.

- [ ] **Step 1: foto previa.** Antes de tocar `quayCrane`, volcar el JSON redondeado a 1e-6 (el `rounded` de `piece.test.ts`) de `def.recipe(lot, createRng(seed), STYLES[id])` para todo `RECIPES`, los lotes de `kit.test.ts` (`LAB_LOTS` o 24 × 18), maxH 10 y 24, semillas 1..5, a un archivo fuera del repo (`.scratch/`, ignorado). Script temporal de Vitest en `.scratch/`, no se commitea.
- [ ] **Step 2:** quitar las líneas del arreglo (`const fit`, `if (fit === p)`, el comentario, `top`/`k` y el `map` de vigas): queda `return tonePiece(fitToCap(p, lot), tone);`. Quitar `bounds` del import si ya no se usa (`bounds` también se usa en la línea ~136: verificar con el typecheck).
- [ ] **Step 3:** repetir el volcado y compararlo con el previo: idéntico. Si algo difiere, es un hallazgo: anotarlo en el comentario de la etapa.
- [ ] **Step 4:** `npm test` y `npm run typecheck` — verde, incluidos "under maxH 10 the cross beams sit flush on the legs and under the cabin" y el chequeo de interpenetración del contrato con maxH 10 y 24.
- [ ] **Step 5:** commit `refactor(#358): quayCrane relies on fitToCap for its cross beams`.
