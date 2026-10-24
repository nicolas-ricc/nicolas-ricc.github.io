# Nave de calderas (Fábrica de Luz) (#213): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reemplazar la planta de ladrillo con dientes de sierra por la nave de calderas de La Fábrica de Luz en `x 44..120, y −46..−16` (muros con fachada, pilastras de acero, zócalo, techo de pizarra, chimeneas metálicas, testero con piñón escalonado, torre de escalera y cinta inclinada con tolva) y dejar en `x 20..44` un marcador `brick` 24 × 30 × 18.

**Architecture:** archivo nuevo `src/scenes/boiler-house.ts` con las constantes de la nave y un constructor por grupo del inventario (`naveBody`, `gableEnd`, `metalStacks`, `stairTower`, `inclineBelt`), más `boilerHouse(out)` que los llama a todos. `factory.ts` reemplaza el cuerpo de `plant()` por marcador + `boilerHouse` + portón este, y mueve un farol. Todo es kit existente (`prism`, `ramp`, `cylinder`, `beam`, `facade`, `plates`): no se toca `src/iso/`.

**Tech Stack:** TypeScript, Vitest, PixiJS (solo para mirar en el storybook).

**Spec:** issue #213 (hijo de #207); decisión 8 del plan de #207; `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` §2 y §5. Fotos: `docs/superpowers/specs/assets/fabrica-refs/planta/01`, `02`.

## Global Constraints

- Huella: "la planta conserva `x 20..120, y −46..−16` y el portón este `y −23..−17`"; el portón queda en `x 119.8..120.3`, z 0..8 (prisma `concrete` de hoy).
- "cinta, grúa torre, desvío, camiones y vías no se mueven; las bocas de las chimeneas (`STACKS`, `STACK_BASE_H`) no cambian."
- "Tamaño mínimo 0.15 u en cualquier dimensión de cualquier pieza (`beam` incluido)." (los parteluces de 0.12 de `facade.grid` son del kit, decididos en #209).
- "Ningún sólido de la nave supera z 20 salvo las chimeneas metálicas y sus tensores (≤ 22.6)."
- "Sin solapes": `bounds` disjuntos en x/y o en z para cada vecindad nombrada.
- Visibilidad: la cámara ve techo, este (+x) y sur (+y); el detalle va ahí.
- Materiales: solo los de `PORTFOLIO_MATS` (`brick`, `rust`, `concrete`, `whitewash`, `steel`…); pizarra = `steel`. Sin hex fuera de la paleta.
- Acentos: misma cantidad de faroles (`fábrica: { cyan: 8 }` en `portfolio-accents.test.ts` no cambia).
- `npm test` y `npm run typecheck` en verde. Textos, comentarios y nombres de test en castellano. Commits `feat(#213): …`.

## Decisiones técnicas (declaradas; corrigen coordenadas del issue que se contradicen con "salientes" / "sin solapes")

- **D1 — Pilastras fuera del muro.** El issue las pone en `y −16.5..−16`, que está *dentro* del prisma del muro (su cara sur es y = −16; el sur es +y), así que no se verían, y el spec §5 las pide "salientes del muro sur". Van en `y −16..−15.5`. Como el zócalo ocupa `y −16..−14.5, z 0..3.5` delante del muro (en la foto las pilastras arrancan detrás del cuerpo blanco), la **zapata** `concrete` 0.9 × 0.9 × 0.6 apoya sobre el zócalo (`y −16..−15.1`, z 3.5..4.1) y la pilastra `rust` 0.5 × 0.5 va de z 4.1 a 14. Montante de celosía: prisma `rust` 0.15 × 0.15 al oeste, separado 0.2 (x `c − 0.6..c − 0.45`, mismo y y z). Ménsula: `beam` `rust` 0.3 × 0.3 de `(c, −15.5, 12)` a `(c, −15.4, 13.85)` (no entra en el techo). Centros `c = 44 + k·76/11`, k = 0..11.
- **D2 — Tolva fuera del muro.** El issue la pone en `y −17.5..−15.5`, 1.5 u dentro del muro. Va en `x 58.5..61.5, y −16..−14, z 11..13.5`, y la cinta inclinada termina en su centro: `beam` `rust` 1.6 × 0.6 de `(52, −4, 0.5)` a `(60, −15, 12.5)`. Caballetes: 2 prismas `rust` 0.4 × 0.4 centrados bajo la cinta en t = 1/3 y 2/3, de z 0 hasta 0.3 bajo el eje.
- **D3 — Techo sin alero oeste.** El issue dice `x 43.4..119.5`; el tramo `43.4..44` se metería en el marcador (y luego en la maltería, h 18). El techo va de `x 44` a `119.5`. Norte: `ramp` `steel` `x 44, y −46.6, z 14, w 75.5, d 15.6, h 3, dir "n"`; sur: `y −31, d 15.6, dir "s"`. Cumbrera a z 17 en y −31.
- **D4 — Remates.** Sur: prisma `whitewash` `x 44..119.5, y −15.4..−15.1, z 13.7..14` (bajo el borde del alero, sin cruzarlo). Este: el alero este queda detrás del piñón; el remate este lo da la cornisa del testero (D6).
- **D5 — Piñón con tapa.** Cada escalón `brick` (x 119.5..120.5) pierde los 0.3 u de arriba, que son su tapa `whitewash`: y −44..−18 z 14..15.2 + tapa 15.2..15.5; y −38..−24 z 15.5..16.7 + 16.7..17; y −33..−29 z 17..18.2 + 18.2..18.5. Celosía en la cara este (arista 1) de cada escalón `brick`: placas `rect` `brick` `toneOffset −2` de 0.5 u de ancho en damero (cada 1 u), del pie del escalón a 0.2 bajo la tapa.
- **D6 — Marco del testero sin solapes internos.** Pilastras `whitewash` 1 × 1 × 13.7 en `x 120..121`, `y −46, −36, −26, −17` (borde norte de cada una). Bandas 0.3 × 0.3 a z 7..7.3 en `x 120..120.3` solo entre pilastras (y −45..−36, −35..−26 y −25..−23: la tercera se corta en el portón). Cornisa `whitewash` `x 120..121, y −46..−16, z 13.7..14`.
- **D7 — Torre sin postes que atraviesen descansos.** Descansos `steel` 5 × 8 × 0.25 con base en z 3.5, 7, 10.5, 14. Postes 0.4 × 0.4 en las 4 esquinas de `x 121..126, y −34..−26`, partidos en tramos entre descansos (z 0..3.5, 3.75..7, 7.25..10.5, 10.75..14, 14.25..16). Tramos `beam` `steel` 1.0 × 0.25, de cada descanso (o el suelo) al siguiente: k par en x 122.5 de y −27 a y −33, k impar en x 124.5 de y −33 a −27, de `z_k + 0.15` (z_0 = 0, z_k = 3.5k + 0.25) a `3.5(k+1) − 0.15`. Baranda `beam` `steel` 0.15 × 0.15 a 1 u sobre cada descanso: este en x 125.9 de y −33.6 a −26.4; sur en y −26.1 de x 121.4 a 125.6.
- **D8 — Solape de `beam`.** La caja de una viga diagonal cubre mucho aire (la de la cinta inclinada pisa la del mástil de la grúa aunque la viga pasa a 1 u). Los tests de vecindad parten cada `beam` en 16 vigas consecutivas y comparan sus `bounds`; prismas y cilindros comparan su `bounds` entera.
- **D9 — Caperuzas** `steel` 1.2 × 1.2 × 0.8 en x 62.5, 77.5, 92.5, 110 (centros), `y −31.6..−30.4`, z 17..17.8.
- **D10 — Chimeneas metálicas y tensores.** Cilindro `rust` r 0.5 h 6 en `(cx, −33, 16.6)`, `cx` ∈ {55, 70, 85, 100}. Tensores `beam` `rust` 0.15 × 0.15 desde `(cx ± 0.35, −33 ± 0.35, 21)` (cuatro diagonales) a `(cx ± 2, −35, 16.23)` (norte) y `(cx ± 2, −31, 17)` (sur): z del faldón en ese y.
- **D11 — Celosía de ladrillo bajo el alero.** En el prisma alto (z 7..14), placas `rect` `brick` `toneOffset −2` de 0.5 × 0.8 (z 12.8..13.6) cada 1 u, empezando en u = 0, sobre `wall 2` (sur, 76 placas) y `wall 1` (este, 30 placas); `u0..u1` = `[i/L, (i + 0.5)/L]` con L el largo de la pared.
- **D12 — Zócalo.** Prisma `whitewash` `x 44, y −16, z 0, w 76, d 1.5, h 3.5` con `facade { floors: 1, cols: 20, window: { w: 0.7, h: 0.6 }, grid: { cols: 4, rows: 5 } }`; tubos `cylinder` r 0.3 h 0.8 en `x = 44 + (i + 0.5)·3.8`, `y −14.8`, z 3.5, i = 0..19, par `whitewash`, impar `rust`.
- **D13 — Muros.** `prism` `brick` `x 44, y −46, w 76, d 30, h 7` en z 0 y z 7. Abajo `facade { floors: 1, cols: 11, window: { w: 0.6, h: 0.55 }, grid: { cols: 3, rows: 4 }, head: "flat", courses: { mat: "rust", h: 0.4 } }`; arriba igual con `cols: 22` y `plates` de D11.
- **D14 — Constantes.** `factory.ts` conserva `PLANT` (huella completa, h 14 = alero) y exporta `MALT = { x: 20, y: -46, w: 24, d: 30, h: 18 }`; `boiler-house.ts` exporta `NAVE = { x: 44, y: -46, w: 76, d: 30, h: 14 }`, `STAIR_TOWER = { x0: 121, y0: -34, x1: 126, y1: -26 }`, `METAL_STACK_X = [55, 70, 85, 100]`.
- **D15 — Exhibits.** `planta`: caja `{ x0: PLANT.x − M, y0: PLANT.y − M, x1: 126.4, y1: −14 }` (y1 −14 deja dentro zócalo y tolva y afuera faroles y grúa), `h: 23` (chimeneas metálicas a 22.6), título "Nave de calderas". `cinta`: se ajusta solo si `exhibits.test.ts` lo pide.

## Review Focus

1. Orden de pintado con cajas que se cruzan (cinta inclinada contra el mástil de la grúa y contra el zócalo; tensores contra el techo): el depth sort usa `bounds`. Lo vigila la captura del storybook (Tarea 4), no un test.
2. Placas sobre la pared este del prisma alto: las tapan las pilastras del testero solo donde estas están; deben verse entre ellas. Captura.
3. Faroles: el de (58, −16) se mueve a (50, −13.5) y la cuenta de `cyan` sigue en 8 (`portfolio-accents.test.ts`).
4. Mínimo 0.15 u en cada pieza nueva: test "toda pieza de la nave mide al menos 0.15 u" (Tarea 1).
5. `planta` y `cinta` en `exhibits.test.ts`: encuadre y vecinos (Tarea 4).

---

### Task 1: Cuerpo de la nave y marcador

**Files:**
- Create: `src/scenes/boiler-house.ts`
- Modify: `src/scenes/factory.ts` (`plant()`, constantes, docstring)
- Test: `src/scenes/boiler-house.test.ts`, `src/scenes/factory.test.ts` (los de stage 3)

**Interfaces:**
- Produces: `NAVE`, `boilerHouse(out: Solid[]): void`, `naveBody(out: Solid[]): void` (muros D13, pilastras D1, celosía D11, zócalo D12, techo D3, remate sur D4, caperuzas D9), `MALT` en `factory.ts`.

- [ ] Tests (ya escritos en stage 3): `boiler-house.test.ts` "muros…", "12 pilastras…", "banda de celosía…", "zócalo…", "techo…", "toda pieza de la nave mide al menos 0.15 u"; `factory.test.ts` "la planta: marcador … sin dientes de sierra", "el portón este sigue…". Correr `npx vitest run src/scenes` → FAIL.
- [ ] Implementar `naveBody` y `boilerHouse` (que por ahora solo llama a `naveBody`); `plant()` = marcador `prism(20, −46, 0, 24, 30, 18, "brick")` + `boilerHouse(out)` + portón este de hoy. Quitar dientes, cornisa y portones sur. Docstring de `factory.ts`: "nave de calderas (Fábrica de Luz) y, al oeste, el marcador de la maltería".
- [ ] `npx vitest run src/scenes` → los tests de esta tarea PASS. Commit `feat(#213): cuerpo de la nave de calderas y marcador de la maltería`.

### Task 2: Testero, piñón y chimeneas metálicas

**Files:** Modify `src/scenes/boiler-house.ts`. Test: `boiler-house.test.ts`, `factory.test.ts`.

**Interfaces:**
- Consumes: `NAVE`. Produces: `gableEnd(out: Solid[]): void` (D5, D6), `metalStacks(out: Solid[]): void` (D10), `METAL_STACK_X`; `boilerHouse` los llama.

- [ ] Tests: "testero: marco whitewash y piñón escalonado…", "cuatro chimeneas metálicas con 4 tensores…", `factory.test.ts` "las chimeneas metálicas y sus tensores quedan dentro de la huella de la nave" y "ningún sólido de la nave supera z 20…". FAIL.
- [ ] Implementar. PASS. Commit `feat(#213): testero con piñón escalonado y chimeneas metálicas`.

### Task 3: Torre de escalera, cinta inclinada y farol

**Files:** Modify `src/scenes/boiler-house.ts`, `src/scenes/factory.ts` (`lamps()`). Test: `boiler-house.test.ts`, `factory.test.ts`.

**Interfaces:**
- Produces: `stairTower(out: Solid[]): void` (D7), `inclineBelt(out: Solid[]): void` (D2), `STAIR_TOWER`; `boilerHouse` los llama.

- [ ] Tests: "torre de escalera…", "cinta inclinada…", `factory.test.ts` "la torre de escalera no toca…", "la cinta inclinada y su tolva no tocan…", "el zócalo no toca…". FAIL.
- [ ] Implementar; en `lamps()` el farol `(58, −16)` pasa a `(50, −13.5)`. PASS. Commit `feat(#213): torre de escalera y cinta inclinada con tolva`.

### Task 4: Exhibits y capturas

**Files:** Modify `src/lab/exhibits.ts`. Test: `src/lab/exhibits.test.ts` (sin cambios de lógica).

- [ ] Caja de `planta` según D15; `cinta` solo si el test lo pide. `npx vitest run src/lab` PASS.
- [ ] `npm test` y `npm run typecheck` PASS.
- [ ] Capturas "después" de `planta` y `cinta` (1600 × 900, 2x) en `docs/superpowers/specs/assets/207-fabrica/<exhibit>-despues.png`; anotar caras del panel. Script `.scratch/evals-213.md`. Commit `feat(#213): cajas de los exhibits planta y cinta y capturas`.
