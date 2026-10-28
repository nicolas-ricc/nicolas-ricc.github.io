# Barrio costero: Escuela N.º 11 Florentino Ameghino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el marcador de `src/scenes/barrio-escuela.ts` por la escuela pública: bloque de aulas de dos pisos con zócalo verde, dos torres de ladrillo con remate y escudo que enmarcan la entrada, ventanas altas pareadas entre pilastras, patio al este con mástil y bandera, patio cubierto sobre columnas, farol de entrada, caja de escalera encendida, árboles y farol de vereda.

**Architecture:** `escuela(ctx: BarrioCtx, b: SprawlBlock): void` sigue siendo la única entrada (firma intacta; `tech.ts`, `tech-zoning.ts` y los topes no se tocan). La geometría es **fija** (función solo de `b.x`, `b.y`), sin consumir `ctx.rng`. Los tests corren sobre la escena del mundo (`tech(zoneRng(SEED, "cv", 2))`, manzana `SCHOOL = (102, 520)`) y sobre `escuela()` directa para el determinismo.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #252 (`gh issue view 252 --repo nicolas-ricc/nicolas-ricc.github.io`; valores exactos, se citan abajo como "issue") y `docs/superpowers/specs/2026-10-27-barrio-costero-design.md` §4.2 "Escuela" (historia #240). Fotos: `docs/superpowers/specs/assets/barrio-refs/escuela-club/01`–`03`.

## Global Constraints

- `npm test` y `npm run typecheck` en verde al final de cada tarea; ningún literal `0x…` (guarda de paleta).
- Solo materiales de `TECH_MATS`; ningún material nuevo. Tamaño mínimo 0.15 u en toda dimensión.
- No tocar `tech.ts`, `zoneKinds`, `FACE_CAPS`, `TECH_FACES_BEFORE`, `REGION_FACES_BEFORE`, `ACCENT_CAP`.
- Estilo de `src/scenes/barrio*.ts`: castellano, docstring corto por función, expresiones en una línea, helpers de `barrio.ts` (`homeWindow`, `wallWindow`) y `city-pieces.ts` (`prism`, `lamp`).
- Visibilidad: la cámara ve techo, `wall 1` (este) y `wall 2` (sur). Placas: `u` fracción 0..1 a lo largo de la arista (este: crece con y; sur: crece hacia el **oeste**), `z0..z1` **absolutos**.

## Geometría (coordenadas con `x = b.x`, `y = b.y`; manzana 24×18)

| Pieza | Sólido | Posición / medidas |
|---|---|---|
| Zócalo de manzana | `prism` `paving` | `(x, y, 0)` 24×18×0.3 |
| Bloque de aulas | `prism` `whitewash` + `plates` | `(x+2, y+1, 0.3)` 6×16×5.6 |
| Torre sur / norte | `prism` `brick` | `(x+8, y+10, 0.3)` y `(x+8, y+5, 0.3)` 3×3×9.5 |
| Remates | `prism` `stone` | `(x+7.8, y+4.8, 9.8)` y `(x+7.8, y+9.8, 9.8)` 3.4×3.4×0.4 |
| Escudo | placa en torre **norte** | `wall 1`, `disc`, `safety`, u 0.3..0.7, z 7.2..8.4 |
| Farol de entrada | acento | `dot` `amber` r 0.5 en `(x+8.2, y+9, 3.2)` |
| Caja de escalera | 2 × `homeWindow` | plano `x = x+11`, y `y+11..y+12`, z 4.5..6.1 y 7..8.6, `lit: true`, grupo `"escuela-escalera"` |
| Patio | `prism` `plaza` | `(x+11, y+1, 0.3)` 11×16×0.05 |
| Mástil | `prism` `whitewash` | `(x+20, y+14, 0.3)` 0.2×0.2×7 |
| Bandera | `prism` `whitewash` + placa | `(x+20.2, y+14.025, 6)` 1.2×0.15×0.8; placa `rect` `hullBlue` en **`wall 2`** u 0..1, z 6.27..6.53 |
| Techo patio cubierto | `prism` `copper` | `(x+12, y+2, 3.5)` 9×6×0.3 |
| Columnas | 4 × `prism` `concrete` | esquinas internas del techo: `(x+12, y+2)`, `(x+20.6, y+2)`, `(x+12, y+7.6)`, `(x+20.6, y+7.6)`, z 0.3, 0.4×0.4×3.2 |
| Árboles | 2 × `cone` `leaf` 6 lados | `(x+24.8, y+3, 0)` y `(x+24.8, y+15, 0)`, r 1.4, h 4 |
| Farol de vereda | `lamp()` | `(x+23, y+18.6, 0)` |

**Placas del bloque**, en este orden (se pintan en orden):

- `wall 1` (este, 16 u de largo, `u = (Y − (y+1)) / 16`):
  1. zócalo `copper` u 0..1, z 0.3..1.3;
  2. imposta `stone` u 0..1, z 3.0..3.3;
  3. 16 ventanas `glass` `toneOffset −1`: pisos `f ∈ {0, 1}`, z `1.0 + 2.8f .. 2.6 + 2.8f`; pares centrados en u `c ∈ {0.125, 0.375, 0.625, 0.875}` (y = 3, 7, 11, 15 locales); cada ventana 0.9 u de ancho, centros a `c ± 0.6/16` (0.3 de separación dentro del par);
  4. 5 pilastras `stone` `toneOffset +1`, 0.4 u de ancho (0.025 en u), centradas en u 0.25, 0.5, 0.75 y en los extremos (u 0..0.025 y 0.975..1), z **1.3..5.9**;
  5. entrada `officeDark` `toneOffset −2`, u 0.45..0.55 (y locales 8.2..9.8), z 0.3..2.6.
- `wall 2` (sur, 6 u, `u` crece hacia el oeste): zócalo y imposta igual que arriba; un par de ventanas por piso centrado en u 0.5 (centros a `0.5 ± 0.6/6`, ancho 0.9/6).

Costo estimado (`tessellate`): zócalo 3 + bloque 3 + 24 placas este + 6 placas sur + torres 6 + escudo 1 + remates 6 + patio 3 + mástil 3 + bandera 4 + techo 3 + columnas 12 + árboles 6 + farol 3 = **83 ≤ 120**. Altura máxima 10.2 (remates).

## Decisiones técnicas (desvíos declarados respecto del issue)

1. **Pilastras desde z 1.3, no desde la base.** El issue fija el orden zócalo → imposta → ventanas → pilastras; pintadas desde z 0.3 cortarían el zócalo verde en cinco lugares y §4.2 pide "zócalo verde oscuro **a todo lo largo**". Arrancan sobre el zócalo (1.3) y suben al alero (5.9).
2. **Entrada después de las pilastras.** La puerta (u 0.45..0.55) cae sobre la pilastra de u 0.5; se pinta última para que se vea la puerta doble.
3. **Banda celeste en `wall 2` de la bandera, no en `wall 1`.** La bandera mide 1.2 en x y 0.15 en y: su `wall 1` (este) mide 0.15 de ancho y la franja no se vería; el paño visible es la cara sur (`wall 2`, 1.2 de largo).
4. **Columnas y mástil apoyan en z 0.3** (como dice el issue) y comparten 0.05 de altura con el piso del patio (`plaza` h 0.05): el piso es un solado, como el césped de las otras piezas, y no entra en los pares de solape que pide el issue (bloque ↔ torres, torres ↔ patio cubierto, mástil ↔ patio cubierto, árboles ↔ farol).
5. **Ventanas detrás de las torres.** Los pares de y 7 y 11 locales quedan en parte detrás de las torres (y 5..8 y 10..13). Se dejan: el issue pide 16 placas `glass` en `wall 1` y el pintor las tapa con las torres; arriba de la imposta las ventanas del piso alto también quedan tras las torres (que llegan a 9.8).
6. **`ctx.rng` no se consume.** Ninguna pieza decorativa lo necesita; el test de determinismo construye con dos semillas y compara `JSON.stringify` de sólidos, acentos y ventanas.

## Review Focus

1. Placas de la cara sur con `u` invertido (crece hacia el oeste): un par centrado en 0.5 es simétrico, pero cualquier asimetría quedaría espejada — el test fija el par en x locales 4.95..5.85 y 6.15..7.05.
2. Solapes en el borde: torres tocando el bloque (`x+8`) y el patio (`x+11`) — tocarse vale, pisarse no; el test usa la comparación con `EPS`.
3. Árbol sur ↔ farol de vereda: el cono hexagonal llega a `y+16.4`, el farol arranca en `y+18.6`.
4. Que los sólidos de la vereda (árboles a `x+24.8 ± 1.4`) caigan dentro de `blockRect` inflado 0.5 (`x+26.5`), si no `facesIn` no los cuenta y el tope miente.
5. Altura del exhibit: el remate llega a 10.2 y el farol de vereda tiene su halo; `h` debe cubrir ambos sin sobrar más de 8.

---

### Task 1: Bloque de aulas, zócalo de manzana y placas

**Files:**
- Modify: `src/scenes/barrio-escuela.ts`
- Test: `src/scenes/barrio-escuela.test.ts` (los tests ya están escritos en la etapa de evals; esta tarea pone en verde los del bloque)

**Interfaces:**
- Consumes: `prism(x, y, z, w, d, h, mat, extra?)` de `city-pieces.ts`; `Plate` de `src/iso/plate.ts`.
- Produces: `escuela(ctx, b)` con zócalo y bloque; constantes locales del módulo (p. ej. `Z = 0.3`) que usan las tareas 2 y 3.

- [ ] **Step 1:** Correr `npx vitest run src/scenes/barrio-escuela.test.ts`; esperado FAIL en "bloque de aulas…".
- [ ] **Step 2:** Implementar zócalo y bloque con las placas de la tabla (orden exacto). Las ventanas por piso y par salen de un bucle, no de literales.
- [ ] **Step 3:** Correr el archivo: los tests del bloque PASS.
- [ ] **Step 4:** Commit `feat(#252): bloque de aulas con zócalo verde, imposta, ventanas pareadas y pilastras`.

### Task 2: Torres, remates, escudo, entrada y luces

**Files:** Modify `src/scenes/barrio-escuela.ts`.

**Interfaces:**
- Consumes: Task 1; `homeWindow(ctx, pts, lit, group)` y `wallWindow({ x }, u0, u1, z0, z1)` de `barrio.ts`.
- Produces: dos torres, dos remates, escudo, puerta (placa ya en Task 1 o acá, siempre la última de `wall 1`), `dot` ámbar de entrada, dos `HomeWindow` `lit` del grupo `"escuela-escalera"` en `x = x+11`.

- [ ] **Step 1:** Correr el archivo; FAIL en torres / farol / escalera.
- [ ] **Step 2:** Implementar según la tabla. El marcador viejo (ventana 1×1 a z 2.3..3.3 en `x+8`) desaparece.
- [ ] **Step 3:** Correr el archivo y `npx vitest run src/scenes/tech.test.ts src/scenes/tech-anim.test.ts src/scenes/barrio.test.ts`: PASS.
- [ ] **Step 4:** Commit `feat(#252): torres de ladrillo con remate y escudo, entrada, farol y escalera encendida`.

### Task 3: Patio, mástil, patio cubierto y vereda

**Files:** Modify `src/scenes/barrio-escuela.ts`.

**Interfaces:**
- Consumes: Tasks 1–2; `lamp(solids, accents, x, y, z)` de `city-pieces.ts`.
- Produces: la manzana completa (≈ 83 caras).

- [ ] **Step 1:** Correr el archivo; FAIL en patio / mástil / techo / solapes / tope.
- [ ] **Step 2:** Implementar patio, mástil con bandera y banda, techo y columnas, dos árboles y farol según la tabla.
- [ ] **Step 3:** `npx vitest run src/scenes`: PASS (incluye topes, región, total, acentos, variedad y luces de `tech.test.ts`).
- [ ] **Step 4:** Commit `feat(#252): patio con mástil y bandera, patio cubierto, árboles y farol`.

### Task 4: Exhibit `escuela`

**Files:** Modify `src/lab/exhibits.ts:173-174` (`h` del exhibit `escuela`); test `src/lab/exhibits.test.ts` (sin cambios).

- [ ] **Step 1:** `npx vitest run src/lab/exhibits.test.ts`; esperado FAIL para `escuela` (h 6 < 10.2).
- [ ] **Step 2:** Subir `h` al menor entero que cubra estructura (10.2) y acentos (lo que mida `accentReach`) sin sobrar más de 8; si el test reporta un valor, usarlo.
- [ ] **Step 3:** `npm test` y `npm run typecheck`: PASS.
- [ ] **Step 4:** Commit `feat(#252): h del exhibit escuela`.

La captura `escuela-despues.png` (agent-browser, 1600×900 a 2x, `/lab/storybook.html?speed=0#escuela`) y las caras del panel antes/después las toma el orquestador al cerrar la etapa 4; `escuela-antes.png` ya está tomada (marcador: 2 sólidos, 6 caras, 1 acento).
