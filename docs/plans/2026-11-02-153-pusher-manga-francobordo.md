# Manga y francobordo del empujador en constantes, `PUSHER_BEAM` y `PUSHER_H` (#153): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la manga (7) y el francobordo (1.6) del empujador de la barcaza vivan cada uno en una sola constante, junto a `PUSHER_LEN`, y que el casco del empujador, su bloque de proa y `pDeck` se deriven de ellas sin mover un bit de la geometría.

**Architecture:** todo pasa en `src/scenes/ships.ts`. Hoy `barge()` escribe la manga y el francobordo en el casco (`k.hull(stern, PUSHER_LEN, 7, 1.6, 0, "hullBlue")`, `ships.ts:122`), los repite en el bloque de proa (`k.box(-5.5, -3.5, 5.5, 7, -0.9, 1.55, "hullBlue")`, misma línea) y otra vez el francobordo en `const pDeck = WATER_Z + 1.6 + 0.05` (`ships.ts:123`). Una sola task agrega `PUSHER_BEAM = 7` y `PUSHER_H = 1.6` a la declaración de `PUSHER_LEN` (`ships.ts:28`) y reemplaza los literales de esas dos líneas.

**Tech Stack:** TypeScript y Vitest.

**Spec:** issue #153 (follow-up de la revisión de #68). Fuera de alcance: cambiar la forma del empujador o de la barcaza, y nombrar otras medidas de la superestructura.

## Global Constraints

- Criterio 1: el casco del empujador, el bloque de proa y `pDeck` toman la manga de `PUSHER_BEAM` y el francobordo de `PUSHER_H`; ninguno de los tres repite `7`, `3.5`, `1.6` ni `1.55` como literal.
- Criterio 2: geometría idéntica. Ninguna expectativa existente de `src/scenes/ships.test.ts` se edita; los tests nuevos solo se agregan.
- Criterio 3: `npm test` y `npm run typecheck` en verde.
- Nombres pedidos por el issue: `PUSHER_BEAM`, `PUSHER_H`.
- Tests y comentarios en castellano, como el resto de `ships.ts` y `ships.test.ts`. Los tests se commitean primero, como `test(#153): evals`; la implementación commitea solo `ships.ts` como `refactor(#153): …`, en inglés como en #68.

## Decisiones técnicas (declaradas)

1. **Constantes de módulo, no exportadas**, en la misma línea que `PUSHER_LEN`: `const PUSHER_LEN = 20, PUSHER_BEAM = 7, PUSHER_H = 1.6;`, con el comentario actualizado (eslora, manga y francobordo del empujador). Solo las usa `barge()`. Igual que `PUSHER_LEN` en #68 (plan `2026-10-18-68-pusher-len.md`, decisión 1).
2. **Derivaciones exactas** (verificadas con `node -e`, todas `true`):
   - Bloque de proa en y: `-PUSHER_BEAM / 2` (`-(7 / 2) === -3.5`) y profundidad `PUSHER_BEAM`.
   - Alto del bloque de proa: `PUSHER_H - 0.05` (`1.6 - 0.05 === 1.55`). El bloque arranca en z −0.9, 0.1 sobre `WATER_Z`, y termina 0.05 sobre el francobordo, a la altura de `pDeck`: `1.6 + 0.05 - 0.1`. Se rechaza `pDeck + 0.9` (o `pDeck - (-0.9)`): da `1.5500000000000003` y movería el tope del bloque en el último bit.
   - `pDeck = WATER_Z + PUSHER_H + 0.05`: misma expresión con el término nombrado, mismo double (`0.6500000000000001`).
3. **Quedan como literales** el `-5.5` / `5.5` (largo del bloque de proa, medido desde la proa del empujador en x 0) y el `-0.9` (base del bloque, la misma de los bloques que cuadran el casco de la barcaza). No son la manga ni el francobordo, y el issue no los nombra.
4. **El criterio 1 se prueba leyendo el fuente**, como el test de `sternOf` de #68 (`ships.test.ts`, `describe("eslora del empujador (#68)")`): ningún test de comportamiento distingue `7` de `PUSHER_BEAM`. El test toma el cuerpo de `barge()` (de `function barge(` hasta `function ferry(`), toma las líneas que contienen `"hullBlue"` (hoy una sola, con el casco y el bloque de proa) y la de `const pDeck`, y exige que haya al menos una de cada, que ninguna contenga `7`, `3.5`, `1.6` ni `1.55` como número suelto (regex `/(?<![\w.])(7|3\.5|1\.6|1\.55)(?![\w.])/`), que alguna línea `hullBlue` contenga `PUSHER_BEAM, PUSHER_H` y que la de `pDeck` contenga `PUSHER_H`.
5. **Test de caracterización del bloque de proa con `toBe`.** El test existente ("proa del empujador cuadrada") usa `near` con 1e-6 y no ve una deriva en el último bit. El nuevo fija con igualdad exacta: `z === -0.9`, `h === 1.55`, `min.y === -3.5`, `max.y === 3.5`, `min.x === -5.5`, `max.x === 0`, y que los pechos de empuje y la casilla larga apoyen en `z === -1 + 1.6 + 0.05`. Pasa antes y después del cambio.

## Review Focus

1. **Deriva de punto flotante** en el alto del bloque de proa o en `pDeck`: la cubre el test de caracterización con `toBe` (decisión 5).
2. **Casco del empujador** en `dx −20, len 20, beam 7, h 1.6, sheer 0`: lo cubre el test existente `hulls[1]` de `ships.test.ts`.
3. **La superestructura sobre `pDeck`** (pechos sobre la barcaza, torre, barandas, bote): la cubren los tests existentes de la barge y el de caracterización de #68, que no se tocan.
4. **Constantes que se filtran fuera de `ships.ts`**: `PUSHER_BEAM` y `PUSHER_H` no se exportan; se revisa en el diff.
5. **Otros barcos sin cambios**: `cargo`, `tug` y `ferry` no usan las constantes; los cubre la suite existente.

---

### Task 1: `PUSHER_BEAM` y `PUSHER_H` en el casco, el bloque de proa y `pDeck`

**Files:**
- Modify: `src/scenes/ships.ts:28` (constantes), `src/scenes/ships.ts:122-123` (`barge()`)
- Test: `src/scenes/ships.test.ts` (un `describe` nuevo al final)

**Interfaces:**
- Consumes: `PUSHER_LEN` y `const stern = -PUSHER_LEN` (ya existen).
- Produces: `PUSHER_BEAM = 7`, `PUSHER_H = 1.6`, no exportadas. Las firmas públicas (`ship`, `shipAt`, `wake`, `SHIP_SPECS`) no cambian.

- [ ] **Step 1: Write the failing tests**

Al final de `src/scenes/ships.test.ts`, `describe("manga y francobordo del empujador (#153)", …)` con dos `it`:

- `"el casco, el bloque de proa y pDeck toman PUSHER_BEAM y PUSHER_H, sin literales propios"`: lee `./ships.ts` con `readFileSync` (ya importado), recorta el cuerpo de `barge()` y aplica la decisión 4. Falla hoy.
- `"el bloque de proa y la cubierta del empujador quedan donde estaban, bit a bit"`: con `ship("barge", { x: 0, y: 0 }, 0)`, ubica el `poly` `hullBlue` (el único sólido `poly` de ese material) y fija con `toBe` los valores de la decisión 5; ubica los pechos (`whitewash`, sin `facade`, `max.x <= 1e-9`, `min.x >= -1.5`) y la casilla larga (`whitewash`, `min.x < -10`, `h === 1.55`) y exige `z` `toBe(-1 + 1.6 + 0.05)`. Pasa hoy.

- [ ] **Step 2: Run tests to verify the first fails and the second passes**

Run: `npx vitest run src/scenes/ships.test.ts -t "manga y francobordo"`
Expected: el test de fuente FALLA (la línea del casco tiene `7, 1.6`); el de caracterización PASA. Si el de caracterización falla, el selector está mal: corregir el selector, no los valores.

- [ ] **Step 3: Commit the tests**

```bash
git add src/scenes/ships.test.ts
git commit -m "test(#153): evals"
```

- [ ] **Step 4: Implement**

En `src/scenes/ships.ts`, la línea 28 pasa a declarar `PUSHER_LEN`, `PUSHER_BEAM` y `PUSHER_H` (decisión 1). En `barge()`, el casco pasa a `k.hull(stern, PUSHER_LEN, PUSHER_BEAM, PUSHER_H, 0, "hullBlue")`, el bloque de proa a `k.box(-5.5, -PUSHER_BEAM / 2, 5.5, PUSHER_BEAM, -0.9, PUSHER_H - 0.05, "hullBlue")` y `pDeck` a `WATER_Z + PUSHER_H + 0.05`. Nada más cambia.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, los dos tests nuevos y todos los existentes, sin tocar sus expectativas.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/ships.ts
git commit -m "refactor(#153): PUSHER_BEAM and PUSHER_H drive the pusher hull, bow block and deck"
```

## Assumptions

1. **El alto del bloque de proa se escribe `PUSHER_H - 0.05`** y no desde `pDeck`, para no mover el último bit (decisión 2). Si el francobordo cambia, el tope del bloque sigue a `pDeck` igual.
2. **El test de fuente asume que cada una de las tres sentencias está en una línea**, como hoy. El repo no tiene formateador (`.factory/config.toml`: "No linter is configured"). Si alguien las parte, el test falla al no encontrar la línea, y ese aviso alcanza.
3. **`-0.9` queda literal y no pasa a `WATER_Z + 0.1`**, aunque `-1 + 0.1 === -0.9` da `true`. Es la base compartida con los bloques que cuadran el casco de la barcaza (`ships.ts:111-113`, también `-0.9` literal) y no es manga ni francobordo; nombrarla es otro refactor.
4. **El `0.05` de `pDeck` queda suelto.** Es el margen de cubierta que la barcaza también escribe suelto (`top = deck + 0.05`, `ships.ts:115`). El issue no lo nombra.
5. **El `1.55` de la casilla larga y de los niveles de la torre (`pDeck + 1.55`) no es francobordo**: es el alto de un nivel de superestructura sobre `pDeck`. Coincide en valor con el alto del bloque de proa, pero no se mueve si cambia el francobordo. El criterio 1 solo mira las líneas `hullBlue` y `pDeck`.
6. **La regex no atrapa grafías como `7.0` o `1.60`.** Se acepta: el test es un guardián del texto de hoy, como el de `sternOf`, no un detector de evasiones.
7. **Commit en rojo.** `test(#153): evals` deja `npm test` en rojo hasta el commit siguiente; lo pide el pipeline del agente (etapa 3), no una regla del repo. Si la implementación se abandona, la rama queda con ese commit y sin PR; se revierte con `git revert`.
8. **Ejecución con subagent-driven-development.** `executing-plans` no está en `AGENTS.md`; la cabecera es la plantilla de la skill.

## Grilling

- Rondas: 1. Preguntas: 15. El plan no cambió de forma (ni pasos nuevos ni quitados): solo se agregaron supuestos 3–8, así que no hizo falta una segunda ronda.
- Respuestas por fuente:
  - ISSUE (Q4, Q13 en parte): "Its freeboard `1.6` is written a second time in `const pDeck = WATER_Z + 1.6 + 0.05`… The bow block next to it (`k.box(-5.5, -3.5, 5.5, 7, -0.9, 1.55, …)`) repeats the beam `7` (y −3.5 … 3.5), and its height `1.55` is tied to the same freeboard."
  - CODE (Q1, Q2, Q3, Q5, Q7, Q8, Q9, Q14): selectores ejecutados contra `ship("barge", {x:0,y:0}, 0)` (un solo `poly` `hullBlue`, en `x −5.5…0, y −3.5…3.5, z −0.9, h 1.55`; dos pechos; una casilla); `kit()` en `ships.ts:42-52` (`hull` emite `kind: "hull"`, `box(dx, dy, w, d, z, h, …)` arma el footprint hacia +x/+y y pasa `z`/`h` sin transformar); `function barge` en `ships.ts:109` seguida de `function ferry` en `ships.ts:137`; `WATER_Z = -1` en `ships.ts:27`, no exportado, y el test de #68 ya escribe `-1 + 1.6 + 0.05` (`ships.test.ts:284`); `readFileSync(new URL("./ships.ts", import.meta.url))` en `ships.test.ts:276`; `hulls[1]` con `toMatchObject` (igualdad estricta) en `ships.test.ts:125`; `ship()` en `ships.ts:157`.
  - NO SOURCE → supuesto técnico (Q6, Q10, Q11, Q12, Q13, Q15): supuestos 3–8 y supuesto 2 de la decisión de commits (inglés como #68).
- Spec ambiguity: ninguna. Fuera de alcance: ninguno; no se abrieron issues.
