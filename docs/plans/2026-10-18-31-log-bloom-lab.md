# Log de la tecla 6 y peor redibujo en el lab (#31): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que en `src/lab/page.ts` la tecla 6 loguee con un texto propio, `[lab] bloom a mano: <modo>`, y no con el prefijo `bloom:` del veredicto medido. Que el ticker acumule `worst`/`since` solo dentro de `if (log)`, como `src/main.ts`.

**Architecture:** son dos cambios de una línea cada uno en `bootWorldPage` (`src/lab/page.ts`). El veredicto medido no se toca: lo escribe `attachBloom` en `src/world/bloom-runtime.ts:37` como `[${prefix}] bloom: …`. Ninguno de los dos cambios tiene una salida que se pueda observar sin Pixi ni consola. Por eso los tests leen el fuente, como ya hacen `src/lab/docs.test.ts` y `src/lab/lab-excluded.test.ts`, y codifican los criterios del issue, que también están escritos como grep.

**Tech Stack:** TypeScript y Vitest (`readFileSync` sobre el fuente).

**Spec:** issue #31 y su Agent Brief (comentario de triage). Fuera de alcance: el formato del veredicto medido.

## Global Constraints

- Criterio 1: `grep -n '\[lab\] bloom:' src/lab/` muestra solo el veredicto medido. El veredicto se arma en `src/world/bloom-runtime.ts` con `[${prefix}]`, así que en `src/lab/` no queda ninguna línea literal `[lab] bloom:`.
- Criterio 2: la ayuda de teclas del lab sigue describiendo bien la tecla 6. Esa ayuda es el comentario JSDoc de `bootWorldPage` y el `aria-label` de `lab/world.html` ("Tecla 6 rota el bloom: off, on, fallback.").
- Criterio 3: `npm run typecheck` en verde (y `npm test`).
- Texto nuevo de la tecla: `[lab] bloom a mano: ${stage.bloom}`, el que propone el issue.
- Tests, comentarios y mensajes en castellano. Commits `test(#31): …` y `fix(#31): …`.

## Decisiones técnicas (declaradas)

1. **Tests sobre el fuente.** Ninguno de los dos cambios se ve en una salida que un test unitario pueda observar: uno es texto de consola detrás de `import.meta.env.DEV` y un keydown, el otro es estado local de un closure del ticker. Extraer helpers solo para poder testearlos sería abstracción especulativa con un único sitio de uso. Los criterios del issue ya son greps, así que los tests leen `src/lab/page.ts` y `lab/world.html`.
2. **`storybook.ts` queda afuera.** `src/lab/storybook.ts` tiene los mismos dos patrones con el prefijo `[storybook]`. El issue nombra solo `src/lab/page.ts`, y el grep del criterio 1 busca `[lab]`. Va a un follow-up.
3. **La ayuda de teclas no cambia.** El comentario y el `aria-label` describen qué hace la tecla, no el texto que loguea. Siguen siendo correctos, y un test lo deja fijado.

## Review Focus

1. Que el texto nuevo no contenga `bloom:` (por ejemplo `bloom a mano:` sí; `bloom: a mano` no), porque un filtro por `bloom:` lo volvería a mezclar con el veredicto. Lo cubre el test de la Task 1, que busca la subcadena `bloom:` en todo `console.info` de `page.ts`.
2. Que el modo logueado sea el nuevo (después de `setBloom`) y no el anterior. Se conserva el orden actual; lo revisa el reviewer, porque el test no lo distingue.
3. Que con `log` falso el ticker siga llamando `stage.tick` y `bloom?.tick(dt)`: sin eso se rompe la medición del bloom. Lo cubre el test de la Task 2, que exige `bloom?.tick(dt)` antes y fuera del `if (log)`.
4. Que el reseteo `worst = 0; since = 0` quede dentro del mismo `if (log)`. Lo cubre el test de la Task 2.
5. Que la ayuda de teclas siga nombrando la tecla 6 y sus tres modos. Lo cubre el test de la Task 1.

---

### Task 1: texto propio para la tecla 6

**Files:**
- Modify: `src/lab/page.ts:68`
- Test: `src/lab/page.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada. Solo cambia texto de consola.

- [ ] **Step 1: test que falla.** Agregar al final de `src/lab/page.test.ts` (y sumar `import { readFileSync } from "node:fs";` arriba):

```ts
const ROOT = new URL("../../", import.meta.url).pathname;
const pageSrc = readFileSync(`${ROOT}src/lab/page.ts`, "utf8");

describe("logs del lab (#31)", () => {
  it("la tecla 6 no usa el prefijo bloom: del veredicto medido", () => {
    const infos = pageSrc.match(/console\.info\(`[^`]*`\)/g) ?? [];
    expect(infos.filter((l) => l.includes("bloom:"))).toEqual([]);
    expect(pageSrc).toContain("console.info(`[lab] bloom a mano: ${stage.bloom}`)");
  });
  it("la ayuda de teclas sigue describiendo la tecla 6", () => {
    expect(pageSrc).toMatch(/6 rota el bloom entre off, on y fallback/);
    expect(readFileSync(`${ROOT}lab/world.html`, "utf8")).toMatch(/aria-label="[^"]*Tecla 6 rota el bloom: off, on, fallback\.[^"]*"/);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lab/page.test.ts`. Esperado: FALLA el primer test (encuentra `[lab] bloom: ${stage.bloom}`). El segundo pasa.
- [ ] **Step 3: implementación.** En `src/lab/page.ts:68` cambiar `` console.info(`[lab] bloom: ${stage.bloom}`) `` por `` console.info(`[lab] bloom a mano: ${stage.bloom}`) ``.
- [ ] **Step 4:** `npx vitest run src/lab/page.test.ts` en verde, y `grep -n '\[lab\] bloom:' src/lab/` sin resultados.
- [ ] **Step 5:** commit `fix(#31): la tecla 6 del lab loguea "bloom a mano"`.

### Task 2: peor redibujo solo con log

**Files:**
- Modify: `src/lab/page.ts:79-81`
- Test: `src/lab/page.test.ts`

**Interfaces:**
- Consumes: la constante `pageSrc` del test de la Task 1.
- Produces: nada.

- [ ] **Step 1: test que falla.** Agregar dentro de `describe("logs del lab (#31)")`:

```ts
  it("worst y since se acumulan solo con log, como en src/main.ts", () => {
    expect(pageSrc).toMatch(/bloom\?\.tick\(dt\);\s*if \(log\) \{\s*worst = Math\.max\(worst, dt\);\s*since \+= ticker\.deltaMS;\s*if \(since > 5000\) \{[^}]*worst = 0; since = 0; \}\s*\}/);
  });
```

- [ ] **Step 2:** `npx vitest run src/lab/page.test.ts`. Esperado: FALLA el test nuevo.
- [ ] **Step 3: implementación.** Reemplazar las líneas 79–81 de `src/lab/page.ts` por la forma de `src/main.ts:143-147`:

```ts
      if (log) {
        worst = Math.max(worst, dt);
        since += ticker.deltaMS;
        if (since > 5000) { console.info(`[lab] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
      }
```

- [ ] **Step 4:** `npm test` y `npm run typecheck` en verde.
- [ ] **Step 5:** commit `fix(#31): el ticker del lab acumula el peor redibujo solo con log`.
