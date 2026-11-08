# Feria: tren fantasma, casa de espejos, tobogán, tronco acuático animado, hilera de puestos y food trucks (#327) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** sumar a la feria de la playa cuatro atracciones (tren fantasma, casa de espejos, tobogán helicoidal y tronco acuático con la capa animada `fair.logs`), reemplazar los ocho puestos iguales por una hilera de 12..16 puestos variados por catálogo y agregar un patio de food trucks en la entrada, sin que ninguna huella nueva pise otra ni quede nada estático delante de la rueda.

**Arquitectura:** todo vive en `src/scenes/fair.ts` (constantes exportadas, un constructor puro por pieza, exportado para los tests) y en `src/scenes/fair-anim.ts` / `fair-animator.ts` (neones nuevos y la capa `fair.logs`). `fair(rng, opts)` gana `{ legacyOnly?: boolean }` para construir la feria vieja sin las piezas nuevas. El storybook suma cuatro regiones en `src/lab/exhibits.ts`.

**Stack:** TypeScript estricto (`noUnusedLocals`), Vitest, Vite. Sin dependencias nuevas.

**Spec:** el issue #327 (manda sobre la spec de la historia, `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` §8).

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Los ids de exhibits nuevos (`tren-fantasma`, `casa-espejos`, `tobogan`, `tronco-acuatico`) van a `EXHIBIT_IDS` de `english.test.ts` y a `CATALOG` de `exhibits.test.ts`. Este documento, en castellano.
- `src/scenes/` no importa Pixi; ningún literal hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts`; `Math.random` prohibido: toda aleatoriedad sale del `Rng` recibido.
- Presupuestos: sólidos elevados de la feria ≤ 700 (objetivo ≈ 520), acentos estáticos de la feria ≤ **200** (sube de 120), `city-budget.test` ≤ 56 000 polígonos (hoy 43 209 con `world(7)`). No se sube ningún otro tope.
- Todo sólido de la feria cumple `worldZoneAt(min.x, min.y) === "portfolio"`, `min.x ≥ FAIR.x0 − 0.5`, `min.y ≥ FAIR.y0`, `max.y ≤ FAIR.y1 + 0.5` y su `mat` está en `FAIR_MATS`.
- Commits `test(#327): …` / `feat(#327): …`, con `Co-Authored-By`.

## Decisiones técnicas declaradas (el issue no las fija o se contradice)

1. **Constructores exportados.** `ghostTrain(out, accents)`, `mirrorHouse(out, accents)`, `slide(out, accents)`, `flume(out, accents)`, `boothRow(out, accents, rng)` y `foodCourt(out, accents)` se exportan desde `fair.ts`: el test de huellas construye cada pieza por separado y la compara contra `fair(rng, { legacyOnly: true })`. `legacyOnly` saltea esas seis funciones (y no hay puestos viejos: `booths()` se borra).
2. **Orden y rng.** Las piezas sin rng (`ghostTrain`, `mirrorHouse`, `slide`, `flume`, `foodCourt`) van antes de `beach()`, para que las sombrillas y los botes las vean ocupadas. `boothRow` (con rng) va **después** de `beach()`: así la secuencia del rng de la playa no cambia y el test de los botes 2 y 4 de la semilla 7 sigue fijo. Los puestos (a `bayShoreX − 22..−16`) nunca tocan sombrillas (a `−7..−3`) ni botes (a `−9..−6`); el test de botes "clear of every other solid" lo vigila.
3. **Perfil del tronco acuático.** El issue pide a la vez "canal a z 2.5 hasta la orilla" y "llano a z 6 hasta la caída, que baja de z 6 a 0.2": un canal a z 2.5 no sostiene un llano a z 6. Se resuelve por el recorrido de los troncos, que el issue fija: banda `y −296..−293` (`FLUME.y`, `FLUME.w`), eje `y −294.5`.
   - Subida: `ramp deck` en `(160, −296, 2.5)`, `w 12, d 3, h 3.5, dir "w"` (sube de z 2.5 a 6 entre x 160 y 172), con la cadena: `beam rust` `w 0.3 h 0.3` de `(160, −294.5, 2.5)` a `(172, −294.5, 6)` apoyada encima. Es el "canal elevado a z 2.5": arranca ahí.
   - Llano: `prism deck` en `(172, −296, 5.4)`, `w FLUME_DROP_X0 − 172, d 3, h 0.6` (tapa a z 6), con el agua `strip shallow` de ancho 2 a `z 6.02` sobre el eje, de x 172 a `FLUME_DROP_X0`.
   - Caída: `ramp deck` en `(FLUME_DROP_X0, −296, 0.2)`, `w 6, d 3, h 5.8, dir "e"` (de z 6 a 0.2).
   - Fin: `FLUME_X1 = min(bayShoreX(y), y ∈ −296..−293 cada 0.5) − 1` (con la orilla de hoy, 219: la orilla a y −293 está en 220, así que `bayShoreX(FLUME.y) − 2 = 221` caería sobre el agua). `FLUME_DROP_X0 = FLUME_X1 − 6`.
   - Pilares `steel 0.4×0.4` cada 6 desde x 160 hasta `< FLUME_DROP_X0`, del suelo a la panza del tramo (z 2.5 bajo la subida interpolado, z 5.4 bajo el llano), centrados en el eje; se saltea el que toque en planta un sólido de la pasarela.
   - Salpicadura: 6 `dot windowCool r 0.3` sobre el agua en `x FLUME_X1 + 1.5 .. + 4`, `y −296..−293`, `z 0.3..1`.
4. **Troncos.** `FLUME_PATH = [(160, −294.5, 2.5), (172, −294.5, 6), (FLUME_DROP_X0, −294.5, 6), (FLUME_X1, −294.5, 0.2)]`, polilínea abierta: "de vuelta al inicio" es un salto (el tronco cae a la bahía y reaparece en la estación); la distancia se envuelve `mod` el largo. Velocidad según el tramo al empezar el tick (como el tren): tramo 0 `LOG_LIFT_SPEED = 2`, tramo 1 `LOG_SPEED = 4`, tramo 2 `LOG_DROP_SPEED = 12`. `logSolids(dist)` = dos `hull` `len 2.4, beam 1, h 0.6, mat "deck"`, `heading` del tramo, `at` en el punto de `dist` y de `dist − 8` (envueltos), z del recorrido.
5. **Puesto bajo el canal.** El slot `y −294` de la hilera cae debajo del canal (`y −296..−293`, z 2.5..6): se saltea todo slot cuya caja `x..x+4, y−1..y+5` toque en planta la banda del canal (`x 160..FLUME_X1`, `y −296..−293`). Quedan 14 slots (`y −288 .. −210`), dentro de 12..16.
6. **Sombrillas.** `beach()` descarta (con `continue`, sin pedir más rng) la sombrilla cuyo cuadrado `±1.6` toque la caja del canal. Los botes ya esquivan todo `out`.
7. **Cruce de la pasarela.** "x 205..217" del issue es la pasarela supuesta; la real a esa latitud se mide. El test exige: todo sólido del canal que toque en planta un sólido de la pasarela (`prism deck d 18 h 0.6`, sus barandas, faroles y bancos) tiene `min.z ≥ 2.4` y `min.z ≥` el `max.z` de ese sólido.
8. **Tren fantasma.** Cuerpo `prism stone` en `GHOST` 20×12×6 con `facade { floors: 1, cols: 5, base: "portico" }`. La torre gótica `prism stone 4×4×8` va **sobre el techo** en la esquina SE (`(114, −250, 6)`, tapa a z 14), con el `cone stone sides 4 r 3 h 4` a z 14: dos cajas encajadas una en otra rompen el orden por AABB. La calavera es un acento `poly windowCool alpha 0.9`, octógono r 1.2 centrado en `(116, z 7)` sobre el plano `y −246.02` (la cara sur de la torre). Marquesina `prism copper` `(98, −246, 6)` 20×1.5×0.4. Dos vanos (entrada en x 102, salida en x 112): cada uno, dos hojas `rotBox(…, 1.2, 0.2, ±0.5 rad, 0, 2, "rust")` delante de la cara (centro `y −245.6`), y un `strip rail` de ancho 0.5 de 3 de largo hacia el sur desde `y −246`. Neón `ghost`: 8 puntos en `x 98.5 + k·19/7`, `y −244.52`, `z 6.6`.
9. **Casa de espejos.** Cuerpo `prism whitewash` en `MIRRORS` 16×12×6 con `facade { floors: 1, cols: 4, base: "arcade" }`. Frontón `prism whitewash (124, −247, 6) 16×1×1.5` con `plates`: tres `rect` `glass toneOffset 2` en su pared sur (`wall 2`), `u 0.1..0.3, 0.4..0.6, 0.7..0.9`, `z 6.2..7.3`. Neón `mirror`: 6 puntos en `x 125.5 + k·13/5`, `y −245.98`, `z 7.8`. Guirnalda `garland([(124, −245.9, 7.5), (132, −245.9, 6.9), (140, −245.9, 7.5)])`.
10. **Neones.** `ghost`: `run(pts, 4, (k) => flip(k, "magenta", "magentaMid"))`; `mirror`: `run(pts, 2, () => "cyan")`. Frame 0 y `reducedMotion`: paso 0.
11. **Tobogán.** Torre `prism deck (116, −294, 0) 4×4×14`, techo `cone copper (118, −292, 14) r 3 h 2`, escalera `prism steel (115.4, −293, 0) 0.6×2×14` y 7 travesaños `beam steel w 0.1 h 0.1` de `(115.3, −293, z)` a `(115.3, −291, z)`, `z = 2, 4, …, 14`. Hélice: tramo `k = 0..23`, ángulo `a = 6π·(k + 0.5)/24`, centro `(118 + 5 cos a, −292 + 5 sin a)`, `z = 13 − 12.5·k/23`, `rotBox(cx, cy, 2.2, 1.2, a + π/2, z, 0.3, "deck")`; baranda por tramo `beam steel w 0.1 h 0.1` en el borde exterior (radio 5.6), de un extremo al otro del tramo, a `z + 0.8`. `dot amber r 0.5` en `(118, −292, 16.3)`. Los tramos son polígonos de `2.2` en un arco de ≈ 3.9: quedan escalones, como pide el issue.
12. **Hilera de puestos.** `BOOTH_TYPES` en el orden del catálogo del issue, con pesos `food 30, foodTruck 20, shooting 15, cottonCandy 10, fortune 10, tickets 10, rings 5`. `boothTypes(rng, n)`: por puesto, sorteo ponderado (`rng.next()` contra la suma acumulada); si repite al anterior, re-sortea hasta 5 veces; si sigue igual, toma el siguiente del catálogo (circular). Tono por puesto, después del tipo: `food` y `tickets` `rng.pick(["whitewash", "rust", "copper"])`, `foodTruck` `rng.pick(["signal", "copper", "whitewash", "rust", "livery"])`; el toldo rayado de `food` alterna `signal`/`whitewash` empezando por `rng.chance(0.5)`. Huella dentro del slot `x..x+4` (`x = bayShoreX(y + 1.5) − 22`) y `y−1..y+5`: `foodTruck(v3(x + 1, y − 1, 0), mat, "e")` (2.2×5); redondos centrados en `(x + 2, y + 1.5)`; `tickets` en `(x + 1, y + 0.5)` 2×2. Cada puesto lleva el cartel `amber` en el plano `y_sur + 0.02` (`y_sur` = borde sur de su caja), `x` centro ±1.2, `z 1.2..2`, y el `dot` r 0.4 en `(centro x, y_sur + 0.2, 2.9)`, `magenta` si el índice `% 3 === 2`, si no `cyan`.
13. **Patio de food trucks.** Los postes `(100, −176.5)`, `(130, −170.5)`, `(160, −176.5)` del issue son centros y salen 0.65 de `FOOD_COURT`: "todo dentro" se prueba con 0.7 de margen. Mesas `table` en `(103 + 7.5k, −172.5)`, `k 0..7`; sillas `chair` en `(x − 0.7, −172.25)` y `(x + 1.2, −172.25)`. Guirnalda a z 3 sobre los tres postes (`garland` con paso 1.5).
14. **Materiales.** `FAIR_MATS` suma `shallow`, `signal`, `livery`, `safety` y `awning` (el toldo del `foodTruck` del kit). El helper `prism` de `fair.ts` acepta `facade?: Facade` y `plates?: Plate[]`.

## Review Focus

1. **Otra semilla:** la hilera y la playa con `fair(createRng(8))` y la semilla del sitio también cumplen vecinos sin repetir, 12..16 puestos y sombrillas fuera del canal. Tests en las tareas 4 y 6 (semillas 7, 8 y `zoneRng(SEED, "portfolio", 3)`).
2. **Envoltura de los troncos:** `logSolids(d)` para `d` negativo o mayor que el largo devuelve dos troncos sobre el recorrido; con `tick` largos (5000 ms) la distancia sigue en `[0, L)`. Test en la tarea 5.
3. **Ningún tronco atraviesa una pieza estática ajena:** en 60 ticks de 500 ms, la caja de cada tronco no toca en planta ningún sólido de la feria salvo los del canal y la pasarela (que cruza por arriba) — incluido el segundo tronco al saltar. Test en la tarea 5.
4. **Nada delante de la rueda** con todo lo nuevo (el test existente) y **nada sobre el agua** salvo el muelle y la caída: tests existentes, tarea 7.
5. **Exhibits recortados:** las cuatro regiones nuevas pasan "framing" y "neighbors" con su `h` medido; la de `tronco-acuatico` recorta el animador de la feria. Tarea 8.

---

### Tarea 1: tren fantasma y su neón

**Archivos:** modificar `src/scenes/fair.ts`, `src/scenes/fair-anim.ts`; tests en `fair.test.ts`, `fair-anim.test.ts`.

**Interfaces:**
- Produce: `GHOST = { x: 98, y: -258, w: 20, d: 12 } as const`; `ghostTrain(out: Solid[], accents: Accent[]): void`; `FairScene.neon.ghost: Vec3[]` (8); `fair(rng: Rng, opts?: { legacyOnly?: boolean }): FairScene`.

- [ ] **Paso 1: tests (etapa 3).** `"ghost train: stone 20×12 facade with a 4-sided cone tower, copper marquee, doors and track"`: en `fair(createRng(7))` hay un `prism stone` en `GHOST` con `w 20, d 12, h 6` y `facade.base === "portico"`, un `cone stone sides 4 r 3`, un `prism copper w 20`, ≥ 4 `poly rust`, ≥ 2 `strip rail`, y un acento `poly windowCool` de 8 puntos con todos `y === −246.02`. En `fair-anim.test.ts`, `"ghost neon: 8 points, four lit at frame 0, magenta/magentaMid, runs with the clock"`. En `fair.test.ts` el tope de acentos pasa a `≤ 200`.
- [ ] **Paso 2:** `npx vitest run src/scenes/fair.test.ts src/scenes/fair-anim.test.ts` → FALLA.
- [ ] **Paso 3:** implementar según la decisión 8 y la 10; `fair()` gana `opts` y llama `ghostTrain` salvo `legacyOnly`.
- [ ] **Paso 4:** pasa. Commit `feat(#327): ghost train`.

### Tarea 2: casa de espejos y su neón

**Archivos:** `fair.ts`, `fair-anim.ts`; tests en `fair.test.ts`, `fair-anim.test.ts`.

**Interfaces:** produce `MIRRORS = { x: 124, y: -258, w: 16, d: 12 } as const`; `mirrorHouse(out, accents): void`; `FairScene.neon.mirror: Vec3[]` (6).

- [ ] **Paso 1: tests.** `"mirror house: whitewash 16×12 with arcade facade, pediment with three glass mirrors and a garland"`: `prism whitewash` en `MIRRORS` `w 16 d 12` con `facade.base === "arcade"`; el frontón `w 16 d 1 h 1.5` con 3 `plates` `glass`; ≥ 8 `dot amber` con `y === −245.9`. `"mirror neon: 6 cyan points, chase of 2"` (frame 0: índices 0 y 1; tras `NEON_STEP_MS`: 1 y 2).
- [ ] **Paso 2:** FALLA. **Paso 3:** decisiones 9 y 10. **Paso 4:** pasa. Commit `feat(#327): mirror house`.

### Tarea 3: tobogán gigante

**Archivos:** `fair.ts`; tests en `fair.test.ts`.

**Interfaces:** produce `SLIDE = { x: 118, y: -292, r: 5, h: 14 } as const`; `slide(out, accents): void`.

- [ ] **Paso 1: test.** `"giant slide: deck tower h 14, ≥ 24 deck ramp segments descending from z 13 to 0.5 around it"`: `prism deck w 4 d 4 h 14`; los `poly deck` con centro a distancia `5 ± 0.01` de `(118, −292)` son ≥ 24, sus `z` decrecen estrictamente, el primero `13`, el último `0.5`; ≥ 24 `beam steel`; un `dot amber` a `z > 16`.
- [ ] **Paso 2:** FALLA. **Paso 3:** decisión 11. **Paso 4:** pasa. Commit `feat(#327): giant slide`.

### Tarea 4: tronco acuático (estático)

**Archivos:** `fair.ts` (`flume`, `beach`); tests en `fair.test.ts`.

**Interfaces:** produce `FLUME = { x0: 160, y: -296, w: 3 } as const`; `FLUME_X1: number`, `FLUME_DROP_X0: number`; `FLUME_PATH: readonly Vec3[]`; `flumeLength(): number`; `flumeAt(dist: number): PolyPoint`; `logSolids(dist: number): Solid[]`; `flume(out, accents): void`.

- [ ] **Paso 1: tests.** `"log flume: raised deck channel with water, lift, drop to the bay and splash"`: hay `strip shallow` con `z ≥ 6`; `ramp deck` de subida (`at.x 160`, `at.z 2.5`, `h 3.5`) y de caída (`w 6`, `at.z 0.2`, `h 5.8`, `at.x + w === FLUME_X1`); `bayWater(FLUME_X1 + 1, FLUME.y + 1.5)` es `true` y `FLUME_X1` está en arena en toda la banda; 6 `dot windowCool` con `bayWater` verdadero. `logSolids(0)` son dos `hull deck len 2.4`. `"the channel crosses the boardwalk overhead"` (decisión 7). `"no umbrella under the channel"` para las semillas 7, 8 y la del sitio. `FAIR_MATS` contiene `shallow`.
- [ ] **Paso 2:** FALLA. **Paso 3:** decisiones 3, 4 y 6. **Paso 4:** pasa (incluidos los tests de botes). Commit `feat(#327): log flume`.

### Tarea 5: capa animada `fair.logs`

**Archivos:** `fair-anim.ts`, `fair-animator.ts`; tests en `fair-anim.test.ts`, `fair-animator.test.ts`.

**Interfaces:**
- Consume: `logSolids`, `flumeAt`, `flumeLength` (tarea 4).
- Produce: `LOG_SPEED = 4, LOG_LIFT_SPEED = 2, LOG_DROP_SPEED = 12`; `FairAnim.logs(): Solid[]`, `FairAnim.logDist(): number`; `FairChanges.logs: boolean`; capa `"fair.logs"` `{ kind: "solid", solids }`.

- [ ] **Paso 1: tests.** `"logs: frame 0 at the start, tick(1000) moves logDist by 2 on the lift and marks the layer"`; `"logs: 4 u/s on the flat, 12 on the drop, wrap to the start"`; `"reduced motion: logs stay at the start and the layer is never marked"` (y el `toEqual` de `FairChanges` existente suma `logs: false`); `"logs never cross a foreign static solid"` (Review Focus 3); `"logSolids wraps any distance"` (Review Focus 2). En `fair-animator.test.ts`, la lista de ids suma `fair.logs` y `tick(1000).has("fair.logs")`.
- [ ] **Paso 2:** FALLA. **Paso 3:** decisión 4; `tick` marca `logs` en cada tick con `dtMs > 0` (como el tren). **Paso 4:** pasa. Commit `feat(#327): animated logs`.

### Tarea 6: hilera de puestos variados

**Archivos:** `fair.ts` (`boothRow`, `boothTypes`, `boothSlots`; se borra `booths`); tests en `fair.test.ts`.

**Interfaces:** produce `BOOTH_ROW = { y0: -294, y1: -210, step: 6 } as const`; `type BoothType = "food" | "foodTruck" | "shooting" | "cottonCandy" | "fortune" | "tickets" | "rings"`; `BOOTH_TYPES: readonly BoothType[]`; `boothSlots(): Vec2[]`; `boothTypes(rng: Rng, n?: number): BoothType[]`; `boothRow(out, accents, rng): void`. `FAIR_MATS` suma `signal`, `livery`, `safety`, `awning`.

- [ ] **Paso 1: tests.** `"booth row: 12..16 slots on the sand, none under the channel"`; `"boothTypes: no two neighbours repeat, only catalog types, for 50 seeds"`; `"each booth type has its signature solid"` (con `boothRow` y una lista de tipos forzada no se puede: se prueba sobre 50 semillas que aparezcan los siete tipos al menos una vez y que cada `foodTruck` tenga su ventanilla `amber`); `"every booth keeps an amber sign and a cyan or magenta dot"`. Se borra el test `≥ 8 gabled booths` (los puestos viejos se reemplazan).
- [ ] **Paso 2:** FALLA. **Paso 3:** decisiones 2, 5 y 12. **Paso 4:** pasa. Commit `feat(#327): varied booth row`.

### Tarea 7: patio de food trucks y huellas

**Archivos:** `fair.ts` (`foodCourt`); tests en `fair.test.ts`.

**Interfaces:** produce `FOOD_COURT = { x0: 100, x1: 160, y0: -176, y1: -170 } as const`; `foodCourt(out, accents): void`.

- [ ] **Paso 1: tests.** `"food court: five trucks, 8 tables, 16 chairs and a garland inside FOOD_COURT"` (cinco ventanillas `amber` en `y −176..−170`; margen 0.7, decisión 13). `"no new footprint overlaps an old one"`: cada pieza nueva (las seis funciones de la decisión 1) contra los sólidos de `fair(rng, { legacyOnly: true })` salvo sombrillas y cascos, con `touch`, con la excepción del cruce (decisión 7); y las piezas nuevas entre sí. La rueda ("nothing static in front") y "nothing rests on water" (con la exención del issue para la caída) siguen en verde con todo. Presupuesto: elevados `> 250` y `≤ 700`.
- [ ] **Paso 2:** FALLA. **Paso 3:** decisión 13. **Paso 4:** pasa. Commit `feat(#327): food court`.

### Tarea 8: exhibits y verificación visual

**Archivos:** `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts`, `src/english.test.ts`.

**Interfaces:** consume `GHOST`, `MIRRORS`, `SLIDE`, `FLUME` (comentarios de cada región).

- [ ] **Paso 1: tests.** `CATALOG.fair` suma `tren-fantasma, casa-espejos, tobogan, tronco-acuatico` después de `muelle`; `ANIMATED` suma `tronco-acuatico`; `EXHIBIT_IDS` suma los cuatro ids. Test `"the fair attractions of #327"` con las cuatro cajas exactas del issue: `{ 96, −260, 120, −244 }`, `{ 122, −260, 142, −244 }`, `{ 111, −299, 125, −285 }`, `{ 158, −300, 226, −290 }`.
- [ ] **Paso 2:** FALLA. **Paso 3:** cuatro regiones en `EXHIBITS` después de `muelle`, grupo `fair`, `h` = el menor entero que pasa "framing" y "neighbors" (medido con el `measure` de `exhibits.test.ts`, anotado en el comentario de cada región).
- [ ] **Paso 4:** `npm test` y `npm run typecheck` en verde. Servidor `npm run dev -- --host --port 5173`, guion `.scratch/evals-327.md` con agent-browser; capturas para el PR.
- [ ] **Paso 5:** commit `feat(#327): fair attraction exhibits`.
