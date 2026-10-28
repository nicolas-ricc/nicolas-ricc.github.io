# Barrio: monoblocks del Barrio Simón Bolívar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el marcador de `src/scenes/barrio-monoblock.ts` por los monoblocks del Barrio Simón Bolívar: una o dos placas 20×5 de tres alturas con planta baja de ladrillo, fachada en grilla (bandas de ventanas y pilastras como `plates`), loggias con baranda, tanques con antena, parque con árboles, senderos y faroles, y ventanas encendibles (`HomeWindow`) con las loggias como franjas.

**Architecture:** `monoblock(ctx, b)` decide primero con `ctx.rng` todos los parámetros de la manzana (placas, alturas, materiales, ladrillo, loggias, árboles), construye cada placa con un helper puro `slab(p: Slab): Solid[]` (zócalo, cuerpo con sus `plates`, tanques, antena), recorta loggias/árboles si `FACE_CAPS.monoblock` no alcanza y después emite ventanas, parque y faroles. Firma y despacho en `tech.ts` no cambian.

**Tech Stack:** TypeScript, Vitest. Todo puro (sin Pixi).

**Spec:** issue #250 (valores exactos; `gh issue view 250 --repo nicolas-ricc/nicolas-ricc.github.io`), `docs/superpowers/specs/2026-10-27-barrio-costero-design.md` §4.2 "Monoblock" y §5, plan de la historia en el comentario de #240. Fotos: `docs/superpowers/specs/assets/barrio-refs/monoblocks/01`–`05`.

## Global Constraints

- `npm test` y `npm run typecheck` en verde al final de cada tarea. No tocar `FACE_CAPS`, `TECH_FACES_BEFORE`, `REGION_FACES_BEFORE`, `ACCENT_CAP` ni la firma `monoblock(ctx: BarrioCtx, b: SprawlBlock): void`; no tocar `tech.ts`.
- Solo materiales de `TECH_MATS`: aquí `leafDark` (césped, vía `lawn`), `paving`, `whitewash`, `stone`, `brick`, `glass`, `officeDark`, `concrete`, `steel`, `leaf`. Ningún material nuevo.
- Las ventanas **no** usan `facade`: bandas y pilastras son `plates`; las ventanas encendibles son `HomeWindow` vía `homeWindow(ctx, pts, lit, group)` y `wallWindow(...)` de `src/scenes/barrio.ts`.
- Tamaño mínimo 0.15 u en toda dimensión. Nada no esbelto por encima de 21.5 (esbelto = prisma de lado ≤ 3).
- Determinismo: todo sale de `ctx.rng`; tests sobre propiedades, no posiciones sorteadas.
- Estilo del repo: comentarios en castellano, funciones cortas de expresiones largas como el marcador actual, docstring de una línea por función.
- Coordenadas de placa (`src/iso/plate.ts`, `rect()` de `solids.ts`): `wall 2` (sur) va de `(x+w, y+d)` a `(x, y+d)`, así que en la pared sur `x(u) = px + 20·(1 − u)`; `wall 1` (este) va de `(x+w, y)` a `(x+w, y+d)`, `y(u) = py + 5·u`.

## Geometría (decidida en el issue; acá solo se fijan los huecos)

- Placa: cuerpo `prism(px, py, 0.3, 20, 5, h, mat)` con `px = b.x + 2`, `py ∈ {b.y + 2, b.y + 11}`; zócalo `prism(px − 0.3, py − 0.3, 0, 20.6, 5.6, 0.3, "paving")` (centrado bajo el cuerpo, apoyado en z 0 como los zócalos de `campus`). `floors = h / 3`.
- Plates del cuerpo, en este orden: ladrillo (si toca: `wall 1` y `wall 2`, u 0..1, z 0.3..3.3) → por piso las dos bandas `glass` `toneOffset −1` (sur y este) → pilastras (`mat` de la placa, `toneOffset +1`, z 0.3..0.3+h; sur en u `k/8 ± 0.01`, k = 1..7; este en u `0.46..0.54`) → por columna de loggia la placa `officeDark` `toneOffset −2` (z 0.3..0.3+h) y luego sus barandas `whitewash` por piso (z `0.3+3f+0.9..+1.1`).
- Loggias: `rng.int(1, 2)` columnas; 1 → vano `[2]`, 2 → vanos `[2, 6]` (vano k: u `k/8..(k+1)/8`).
- Tanques: `n = floors >= 5 ? 3 : 2` prismas `concrete` 2×2×2.8 en `z = 0.3 + h`, centro x `px + 20·(k + 0.5)/n`, centro y `py + 2.5`; antena `prism` `steel` 0.2×0.2×2.5 centrada sobre el primer tanque (`z = 0.3 + h + 2.8`).
- Senderos (`ctx.ground`, `strip` `paving` width 1, z 0.08 como `barrio-plaza.ts`): N–S en `x = b.x + 23.2`, de `y = b.y` a `b.y + 18` (entre el extremo este de los zócalos, x 22.3, y el borde de la manzana); E–O de `x = b.x` a `b.x + 23.2` en `y = b.y + 9` con dos placas, `b.y + 8.3` con una al norte, `b.y + 10.2` con una al sur.
- Árboles: `cone` `leaf` 6 lados en `z = 0.05`, `r = 1.2 + 0.4·rng.next()`, `h = 3.5 + 1.5·rng.next()`. La franja libre es `x ∈ [b.x, b.x + 22.3]` y en y la banda sin placa ni zócalo: con dos placas `[b.y + 7.3, b.y + 10.7]`; con una al norte `[b.y + 7.3, b.y + 18]`; con una al sur `[b.y, b.y + 10.7]`. `n = rng.int(4, 6)` árboles, cada uno en su ranura de ancho `22.3 / n` a lo largo de x (centro aleatorio dentro de la ranura achicada por r; y aleatorio dentro de la banda achicada por r); si la caja del cono pisa otro árbol o un zócalo, reintentar hasta 10 veces y descartar. Las ranuras garantizan ≥ 4 con 4 pedidos; los árboles pueden pisar el sendero E–O (es plano).
- Faroles: `cornerLamps(ctx, b)` (ya pone `(b.x + 23, b.y − 1.5)` y `(b.x + 1, b.y + 18.6)`).
- Grupos de luz: `${b.x},${b.y}:p${i}-s${f}-${k}` (sur), `${b.x},${b.y}:p${i}-e${f}-${j}` (este), `${b.x},${b.y}:p${i}-L${vano}` (columna de loggia, común a todos sus pisos); `i` = índice de placa.
- Presupuesto: con todo, dos placas de 6 y 5 pisos con dos loggias cada una y 6 árboles dan ≈ 127 caras > 115. Recorte, en este orden y solo hasta entrar: árboles a 4; luego loggias a 1 en la placa más alta; luego en la otra. Nunca tanques ni bandas. El conteo se hace con `facesIn([...sólidos de la manzana], blockRect(b))` sobre los sólidos ya generados (helper puro, no sobre `ctx`).

## Review Focus

1. Overlap de árboles con zócalos en la banda angosta entre dos placas (3.4 u para conos de hasta 3.2 de diámetro): el test de solapes (Task 3) recorre todas las manzanas del mundo, no una sola.
2. Fracción encendida en [0.30, 0.45] depende de que las loggias (`chance(0.5)` por columna, todas sus ventanas juntas) no la empujen afuera: el test mide sobre las 18 manzanas del mundo (Task 2).
3. `ACCENT_CAP = 1300` (estáticos + frame 0 de todas las capas): hoy 944, con ≈ 326 ventanas encendidas; las placas dobles suben las ventanas ≈ +50 %. El test de acentos de `tech.test.ts` lo vigila; si se rompe, se recorta cantidad de la pieza (nunca el tope).
4. Placas de altura repetida dentro de la manzana: `pick` sin repetir (sacar la altura elegida antes de la segunda tirada). Test en Task 1 sobre todas las manzanas.
5. `h` del exhibit `monoblock` (hoy 13): con un cuerpo de 18 pasa a ≈ 23.6; `exhibits.test.ts` exige cubrir sin sobrar más de 8 (Task 3).

---

### Task 1: placas, fachada en grilla, loggias, tanques y antena

**Files:**
- Modify: `src/scenes/barrio-monoblock.ts`
- Test: `src/scenes/barrio-monoblock.test.ts` (escrito en la etapa de evals; reemplaza los tests del marcador)

**Interfaces:**
- Consumes: `BarrioCtx`, `lawn`, `cornerLamps` de `./barrio`; `prism` de `./city-pieces`; `blockParity` de `./tech-zoning`; `FACE_CAPS`, `facesIn`, `blockRect` de `./tech-budget`.
- Produces: `interface Slab { x: number; y: number; h: number; mat: "whitewash" | "stone"; brick: boolean; loggias: number[] }` y `export function slab(p: Slab): Solid[]` (zócalo, cuerpo con plates, tanques, antena; en ese orden). `monoblock` llama a `lawn` y construye 1–2 `Slab`.

- [ ] Step 1: tests (ya en `barrio-monoblock.test.ts`): "1 o 2 cuerpos 20×5 de alturas {12,15,18} distintas", "tres alturas en el barrio", "tanques y antena", "placas solo en wall 1 y 2", "nada no esbelto supera 21.5", sobre `tech(zoneRng(SEED, "cv", 2))` y las manzanas `monoblock` de `zoneKinds`.
- [ ] Step 2: `npx vitest run src/scenes/barrio-monoblock.test.ts` → FAIL.
- [ ] Step 3: implementar `slab` y la parte de placas de `monoblock` según "Geometría".
- [ ] Step 4: mismo comando → esos tests PASS.
- [ ] Step 5: commit `feat(#250): placas del monoblock con grilla, loggias y tanques`.

### Task 2: ventanas encendibles

**Files:** Modify `src/scenes/barrio-monoblock.ts`; Test `src/scenes/barrio-monoblock.test.ts`.

**Interfaces:** Consumes `homeWindow`, `wallWindow` de `./barrio`; los `Slab` de Task 1.

- [ ] Step 1: tests (ya escritos): "ventanas sobre el plano sur o este de un cuerpo", "columna de loggia con `lit` común", "fracción encendida en [0.30, 0.45]".
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: por placa y piso: sur, una ventana 0.9×0.9 centrada en cada vano no loggia (`x` del centro `px + 20·(1 − (k + 0.5)/8)`, z `0.3+3f+1.1..+2.0`), `lit = chance(0.38)`; este, 2 (y `py + 1.25` y `py + 3.75`), igual; por columna de loggia `lit = chance(0.5)` una vez y una ventana por piso que cubre el vano (z `0.3+3f+1.2..+2.6`) con el grupo de la columna. Orden de tiradas: por placa, primero los `lit` de las columnas de loggia, después piso por piso sur y este.
- [ ] Step 4: correr → PASS. `npx vitest run src/scenes/tech.test.ts` → luces y acentos PASS.
- [ ] Step 5: commit `feat(#250): ventanas encendibles del monoblock`.

### Task 3: parque, faroles, presupuesto y exhibit

**Files:** Modify `src/scenes/barrio-monoblock.ts`, `src/lab/exhibits.ts` (`h` de `monoblock`); Test `src/scenes/barrio-monoblock.test.ts`, `src/lab/exhibits.test.ts`, `src/scenes/tech.test.ts`.

- [ ] Step 1: tests (ya escritos): "≥ 4 árboles y 2 faroles", "cuerpos, tanques y árboles no se solapan", "dentro de FACE_CAPS.monoblock", senderos.
- [ ] Step 2: correr → FAIL.
- [ ] Step 3: árboles, senderos y `cornerLamps` según "Geometría"; recorte de presupuesto (árboles → loggias) antes de emitir ventanas, para que las ventanas sigan a las loggias que quedaron.
- [ ] Step 4: `npx vitest run src/scenes src/lab` → PASS; si `exhibits.test.ts` falla por `h`, poner el `h` que pide (≈ 24) y repetir.
- [ ] Step 5: `npm test && npm run typecheck` → verde. Commit `feat(#250): parque, faroles y presupuesto del monoblock`.
