# #425 Tramo sur de los carriles al este del cabo mudado y del sitio angosto, al oeste del sitio ancho (#423 hijo 1) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el tramo sur de `LANE_OUT` y `LANE_BACK` (desde (434, 176)) por la geometría decidida en #425, para que los carriles dejen lugar al cabo mudado y a los dos sitios de Writing que entran en hijos posteriores, con todos los tests de carriles en verde sobre el mundo de hoy.

**Architecture:** Solo cambian dos literales de `src/scenes/sea-anim.ts` y sus comentarios. Un test nuevo en `sea-anim.test.ts` fija las distancias a las cubiertas futuras de Writing y al polígono futuro del cabo, como literales. El inventario de #88 (`scripts/barcos-inventario.test.ts`), que valida una tabla histórica contra el `shipStateAt` vivo, pasa a validarla contra la geometría de #87 fijada en el test. Docs: `CONTEXT.md` *Lanes* y comentarios de `sea.ts`.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #425; `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md` §3.3.

## Global Constraints

- El tramo norte no cambia: `LANE_OUT` empieza (362, −16) (398, 40) (424, 86) (437, 114) (440, 142) (434, 176); `LANE_BACK` termina (482, 144) (477, 102) (461, 66) (434, 18) (397, −39).
- Vértices finales (validados al planificar, ver "Verificación previa"):
  - `LANE_OUT`: … (434, 176) (446, 232) (452, 290) (478, 350) (500, 405) **(523, 510)**.
  - `LANE_BACK`: **(564, 467)** (548, 330) (540, 262) (520, 200) (482, 144) ….
- `FADE_U = 30`: el punto a `FADE_U` del fin de `LANE_OUT` y del inicio de `LANE_BACK` cae sobre el borde del cover 16:9, la recta x + y ≈ 996,88 entre (825,3, 171,5) y (288,5, 708,3) (`coverQuad(16/9)`).
- Sitios futuros de Writing: (550, 125) ancho y (440, 400) angosto; cubierta = `PLATFORM_DECK` (`sign-platform.ts`, en el origen) trasladada al sitio.
- Cabo futuro: `[[344,272],[358,269],[386,276],[414,286],[414,294],[386,304],[358,306],[344,302]]`.
- Distancia mínima de cada carril, muestreado a 1 u, a las dos cubiertas futuras y al cabo futuro: ≥ 14 u.
- `LANE_OUT`: x ≥ 440 en y = 290 y x ≥ 481 en y = 400. `LANE_BACK`: x ≤ 500 en y = 125.
- No se toca `sign-platform.ts`, `geo.ts`, la posición de boyas, pecio ni plataforma: los sitios y el cabo nuevos entran en #426/#427.
- Comentarios de código en inglés (como el resto de `src/`); docs de `docs/` en castellano rioplatense.
- `npm test` y `npm run typecheck` en verde.

## Verificación previa (hecha al planificar, con los vértices finales aplicados a mano y revertidos)

- Muestreo a 1 u de los dos carriles: agua, `depthAt ≥ 6`, Blog para x ≥ 380 y `inCoverQuad(p) === (quedan más de FADE_U)`: sin fallas con extremos enteros (523, 510) y (564, 467). El cálculo exacto da (523,14, 509,52) y (563,59, 466,50); los enteros pasan el muestreo, así que van enteros (lo que pide el issue).
- Oclusión estática, separación de cargueros, lancha > 20 u, cobertura y "ningún barco cruza las letras": verdes.
- `laneLength("out")` = 560,67 (antes 687,9); `laneLength("back")` = 543,94 (antes 664,9). Rumbo `laneAt("back", 0)` = `atan2(330 − 467, 548 − 564)` ≈ −1,687.
- Distancias mínimas (cubierta ancha / angosta / cabo): `LANE_OUT` 79,4 / 16,3 / 37,4; `LANE_BACK` 27,9 / 81,9 / 127,3. x en y 290: 452,0; en y 400: 498,0 (`LANE_OUT`); x en y 125: 479,8 (`LANE_BACK`).
- Boyas (398, 150) y (392, 200): 40 y 46,1 u al oeste de `LANE_OUT`. Pecio: `LANE_BACK` a 17,6 u al este de la proa (≈ (524,6, 282)) y 47,6 u de la popa `WRECK` (490, 262).
- `npm test` completo con los vértices nuevos: fallan solo los tres asertos de `sea-anim.test.ts` fijados a la geometría vieja y `scripts/barcos-inventario.test.ts` ("capturas instantáneas", tabla de #88).

## Assumptions (supuestos técnicos, declarados)

- **Inventario de #88.** `docs/superpowers/specs/2026-10-17-barcos-inventario.md` §"Capturas instantáneas" registra los estados de los barcos en seis instantes con los carriles de #87 (`CYCLE_MS` 1 172 343 ms). Es historia: no se reescriben capturas ni tabla. Su test pasa a calcular el estado con la geometría de #87 fijada como literales (los 8 vértices viejos de cada carril, `polyline(...).length`) y las constantes vivas `LANE_SPEED`, `FADE_U`, `OFF_MS`, `PORT_MS`, `SHIPS`. Se agrega al doc una nota que lo dice. Es el mismo criterio que el plan de #423 (decisión 11) aplica a la spec 2026-11-17. Alternativa descartada: recalcular la tabla con el ciclo nuevo, que describiría capturas que nunca se tomaron.
- La comprobación "x ≥ 440 en y = 290" se hace sobre los puntos del muestreo a 1 u cuya y está a menos de 0,5 u de 290 (ídem 400 y 125): en el tramo sur los carriles son monótonos en y, así que hay al menos uno por altura.
- Distancia punto–polígono: 0 si el punto cae adentro (`pointInPolygon` de `geo.ts`), si no el mínimo a los lados (segmentos). Sirve para la cubierta (cuadrilátero convexo) y para el cabo (octógono no necesariamente convexo).
- El README dice "`LANE_OUT` goes down toward the lower-left of the screen": sigue valiendo (el fin pasa de pantalla x = −270 a x = 13, abajo y a la izquierda del inicio) y `src/lab/docs.test.ts:22-25` lo exige. No se cambia. Ningún archivo dice "oeste del pecio" fuera de la historia de #88 (`despues-pecio`), que no se toca.
- `ships.test.ts`, `ships-reference.test.ts` y `sign-platform.test.ts` usan los carriles y pasan con la geometría nueva (comprobado): no se tocan.

## Criterios de aceptación del issue (transcriptos)

- [ ] Todos los tests de `src/scenes/sea-anim.test.ts` en verde con el mundo de hoy, incluido "ningún barco cruza las letras". → Task 1.
- [ ] Test nuevo: ≥ 14 u a las dos cubiertas futuras y al polígono futuro del cabo, para los dos carriles. → Task 1.
- [ ] `LANE_OUT` x ≥ 440 en y = 290 y x ≥ 481 en y = 400; `LANE_BACK` x ≤ 500 en y = 125 (asertos en el test nuevo). → Task 1.
- [ ] `npm test` y `npm run typecheck` en verde; vértices finales y motivo de ajustes en el PR. → Task 2.

## Review Focus

- **Muestreo justo en el borde del fundido:** con el extremo redondeado a entero, una muestra entera `d` con `L − d` apenas > 30 podría caer fuera del cover. Esperado: el aserto existente `inCoverQuad(p) === (L − d > FADE_U)` corre a 1 u y pasa; si un ajuste de vértice lo rompe, se pasa a un decimal.
- **Barcos detrás de piezas nuevas en pantalla:** `LANE_BACK` pasa ahora al este del pecio. Esperado: el test de oclusión de `LANE_BACK` (paso 4 u) sigue verde; el pecio queda detrás del barco.
- **Tabla histórica de #88:** el test del inventario no debe depender del `CYCLE_MS` vivo. Esperado: pasa con los literales de #87 y fallaría si alguien cambiara la tabla.
- **Comentarios con números viejos:** "30 u east of the return leg", "35 and 40 u from the lane", "south-southwest", "(420, 232)". Esperado: ninguno sobrevive en `sea-anim.ts` ni `sea.ts` (Task 2, `grep`).
- **Polígono del cabo no convexo:** la distancia "0 si adentro" usa `pointInPolygon`, no un test de convexidad. Esperado: el helper devuelve 0 para (380, 288) (dentro del cabo) — aserto de humo en el test nuevo.

---

## File Structure

- Modify: `src/scenes/sea-anim.ts` — literales `LANE_OUT`, `LANE_BACK` y sus comentarios (cabecera del archivo y de cada constante).
- Modify: `src/scenes/sea-anim.test.ts` — longitudes, `LANE_BACK[0]`, rumbo de `laneAt("back", 0)`, test nuevo de holguras.
- Modify: `scripts/barcos-inventario.test.ts` — estados de la tabla de #88 contra la geometría de #87.
- Modify: `docs/superpowers/specs/2026-10-17-barcos-inventario.md` — nota en "Capturas instantáneas".
- Modify: `src/scenes/sea.ts` — comentarios de `BUOYS`/`WRECK` y de `wreck()`.
- Modify: `CONTEXT.md` — entrada *Lanes*.

### Task 1: Carriles nuevos y sus tests

**Files:**
- Modify: `src/scenes/sea-anim.ts` (literales y comentarios de `LANE_OUT`/`LANE_BACK`, cabecera)
- Modify: `src/scenes/sea-anim.test.ts`
- Modify: `scripts/barcos-inventario.test.ts`
- Modify: `docs/superpowers/specs/2026-10-17-barcos-inventario.md`

**Interfaces:**
- Consumes: `PLATFORM_DECK` (`sign-platform.ts`), `pointInPolygon` (`geo.ts`), `polyline` (`iso/geometry.ts`).
- Produces: `LANE_OUT`, `LANE_BACK` con los vértices de Global Constraints. Sin cambios de firma.

- [ ] **Step 1: actualizar los asertos fijados a la geometría vieja** en `sea-anim.test.ts`: `Math.abs(L - 560.7) < 5` (out), `Math.abs(L - 543.9) < 5` (back), `LANE_BACK[0]` `toEqual({ x: 564, y: 467 })` e `inCoverQuad(564, 467)` false, `laneAt("back", 0).heading` ≈ `Math.atan2(330 - 467, 548 - 564)`. Los comentarios "slack to move vertices up to 2 u" pasan a "up to 4 u" (lo que permite el issue).
- [ ] **Step 2: test nuevo** en `describe("two lanes")`: `"the lanes leave ≥ 14 u to the Writing decks at both sites and ≥ 14 u to the moved headland polygon (#423)"`, con el comentario `// the sites and the headland of #423; sign-platform.ts and geo.ts adopt them in later children`. Literales `SITES = [{ x: 550, y: 125 }, { x: 440, y: 400 }]` y `MOVED_HEADLAND` (el polígono de Global Constraints). Helper `distToPolygon(p, poly)`: 0 si `pointInPolygon`, si no mínimo a los lados. Aserto de humo `distToPolygon({ x: 380, y: 288 }, MOVED_HEADLAND) === 0`. Para cada carril, muestreo a 1 u: distancia a cada cubierta trasladada y al cabo `≥ 14`. Asertos de altura: todos los puntos muestreados de `out` con `|y − 290| < 0.5` tienen x ≥ 440, con `|y − 400| < 0.5` x ≥ 481; de `back` con `|y − 125| < 0.5` x ≤ 500; y cada uno de esos filtros no vacío.
- [ ] **Step 3: correr** `npx vitest run src/scenes/sea-anim.test.ts`. Esperado: FAIL en los cuatro asertos de Step 1 y en el test nuevo (`LANE_OUT` viejo pasa a 0 u del cabo futuro).
- [ ] **Step 4: inventario de #88** en `scripts/barcos-inventario.test.ts`: literales `LANES_87 = { out: [8 vértices viejos], back: [8 vértices viejos] }` (los que hoy tiene `sea-anim.ts`: out (362,−16) (398,40) (424,86) (437,114) (440,142) (434,176) (420,232) (377,647); back (424,600) (462,237) (475,185) (482,144) (477,102) (461,66) (434,18) (397,−39)), con un comentario: la tabla registra los carriles de #87, cambiados en #425. `state87(ms)` y `alpha87(lane, dist)` reproducen `shipStateAt`/`alphaAt` con esas longitudes y las constantes vivas `LANE_SPEED`, `OFF_MS`, `PORT_MS`, `FADE_U`; `CYCLE_87` reemplaza a `CYCLE_MS` en ese test. Aserto de anclaje: `CYCLE_87` ≈ 1 172 343 ms (± 1), el valor que registra "Ciclo después" del doc. En el doc, bajo `### Capturas instantáneas`, una línea en cursiva: `*Nota (#425): los carriles cambiaron su tramo sur en #425. Esta tabla registra los de #87; su test la valida contra esa geometría, fijada como literales.*`
- [ ] **Step 5: implementar** los vértices de Global Constraints en `sea-anim.ts`. Comentarios en inglés:
  - Cabecera del archivo: los dos carriles van entre la bocana y el borde sur del cover; `LANE_OUT` bordea la punta por el este y baja al sur-sureste, al este del cabo mudado y del sitio angosto de Writing; `LANE_BACK` entra desde abajo, pasa al este del pecio y al oeste del sitio ancho y termina en la bocana. Por qué: la historia #423.
  - Comentario de `LANE_OUT`: tramo norte como hoy (la cara norte del arrecife fuerza x ≥ 424 en y ≈ 86); desde (434, 176) baja al este del cabo mudado (37 u de su punta) y del sitio angosto (16,3 u de su cubierta), x ≥ 440 en y 290 y x ≥ 481 en y 400; el fin (523, 510) deja el borde del cover (x + y ≈ 997) a `FADE_U` del final. Mantiene la frase de validación y la del pecio/boyas; "Do not move vertices more than 4 u without revalidating".
  - Comentario de `LANE_BACK`: el tramo norte sigue siendo el de salida 42 u al este (mismo argumento de los 42 u); el tramo sur ya no es una copia: pasa al este del pecio (17,6 u de la proa, delante en pantalla, el lado seguro para la oclusión) y al oeste del sitio ancho (27,9 u de su cubierta, x ≤ 500 en y 125); el inicio (564, 467) se ajusta igual al borde del cover.
- [ ] **Step 6: correr** `npx vitest run src/scenes/sea-anim.test.ts scripts/barcos-inventario.test.ts`. Esperado: PASS.
- [ ] **Step 7: commit** `feat(#425): tramo sur de los carriles al este del cabo mudado y del sitio angosto`.

### Task 2: Comentarios de `sea.ts`, `CONTEXT.md` y verificación completa

**Files:**
- Modify: `src/scenes/sea.ts:21-24` (comentario de `BUOYS`/`WRECK`), `:133-135` (doc de `wreck()`)
- Modify: `CONTEXT.md:54` (*Lanes*)

**Interfaces:**
- Consumes: los carriles de Task 1. Produce solo texto.

- [ ] **Step 1: `sea.ts`**, solo texto: las boyas quedan al oeste de la salida, a 40 y 46 u (los barcos pasan por delante); el pecio queda en la fosa con la vuelta pasando al este, a 17,6 u de la proa (delante en pantalla); en `wreck()`, "because the return leg passes 17.6 u east of its bow". Nada de código.
- [ ] **Step 2: `CONTEXT.md` *Lanes***: "between the river mouth and the southern edge of the cover"; `LANE_OUT` "skirts the point on the east and heads south-southeast, east of the moved headland's tip and of Writing's narrow site, until it leaves the cover"; `LANE_BACK` "enters from the bottom, passes east of the wreck and west of Writing's wide site, runs about 42 u east of the outbound lane on the northern stretch and ends at the mouth (397, −39)". Agregar "reshaped in #425 (story #423)" a la línea `Code:`.
- [ ] **Step 3: grep** `rg -n "420, 232|377, 647|south-southwest|30 u east of the return|35 and 40 u" src CONTEXT.md README.md`. Esperado: sin resultados.
- [ ] **Step 4: verificación** `npm test` y `npm run typecheck`. Esperado: verde.
- [ ] **Step 5: commit** `docs(#425): carriles respecto del pecio, las boyas y los sitios de Writing`.
