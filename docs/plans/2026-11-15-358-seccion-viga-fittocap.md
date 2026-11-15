# `fitToCap` aplasta la sección de las vigas horizontales (#358) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que `mapZ` (`src/kit/piece.ts`) escale por k el `h` de una `beam` horizontal (`from.z === to.z`), de modo que `fitToCap` deje a ras una viga apoyada sobre un sólido aplastado, y quitar el arreglo local de `quayCrane`.

**Arquitectura:** un cambio de una línea en el caso `beam` de `mapZ` más su doc comment; `liftPiece` pasa k = 1, así que no cambia. En el mismo cambio `quayCrane` vuelve a ser `tonePiece(fitToCap(p, lot), tone)`, como `rtgGantry`: si quedara su arreglo, sus vigas transversales se escalarían dos veces (`0.8·k²`) y el test "under maxH 10 the cross beams sit flush on the legs and under the cabin" fallaría. Por eso es una sola tarea.

**Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** el issue #358, el Agent Brief del triage del 2026-11-14.

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- Solo cambia el `h` de las vigas horizontales. Fuera de alcance (Agent Brief): el `w` de las vigas, los otros tipos de sólido en `mapZ`, recetas nuevas, el mecanismo de `interlocks`.
- Las vigas no horizontales (inclinadas o verticales) conservan su `h`.
- `npm test` y `npm run typecheck` en verde; los tests existentes pasan sin tocarlos.
- Commits del pipeline: los tests que fallan van en `test(#358): evals` (etapa 3); la implementación, en `feat(#358): …`; todos con `Co-Authored-By`.

## Decisiones técnicas declaradas

1. **Geometría.** La sección de una `beam` está centrada en su eje (`beam()` en `src/iso/solids.ts`: el anillo usa `±h/2` sobre `up`). En una viga horizontal `up` es vertical, así que `h` es una altura: `[eje.z − h/2, eje.z + h/2]`. Con eje y `h` escalados por k desde `lot.z`, la caja de la viga es la caja original escalada por k, igual que un prisma: el contacto a ras se conserva.
2. **Inclinadas y verticales: `h` sin cambio.** En una viga inclinada `up` no es vertical y `h` no es una altura; escalarla deformaría la sección sin dejarla a ras de nada. En una vertical `up` es horizontal. Se documenta en el doc comment de `mapZ`.
3. **Criterio "horizontal": `from.z === to.z` exacto**, el mismo del arreglo de `quayCrane`. Las z de una viga horizontal salen de la misma expresión, y `mapZ` las pasa por la misma función, así que siguen iguales. Una viga de largo cero (`from` = `to`) cuenta como horizontal: `beam()` la orienta sobre x, horizontal.
4. **Qué salida cambia.** Medido en `main` (6cf0eba): solo `industrial.ts` y `landmarks.ts` llaman a `fitToCap`; las recetas de `landmarks.ts` no tienen vigas, `rtgGantry` tampoco. La única receta con vigas horizontales aplastadas es `quayCrane`, que ya escalaba su `h` por su cuenta con el mismo k (`top(fit)/top(p)` = `cap/top`). Las escenas usan `liftPiece` (k = 1) o no pasan por `mapZ`. Resultado esperado: ninguna salida de receta cambia más allá del redondeo flotante de k; la tarea 1 lo verifica comparando el JSON redondeado a 1e-6 de todas las recetas antes y después.

## Review Focus

1. `liftPiece` con vigas horizontales: k = 1, `h` igual. Test en la tarea 1.
2. Viga inclinada aplastada (pluma, estay): `h` igual. Test "a sloped or vertical beam keeps its section when flattened" de la tarea 1, y en el test existente "under maxH 10 the cross beams sit flush on the legs and under the cabin" la aserción `expect(marked).toEqual([0.4, 0.2])` (los `h` de la pluma y el estay, las dos vigas inclinadas marcadas, tras aplastar con maxH 10).
3. Lote con `lot.z` ≠ 0: el escalado es relativo a `lot.z`. El test de la tarea 1 usa `LOT` de `piece.test.ts` (`z: 2`).
4. Pieza que entra en el tope: `fitToCap` la devuelve igual (test existente "a piece that fits within the cap comes out unchanged").
5. `quayCrane` con maxH ≥ 18 y con maxH 10 en las tres direcciones de pluma: los tests existentes de `quayCrane` y el contrato del kit (maxH 10 y 24) cubren que no cambie.

---

### Task 1: `mapZ` escala el `h` de las vigas horizontales y `quayCrane` deja su arreglo

**Files:**
- Modify: `src/kit/piece.ts` (caso `beam` de `mapZ`; doc comments de `fitToCap` y `mapZ`)
- Modify: `src/kit/forms/industrial.ts` (`quayCrane`, líneas 236-245; import de `bounds` si queda sin uso)
- Test: `src/kit/piece.test.ts` (describe `fitToCap` y describe `seat`); existentes en `src/kit/forms/industrial.test.ts` (`describe("quayCrane")`) y `src/kit/kit.test.ts` (contrato con maxH 10 y 24)

**Interfaces:**
- Consumes: `fitToCap(p: Piece, lot: Lot): Piece`, `liftPiece(p: Piece, dz: number): Piece` (firmas sin cambio); `prism(x, y, z, w, d, h, mat)` de `src/scenes/city-pieces.ts`, ya importado en `piece.test.ts`.
- Produces: `fitToCap` devuelve vigas horizontales con `h * k`; `quayCrane(lot, rng, style): Piece` termina en `return tonePiece(fitToCap(p, lot), tone);`.

- [ ] **Step 1: tests que fallan** en `src/kit/piece.test.ts` (etapa 3, commit `test(#358): evals`):
  - En `describe("fitToCap")`, `it("a horizontal beam resting on a prism is flattened with its section and stays flush on it")`: `LOT` (z 2, maxH 10); prisma `prism(0, 0, 2, 1, 1, 17.2, "steel")` (tope en z 19.2) y viga `{ kind: "beam", from: v3(0.5, 0, 19.6), to: v3(0.5, 6, 19.6), w: 0.8, h: 0.8, mat: "steel" }` (z 19.2..20 por `bounds`, que recorre las caras teseladas, a ras del prisma); alto de la pieza 18 sobre `lot.z`, k = 10/18. Aserciones: `h` de la viga ≈ `0.8 * 10 / 18` (`toBeCloseTo(…, 9)`); `bounds(viga).min.z` ≈ `bounds(prisma).max.z` (9 decimales); tope de la pieza ≈ 12.
  - En `describe("fitToCap")`, `it("a sloped or vertical beam keeps its section when flattened")`: viga inclinada `from` (0,0,2) → `to` (4,0,20), `h` 0.4; viga vertical `from` (5,5,2) → `to` (5,5,20), `h` 0.3; tras `fitToCap(p, LOT)`, `h` 0.4 y 0.3 exactos.
  - En `describe("seat")` (donde viven los tests de `liftPiece`, p. ej. "liftPiece does not move normals and does not mutate its input"), `it("liftPiece keeps the section of horizontal and sloped beams")`: viga horizontal `h` 0.8 y una inclinada `h` 0.4; `liftPiece(p, 2)` deja `h` 0.8 y 0.4 y sube las z 2.
- [ ] **Step 2:** `npx vitest run src/kit/piece.test.ts` — falla solo el test de la viga horizontal (h 0.8 ≠ 0.444…); los otros dos pasan ya (fijan comportamiento).
- [ ] **Step 3: foto previa.** Antes de tocar código, volcar el JSON redondeado a 1e-6 (como el `rounded` local de `piece.test.ts`, que no está exportado: se copia) de `def.recipe(lot, createRng(seed), STYLES[id])` para todo `RECIPES`, con los lotes del contrato (`lotsFor` de `kit.test.ts`: los dos `LOTS` con z 0, o los de `LAB_LOTS`, que incluyen `footbridge` con z −1), maxH 10 y 24, todos los `STYLES`, semillas 1..5. Script temporal `.scratch/dump-358.ts` (excluido en `.git/info/exclude`), corrido con `npx tsx` como los scripts de `package.json`; no se commitea.
- [ ] **Step 4:** en `mapZ`, caso `beam`: `h: s.from.z === s.to.z ? s.h * k : s.h`. Doc comment de `mapZ`: "every height scaled by `k`, including the section `h` of a horizontal beam (`from.z === to.z`); a sloped or vertical beam keeps `h`, which is not a height". Doc comment de `fitToCap`: una viga horizontal apoyada a ras sigue a ras.
- [ ] **Step 5:** en `quayCrane`, quitar `const fit`, `if (fit === p)`, el comentario, `top`/`k` y el `map` de vigas: queda `return tonePiece(fitToCap(p, lot), tone);`. `bounds` sigue usado en `industrial.ts:136`; `noUnusedLocals` está activo en `tsconfig.json`, así que el typecheck avisa si quedara sin uso.
- [ ] **Step 6:** repetir el volcado y compararlo con el previo: idéntico. Si algo difiere, es un hallazgo: anotarlo en el comentario de la etapa.
- [ ] **Step 7:** `npm test` y `npm run typecheck` — verde, incluidos los tres tests nuevos, "under maxH 10 the cross beams sit flush on the legs and under the cabin" y el chequeo de interpenetración del contrato con maxH 10 y 24.
- [ ] **Step 8:** commit `feat(#358): fitToCap flattens the section of horizontal beams`.

## Assumptions

1. **Una sola tarea en vez de dos.** Rechazado: commitear `mapZ` antes de limpiar `quayCrane` deja el repo en rojo (escalado doble).
2. **`from.z === to.z` exacto, sin tolerancia.** Rechazado: un épsilon. Las vigas horizontales del repo usan la misma expresión de z en `from` y `to` (`quayCraneAt`, `industrial.ts:221`: `P(l, -3, z + 9.6)` / `P(l, 3, z + 9.6)`).
3. **Inclinadas y verticales conservan `h`** (lo que el Agent Brief prefiere). Rechazado: escalar `h` por el coseno de la pendiente.
4. **El volcado antes/después es un script de `.scratch/`, no un test commiteado.** Rechazado: un snapshot permanente; el contrato del kit ya cubre interpenetración y tope.

## Grilling

Dos rondas (griller `fable`), 16 + 15 preguntas. Respuestas por fuente, sumando las dos rondas: CODE 27, ISSUE 2 (Agent Brief: criterios y "preferably unchanged"), DOC 1 (CONTEXT.md, Landmark recipe: no define la sección de las vigas; no hay que enmendarlo), NO SOURCE 1 → supuesto técnico.

Respuestas que corrigieron el plan:

- Ronda 1, escalado doble entre tareas: era cierto (`industrial.test.ts`, "under maxH 10 the cross beams sit flush…", compara `bounds(b).min.z` con el tope de las patas a 9 decimales). Las dos tareas se fundieron en una.
- Rondas 1 y 2, `.scratch/`: `vitest.config.ts` incluye solo `src/**/*.test.ts` y `scripts/**/*.test.ts`, así que el volcado es un script `tsx`; `.scratch/` va en `.git/info/exclude`.
- Ronda 1, commits: los tests en rojo van en `test(#358): evals` (prompt del pipeline, etapa 3).

Respuestas con fuente que no cambiaron el plan:

- Mismo k: `fitToCap` usa `top = max z − lot.z`, `k = cap / top` y aplasta con `lot.z + (n − lot.z)·k` (`src/kit/piece.ts:49-55`); el `top` de `quayCrane` también resta `lot.z` (`industrial.ts:243`), así que `top(fit)/top(p) = cap/top` también con `lot.z ≠ 0`.
- El predicado del arreglo es `s.kind === "beam" && s.from.z === s.to.z` (`industrial.ts:244`): las mismas vigas que va a escalar `mapZ`. Las únicas vigas horizontales de `quayCraneAt` son las dos transversales (`industrial.ts:221`); los rieles son `strip`.
- `up` sale solo del eje (`solids.ts:266-270`, `up = u × side`); para `u = (ux, uy, 0)` da `(0, 0, 1)` en cualquier dirección del plano. El tipo `beam` es `{ from, to, w, h, mat }` (`solids.ts:26`), sin roll. Largo cero: `u = (1, 0, 0)` (`solids.ts:266`).
- `bounds(s: Solid)` recorre las caras teseladas (`solids.ts:452-460`), así que incluye la sección. `prism(x, y, z, w, d, h, mat)` devuelve un `Prism` con base en `z` (`city-pieces.ts:19-20`).
- `fitToCap` devuelve la pieza intacta si `top <= cap` (`piece.ts:52`): nunca llama a `mapZ` con k ≥ 1 ni con `top ≤ 0`.
- `mapZ` no está exportado (`piece.ts:61`); `fitToCap` se llama solo en `industrial.ts:240,265` y `landmarks.ts` (siete recetas); `landmarks.ts` y sus helpers (`props.ts`, `roofs.ts`) no construyen vigas; `rtgAt` usa prismas y cilindros (`industrial.ts:249-257`).
- `noUnusedLocals: true` (`tsconfig.json:8`); `bounds` se usa en `industrial.ts:136`, fuera de `quayCrane`.
- La dirección de la pluma sale de `lot.open[0]`, no del rng (`industrial.ts:239`); el volcado usa los `open` del contrato (`s`), y las tres direcciones las cubre el test existente que recorre `[["w"], ["e"], ["s"]]` (`industrial.test.ts:249`).

Supuestos (NO SOURCE): el volcado antes/después es un script `tsx` (ya en `devDependencies`, usado por `npm run validate`) en vez de un test de Vitest con config propia. Su resultado queda en el comentario de la etapa 4.

Issues abiertos: ninguno. Resultado: `ok`.
