# Documento de referencia de barcos (#59) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escribir `docs/superpowers/specs/2026-10-16-barcos-referencia.md`, el documento que usan #60, #61 y #62 para remodelar `cargo`, `tug` y `barge`: fotos por ángulo (solo enlaces), rasgos de silueta, dimensiones en unidades de mapa y lista de piezas del kit.

**Architecture:** Un único documento Markdown con una sección por estilo (mismo formato rígido en las tres) más secciones comunes (escala y caja, kit y materiales, decisiones). Un test de Vitest (`src/scenes/ships-reference.test.ts`) lee el Markdown y verifica estructura, cobertura de ángulos, cantidad de enlaces, dimensiones dentro de la caja de las rutas y que cada pieza nombre una función del kit y un material/acento existentes. No se toca código de producción.

**Tech Stack:** Markdown, Vitest (`npm test`), TypeScript (`npm run typecheck`). Investigación: API de Wikimedia Commons, páginas del fabricante (Damen), ShipSpotting/MarineTraffic, prensa náutica.

**Spec:** issue #59 (cuerpo citado en la sección siguiente) y el comentario de plan de #57 (decisiones 1–7).

## Global Constraints

- Ruta del documento: `docs/superpowers/specs/2026-10-16-barcos-referencia.md`.
- Solo enlaces: **no copiar imágenes al repo** (nada de `![...]`, ningún archivo de imagen nuevo).
- Estilos fijos: Damen Combi Freighter 3850 → `cargo`; Damen ASD Tug 2810 → `tug`; empujador fluvial de tres cubiertas (~30 m) + barcaza tolva Jumbo Mississippi (60 × 12 m, tapas abovedadas) → `barge`. Se puede pasar a una clase hermana solo si faltan fotos, anotándolo en "Decisiones".
- Escala: **1 u ≈ 1.5 m**. Caja: eslora total ≤ 60 u (incluido el empujador), manga ≤ 10 u, ningún sólido por encima de z = 13 (agua en z = −1).
- Dimensiones objetivo: carguero 60 × 10, remolcador 19 × 7, barcaza 40 × 8 + empujador 20 × 7.
- Piezas en términos del kit de `src/scenes/ships.ts` (`hull`, `box`, `cyl`, `dot`, `poly`) y de los sólidos de `src/iso/solids.ts` (`prism` con techo `gable`/`step`, `cone`, `cylinder`, `poly`, `hull`), ordenadas por importancia para la silueta; presupuesto 40 sólidos y 8 luces por barco (#57, decisión 3).
- Materiales: solo claves existentes de la paleta (`ISO_TONES` en `src/map/palette-iso.ts`; el issue lo llama `ISO_MATERIALS`, que no existe); luces solo con `ACCENT_COLORS`. No se agregan colores.
- `npm test` y `npm run typecheck` en verde.

## Review Focus

1. Un enlace que no es una foto del modelo/clase pedido (otro barco con nombre parecido) → cada fila nombra el buque concreto (nombre + IMO cuando exista) y el test exige que la fila tenga texto de descripción.
2. Un ángulo "cubierto" por una foto que en realidad muestra otro → cada fila declara un único ángulo de la lista cerrada; el test exige los cinco por estilo.
3. Dimensiones que se salen de la caja (sumar empujador + barcaza, altura del mástil) → el test parsea la línea "Caja en mapa" y la altura máxima y las compara con los límites.
4. Lista de piezas con un material inventado o un sólido que el kit no tiene (`cone`/`prism` no están en el `Kit`) → el test valida nombres contra `ISO_TONES` / `ACCENT_COLORS` y la lista cerrada de sólidos; el documento aclara que `prism`/`cone` requieren sumar un helper al kit.
5. Enlaces rotos → guion de verificación en `.scratch/` que pide cada URL (no entra al suite para no depender de la red); su resultado va al PR.

---

## Formato fijo de cada sección de estilo

Cada estilo es una sección `## \`<kind>\` — <nombre>` con, en este orden:

```markdown
## `cargo` — Damen Combi Freighter 3850

- **Astillero/clase:** ...
- **Eslora:** ... m · **Manga:** ... m · **Altura sobre el agua:** ~... m (...)
- **Caja en mapa:** 60 × 10 u · **Altura máx.:** z = 12

### Fotos

| Ángulo | Buque | Enlace | Qué se ve |
| --- | --- | --- | --- |
| perfil | Birgit G. (IMO 9536064) | https://commons.wikimedia.org/wiki/File:... | ... |

### Rasgos de silueta

- ... (≥ 6 viñetas)

### Traducción a la escala del mapa

- ... (medidas parciales en u: puente, grúas, chimenea, bodega, etc.)

### Piezas sugeridas (por importancia)

1. `hull` · `hullBlue` — casco 60 × 10, h 5, arrufo 0.25
2. `box` · `whitewash` — ...
```

Ángulos válidos (lista cerrada): `perfil`, `proa`, `popa`, `tres cuartos`, `cenital`. Una pieza es `<n>. \`<sólido>\` · \`<material o acento>\` — <descripción>`, con `<sólido>` en `hull | box | cyl | dot | poly | prism | cone`.

### Task 1: Marco del documento (escala, kit, materiales, decisiones)

**Files:**
- Create: `docs/superpowers/specs/2026-10-16-barcos-referencia.md`
- Test: `src/scenes/ships-reference.test.ts` (escrito en la etapa de evals; las pruebas `marco` fallan hasta que existe el documento)

**Interfaces:**
- Produces: secciones `## Escala y caja`, `## Kit y materiales`, `## Decisiones` y los encabezados vacíos de los tres estilos con el formato fijo, para que las tareas 2–4 solo llenen su sección.

- [ ] **Step 0 (etapa de evals, antes de implementar):** escribir `src/scenes/ships-reference.test.ts`. Lee el Markdown con `readFileSync(new URL("../../docs/superpowers/specs/2026-10-16-barcos-referencia.md", import.meta.url))` (mismo patrón que `src/lab/lab-excluded.test.ts:4`) e importa `ISO_TONES` y `ACCENT_COLORS` de `src/map/palette-iso.ts`. Bloques `describe`:
  - `marco`: el archivo existe; no contiene `![`; tiene `## Escala y caja`, `## Kit y materiales`, `## Decisiones`; "Decisiones" menciona `cargo`, `tug` y `barge`; los encabezados de los tres estilos existen (`/^## `cargo` — /m`, etc.).
  - `cargo`, `tug`, `barge` (uno por estilo, cortando el texto entre su `## ` y el siguiente `## `): líneas `**Astillero/clase:**`, `**Eslora:**`, `**Manga:**`, `**Altura sobre el agua:**`; tabla `### Fotos` con ≥ 5 filas cuya primera celda está en la lista cerrada de ángulos, los cinco ángulos presentes, ≥ 5 URLs `https://` distintas y celda "Qué se ve" no vacía; `### Rasgos de silueta` con ≥ 6 viñetas; línea `**Caja en mapa:**` igual a `60 × 10 u` / `19 × 7 u` / `40 × 8 u + empujador 20 × 7 u`, eslora total ≤ 60 y manga ≤ 10; `**Altura máx.:** z = N` con N ≤ 13 (inclusivo); `### Piezas sugeridas` con ítems `<n>. \`<sólido>\` · \`<nombre>\` — ...`, sólido en `hull|box|cyl|dot|poly|prism|cone`; para `dot`/`poly` el nombre está en `ACCENT_COLORS` y cuentan como luces (≤ 8, incluye `magentaMid`, `magenta`, `cyanMid`); para el resto el nombre es clave de `ISO_TONES` y cuentan como sólidos (≤ 40, para `barge` el conjunto barcaza + empujador).
  - Verificación del test mismo: corre en rojo con el documento ausente y, en un borrador local de una sección de juguete, en verde (no se commitea el borrador).
  - En la misma etapa, `.scratch/check-links-59.sh` (`.scratch/` en `.git/info/exclude`): extrae las URLs del documento y hace `curl -sIL -A "Mozilla/5.0"` a cada una; imprime código por URL; 403 de MarineTraffic/ShipSpotting se reportan como "bloqueado por el sitio", no como roto.
- [ ] **Step 1:** Correr `npx vitest run src/scenes/ships-reference.test.ts -t marco`; esperado FAIL (`ENOENT`).
- [ ] **Step 2:** Escribir el marco: propósito y enlace a #57; "Escala y caja" (1 u ≈ 1.5 m, caja 60 × 10 × z 13, agua z −1, objetivos por barco, proyección `xs = x − y`, `ys = (x + y)/2 − 1.4·z` para saber qué caras se ven: proa hacia +x muestra estribor y popa en el lab); "Kit y materiales" (firmas del `Kit`, que `box` es un `poly` sólido con fachada opcional, que `kit.poly` es un acento y no un sólido, que `prism`/`cone` existen en `solids.ts` pero el kit no los expone, materiales que hoy usan los barcos y otros de la paleta aprovechables: `deck`, `glass`, `steel`, `rust`, `whitewash`, `hull`, `hullBlue`, `concrete`, `copper`, `foam`); "Decisiones" con las tres elecciones heredadas de #57.
- [ ] **Step 3:** `npx vitest run src/scenes/ships-reference.test.ts -t marco` → PASS.
- [ ] **Step 4:** Commit `docs(#59): marco del documento de referencia de barcos`.

### Task 2: `cargo` — Damen Combi Freighter 3850

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-barcos-referencia.md` (sección `cargo` y su línea en "Decisiones")

**Interfaces:**
- Consumes: formato fijo de la tarea 1.
- Produces: sección completa que lee #60.

- [ ] **Step 1:** `npx vitest run src/scenes/ships-reference.test.ts -t cargo` → FAIL (sección vacía).
- [ ] **Step 2:** Investigar: datos del fabricante (eslora, manga, calado, grúas), buques reales de la clase en Wikimedia Commons (`Category:Combi Freighter 3850 (ship type)` y búsqueda por IMO), ShipSpotting/MarineTraffic. Al menos una foto por ángulo; preferir un mismo buque o buques gemelos.
- [ ] **Step 3:** Escribir datos, tabla de fotos (≥ 5 filas, 5 ángulos), rasgos (puente a popa, chimenea, grúas y banda, bodega y tapas, castillo, bulbo, botes, mástil de radar, alerones), traducción a 60 × 10 u con alturas ≤ z 13, piezas (≤ 40 sólidos, ≤ 8 luces, incluir las 3 luces de navegación).
- [ ] **Step 4:** `npx vitest run src/scenes/ships-reference.test.ts -t cargo` → PASS.
- [ ] **Step 5:** Commit `docs(#59): referencia del Combi Freighter 3850`.

### Task 3: `tug` — Damen ASD Tug 2810

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-barcos-referencia.md` (sección `tug` y su línea en "Decisiones")

**Interfaces:**
- Consumes: formato fijo de la tarea 1.
- Produces: sección completa que lee #61.

- [ ] **Step 1:** `npx vitest run src/scenes/ships-reference.test.ts -t tug` → FAIL.
- [ ] **Step 2:** Investigar: ficha Damen ASD Tug 2810 (28.7 × 10.4 m), remolcadores de la clase en Commons/ShipSpotting, cinco ángulos.
- [ ] **Step 3:** Escribir datos, fotos, rasgos (timonera panorámica, dos chimeneas, guinche de proa, defensas de goma en todo el contorno y pudding de proa, mástil, amurada alta, propulsores azimutales a popa), traducción a 19 × 7 u, piezas.
- [ ] **Step 4:** `npx vitest run src/scenes/ships-reference.test.ts -t tug` → PASS.
- [ ] **Step 5:** Commit `docs(#59): referencia del ASD Tug 2810`.

### Task 4: `barge` — empujador de tres cubiertas + barcaza Jumbo

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-barcos-referencia.md` (sección `barge` y su línea en "Decisiones")

**Interfaces:**
- Consumes: formato fijo de la tarea 1.
- Produces: sección completa que lee #62. La caja en mapa es `40 × 8 u + empujador 20 × 7 u` (60 u en total).

- [ ] **Step 1:** `npx vitest run src/scenes/ships-reference.test.ts -t barge` → FAIL.
- [ ] **Step 2:** Investigar: empujadores fluviales de tres cubiertas (~30 m) del Mississippi o de la Hidrovía Paraná–Paraguay y barcazas tolva Jumbo (195 × 35 ft ≈ 60 × 12 m) con tapas abovedadas. El convoy es **un** estilo con **una** tabla de fotos: entre todas sus filas (empujador, barcaza o el conjunto) cubren los cinco ángulos; la columna "Buque" dice qué se ve.
- [ ] **Step 3:** Escribir datos (dos líneas: barcaza y empujador), fotos, rasgos (proa cuadrada con "rake", tapas abovedadas, pechos de empuje, torre de tres niveles con timonera arriba, chimeneas gemelas detrás, cables de amarre), traducción, piezas para el conjunto (≤ 40 sólidos entre los dos).
- [ ] **Step 4:** `npx vitest run src/scenes/ships-reference.test.ts -t barge` → PASS.
- [ ] **Step 5:** `npm test && npm run typecheck` → verde; correr `.scratch/check-links-59.sh` y anotar el resultado.
- [ ] **Step 6:** Commit `docs(#59): referencia del empujador y la barcaza Jumbo`.

## Assumptions

- El conjunto de materiales es `ISO_TONES` (`src/map/palette-iso.ts:22`): `ISO_MATERIALS`, que nombra el issue, no existe. Alternativa descartada: exigir solo los siete de `SHIP_MATS`; el issue y #57 (decisión 3) permiten "cualquier `Material` ya existente".
- El guard del documento vive en `src/scenes/ships-reference.test.ts`, junto a `ships.test.ts`: `vitest.config.ts` solo incluye `src/**/*.test.ts` y `scripts/**/*.test.ts`. Alternativa descartada: `scripts/`, que guarda scripts de build, no tests de escenas.
- La lista de piezas puede recetar `prism`/`cone` (el issue los nombra como "sólidos disponibles"), pero el documento marca que el `Kit` no los expone y que agregar el helper corresponde al hijo que lo use (#60–#62). Alternativa descartada: prohibirlos.
- El presupuesto de `barge` (≤ 40 sólidos, ≤ 8 luces) es del conjunto barcaza + empujador: hoy `barge` es un solo `ShipKind` que dibuja ambos (`src/scenes/ships.ts`, función `barge`).
- Las tareas 2–4 no se commitean con su test en rojo: si no hay fotos de un estilo se usa una clase hermana (el issue lo permite) antes de abrir el PR; no se usa `.skip`.
- Las fotos de ShipSpotting/MarineTraffic se enlazan, nunca se copian; se prefieren Commons y el fabricante (orden del issue). Sin regla de licencias en el repo.
- Las verificaciones de que cada foto muestra el buque y ángulo declarados son manuales (lectura de la página por quien escribe el documento y por el revisor); van al PR como verificación manual.
- La investigación usa la API de Wikimedia Commons y lecturas directas de páginas: Exa y Firecrawl no están disponibles en este runner.

## Grilling

- Rondas: 1 (los cambios agregaron detalle a pasos existentes, sin cambiar el corte de tareas).
- Preguntas: 18. Fuentes: ISSUE 5, CODE 7, DOC 0, NO SOURCE 6 (todas supuestos técnicos; ninguna ambigüedad de spec; ninguna fuera de alcance).
- Supuestos: los de la sección anterior.
- Issues abiertos: ninguno.
