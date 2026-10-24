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

- **D1 — Pilastras fuera del muro.** El issue las pone en `y −16.5..−16`, que está *dentro* del prisma del muro (su cara sur es y = −16; el sur es +y), así que no se verían, y el spec §5 las pide "salientes del muro sur". Van en `y −16..−15.5`. Como el zócalo ocupa `y −16..−14.5, z 0..3.5` delante del muro (en la foto las pilastras arrancan detrás del cuerpo blanco), la **zapata** `concrete` 0.9 × 0.9 × 0.6 apoya sobre el zócalo (`y −16..−15.1`, z 3.5..4.1) y la pilastra `rust` 0.5 × 0.5 va de z 4.1 a 14. Montante de celosía: prisma `rust` 0.15 × 0.15 al oeste, separado 0.2 (x `c − 0.6..c − 0.45`, mismo y y z). Ménsula: `beam` `rust` 0.3 × 0.3 de `(c, −15.5, 11.5)` a `(c, −15.15, 13.55)`: su caja llega a z 13.58, bajo el remate sur (z ≥ 13.7), y no entra en el techo. Centros `c = 44 + k·76/11`, k = 0..11.
- **D2 — Tolva fuera del muro.** El issue la pone en `y −17.5..−15.5`, 1.5 u dentro del muro. Va en `x 58.2..61.2, y −16..−14, z 11..13.5`, y la cinta inclinada termina en su centro: `beam` `rust` 1.6 × 0.6 de `(50, −4, 0.5)` a `(59.7, −15, 12.5)`. Medido con `bounds` en 16 tramos: con los extremos del issue, `(52, −4)` → `(60, −16.5)`, el tramo que pasa junto al mástil de la grúa (x 59.4..60.6, y −12.6..−11.4, `pieces.ts:21`) lo toca, porque la esquina de la sección llega a x ≈ 59.4; con `(50, −4)` → `(59.7, −15)` ningún tramo toca mástil, farol (50, −13.5), camiones ni pallets. Caballetes: 2 prismas `rust` 0.4 × 0.4 centrados bajo la cinta en t = 1/3 y 2/3, de z 0 hasta 0.3 bajo el eje.
- **D3 — Techo sin alero oeste.** El issue dice `x 43.4..119.5`; el tramo `43.4..44` se metería en el marcador (y luego en la maltería, h 18). El techo va de `x 44` a `119.5`. Norte: `ramp` `steel` `x 44, y −46.6, z 14, w 75.5, d 15.6, h 3, dir "n"`; sur: `y −31, d 15.6, dir "s"`. Cumbrera a z 17 en y −31.
- **D4 — Remates.** Sur: prisma `whitewash` `x 44..119.5, y −15.4..−15.1, z 13.7..14` (bajo el borde del alero, sin cruzarlo). Este: el alero este queda detrás del piñón; el remate este lo da la cornisa del testero (D6).
- **D5 — Piñón con tapa.** Cada escalón `brick` (x 119.5..120.5) pierde los 0.3 u de arriba, que son su tapa `whitewash`: y −44..−18 z 14..15.2 + tapa 15.2..15.5; y −38..−24 z 15.5..16.7 + 16.7..17; y −33..−29 z 17..18.2 + 18.2..18.5. Celosía en la cara este (arista 1) de cada escalón `brick`: placas `rect` `brick` `toneOffset −2` de 0.5 u de ancho en damero (cada 1 u), del pie del escalón a 0.2 bajo la tapa.
- **D6 — Marco del testero sin solapes internos.** Pilastras `whitewash` 1 × 1 × 13.7 en `x 120..121`, `y −46, −36, −26, −17` (borde norte de cada una). Bandas 0.3 × 0.3 a z 7..7.3 en `x 120..120.3` solo entre pilastras (y −45..−36, −35..−26 y −25..−23: la tercera se corta en el portón). Cornisa `whitewash` `x 120..121, y −46..−16, z 13.7..14`.
- **D7 — Torre sin postes que atraviesen descansos.** Descansos `steel` 5 × 8 × 0.25 con base en z 3.5, 7, 10.5, 14. Postes 0.4 × 0.4 en las 4 esquinas de `x 121..126, y −34..−26`, partidos en tramos entre descansos (z 0..3.5, 3.75..7, 7.25..10.5, 10.75..14, 14.25..16). Tramos `beam` `steel` 1.0 × 0.25, de cada descanso (o el suelo) al siguiente: k par en x 122.5 de y −27 a y −33, k impar en x 124.5 de y −33 a −27, de `z_k + 0.15` (z_0 = 0, z_k = 3.5k + 0.25) a `3.5(k+1) − 0.15`. Baranda `beam` `steel` 0.15 × 0.15 a 1 u sobre cada descanso: este en x 125.9 de y −33.6 a −26.4; sur en y −26.1 de x 121.4 a 125.6.
- **D8 — Solape de `beam`.** La caja de una viga diagonal cubre mucho aire (la caja entera de la cinta inclinada pisa la del mástil). Los tests de vecindad usan `apart(a, b)`: cada `beam` se parte en 16 vigas consecutivas (`from + (to − from)·i/16`) y se comparan sus `bounds`; el resto compara su `bounds` entera. Disjunto = separados en x, en y o en z con contacto permitido (`a.max ≤ b.min`), como el test de vagones de hoy (`factory.test.ts`, `a.max.x <= b.min.x`).
- **D9 — Caperuzas** `steel` 1.2 × 1.2 × 0.8 en x 62.5, 77.5, 92.5, 110 (centros), `y −31.6..−30.4`, z 17..17.8.
- **D10 — Chimeneas metálicas y tensores.** Cilindro `rust` r 0.5 h 6 en `(cx, −33, 16.6)`, `cx` ∈ {55, 70, 85, 100}. Tensores `beam` `rust` 0.15 × 0.15 desde `(cx ± 0.35, −33 ± 0.35, 21)` (cuatro diagonales) a `(cx ± 2, −35, 16.23)` (norte) y `(cx ± 2, −31, 17)` (sur): z del faldón en ese y.
- **D11 — Celosía de ladrillo bajo el alero.** En el prisma alto (z 7..14), placas `rect` `brick` `toneOffset −2` de 0.5 × 0.8 (z 12.8..13.6) cada 1 u, empezando en u = 0, sobre `wall 2` (sur, 76 placas) y `wall 1` (este, 30 placas); `u0..u1` = `[i/L, (i + 0.5)/L]` con L el largo de la pared.
- **D12 — Zócalo.** Prisma `whitewash` `x 44, y −16, z 0, w 76, d 1.5, h 3.5` con `facade { floors: 1, cols: 20, window: { w: 0.7, h: 0.6 }, grid: { cols: 4, rows: 5 } }`; tubos `cylinder` r 0.3 h 0.8 en `x = 44 + (i + 0.5)·3.8`, `y −14.8`, z 3.5, i = 0..19, par `whitewash`, impar `rust`.
- **D13 — Muros.** `prism` `brick` `x 44, y −46, w 76, d 30, h 7` en z 0 y z 7. Abajo `facade { floors: 1, cols: 11, window: { w: 0.6, h: 0.55 }, grid: { cols: 3, rows: 4 }, head: "flat", courses: { mat: "rust", h: 0.4 } }`; arriba igual con `cols: 22` y `plates` de D11.
- **D14 — Constantes.** `factory.ts` conserva `PLANT` (huella completa, h 14 = alero) y exporta `MALT = { x: 20, y: -46, w: 24, d: 30, h: 18 }`; `boiler-house.ts` exporta `NAVE = { x: 44, y: -46, w: 76, d: 30, h: 14 }`, `STAIR_TOWER = { x0: 121, y0: -34, x1: 126, y1: -26 }`, `METAL_STACK_X = [55, 70, 85, 100]`.
- **D16 — Mínimo 0.15 u.** El test recorre los sólidos que emite `boilerHouse` en un arreglo nuevo: `prism` mide `w`, `d`, `h`; `cylinder` `2r` y `h`; `beam` `w`, `h` y su largo; `ramp` `w`, `d`, `h`. Las placas (`plates`) no son sólidos: se mide aparte su ancho `(u1 − u0)·largo de la pared` y su alto `z1 − z0`.
- **D17 — Vecindades con test** (lista cerrada, de los criterios del issue): torre contra cinta existente (`x 121..123, y ≥ −20`: los prismas de `conveyor()`) y contra el pedestal de la primera chimenea (`x ≥ 126.5`); cinta inclinada + caballetes + tolva contra camiones (`w 6/2, d 2.4`), pallets (`d 2`, y −3), grúa torre (todo sólido `steel`/`rust` que `towerCrane` emite en (60, −12): mástil, pluma, contrapluma, contrapeso, cabina, cable, gancho) y faroles (prismas `steel` 0.6 × 0.6 × 5); zócalo contra camiones y faroles; chimeneas metálicas + tensores dentro de `x 44..120, y −46..−16` en planta. Además, ménsulas contra remate sur (D1).
- **D18 — Faldón norte en tramos (stage 4, captura).** La chimenea y sus tensores se cruzan con la caja del faldón: el desempate por suma de coordenadas pintaba las de x 55 y 70 antes del faldón entero (tapadas). El faldón norte va en 5 `ramp` E-O cortadas en x 62.5, 77.5, 92.5, 107.5, cada una con su chimenea cerca del centro; los tensores sur terminan en `(cx ± 2, −31.2, 16.96)` (sobre el faldón norte, sin tocar la caja del sur). Test: "se pintan después del faldón norte que pisan".
- **D19 — `sortByDepth` sin arista para cajas separadas por dos planos opuestos, también sin giro (stage 4, captura).** Ya era la regla en el marco girado; sin giro la arista del desempate cerraba ciclos (muro alto → faldón → zócalo → tubo → muro) y el corte de ciclos tiraba relaciones reales: dos tramos del faldón salían debajo del muro alto. Geometría: si un plano deja a A del lado lejano y otro deja a B del lado lejano, ninguno tapa al otro, así que no hace falta orden. `sortByDepthNaive` del test sigue la misma regla. Test de escena: "el muro alto se pinta antes de cada tramo del faldón". Capturas de `plaza` y `gradas` sin cambios visibles.
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

- [ ] Tests (escritos en stage 3, commit `test(#213): evals`). Aserciones: dos prismas `brick` `x 44, y −46, w 76, d 30, h 7` en z 0 y 7 con `facade.cols` 11 y 22, `grid {3, 4}`, `head "flat"`, `courses {rust, 0.4}`; 12 prismas `rust` 0.5 × 0.5 en `y −16`, centros `44 + k·76/11`, cada uno con zapata `concrete` 0.9 × 0.9 × 0.6 a z 3.5, montante 0.15 y ménsula `beam`; 76 placas en `wall 2` y 30 en `wall 1` del prisma alto, `toneOffset −2`, z 12.8..13.6; zócalo `whitewash` `x 44, y −16, w 76, d 1.5, h 3.5` con `facade.cols` 20 y 20 cilindros r 0.3 h 0.8 alternando `whitewash`/`rust`; dos `ramp` `steel` con cumbrera z 17, remate `whitewash` y 4 caperuzas 1.2 × 1.2 × 0.8 a z 17; mínimo 0.15 (D16); en `factory.test.ts`: ninguna `ramp` `brick`, un prisma `brick` 24 × 30 × 18 en (20, −46), el portón `concrete` en `x 119.8..120.3, y −23..−17`. `npx vitest run src/scenes` → FAIL.
- [ ] Implementar `naveBody` y `boilerHouse` (que por ahora solo llama a `naveBody`); `plant()` = marcador `prism(20, −46, 0, 24, 30, 18, "brick")` + `boilerHouse(out)` + portón este de hoy. Quitar dientes, cornisa y portones sur. Docstring de `factory.ts`: "nave de calderas (Fábrica de Luz) y, al oeste, el marcador de la maltería".
- [ ] `npx vitest run src/scenes` → los tests de esta tarea PASS. Commit `feat(#213): cuerpo de la nave de calderas y marcador de la maltería`.

### Task 2: Testero, piñón y chimeneas metálicas

**Files:** Modify `src/scenes/boiler-house.ts`. Test: `boiler-house.test.ts`, `factory.test.ts`.

**Interfaces:**
- Consumes: `NAVE`. Produces: `gableEnd(out: Solid[]): void` (D5, D6), `metalStacks(out: Solid[]): void` (D10), `METAL_STACK_X`; `boilerHouse` los llama.

- [ ] Tests: "testero: marco whitewash y piñón escalonado…", "cuatro chimeneas metálicas con 4 tensores…", `factory.test.ts` "las chimeneas metálicas y sus tensores quedan dentro de la huella de la nave" y "ningún sólido de la nave supera z 20…". FAIL.
- [ ] Implementar. Como las chimeneas suben a 22.6, en esta tarea la caja de `planta` pasa a D15 (si no, `exhibits.test.ts` queda en rojo). PASS. Commit `feat(#213): testero con piñón escalonado y chimeneas metálicas`.

### Task 3: Torre de escalera, cinta inclinada y farol

**Files:** Modify `src/scenes/boiler-house.ts`, `src/scenes/factory.ts` (`lamps()`). Test: `boiler-house.test.ts`, `factory.test.ts`.

**Interfaces:**
- Produces: `stairTower(out: Solid[]): void` (D7), `inclineBelt(out: Solid[]): void` (D2), `STAIR_TOWER`; `boilerHouse` los llama.

- [ ] Tests: "torre de escalera…", "cinta inclinada…", `factory.test.ts` "la torre de escalera no toca…", "la cinta inclinada y su tolva no tocan…", "el zócalo no toca…". FAIL.
- [ ] Implementar; en `lamps()` el farol `(58, −16)` pasa a `(50, −13.5)`. PASS. Commit `feat(#213): torre de escalera y cinta inclinada con tolva`.

### Task 4: Exhibits y capturas

**Files:** Modify `src/lab/exhibits.ts`. Test: `src/lab/exhibits.test.ts` (sin cambios de lógica).

- [ ] Revisar la caja de `planta` (D15, puesta en la Tarea 2) con todo emitido; `cinta` (caja `x 28..125, y −15..4`, h 22) solo si su encuadre o sus vecinos fallan. `npx vitest run src/lab` PASS.
- [ ] `npm test` y `npm run typecheck` PASS.
- [ ] Capturas "después" de `planta` y `cinta` (1600 × 900, 2x) en `docs/superpowers/specs/assets/207-fabrica/<exhibit>-despues.png`; anotar caras del panel. Script `.scratch/evals-213.md`. Commit `feat(#213): cajas de los exhibits planta y cinta y capturas`.

## Assumptions

Ver D1–D17. Las que cambian valores del issue: D1 (pilastras fuera del muro, sobre el zócalo; alternativa rechazada: las coordenadas del issue, que las dejan dentro del muro e invisibles, contra "salientes del muro sur" del spec §5 y el criterio "se ven … pilastras con zapata y ménsula"), D2 (tolva fuera del muro y cinta desplazada 2 u al oeste en el arranque; alternativa rechazada: los extremos del issue, que tocan el mástil de la grúa contra el criterio "no tocan … grúa torre (mástil…)"), D3 (sin alero oeste; alternativa rechazada: `x 43.4`, que se mete 0.6 u en el marcador).

## Grilling

- Rondas: 1 (el plan no cambió de forma; se precisaron D1, D2, D8, D16, D17 y las aserciones de la Tarea 1, y la caja de `planta` pasó a la Tarea 2).
- Preguntas: 15. Fuentes: ISSUE 6, CODE 11, DOC 2 (algunas con más de una), NO SOURCE 4 → 3 supuestos técnicos (D8 predicado y partición, D16 medida de piezas, D17 lista de vecindades) y 1 fuera de alcance.
- Issue abierto: la pilastra `stockbrick` de la maltería en x 44 (decisión 9 de #207) cae sobre la pilastra k = 0 de la nave, su zapata y el arranque del zócalo: follow-up #223.
