# Subestación trasladada a x 54..95, y −2..11 (#244) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (`.agents/skills/subagent-driven-development/SKILL.md`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mudar la subestación entera (patio, cordón, pórticos, fases, seccionadores, TI, transformadores, cortafuego, puentes, caseta, cerco y portón) de `x 149..190, y −60..−47` a `x 54..95, y −2..11`, contra el desvío, con `translate`, y llevar su farol a (53, 12).

**Architecture:** `substation.ts` conserva su geometría en el **marco local** (las coordenadas de hoy) y traslada al emitir: un helper `emit(out, build)` arma en un array local y empuja `translate(s, SUBSTATION_SHIFT.x, SUBSTATION_SHIFT.y)`. Todo lo exportado (constantes y sólidos de los builders) queda en coordenadas de mundo. `factory.ts` deriva el farol de `SUBSTATION`. Los tests se re-expresan con las constantes exportadas (stage de evals, antes de este código).

**Tech Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** issue #244 ("Qué hacer", "Reglas que hereda", criterios). Contexto: `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` §2.2, §3.1, §3.4 y el comentario de plan de #238 (decisiones 1 y 3). Detalle de la subestación: `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` §9 (no cambia).

## Global Constraints

- Rama base `feature/238-fabrica-mudanza`; el PR va contra esa rama.
- `export const SUBSTATION_SHIFT = { x: -95, y: 58 } as const` en `src/scenes/substation.ts`. Desplazamientos enteros; `translate` (de `src/iso/translate.ts`) no redondea; las comparaciones de contacto admiten 1e-9.
- Constantes exportadas en mundo, **calculadas** desde las locales + shift (no tipeadas): `SUBSTATION = { x0: 54, x1: 95, y0: -2, y1: 11 }`, `PHASES_Y = [1, 4.5, 8]`, `TRANSFORMERS_Y = [-1, 5]`, `FIREWALL = { x: 76.5, y: 3.7, w: 7, d: 0.6, h: 5.5 }`.
- Todo lo exportado por un módulo de escena está en coordenadas de mundo; el marco local queda documentado en el docstring.
- Sin solapes; x ≤ 98.7 para todo lo de más de 7 de alto; y ≥ −4. Acentos de la fábrica `{amber 3, cyan 8, magenta 6}` sin cambios (`portfolio-accents.test.ts` no se toca). Siguen 7 faroles.
- El inventario de §9 del spec de 2026-10-24 no cambia: mismos sólidos, mismo orden, mismas medidas.
- Docstrings, comentarios y tests en castellano rioplatense.
- `npm test` y `npm run typecheck` verdes al cerrar el plan.

## Review Focus

1. **Doble traslado.** `substation()` llama a los sub-builders; si llama a los exportados (que ya trasladan) dentro de un `emit`, la subestación cae en (−190, +116). `substation()` usa las versiones locales y traslada una sola vez. Lo fija el test de traslado (Task 1).
2. **Parámetro en mundo, cuerpo en local.** `powerTransformer(out, y0)`, `latticePortal(out, x)`, `disconnector(out, y)`, `currentTransformer(out, y)` reciben mundo y restan el shift adentro; `droppers`/`phases` iteran `PHASES_Y`/`TRANSFORMERS_Y` **locales**. Un sub-builder llamado con una constante de mundo tiene que caer adentro del cerco de mundo (Task 1, tests de seccionador/TI/transformador con `PHASES_Y[k]` y `TRANSFORMERS_Y[k]`).
3. **Coma flotante.** `157.1 − 95` no es exactamente `62.1`: en los tests, conjuntos de x se comparan redondeados (o con `near`), no con `toEqual` sobre `Set` de literales; las cajas con 1e-9 (Task 1, tests de evals).
4. **Vecinos del lugar nuevo.** Desvío (strips planos, no cuentan), vagones (y ≤ −6.8), locomotora (y ≤ −6.7), grúa torre en (60, −12), pallets (x 22..45), camión de (70, −6) (y −6..−3.6) y faroles, en especial el propio (53, 12): ningún sólido no plano de la subestación toca otro sólido no plano de `factory()` (Task 1 y Task 2).
5. **Encuadre del exhibit.** La caja `subestacion` pasa a {51, −5, 98, 12} h 13: no debe cortar un vecino más alto que 13 (la pluma de la grúa está a z 19 pero en y ≈ −12, afuera) ni cruzar x 99 (`calle-faroles`). Lo fija `exhibits.test.ts` "vecinos" y "encuadre" (Task 2).

---

### Task 1: `substation.ts` emite en coordenadas de mundo

**Files:**
- Modify: `src/scenes/substation.ts`
- Test: `src/scenes/factory.test.ts` (describe "subestación de intemperie (#215)", re-expresado en `test(#244): evals`)

**Interfaces:**
- Consumes: `translate(s: Solid, dx: number, dy: number): Solid` de `src/iso/translate.ts`.
- Produces (mismas firmas que hoy, ahora en mundo): `SUBSTATION_SHIFT`, `SUBSTATION`, `PHASES_Y`, `TRANSFORMERS_Y`, `FIREWALL`; `powerTransformer(out: Solid[], y0: number, southBank: boolean): void`, `latticePortal(out: Solid[], x: number): void`, `phases(out: Solid[]): void`, `disconnector(out: Solid[], y: number): void`, `currentTransformer(out: Solid[], y: number): void`, `droppers(out: Solid[]): void`, `fence(out: Solid[]): void`, `substation(out: Solid[]): void`.

- [ ] **Step 1: Correr los tests y verlos fallar.** Run: `npx vitest run src/scenes/factory.test.ts -t "subestación"` — Expected: FAIL (`SUBSTATION_SHIFT` no exportado; cerco y piezas en el lugar viejo).
- [ ] **Step 2: Implementar.**
  - Constantes locales privadas con los valores de hoy (`LOCAL = { x0: 149, x1: 190, y0: -60, y1: -47 }`, `PHASES_LOCAL`, `TRANSFORMERS_LOCAL`, `FIREWALL_LOCAL`); exportadas = locales + shift, calculadas (`PHASES_Y = PHASES_LOCAL.map(y => y + SUBSTATION_SHIFT.y)` con tipo `readonly number[]` de 3 si `.map` pierde la tupla; los tests indexan `[0..2]`).
  - `const emit = (out: Solid[], build: (o: Solid[]) => void): void` — arma en un array local y empuja cada sólido trasladado.
  - Cada builder de hoy pasa a una función privada en marco local (mismo cuerpo, constantes locales). Cada exportado es `emit(out, (o) => local(o, param − shift))`. `substation()` arma todo con las locales y hace **un solo** `emit`; el orden de emisión (patio `sand`, cordón `concrete`, pórticos, …, cerco) no cambia.
  - Docstring del módulo: marco local `x 149..190, y −60..−47`, `SUBSTATION_SHIFT (−95, +58)`, lugar nuevo `x 54..95, y −2..11` contra el desvío, "todo lo exportado está en mundo". Docstring de `phases`: "de `SUBSTATION.x0 + 2.5` a `SUBSTATION.x1 − 3.5`" en lugar de 151.5→186.5.
- [ ] **Step 3: Verificar.** `npx vitest run src/scenes/factory.test.ts -t "subestación"` → PASS; `npm run typecheck` sin errores.
- [ ] **Step 4: Commit** `feat(#244): subestación en marco local trasladada con SUBSTATION_SHIFT`.

Tests que tiene que satisfacer (de evals): todo sólido no plano en `SUBSTATION` y z 0..12; "es la subestación de hoy trasladada" (el sólido i de `build(substation)` trasladado por −shift tiene las mismas cajas que el inventario local de hoy, fijado por una huella); patio y cordón en `scene.ground` en ese orden; los conteos de hoy (13 postes, 26 diagonales, portón, caseta, pórticos, fases, seccionadores, TI, transformadores, cortafuego, puentes, mínimo 0.15, unidades apartadas) re-expresados con las constantes; `min.y ≥ −4`, `max.x ≤ 98.7`.

### Task 2: farol en (53, 12), vecinos, regla de `world.test.ts`, exhibit y capturas

**Files:**
- Modify: `src/scenes/factory.ts:130` (`lamps()`), `src/lab/exhibits.ts:79` (comentario de `subestacion`)
- Test: `src/scenes/factory.test.ts` (vecinos, chimeneas), `src/scenes/world.test.ts:93`, `src/lab/exhibits.test.ts` (ya re-expresados en evals)
- Create: `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/subestacion-despues.png` (la `-antes.png` se toma en el stage de evals, antes de tocar código)

**Interfaces:**
- Consumes: `SUBSTATION` (mundo) de Task 1.

- [ ] **Step 1: Correr y ver fallar.** `npx vitest run src/scenes/factory.test.ts src/scenes/world.test.ts src/lab/exhibits.test.ts` — Expected: FAIL en "farol en (53, 12)" y "no toca ningún otro sólido de la fábrica" (el farol viejo en (148, −46)).
- [ ] **Step 2: Implementar.** En `lamps()` reemplazar `[148, -46]` por `[SUBSTATION.x0 - 1, SUBSTATION.y1 + 1]` (importar `SUBSTATION`), con comentario "farol de la subestación: esquina SO del cerco". Comentario del exhibit `subestacion`: la fórmula queda en {51, −5, 98, 12}, no toca los vagones (y ≤ −6.8) ni cruza x 99 (`calle-faroles`); h 13 por los mástiles (z 12).
- [ ] **Step 3: Verificar.** Los cuatro archivos (`factory`, `world`, `exhibits`, `portfolio-accents`) PASS; `npm test` y `npm run typecheck` verdes.
- [ ] **Step 4: Captura** de `/lab/storybook.html?speed=0#subestacion` a 1600×900 escala 2 (ver CLAUDE.md) en `subestacion-despues.png`.
- [ ] **Step 5: Commit** `feat(#244): farol de la subestación en (53, 12); exhibit y captura después`.

## Assumptions

- **Test de traslado por huella.** Para fijar "es la de hoy trasladada" sin dejar una copia del marco local exportada, el test traslada cada sólido de `build(substation)` por (+95, −58), serializa con números redondeados a 1e-6 y compara su huella (FNV-1a de 32 bits sobre el JSON) con la de hoy, capturada antes de tocar código. Además compara cantidad de sólidos y un puñado de anclas legibles (caseta, cubas, cortafuego, pilares del portón) contra los literales viejos más el shift, en un solo lugar. Alternativa descartada: exportar `substationLocal` (expone el marco local, contra la regla "todo lo exportado en mundo").
- **El test "no toca la torre de enfriamiento, el pedestal de la tercera chimenea ni el farol de (148, −46)"** se reemplaza por el test de vecinos nuevo, que los cubre (todo sólido no plano de `factory()` fuera de la subestación) y además exige el farol en (53, 12).
- **Identificar la subestación dentro de `factory()`:** por igualdad estructural (JSON) contra `build(substation)` no planos; lo demás son "otros".
- **Commit intermedio rojo.** Los tests re-expresados se commitean fallando en `test(#244): evals`, y la Task 1 deja rojo el test de vecinos hasta la Task 2. El PR se squashea y lo que se mergea está verde.
- **Capturas.** Si agent-browser no levanta, el commit sale sin PNG y el PR lo marca como verificación manual pendiente.
