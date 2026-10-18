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

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas en la revisión del plan (etapa 2). Van también en la descripción del PR.

- **A1. Que asome en parte cuenta como fuera de la vista.** El brief deja quieta solo la entrada que "ya es visible", y una entrada cortada por el borde es justamente el síntoma del issue ("aterriza al ras del borde"). Se descartó centrar solo cuando la entrada no asoma nada, porque dejaría el bug en los casos de borde.
- **A2. Vecinas legibles.** Lo comprueba el script de navegador de la etapa 3: tras centrar `#faro`, la entrada anterior y la siguiente tienen que verse enteras dentro de `#exhibits`. No hay test unitario, porque Vitest corre en `node` sin layout.
- **A3. Solo el eje vertical.** El índice es una columna de grid de `14rem` (`lab/storybook.html:10`), con enlaces `display: block` que parten el texto, y solo tiene `overflow-y: auto` (`:11`). No hay desborde horizontal que considerar, así que bastan `top` y `bottom`.
- **A4. Una entrada más alta que la vista** daría `true` y se centraría en cada `show()`. Es inocuo, y con 22 px por entrada frente a una columna del alto de la ventana no ocurre en la práctica. Se descartó tratarlo aparte.
- **A5. Una segunda altura de ventana.** El script de navegador repite la comprobación de `#faro` con un viewport de 1600×600, para no validar con un solo tamaño. Las capturas del criterio quedan en 1600×900, como las de #97.
- **A6. Limpieza de la captura "antes".** Si el paso 1 de Task 2 aborta, se corre igual `git worktree remove --force /tmp/main-117` y se apaga el server de la 5174. El worktree vive fuera del repo y no deja nada en la rama.

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
  it("la vista no tiene por qué empezar en 0", () => {
    const low = { top: 100, bottom: 600 };
    expect(outOfView({ top: 50, bottom: 72 }, low)).toBe(true);
    expect(outOfView({ top: 100, bottom: 122 }, low)).toBe(false);
    expect(outOfView({ top: 590, bottom: 612 }, low)).toBe(true);
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

## Grilling

Una ronda (griller `fable`), 17 preguntas. Los cambios del plan fueron menores: un caso de test con `view.top ≠ 0` y las suposiciones A1–A6, sin tareas nuevas ni otra costura, así que no hubo segunda ronda. Un primer envío al griller salió sin el texto del plan; se reenvió y sus preguntas se solapan con estas.

Fuentes: ISSUE 4, CODE 9, DOC 1, NO SOURCE 6 (técnicas: A1–A6). Ambigüedades de spec: 0. Fuera de alcance: 0. Issues abiertas: ninguna.

1. Que asome en parte. NO SOURCE → A1.
2. Vuelta a `planta`. CODE: `src/lab/exhibits.ts:172-177`, `stepExhibit` da la vuelta en los extremos. `planta` es la primera entrada (`exhibits.ts:54`), así que `block: "center"` acotado deja `scrollTop` en 0. El script de navegador lo afirma.
3. Padding y contenedor. CODE: `lab/storybook.html:11`, `#exhibits { overflow-y: auto; padding: 1rem; }`. Es el contenedor que desplaza.
4. Otros ancestros. CODE: `lab/storybook.html:9-10,25`. `html, body { overflow: hidden }`, el `nav` es hijo directo de `body` (grid) y no hay envoltorio.
5. `nav` en alcance. CODE: `src/lab/storybook.ts:22`, `const nav = document.getElementById("exhibits") as HTMLElement;` a nivel de módulo, la misma referencia que ya usa el bucle de `show()` (`:92`).
6. Patrón de `storybook.test.ts`. CODE: `src/lab/storybook.test.ts:4-11`, `readFileSync(new URL("./storybook.ts", import.meta.url))` y `toContain`/`not.toMatch` sobre el fuente.
7. Formateador. CODE: `package.json:8-19`, sin Prettier, Biome ni ESLint. DOC: `.factory/config.toml`, "No linter is configured". Ya hay líneas de más de 160 columnas en `src/lab/` (`exhibits.ts:66`).
8. Layout en la carga con hash. CODE: `src/lab/storybook.ts:27-37`, el índice se arma al evaluar el módulo. `show()` corre dentro de `boot()`, después de `await app.init(...)` (`:69`), así que el `nav` ya tiene layout.
9. Eje horizontal. NO SOURCE → A3.
10. Vecinas legibles. ISSUE: "con vecinas legibles arriba y abajo" (brief). NO SOURCE sobre cómo verificarlo → A2.
11. Orden del catálogo y `faro`. CODE: `src/lab/exhibits.ts:147`, `faro` abre el último grupo ("Blog: mar") y quedan 57 entradas antes y después. Con 900 px de alto queda bajo el pliegue; el plan ya prevé otro exhibit del grupo si no queda al ras.
12. `blog.generated.json`. CODE: `.gitignore:4`, ignorado; lo genera `npm run feed`, que corre como `predev` (`package.json:15,19`). `npx vite` no pasa por `predev`, por eso se copia.
13. `?bloom=off`. DOC: `README.md:52`, "`?bloom=on|off|fallback` lo fuerza al cargar". `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md:223`: las capturas de #97 se tomaron con `?bloom=off`, y se mantiene para que sean comparables.
14. `scroll-behavior`. CODE: `lab/storybook.html:8-22`, no hay `scroll-behavior`, así que el desplazamiento es instantáneo.
15. §6 y ADR. CODE: §6 de la spec (líneas 125-131) solo dice "el actual con `aria-current`". No hay `docs/adr/` ni `CONTEXT.md` (etapa 0). §10 es donde la spec registra los desvíos.
16. Otra altura de ventana. ISSUE: el criterio no fija viewport. NO SOURCE → A5.
17. Layout responsive. CODE: `lab/storybook.html` no tiene `@media`, así que el índice nunca se oculta. A4 cubre el caso degenerado.
