# Estación, parte 2: edificio de pasajeros, torre del reloj y explanada (#278) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a `src/scenes/station.ts` el edificio de pasajeros (hall, linterna, medio punto, cornisa, pórtico, ventanales, alas, servicio), la torre del reloj y la explanada de la región x 166..197.3, y 98..136, con sus luces de noche, y subir el `h` del exhibit `estacion`.

**Architecture:** `export function building(out, accents)` en `station.ts`, llamada al final de `station()`. Es determinista y no usa rng, igual que el resto del módulo. Se arma con funciones chicas por pieza (`hall`, `portico`, `wings`, `esplanade`, `tower`). Las huellas exportadas son el contrato con los hijos siguientes de #239. Todo el detalle va en placas (`plates`) sobre los muros; las luces de noche son `poly` sobre esas placas, con el contorno de la placa en coordenadas de mundo. Los tests los escribe el orquestador en stage 3 (en rojo) y cada tarea los pone en verde.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #278 (texto completo: "Qué hacer", "Reglas que hereda", "Criterios") y `docs/superpowers/specs/2026-10-27-estacion-terminal-design.md` §2, §3, §4.2, §5.1, §5.2, §6.1. Contexto: plan de la historia en el comentario de #239 (decisiones 2 y 3). Fotos: `assets/estacion-refs/estacion/01`–`05` y `08`.

## Global Constraints

- Rama base `feature/239-estacion-tigre`; el PR va contra esa rama.
- Las huellas exportadas (`HALL`, `WING_N`, `WING_S`, `LINK`, `SERVICE`, `TOWER`, `PORTICO`, `ESPLANADE`) llevan **exactamente** los literales del bloque `ts` del issue.
- No tocar vías, andenes, topes ni las constantes de #277 (`STATION`, `STOP_X`, `BUFFER_X`, `TRACKS_Y`, `HEAD`…).
- `building()` sin rng. `src/scenes/` sin pixi. Sin hex fuera de la paleta.
- Detalle en caras +x, +y y techo. Tamaño mínimo 0.15 u en todo sólido y en toda placa (ancho en mundo = `(u1 − u0)·largo del muro`, alto = `z1 − z0`).
- Ningún sólido elevado pisa otro (cajas disjuntas con 1e-9), salvo las excepciones A4 (cabriadas de #277) y A9 (remate de la torre).
- Regla del este del tren: todo sólido con `min.x ≥ 158` y `max.y > 130.8` cumple `min.x − max.y ≥ 27.2` o `min.x − 1.4·max.z ≥ 158`.
- Comentarios y docstrings en castellano rioplatense, con la densidad de `station.ts`: un comentario corto por pieza.
- Al final de cada tarea: sus tests en verde y `npm run typecheck` en verde. Los tests de stage 3 de tareas posteriores pueden seguir rojos. Al final de Task 6: `npm test` entero en verde.

## Review Focus

1. **Placas en el muro equivocado del gable.** `wall` es la arista de la huella (0 N, 1 E, 2 S, 3 O) y `u` corre en el sentido de la arista (en el muro este, de y0 a y1; en el sur, de x1 a x0). Un `u` invertido pone el pórtico o las vidrieras corridos. Test: cada placa `glass` de los ventanales del hall, mapeada a mundo, cae en y 106..124 bajo el pórtico (y 110..122 los tres ventanales); las vidrieras del sur de `WING_S` caen bajo su toldo (mismo rango de x).
2. **Luces de noche fuera de su vidrio.** Las `poly` se arman a mano: si su contorno no coincide con la placa, la luz flota. Test: cada `poly` `cyanBleed` coincide (1e-9) con el contorno en mundo de una placa `glass` del hall, y las dos `poly` `amber` del reloj, con las esferas de `wall 1` y `wall 2`.
3. **El remate cruza su propia torre.** La caja del cono cubre todo el tope de la torre: pináculos y hastiales la cruzan siempre. Excepción acotada (A9); test de que fuera de esa excepción no hay ningún cruce.
4. **Palmera central contra el cartel.** Con 6 lados y r 1.8 en x 195.5, la copa llega a x 193.94, y el cartel termina en 194, a z 5.6..6.6, contra una copa a z 6.15. Decidido en A6; lo cubre el test de "ningún sólido pisa otro".
5. **La baranda cruza x 197.** El test de #277 "todo cae en STATION" exige `max.x ≤ 197`; la baranda llega a 197.3 por el issue. Decidido en A7.

## Assumptions

- **A1. Exportar `building`** además de llamarla desde `station()`: los tests que hablan de "todo lo del edificio" la llaman sola, sin filtrar la salida de `station()` por coordenadas.
- **A2. Contorno de placas.** `plate.ts` exporta `plateOutline(p: Plate): Vec2[]` (hoy `outline`, privada, sin cambio de cuerpo). `station.ts` agrega `wallPts(fp: Vec2[], p: Plate): Vec3[]`, que lleva ese contorno a mundo sobre la arista `p.wall` de la huella `fp`. Las `poly` nocturnas y los tests usan `wallPts`. Alternativa descartada: copiar el octógono en `station.ts`.
- **A3. Hastiales del remate: el pentágono mira hacia afuera.** El issue dice "0.8 × 2 (la cara angosta hacia afuera: w < d en las caras este y oeste, w > d en norte y sur)" y "una placa … en su hastial exterior". En el kit, un gable con `w < d` tiene la cumbrera N-S y los hastiales al norte y al sur. Entonces el de la cara este no tendría hastial hacia el este. Se cumple "cara angosta hacia afuera" + "hastial exterior" (foto 04: el hastial de piedra mira al frente): este y oeste `w 2, d 0.8` (cumbrera E-O); norte y sur `w 0.8, d 2`. Huellas: E (188, 128.6), O (184, 128.6), N (186.6, 126), S (186.6, 130), todos a z 24, h 1 (alero 25, cumbrera 25.35), adentro del cuadrado de la torre. El respiradero es `rect` `asphalt` u 0.3125..0.6875 (0.3 de 0.8), z 24.5..24.8, en `wall` 1 (E), 3 (O), 0 (N), 2 (S). Desvío anotado en el PR.
- **A4. Toldos `dir "e"`.** `WING_S` (x 168..184) no tiene cara al este en x 190: ahí están `LINK` y la torre. Los toldos `e` van solo en `WING_N`: dos, `ramp` `signal` en x 190, w 0.8, d 2, h 0.5, z 3, en y 100.5..102.5 y 103.5..105.5. Cada uno lleva una vidriera `rect` `glass` en `wall 1` de `WING_N`, en el mismo rango de u (0.0833..0.4167 y 0.5833..0.9167), z 0.8..2.8. Los cuatro toldos `s` de `WING_S` van centrados en x 170, 174, 178, 182 (x c−1..c+1, y 132..132.8, z 3), con su vidriera en `wall 2`, u `(184 − (c ± 1))/16`, z 0.8..2.8. Desvío anotado.
- **A5. Faroles y palmeras: la coordenada del issue es el centro.** Poste `steel` en (cx − 0.3, cy − 0.3, 0.15), 0.6×0.6×6, con `dot` `cyan` r 1.2 en (cx, cy, 6.15). Palmera: tronco `cylinder` `deck` r 0.25, h 6, `sides: 6`, en (cx, cy, 0.15); copa `cone` `leaf` r 1.8, h 1.6, 6 lados (el default) en (cx, cy, 6.15).
- **A6. Palmera central en x 195.6** (no 195.5): con 195.5 su copa (x ≥ 193.94) cruza el cartel (x ≤ 194, z 5.6..6.6). Con 195.6, la copa va de x 194.04 a 197.16 ≤ 197.3. Las otras dos quedan en 195.5. Desvío anotado.
- **A7. Borde este.** El test de #277 "todo cae en STATION" pasa a `max.x ≤ 197.3` (la baranda, por el issue: "explanada ↔ muelle (`max.x ≤ 197.3`)"). Su "nada elevado pasa z 6" se acota a lo que no es el edificio (`min.x < 166`). `STATION` no cambia.
- **A8. Linterna.** Vidrio `glass` x 172..188, y 114.4..115.6, z 10.8, h 0.8. Tapas `asphalt` por fuera, x 171.85..172 y 188..188.15, mismas y y z: así no se cruzan con el vidrio. `poly` `amberBleed` alpha 0.6 sobre la cara sur del vidrio: (188, 115.6, 10.8), (172, 115.6, 10.8), (172, 115.6, 11.6), (188, 115.6, 11.6).
- **A9. Excepción del remate.** En "ningún sólido elevado pisa otro" se exceptúan los pares (cono del remate, pináculo) y (cono del remate, hastial del remate). Pináculos: `prism` `safety` 0.4×0.4×1.2 en (184, 126), (189.6, 126), (184, 131.6), (189.6, 131.6), z 24.
- **A10. Cornisa dentada.** Muros 1 y 2 del hall: diez `rect` `stockbrick` de 0.4 de ancho en mundo, centradas en u (k + 0.5)/10, z 7.5..7.9. En el hastial este, bajo cada vertiente, cuatro `rect` de 0.4 × 0.4 centradas en y 107, 108.8, 110.6, 112.4 y su espejo (230 − y). La placa termina 0.1 bajo la línea del techo: `z1 = 8 + 2.8·(y − 106)/9 − 0.1`, `z0 = z1 − 0.4`. La última, en y 112.2..112.6, no pisa el arco (u ≥ 0.41 → y ≥ 113.38).
- **A11. Ventanas y parteluces.** Ventanales del este (hall, `wall 1`, largo 18): por cada ventanal, parteluz vertical `canopy` de 0.15 en su centro de u, z 1.2..6.4, y horizontal `canopy` en todo su ancho, z 3.925..4.075. Ventanas del sur (hall, `wall 2`, largo 20): cuatro `rect` `glass` de 1.6 centradas en u (k + 0.5)/4, z 2..5.5, cada una con un parteluz vertical `canopy` de 0.15 en su centro. Hoy `WING_S` y `LINK` tapan la parte de abajo; quedan por el issue.
- **A12. Pórtico.** Placa `glass` en `wall 1` y `wall 2` de `PORTICO`: u 0.02..0.98, z 5.3..5.5. Columnas `cylinder` `canopy` r 0.3, `sides: 8`, centradas en (193.4, 111.5) y (193.4, 120.5), z 0.15, h 5.05. Cartel `prism` `whitewash` (193.85, 111, 5.6), w 0.15, d 10, h 1. Luces `amber` r 0.9 bajo la marquesina en (192, 112, 5.1), (192, 116, 5.1), (192, 120, 5.1). Farolas de pared `amber` r 0.5 en (190.05, 109, 3.2) y (190.05, 123, 3.2).
- **A13. Zócalo** `rect` `canopy` u 0..1, z 0..0.8, en `wall 1` y `wall 2` de `HALL`, `WING_N` y `WING_S` (aunque el hall tape el sur de `WING_N`, por el issue).
- **A14. Torre.** Ranuras `rect` `asphalt` u 0.475..0.525 (0.3 de 6), z 4..8 y 11..15, en `wall 1` y `wall 2`. Las esferas y sus `poly` `amber` alpha 0.6 (`wall 1` y `wall 2`) usan `wallPts`. El cono, con `r = 3·Math.SQRT2`, tiene su base sobre el cuadrado 184..190 × 126..132 (tolerancia 1e-9).
- **A15. Materiales compartidos** (medido con `world(7)` en la base, sin contar conos): la ciudad usa `paving` y `stone`, y la estación usa los dos. `sharedWithCity` suma `"stone"` (fuste de la torre) y `"paving"` (losa de la explanada), con su motivo. `deck` y `glass` ya están en la lista del Blog. `leaf` y `tile` solo van en conos, que no cuentan.
- **A16. Acentos del astillero** tras el cambio: `{ amber: 8, amberBleed: 1, cyan: 9, cyanBleed: 7, cyanMid: 8, magenta: 3 }`. amber = 3 del pórtico + 2 de pared + 1 del medio punto + 2 de las esferas; cyanBleed = 3 ventanales + 4 ventanas del sur; cyan = 7 de antes + 2 faroles de la explanada.
- **A17. `h` del exhibit `estacion`:** el menor entero que pasa "encuadre" y "vecinos", medido corriendo `exhibits.test.ts`. Se espera 29: el tope de la torre, sin humo. Comentario con la cuenta.

## Tests de stage 3

Los escribe el orquestador antes de Task 1, en rojo. Lista cerrada:

- `src/scenes/station.test.ts`, describe nuevo "station: edificio, torre y explanada (#278)":
  - "huellas exactas": igualdad de las ocho constantes con los literales del issue. Prismas `HALL` (`brick`, `roof "gable"`, `roofMat "tile"`), `WING_N` y `WING_S` (`brick`, gable, `tile`), `LINK` y `SERVICE` (`brick`, sin `roof`), fuste `stone` 184..190 × 126..132 × 0..24. Losa `paving` 190..197 × 98..136 × 0..0.15.
  - "hall": alero 8 y cumbrera 10.8 (bounds). Linterna y tapas (A8). Medio punto (dos `disc`). Cornisa: 10 + 10 en los muros y 8 en el hastial (A10). Ventanales, parteluces y pilastras (A11; Review Focus 1). Ventanas del sur. Zócalos (A13).
  - "pórtico": marquesina con sus placas, columnas, cartel (A12).
  - "alas y toldos" (A4).
  - "explanada": faroles, palmeras (A5, A6) y baranda `canopy` 197..197.3 × 98..136 × 0..1. Todo lo que apoya en la losa arranca en z 0.15.
  - "torre": ranuras, cuatro esferas `disc` `whitewash` en `wall` 0..3 sobre anillos `safety`, pináculos (A9), remate (A14) que llega a `TOWER.top`, y la torre es el sólido más alto de `station()`. Hastiales y respiraderos (A3).
  - "luces de noche": ≥ 3 `dot` `amber` bajo el pórtico (x 190..194, y 110..122, z < 5.2). 2 `poly` `amber` en las esferas, que coinciden con su contorno (Review Focus 2). 7 `poly` `cyanBleed` sobre placas `glass` del hall. 1 `poly` `amberBleed` sobre la linterna. 1 `poly` `amber` sobre el abanico. 2 `dot` `cyan` de los faroles de la explanada.
  - "tamaño mínimo 0.15" en cada sólido de `building()` (extensión de su caja en x, y y z) y en cada placa.
  - vecindades: "edificio ↔ HEAD y su marquesina" (todo `min.x ≥ 166`, y disjunto de las cajas de `HEAD` y su techo); "torre ↔ explanada" (todo `max.x ≤ 190` salvo marquesina del pórtico, cartel, columnas, toldos `e` y lo que apoya en la losa; lo que está en x > 190 arranca en z ≥ 0.15); "explanada ↔ muelle" (`max.x ≤ 197.3`); "hall ↔ alas ↔ torre" (cajas que se tocan y no se cruzan); "ningún sólido del edificio en y < 98 ni y > 136".
- `src/scenes/station.test.ts`, tests existentes: "todo cae en STATION…" según A7; "ningún sólido elevado pisa otro…" con la excepción A9. "oclusión" sin cambios: debe pasar con el edificio.
- `src/scenes/portfolio-accents.test.ts`: `shipyard` según A16.
- `src/scenes/world.test.ts` "no comparten materiales": A15.
- `src/lab/exhibits.test.ts`: sin cambios. "encuadre" queda en rojo hasta Task 6, porque `h` 5 no cubre la torre.

---

### Task 1: Huellas, hall, linterna, medio punto, cornisa y zócalo del hall

**Files:**
- Modify: `src/iso/plate.ts` (exportar `plateOutline`), `src/scenes/station.ts`
- Test: `src/scenes/station.test.ts` ("huellas exactas", "hall", la parte de linterna y medio punto de "luces de noche")

**Interfaces:**
- Produces: las ocho constantes; `export function building(out: Solid[], accents: Accent[]): void`, llamada al final de `station()`; `wallPts(fp: Vec2[], p: Plate): Vec3[]` (exportada para los tests); `export function plateOutline(p: Plate): Vec2[]` en `plate.ts`.

- [ ] **Step 1:** `npx vitest run src/scenes/station.test.ts -t "huellas|hall"` → FAIL (constantes sin exportar).
- [ ] **Step 2:** Exportar las constantes. Escribir `building()` y `hall(out, accents)`. Prismas de `HALL`, `WING_N`, `WING_S`, `LINK` y `SERVICE`: sus placas llegan en Task 3, pero los sólidos van acá, así "huellas exactas" pasa entero. Linterna (A8), medio punto (`disc` `stockbrick` u 0.41..0.59, z 8.1..10.0 y `disc` `glass` u 0.43..0.57, z 8.3..9.8 en `wall 1`, más `poly` `amber` alpha 0.5 = `wallPts` del vidrio), cornisa (A10), ventanales y ventanas (A11) con sus `poly` `cyanBleed` alpha 0.5 y zócalo (A13).
- [ ] **Step 3:** Mismo comando → PASS. `npm run typecheck` → sin errores.
- [ ] **Step 4:** Commit `feat(#278): hall de la estación con linterna, medio punto, cornisa y ventanales`.

### Task 2: Pórtico, columnas, cartel y farolas

**Files:** Modify `src/scenes/station.ts`. Test: "pórtico" y lo del pórtico en "luces de noche".

**Interfaces:** Consumes `PORTICO`, `building()` y `wallPts` de Task 1.

- [ ] **Step 1:** `npx vitest run src/scenes/station.test.ts -t "pórtico"` → FAIL.
- [ ] **Step 2:** `portico(out, accents)` según A12, llamada desde `building()`.
- [ ] **Step 3:** Mismo comando → PASS; typecheck.
- [ ] **Step 4:** Commit `feat(#278): pórtico de acceso con columnas, cartel y luces`.

### Task 3: Alas, toldos, vidrieras y zócalos de las alas

**Files:** Modify `src/scenes/station.ts`. Test: "alas y toldos", la parte de las alas de "huellas" y "hall ↔ alas ↔ torre".

- [ ] **Step 1:** `npx vitest run src/scenes/station.test.ts -t "alas"` → FAIL.
- [ ] **Step 2:** `wings(out)`: placas de vidrieras y zócalo en los prismas de las alas de Task 1 (A4, A13) y los seis toldos `ramp` `signal`.
- [ ] **Step 3:** PASS; typecheck.
- [ ] **Step 4:** Commit `feat(#278): alas con toldos rojos y vidrieras`.

### Task 4: Explanada

**Files:** Modify `src/scenes/station.ts`. Test: "explanada", "explanada ↔ muelle", los `cyan` de "luces de noche".

- [ ] **Step 1:** `npx vitest run src/scenes/station.test.ts -t "explanada"` → FAIL.
- [ ] **Step 2:** `esplanade(out, accents)`: losa `ESPLANADE` h 0.15, faroles en (195.5, 102) y (195.5, 130), palmeras en (195.5, 108), (195.6, 116.5) y (195.5, 125) (A5, A6), baranda.
- [ ] **Step 3:** PASS; typecheck.
- [ ] **Step 4:** Commit `feat(#278): explanada con faroles, palmeras y baranda`.

### Task 5: Torre del reloj

**Files:** Modify `src/scenes/station.ts`. Test: "torre", las esferas de "luces de noche" y la excepción A9.

- [ ] **Step 1:** `npx vitest run src/scenes/station.test.ts -t "torre"` → FAIL.
- [ ] **Step 2:** `tower(out, accents)`: fuste con ranuras, anillos y esferas en los cuatro muros (A14), pináculos (A9), remate, y hastiales con respiradero (A3).
- [ ] **Step 3:** PASS; typecheck.
- [ ] **Step 4:** Commit `feat(#278): torre del reloj con esferas, pináculos y remate de teja`.

### Task 6: Integración: acentos, materiales, exhibit y suite entera

**Files:** Modify `src/lab/exhibits.ts` (`estacion.h` y su comentario). Los tests de stage 3 de `portfolio-accents.test.ts` y `world.test.ts` ya están escritos.

- [ ] **Step 1:** `npm test` → solo fallan "encuadre" y los tests de acentos o materiales que sigan rojos.
- [ ] **Step 2:** Bajar `h` desde 30 hasta el menor entero que pasa "encuadre" y "vecinos" (A17). Comentario: "lo fija el remate de la torre, z 29".
- [ ] **Step 3:** `npm test` y `npm run typecheck` → todo en verde.
- [ ] **Step 4:** Commit `feat(#278): exhibit estacion con h para la torre`.

Después de Task 6, el orquestador saca `docs/superpowers/specs/assets/2026-10-27-estacion/estacion-edificio.png` (storybook `#estacion`, 1600×900 a 2x = 3200×1800) y corre `.scratch/evals-278.md`.
