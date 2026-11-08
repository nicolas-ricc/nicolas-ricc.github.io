# Barrio de galpones y playa de carga (#325) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: `subagent-driven-development` (tarea por tarea). Los pasos usan casillas (`- [ ]`).

**Objetivo:** la fila 92 de Resume pasa al barrio `warehouses` con el mercado cubierto fijo en `(72, 92)`, los lotes de carga al barrio `freight`, las manzanas del este de la franja a `harbor` (zócalo sin receta), los neones con tope por barrio (bares 24, galpones 10) y las playas ferroviarias reciben el desvío con tren de carga estacionado, andén, camiones, contenedores y faroles, todo bajo la regla del tren.

**Arquitectura:** tres cambios de módulo puro. `src/city/zoning.ts` decide barrio, recetas fijas, lados abiertos y qué manzanas quedan sin receta; `src/scenes/city.ts` pone los zócalos según eso. `src/city/lights.ts` muestrea los neones por barrio. `src/city/rail-lands.ts` suma `freightYard(ground, solids, accents, rng)`, llamada por `city.ts` después de `railLands`.

**Stack:** TypeScript estricto (`noUnusedLocals`), Vitest. Sin dependencias nuevas.

**Spec:** el issue #325 (manda; sus "Decisiones" no se reabren) y la spec de la historia `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` §5.2 (contexto). Las recetas del kit ya existen (#322, `src/kit/forms/reconversion.ts`).

## Restricciones globales

- Código, comentarios y nombres de tests en inglés (`src/english.test.ts`); este documento en castellano.
- Colores solo de `src/map/palette-iso.ts` (`palette-guard.test.ts`); nada de literales hex.
- Sin `Math.random`: toda aleatoriedad del `Rng` recibido. `src/iso/` y `src/scenes/` no importan Pixi.
- Regla del tren (docstring de `src/scenes/station.ts`): todo sólido estático con `h > 0.4` y `y_min > 134.2` cumple `y_min − 1.4·z_max ≥ 134.5`; en `y 130.8..134.2` nada con `h > 0.4`.
- Presupuesto (`src/scenes/city-budget.test.ts`): Resume ≤ 2 900 sólidos elevados / 190 strips / 1 150 acentos; mundo ≤ 56 000 polígonos. No se suben los topes. Medido en la base: 1 226 / 148 / 766 / 42 848.
- Commits en inglés: `feat(#325): …` / `test(#325): …`, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm test` y `npm run typecheck` en verde al final de cada tarea.

## Decisiones técnicas (declaradas; el issue no las fija)

1. **Frente del mercado.** `openSides((72, 92))` devuelve `["e", "s"]`: `coveredMarket` toma `open[0]` como frente (guirnalda y filas de puestos), y el issue lo pone "frente a la calle de la estación". El resto de la fila 92 sigue en `["s"]`.
2. **Manzanas sin receta.** `isBare(b: Block): boolean` en `zoning.ts`: `neighborhoodOf(b) === "harbor"` y sin entrada en `FIXED`. `assign()` las salta; `city.ts` les pone el zócalo `paving` 24×18 que antes ponía el bucle de la receta. Reemplaza el bucle de zócalos de `freight` de `city.ts`, que ahora reciben zócalo por el camino normal.
3. **`openDock` sin zócalo.** El issue pide `z: PLINTH_H` en el lote de carga y a la vez `NO_PLINTH` con `openDock`. Manda la regla general de `assign()` (`z = NO_PLINTH.includes(recipe) ? 0 : PLINTH_H`, que `zoning.test` ya verifica): un `openDock` va a `z 0` sin zócalo, un `freightShed` a `z PLINTH_H` sobre el suyo 24×13. El resto del lote (`x/y + SIDEWALK`, `w 21`, `d 10`, `open ["s"]`, `maxH 18`) sale de la fórmula general sin caso especial.
4. **Andén cortado en los cruces.** El poste sur de cada paso a nivel (`(c.x1 + 0.3, 137.8)`, 0.3×0.3×2, de #320) cae dentro del andén `y 136.3..138`. El andén se parte en tramos y salta cada cruce de `c.x0` a `c.x1 + 0.6`: tramos `[−50, −24]`, `[−17.4, 6]`, `[12.6, 36]`, `[42.6, 66]` (el cruce `66..72` corta el último en 66).
5. **Cerco sur abierto en el cambio de vía.** Los ejes de los rieles del cambio (offset ±1.5 perpendicular a `(82, 132.5) → (70, 141)`, normal `(−0.578, −0.816)`) cruzan la franja del cerco `y 136..136.3` en `x ≈ 74.5..74.0` y `79.7..79.2`. El cerco sur pierde el tramo `x 72..81`: sus tramos pasan a `[−54, −24], [−18, 6], [12, 36], [42, 66], [81, 96]`. El norte no cambia.
6. **Tren de carga:** la locomotora va en el extremo oeste, `x0..x0 + 9`, y los cinco vagones al este con 1 de separación (largo total 54, termina en `x0 + 54 ≤ 34`). `x0 = rng.int(−46, −20)`. Todos con base en `z 0` (los durmientes, de 0.3, quedan debajo como en la vía principal); vagones alternados `rust`, `steel`, `rust`, … empezando por `rust`.
7. **Solape AABB:** "ningún par se solapa" se mide entre sólidos de `h > 0.4` (los durmientes y tablones son piso, como en la vía principal), con intersección estricta de cajas 3D (tocarse no es solaparse).
8. **Huecos fijos para el rng.** Camiones: lugares `x = −40 + 10k`, `k = 0..9` (caja 6 + cabina 2 al este, todo dentro de `x −40..60`), se eligen 3 distintos con el rng. Contenedores: lugares `x = −50 + 7k`, `k = 0..19`, en cada una de las filas `y 150` y `153.5`, descartando en la fila 150 los que tocan un farol (`[lx, lx + 0.6]`); `n = rng.int(6, 8)` lugares distintos con el rng, cada uno `stackContainers(v3(x, y, 0), 1, "x", rng)`. Pallets: lugares `x = −48 + 6k` cuyo `[x, x + 1.2]` cae entero en un tramo del andén, cada uno con `rng.chance(0.5)`, en `y 137`, `z 1`.
9. **Rng de la playa:** el mismo `rng` de `city()`, en la llamada `freightYard(ground, solids, accents, rng)` inmediatamente después de `railLands(ground, solids)`.
10. **Exhibits:** `galpones` y `playa-carga` toman el `h` que pida `exhibits.test` ("framing" y "neighbors"); se anota el valor medido en el comentario de `exhibits.ts`, como hoy.

## Supuestos (del grilling)

- **Atribución de commits:** el issue pide `Co-Authored-By: Claude Fable 5.1`; el agente que implementa es otro modelo y usa la línea que le indica su entorno (`Claude Opus 5.5`), para no atribuir falsamente. Alternativa descartada: copiar la del issue.
- **Calles N-S al sur de la vía:** siguen pintadas de `y 137` a `206` (`streets.ts` `lanes`). El issue fija el tren en `x0 ∈ −46..−20` (siempre tapa el cruce `−24..−18`) y los rangos de camiones y contenedores sin excluir calles, así que los lugares del rng no excluyen las columnas de las calles. El andén se corta en los cruces solo por el choque con los postes (decisión 4).
- **Unión del cambio con el desvío:** los rieles diagonales terminan en `(70 ± 0.87, 141 ± 1.22)` y los del desvío en `x 70`, `y 139.5/142.5`: la misma simplificación sin corazón que `ladder()` en `station.ts` (el issue: "como `LADDER`"). `132.5` es el eje de la vía principal (`RAIL_Y = [131, 134]`, `TRACKS_Y[2]`).
- **Materiales nuevos de `city.test`:** los que usan `STYLES.warehouses/freight` y los literales de `reconversion.ts`, `industrial.ts` (`box*` de `stackContainers`) y `props.ts`; el test fija la lista explícita.
- **Brecha del cerco en `railLands`:** `city.ts` es el único que llama a `railLands` y siempre llama después a `freightYard`.
- **Neones de galpones:** solo `brewery` publica slots (dos, `shop` 0 y 1); con cuatro manzanas sorteadas el máximo real es 8, el tope 10 del issue no muerde con la grilla actual (lo prueba el sintético).

## Foco de revisión

1. **El mercado tapa o cruza la estación:** `(72, 92)` abre al este, contra la calle `x 96..102` que es tierra de la estación. Esperado: todo el mercado dentro de `x 73.5..94.5`. Test: tarea 1, "the covered market stands on (72, 92) …" verifica que todos sus sólidos caen en el lote.
2. **Un neón de galpones tapado por los galpones de carga de enfrente** (`lights.ts` ocluye por silueta): esperado, ningún neón publicado está oculto. Test: el oráculo existente de `lights.test` ("no neon is hidden by a solid") ya recorre todos los neones; la tarea 2 no lo restringe a bares.
3. **La playa choca con lo que #320 ya puso** (postes y cercos de los cruces): esperado, ningún solape. Test: tarea 3, el test de solape AABB corre sobre `railLands` + `freightYard` juntos.
4. **Un sólido de la playa tapa al tren EMU en algún punto del recorrido:** esperado, ninguno. Test: tarea 3, regla por sólido en `rail-lands.test` y `train-occlusion.test` sobre `world(7)`.
5. **Otra semilla cambia la cantidad de cosas aleatorias:** esperado, los rangos se respetan con cualquier rng. Test: tarea 3, los conteos (3 camiones, 6..8 contenedores, posición del tren) se verifican con `createRng(1)`, `createRng(2)` y `createRng(3)`.

---

### Tarea 1: zonificación de la franja y mercado cubierto

**Archivos:** Modificar `src/city/zoning.ts`, `src/scenes/city.ts`, `src/city/zoning.test.ts`, `src/scenes/city.test.ts`, `src/scenes/seam-90.test.ts` (si su barrido de la franja falla), `src/lab/exhibits.ts` (`h` de `galpones` si lo pide el test).

**Interfaces:**
- Consume: `ROWS`, `ESTUARY_Y0` (`src/map/geo.ts`), `blocks()`, `Block`.
- Produce: `isBare(b: Block): boolean` exportada de `zoning.ts`; `neighborhoodOf` con `freight`, `warehouses`, `harbor`; `FIXED` con `{ x: 72, y: 92, recipe: "coveredMarket" }`; `NO_PLINTH` con `"openDock"`.

- [ ] **Paso 1: tests que fallan** en `zoning.test.ts` (reemplazando las expectativas provisorias de #320 sobre fila 92 `residential`, `(280, 116)`/`(280, 140)` `riverside` y "assign never places a freight lot"; el helper `cells` deja de excluir `freight`):
  - `cells("warehouses")` = `[-48,92], [-18,92], [12,92], [42,92], [72,92]`; `cells("freight")` = las cinco celdas `(x, 116)` de `kind "freight"`; `cells("harbor")` = `["280,116", "280,140"]`; `residential` pierde las cinco de la fila 92; `riverside` = las del este con `y ≥ 164`.
  - `FIXED` tiene `coveredMarket` en `["72,92"]`.
  - `openSides(blockAt(72, 92))` = `["e", "s"]`; `openSides(blockAt(12, 92))` = `["s"]`; `openSides` del lote `(12, 116)` = `["s"]`.
  - "with the world seed the five blocks of row 92 use ≥ 3 distinct recipes": `new Set(worldAssign().filter((p) => p.block.y === 92).map((p) => p.recipe)).size >= 3`.
  - "freight lots get freightShed or openDock": con `worldAssign()` y `sceneAssign()`, los cinco `kind "freight"` aparecen y su receta ∈ `{freightShed, openDock}`, lote `w 21`, `d 10`, `open ["s"]`.
  - "harbor without a fixed recipe is bare": `isBare(blockAt(280, 116))` y `(280, 140)` `true`; ninguna `Placed` de `assign()` tiene `neighborhood "harbor"`; `isBare` es `false` para todo bloque no `harbor`.
  - `NO_PLINTH` contiene `"openDock"`. El test "assign is deterministic …" filtra con `b.kind !== "plaza" && b.kind !== "collapsed" && !isBare(b)`.
- [ ] **Paso 2: tests que fallan** en `city.test.ts`:
  - "the covered market stands on (72, 92)": en `scene()`, `placed` tiene `recipe "coveredMarket"` en el bloque `(72, 92)`; entre sus sólidos hay ≥ 4 `prism` `steel` con `w 0.4`, `d 0.4`; hay ≥ 6 puestos (`prism` `h 1.8`); todos sus sólidos caen en el lote `x 73.5..94.5, y 93.5..108.5` agrandado 0.8 (los toldos cuelgan 0.8 hacia afuera: contrato del kit, `reconversion.ts` `coveredMarket`).
  - el test "freight lots (#320) …" pasa a: cada lote tiene una `Placed` con `freightShed`/`openDock`; zócalo `paving` 24×13 en `z 0` en los lotes con `freightShed` y ninguno en los de `openDock`.
  - zócalo 24×18 en `(280, 116)` y `(280, 140)` y ningún otro sólido elevado dentro de esas dos manzanas salvo autos (`CAR`).
  - `CITY_MATS` suma los materiales del kit de reconversión que aparezcan (`brick`, `sheetGreen`, `sheetTeal`, `concrete`, `whitewash`, `glass`, `box*`, …: los que el test reporte); la regla "steel/rust solo en prism, cylinder, vault" suma `beam` (vigas del `derelictHall`).
- [ ] **Paso 3:** `npx vitest run src/city/zoning.test.ts src/scenes/city.test.ts` → FALLA.
- [ ] **Paso 4: implementar.** En `neighborhoodOf`, antes de lo existente: `b.kind === "freight" → "freight"`, `b.y === ROWS[0] → "warehouses"`, `b.bank === "east" && b.y < ESTUARY_Y0 → "harbor"` (antes de `riverside`). `FIXED` suma `{ x: 72, y: 92, recipe: "coveredMarket" }`. `openSides`: para `warehouses`, `"e"` primero si es `(72, 92)` y después `"s"`; para `freight`, `["s"]` (el caso viejo de fila 92 y el de `(280, 116)` `"n"` se conservan donde siguen aplicando). `assign()` deja de saltar `freight` y salta `isBare(b)`. `NO_PLINTH` suma `"openDock"`. En `city.ts`, el bucle de zócalos `freight` pasa a `isBare`.
- [ ] **Paso 5:** `npx vitest run src/city src/scenes src/lab` → PASA; si `exhibits.test` pide otro `h` para `galpones`, poner el entero mínimo que pase y anotarlo en el comentario. Si `seam-90.test` ("the new strip …") falla, ajustar solo su filtro para admitir los sólidos dentro de los lotes de la fila 92 y de carga (ya lo hace `inBlock`).
- [ ] **Paso 6:** `npm test` y `npm run typecheck` → verde. Commit `feat(#325): warehouses, freight and harbor zoning with the covered market at (72, 92)`.

### Tarea 2: neones con tope por barrio

**Archivos:** Modificar `src/city/lights.ts`, `src/city/lights.test.ts`.

**Interfaces:**
- Consume: `Neighborhood`, `CATALOGUE` de `zoning.ts`; la tarea 1 (la fila 92 es `warehouses`).
- Produce: `export const NEON_CAPS: Partial<Record<Neighborhood, number>> = { bars: 24, warehouses: 10 }` en `lights.ts`; se borra `MAX_NEONS`.

- [ ] **Paso 1: tests que fallan** en `lights.test.ts` (importar `NEON_CAPS` en lugar de `MAX_NEONS`):
  - el test por semilla de neones: cada neón es de un barrio con tope (`Object.keys(NEON_CAPS)`), por barrio `≤ NEON_CAPS[b]`, en un lado `open`, uno por local, `z 2.4..3.6` sobre el lote (el resto de las aserciones igual).
  - "world seed: at least one warehouses neon": con la semilla del mundo, `l.neons.filter((n) => s.placed[n.owner]!.placed.neighborhood === "warehouses").length >= 1`. Si la semilla del mundo no sortea una cervecería visible, este test usa una escena con semilla fija que sí la sortea y el nombre del test lo dice.
  - el `flicker`: el neón elegido es de un barrio con tope.
  - sintético "neons: caps per neighborhood": una pieza `bars` con 30 slots abiertos y una `warehouses` con 15 → `24` de bares y `10` de galpones, uno por local en cada barrio.
  - sintético: una pieza `downtown` con slots abiertos no da neones.
- [ ] **Paso 2:** `npx vitest run src/city/lights.test.ts` → FALLA.
- [ ] **Paso 3: implementar** en `lights()`: los slots se toman de las piezas cuyo barrio está en `NEON_CAPS` (mismos filtros de lado abierto, altura, oclusión y local); después, por barrio en el orden de las claves de `NEON_CAPS`, si sobran se muestrean `NEON_CAPS[b]` con `sample` (solo se llama al rng cuando sobran, como hoy). Los neones conservan el orden de `slots`; colores, charco y `flicker` como hoy, el `flicker` entre todos.
- [ ] **Paso 4:** `npx vitest run src/city src/scenes` → PASA. `npm test`, `npm run typecheck` → verde. Commit `feat(#325): neon caps per neighborhood (bars 24, warehouses 10)`.

### Tarea 3: playa de carga (desvío, tren de carga, andén, camiones, contenedores, faroles)

**Archivos:** Modificar `src/city/rail-lands.ts`, `src/city/rail-lands.test.ts`, `src/scenes/city.ts`, `src/scenes/seam-90.test.ts`, `src/lab/exhibits.ts` (`h` de `playa-carga`).

**Interfaces:**
- Consume: `railLands`, `CROSSINGS`, `RAIL_Y`; `lamp(at)` de `src/kit/props.ts` (`{ solids, accents, bulb }`); `stackContainers(at, n, along, rng)` y `CONTAINER` de `src/kit/forms/industrial.ts`; `Rng`.
- Produce: `export const SIDING_Y = 141`; `export const SWITCH = [{ x: 82, y: 132.5 }, { x: 70, y: 141 }] as const`; `export function freightYard(ground: Solid[], solids: Solid[], accents: Accent[], rng: Rng): void`.

- [ ] **Paso 1: tests que fallan** en `rail-lands.test.ts`, `describe("freight yard (#325)")`, con `railLands` + `freightYard(ground, solids, accents, createRng(1))`:
  - desvío: dos `strip` `rail` de ancho 0.5 en `y 139.5` y `142.5` de `x −50` a `70`; cambio: dos `strip` `rail` diagonales paralelos a `SWITCH[0] → SWITCH[1]` a ±1.5 perpendicular.
  - durmientes del desvío: `prism` `rust` 1×5×0.3 en `(x, 138.5)` con `x = −50 + 4k`, `k = 0..29`.
  - tope: `prism` `steel` `at (−51.5, 139.5, 0)`, `w 1.5`, `d 3`, `h 1.2`.
  - tren: una locomotora `prism` `steel` 9×2.4×3.4 y 5 vagones 8×2.4×3 alternando `rust`/`steel` desde `rust`, todos en `y 139.8`, `z 0`, separados 1 en x, locomotora al oeste, `x0 ∈ [−46, −20]` entero.
  - andén: cuatro `prism` `concrete` `h 1` en `y 136.3..138`, tramos `[−50, −24]`, `[−17.4, 6]`, `[12.6, 36]`, `[42.6, 66]`; pallets `deck` 1.2×1×0.5 en `y 137`, `z 1`, cada uno dentro de un tramo.
  - camiones: exactamente 3 cajas 6×2.4×2.8 en `y 146` con su cabina `steel` 2×2.4×2.2 pegada al este, todo en `x −40..60`.
  - contenedores: 6..8 sólidos de 6×2.4×2.6 en `y 150` o `153.5`, todos en `x −50..90`.
  - faroles: 4 postes `steel` 0.6×0.6×5 en `(x, 150)`, `x ∈ {−40, 0, 40, 80}`, y 4 acentos `dot` `amber` `r 0.6` en `accents`.
  - el cambio pasa por la brecha: los dos `strip` diagonales cruzan `y 136..136.3` dentro de `x 72..81` (calculado sobre los puntos del path).
  - cerco sur: tramos `[−54, −24], [−18, 6], [12, 36], [42, 66], [81, 96]` (el test de #320 de cercos se ajusta para el sur; el norte no cambia).
  - caja: todo sólido de `freightYard` en `x −54..94`, `y 136..157.5`; ninguno con `h > 0.4` en `y 134.2..136`.
  - regla del tren sobre todos los sólidos de `railLands` + `freightYard` (el test existente se amplía a ese conjunto).
  - solape: ningún par de sólidos con `h > 0.4` de `railLands` + `freightYard` se interseca estrictamente en 3D (tolerancia 1e-9).
  - semillas: con `createRng(1..3)` se mantienen 3 camiones, 6..8 contenedores y `x0 ∈ [−46, −20]`; dos semillas distintas dan JSON distinto; la misma semilla, igual.
- [ ] **Paso 2:** `npx vitest run src/city/rail-lands.test.ts` → FALLA.
- [ ] **Paso 3: implementar** `freightYard` en `rail-lands.ts` con los valores del issue y las decisiones 4–8 (rieles y diagonales a `ground`, como `railLands`; el cambio con el patrón de `ladder()` de `station.ts`); la brecha del cerco sur va en `railLands` (constante `SWITCH_GAP = { x0: 72, x1: 81 }`, solo cerco sur). En `city.ts`, `freightYard(ground, solids, accents, rng)` justo después de `railLands(ground, solids)`.
- [ ] **Paso 4:** `seam-90.test` "the new strip …": admitir los sólidos de la playa (`b.min.y >= 136 && b.max.y <= 157.5 && b.max.x <= 94`, `b.max.z <= 5`) además de lo que ya admite. `exhibits.test`: poner el `h` mínimo entero que pase para `playa-carga` (el farol llega a 5 + bulbo) y anotarlo en el comentario.
- [ ] **Paso 5:** `npx vitest run src/city src/scenes src/lab` → PASA, incluidos `train-occlusion.test` y `city-budget.test`. `npm test`, `npm run typecheck` → verde. Commit `feat(#325): freight yard with siding, parked freight train, dock, trucks, containers and lamps`.

## Grilling

- Rondas: 1 (los cambios fueron correcciones puntuales: frase de la decisión 4, cifras de la decisión 5, margen 0.8 del mercado, test de la brecha del cambio; ningún paso agregado ni quitado).
- Preguntas: 18. Fuentes: ISSUE 7, CODE 15, DOC 2 (varias respuestas citan más de una); NO SOURCE 4, todas supuestos técnicos.
- Supuestos: los de la sección "Supuestos (del grilling)".
- Issues abiertos: ninguno (nada quedó fuera de alcance; ninguna ambigüedad de producto).
