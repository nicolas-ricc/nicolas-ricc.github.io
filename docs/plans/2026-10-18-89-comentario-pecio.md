# Comentario del pecio en `sea.ts` (#89): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el docstring de `wreck()` en `src/scenes/sea.ts` describa dónde está de verdad el pecio: en la fosa, con la popa a ~16 u al este del talud, y por qué no se lo corrió al talud.

**Architecture:** cambio solo de comentario. Un test en `src/scenes/sea.test.ts` lee `sea.ts` con `readFileSync` (como ya hacen `city.test.ts:231` y `sea-anim.test.ts:353`), aísla el bloque `/** … */` que precede a `const WRECK_LEN` y exige el texto nuevo. Otro test fija los números que el comentario afirma (distancia de la popa al talud, todo el pecio en `abyss`), para que el comentario no vuelva a quedar desfasado si alguien mueve `WRECK`.

**Tech Stack:** TypeScript y Vitest.

**Spec:** issue #89 y su Agent Brief (comentario de triage). Decisión del brief: corregir el texto, no mover el pecio.

## Global Constraints

- Archivos que cambian: `src/scenes/sea.ts` (solo líneas de comentario del docstring de `wreck`) y `src/scenes/sea.test.ts` (tests nuevos al final).
- No cambia ningún valor de geometría (`WRECK`, `WRECK_BUOY`, `WRECK_LEN`, coordenadas locales) ni ninguna expectativa existente de los tests (criterio 2 del brief).
- Comentarios, tests y mensajes en castellano. Commits `test(#89): …` y `docs(#89): …`.

## Datos medidos (de `src/map/geo.ts:66` y `src/scenes/sea.ts:26`)

- `abyssX(y) = 392 + 0.25 * (y + 60) + 6 * sin(y / 17)`; `abyssX(262)` ≈ 474.25.
- `WRECK = { x: 490, y: 262, heading: π/6 }`; la popa es el origen local (x local 0), así que está 15.75 u al este del talud.
- El punto del casco más cercano al talud (barrido de x local 0…40, y local −4…4) queda a 14.1 u al este: todo el pecio cae en `abyss`.
- El comentario de las constantes (`sea.ts:19-22`) ya dice "su popa queda ~16 u al este del talud … 30 u al este de la vuelta". El docstring nuevo dice lo mismo.

## Decisiones técnicas (declaradas)

1. **Texto del docstring.** La primera oración pasa de "un costero de 40 u partido en dos y hundido de popa en el talud de la fosa" a "un costero de 40 u partido en dos y hundido en la fosa". Se agrega una oración con la posición real y el motivo. El resto del docstring (proa, casa de popa, coordenadas locales, z ≥ −1) queda igual.
2. **Cómo se verifica "ya no menciona el talud como posición de la popa".** El docstring no contiene `en el talud` ni `sobre el talud`, y sí contiene `16 u al este del talud`, `fosa` y `#87`. La palabra "talud" puede aparecer como referencia de distancia, que es lo que pide el brief.
3. **Cómo se verifica "no cambia geometría ni baseline".** Con `git diff origin/main -- src/scenes/sea.ts`: todas las líneas cambiadas empiezan con ` *` (son del docstring). El repo no versiona archivos de baseline (`git ls-files | grep -i baseline` sale vacío). Las "baselines" son las expectativas de los tests existentes, que no se tocan: solo se agregan tests. El script está en `.scratch/evals-89.md` y va en la descripción del PR.
4. **Test de guarda geométrica.** Fija `WRECK.x - abyssX(WRECK.y)` entre 15 y 17, y `terrainAt === "abyss"` en el centro de cada pieza del pecio. Pasa desde el principio: no es un test rojo, sino una guarda para que el comentario siga siendo cierto.

## Review Focus

1. Un docstring que diga "hundido de popa" sin "en el talud" sigue sugiriendo que la popa toca algo. El test exige "hundido en la fosa".
2. El regex que aísla el docstring no debe agarrar el bloque anterior (`buoysAndWreck`). Se ancla en `/**` seguido de ` * Pecio (#83)` y termina en `*/\nconst WRECK_LEN`.
3. Que el docstring nuevo no contradiga el comentario de las constantes (`sea.ts:19-22`): ambos dicen ~16 u y 30 u.
4. Que no se cuele ningún cambio de código en `sea.ts`: lo cubre el diff de la decisión 3.
5. Que las piezas del pecio queden en `abyss` y no en `sea`: lo cubre la guarda de la decisión 4.

---

### Task 1: Tests del docstring y guarda geométrica (evals)

**Files:**
- Modify: `src/scenes/sea.test.ts` (imports y `describe` nuevo al final)

**Interfaces:**
- Consumes: `abyssX` de `../map/geo`, `terrainAt` de `./terrain`, `WRECK` y `sea` de `./sea`, `bounds` de `../iso/solids`.
- Produces: `describe("pecio: comentario y posición (#89)")`, que la Task 2 hace pasar.

- [ ] **Step 1: Escribir los tests**

Agregar `import { readFileSync } from "node:fs";` como primera línea, sumar `abyssX` al import de `../map/geo`, y al final del archivo:

```ts
describe("pecio: comentario y posición (#89)", () => {
  const doc = readFileSync(new URL("./sea.ts", import.meta.url), "utf8").match(/\/\*\*\n \* Pecio \(#83\)[\s\S]*?\*\/\nconst WRECK_LEN/)?.[0] ?? "";
  it("el docstring pone el pecio en la fosa, a ~16 u del talud, y no la popa en el talud", () => {
    expect(doc).not.toBe("");
    expect(doc).toMatch(/hundido en la fosa/);
    expect(doc).not.toMatch(/(en|sobre) el talud/);
    expect(doc).toMatch(/16 u al este del talud/);
    expect(doc).toMatch(/#87/);
  });
  it("la popa queda ~16 u al este del talud y todas las piezas del pecio caen en la fosa", () => {
    expect(WRECK.x - abyssX(WRECK.y)).toBeGreaterThan(15);
    expect(WRECK.x - abyssX(WRECK.y)).toBeLessThan(17);
    const s = scene();
    const parts = s.solids.filter((x) => { const b = bounds(x); return Math.hypot((b.min.x + b.max.x) / 2 - WRECK.x, (b.min.y + b.max.y) / 2 - WRECK.y) < 45 && b.min.x > WRECK.x - 10; });
    expect(parts.length).toBeGreaterThan(0);
    for (const x of parts) { const b = bounds(x); expect(terrainAt((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2)).toBe("abyss"); }
  });
});
```

- [ ] **Step 2: Correr y ver el primero fallar y el segundo pasar**

Run: `npx vitest run src/scenes/sea.test.ts -t "#89"`
Expected: el test del docstring FALLA (`hundido en la fosa` no aparece); la guarda PASA.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/sea.test.ts
git commit -m "test(#89): evals"
```

### Task 2: Docstring nuevo de `wreck`

**Files:**
- Modify: `src/scenes/sea.ts:122-129` (solo el docstring)

**Interfaces:**
- Consumes: los tests de la Task 1.
- Produces: nada que otra tarea use.

- [ ] **Step 1: Reemplazar las dos primeras líneas del docstring**

De:

```ts
 * Pecio (#83): un costero de 40 u partido en dos y hundido de popa en el talud de la fosa. El centro del
 * casco está bajo el agua; asoman la proa (una cuña oxidada con su cubierta y la bita) y la casa de popa
```

a:

```ts
 * Pecio (#83): un costero de 40 u partido en dos y hundido en la fosa. La popa (`WRECK`) queda
 * ~16 u al este del talud (`abyssX(262)` ≈ 474) y todo el casco cae en `abyss`. No se lo corrió hacia
 * el talud porque la vuelta pasa a 30 u y los carriles se validaron así en #87. El centro del
 * casco está bajo el agua; asoman la proa (una cuña oxidada con su cubierta y la bita) y la casa de popa
```

El test busca `16 u al este del talud` en una sola línea: un corte de línea dentro de esa frase lo rompe.

- [ ] **Step 2: Correr los tests del pecio**

Run: `npx vitest run src/scenes/sea.test.ts`
Expected: PASS, todos.

- [ ] **Step 3: Suite completa, typecheck y diff solo de comentario**

Run: `npm test && npm run typecheck && git diff origin/main -- src/scenes/sea.ts | grep '^[-+][^-+]' | grep -v '^[-+] \*'`
Expected: tests y typecheck en verde; el último `grep` no imprime nada.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/sea.ts
git commit -m "docs(#89): el pecio yace en la fosa, a ~16 u del talud"
```
