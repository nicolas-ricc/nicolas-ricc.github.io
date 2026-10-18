# Guard de paleta sobre `lab/*.html` (#112): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el guard de paleta también recorra `lab/*.html` y falle si alguna página del lab escribe un literal hex que no sea un color de la paleta iso.

**Architecture:** `#d8d4e8`, el color del texto del lab, entra a `ISO_COLORS` como `ink` y queda fuera de `AccentColor`. `src/map/palette-guard.test.ts` suma un segundo `describe` que lee cada `lab/*.html`, extrae los literales `#` hex y exige que cada uno sea un valor de `allIsoColors()`. El fondo sigue en el `<style>` de cada página: el brief descarta moverlo a TypeScript.

**Tech Stack:** TypeScript, Vitest, `node:fs`.

**Spec:** issue #112 y su Agent Brief (comentario de triage).

## Global Constraints

- Decisión del brief: "extender el guard a `lab/*.html`, sin mover el fondo a TypeScript".
- Regla del brief: "cada literal hex de 6 dígitos que encuentre sea un valor de la paleta iso (`ISO_COLORS` o algún tono de `ISO_TONES`)".
- `#d8d4e8` "se reemplaza por el valor de paleta más cercano o se agrega a `ISO_COLORS` con nombre (por ejemplo `ink`) si no hay uno".
- Fuera de alcance: `index.html` (hoy no tiene literales hex, así que pasa sin cambios).
- `npm test` y `npm run typecheck` en verde. Texto y nombres de test en castellano, como el resto del repo. Commits `test(#112): …`, `feat(#112): …`.

## Datos

- Las cinco páginas (`blog`, `portfolio`, `resume`, `storybook`, `world`) tienen la misma línea 9: `background: #100e19; /* = ISO_COLORS.sky en src/map/palette-iso.ts */ color: #d8d4e8;`.
- `ISO_COLORS.sky = 0x100e19` (`src/map/palette-iso.ts`).
- `#d8d4e8` = (216, 212, 232). El valor más claro de `ISO_TONES` es `whitewash.up = 0xaea289` (174, 162, 137): está a más de 40 por canal, así que no hay un valor "cercano" y se agrega `ink`. Los acentos (`cyan` `0x7cf5ff`, `amber`, `magenta`) son saturados y cambiarían el aspecto del lab.
- `AccentColor = Exclude<keyof typeof ISO_COLORS, "shadow" | "sky">`. Si `ink` entra a `ISO_COLORS` sin sumarse a ese `Exclude`, pasa a ser un color de acento válido para los neones, y no lo es.
- `allIsoColors()` arma su conjunto con `Object.values(ISO_COLORS)` más todos los tonos, así que `ink` entra solo. Los tests de escena que exigen que cada color dibujado esté en `allIsoColors()` siguen pasando: el conjunto crece, no se achica.
- `palette-guard.test.ts` resuelve `src/` con `new URL("../", import.meta.url).pathname`; `lab/` está en `new URL("../../lab/", import.meta.url)`.

## Decisiones técnicas (declaradas)

1. **`ink` no se oscurece.** Va en `ISO_COLORS` como literal, igual que los acentos, y no en `palette-base.ts`: es el color del texto HTML, no un tono de la escena, y `npm run palette` no lo imprime.
2. **Qué cuenta como literal.** El guard busca `/#[0-9a-fA-F]{3,8}\b/g`. Uno de 3, 4 u 8 dígitos (`#fff`, `#100e19ff`) nunca coincide con un valor de la paleta y por eso falla, así no se puede saltar el guard escribiendo el color abreviado. La comparación ignora mayúsculas (`#100E19` pasa). Un selector de id que sea todo hex (`#bad`, `#face`) también fallaría: hoy no hay ninguno y el mensaje del fallo lo deja a la vista.
3. **Notación `rgb()`/`rgba()`.** No se vigila: el brief habla de literales hex. `rgba(255, 255, 255, 0.12)` en `storybook.html` queda como está (es un velo de opacidad, no un color de la paleta).
4. **El criterio 1 queda ejecutable.** Además de la verificación a mano (cambiar `#100e19` y ver fallar el test), un test unitario del extractor del guard comprueba que `#100e1a` se reporta y `#100e19` no.
5. **El comentario CSS** de cada página pasa a nombrar a los dos colores y al guard, así quien lo edite sabe que hay un test. Solo cambia el comentario: las declaraciones quedan en su orden.

## Review Focus

1. Un hex en mayúsculas (`#100E19`) es un valor de paleta válido: el guard no debe fallar. Lo cubre un test del extractor en la tarea 2.
2. Un hex abreviado o con alfa (`#fff`, `#100e19ff`) no debe escapar al guard. Lo cubre un test del extractor en la tarea 2.
3. Si alguien agrega una página nueva al lab, el guard la recorre sin tocar la lista: se listan con `readdirSync`. La tarea 2 exige al menos las cinco actuales e incluye `world.html` por nombre.
4. `ink` no debe aparecer como color de acento. Un `@ts-expect-error` en la tarea 1 fija que `"ink"` no es un `AccentColor`.
5. Un color dentro de un comentario HTML o CSS también se vigila: el guard lee el archivo entero. Es intencional, porque un comentario con un hex desactualizado engaña igual que el código.

## Assumptions

Decididas en el grilling (sin fuente escrita; cualquier opción cumple el issue):

- **"Más cercano" no está definido en el brief.** Se toma que no hay valor cercano porque el candidato más claro (`whitewash.up`, `0xaea289`) cambiaría a la vista el texto del lab: más oscuro y cálido. Alternativa descartada: reemplazar `#d8d4e8` por `whitewash.up`.
- **`index.html` no entra al guard.** El brief lo deja fuera "salvo que ya pase el guard sin cambios"; hoy no tiene hex, pero el guard se llama "en lab/*.html" y el issue habla del lab. Alternativa descartada: sumarlo a la lista del guard.
- **Solo un nivel de `lab/`.** `find lab -type d` devuelve solo `lab`, y el brief dice `lab/*.html`. Alternativa descartada: recorrer subcarpetas.
- **Orden TDD.** En la etapa de evals se escriben los tests de las dos tareas antes de la implementación, así el RED de la tarea 2 (`["#d8d4e8"]` en las cinco páginas) se ve antes de que exista `ink`.

---

### Task 1: `ink` en la paleta

**Files:**
- Modify: `src/map/palette-iso.ts` (`ISO_COLORS`, `AccentColor`, comentario de cabecera)
- Test: `src/map/palette-iso.test.ts`

**Interfaces:**
- Produces: `ISO_COLORS.ink === 0xd8d4e8`; `AccentColor = Exclude<keyof typeof ISO_COLORS, "shadow" | "sky" | "ink">`; `allIsoColors().has(0xd8d4e8)`.

- [ ] **Step 1: Write the failing test** (al final del `describe` principal de `src/map/palette-iso.test.ts`, que ya importa `ISO_COLORS`, `ACCENT_COLORS` y `allIsoColors`; agregar `type AccentColor` al import)

```ts
  it("ink, el texto de las páginas del lab, está en la paleta y no es un acento", () => {
    expect(ISO_COLORS.ink).toBe(0xd8d4e8);
    expect(allIsoColors().has(ISO_COLORS.ink)).toBe(true);
    expect(ACCENT_COLORS).not.toContain("ink");
    // @ts-expect-error ink no es un color de acento
    const accent: AccentColor = "ink";
    expect(accent).toBe("ink");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/map/palette-iso.test.ts`
Expected: FAIL, `expected undefined to be 14210280`.

- [ ] **Step 3: Write minimal implementation** en `src/map/palette-iso.ts`

Agregar al final de `ISO_COLORS`, después de `magentaBleed`:

```ts
  ink: 0xd8d4e8, // texto de las páginas del lab (lab/*.html); no se oscurece
```

Cambiar `AccentColor`:

```ts
export type AccentColor = Exclude<keyof typeof ISO_COLORS, "shadow" | "sky" | "ink">;
```

Agregar al final del comentario de cabecera, antes de `*/`:

```
 * `sky` e `ink` también están escritos a mano en el `<style>` de `lab/*.html`; `palette-guard.test.ts`
 * exige que todo hex de esas páginas sea un valor de esta paleta.
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/map/palette-iso.test.ts && npm run typecheck`
Expected: PASS y typecheck sin errores (el `@ts-expect-error` se consume).

- [ ] **Step 5: Commit**

```bash
git add src/map/palette-iso.ts src/map/palette-iso.test.ts
git commit -m "feat(#112): ink joins ISO_COLORS as the lab text colour"
```

### Task 2: el guard recorre `lab/*.html`

**Files:**
- Modify: `src/map/palette-guard.test.ts`
- Modify: `lab/blog.html`, `lab/portfolio.html`, `lab/resume.html`, `lab/storybook.html`, `lab/world.html` (solo el comentario CSS de la línea 9)

**Interfaces:**
- Consumes: `allIsoColors()` de `src/map/palette-iso.ts`, que desde la tarea 1 incluye `0xd8d4e8`.
- Produces: `offPalette(text: string): string[]`, local al archivo de test.

- [ ] **Step 1: Write the failing test** en `src/map/palette-guard.test.ts`

Agregar imports: `import { allIsoColors } from "./palette-iso";` y `basename` desde `node:path`. Después del `describe` existente:

```ts
const LAB = new URL("../../lab/", import.meta.url).pathname;
const PALETTE = allIsoColors();

/** Literales hex que no son colores de la paleta. Uno de 3, 4 u 8 dígitos nunca lo es: no se puede abreviar para saltar el guard. */
function offPalette(text: string): string[] {
  return (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) => h.length !== 7 || !PALETTE.has(parseInt(h.slice(1), 16)));
}

describe("guard de paleta en lab/*.html", () => {
  const pages = readdirSync(LAB).filter((f) => f.endsWith(".html")).map((f) => join(LAB, f));

  it("encuentra las páginas del lab", () => {
    expect(pages.length).toBeGreaterThanOrEqual(5);
    expect(pages.map((f) => basename(f))).toContain("world.html");
  });

  it("reporta lo que no es paleta y deja pasar lo que sí", () => {
    expect(offPalette("background: #100e19; color: #d8d4e8;")).toEqual([]);
    expect(offPalette("background: #100E19;")).toEqual([]);
    expect(offPalette("background: #100e1a;")).toEqual(["#100e1a"]);
    expect(offPalette("color: #fff; border: #100e19ff;")).toEqual(["#fff", "#100e19ff"]);
    expect(offPalette("#exhibits a { color: inherit; } #readout dl {}")).toEqual([]);
  });

  for (const page of pages) {
    it(`lab/${basename(page)} solo usa colores de la paleta`, () => {
      expect(offPalette(readFileSync(page, "utf8"))).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails without Task 1** (si la tarea 1 ya está, verificar a mano en el paso 3)

Run: `npx vitest run src/map/palette-guard.test.ts`
Expected, sin `ink` en la paleta: FAIL en las cinco páginas con `["#d8d4e8"]`. Con `ink`: PASS.

- [ ] **Step 3: Verificación del criterio 1 (a mano, y revertir), antes de tocar las páginas**

```bash
sed -i 's/#100e19/#100e1a/' lab/blog.html
npx vitest run src/map/palette-guard.test.ts   # FAIL: lab/blog.html … ["#100e1a"]
sed -i 's/#100e1a/#100e19/' lab/blog.html
git diff --exit-code lab/blog.html             # sin cambios
npx vitest run src/map/palette-guard.test.ts   # PASS
```

Pegar la línea del FAIL en el informe de la tarea: es la evidencia del criterio 1.

- [ ] **Step 4: Actualizar solo el comentario CSS** de la línea 9 (idéntica en las cinco páginas). Las declaraciones y su orden no cambian:

```bash
sed -i 's|/\* = ISO_COLORS.sky en src/map/palette-iso.ts \*/|/* = ISO_COLORS.sky; el color que sigue es ISO_COLORS.ink (src/map/palette-iso.ts); lo vigila palette-guard.test.ts */|' lab/*.html
```

- [ ] **Step 5: Full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/map/palette-guard.test.ts lab/*.html
git commit -m "feat(#112): palette guard walks lab/*.html"
```

## Grilling

- Rondas: 1 (los cambios no agregaron ni quitaron pasos ni movieron la costura: no hizo falta segunda ronda). Griller: `fable`.
- Preguntas: 16. Respondidas con CODE: 11 (1, 2, 3, 5, 6, 7, 8, 11, 14, 15, 16), con ISSUE: 2 (4, 10), sin fuente: 3 (9, 12, 13).
- Las sin fuente son supuestos técnicos (ver `## Assumptions`) o correcciones del plan: el paso de verificación del criterio 1 se mueve antes de editar las páginas y revierte con `sed` en lugar de `git checkout` (12); el comentario CSS se cambia sin reordenar declaraciones (11).
- Ambigüedades de spec: ninguna. Issues abiertas: ninguna.
