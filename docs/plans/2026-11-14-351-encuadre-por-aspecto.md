# Encuadre por aspecto: no mostrar fuera del cuadro 16:9 (#351) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** en pantallas más angostas que 16:9, `coverView` llena el alto del host con el cuadro 16:9 y desliza la ventana visible hacia la ciudad (`COVER_FOCUS_U = 0.35`), y `zoneView` se acota al cuadro 16:9 en cada eje donde entra; las pantallas de 16:9 o más anchas no cambian.

**Arquitectura:** todo el cambio vive en `src/world/view.ts`. `coverView(w, h)` gana una rama `a < 16/9` que reusa `fitTransform(coverFrame(16/9), vw, h, 0)` sobre un host virtual de `vw = h·16/9` y le resta un corrimiento `off`. Una función nueva, `clampToCover(v, w, h)`, acota por eje en coordenadas proyectadas contra la caja proyectada de `coverFrame(16/9)`; `zoneView` la aplica antes de `clampToBleed`. `main.ts`, `frame.ts`, `geo.ts` y el lab no se tocan.

**Stack:** TypeScript estricto, Vitest, Pixi v8 (solo en la verificación visual). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-11-encuadre-por-aspecto-design.md` (§2 regla, §4 tests, §5 capturas) y el issue #351.

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- `A = 16/9`, `a = w/h`. Con `a ≥ A` el resultado de `coverView` es exactamente `fitTransform(coverFrame(a), w, h, 0)`, como hoy (mismo código, no solo "igual a 1e-6").
- `COVER_FOCUS_U = 0.35`, exportada desde `src/world/view.ts`, con comentario: fracción del ancho del cuadro 16:9, desde su borde izquierdo, donde se centra la vista en pantallas angostas; elegida para que entren la ciudad, la fábrica y la isla.
- No cambian: `coverQuad`, `coverFrame`, `zoneFrame("cover")`, `COVER_MARGIN`, la generación del sangrado, `placeLabels` (`main.ts`), el lab.
- `npm test` y `npm run typecheck` en verde al final de cada tarea.
- Commits `feat(#351): …` / `test(#351): …`, con `Co-Authored-By`.

## Decisiones técnicas declaradas

1. **"Dentro de `coverQuad(16/9)`" en los tests** se mide como lo midió el spec (§1): `inCoverQuad(x, y, 16/9, 1e-6)` de `geo.ts` sobre cada esquina de `viewCorners`, es decir el cuadro con `COVER_INSET` y una tolerancia de 1e-6 hacia afuera.
2. **Caja del cuadro para `clampToCover`:** los extremos x/y de los cuatro puntos proyectados de `coverFrame(16/9)` (`frame.ts`), calculados una vez a nivel de módulo en `view.ts`. Como el cuadro está alineado a los ejes de pantalla, esa caja *es* el cuadro. Medida en `main` 55c9897: x ∈ [−419,78; 653,78] (ancho 1073,57), y ∈ [−105,44; 498,44] (alto 603,88).
3. **Acotado de `clampToCover` en x** (y es igual con alto): si `ancho·s ≥ w`, `x = clamp(v.x, w − qx1·s, −qx0·s)`; si no, x queda como venga. Si nada cambia (diferencia < 1e-9 en los dos ejes) se devuelve `{ ...v }`, como hace `clampToBleed`, para que la idempotencia sea exacta.
4. **`clampToBleed` después de `clampToCover` no deshace el acotado:** el cuadro ya está dentro del sangrado con `VIEW_INSET` (`coverQuad` usa `COVER_INSET` = `VIEW_INSET`), así que una vista dentro del cuadro no se mueve. Lo fija el test 5.
5. **Tests existentes que se quedan** y que se comprobaron con un prototipo de la regla: `zoneView("portfolio", 390, 338).scale > coverView(390, 338).scale·1.05` sigue (cociente 1,0509) y el hito de 640×900 (`(129, 227)`) sigue adentro (279, 427). Si un implementador ve que fallan, es una regresión, no un test a relajar.
6. **El 1,01 de `ZONE_MIN_ZOOM` no cambia**: el spec dice que `zoneView` hereda el piso nuevo sin tocarlo.

## Assumptions

Decididas en la revisión del plan (etapa 2), sin fuente escrita; cualquier opción razonable cumple el issue.

1. **Host degenerado (`w` o `h` = 0, NaN).** No se agrega guarda. Hoy `coverView(0, 0)` ya da NaN (`coverQuad(NaN)`), y con `h = 0` y `w > 0` el aspecto es `Infinity`, así que entra a la rama `a ≥ A`, el mismo código de hoy. La regla nueva no empeora ningún caso. Se descartó una guarda que devuelva `{0, 0, 1}`: es comportamiento nuevo que nadie pidió.
2. **`clamp` con `lo > hi`.** `clamp` (`view.ts:34`) es `Math.min(hi, Math.max(lo, v))` y con `lo > hi` devuelve `hi`. En `clampToCover`, la condición `ancho·s ≥ w` es algebraicamente `w − qx1·s ≤ −qx0·s`, así que los límites solo se cruzan por redondeo (~1e-13 px) y el resultado sigue en el borde. No se agrega caso especial.
3. **"1600×900 y 1920×955 idénticas a hoy"** se verifica de dos maneras. La primera es el código: la rama `a ≥ A` es la de hoy y la fijan los tests de la tarea 1 (`toEqual` en anchas, 1e-6 en 1600×900). La segunda es leer en el navegador la transformada del contenedor del mundo (`position` y `scale` del primer hijo de `__PIXI_DEVTOOLS_WRAPPER__.stage`) en la rama y en `main` y compararlas. No se hace un diff de píxeles: el ticker headless corre a ~2 fps y las animaciones no quedan congeladas igual en las dos corridas (`CLAUDE.md`). Las capturas quedan para mirarlas a ojo.
4. **"La ciudad en al menos un tercio del ancho"** se mide sobre la captura de 390×750: el ancho de pantalla que ocupan los edificios de Resume. Un muestreo geométrico de `worldZoneAt(...) === "cv"` por columna ya da 0,73 hoy, así que no distingue, y por eso no se lo usa como test.
5. **Zonas y cuadro.** Los cuatro marcos de `zoneFrame` (`portfolio`, `cv`, `blog`, `all`) caen dentro de la caja proyectada de `coverFrame(16/9)` (medido). En una dimensión, si la ventana contiene la zona y es más angosta que el cuadro, correrla lo mínimo para que entre en el cuadro la deja conteniendo la zona. Así `clampToCover` no saca de pantalla una zona que el ajuste ya mostraba entera. No se agrega un test aparte.
6. **Sin ADR nuevo.** `docs/adr/` solo tiene 0001 (velo) y 0002 (costura); ninguno trata del encuadre. El cambio sigue un spec aprobado.
7. **Capturas** en `docs/superpowers/specs/assets/351-encuadre/`, `before`/`after` en PNG, como en `assets/165-neones/`.

## Review Focus

1. **Aspecto exactamente 16:9 con píxeles que no dan 16:9 exacto** (p. ej. 1920×1080 vs. 1919×1080, o 1600×900 donde `w/h` puede no ser bit a bit `16/9`): la rama `a < A` con `w ≈ vw` debe dar `off ≈ 0` y la misma vista que hoy (continuidad). Test: `coverView(1919, 1080)` contra la salida de la regla vieja, `fitTransform(coverFrame(1919 / 1080), 1919, 1080, 0)`: escala a menos de 1e-3 relativo, `x` e `y` a menos de 1 px (medido: Δscale 4,4e-4, Δx 0,45, Δy 0,09) (tarea 1).
2. **Pantallas más anchas que 16:9** (2100×900, 1920×955): `coverView` idéntico al de hoy, comparado con `toEqual` contra `fitTransform(coverFrame(w/h), w, h, 0)` (tarea 1).
3. **Host diminuto o degenerado** (`w` muy chico, p. ej. 50×900): `vw − w > 0`, el acotado a `[0, vw − w]` no se invierte; las esquinas siguen dentro del cuadro. Test en tarea 1 con 50×900.
4. **`zoneView` en anchas, donde el cuadro no entra en ancho** (1920×955, 2100×900): `clampToCover` no toca x y `clampToBleed` manda como hoy; las esquinas siguen dentro del sangrado con `VIEW_INSET`. Lo cubre el test 5 (tarea 2), que solo exige el cuadro en los ejes donde entra.
5. **Vista que entra en un eje pero no en el otro**: `clampToCover` no debe mover el eje que no entra. Test en tarea 2: una vista con escala tal que el cuadro cubre el alto pero no el ancho, desplazada en los dos ejes; tras `clampToCover`, `x` igual al de entrada.

---

### Task 1: `coverView` para aspectos angostos

**Archivos:**
- Modificar: `src/world/view.ts` (`coverView`, nueva constante `COVER_FOCUS_U`)
- Test: `src/world/view.test.ts` (bloque `describe("coverView")`)

**Interfaces:**
- Consume: `coverFrame(aspect)` y `fitTransform(items, w, h, margin)` de `src/world/frame.ts`; `inCoverQuad(x, y, aspect, margin)` de `src/map/geo.ts`.
- Produce: `export const COVER_FOCUS_U = 0.35`; `coverView(w: number, h: number): View` con la regla §2.1.

- [ ] **Step 1: tests que fallan**, en `describe("coverView")`:
  - `COVER_SIZES = [...SIZES, [390, 750], [820, 1180], [900, 900], [1280, 900], [50, 900]]`.
  - `it.each(COVER_SIZES)("%i×%i: corners inside the bleed, and inside the 16:9 cover when the host is not wider")`: las cuatro esquinas de `viewCorners(coverView(w, h), w, h)` cumplen `insideBleed`; si `w / h <= 16 / 9 + 1e-9`, además `inCoverQuad(c.x, c.y, 16 / 9, 1e-6)`.
  - `"16:9 is continuous with the old rule"`: `coverView(1600, 900)` coincide a 1e-6 (x, y, scale) con `fitTransform(coverFrame(16 / 9), 1600, 900, 0)`; y `coverView(1919, 1080)` queda a menos de 1e-3 relativo en `scale` y a menos de 1 px en `x` e `y` de `fitTransform(coverFrame(1919 / 1080), 1919, 1080, 0)` (la regla vieja). El test existente del ancho 1600 se queda.
  - `"wider than 16:9 is unchanged"`: para 2100×900 y 1920×955, `coverView(w, h)` `toEqual` `fitTransform(coverFrame(w / h), w, h, 0)`.
  - `"390×750 centers on COVER_FOCUS_U of the 16:9 cover"`: con `qx0`, `qx1` = extremos x proyectados de `coverFrame(16 / 9)[0].pts`, el punto `qx0 + COVER_FOCUS_U·(qx1 − qx0)` cae en `x·scale + v.x ≈ 195` (a 1e-6).
  - `"1280×900 is clamped to a cover edge"` (válido mientras `COVER_FOCUS_U ≤ 0,40`: con 4:3 la ventana es el 80 % del cuadro, spec §2.1; si la tarea 3 sube el foco por encima, este test se reescribe): `qx0·s + v.x ≈ 0` o `qx1·s + v.x ≈ 1280` (a 1e-6), y el cuadro cubre `[0, 1280]` (`qx0·s + v.x <= 1e-6`, `qx1·s + v.x >= 1280 − 1e-6`).
  - `it.each` de los tamaños con `a < 16/9`: `"%i×%i: never zooms out compared with the old rule"`, `coverView(w, h).scale >= fitTransform(coverFrame(w / h), w, h, 0).scale − 1e-9`.
  - Además `"the 16:9 cover fills the height on narrow hosts"`: para 390×750, `(qy1 − qy0)·scale ≈ 750` (a 1e-6).
- [ ] **Step 2:** `npx vitest run src/world/view.test.ts` → fallan los de foco, cuadro y escala (y el import de `COVER_FOCUS_U`).
- [ ] **Step 3: implementar** `COVER_FOCUS_U` y la regla §2.1 en `coverView`: `a >= A` devuelve `fitTransform(coverFrame(a), w, h, 0)` tal cual; si no, `vw = h·A`, `base = fitTransform(coverFrame(A), vw, h, 0)`, `off = clamp(COVER_FOCUS_U·vw − w/2, 0, vw − w)`, `{ x: base.x − off, y: base.y, scale: base.scale }`. Mover la `clamp` local de `view.ts` arriba de `coverView`. Actualizar el JSDoc de `coverView` (dice "the rectangle with the host's aspect inscribed in the bleed").
- [ ] **Step 4:** `npx vitest run src/world/view.test.ts` → PASS; `npm test` y `npm run typecheck` → PASS.
- [ ] **Step 5:** commit `feat(#351): coverView fills the height with the 16:9 cover on narrow hosts`.

### Task 2: `clampToCover` y `zoneView`

**Archivos:**
- Modificar: `src/world/view.ts` (nueva `clampToCover`, `zoneView`)
- Test: `src/world/view.test.ts` (nuevo `describe("clampToCover")`, bloque `describe("zoneView")`)

**Interfaces:**
- Consume: `coverView` de la tarea 1; `clampToBleed` existente.
- Produce: `export function clampToCover(v: View, w: number, h: number): View` (decisión 3); `zoneView` aplica `clampToBleed(clampToCover(v, w, h), w, h)` en sus dos ramas.

- [ ] **Step 1: tests que fallan.**
  - `describe("clampToCover")`:
    - `"leaves a view already inside the cover untouched"`: `coverView(1600, 900)` a doble escala centrada (como el test de `clampToBleed`) → `clampToCover(z, 1600, 900)` `toEqual(z)`; también `coverView(390, 750)` sin cambios.
    - `"is idempotent"`: una vista `{ x: v.x + 5000, y: v.y − 3000, scale: v.scale·2 }` → `c = clampToCover(out, 1600, 900)`; `clampToCover(c, 1600, 900)` `toEqual(c)`, y el cuadro cubre `[0, 1600]×[0, 900]`.
    - `"only clamps the axes where the cover fits"`: escala `s = 900 / (qy1 − qy0)` en un host 2100×900 (el cuadro cubre el alto, no el ancho), vista desplazada `{ x: 12345, y: 6789, scale: s }` → resultado con `x === 12345` y `y` tal que el cuadro cubre `[0, 900]`.
  - `describe("zoneView")`: `ZONE_SIZES = [...COVER_SIZES, [768, 955], [390, 300], [1920, 955]]`. `it.each(ZONE_SIZES)("%i×%i: inside the bleed, and inside the 16:9 cover on each axis it covers")`: para las tres zonas, esquinas con `insideBleed(p, VIEW_INSET)`; si `(qx1 − qx0)·s >= w` todas las esquinas proyectadas (`(px − v.x)/s`) caen en `[qx0 − 1e-6, qx1 + 1e-6]`; lo mismo en y. Los tests existentes de `zoneView` (piso ≥ cover, 390×338 > 1,05, hito 640×900) se quedan.
- [ ] **Step 2:** `npx vitest run src/world/view.test.ts` → falla el import de `clampToCover` y el test por eje de `zoneView` (en 768×955 la zona hoy muestra selva sobre el cuadro).
- [ ] **Step 3: implementar** `clampToCover` (decisión 2 y 3, con JSDoc que diga que acota por eje al cuadro 16:9 donde entra a esa escala) y cambiar `zoneView` para que pase por `clampToCover` antes de `clampToBleed` en las dos ramas. Actualizar el JSDoc de `zoneView`.
- [ ] **Step 4:** `npm test` y `npm run typecheck` → PASS.
- [ ] **Step 5:** commit `feat(#351): zoneView clamps to the 16:9 cover where it fits`.

### Task 3: verificación visual y `COVER_FOCUS_U`

No es código: lo corre el orquestador con agent-browser después de las tareas 1 y 2 (script de evals `.scratch/evals-351.md`).

- [ ] **Step 1:** con `npm run dev -- --host --port 5173`, capturas de `http://localhost:5173/` en 390×750, 820×1180, 900×900, 1280×900, 1600×900, 1920×955 y de `/area/resume/`, `/area/portfolio/`, `/area/blog/` en 1920×955 y 390×750. Las de 1600×900 y 1920×955 también sobre `main` (worktree en `origin/main`) para compararlas píxel a píxel.
- [ ] **Step 2:** criterios §5: sin franja de suelo pelado o selva arriba en mapas con aspecto ≤ 16:9; en 390×750 la ciudad (ventanas encendidas) ocupa al menos un tercio del ancho y los tres rótulos están dentro del host; 1600×900 y 1920×955 idénticas a `main`.
- [ ] **Step 3:** si 0,35 no cumple el segundo criterio, ajustar `COVER_FOCUS_U`, rehacer las tareas 1–2 en verde y anotar valor y motivo en el PR.
- [ ] **Step 4:** las capturas van al PR (commit en `docs/superpowers/specs/assets/351-encuadre/`, enlazadas desde el cuerpo).

## Grilling

- Rondas: 1 (los cambios fueron de tolerancias y supuestos, sin pasos nuevos ni otra costura, así que no hizo falta una segunda). Griller: `fable`.
- Preguntas: 16. Respondidas con fuente: 11 (CODE 9, ISSUE 1, DOC 1). NO SOURCE: 5, todas supuestos técnicos (Assumptions 1–4 y 7).
- Corrección de un error del plan: la continuidad en 1919×1080 se comparaba con `coverFrame(16/9)` a 1e-3 en `y`, que no se cumple (0,28 px). Ahora se compara con la salida de la regla vieja, a 1 px y 1e-3 relativo.
- Aclarado: el test de 1280×900 vale para `COVER_FOCUS_U ≤ 0,40`.
- Issues abiertos: ninguno. Ambigüedades del spec: ninguna.
