# Maltería de Mistley y tanque de agua sobre patas (#214): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reemplazar el marcador `brick` 24 × 30 × 18 de `x 20..44, y −46..−16` por el bloque de maltería de Mistley (fachada de 5 pisos, doble piñón, pilastras, cornisa, óculos, puertas de carga, horno) y agregar al oeste el tanque de agua sobre patas centrado en (10, −36).

**Architecture:** archivo nuevo `src/scenes/maltings.ts` (como `boiler-house.ts`) con `MALT`, `WATER_TOWER`, `maltings(out)` y `waterTower(out)`. `factory.ts` reexporta `MALT` y en `plant()` llama `maltings` + `waterTower` en lugar del marcador. La caja del exhibit `planta` se estira al oeste (x0 2) y sube (h 26). Todo es kit existente (`prism` con `facade`/`plates`, `ramp` con `plates`, `cylinder`, `cone`, `beam`): no se toca `src/iso/`.

**Tech Stack:** TypeScript, Vitest, PixiJS (solo para mirar en el storybook).

**Spec:** issue #214 (hijo de #207); decisiones 9 y 10 del plan de #207; `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` §2, §6 y §7. Fotos: `docs/superpowers/specs/assets/fabrica-refs/molino-tanque/01..08`.

## Global Constraints

- Huella: "la planta conserva `x 20..120, y −46..−16` y el portón este `y −23..−17`"; nave, cinta, grúa torre, desvío, camiones y vías no se mueven.
- "Tamaño mínimo 0.15 u en cualquier dimensión de cualquier pieza (`beam` incluido)."
- "Ningún sólido de maltería o tanque supera z 26 y la regla de altura de `factory.test.ts` sigue en verde."
- Sin solapes (criterio del issue): todo el tanque `y ≤ −9.3` y `x ≤ 20`; toda la maltería `x ≤ 44` y `y ≤ −16`. Disjunto = `bounds` separados en x, y o z, contacto permitido; las `beam` se comparan en 16 tramos (`apartSliced` de `factory.test.ts`).
- Visibilidad: la cámara ve techo, este (+x) y sur (+y). Pizarra = `steel`; materiales dentro de `PORTFOLIO_MATS`.
- Placas: `wall` 0 norte, 1 este, 2 sur, 3 oeste; en la pared sur `u` corre de este a oeste: **`u = (x1 − x) / w`** con `x1` el borde este del sólido.
- Acentos: sin cambios (`portfolio-accents.test.ts` no se toca).
- `npm test` y `npm run typecheck` en verde. Textos, comentarios y nombres de test en castellano. Commits `feat(#214): …`.

## Decisiones técnicas (declaradas)

- **D1 — Techo partido alrededor del horno.** El horno (prisma x 22..28, y −46..−40, z 18..24) se mete en las cajas de las rampas x 20..26 y 26..32: ningún plano los separa y el desempate (suma de coordenadas, `depth.ts`) pinta esas rampas *después* del horno, tapándolo. Las dos rampas del oeste se cortan en y −40: rampa `w` x 20..26 y rampa `e` x 26..32 con `y −40..−16` (w 6, d 24, h 6, z 18); al norte del corte quedan solo los tramos fuera del horno: `ramp` `dir "w"` x 20..22, y −46..−40, z 18, w 2, d 6, h 2 y `ramp` `dir "e"` x 28..32, y −46..−40, z 18, w 4, d 6, h 4. Bajo el horno (x 22..28) no va techo: lo tapa el horno. Las rampas x 32..38 (`w`) y 38..44 (`e`) van enteras (d 30). Total: 6 rampas `steel`, 4 de ellas de w 6 (las que llevan los óculos). Test de escena: el horno se pinta después de las 6 rampas que se cruzan con él en pantalla.
- **D2 — Pilastras del piñón dentro de la huella.** `y −16.4..−16` (como el issue: adosadas por dentro, la maltería sigue en `y ≤ −16`; el orden painter las pinta después del muro y de las rampas). En x: 20..20.5, 25.75..26.25, 31.75..32.25, 37.75..38.25 y 43.5..44 (las de los extremos hacia adentro, para no pasar de x 44 ni de x 20). Alto: z 0..18 en x 20, 32, 44; z 0..24 en x 26 y 38.
- **D3 — Cornisa de los faldones.** `beam` `stockbrick` w 0.4 h 0.3 en `y −16.3`, una por faldón (4), del alero a la cumbrera. Una viga a 45° ensancha su caja ±0.11 en x y z en cada punta: la punta de alero se mete 0.15 en x y z (`(20.15, 18.15)`, `(31.85, 18.15)`, `(32.15, 18.15)`, `(43.85, 18.15)`) y la de cumbrera va a `(26, 24)` o `(38, 24)`. Tope de caja ≈ z 24.11.
- **D4 — Óculos a z 19.7.** Con centro z 19.8 (issue) el octógono de apotema 0.9 asoma 0.05 u por encima del faldón (distancia del centro a la pendiente 0.85). A z 19.7 la distancia es 0.92 y entra. En la cara sur (`wall 2`) de cada rampa sur de w 6, centro x 23, 29, 35, 41 → `u = 0.5` en todas: anillo `disc` `stockbrick` `u 0.35..0.65, z 18.8..20.6`, luego `disc` `glass` `u 0.5 ± 0.7/6, z 19.0..20.4`. Test: los vértices del óculo quedan bajo la pendiente.
- **D5 — Fachada.** Prisma `brick` `x 20, y −46, z 0, w 24, d 30, h 18` con `facade { floors: 5, cols: 8, window: { w: 0.45, h: 0.5 }, head: "segmental", headMat: "stockbrick", sill: "stockbrick", piers: { every: 2, w: 0.5, mat: "stockbrick" }, courses: { mat: "stockbrick", h: 0.35 }, ties: { r: 0.25, mat: "steel" } }` (literal del issue). Piso = 3.6 u.
- **D6 — Puertas de carga y portón.** Placas `rect` `steel` en `wall 2` del prisma: puertas `toneOffset −1`, x 31..33 → `u 11/24..13/24`, z `3.6k .. 3.6k + 2.3` para k = 1..4; portón `toneOffset −2`, x 30.5..33.5 → `u 10.5/24..13.5/24`, z 0..3. Van después de la fachada (las tapa por encima: cubren la pilastra de x 32).
- **D7 — Horno.** Prisma `brick` `x 22, y −46, z 18, w 6, d 6, h 6`; `cone` `steel` `sides 4` en `(25, −43, 24)`, r 4.2, h 2 (con `regular` girado π/4, el cuadrado de r 4.2 tiene semilado 2.97: cabe en la tapa del horno). Vértice z 26.
- **D8 — Tanque: patas y riser.** Centro `WATER_TOWER = { x: 10, y: -36 }`. Semilado a la altura z: `s(z) = 4 − 1.5·z/14`. 4 `beam` `rust` 0.5 × 0.5 de `(10 ± 4, −36 ± 4, 0)` a `(10 ± 2.5, −36 ± 2.5, 14)`. Riser `cylinder` `steel` `(10, −36, 0)` r 0.6 h 14.
- **D9 — Tornapuntas y cruces.** A z 5 y z 10: 4 `beam` `rust` 0.3 × 0.3 entre ejes de patas vecinas (cuadrado de semilado `s(z)`). Cruces en X: 2 `beam` `rust` 0.15 × 0.15 por paño, en el paño este (x = 10 + s) y el sur (y = −36 + s), en los tramos z 0..5 y 5..10 (cada nivel arriostra el tramo de abajo), de esquina a esquina opuesta del paño sobre los ejes de las patas. 8 cruces en total.
- **D10 — Escalera.** `beam` `steel` w 0.6 h 0.15 de `(14.5, −31.5, 0)` a `(13, −33, 14)`: la pata SE corrida 0.5·√2 hacia el SE, termina bajo la pasarela.
- **D11 — Pasarela y baranda.** `cylinder` `steel` `(10, −36, 14)` r 4.6 h 0.25 (8 lados). 8 postes prisma `steel` 0.15 × 0.15 × 1 centrados en radio `4.6·cos(π/8) − 0.15` y ángulos k·π/4, z 14.25..15.25; baranda: 8 `beam` `steel` 0.15 × 0.15 entre centros de postes consecutivos a z 15.175 (mismo patrón que la plataforma de `chimney()`).
- **D12 — Fondo, cuba, techo, bola.** `cylinder` `steel` r 2.2 (z 13), r 3.2 (z 13.6), r 3.8 (z 14.2), h 0.6 cada uno; cuba r 4 h 8 a z 14.8; `cone` `steel` 12 lados r 4.6 h 1.4 a z 22.8; bola `cylinder` `steel` r 0.3 h 0.5 a z 24.2 (tope 24.7). Todos centrados en (10, −36).
- **D13 — Exhibit.** `planta`: `box.x0 = 2` (pasarela desde x 5.4; la sombra va al este/norte), resto igual (`y0 PLANT.y − M`, `x1 STAIR_TOWER.x1`, `y1 −14`), `h: 26` (vértice del horno), título "Nave de calderas, maltería y tanque".
- **D14 — Capturas.** Para no pisar las de #213 (`planta-antes/despues.png`), las de este hijo son `docs/superpowers/specs/assets/207-fabrica/planta-malteria-antes.png` (tomada antes de tocar código: 159 sólidos, 1457 caras) y `planta-malteria-despues.png`.

## Review Focus

1. Orden painter del horno contra el techo (D1): test de escena en la Tarea 1 y captura.
2. Pilastras y cornisa por dentro de la huella (`y ≤ −16`): deben verse encima del muro y de los piñones (se pintan después). Test de orden en la Tarea 1 y captura.
3. Pasarela contra los cilindros del fondo (se cruzan en z 14..14.25): la pasarela va después del r 3.2 y antes del r 3.8. Test en la Tarea 2.
4. Placas fuera de su pared: los óculos dentro del triángulo del piñón (D4), puertas dentro de la pared. Test en la Tarea 1.
5. Encuadre de `planta`: `exhibits.test.ts` (h cubre el vértice z 26 sin sobrar más de 8). Tarea 3.

---

### Task 1: Maltería

**Files:**
- Create: `src/scenes/maltings.ts`, `src/scenes/maltings.test.ts`
- Modify: `src/scenes/factory.ts` (`MALT` pasa a `maltings.ts` y se reexporta; `plant()` llama `maltings(out)`; docstring sin "marcador"), `src/scenes/factory.test.ts` (test de la planta: maltería en lugar del marcador), `src/scenes/boiler-house.ts:42` (comentario "marcador" → "maltería").

**Interfaces:**
- Produces: `export const MALT = { x: 20, y: -46, w: 24, d: 30, h: 18 } as const;` `export function maltings(out: Solid[]): void`.

- [ ] **Step 1: tests que fallan** (`maltings.test.ts`): "prisma de ladrillo 24 × 30 × 18 con la fachada de D5"; "seis rampas steel: cuatro de w 6 con cumbreras a z 24 en x 26 y 38 y los dos tramos norte de D1"; "pilastras stockbrick de D2"; "cuatro cornisas beam de D3"; "óculos: dos discos por rampa sur, anillo antes que vidrio, dentro del piñón (D4)"; "cuatro puertas y portón en la pared sur (D6)"; "horno y techo piramidal de D7, vértice z 26"; "ninguna pieza mide menos de 0.15 ni pasa de z 26"; "toda la maltería en x 20..44, y −46..−16"; "orden painter: el horno después de cada rampa que se le cruza en pantalla; pilastras y cornisas después del muro y de las rampas". En `factory.test.ts`, el test de la planta pasa a "maltería" (el prisma 24 × 30 × 18 con `facade.floors === 5`, `build(maltings)` contenido en la escena).
- [ ] **Step 2:** `npx vitest run src/scenes/maltings.test.ts src/scenes/factory.test.ts` → FAIL (no existe `maltings`).
- [ ] **Step 3:** implementar `maltings(out)` con D1–D7; `plant()` → `maltings(out); boilerHouse(out); portón`.
- [ ] **Step 4:** los mismos tests → PASS; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#214): maltería de Mistley`.

### Task 2: Tanque de agua

**Files:**
- Modify: `src/scenes/maltings.ts`, `src/scenes/maltings.test.ts`, `src/scenes/factory.ts` (`plant()` llama `waterTower(out)`), `src/scenes/factory.test.ts`.

**Interfaces:**
- Produces: `export const WATER_TOWER = { x: 10, y: -36 } as const;` `export function waterTower(out: Solid[]): void`.

- [ ] **Step 1: tests que fallan** (`maltings.test.ts`): "cuatro patas rust inclinadas de 8 × 8 a 5 × 5 y riser (D8)"; "ocho tornapuntas a z 5 y 10 y ocho cruces en los paños este y sur (D9)"; "escalera paralela a la pata SE (D10)"; "pasarela con 8 postes y 8 tramos de baranda (D11)"; "fondo escalonado, cuba, techo cónico de 12 lados y bola, tope ≤ 25 (D12)"; "ninguna pieza mide menos de 0.15"; "orden painter: la pasarela después del fondo r 3.2 y antes del r 3.8". En `factory.test.ts`: "el tanque no toca desvío ni locomotora (y ≤ −9.3) ni la maltería (x ≤ 20)"; "la maltería no pisa la nave (x ≤ 44) ni los pallets (y ≤ −16)" (con `expectApart` contra los rieles del desvío, la locomotora y su cabina, los pallets y `build(naveBody)` además de los límites).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementar `waterTower(out)` con D8–D12; `plant()` lo llama después de `maltings`.
- [ ] **Step 4:** PASS + typecheck.
- [ ] **Step 5:** commit `feat(#214): tanque de agua sobre patas`.

### Task 3: Exhibit `planta`, docs y captura

**Files:**
- Modify: `src/lab/exhibits.ts` (D13 y su comentario), `src/lab/exhibits.test.ts` (test "planta incluye el tanque": `box.x0 === 2`, el recorte trae la pasarela r 4.6 y el horno; `h === 26`), `README.md` si menciona el marcador.
- Create: `docs/superpowers/specs/assets/207-fabrica/planta-malteria-despues.png`.

- [ ] **Step 1:** test que falla en `exhibits.test.ts`; FAIL.
- [ ] **Step 2:** cambiar la caja; `npx vitest run src/lab/exhibits.test.ts` → PASS.
- [ ] **Step 3:** `npm test` y `npm run typecheck` en verde.
- [ ] **Step 4:** captura con agent-browser de `/lab/storybook.html?speed=0#planta` a 1600 × 900, escala 2; anotar sólidos y caras del panel.
- [ ] **Step 5:** commit `feat(#214): caja de planta con maltería y tanque`.
