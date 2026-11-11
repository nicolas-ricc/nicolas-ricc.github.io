# Anillo de foco del `#lab-host` por dentro del borde (#303): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que al llegar con Tab al `#lab-host` de cada página de `lab/` el anillo de foco nativo se vea entero, por dentro del borde del host.

**Architecture:** una regla `#lab-host:focus-visible { outline-offset: -3px; }` en el bloque `<style>` de cada una de las seis páginas de `lab/`, justo después de la regla `#lab-host { … }` que ya existe. Un test nuevo en el loop sobre `SHORTCUTS` de `src/lab/host-keyboard.test.ts` lee el `<style>` de cada página y exige esa regla con `outline-offset` negativo.

**Tech Stack:** HTML/CSS estático, Vitest con happy-dom.

**Spec:** issue #303 y su Agent Brief (comentario de triage).

## Global Constraints

- Criterio 1: las seis páginas de `lab/` (`world`, `blog`, `resume`, `portfolio`, `storybook`, `kit`) tienen una regla `#lab-host:focus-visible` con `outline-offset` negativo.
- Criterio 2: un test en `host-keyboard.test.ts`, dentro del mismo `for` sobre `SHORTCUTS`, verifica que el HTML de cada página contiene esa regla.
- Criterio 3: verificado a ojo en `lab/world.html` y `lab/storybook.html` con agent-browser: Tab hasta el host y captura. El anillo se ve en los cuatro lados.
- Criterio 4: `npm test` y `npm run typecheck` en verde.
- Valor: `outline-offset: -3px`, el del brief. Sin `outline`, `outline-color` ni `outline-width`: el anillo sigue siendo el del navegador.
- El foco por mouse (`:focus` sin `-visible`) no cambia: ninguna página gana una regla `#lab-host:focus` sin `-visible`.
- Fuera de alcance: un anillo con estilo propio (color o grosor), el foco del sitio (`src/style.css`) y el texto del `aria-label` (#302).
- Los nombres de los tests van en inglés, como los del archivo. Commits `test(#303): …` / `fix(#303): …`.

## Decisiones técnicas (declaradas)

1. **Dónde va la regla.** En una línea propia, inmediatamente después de `#lab-host { … }` en cada `<style>`, con el mismo sangrado de seis espacios. No se crea una hoja CSS compartida: el issue pide la regla "en cada página", y las seis páginas ya repiten en línea sus reglas del host (`lab/*.html`, `#lab-host { … }` y `#lab-host canvas { … }`).
2. **Por qué `-3px`.** El anillo por defecto de Chrome y Firefox mide unos 2 px. Con `-3px` queda entero dentro del host, separado 1 px del borde. El canvas hijo no tapa el anillo: el contorno se pinta después de los descendientes en flujo, y el canvas no está posicionado.
3. **Cómo lee el test el CSS.** Hoy `mountHost` lee y parsea el HTML y devuelve solo el host montado. Se extrae la lectura y el parseo a `parsePage(page: string): Document`, y `mountHost` lo usa. Un helper nuevo, `pageStyle(page: string): string`, concatena el `textContent` de los `<style>` de `parsePage(page)`. El test exige que ese texto contenga la regla base `#lab-host {`, así que un `<style>` vacío o perdido falla y no pasa en silencio. Después busca `/#lab-host:focus-visible\s*\{[^}]*\boutline-offset:\s*(-[\d.]+)px/`, toma el grupo y exige `parseFloat(grupo) < 0`, lo que rechaza `-0px`. No se usa `getComputedStyle` para `:focus-visible`: es una suposición técnica, ver Assumptions.
4. **Guarda del foco por mouse.** El mismo test exige que el texto del estilo no contenga `#lab-host:focus` seguido de algo que no sea `-visible` (`/#lab-host:focus(?!-visible)/`).

## Review Focus

1. Una página nueva en `lab/` sin la regla: el test "covers every page in lab/" ya obliga a sumarla a `SHORTCUTS`, y entonces el test nuevo la exige. No hace falta un test aparte.
2. Una regla `#lab-host:focus` sin `-visible` que cambiaría el foco por mouse: la cubre la guarda de la decisión 4, dentro del test de la Task 1.
3. Un `outline-offset` positivo, `0` o `-0px` (el anillo seguiría fuera o al ras del borde): el test exige un valor numérico menor que 0. Lo cubre el test de la Task 1.
4. El canvas hijo pintado por encima del anillo: no lo puede ver un test de happy-dom. Lo cubre la verificación a ojo del criterio 3 (script `.scratch/evals-303.md`).
5. El storybook, donde el host es la columna central de una grilla: el anillo tiene que verse también a izquierda y derecha, contra las columnas vecinas. Lo cubre la misma verificación a ojo.

---

### Task 1: regla `:focus-visible` en las seis páginas y su test

**Files:**
- Modify: `lab/world.html`, `lab/blog.html`, `lab/resume.html`, `lab/portfolio.html`, `lab/kit.html` (después de la línea 10, `#lab-host { width: 100%; height: 100%; }`)
- Modify: `lab/storybook.html` (después de la línea 16, `#lab-host { min-width: 0; height: 100%; }`)
- Test: `src/lab/host-keyboard.test.ts`

**Interfaces:**
- Consumes: `SHORTCUTS`, `ROOT` y el patrón de `mountHost` del mismo archivo.
- Produces: `pageStyle(page: string): string`, local al archivo de test.

- [ ] **Step 1: test que falla** (se escribe en la etapa de evals). Dentro del `for (const [page, keys] of Object.entries(SHORTCUTS))`:
  ```ts
  it(`lab/${page}.html: keyboard focus ring is drawn inside #lab-host (#303)`, () => {
    const css = pageStyle(page);
    expect(css).toContain("#lab-host {");
    const offset = css.match(/#lab-host:focus-visible\s*\{[^}]*\boutline-offset:\s*(-?[\d.]+)px/)?.[1];
    expect(offset, "outline-offset of #lab-host:focus-visible").toBeDefined();
    expect(Number.parseFloat(offset!)).toBeLessThan(0);
    expect(css).not.toMatch(/#lab-host:focus(?!-visible)/);
  });
  ```
- [ ] **Step 2: correr y ver que falla.** `npx vitest run src/lab/host-keyboard.test.ts`. Esperado: 6 fallos, uno por página, en el `toMatch`.
- [ ] **Step 3: agregar la regla.** En cada una de las seis páginas, la línea `      #lab-host:focus-visible { outline-offset: -3px; }` después de la regla `#lab-host { … }`.
- [ ] **Step 4: correr y ver que pasa.** `npx vitest run src/lab/host-keyboard.test.ts`. Esperado: todo en verde.
- [ ] **Step 5: verificación a ojo.** Si el anillo sale recortado, se prueba un `outline-offset` más negativo; si con `outline-offset` no alcanza, se para y se pregunta en el issue (ver Assumptions). Con el dev server (`npm run dev -- --host --port 5173`), correr `.scratch/evals-303.md` en agent-browser sobre `lab/world.html` y `lab/storybook.html`: Tab hasta el host, captura, y el anillo se ve en los cuatro lados.
- [ ] **Step 6: suite y typecheck.** `npm test` y `npm run typecheck`. Esperado: verde.
- [ ] **Step 7: commit.** El test ya entró en el commit `test(#303): evals` de la etapa de evals. Acá: `git add lab/*.html && git commit -m "fix(#303): focus ring inside the lab host"`.

## Assumptions

Suposiciones técnicas del grilling, sin fuente escrita, decididas acá:

- **El navegador de la verificación a ojo es Chromium headless.** Es el de agent-browser (CLAUDE.md). Firefox y Safari no se verifican. Alternativa descartada: una matriz de navegadores, que el issue no pide.
- **Se valida el texto del CSS, no el estilo computado.** La regex sobre el `<style>` es lo que pide el criterio 2 ("verifica que el HTML de cada página contiene esa regla"). Alternativa descartada: `getComputedStyle` bajo `:focus-visible` en happy-dom, que no se probó y que depende de la heurística de foco del motor.
- **La guarda rechaza cualquier `#lab-host:focus` sin `-visible`, `:focus-within` incluido.** Hoy ninguna página tiene uno (`grep focus lab/*.html` solo encuentra el texto del `aria-label` de `world.html`). Alternativa descartada: rechazar solo `#lab-host:focus` a secas, que dejaría pasar `:focus:not(…)`, otra forma de cambiar el foco por mouse.
- **Plan B si el anillo sale recortado.** Primero un `outline-offset` más negativo, sin cambiar el color ni el grosor. Un anillo con estilo propio está fuera de alcance, así que si con eso no alcanza, es una ambigüedad del spec y se bloquea.
- **El test va en `host-keyboard.test.ts`.** Lo nombra el criterio 2. Alternativa descartada: un `host-focus.test.ts` nuevo.

## Grilling

Una ronda, 18 preguntas (griller `fable`). Fuentes de las respuestas: ISSUE 5, CODE 8, DOC 1, NO SOURCE 4 (las cuatro, suposiciones técnicas). Ninguna ambigüedad del spec y ningún fuera de alcance.

- Q1 (¿el host o el canvas recortan el anillo?). CODE: `lab/*.html:10-11` y `lab/storybook.html:16-17`. El host no tiene `position`, `overflow`, `transform`, `z-index` ni `contain`, y el canvas solo tiene `display: block`. `src/lab/page.ts:52-53`, `storybook.ts:36-37` y `kit.ts:22-23` hacen `appendChild(app.canvas)` con `resizeTo: host` y `autoDensity`, que fija solo el ancho y el alto. Lo confirma a ojo el Step 5.
- Q2 (`.scratch/evals-303.md`). Lo escribe la etapa de evals del pipeline, y la verificación a ojo la exige el issue (criterio 3).
- Q3 (¿es enfocable?). CODE: `lab/*.html` tiene `tabindex="0"` en el host, y `src/lab/host-keyboard.test.ts`, en el test "#lab-host is in the tab order", afirma `tabindex` página por página.
- Q4 (`mountHost`). CODE: `host-keyboard.test.ts` `mountHost` devuelve solo el elemento montado. Se extrae `parsePage` (decisión 3).
- Q5. CODE: "covers every page in lab/" usa `readdirSync(lab)` contra las claves de `SHORTCUTS`.
- Q6 (`-0`). ISSUE: "outline-offset negativo". El test exige `< 0` (decisión 3).
- Q7. Suposición técnica (Assumptions). Hoy no hay ningún `:focus*` en los `<style>`.
- Q8. ISSUE: "en cada página". El motivo del build se quitó: `vite.config.ts` no mete el lab en el build (`lab-excluded.test.ts`).
- Q9. Se agrega `toContain("#lab-host {")`.
- Q10. Suposición técnica (Assumptions).
- Q11. CODE: además de `#lab-host`, los `<style>` solo tienen `html, body`, `#lab-host canvas`, y en el storybook `body` (grilla), `#exhibits` y `#readout`. Ninguna regla toca `outline`.
- Q12 y Q13 ("borde"). ISSUE: "por dentro del borde": el borde de la caja del host, que no tiene `border`. ISSUE: "por ejemplo con `#lab-host:focus-visible { outline-offset: -3px; }`" fija el `-3px`. El criterio de aprobación es el del issue: "El anillo se ve en los cuatro lados".
- Q14. El test va en el commit `test(#303): evals`. Se aclaró en el Step 7.
- Q15. Suposición técnica: plan B (Assumptions).
- Q16. Suposición técnica: Chromium (Assumptions). DOC: CLAUDE.md, agent-browser con HeadlessChrome.
- Q17. CODE: `package.json` no tiene Prettier ni linter, y `.factory/config.toml` dice "No linter is configured".
- Q18. ISSUE: "Un test en `host-keyboard.test.ts`". El archivo ya importa `readFileSync`.
