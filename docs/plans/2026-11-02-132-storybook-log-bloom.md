# Log de la tecla 6 y peor redibujo en el storybook (#132): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que en `src/lab/storybook.ts` la tecla 6 loguee `[storybook] bloom a mano: <modo>` en vez de compartir el prefijo `bloom:` con el veredicto medido, y que el ticker acumule `worst`/`since` solo dentro de `if (log)`, como `src/main.ts` y `src/lab/page.ts` (#31).

**Architecture:** dos cambios de una línea en el módulo de `src/lab/storybook.ts`, calcados del arreglo de #31 en `src/lab/page.ts` (commit `4e82e87`). El veredicto medido no se toca: lo arma `attachBloom` en `src/world/bloom-runtime.ts:37` como `` `[${prefix}] bloom: …` ``. `storybook.ts` arranca la app al importarse, así que los tests leen el fuente, como ya hace `src/lab/storybook.test.ts`.

**Tech Stack:** TypeScript y Vitest (`readFileSync` sobre el fuente).

**Spec:** issue #132 (follow-up de #31). Precedente: `docs/plans/2026-10-18-31-log-bloom-lab.md`.

## Global Constraints

- Texto nuevo de la tecla 6, el que propone el issue: `` `[storybook] bloom a mano: ${stage.bloom}` ``.
- La acumulación `worst`/`since` va dentro de `if (log) { … }`, con la forma de `src/lab/page.ts:91-95`, idéntica a `src/main.ts:151-155` salvo el prefijo.
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
2. Que se loguee el modo nuevo (después de `setBloom`), no el anterior. Lo cubre el último `toMatch` del primer test de la Task 1, que exige `setBloom` antes del log.
3. Que con `log` falso sigan corriendo `stage.tick` y `bloom?.tick(dt)`. Lo cubre la Task 2, que exige `bloom?.tick(dt)` antes y fuera del `if (log)`.
4. Que el reseteo `worst = 0; since = 0` quede dentro del mismo `if (log)`. Lo cubre la Task 2.
5. Que la ayuda de teclas siga nombrando la tecla 6 y sus tres modos. Lo cubre la Task 1.

---

### Task 1: texto propio para la tecla 6

**Files:**
- Modify: `src/lab/storybook.ts:134`
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
- [ ] **Step 3: implementación.** En `src/lab/storybook.ts:134` cambiar `` console.info(`[storybook] bloom: ${stage.bloom}`) `` por `` console.info(`[storybook] bloom a mano: ${stage.bloom}`) ``.
- [ ] **Step 4:** `npx vitest run src/lab/storybook.test.ts` y `npm run typecheck` en verde; `grep -n '\[storybook\] bloom:' src/lab/` sin resultados.
- [ ] **Step 5:** commit `fix(#132): la tecla 6 del storybook loguea "bloom a mano"`.

### Task 2: peor redibujo solo con log

**Files:**
- Modify: `src/lab/storybook.ts:145-147`
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
- [ ] **Step 3: implementación.** Reemplazar las líneas 145–147 de `src/lab/storybook.ts` por:

```ts
    if (log) {
      worst = Math.max(worst, dt);
      since += ticker.deltaMS;
      if (since > 5000) { console.info(`[storybook] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
    }
```

- [ ] **Step 4:** `npm test` y `npm run typecheck` en verde.
- [ ] **Step 5:** commit `fix(#132): el ticker del storybook acumula el peor redibujo solo con log`.

## Assumptions

- **La Task 2 sale del issue, no solo del precedente.** El issue lo dice: "`src/lab/storybook.ts:140-142`: `worst` y `since` se acumulan aunque `log` sea falso", con el arreglo "la acumulación dentro de `if (log) { … }`". Las líneas se corrieron desde que se escribió el issue: hoy son 145–147.
- **El test de la ayuda de teclas es una guarda de regresión.** El issue no lo pide. Se agrega porque el criterio 2 de #31 lo pedía para `page.ts` y este cambio toca el mismo comportamiento. Si otra issue reformula el `aria-label`, ese test se actualiza con ella. La alternativa descartada era no fijar nada.
- **Ritmo de commits.** En la etapa 3 del pipeline los tests rojos se commitean juntos como `test(#132): evals`, y en la etapa 4 cada task se commitea como `fix(#132): …`. La PR entra a `main` con squash, así que `main` nunca ve el rojo. Las dos tasks van en la misma PR, que cierra #132 con `Closes #132`.
- **Verificación en la consola real.** Además de los tests sobre el fuente, se corre un script de `agent-browser` contra el dev server (`/lab/storybook.html`, donde `log = import.meta.env.DEV` vale `true`). El script aprieta la tecla 6 y lee la consola: la línea debe ser `[storybook] bloom a mano: <modo>`, y ninguna línea con `bloom:` debe ser de la tecla.
- **Formato a mano.** El repo no tiene Prettier ni ESLint (`package.json` solo trae `typecheck`), así que nada parte el bloque de una línea y rompe el regex de la Task 2.

## Grilling

- Rondas: 1. Los cambios no movieron ningún seam ni sumaron tasks. Griller: `fable`.
- Preguntas: 15. Fuentes: ISSUE 3 (1, 3, 15), CODE 9 (2, 4, 5, 6, 7, 8, 9, 10, 11), DOC 0. Sin fuente: 3 (12, 13, 14). Los tres son supuestos técnicos; ninguno es ambigüedad de spec ni queda fuera de alcance.
- Hallazgos corregidos: los números de línea del plan (134 y 145–147, no 129 y 140–142) y el Review Focus 2, que citaba un `toContain` que no existe.
- Respuestas con fuente, en resumen:
  - `prefix: "storybook"` está en `storybook.ts:126`, así que la colisión es real.
  - `storybook.ts:134` hoy es ``stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[storybook] bloom: ${stage.bloom}`);``, en una sola línea.
  - `log` es la constante de módulo `import.meta.env.DEV` (`storybook.ts:25`) y no cambia en runtime.
  - Las llamadas `console.*` del archivo (líneas 102, 133, 134 y 147) tienen todas un template literal como primer argumento. Ningún comentario contiene `bloom:`.
  - `src` y `readFileSync` están en el ámbito de módulo de `storybook.test.ts:1-5`.
  - `lab/storybook.html:26` tiene el `aria-label` con el texto literal y el punto final.
- Issues abiertos: ninguno.
