# Planta, tanque de agua, playa de camiones y faroles trasladados (#246) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (`.agents/skills/subagent-driven-development/SKILL.md`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mudar la planta (maltería, nave, testero, torre de escalera, chimeneas metálicas, cinta inclinada y portón), el tanque de agua, la playa de camiones (camiones y pallets) y los cinco faroles de la planta al lugar de los galpones (`x 4..98.7, y −4..99`) con `translate` y `PLANT_SHIFT = (−15, +90)`.

**Architecture:** Igual que `substation.ts` (#244): cada módulo sigue escribiendo su geometría en el **marco local** (las coordenadas de antes de la mudanza) y traslada al emitir con un helper `emit(out, build)` que arma en un array local y empuja `translate(s, PLANT_SHIFT.x, PLANT_SHIFT.y)`. Todo lo exportado (constantes y sólidos de los builders) está en coordenadas de mundo; las constantes de mundo se **calculan** desde las locales + shift. `waterTower(out, at)` ya está centrado en `at`: solo cambia `WATER_TOWER`. En `factory.ts`, playa de camiones y faroles de la planta se arman en arrays locales (sólidos y acentos) y se emiten con `translate`/`translateAccent`.

**Tech Stack:** TypeScript estricto (`noUncheckedIndexedAccess`), Vitest. Sin dependencias nuevas.

**Spec:** issue #246 ("Qué hacer", "Reglas que hereda", criterios). Contexto: `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` §2.1, §2.2, §3.1, §3.4, §5 y el comentario de plan de #238 (decisiones 1, 3 y 6). Detalle de maltería, nave y tanque: `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` §5–§7 (no cambia). Precedente de la técnica: `docs/plans/2026-10-28-244-subestacion-traslado.md`.

## Global Constraints

- Rama base `feature/238-fabrica-mudanza`; el PR va contra esa rama.
- `src/scenes/plant-frame.ts`: `export const PLANT_SHIFT = { x: -15, y: 90 } as const`, con docstring: el marco local de la planta son las coordenadas del mundo antes de la mudanza (maltería x 20..44, nave x 44..107, torre x 108..113, y −46..−1); todo lo que se arma en ese marco se emite trasladado con `translate`.
- Constantes de mundo calculadas (no tipeadas): `MALT = { x: 5, y: 44, w: 24, d: 30, h: 18 }`, `WATER_TOWER = { x: 15, y: 32 }` (este sí es un lugar nuevo, no un traslado: el tanque va al norte de la maltería; se declara literal), `NAVE = { x: 29, y: 44, w: 63, d: 30, h: 14 }`, `STAIR_TOWER = { x0: 93, y0: 56, x1: 98, y1: 64 }`, `METAL_STACK_X = [36, 50, 64, 78]`, `PLANT = { x: 5, y: 44, w: 87, d: 30, h: 14 }` (sigue derivado de `MALT`/`NAVE`).
- Mundo esperado: portón x 91.8..92.3, y 67..73; camiones en (25, 78), (55, 84), (80, 78); pallets x 7..30, y 87..89; 7 faroles en (5, 76), (9, 77), (35, 76.5), (49, 77), (95, 87), (53, 12), (−30, 20).
- **No se trasladan:** el farol de la subestación `(SUBSTATION.x0 − 1, SUBSTATION.y1 + 1)`, el de (−30, 20), la grúa torre (60, −12), el desvío, `railYard`, la excavadora, chimeneas, torre de enfriamiento, subestación.
- Desplazamientos enteros; `translate` no redondea; comparaciones de contacto con tolerancia 1e-9.
- Sin solapes; todo sólido de la fábrica fuera de la columna oeste (`max.x ≤ 0`) y del desvío y la grúa (`min.y ≥ −13.1 ∧ max.y ≤ −6.7`) cumple `min.x ≥ 4`, `max.x ≤ 98.7`, `min.y ≥ −4`, `max.y ≤ 99`. Nada supera z 26 salvo lo esbelto (regla existente `tallOk`).
- Acentos de la fábrica `{amber 3, cyan 8, magenta 6}` sin cambios; siguen 7 faroles. `LABEL_AT`, zonas y velo no cambian.
- Detalle arquitectónico sin cambios: mismos sólidos, mismo orden de emisión, mismas medidas.
- Docstrings, comentarios y tests en castellano rioplatense.
- Los tests no usan literales de la posición vieja: se expresan con `MALT`, `NAVE`, `STAIR_TOWER`, `PLANT`, `WATER_TOWER`, `METAL_STACK_X`, `PLANT_SHIFT`, `BAY`.
- `npm test` y `npm run typecheck` verdes al cerrar el plan.

## Review Focus

1. **Doble traslado.** `boilerHouse()` junta los cinco builders exportados; si los llama dentro de otro `emit`, la nave cae en (−30, +180). `boilerHouse` llama a los exportados (cada uno traslada una vez) **o** a los locales con un único `emit`, nunca las dos cosas. Lo fija el test de traslado (Task 2) y "`build(boilerHouse)` es la concatenación de los cinco builders" (igualdad profunda, no solo de largo).
2. **Constantes de mundo usadas dentro del marco local.** Los cuerpos locales leen `MALT`, `NAVE`, `STAIR_TOWER`, `METAL_STACK_X`, `PLANT`; si un cuerpo local sigue leyendo la constante exportada (ahora de mundo) y después se traslada, esa pieza queda corrida dos veces. Cada cuerpo local usa la constante `*_LOCAL`. Lo fija la huella del test de traslado (Task 1, Task 2) y, en `factory.ts`, el test del portón (Task 3).
3. **Coma flotante.** `−16.4 + 90` y `0.4` no suman exactamente `74`: la pilastra de la maltería toca la zapata de la nave en y 74 con un ε. Los tests de contacto usan 1e-9; los de igualdad de coordenadas usan `toBeCloseTo(…, 9)` o `near`, no `toBe` sobre sumas.
4. **Vecinos del lugar nuevo.** Tanque (x 10.4..19.6, y 27.4..36.6) contra maltería, torre de enfriamiento y chimeneas; chimeneas (y ≤ 36.05) y torre de enfriamiento contra nave y maltería (alero norte en y 43.4); planta contra subestación (y ≤ 11); cinta y zócalo contra camiones, pallets y faroles; y ningún sólido elevado de otra escena del mundo dentro de la huella de la planta (Task 3).
5. **Encuadre de los exhibits.** `planta` {2, 41, 98, 76} h 26 no debe cortar nada más alto que 26 ni incluir el tanque; `playa-camiones` {2, 76, 98, 92} h 16 corta la tolva (z 13.5 < 16). Lo fijan "vecinos" y "encuadre" de `exhibits.test.ts` y los tests (#213)/(#214) re-expresados (Task 4).

---

### Task 1: `plant-frame.ts` y maltería en coordenadas de mundo

**Files:**
- Create: `src/scenes/plant-frame.ts`
- Modify: `src/scenes/maltings.ts`
- Test: `src/scenes/maltings.test.ts` (re-expresado en `test(#246): evals`)

**Interfaces:**
- Consumes: `translate(s: Solid, dx: number, dy: number): Solid` de `src/iso/translate.ts`.
- Produces: `PLANT_SHIFT: { readonly x: -15; readonly y: 90 }` (`plant-frame.ts`); `MALT` y `WATER_TOWER` en mundo; `maltings(out: Solid[]): void` emite en mundo; `waterTower(out: Solid[], at?: { x: number; y: number }): void` sin cambio de firma (default `WATER_TOWER`).

- [ ] **Step 1: Correr los tests y verlos fallar.** `npx vitest run src/scenes/maltings.test.ts` — Expected: FAIL (no existe `./plant-frame`; `MALT` en el lugar viejo).
- [ ] **Step 2: Implementar.**
  - `plant-frame.ts` con `PLANT_SHIFT` y su docstring (Global Constraints).
  - `maltings.ts`: `const MALT_LOCAL = { x: 20, y: -46, w: 24, d: 30, h: 18 } as const`; `export const MALT = { ...MALT_LOCAL, x: MALT_LOCAL.x + PLANT_SHIFT.x, y: MALT_LOCAL.y + PLANT_SHIFT.y } as const`; `export const WATER_TOWER = { x: 15, y: 32 } as const` (comentario: al norte de la maltería, x 10.4..19.6, y 27.4..36.6, tope z 24.7, asoma por encima del techo).
  - El cuerpo de hoy de `maltings` pasa a `function maltingsLocal(out: Solid[]): void` leyendo `MALT_LOCAL` (los literales del cuerpo quedan: son marco local). `export function maltings(out)` arma con `maltingsLocal` en un array local y empuja cada sólido trasladado `PLANT_SHIFT` (mismo orden).
  - Docstring del módulo: marco local `x 20..44, y −46..−16`, `PLANT_SHIFT (−15, +90)` → mundo `x 5..29, y 44..74`; tanque en `WATER_TOWER`; "todo lo exportado está en mundo".
- [ ] **Step 3: Verificar.** `npx vitest run src/scenes/maltings.test.ts` → PASS; `npm run typecheck` sin errores.
- [ ] **Step 4: Commit** `feat(#246): maltería en marco local trasladada con PLANT_SHIFT; tanque al norte`.

Tests que tiene que satisfacer (de evals): `MALT.x === 20 + PLANT_SHIFT.x` etc. y `MALT` = {5, 44, 24, 30, 18}; `WATER_TOWER` = {15, 32}; huella de `build(maltings)` trasladado por −`PLANT_SHIFT` igual a la de hoy (capturada antes de tocar código); todos los tests de hoy re-expresados con `MALT` (p. ej. pilastras en `MALT.y + MALT.d − 0.4`, rampas en `MALT.x + 6k`, horno en `MALT.x + 2`, cono en `(MALT.x + 5, MALT.y + 3)`); escalera del tanque en `(WATER_TOWER.x + 4.5, WATER_TOWER.y + 4.5)`.

### Task 2: nave de calderas en coordenadas de mundo

**Files:**
- Modify: `src/scenes/boiler-house.ts`
- Test: `src/scenes/boiler-house.test.ts` (re-expresado en evals)

**Interfaces:**
- Consumes: `PLANT_SHIFT` (Task 1), `translate`.
- Produces (mismas firmas que hoy, ahora en mundo): `BAYS`, `BAY` (sin cambio), `NAVE`, `STAIR_TOWER`, `METAL_STACK_X: readonly number[]`; `naveBody`, `gableEnd`, `metalStacks`, `stairTower`, `inclineBelt`, `boilerHouse`, todos `(out: Solid[]) => void`.

- [ ] **Step 1: Correr y ver fallar.** `npx vitest run src/scenes/boiler-house.test.ts` — Expected: FAIL (`NAVE` en el lugar viejo; huella).
- [ ] **Step 2: Implementar.**
  - Locales privadas: `NAVE_LOCAL = { x: 44, y: -46, w: BAYS * BAY, d: 30, h: 14 }`, `E` local, `STAIR_TOWER_LOCAL = { x0: E + 1, y0: -34, x1: E + 6, y1: -26 }`, `METAL_STACK_X_LOCAL`. Exportadas = locales + `PLANT_SHIFT`, calculadas.
  - `const emit = (out: Solid[], build: (o: Solid[]) => void): void` como en `substation.ts`.
  - Los cinco cuerpos de hoy pasan a privados `*Local` leyendo las locales; cada exportado es `emit(out, *Local)`. `boilerHouse(out)` llama a los cinco exportados en el orden de hoy (sin `emit` propio).
  - Docstring: marco local `x 44..107` (torre a 113), `y −46..−16` (zócalo y cinta hasta y −1); mundo `x 29..92`, torre `93..98`, `y 44..74`; todo lo exportado en mundo.
- [ ] **Step 3: Verificar.** `npx vitest run src/scenes/boiler-house.test.ts` → PASS; `npm run typecheck`.
- [ ] **Step 4: Commit** `feat(#246): nave de calderas en marco local trasladada con PLANT_SHIFT`.

Tests que tiene que satisfacer (de evals): `NAVE`, `STAIR_TOWER`, `METAL_STACK_X` con los valores de mundo y como local + `PLANT_SHIFT`; huella de `build(boilerHouse)` trasladado por −`PLANT_SHIFT` igual a la de hoy; `build(boilerHouse)` igual (profundo) a la concatenación de los cinco builders; los tests de hoy re-expresados (zócalo en `NAVE.y + NAVE.d`, tubos en y `NAVE.y + NAVE.d + 1.2`, faldón norte desde `NAVE.y − 0.6`, cinta de `(NAVE.x + 6, NAVE.y + NAVE.d + 12, 0.5)` a la tolva en `(NAVE.x + 14.2, NAVE.y + NAVE.d)`).

### Task 3: portón, playa de camiones y faroles trasladados; vecinos y regla de la región

**Files:**
- Modify: `src/scenes/factory.ts` (`plant`, `truckYard`, `lamps`, docstring)
- Test: `src/scenes/factory.test.ts`, `src/scenes/world.test.ts` (re-expresados y tests nuevos en evals)

**Interfaces:**
- Consumes: `PLANT_SHIFT` (Task 1), `MALT`, `WATER_TOWER`, `NAVE` en mundo (Tasks 1–2), `translate`, `translateAccent`.
- Produces: `PLANT` (sin cambio de fórmula; ahora {5, 44, 87, 30, 14}); `factory(rng)` con la misma forma.

- [ ] **Step 1: Correr y ver fallar.** `npx vitest run src/scenes/factory.test.ts src/scenes/world.test.ts` — Expected: FAIL en portón, camiones, pallets, faroles, vecinos y región.
- [ ] **Step 2: Implementar.**
  - `plant()`: `maltings`, `waterTower(out)` (default `WATER_TOWER`), `boilerHouse`, y el portón armado en local (`prism(PLANT_LOCAL_E − 0.2, −23, 0, 0.5, 6, 8)` con `PLANT_LOCAL_E = PLANT.x + PLANT.w − PLANT_SHIFT.x`) empujado con `translate`. Mismo orden de emisión.
  - `truckYard()`: arma camiones, pallets y sus dos faroles en arrays locales (`Solid[]`, `Accent[]`) con los literales de hoy y empuja `translate` / `translateAccent` con `PLANT_SHIFT`.
  - `lamps()`: los tres faroles de la planta ((24, −13), (64, −13), (50, −13.5)) en arrays locales trasladados igual; el de la subestación y el de (−30, 20) se emiten directo. Mismo orden de faroles que hoy.
  - Un helper privado `emitPlant(out: Solid[], accents: Accent[], build: (o: Solid[], a: Accent[]) => void): void` para no repetir el traslado tres veces.
  - Docstring del módulo: la planta, el tanque, la playa de camiones y sus faroles en la región nueva (`PLANT_SHIFT` de `plant-frame.ts`); en la banda vieja quedan solo el desvío y la grúa torre.
- [ ] **Step 3: Verificar.** `npx vitest run src/scenes/factory.test.ts src/scenes/world.test.ts src/scenes/portfolio-accents.test.ts` → PASS; `npm run typecheck`.
- [ ] **Step 4: Commit** `feat(#246): portón, playa de camiones y faroles de la planta trasladados`.

Tests que tiene que satisfacer (de evals): portón en x 91.8..92.3, y 67..73 (y como `PLANT.x + PLANT.w − 0.2`); camiones, pallets y faroles en mundo (Global Constraints); acentos `{amber 3, cyan 8, magenta 6}`; "el farol de (58, −16) pasa a (50, −13.5)" en mundo (35, 76.5); vecinos (a)–(e) del issue (tanque ↔ maltería, torre de enfriamiento y chimeneas; chimeneas y torre de enfriamiento ↔ nave y maltería, con toda pieza de chimenea en `max.y < NAVE.y − 0.6`; planta ↔ subestación; cinta y zócalo ↔ camiones, pallets y faroles; región de tres cláusulas); filtro del test painter del muro alto calculado con `PLANT`/`STAIR_TOWER`; en `world.test.ts`, la regla de tres cláusulas y "ningún sólido elevado de otra escena entra a la huella de la planta ni a la playa de camiones".

### Task 4: exhibits `planta` y `playa-camiones`, capturas después

**Files:**
- Modify: `src/lab/exhibits.ts:69-71` (`planta`), `:78-83` (comentario de `subestacion`, `playa-camiones`)
- Test: `src/lab/exhibits.test.ts` (re-expresado en evals)
- Create: `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/{planta,playa-camiones,mundo-planta}-despues.png` (las `-antes.png` se toman en el stage de evals, antes de tocar código)

**Interfaces:**
- Consumes: `PLANT`, `STAIR_TOWER` en mundo.

- [ ] **Step 1: Correr y ver fallar.** `npx vitest run src/lab/exhibits.test.ts` — Expected: FAIL en "(#214)" y en la caja de `playa-camiones`.
- [ ] **Step 2: Implementar.** `planta`: `box: { x0: PLANT.x - M, y0: PLANT.y - M, x1: STAIR_TOWER.x1, y1: PLANT.y + PLANT.d + 2 }`, `h: 26`, título `"Nave de calderas y maltería"`, comentario: {2, 41, 98, 76}; zócalo y tolva adentro, faroles y camiones afuera; chimeneas (y ≤ 36.05) y tanque (y ≤ 36.6) afuera por el norte; h 26 por el vértice del horno. `playa-camiones`: `box: { x0: 2, y0: 76, x1: 98, y1: 92 }`, `h: 16`, comentario: la tolva (z 13.5) cruza el borde norte; el caballete más alto adentro llega a 8.3; la grúa ya no está. Quitar el "Transitorio (#238)" del comentario de `subestacion` (la cinta y el camión ya no entran). `tanque-agua` no cambia.
- [ ] **Step 3: Verificar.** `npx vitest run src/lab/exhibits.test.ts` → PASS; después `npm test` y `npm run typecheck` verdes.
- [ ] **Step 4: Capturas después** de `/lab/storybook.html?speed=0#planta`, `#playa-camiones` y `/lab/world.html` (tecla `1`) a 1600×900 escala 2 (CLAUDE.md), con el conteo de caras del panel.
- [ ] **Step 5: Commit** `feat(#246): exhibits planta y playa de camiones en el lugar nuevo; capturas después`.

## Assumptions

- **Test de traslado por huella**, como en #244: `fingerprint` (FNV-1a de 32 bits sobre el JSON con números redondeados a 1e-6) de `build(maltings)` / `build(boilerHouse)` trasladados por (+15, −90) igual a la huella de hoy, capturada en el stage 3 antes de tocar código. Más cantidad de sólidos y anclas legibles. Alternativa descartada: exportar los builders locales (contra "todo lo exportado en mundo").
- **`WATER_TOWER` literal:** el issue fija (15, 32) como lugar nuevo, no como traslado de (10, −36) (que caería en (−5, 54), fuera de la región). Se declara literal con comentario.
- **Commits intermedios rojos.** Los tests re-expresados se commitean fallando en `test(#246): evals`; entre Task 1 y Task 3 los tests de `factory.test.ts` siguen rojos (planta a medio mudar). El PR se squashea y lo que se mergea está verde.
- **Test de vecindad entre escenas** (`world.test.ts`): ningún sólido elevado de otra escena entra a la huella `PLANT` ni a la playa {2, 76, 98, 92}; misma forma que el test de la subestación (#244).
- **Capturas.** Si agent-browser no levanta, el commit sale sin PNG y el PR lo marca como verificación manual pendiente.
