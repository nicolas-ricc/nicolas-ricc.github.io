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

1. **Dónde va la regla.** En una línea propia, inmediatamente después de `#lab-host { … }` en cada `<style>`, con el mismo sangrado de seis espacios. No se crea una hoja CSS compartida: las seis páginas ya repiten sus reglas del host en línea, y una hoja nueva tocaría el build de Vite.
2. **Por qué `-3px`.** El anillo por defecto de Chrome y Firefox mide unos 2 px. Con `-3px` queda entero dentro del host, separado 1 px del borde. El canvas hijo no tapa el anillo: el contorno se pinta después de los descendientes en flujo, y el canvas no está posicionado.
3. **Cómo lee el test el CSS.** Del mismo HTML que ya parsea `mountHost`. Para no montar dos veces, se agrega un helper `pageStyle(page: string): string` que concatena el `textContent` de los `<style>` del documento parseado. El test busca la regla con una regex sobre ese texto: `/#lab-host:focus-visible\s*\{[^}]*\boutline-offset:\s*-\d/`. happy-dom no aplica `:focus-visible` al computar estilos, así que no se usa `getComputedStyle`.
4. **Guarda del foco por mouse.** El mismo test exige que el texto del estilo no contenga `#lab-host:focus` seguido de algo que no sea `-visible` (`/#lab-host:focus(?!-visible)/`).

## Review Focus

1. Una página nueva en `lab/` sin la regla: el test "covers every page in lab/" ya obliga a sumarla a `SHORTCUTS`, y entonces el test nuevo la exige. No hace falta un test aparte.
2. Una regla `#lab-host:focus` sin `-visible` que cambiaría el foco por mouse: la cubre la guarda de la decisión 4, dentro del test de la Task 1.
3. Un `outline-offset` positivo o `0` (el anillo seguiría fuera o al ras del borde): la regex exige un signo menos seguido de un dígito. Lo cubre el test de la Task 1.
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
    expect(css).toMatch(/#lab-host:focus-visible\s*\{[^}]*\boutline-offset:\s*-\d/);
    expect(css).not.toMatch(/#lab-host:focus(?!-visible)/);
  });
  ```
- [ ] **Step 2: correr y ver que falla.** `npx vitest run src/lab/host-keyboard.test.ts`. Esperado: 6 fallos, uno por página, en el `toMatch`.
- [ ] **Step 3: agregar la regla.** En cada una de las seis páginas, la línea `      #lab-host:focus-visible { outline-offset: -3px; }` después de la regla `#lab-host { … }`.
- [ ] **Step 4: correr y ver que pasa.** `npx vitest run src/lab/host-keyboard.test.ts`. Esperado: todo en verde.
- [ ] **Step 5: verificación a ojo.** Con el dev server (`npm run dev -- --host --port 5173`), correr `.scratch/evals-303.md` en agent-browser sobre `lab/world.html` y `lab/storybook.html`: Tab hasta el host, captura, y el anillo se ve en los cuatro lados.
- [ ] **Step 6: suite y typecheck.** `npm test` y `npm run typecheck`. Esperado: verde.
- [ ] **Step 7: commit.** `git add lab/*.html && git commit -m "fix(#303): focus ring inside the lab host"`.
