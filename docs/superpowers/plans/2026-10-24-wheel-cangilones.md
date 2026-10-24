# Rueda de cangilones (`wheel` hueca, ranuras, cangilones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El sólido `wheel` gana `hollow`, `slots` y `buckets` (issue #211) sin cambiar la teselación de las ruedas que no los usan.

**Architecture:** Todo vive en `wheel()` de `src/iso/solids.ts`. Las caras nuevas son polígonos del plano de la rueda construidos con `wheelPoint(at, a, rho)` (o con un ayudante equivalente en coordenadas (u, z) del plano), con `normal: WHEEL_NORMAL`, `tone: "top"`; giran con `angle` porque todo ángulo se mide desde `s.angle`. `bounds` ya se calcula por vértices, así que no se toca.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`).

**Spec:** issue #211 (cuerpo) + `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` §4.4 + decisión 4 del plan de #207.

## Global Constraints

- Firma: `{ kind: "wheel"; at; r; width; mat; sides; angle; gondolas?; hollow?: boolean; slots?: number; buckets?: { n: number; depth: number; teeth: number; mat: Material } }`.
- Todas las caras nuevas: `normal: WHEEL_NORMAL`, `tone: "top"`, puntos con `x + y` constante (= `at.x + at.y`).
- La noria de la feria (`wheelSolid` en `src/scenes/fair.ts`) no cambia: sus tests siguen en verde sin tocarlos.
- Sin `hollow`, `slots` y `buckets`, `tessellateAll` devuelve exactamente lo de hoy (mismas caras, mismo orden).
- La guarda de paleta prohíbe literales hex fuera de `src/map/palette-base.ts` y `src/map/palette-iso.ts`.
- `npm test` y `npm run typecheck` en verde.

## Decisiones (supuestos técnicos declarados)

- **Ángulo dentro del plano** de un punto `p`: `atan2(p.z − at.z, (p.x − at.x)·WHEEL_U.x + (p.y − at.y)·WHEEL_U.y)`; crece de +u hacia +z (igual que `wheelPoint`).
- **Orden de emisión:** llanta exterior (sector k) y, si `hollow`, llanta interior (sector k) intercaladas por sector como hoy se intercalan sector y rayo; después las ranuras; después los cangilones (por cangilón: trapecio, malla, dientes); al final las góndolas, como hoy.
- **Llanta interior:** sectores de `r − 2.2·width` a `r − 1.2·width`, mismos ángulos que la exterior, `mat: s.mat`, `toneOffset 0`.
- **Ranuras:** rectángulo radial centrado en `angle + k·2π/slots`, ancho `width/3` (medio ancho `width/6`, igual que los rayos), de radio `r − 1.7·width` (mitad de la llanta interior) a `r − 0.5·width` (mitad de la exterior): cruzan el hueco de 0.2·width y se solapan con las dos llantas para no dejar costuras. `mat: s.mat`, `toneOffset 0`. `slots` sin `hollow` se ignora.
- **Cangilón k** (centro `c = angle + k·2π/n`, `h0 = 0.45·π/n`, `h1 = 0.3·π/n`): trapecio `[P(c−h0, r), P(c+h0, r), P(c+h1, r+depth), P(c−h1, r+depth)]` con `P = wheelPoint(at, ·, ·)`, `mat: buckets.mat`, `toneOffset 0`.
- **Malla:** los 4 vértices del trapecio escalados 0.6 respecto de su promedio (centroide de vértices), `mat: buckets.mat`, `toneOffset −2`, emitida justo después del trapecio.
- **Dientes:** borde delantero = segmento `E0 = P(c+h0, r)` → `E1 = P(c+h1, r+depth)`. Diente j (j = 0..teeth−1): triángulo equilátero de lado `s = depth/3` con base sobre el borde, centrada en `E0 + (E1 − E0)·(j + 0.5)/teeth`, y vértice a `s·√3/2` de la base en la dirección del plano perpendicular al borde que se aleja del centro del trapecio (hacia el ángulo mayor). `mat: buckets.mat`, `toneOffset 0`.
- `buckets` funciona con o sin `hollow` (sobresale de la llanta exterior, que existe siempre).
- Conteo: `hollow` + `slots` + `buckets` = `2·sides + slots + n·(2 + teeth)`; sin góndolas, todas en el plano.

## Assumptions

Decisiones técnicas sin fuente explícita (salieron del grilling; van a la descripción del PR):

- **Extensión radial de las ranuras** `r − 1.7·width .. r − 0.5·width`. El issue dice "barras radiales de ancho `width/3` que unen las dos llantas", sin radios. Alternativa descartada: exactamente el hueco `r − 1.2·width .. r − width` (bordes coincidentes con las llantas, riesgo de costura de antialias entre polígonos del mismo color).
- **Reparto de los dientes**: equiespaciados a lo largo del borde delantero (centro del diente j en la fracción `(j + 0.5)/teeth`), equiláteros, vértice hacia afuera del trapecio. Alternativa descartada: dientes en la punta exterior del borde (se encimarían con `teeth > 1`).
- **Centro de la malla** = promedio de los 4 vértices del trapecio ("mismo centro" del issue). Alternativa descartada: centroide de área (difiere poco y complica el test).
- **`buckets` sin `hollow`** se permite (sobresalen de la llanta exterior, que existe siempre). El issue no lo prohíbe; restringirlo por tipo complicaría la unión sin beneficio.
- **Entradas degeneradas** (`depth ≤ 0`, `n ≤ 0`, `teeth < 0`, `slots` no entero, `r − 2.2·width ≤ 0`) son responsabilidad del llamador, como hoy: `wheel()` no valida `sides`, `r` ni `width` (`src/iso/solids.ts:215-239`). Con `n`, `teeth` o `slots` ≤ 0 los bucles simplemente no emiten nada.


1. Rueda sin opciones nuevas (la noria): teselación idéntica byte a byte → snapshot inline tomado **antes** del cambio (Task 1).
2. `hollow` sin `slots` (o `slots: 0`): `2·sides` caras, sin rayos ni cubo → test en Task 1.
3. `buckets` sin `hollow`: rayos y cubo siguen; suma `n·(2 + teeth)` caras → test en Task 2.
4. `teeth: 0`: cada cangilón aporta 2 caras (trapecio + malla), nada se rompe → test en Task 2.
5. Con góndolas y cangilones a la vez: las góndolas siguen idénticas (mismas caras `gondolas.mat` que sin cangilones) → test en Task 2.

---

### Task 1: Snapshot de no regresión, llanta doble (`hollow`) y ranuras (`slots`)

**Files:**
- Modify: `src/iso/solids.ts` (tipo `Solid` línea ~20, `wheel()` líneas ~214–242)
- Test: `src/iso/solids.test.ts` (`describe("wheel")`)

**Interfaces:**
- Consumes: `wheelPoint`, `WHEEL_U`, `WHEEL_NORMAL`, `tessellate`, `tessellateAll`, `bounds` (existentes).
- Produces: tipo `wheel` con `hollow?: boolean; slots?: number` (el campo `buckets` lo declara Task 2, junto con su implementación, para no dejar un campo muerto en un commit intermedio). En el test, un ayudante `planeAngle(at: Vec3, p: Vec3): number` y `planeRadius(at: Vec3, p: Vec3): number` (distancia en el plano: `hypot(dot(p − at, WHEEL_U), p.z − at.z)`) que Task 2 reutiliza.

- [ ] **Step 1: Snapshot de hoy (antes de tocar `solids.ts`)**

Test `"wheel: sin opciones nuevas tesela exactamente igual que antes de #211"`: rueda `{ at: v3(10, 4, 6), r: 3, width: 0.5, mat: "steel", sides: 3, angle: 0.3, gondolas: { mat: "rust", w: 0.6, d: 0.4, h: 0.5 } }`. Serializar `tessellateAll(w)` a una línea por cara: `` `${mat} ${tone} ${toneOffset} n=(nx,ny,nz) ` `` + puntos con `toFixed(4)`, y `expect(lines.join("\n")).toMatchInlineSnapshot()`. Correr `npx vitest run src/iso/solids.test.ts -u` con `solids.ts` intacto para que vitest escriba el snapshot; verificar que quedó escrito en el archivo.

- [ ] **Step 2: Tests que fallan**

- `"wheel hueca con ranuras: llanta doble, sin rayos ni cubo, todo en el plano"`: `w = { at: v3(-14, 60, 9.2), r: 5.5, width: 0.5, mat: "rust", sides: 28, angle: 0, hollow: true, slots: 28 }`. `faces = tessellateAll(w)`: longitud `2·28 + 28`; ningún punto con `planeRadius < 5.5 − 2.2·0.5 − 1e-6`; toda cara `normal === WHEEL_NORMAL` (o igual componente a componente), `tone "top"`, cada punto `x + y ≈ 46` (6 decimales); `tessellate(w).length === faces.length`.
- `"wheel hueca sin ranuras: 2·sides caras"`: misma rueda sin `slots` → `56`; con `slots: 0` → `56`.
- `"ranuras: centradas en angle + k·2π/slots y unen las dos llantas"`: con `slots: 4`, `sides: 8`, las 4 caras después de las 16 de llanta tienen su centroide a ángulo `angle + k·π/2` (±1e-6, módulo 2π) y radio mínimo `< r − 1.2·width` y máximo `> r − width`. Con `angle: 0.2` los centroides se corren 0.2.
- `"tessellate no descarta caras de la rueda (vieja y hueca)"`: para la rueda vieja sin góndolas (`sides 16`, rayos y cubo) y la hueca con ranuras, `tessellate(w).length === tessellateAll(w).length`.

- [ ] **Step 3: Correr y ver fallar**

Run: `npx vitest run src/iso/solids.test.ts`
Expected: fallan los tests de hueca/ranuras (y `npm run typecheck` falla por las propiedades desconocidas); el snapshot y el resto pasan.

- [ ] **Step 4: Implementar en `wheel()`**

Agregar los campos al tipo. Con `hollow`: no emitir rayos ni cubo; por sector emitir sector exterior y luego sector interior (`r − 2.2·width .. r − 1.2·width`); luego `slots` ranuras según "Decisiones". Sin `hollow`, el camino de hoy sin cambios.

- [ ] **Step 5: Verde**

Run: `npx vitest run src/iso/solids.test.ts && npm run typecheck`
Expected: PASS, snapshot intacto.

- [ ] **Step 6: Commit** — `feat(#211): wheel hueca con llanta doble y ranuras`

### Task 2: Cangilones (`buckets`): trapecio, malla y dientes

**Files:**
- Modify: `src/iso/solids.ts` (`wheel()`)
- Test: `src/iso/solids.test.ts` (`describe("wheel")`)

**Interfaces:**
- Consumes: tipo con `hollow`/`slots` y ayudantes de test `planeAngle`, `planeRadius` (Task 1).
- Produces: campo `buckets?: { n: number; depth: number; teeth: number; mat: Material }` en el tipo `wheel`.
- Produces: nada nuevo exportado; #216 usará `buckets: { n: 14, depth: 1.2, teeth: 2, mat: "rust" }`.

- [ ] **Step 1: Tests que fallan** (rueda base `B = { at: v3(-14, 60, 9.2), r: 5.5, width: 0.5, mat: "rust", sides: 28, angle: 0, hollow: true, slots: 28, buckets: { n: 14, depth: 1.2, teeth: 2, mat: "steel" } }`; usar `mat: "steel"` en los cangilones para separarlos por material)

- `"cangilones: 2·sides + slots + n·(2 + teeth) caras, todas en el plano"`: `tessellateAll(B).length === 56 + 28 + 14·4`; todas `tone "top"`, normal `WHEEL_NORMAL`, `x + y ≈ 46`; `tessellate(B).length` igual.
- `"cangilones: el trapecio llega a r + depth"`: tomar por cangilón k el bloque de 4 caras `steel` (trapecio, malla, diente, diente). El trapecio tiene 4 puntos; dos con `planeRadius ≈ 5.5` y dos `≈ 6.7` (±1e-6).
- `"cangilones: la malla es el 60 % interior con toneOffset −2"`: la segunda cara del bloque tiene `toneOffset −2`, mismo promedio de vértices que el trapecio (±1e-6) y cada vértice a 0.6 de la distancia del correspondiente del trapecio a ese promedio; trapecio y dientes `toneOffset 0`.
- `"cangilones: los dientes van del lado de mayor ángulo"`: para cada diente del cangilón k, la diferencia de ángulo (normalizada a (−π, π]) entre su centroide y `c_k = angle + k·2π/n` está en `(0.3·π/n, π/n)`; cada diente tiene 3 puntos y lados `≈ depth/3` (±1e-6).
- `"cangilones: girar π/n mueve el cangilón 0 y conserva la cantidad de caras"`: `B2 = { ...B, angle: Math.PI / 14 }`; mismas caras en número; los puntos del trapecio del cangilón 0 difieren (alguno a > 0.1 de distancia) y su centroide tiene ángulo `π/14` (±1e-6).
- `"cangilones: bounds incluye r + depth"`: con `angle: Math.PI / 2` (cangilón 0 arriba), `bounds(B).max.z > 9.2 + 5.5 + 0.9·1.2` y `≤ 9.2 + 5.5 + 1.2 + 1e-6`.
- `"cangilones sin hollow: rayos y cubo siguen"`: `{ ...B, hollow: undefined, slots: undefined }` → `28 + 28 + 1 + 14·4` caras.
- `"cangilones con teeth 0"`: `n·2` caras de cangilón.
- `"cangilones con góndolas: las góndolas no cambian"`: rueda con `gondolas` con y sin `buckets`: las caras de `gondolas.mat` (usar `"glass"`) son iguales (`toEqual`).

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/iso/solids.test.ts`
Expected: FAIL en los tests de cangilones.

- [ ] **Step 3: Implementar** — declarar `buckets` en el tipo y emitir según "Decisiones" (trapecio, malla, dientes; después de llantas/ranuras/rayos/cubo y antes de góndolas). Actualizar el docstring de `wheel()` para nombrar las opciones nuevas.

- [ ] **Step 4: Verde completo**

Run: `npm test && npm run typecheck`
Expected: todo PASS (incluidos los tests de la feria sin tocarlos y el snapshot de Task 1).

- [ ] **Step 5: Commit** — `feat(#211): cangilones con dientes y malla en wheel`

## Grilling

- Rondas: 1 (los cambios fueron menores: mover la declaración de `buckets` a Task 2 y agregar `## Assumptions`; no cambió ninguna costura ni se agregaron pasos).
- Preguntas: 16. Fuentes: ISSUE 8 (1, 2, 11, 12 parcial, 13 parcial, 15, más los valores de 12), CODE 10 (3 `render-list.ts:38`, 4 `solids.ts:264-266`, 5 `solids.ts:219-228`, 6 `palette-iso.ts:85-90`, 7 `solids.ts:210-212`, 8 `palette-iso.ts`, 9 `solids.ts:270-279`, 11 `fair-anim.ts:41`, 14, 16 `solids.ts:231-237`), DOC 0, NO SOURCE 4 → todas supuestos técnicos (ranuras, dientes, centro de malla, degenerados) y ninguna ambigüedad de spec ni fuera de alcance.
- Supuestos: ver `## Assumptions`.
- Issues abiertos: ninguno.
