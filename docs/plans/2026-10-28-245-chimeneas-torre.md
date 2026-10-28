# Chimeneas y torre de enfriamiento detrás del lugar nuevo de la nave (#245) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (`.agents/skills/subagent-driven-development/SKILL.md`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar las tres chimeneas (`STACKS`) a (58, 32), (72, 26), (86, 32) y la torre de enfriamiento (`COOLING`, ahora exportada) a (40, 14) r 9, al norte del faldón norte de la nave futura (y 43.4), y reencuadrar el exhibit `chimeneas` desde esas constantes.

**Architecture:** `chimney(s, …)` y `coolingTower()` ya reciben su posición: solo cambian las constantes de `src/scenes/factory.ts` (sin `translate`). La boca sale de `chimney` y el humo (`factory-anim.ts`) la toma de `scene.stacks`, así que sigue solo. El exhibit `chimeneas` en `src/lab/exhibits.ts` deriva su caja de `STACKS`, `COOLING` y `PUFF_RANGE`.

**Tech Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** issue #245 ("Qué hacer", "Reglas que hereda", criterios). Contexto: `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` §2.2, §3.3, §3.4 y el comentario de plan de #238 (decisión 3). Detalle de las chimeneas: `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` §8 (no cambia).

## Global Constraints

- Rama base `feature/238-fabrica-mudanza`; el PR va contra esa rama.
- `STACKS = [{ x: 58, y: 32, r: 2.8, h: 22 }, { x: 72, y: 26, r: 2.6, h: 26 }, { x: 86, y: 32, r: 2.4, h: 24 }]`; bocas `(58, 32, 25)`, `(72, 26, 29)`, `(86, 32, 27)`. `STACK_BASE_H = 3` no cambia.
- `export const COOLING = { x: 40, y: 14, r: 9 } as const` en `factory.ts` (x 31..49, y 5..23); `coolingTower()` usa `COOLING.r` para el cilindro de abajo (r 9) y los demás radios (8, 7, 7.5) siguen.
- Sin solapes, tolerancia 1e-9; x ≤ 98.7 para todo lo de más de 7 de alto; y ≥ −4.
- Acentos de la fábrica `{amber 3, cyan 8, magenta 6}` sin cambios (`portfolio-accents.test.ts` no se toca): siguen las 6 luces magenta.
- El inventario de §8 del spec de 2026-10-24 no cambia (`chimney` no se toca por dentro). `factory-anim.ts` y `factory-anim.test.ts` no cambian.
- `src/lab/exhibits.ts` ya importa un `COOLING` de `hinterland.ts` (la central térmica): el de la fábrica entra con alias (`COOLING as FACTORY_COOLING`).
- Comentarios, docstrings y tests en castellano rioplatense.
- `npm test` y `npm run typecheck` verdes al cerrar el plan.

## Review Focus

1. **Alias del import.** Si `exhibits.ts` importa `COOLING` de `factory` sin alias, choca con el de `hinterland` y el exhibit `central-termica` usaría la torre equivocada (o el typecheck falla). Lo fija el test de la caja (`x0 = 28`) y `central-termica` sin cambios en `exhibits.test.ts` (Task 2).
2. **Humo fuera de cuadro.** El humo deriva al NNE `(0.45, −0.893)` con un seno lateral de 1.5 y crece hasta r 3: la caja tiene que contener el cilindro entero de cada bocanada, no solo su centro (Task 2, test de una vuelta con `bounds`).
3. **Vecinos dentro de la región nueva.** Subestación (x 54..95, y −2..11), farol (53, 12), pallets (y −3..−1), desvío y camiones (y ≤ −3.6), grúa torre (60, −12): ningún sólido de chimeneas o torre los toca (Task 1, test de no contacto con `slices` para las vigas).
4. **"Vecinos" del exhibit.** La caja nueva {≈28, −4.8, 104.8, 39} h 36 corta la calle de transferencia (x ≥ 100) y el borde sur (pallets, camión de (70, −6)): ningún sólido cortado puede pasar de h 36. Lo fija el test existente "vecinos" del grupo `fabrica` (Task 2).
5. **Encuadre.** `h = stackTop + PUFF_RANGE·PUFF_LIFT = 36` no debe sobrar más de `SLACK` sobre lo de adentro + humo; el test "encuadre" ya lo mide (Task 2).

---

### Task 1: chimeneas y torre de enfriamiento en su lugar nuevo

**Files:**
- Modify: `src/scenes/factory.ts` (constantes `STACKS`, `COOLING`; `coolingTower()`; docstring del módulo)
- Test: `src/scenes/factory.test.ts` (escrito en el stage de evals, `test(#245): evals`)

**Interfaces:**
- Produces: `STACKS` (valores de arriba), `export const COOLING: { readonly x: 40; readonly y: 14; readonly r: 9 }`. `chimney`, `Stack`, `STACK_BASE_H`, `scene.stacks` sin cambio de firma.

- [ ] **Step 1: Correr los tests y verlos fallar.** `npx vitest run src/scenes/factory.test.ts` — Expected: FAIL en "cajas de chimeneas y torre", "no tocan otro sólido de la fábrica" y "la torre de escalera no toca ninguna chimenea" si aplica; `COOLING` no exportado.
- [ ] **Step 2: Implementar.** Cambiar `STACKS`; `COOLING` pasa a `export const COOLING = { x: 40, y: 14, r: 9 } as const`; `coolingTower()` usa `[COOLING.r, 8, 7, 7.5]`. Docstring del módulo: las chimeneas y la torre ya están en la región nueva (al norte del lugar de la nave, y 43.4), mudanza de #238.
- [ ] **Step 3: Verificar.** `npx vitest run src/scenes/factory.test.ts src/scenes/factory-anim.test.ts src/scenes/world.test.ts src/scenes/portfolio-accents.test.ts` → PASS; `npm run typecheck` limpio.
- [ ] **Step 4: Commit** `feat(#245): chimeneas y torre de enfriamiento detrás del lugar de la nave`.

Tests que tiene que satisfacer (de evals, en `factory.test.ts`):
- Los `describe.each(STACKS)` "chimenea %i" y "chimeneas vecinas" siguen (relativos a `st`); "ninguna pieza toca la torre de enfriamiento" y "ninguna pieza entra al cerco de la subestación" siguen.
- "la torre de escalera no toca ninguna chimenea" (reemplaza "… pedestal de la primera chimenea (x ≥ 126.5)"): `expectApart(build(stairTower), STACKS.flatMap((st) => one(st).out))`.
- Nuevo "chimeneas en x 54..90, y 22..36.1 y torre de enfriamiento en x 31..49, y 5..23 (COOLING exportado)": `expect(COOLING).toEqual({ x: 40, y: 14, r: 9 })`; `STACKS` igual a los tres literales; `bounds` de cada sólido de `one(st).out` dentro de `[54, 90] × [22, 36.1]` con 1e-9; los 4 cilindros de la torre (filtro `cylinder` `concrete` `r ≥ 7` en `scene().solids`) dentro de `[31, 49] × [5, 23]` y el de r 9 centrado en `(COOLING.x, COOLING.y)`.
- Nuevo "chimeneas y torre no tocan ningún otro sólido no plano de la fábrica": los sólidos propios se identifican por JSON contra `one(st).out` y el filtro de la torre; "otros" son el resto de `scene().solids` no planos (subestación, farol (53, 12), pallets, camiones, vagones, locomotora, grúa, planta, tanque); con `slices` en ambos lados, `apartBox` (1e-9) para todo par.
- "la planta …" (bocas `STACKS.forEach(s.stacks[i] === boca)`) sigue y además `expect(s.stacks).toEqual([{ x: 58, y: 32, z: 25 }, { x: 72, y: 26, z: 29 }, { x: 86, y: 32, z: 27 }])`.

### Task 2: exhibit `chimeneas` derivado de `STACKS` y `COOLING`, y captura

**Files:**
- Modify: `src/lab/exhibits.ts:73-78` (exhibit `chimeneas`), `src/lab/exhibits.ts:69` (comentario de `planta`: el pedestal queda afuera por y)
- Test: `src/lab/exhibits.test.ts` (escrito en evals)
- Create: `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/chimeneas-despues.png` (la `-antes.png` se toma en el stage de evals, antes de tocar código)

**Interfaces:**
- Consumes: `STACKS`, `COOLING` de Task 1; `PUFF_RANGE`, `PUFF_LIFT` de `factory-anim.ts`.

- [ ] **Step 1: Correr y ver fallar.** `npx vitest run src/lab/exhibits.test.ts` — Expected: FAIL en "caja de las chimeneas (#245)".
- [ ] **Step 2: Implementar.** `import { COOLING as FACTORY_COOLING, … } from "../scenes/factory"`. Caja: `{ x0: FACTORY_COOLING.x − FACTORY_COOLING.r − M, y0: min(stacksY) − stackR − PUFF_RANGE, x1: max(stacksX) + stackR + M + 13, y1: max(stacksY) + stackR + 1.2 + M }`, `h` igual. Comentario: el humo deriva 0.45·`PUFF_RANGE` ≈ 12.6 al este (de ahí los 13), la plataforma sobresale 1.2 al sur, la subestación y su farol quedan adentro, detrás; sin el literal de la torre. Comentario de `planta`: el pedestal de las chimeneas queda afuera por y (arranca en y 22).
- [ ] **Step 3: Verificar.** `npx vitest run src/lab/exhibits.test.ts` → PASS; `npm test` y `npm run typecheck` verdes.
- [ ] **Step 4: Captura** de `/lab/storybook.html?speed=0#chimeneas` a 1600×900 escala 2 (ver CLAUDE.md) en `chimeneas-despues.png`: tres chimeneas con bandas, la torre al oeste y el humo saliendo de las bocas.
- [ ] **Step 5: Commit** `feat(#245): exhibit chimeneas derivado de STACKS y COOLING; captura después`.

Tests que tiene que satisfacer (de evals, en `exhibits.test.ts`):
- Nuevo "caja de las chimeneas (#245)": la caja es `{ x0: 28, y0: 26 − 2.8 − 28, x1: 86 + 2.8 + 3 + 13, y1: 32 + 2.8 + 1.2 + 3 }` (con `toBeCloseTo`) y `h = 29 + 28·0.25 = 36`.
- Nuevo "ninguna bocanada sale de la caja de chimeneas en una vuelta": `createFactoryAnim(scene.stacks, createRng(1), { reducedMotion: false })` sobre `factory(createRng(7)).stacks`, 1213 ticks de 33 ms (≈ 40 s), y en cada tick `bounds` de cada `puffs(k)` dentro de la caja en x/y.
- La aserción "pedestal fuera de `planta`" sigue (ahora por y); "vecinos", "encuadre" y "no-vacío" del grupo `fabrica` en verde.

## Assumptions

- **Torre identificada por forma.** `coolingTower()` sigue privada: los tests toman sus 4 cilindros con el filtro de hoy (`cylinder`, `concrete`, `r ≥ 7`), que ya usa el test "ninguna pieza toca la torre". No se exporta el builder (YAGNI).
- **"Caja" del humo con `bounds`.** "Ninguna bocanada sale de la caja en x/y" se lee con el cilindro entero (`bounds`), más exigente que el centro.
- **Capturas.** La de antes se toma en el stage 3 con el código de la rama base; si agent-browser no levanta, el PR lo marca como verificación manual pendiente.
- **Commit intermedio rojo.** Los tests se commitean fallando en `test(#245): evals`; el PR se squashea y lo que se mergea está verde.
- **Margen del humo.** Una bocanada llega como mucho a `dist = PUFF_RANGE` sobre el eje NNE `(0.45, −0.893)` más un seno lateral ≤ `PUFF_SIDE` 1.5 sobre `PERP = (0.893, 0.45)`, con radio ≤ `PUFF_R1` 3 (`factory-anim.ts:13-20,34-37`): x máx = 86 + 12.6 + 1.34 + 3 = 102.94 < 104.8; y mín = 26 − 25.0 − 0.68 − 3 = −2.68 > −4.8; x mín = 58 − 1.34 − 3 = 53.66 > 28. Los 13 del issue sobran ~1.9 u. El test de una vuelta lo muestrea; la cota es analítica.
- **40 s es más de una vuelta.** Cada bocanada recorre `PUFF_RANGE` a `PUFF_SPEED · speed` con `speed ∈ [0.8, 1.2)` (`factory-anim.ts:15,27`): a lo sumo 28 / 0.0016 = 17.5 s; el seno tiene período `PUFF_PERIOD_MS` 2.5 s. 40 s cubre más de dos recorridos completos de cada bocanada. La semilla 1 es la que usan los tests de `factory-anim.test.ts:10`; la cota no depende de la semilla.

## Grilling

- 1 ronda, 17 preguntas. El plan no cambió de forma; se agregaron dos supuestos (margen del humo, 40 s).
- Fuentes: ISSUE 4, CODE 11, DOC 0, NO SOURCE 2 (supuestos técnicos).
- Respuestas:
  1. CODE `src/scenes/factory-anim.ts:13,15` exporta `PUFF_RANGE` y `PUFF_LIFT`; `:25` `createFactoryAnim(stacks: readonly Vec3[], rng, opts): FactoryAnim`; `:39` `puffs(k)` devuelve `Solid[]` (cilindros `concrete`), aptos para `bounds`. `factory-anim.test.ts:4,10` ya lo llama así.
  2. CODE `src/scenes/maltings.ts:57`: los cilindros del tanque son `steel`. CODE `factory.test.ts:94` y `:359` ya filtran la torre por `cylinder`+`concrete`+`r ≥ 7` y asertan `toHaveLength(4)`.
  3. CODE `src/scenes/pieces.ts:20-28`: toda pieza de la grúa queda en `y − 1 .. y + 1` (mástil 59.4..60.6 × −12.6..−11.4, h 20; pluma y −12.5..−11.5, z 19..19.8): con `at.y = −12` (`factory.ts`, `towerCrane(... at { x: 60, y: -12 })`) ninguna llega a y −4.8.
  4. CODE `src/lab/exhibits.ts:49`: `stackR = Math.max(...STACKS.map((s) => s.r))` = 2.8. ISSUE: "`y0: min(stacksY) − stackR − PUFF_RANGE`" — se conserva la fórmula de hoy; el test fija el número que da.
  5. CODE `src/scenes/factory-anim.ts:18-19,34-37` (`NNE`, `PERP`, `PUFF_SIDE`, `PUFF_R1`). Aritmética en Assumptions ("Margen del humo"): 102.94 < 104.8. ISSUE: "los 13 de más al este son por el humo, que deriva 0.45·28 ≈ 12.6 al este".
  6. NO SOURCE → supuesto técnico ("40 s es más de una vuelta"). ISSUE: "en una vuelta de `createFactoryAnim(scene.stacks, …)` (p. ej. 40 s a 33 ms)".
  7. CODE `src/scenes/factory.ts`: `function coolingTower(out: Solid[])` lee el `COOLING` privado (`const COOLING = { x: 172, y: -36 }`) y el literal 9 está en `for (const r of [9, 8, 7, 7.5])`.
  8. CODE `src/scenes/factory.test.ts`: `build` :22, `slices` :25, `expectApart` :34, `one` :213, `apartBox` :402 (con 1e-9), `stairTower` importado en :9 de `boiler-house`. Nada que crear.
  9. CODE `factory.ts` `chimney`: plataforma `cyl(dz, s.r + 1.2, …)` es lo más ancho en x; al sur la escalera en `ly = s.y + (s.r + 1.2)·cos(π/8) + 0.2` con postes de 0.15 → 32 + 3.696 + 0.2 + 0.15 = 36.046. ISSUE: "escaleras hasta y 36.05" y "todo sólido de las chimeneas cae en x 54..90, y 22..36.1".
  10. CODE `factory.test.ts:369-375`: para cada par de chimeneas, toda pieza de una `apart` de toda pieza de la otra (sin distancias fijas). Pedestales nuevos x 54.5..61.5 / 68.5..75.5 / 82.5..89.5: disjuntos en x. ISSUE: "los `describe.each(STACKS)` y "chimeneas vecinas" siguen (relativos)".
  11. ISSUE: "**Rama base:** `feature/238-fabrica-mudanza` (hijo de #238; el PR va contra esa rama, no contra `main`)". `git log origin/feature/238-fabrica-mudanza`: d1f393e (#244), fd59a63 (#243).
  12. CODE `src/scenes/world.test.ts:105-106`: toda pieza de la fábrica cumple `max.y ≤ 0`, `max.x ≤ 0` o región x 4..99 × y −4..99; ISSUE: "La regla de `world.test.ts` … ya cubre el lugar nuevo". Si se commitea Task 1 sin Task 2, el exhibit sigue con el literal 172 y su test nuevo queda rojo; se squashea (Assumptions).
  13. `grep` de `126.5` / `172` / `(130, −40)`: `exhibits.ts:69,75` (Task 2 los reescribe), `exhibits.test.ts:120` (comentario; ISSUE: "la aserción del pedestal fuera de `planta` sigue siendo cierta (ahora por y); dejarla" — se actualiza el comentario), `factory.test.ts:121` (se reemplaza), `factory-anim.test.ts:6` (bocas propias; ISSUE: "`factory-anim.test.ts` usa bocas propias (no cambia)"), specs y planes viejos (históricos; README/docstrings los cierra #248 según el comentario de plan de #238, hijo 8).
  14. CODE `src/lab/page.ts:22` "`?speed=` escala el reloj …; 0 lo congela". CODE `factory-anim.ts:9-10`: "Arrancan escalonadas, así el frame 0 (y reduced-motion) muestra una columna".
  15. NO SOURCE en el repo → supuesto técnico ya declarado ("Commit intermedio rojo"); lo pide el pipeline de este run (stage 3) y el merge es `--squash`.
  16. CODE `world.test.ts:105-106` (región x ≤ 99, y ≥ −4) y los tests de caja nuevos (x ≤ 90 y ≥ 22; x ≤ 49, y ≥ 5), más estrictos que x ≤ 98.7 / y ≥ −4.
  17. ISSUE: "Con el alero norte en y 43.4 y z 14, una chimenea en (cx, cy) se ve desde z > (cy − 23.8)/1.4"; el ≥ 50 % en la cover lo verifica el cierre (#238, comentario de plan: hijo 8 "verificación del 50 % de las chimeneas en la cover"); la nave todavía no está en y 44 en esta rama (#246). Este hijo fija y ≤ 36.1 por test.
- Supuestos: 6 (sección Assumptions).
- Issues abiertos: ninguno.
