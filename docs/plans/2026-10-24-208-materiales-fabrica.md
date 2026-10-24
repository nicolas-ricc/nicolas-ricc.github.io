# Materiales `signal`, `stockbrick` y `safety` y reglas de zona y altura (#208) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar el terreno de la fábrica detallada (#207): tres materiales nuevos en la paleta y las reglas de test de zona (materiales compartidos) y altura que las piezas nuevas van a necesitar, sin tocar escenas ni kit.

**Architecture:** Los materiales se agregan al atlas base (`BASE_TONES`) con la regla de ciudad/costa, y sus literales oscurecidos (× 0.7, `npm run palette`) se pegan en `ISO_TONES`; `Material` se deriva de `ISO_TONES`, así que el tipo crece solo. Las reglas de zona y altura viven en tests de escena (`factory.test.ts`, `world.test.ts`), que se aflojan de forma controlada.

**Tech Stack:** TypeScript, Vitest, tsx (`npm run palette`).

**Spec:** issue #208 (hijo de #207); diseño de la historia en `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` (decisiones 5 y 6 del plan de #207).

## Global Constraints

- Solo `src/map/palette-base.ts` y `src/map/palette-iso.ts` llevan literales hex (la guarda `palette-guard.test.ts` exime además los `.test.ts`).
- No tocar escenas (`src/scenes/*.ts` que no sean tests) ni el kit (`src/iso/`).
- `npm test` y `npm run typecheck` en verde al final de cada tarea.
- Los materiales nuevos se agregan **al final** de `BASE_TONES` y de `ISO_TONES` (el test "crepúsculo tardío" exige las mismas claves en el mismo orden).
- Regla de ciudad/costa por canal RGB: `lit = top × (0.82, 0.74, 0.62)`, `shade = top × (0.40, 0.42, 0.60)`, `up = top × (1.16, 1.12, 1.02)`, `down = top × (0.86, 0.88, 0.94)`, redondeado por canal, recortado a 255.

## Review Focus

1. Orden de claves: si un material nuevo queda en otra posición en un atlas, "crepúsculo tardío" falla; el implementador debe pegar al final en ambos. Lo cubre el test existente.
2. Tonos ordenados y sombra azulada: los tres nuevos deben pasar "cada material tiene cinco tonos ordenados" y "la sombra es más azul que roja". Lo cubren los tests existentes, que iteran todas las claves.
3. `up` que desborda 255 (`safety.up` rojo = 0xd9 × 1.16 = 251.9, casi al borde): la regla recorta; ningún canal desborda con estos valores, verificado al calcularlos abajo.
4. "En verde contra la escena actual": la escena de hoy comparte con la ciudad solo `rust` y `steel` (medido con `world(7)`), así que la regla de zona nueva no puede exigir igualdad exacta con `["glass", "office", "rust", "steel"]` hasta que la fábrica use vidrio y lila (#213, #216). Ver Task 2.
5. La regla de altura no debe dejar pasar sólidos anchos altos: el test sigue fallando si aparece un prisma ancho por encima de z 26 (se agrega un caso que lo comprueba con un sólido sintético).

---

### Task 1: Tres materiales nuevos en la paleta

**Files:**
- Modify: `src/map/palette-base.ts` (final de `BASE_TONES`)
- Modify: `src/map/palette-iso.ts` (final de `ISO_TONES`)
- Test: `src/map/palette-iso.test.ts`

**Interfaces:**
- Produces: `Material` incluye `"signal" | "stockbrick" | "safety"` (derivado de `ISO_TONES`); `ISO_TONES.signal|stockbrick|safety` y `BASE_TONES.signal|stockbrick|safety` con los cinco tonos.

- [ ] **Step 1: Write the failing test** en `describe("paleta isométrica")` de `src/map/palette-iso.test.ts`:

```ts
it("materiales de la fábrica detallada: balizamiento rojo, ladrillo amarillo y baranda amarilla", () => {
  const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
  const [sr, sg, sb] = rgb(ISO_TONES.signal.top);
  expect(sr).toBeGreaterThan(sg + 60);
  expect(sr).toBeGreaterThan(sb + 60);
  for (const m of ["stockbrick", "safety"] as const) {
    const [r, g, b] = rgb(ISO_TONES[m].top);
    expect(r).toBeGreaterThan(b + 40);
    expect(g).toBeGreaterThan(b + 40);
  }
});
```

No agregar los nuevos al test "materiales exclusivos de ciudad y costa" (son de Portfolio).

- [ ] **Step 2: Run** `npx vitest run src/map/palette-iso.test.ts` → FAIL (typecheck de vitest no corta; falla por `ISO_TONES.signal` indefinido: "Cannot read properties of undefined").

- [ ] **Step 3: Agregar al final de `BASE_TONES`** (valores calculados con la regla de ciudad/costa; ningún canal desborda):

```ts
  signal:    { top: 0xc0392b, lit: 0x9d2a1b, shade: 0x4d181a, up: 0xdf402c, down: 0xa53228 },
  stockbrick:{ top: 0xc9a86a, lit: 0xa57c42, shade: 0x504740, up: 0xe9bc6c, down: 0xad9464 },
  safety:    { top: 0xd9a62e, lit: 0xb27b1d, shade: 0x57461c, up: 0xfcba2f, down: 0xbb922b },
```

- [ ] **Step 4: Run `npm run palette`** y pegar sus tres últimas líneas de `// ISO_TONES` al final de `ISO_TONES`, precedidas por la línea `  // fábrica detallada (#207)`. No escribir los literales a mano.

- [ ] **Step 5: Run** `npx vitest run src/map` → PASS (incluye "crepúsculo tardío", tonos ordenados, sombra fría y la guarda de paleta).

- [ ] **Step 6: Commit** `feat(#208): materiales signal, stockbrick y safety`.

---

### Task 2: Reglas de zona y altura para la fábrica detallada

**Files:**
- Modify: `src/scenes/factory.test.ts:11-12` (`PORTFOLIO_MATS`, `slender`) y `:28-34` (test de altura)
- Modify: `src/scenes/world.test.ts:59-66`

**Interfaces:**
- Consumes: `Material` con `signal`, `stockbrick`, `safety` (Task 1).

- [ ] **Step 1: `PORTFOLIO_MATS`** suma, en este orden, `"whitewash", "glass", "office", "signal", "stockbrick", "safety"` al final de la lista actual.

- [ ] **Step 2: Regla de altura.** Extraer una función de módulo `tallOk(s: Solid): boolean` = `bounds(s).max.z <= 26 || slender(s)` y redefinir

```ts
const slender = (s: Solid) => (s.kind === "cylinder" && s.r <= 4) || (s.kind === "prism" && ((s.w <= 3 && s.d <= 3) || s.h <= 1)) || s.kind === "beam"; // chimeneas, mástiles, vigas y barandas
```

El test pasa a titularse `"nada apoya en agua y todo lo que supera z 26 es esbelto (cilindro r ≤ 4, prisma fino o viga)"` y usa `expect(tallOk(x)).toBe(true)` donde hoy compara contra 18. Agregar, en el mismo `describe`, el test

```ts
it("la regla de altura rechaza un sólido ancho por encima de z 26 y acepta vigas y cilindros finos", () => {
  const at = { x: 0, y: 0, z: 0 };
  expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 27, mat: "brick" })).toBe(false);
  expect(tallOk({ kind: "cylinder", at, r: 4.5, h: 27, mat: "brick" })).toBe(false);
  expect(tallOk({ kind: "cylinder", at, r: 4, h: 30, mat: "brick" })).toBe(true);
  expect(tallOk({ kind: "beam", from: at, to: { x: 0, y: 0, z: 30 }, w: 1, h: 1, mat: "steel" })).toBe(true);
  expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 26, mat: "brick" })).toBe(true);
});
```

(Si el tipo `prism` exige más campos, completarlos con los mínimos que pida el typecheck.)

- [ ] **Step 3: Regla de zona en `world.test.ts`.** Decisión técnica (declarada): la escena de hoy comparte con la ciudad solo `rust` y `steel`, y el criterio pide verde contra ella; la igualdad exacta con la lista nueva fallaría hasta que #213/#216 usen `glass` y `office`. La aserción pasa a "lo compartido es un subconjunto de lo permitido":

```ts
// glass: vidrio de fachadas; office: gris lila de la excavadora (decisión de #207). Subconjunto, no igualdad:
// hoy la fábrica todavía no los usa.
const sharedWithCity = ["glass", "office", "rust", "steel"];
for (const m of portfolio) if (cv.has(m)) expect(sharedWithCity).toContain(m);
```

y `sharedWithBlog` pasa a `["steel", "rust", "hull", "rock", "glass", "whitewash"]` con el comentario `// glass: la linterna del faro (spec §7); whitewash: porcelana y remates de la fábrica (#207)`.

- [ ] **Step 4: Run** `npx vitest run src/scenes/factory.test.ts src/scenes/world.test.ts` → PASS. Comprobar a mano que la regla muerde: cambiar temporalmente `26` por `5` en `tallOk` → el test de altura falla; revertir.

- [ ] **Step 5: Run** `npm test && npm run typecheck` → todo verde.

- [ ] **Step 6: Commit** `test(#208): reglas de zona y altura de la fábrica detallada`.
