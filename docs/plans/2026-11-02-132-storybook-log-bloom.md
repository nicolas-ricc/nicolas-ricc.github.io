# Log de la tecla 6 y peor redibujo en el storybook (#132): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que en `src/lab/storybook.ts` la tecla 6 loguee `[storybook] bloom a mano: <modo>` en vez de compartir el prefijo `bloom:` con el veredicto medido, y que el ticker acumule `worst`/`since` solo dentro de `if (log)`, como `src/main.ts` y `src/lab/page.ts` (#31).

**Architecture:** dos cambios de una línea en el módulo de `src/lab/storybook.ts`, calcados del arreglo de #31 en `src/lab/page.ts` (commit `4e82e87`). El veredicto medido no se toca: lo arma `attachBloom` en `src/world/bloom-runtime.ts:37` como `` `[${prefix}] bloom: …` ``. `storybook.ts` arranca la app al importarse, así que los tests leen el fuente, como ya hace `src/lab/storybook.test.ts`.

**Tech Stack:** TypeScript y Vitest (`readFileSync` sobre el fuente).

**Spec:** issue #132 (follow-up de #31). Precedente: `docs/plans/2026-10-18-31-log-bloom-lab.md`.

## Global Constraints

- Texto nuevo de la tecla 6, el que propone el issue: `` `[storybook] bloom a mano: ${stage.bloom}` ``.
- La acumulación `worst`/`since` va dentro de `if (log) { … }`, con la forma de `src/lab/page.ts:91-95`.
- `stage.tick(...)` y `bloom?.tick(dt)` siguen corriendo con `log` falso: la medición del bloom depende de ellos.
- El veredicto medido (`src/world/bloom-runtime.ts`) y su formato quedan fuera de alcance.
- `npm test` y `npm run typecheck` en verde.
- Tests, comentarios y mensajes en castellano. Commits `test(#132): …` y `fix(#132): …`.

## Decisiones técnicas (declaradas)

1. **Tests sobre el fuente.** `storybook.ts` ejecuta `document.getElementById`, `matchMedia` y `new Application()` al importarse, y Vitest corre en `node` (`vitest.config.ts`). El cabezal de `src/lab/storybook.test.ts` ya lo explica y lee el fuente. Extraer helpers solo para testear dos líneas sería abstracción especulativa.
2. **La ayuda de teclas no cambia.** El JSDoc del módulo ("6 rota el bloom") y el `aria-label` de `lab/storybook.html` ("Tecla 6 rota el bloom: off, on, fallback.") describen qué hace la tecla, no lo que loguea. Un test los deja fijados.
3. **El `return` temprano sin stage se mantiene.** El ticker del storybook arranca con `if (!stage) return;`, que `page.ts` no tiene. No se toca.

## Review Focus

1. Que el texto nuevo no contenga la subcadena `bloom:` (`bloom a mano:` sí; `bloom: a mano` no). Lo cubre la Task 1, que busca `bloom:` en todo `console.info` de `storybook.ts`.
2. Que se loguee el modo nuevo (después de `setBloom`), no el anterior. Lo cubre el `toContain` de la Task 1, que incluye `setBloom` antes del log.
3. Que con `log` falso sigan corriendo `stage.tick` y `bloom?.tick(dt)`. Lo cubre la Task 2, que exige `bloom?.tick(dt)` antes y fuera del `if (log)`.
4. Que el reseteo `worst = 0; since = 0` quede dentro del mismo `if (log)`. Lo cubre la Task 2.
5. Que la ayuda de teclas siga nombrando la tecla 6 y sus tres modos. Lo cubre la Task 1.

---

### Task 1: texto propio para la tecla 6

**Files:**
- Modify: `src/lab/storybook.ts:129`
- Test: `src/lab/storybook.test.ts`

**Interfaces:**
- Consumes: la constante `src` que ya define `src/lab/storybook.test.ts` (fuente de `storybook.ts`).
- Produces: nada. Solo cambia texto de consola.

- [ ] **Step 1: test que falla.** Agregar al final de `src/lab/storybook.test.ts`:

```ts
describe("logs del storybook (#132)", () => {
  it("la tecla 6 no usa el prefijo bloom: del veredicto medido", () => {
    const infos = src.match(/console\.\w+\((?:`[^`]*`|"[^"]*"|'[^']*')/g) ?? [];
    expect(infos.length).toBeGreaterThan(0);
    expect(infos.filter((l) => l.includes("bloom:"))).toEqual([]);
    expect(src).toMatch(/stage\.setBloom\(nextBloomMode\(stage\.bloom\)\);\s*if \(log\) console\.info\(`\[storybook\] bloom a mano: \$\{stage\.bloom\}`\);/);
  });
  it("la ayuda de teclas sigue describiendo la tecla 6", () => {
    expect(src).toMatch(/6 rota el bloom/);
    expect(readFileSync(new URL("../../lab/storybook.html", import.meta.url), "utf8")).toMatch(/aria-label="[^"]*Tecla 6 rota el bloom: off, on, fallback\.[^"]*"/);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lab/storybook.test.ts`. Esperado: FALLA el primer test (encuentra `[storybook] bloom: ${stage.bloom}`); el segundo pasa.
- [ ] **Step 3: implementación.** En `src/lab/storybook.ts:129` cambiar `` console.info(`[storybook] bloom: ${stage.bloom}`) `` por `` console.info(`[storybook] bloom a mano: ${stage.bloom}`) ``.
- [ ] **Step 4:** `npx vitest run src/lab/storybook.test.ts` y `npm run typecheck` en verde; `grep -n '\[storybook\] bloom:' src/lab/` sin resultados.
- [ ] **Step 5:** commit `fix(#132): la tecla 6 del storybook loguea "bloom a mano"`.

### Task 2: peor redibujo solo con log

**Files:**
- Modify: `src/lab/storybook.ts:140-142`
- Test: `src/lab/storybook.test.ts`

**Interfaces:**
- Consumes: la constante `src` del archivo de test.
- Produces: nada.

- [ ] **Step 1: test que falla.** Agregar dentro de `describe("logs del storybook (#132)")`:

```ts
  it("worst y since se acumulan solo con log, como en src/main.ts", () => {
    expect(src).toMatch(/bloom\?\.tick\(dt\);\s*if \(log\) \{\s*worst = Math\.max\(worst, dt\);\s*since \+= ticker\.deltaMS;\s*if \(since > 5000\) \{ console\.info\(`\[storybook\] peor redibujo en 5 s: [^`]*`\); worst = 0; since = 0; \}\s*\}/);
  });
```

- [ ] **Step 2:** `npx vitest run src/lab/storybook.test.ts`. Esperado: FALLA el test nuevo.
- [ ] **Step 3: implementación.** Reemplazar las líneas 140–142 de `src/lab/storybook.ts` por:

```ts
    if (log) {
      worst = Math.max(worst, dt);
      since += ticker.deltaMS;
      if (since > 5000) { console.info(`[storybook] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
    }
```

- [ ] **Step 4:** `npm test` y `npm run typecheck` en verde.
- [ ] **Step 5:** commit `fix(#132): el ticker del storybook acumula el peor redibujo solo con log`.
