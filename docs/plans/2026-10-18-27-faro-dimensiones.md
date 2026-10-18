# Dimensiones con nombre en el faro (#27): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que `lighthouse()` en `src/scenes/sea.ts` no use literales para radios ni alturas. La galería, los postes, la linterna y la tapa pasan a constantes con nombre, derivadas de los tambores donde la relación es geométrica, y la geometría queda idéntica bit a bit.

**Architecture:** todo pasa en la cabecera de constantes de `src/scenes/sea.ts` (líneas 28-31) y en `lighthouse()` (líneas 43-54). Se agrega una constante privada `DRUM_TOP_R` (radio del último tambor), de la que salen `GALLERY_R` (sin cambiar su valor) y `LANTERN_R`. `GALLERY_DECK_R` sale de `GALLERY_R` y `POST_W`, y `CAP_R` sale de `LANTERN_R`. Las cinco constantes nuevas se exportan igual que `GALLERY_R` y `DRUM_R0`, para que `sea.test.ts` las fije.

**Tech Stack:** TypeScript y Vitest (`environment: "node"`). Sin Pixi: `sea()` es lógica pura.

**Spec:** issue #27 y su Agent Brief (comentario de triage). Fuera de alcance: cambiar la silueta del faro.

## Global Constraints

- Criterio 1: `lighthouse()` no contiene literales numéricos para radios ni alturas. Solo aparecen literales en las definiciones de las constantes con nombre.
- Criterio 2: los tests del mar y el baseline de polígonos no cambian. Ningún test existente de `src/scenes/sea.test.ts` se edita ni se borra. `JSON.stringify(sea(createRng(7)))` tiene que dar el mismo sha256 antes y después: `3cb0759d29acc7bacea268e56ac898cd4529f2e926313d408a4aaa02814d3f63`, medido en `main` 6c806ed. El render list (`buildRenderList([...ground, ...solids])`, 614 instrucciones, sha256 `d9901a5c…`) se deriva de la escena, así que queda cubierto.
- Criterio 3: `npm test` y `npm run typecheck` en verde.
- Nombres pedidos por el brief: `GALLERY_DECK_R`, `POST_W`, `POST_H`, `LANTERN_R`, `CAP_R`.
- Comentarios y nombres de tests en castellano, como el resto de `src/scenes`. Los tests de las dos tasks se commitean juntos, en rojo, antes de implementar (`test(#27): evals`). Cada task commitea después solo su implementación (`refactor(#27): …`), como en el historial (`git log`: `test(#21): …`, `fix(#25): …`).

## Decisiones técnicas (declaradas)

1. **Derivaciones.** Con `DRUM_TOP_R = DRUM_R0 - (DRUMS - 1) * DRUM_STEP` (2.2):
   - `GALLERY_R = DRUM_TOP_R + 0.5`. Es la misma expresión de hoy con el primer término nombrado. La suma sigue asociando por la izquierda, así que da el mismo double.
   - `POST_W = 0.3` y `POST_H = 1.2`. Son medidas propias del poste: no tienen relación geométrica con los tambores.
   - `GALLERY_DECK_R = GALLERY_R + POST_W` (3). El disco sobresale media sección de poste por fuera de la baranda.
   - `LANTERN_R = DRUM_TOP_R - 0.6` (1.6). La linterna queda retranqueada respecto del último tambor, así que sigue al fuste si cambian los tambores.
   - `CAP_R = LANTERN_R + 0.2` (1.8). Es el alero de la tapa sobre la linterna.
   Verificado con node: `GALLERY_R + 0.3 === 3`, `(3.2 - 5 * 0.2) - 0.6 === 1.6` y `1.6 + 0.2 === 1.8` dan `true`, así que no se mueve ningún bit.
2. **El offset `- 0.15` del poste pasa a `POST_W / 2`.** `0.3 / 2 === 0.15` es exacto. El offset es la mitad de la sección: centra el prisma sobre el círculo de la baranda.
3. **Los conteos no son dimensiones.** Quedan como están el 8 de los postes, los lados del vidrio y del cono (`8`), `k / 8`, `Math.PI * 2`, `i % 2` y `LANTERN_H / 2`, que es el centro de la linterna. El criterio pide nombrar radios y alturas.
4. **Exportar las constantes.** Se exportan para que el test las fije, igual que `GALLERY_R`, que ya se exporta y se testea en `sea.test.ts:83`. `DRUM_TOP_R` queda privada: nadie fuera del módulo la necesita.
5. **El sha256 de la escena no entra en la suite.** Un hash de la escena entera rompería ante cualquier cambio legítimo del mar y no explicaría por qué. Se usa como verificación puntual (`.scratch/evals-27.md`) antes y después de la implementación. Los tests nuevos de la suite fijan los valores legibles (3, 1.6, 1.8, 0.3, 1.2) y que la escena los use.

## Review Focus

1. **Deriva de punto flotante.** Una derivación reordenada, como `DRUM_R0 + 0.5 - (DRUMS - 1) * DRUM_STEP`, puede dar `2.7000000000000006` y cambiar la geometría sin que lo vea un `toBeCloseTo`. Los tests nuevos comparan con `toBe` (igualdad exacta), y la verificación del sha256 cubre toda la escena.
2. **El disco de la galería se confunde con otro cilindro de acero.** La boya del pecio también es un cilindro `steel`. El test filtra por `x`/`y` del faro y por `h === GALLERY_H` (0.6).
3. **Literales que sobreviven en `lighthouse()`.** Lo cubre la verificación por grep de `.scratch/evals-27.md` sobre el cuerpo de la función.
4. **`sea()` sigue usando `GALLERY_R`** para las luces de la galería. Su valor no cambia: lo fija el test existente de la línea 83 y uno nuevo con `toBe`.
5. **`lab/exhibits.ts` importa `DRUM_R0`.** La firma pública no cambia y el typecheck lo confirma.

---

### Task 1: galería (disco y postes) con nombre

**Files:**
- Modify: `src/scenes/sea.ts:28-31` (constantes) y `src/scenes/sea.ts:47-48` (disco y postes)
- Test: `src/scenes/sea.test.ts`

**Interfaces:**
- Produces: `export const POST_W = 0.3`, `export const POST_H = 1.2`, `export const GALLERY_DECK_R = GALLERY_R + POST_W`, más la constante privada `DRUM_TOP_R = DRUM_R0 - (DRUMS - 1) * DRUM_STEP`, que la Task 2 usa para `LANTERN_R`.

- [ ] **Step 1: test que falla** (ya commiteado en la etapa de evals; si falta, agregarlo). Agregar `GALLERY_DECK_R, POST_H, POST_W` al import de `./sea`, el alias `type Cyl = Extract<Solid, { kind: "cylinder" }>;` debajo de `const water`, y este test dentro de `describe("sea", …)`. Los filtros usan type guards porque `poly`, `strip` y `ground` no tienen `at` (`src/iso/solids.ts:12,17,18`):

```ts
  it("galería del faro: disco y postes con medidas nombradas, sin mover un bit (#27)", () => {
    const s = scene();
    expect([GALLERY_R, GALLERY_DECK_R, POST_W, POST_H]).toEqual([2.7, 3, 0.3, 1.2]);
    const deck = s.solids.filter((x): x is Cyl => x.kind === "cylinder" && x.mat === "steel" && x.h === 0.6 && x.at.x === LIGHTHOUSE.x && x.at.y === LIGHTHOUSE.y);
    expect(deck.map((d) => d.r)).toEqual([GALLERY_DECK_R]);
    const posts = s.solids.filter((x): x is Extract<Solid, { kind: "prism" }> => x.kind === "prism" && x.mat === "steel" && x.w === POST_W && x.d === POST_W && x.h === POST_H);
    expect(posts).toHaveLength(8);
    for (const p of posts) expect(Math.hypot(p.at.x + POST_W / 2 - LIGHTHOUSE.x, p.at.y + POST_W / 2 - LIGHTHOUSE.y)).toBeCloseTo(GALLERY_R, 9);
  });
```

- [ ] **Step 2: correr y ver el fallo.** `npx vitest run src/scenes/sea.test.ts`. Expected: FAIL, porque las constantes importadas son `undefined`.
- [ ] **Step 3: implementación mínima** en `sea.ts`:

```ts
const DRUMS = 6, DRUM_H = 4, DRUM_STEP = 0.2, GALLERY_H = 0.6, LANTERN_H = 3, CAP_H = 2;
const DRUM_TOP_R = DRUM_R0 - (DRUMS - 1) * DRUM_STEP;
/** Galería de neón y postes de la baranda: último tambor + 0.5. Las luces van a la altura de la plataforma (lantern.z − 2). */
export const GALLERY_R = DRUM_TOP_R + 0.5;
export const POST_W = 0.3, POST_H = 1.2;
/** El disco sobresale media sección de poste por fuera de la baranda. */
export const GALLERY_DECK_R = GALLERY_R + POST_W;
```

  y en `lighthouse()`:

```ts
  out.push(cyl(x, y, z, GALLERY_DECK_R, GALLERY_H, "steel")); z += GALLERY_H;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; out.push(prism(x + GALLERY_R * Math.cos(a) - POST_W / 2, y + GALLERY_R * Math.sin(a) - POST_W / 2, z, POST_W, POST_W, POST_H, "steel")); }
```

- [ ] **Step 4: correr.** `npx vitest run src/scenes/sea.test.ts` y `npm run typecheck` en verde. Medir el sha256 con el script de `.scratch/evals-27.md`: tiene que seguir dando `3cb0759d…3f63`. Si cambió, la Task 1 lo rompió.
- [ ] **Step 5: commit.** Solo `src/scenes/sea.ts`: `git commit -m "refactor(#27): galería del faro con medidas nombradas" src/scenes/sea.ts`

### Task 2: linterna y tapa con nombre

**Files:**
- Modify: `src/scenes/sea.ts` (constantes, después de `GALLERY_DECK_R`) y `src/scenes/sea.ts:49,52` (linterna y tapa)
- Test: `src/scenes/sea.test.ts`

**Interfaces:**
- Consumes: `DRUM_TOP_R` (privada, Task 1).
- Produces: `export const LANTERN_R = DRUM_TOP_R - 0.6`, `export const CAP_R = LANTERN_R + 0.2`.

- [ ] **Step 1: test que falla** (ya commiteado en la etapa de evals). Agregar `CAP_R, LANTERN_R` al import y este test, que reusa el alias `Cyl` de la Task 1:

```ts
  it("linterna y tapa del faro con radios nombrados, retranqueadas del último tambor (#27)", () => {
    const s = scene();
    expect([LANTERN_R, CAP_R]).toEqual([1.6, 1.8]);
    const glass = s.solids.filter((x): x is Cyl => x.kind === "cylinder" && x.mat === "glass" && x.at.x === LIGHTHOUSE.x && x.at.y === LIGHTHOUSE.y);
    expect(glass.map((g) => g.r)).toEqual([LANTERN_R]);
    const cap = s.solids.filter((x): x is Extract<Solid, { kind: "cone" }> => x.kind === "cone" && x.mat === "steel" && x.at.x === LIGHTHOUSE.x && x.at.y === LIGHTHOUSE.y);
    expect(cap.map((c) => c.r)).toEqual([CAP_R]);
  });
```

- [ ] **Step 2: correr y ver el fallo.** `npx vitest run src/scenes/sea.test.ts`. Expected: FAIL (`undefined`).
- [ ] **Step 3: implementación mínima.** Después de `GALLERY_DECK_R`:

```ts
/** Linterna retranqueada respecto del último tambor; la tapa la cubre con un alero de 0.2. */
export const LANTERN_R = DRUM_TOP_R - 0.6, CAP_R = LANTERN_R + 0.2;
```

  y en `lighthouse()`, `cyl(x, y, z, LANTERN_R, LANTERN_H, "glass", 8)` y `r: CAP_R` en el cono.
- [ ] **Step 4: correr.** `npm test` y `npm run typecheck` en verde. Volver a medir el sha256 de `JSON.stringify(sea(createRng(7)))` con el script de `.scratch/evals-27.md`: tiene que dar `3cb0759d…3f63`. Hacer el grep del criterio 1 sobre el cuerpo de `lighthouse()`.
- [ ] **Step 5: commit.** `git commit -m "refactor(#27): linterna y tapa del faro con radios nombrados" src/scenes/sea.ts`

## Assumptions

- **El divisor `/ 2` no es una dimensión.** `POST_W / 2` y `LANTERN_H / 2` aplican un factor de forma (la mitad) a constantes con nombre. El criterio 1 habla de "literales numéricos para radios ni alturas". Grep del criterio: `sed -n '/^function lighthouse/,/^}/p' src/scenes/sea.ts | grep -oE '\b[0-9]+(\.[0-9]+)?\b' | sort -u` tiene que devolver solo `0 2 8`. Hoy devuelve `0 0.15 0.3 1.2 1.6 1.8 2 3 8`. Alternativa descartada: nombrar `HALF = 0.5` (ruido).
- **El import de `sea.test.ts` no es un test.** Se agregan nombres al import y un alias de tipo; ningún `it(…)` existente cambia. Alternativa descartada: un archivo de test aparte, que duplicaría `scene()`.
- **`DRUM_TOP_R` no se testea directo.** `GALLERY_R === 2.7` (exacto) la fija, porque `GALLERY_R = DRUM_TOP_R + 0.5`. Alternativa descartada: exportarla solo para el test.
- **Los postes no siguen al fuste.** Su sección no tiene relación geométrica con el radio de los tambores: el brief pide derivar "donde la relación es geométrica". La linterna sí la tiene, porque se apoya sobre el último tambor.
- **La posición exacta de cada poste no tiene `toBe`.** La protegen el sha256 y el hecho de que `0.3 / 2 === 0.15` es exacto en double, así que la expresión da el mismo resultado.
- **Baseline en HEAD de la rama.** El commit del plan solo toca `docs/`. Igual, la etapa de evals vuelve a medir el sha256 antes de la Task 1.

## Contenido de `.scratch/evals-27.md` (lo crea la etapa de evals; ignorado vía `.git/info/exclude`)

1. Hash: un `src/scenes/zz-h.test.ts` temporal que escribe en `/tmp/h.out` el sha256 de `JSON.stringify(sea(createRng(7)))` y el de `buildRenderList([...s.ground, ...s.solids])` con su largo. Se corre con `npx vitest run src/scenes/zz-h.test.ts` y se borra. Esperado: `SCENE 3cb0759d29acc7bacea268e56ac898cd4529f2e926313d408a4aaa02814d3f63` y `RL d9901a5cf91a02473b85f75b57f63fa404437911df60a217cba3a7a946472d70 614`.
2. Grep del criterio 1 (ver Assumptions): esperado `0 2 8`.
3. No hay UI que cambie. La geometría es idéntica bit a bit, así que no hace falta un script de agent-browser: el hash de la escena es más estricto que una captura.

## Grilling

- Rondas: 1. Los cambios fueron correcciones: type guards, medir el hash por task, la convención de commits y las Assumptions. No hubo pasos nuevos ni costuras distintas, así que no se corrió una segunda ronda.
- Preguntas: 18. CODE: 11 (Q3, Q4, Q5, Q7, Q8, Q10, Q11, Q13, Q14, Q17, Q18). ISSUE: 1 (Q12). NO SOURCE como supuesto técnico: 6 (Q1, Q2, Q6, Q9, Q15, Q16), resueltos en Assumptions o en los pasos.
- Spec ambiguity: ninguna.
- Fuera de alcance: las luces de la galería en `sea()` (`sea.ts:159`) repiten el conteo `8` y la altura `lantern.z - 2`, que depende implícitamente de `LANTERN_H`. Abierto como #130.
