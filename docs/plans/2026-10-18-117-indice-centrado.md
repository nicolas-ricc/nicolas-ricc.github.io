# Storybook: la entrada actual queda centrada en el índice (#117): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** al cambiar de exhibit, si la entrada actual del índice no se ve entera, el índice se desplaza para dejarla centrada en la columna visible y no pegada al borde.

**Architecture:** hoy `show()` en `src/lab/storybook.ts` llama a `a.scrollIntoView({ block: "nearest" })`. Pasa a usar `block: "center"`, y solo cuando la entrada no se ve entera dentro de `#exhibits`. Esa condición es un predicado puro, `outOfView(entry, view)`, que va en `src/lab/exhibits.ts` junto a `stepExhibit`, para poder probarlo en Vitest (entorno `node`, sin DOM). `storybook.ts` no se puede importar en los tests porque arranca la app al importarse, así que su cableado se fija leyendo el fuente, como hace ya `storybook.test.ts`.

**Tech Stack:** TypeScript, Vitest, agent-browser (capturas y verificación en el navegador).

**Spec:** issue #117 y su Agent Brief (comentario de triage); contexto en `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` §6 y §10.

## Global Constraints

- Comportamiento deseado (brief): "La entrada actual queda centrada en la columna visible del índice (`block: "center"`), con vecinas legibles arriba y abajo. Si la entrada ya es visible, el comportamiento puede seguir siendo no desplazar."
- Criterio: "Navegar con flechas o hash a un exhibit fuera de la vista deja la entrada centrada en la columna del índice."
- Criterio: "Captura antes/después en la carpeta de assets de la spec del storybook" (`docs/superpowers/specs/assets/97-storybook/`).
- Criterio: `npm test` y `npm run typecheck` en verde.
- Fuera de alcance: "Cualquier cambio al canvas o al orden del catálogo."
- Los textos y comentarios van en castellano, como el resto de `src/lab/`. Los commits, `test(#117): …`, `fix(#117): …` y `docs(#117): …`.

## Decisiones técnicas (declaradas)

1. **Si la entrada se ve entera, el índice no se mueve.** El brief lo permite ("puede seguir siendo no desplazar"). Así, un clic con el mouse sobre una entrada visible no le corre la lista bajo el cursor. En cuanto la entrada asoma solo en parte o no asoma, se centra.
2. **Se usa el `scrollIntoView` nativo con `block: "center"`** y no se calcula el `scrollTop` a mano. En los extremos del índice (`planta`, `lancha`) el navegador acota el desplazamiento y la entrada queda lo más cerca del centro que permite la lista, que es lo esperable.
3. **El predicado recibe rectángulos** `{ top, bottom }`, que `DOMRect` cumple: el `getBoundingClientRect()` de la entrada contra el de `#exhibits`. El borde del `nav` incluye su `padding` de 1rem; una entrada metida en ese padding cuenta como visible, porque se lee.
4. **Que se desplacen los ancestros** no es un problema: `html, body` tienen `overflow: hidden` (`lab/storybook.html:9`), así que `scrollIntoView` solo mueve `#exhibits`.

## Review Focus

1. La entrada asoma solo en parte, cortada por el borde inferior o superior, y aun así se centra (test en Task 1).
2. La entrada ya se ve entera y el índice no se mueve, que es el caso del clic con el mouse (test en Task 1; script de navegador en la etapa 3).
3. Al cargar la página con un hash del fondo del índice (`#faro`), la entrada aparece centrada, no al ras del borde inferior (script de navegador).
4. Al dar la vuelta con flecha desde `lancha` hasta `planta` (`stepExhibit` da la vuelta), el índice vuelve arriba y `planta` se ve (script de navegador).
5. Una entrada al ras exacto del borde (`top === view.top`) cuenta como visible y no provoca un desplazamiento de más (test en Task 1).

---

### Task 1: centrar la entrada actual cuando no se ve entera

**Files:**
- Modify: `src/lab/exhibits.ts` (nuevo `outOfView`, después de `stepExhibit`)
- Modify: `src/lab/storybook.ts:92-95` (bucle de `aria-current` en `show()`, e import desde `./exhibits`)
- Test: `src/lab/exhibits.test.ts` (añadir `outOfView` al import de `./exhibits`)
- Test: `src/lab/storybook.test.ts`

**Interfaces:**
- Produces: `export function outOfView(entry: { top: number; bottom: number }, view: { top: number; bottom: number }): boolean` en `src/lab/exhibits.ts`.

- [ ] **Step 1: Tests que fallan.** En `src/lab/exhibits.test.ts`:

```ts
describe("entrada del índice fuera de la vista (#117)", () => {
  const view = { top: 0, bottom: 900 };
  it("entera dentro, o al ras de un borde, no está fuera", () => {
    expect(outOfView({ top: 100, bottom: 122 }, view)).toBe(false);
    expect(outOfView({ top: 0, bottom: 22 }, view)).toBe(false);
    expect(outOfView({ top: 878, bottom: 900 }, view)).toBe(false);
  });
  it("cortada por un borde está fuera", () => {
    expect(outOfView({ top: 890, bottom: 912 }, view)).toBe(true);
    expect(outOfView({ top: -10, bottom: 12 }, view)).toBe(true);
  });
  it("del todo arriba o abajo está fuera", () => {
    expect(outOfView({ top: 1200, bottom: 1222 }, view)).toBe(true);
    expect(outOfView({ top: -300, bottom: -278 }, view)).toBe(true);
  });
});
```

Y en `src/lab/storybook.test.ts`:

```ts
describe("la entrada actual del índice (#117)", () => {
  it("se centra solo si no se ve entera", () => {
    expect(src).not.toContain('block: "nearest"');
    expect(src).toMatch(/if \(outOfView\(a\.getBoundingClientRect\(\), nav\.getBoundingClientRect\(\)\)\) a\.scrollIntoView\(\{ block: "center" \}\)/);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lab/exhibits.test.ts src/lab/storybook.test.ts`. Debe fallar: `outOfView` no existe y el fuente todavía tiene `"nearest"`.
- [ ] **Step 3: Implementación.** En `src/lab/exhibits.ts`, después de `stepExhibit`:

```ts
/** La entrada no entra entera en la vista del índice (rectángulos de `getBoundingClientRect`). */
export function outOfView(entry: { top: number; bottom: number }, view: { top: number; bottom: number }): boolean {
  return entry.top < view.top || entry.bottom > view.bottom;
}
```

En `src/lab/storybook.ts`, añadir `outOfView` al import de `./exhibits` (`import { EXHIBITS, type Exhibit, GROUPS, outOfView, pickExhibit, stepExhibit } from "./exhibits";`) y cambiar la rama de la entrada actual en `show()`:

```ts
      if (a.dataset.id === e.id) {
        a.setAttribute("aria-current", "page");
        // el índice no entra entero en la columna: centrada, con vecinas legibles; si ya se ve, quieta
        if (outOfView(a.getBoundingClientRect(), nav.getBoundingClientRect())) a.scrollIntoView({ block: "center" });
      } else a.removeAttribute("aria-current");
```

- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts src/lab/storybook.test.ts`, después `npm test` y `npm run typecheck`. Todo en verde.
- [ ] **Step 5:** commit `fix(#117): el índice del storybook centra la entrada actual`.

### Task 2: capturas antes/después y nota en la spec

**Files:**
- Create: `docs/superpowers/specs/assets/97-storybook/indice-antes.png`
- Create: `docs/superpowers/specs/assets/97-storybook/indice-despues.png`
- Modify: `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` (§10 Desvíos, una línea al final)

**Interfaces:**
- Consumes: el comportamiento de Task 1 en `lab/storybook.html`.

- [ ] **Step 1: Captura "antes"**, del código de `origin/main` (un worktree aparte con su propio dev server, para no tocar la rama):

```bash
git worktree add /tmp/main-117 origin/main && cd /tmp/main-117 && ln -s /work/node_modules node_modules
cp /work/content/blog.generated.json content/ 2>/dev/null || true
npx vite --host --port 5174   # en otra terminal, o con timeout; se apaga al terminar
export AGENT_BROWSER_SESSION=antes117
agent-browser set viewport 1600 900 2
agent-browser open "http://localhost:5174/lab/storybook.html?bloom=off#faro"
agent-browser wait 3000
agent-browser screenshot /work/docs/superpowers/specs/assets/97-storybook/indice-antes.png
```

La entrada "Faro" tiene que quedar al ras del borde inferior de la columna, que es el bug. Si no es así, se repite con otro exhibit del grupo "Blog: mar" que sí lo muestre, y se usa el mismo en la captura "después".

- [ ] **Step 2: Captura "después"**, de esta rama en el dev server del repo (`npm run dev -- --host --port 5173`), con la misma URL en la 5173, guardada en `indice-despues.png`. "Faro" tiene que quedar centrada, con vecinas arriba y abajo.
- [ ] **Step 3: Nota en la spec.** Añadir al final de §10:

```markdown
- §6 no fijaba cómo se desplaza el índice. La entrada actual se centra en la columna (`block: "center"`) cuando no se ve entera, y si ya se ve, la lista no se mueve. Capturas `indice-antes` e `indice-despues` en `assets/97-storybook/`, con `#faro` (#117).
```

- [ ] **Step 4:** apagar los dos dev servers y ejecutar `git worktree remove /tmp/main-117`. Después `npm test`, todo en verde (`docs.test.ts` lee la documentación).
- [ ] **Step 5:** commit `docs(#117): capturas del índice antes y después`.
