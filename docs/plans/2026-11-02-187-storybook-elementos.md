# Storybook: elementos de la página con guarda y cableado testeable (#187): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** si `lab/storybook.html` pierde o renombra `#lab-host`, `#exhibits` o `#readout`, el storybook avisa en la página qué falta en vez de tirar un `TypeError` opaco al importarse. El armado del índice, la marca de la entrada actual y el panel de lectura pasan a un módulo que no corre nada al importarse, para poder probarlo con un DOM.

**Architecture:** hay un módulo nuevo, `src/lab/storybook-ui.ts`, sin efectos al importarse y sin Pixi. Resuelve los tres elementos con una guarda (`storybookElements`) y arranca con aviso visible (`mountStorybook`). Además expone el cableado testeable que hoy vive en `storybook.ts`: `buildIndex`, `markCurrent` y `renderReadout`. `storybook.ts` queda como punto de entrada y llama a `mountStorybook(document, …)`. Todo lo que hoy corre en el nivel superior del módulo pasa a ese callback, y el arranque de Pixi sigue en `runBoot(host, "storybook", boot)` (#103). Los tests nuevos corren con `// @vitest-environment happy-dom`, como ya hace `host-keyboard.test.ts`.

**Tech Stack:** TypeScript, Vitest, happy-dom (ya es devDependency), agent-browser.

**Spec:** issue #187.

## Global Constraints

- Issue: "If `lab/storybook.html` loses or renames `#lab-host`, `#exhibits` or `#readout`, the module throws at load time with an opaque `TypeError`. It never reaches `runBoot`" → el fallo tiene que verse en la página.
- Dirección del issue: "resolve the elements inside a function that can fail visibly, and move the wiring that can be tested (index construction, current-entry update) into a module that does not run on import."
- `npm test` y `npm run typecheck` en verde.
- Textos y comentarios en castellano, como el resto de `src/lab/`. Los commits, `test(#187): …`, `fix(#187): …` y `refactor(#187): …`.
- Sin cambios de comportamiento del storybook cuando la página está completa: el mismo índice, la misma `aria-current`, el mismo centrado (#117) y el mismo panel (#95, #111).

## Decisiones técnicas (declaradas)

1. **Dónde se muestra el fallo.** Si existe `#lab-host`, el mensaje va ahí, igual que `runBoot`. Si falta, va en `document.body`, porque no hay otro lugar garantizado. El texto es `No se pudo iniciar el storybook: <motivo>` y se registra con `console.error("[storybook] no se pudo iniciar", err)`. Sigue el formato de `runBoot` (`src/lab/boot.ts`) pero dice "storybook", porque el renderer ni llegó a pedirse.
2. **`mountStorybook` atrapa cualquier error síncrono del callback**, no solo el de los elementos. `assembleWorld` y el armado del índice corren ahí, antes de `runBoot`, y hoy también romperían la página en blanco. Los rechazos asíncronos de `boot()` los sigue tratando `runBoot`.
3. **El motivo nombra todos los ids que faltan**, no solo el primero: `faltan #exhibits, #readout en la página`. Con uno solo dice `falta #readout en la página`.
4. **`STORYBOOK_IDS`** se exporta y un test comprueba que `lab/storybook.html` los tiene todos. Así un renombre se detecta en `npm test`, no solo en el navegador.
5. **`assembleWorld` no se mueve dentro de `boot()`.** `page.ts` sigue el mismo patrón y el issue no lo pide. Basta con que corra dentro del callback de `mountStorybook` (decisión 2).
6. **Los tests de fuente que quedan en `storybook.test.ts`** (`stage?.destroy()` y los logs de #132) se quedan: cubren código atado a Pixi que sigue en `storybook.ts`. El de #117, que leía `outOfView(...)` del fuente, se reemplaza por un test de comportamiento de `markCurrent`.

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas en la revisión del plan (etapa 2). Van también en la descripción del PR.

- **A1. Sin `#lab-host`, el mensaje reemplaza el contenido de `body`** (`textContent =`), igual que `runBoot` reemplaza el del host (`src/lab/boot.ts:8`). Lo que se pierde es el `nav` y el `aside`, que a esa altura están vacíos porque el script los llena. Se descartó añadir un `<p>` al principio de `body`: dejaría un grid de tres columnas con un hueco y el aviso encajado en la primera.
- **A2. El estado intermedio de Task 1.** `renderReadout` y `boot` quedan como funciones internas del callback y toman `host`, `nav` y `panel` por clausura. `boot` corre asíncrona dentro de `runBoot`, que sigue atendiendo sus rechazos. Task 2 saca `renderReadout` del callback. Se descartó pasar los elementos por parámetro a `boot`, porque `runBoot` llama a `boot()` sin argumentos.
- **A3. Orden de los ids en el mensaje:** el de `STORYBOOK_IDS` (`lab-host`, `exhibits`, `readout`), no el del documento. Así es determinista e independiente del HTML. Un test lo fija.
- **A4. Sin cambios de comportamiento con la página completa.** Lo comprueba el script de agent-browser de la etapa 3 (`.scratch/evals-187.md`): el canvas existe, `#exhibits` tiene un enlace por exhibit, la entrada de `location.hash` lleva `aria-current="page"`, `#readout` tiene un `dl` con 9 `dt`, y no aparece "No se pudo iniciar". Una segunda corrida sobre una copia de la página sin `#readout` muestra el mensaje.

## Review Focus

1. La página sin `#lab-host`: el mensaje aparece en `body` y no se lanza nada (test en Task 1).
2. Faltan dos elementos a la vez: el mensaje nombra los dos (test en Task 1).
3. Un error síncrono dentro del callback (p. ej. `assembleWorld`) se muestra en el host y no escapa (test en Task 1).
4. Al cambiar de exhibit, la entrada anterior pierde `aria-current` y solo la nueva lo tiene. El índice se desplaza solo si la entrada no se ve entera (test en Task 2).
5. Un `Readout` sin caja ni materiales muestra `—`, no un texto vacío (test en Task 2).

---

### Task 1: elementos con guarda y arranque con aviso visible

**Files:**
- Create: `src/lab/storybook-ui.ts`
- Modify: `src/lab/storybook.ts` (las líneas 21-23 y el nivel superior pasan a ser un callback de `mountStorybook`)
- Test: `src/lab/storybook-ui.test.ts` (nuevo, `// @vitest-environment happy-dom`)
- Test: `src/lab/storybook.test.ts`

**Interfaces:**
- Produces, en `src/lab/storybook-ui.ts`:
  - `export const STORYBOOK_IDS = ["lab-host", "exhibits", "readout"] as const;`
  - `export interface StorybookElements { host: HTMLElement; nav: HTMLElement; panel: HTMLElement }`
  - `export function storybookElements(doc: Document): StorybookElements`: lanza `Error` con el motivo de la decisión 3 si falta alguno.
  - `export function mountStorybook(doc: Document, run: (els: StorybookElements) => void): void`: resuelve, llama a `run` y, si algo lanza, aplica la decisión 1.

- [ ] **Step 1: Tests que fallan.** Los tests van en `src/lab/storybook-ui.test.ts`, que arma `document.body` a mano en cada caso y espía `console.error` con `vi.spyOn(...).mockImplementation(() => {})`:
  - `storybookElements` con los tres presentes devuelve `{ host, nav, panel }` con los nodos de `#lab-host`, `#exhibits` y `#readout`.
  - Sin `#readout`, lanza `"falta #readout en la página"`.
  - Sin `#exhibits` ni `#readout`, lanza `"faltan #exhibits, #readout en la página"`.
  - `mountStorybook` con la página completa llama a `run` una vez con los elementos y no registra error.
  - `mountStorybook` sin `#exhibits`: el texto de `#lab-host` pasa a ser `"No se pudo iniciar el storybook: falta #exhibits en la página"`, `run` no se llama, `console.error` se llama con `"[storybook] no se pudo iniciar"` y el error, y la llamada no lanza.
  - `mountStorybook` sin `#lab-host`: el texto de `document.body` pasa a ser `"No se pudo iniciar el storybook: falta #lab-host en la página"`.
  - `mountStorybook` con una página sin ninguno de los tres: `document.body` muestra `"No se pudo iniciar el storybook: faltan #lab-host, #exhibits, #readout en la página"` (orden de `STORYBOOK_IDS`, A3).
  - `mountStorybook` con un `run` que lanza `new Error("sin mundo")`: el host muestra `"No se pudo iniciar el storybook: sin mundo"`.
  - `lab/storybook.html` tiene un elemento por cada id de `STORYBOOK_IDS`. Se parsea con `DOMParser` y la ruta se arma como en `host-keyboard.test.ts`, con `resolve(import.meta.dirname, "../..")`.

  En `src/lab/storybook.test.ts`, que sigue leyendo el fuente:
  - `storybook.ts` no contiene `getElementById(`.
  - `storybook.ts` contiene `mountStorybook(document,`.

- [ ] **Step 2:** `npx vitest run src/lab/storybook-ui.test.ts src/lab/storybook.test.ts` falla porque el módulo no existe y porque `storybook.ts` todavía usa `getElementById`.
- [ ] **Step 3: Implementar `storybook-ui.ts` (solo estas dos funciones) y reescribir `storybook.ts`.** `storybook.ts` queda como `mountStorybook(document, ({ host, nav, panel }) => { … })`: dentro va todo lo que hoy está en el nivel superior, desde `reducedMotion`/`assembleWorld` hasta `void runBoot(host, "storybook", boot);`. `renderReadout` y `boot` pasan a ser funciones internas del callback y usan `host`, `nav` y `panel` por clausura (A2). `void runBoot(host, "storybook", boot);` se mantiene literal, porque lo fija `boot.test.ts`, y el `window.addEventListener("keydown"` también (`host-keyboard.test.ts`). El JSDoc del módulo se queda en `storybook.ts`.
- [ ] **Step 4:** `npm test` y `npm run typecheck` en verde.
- [ ] **Step 5: Commit** `fix(#187): el storybook resuelve sus elementos con guarda y avisa en la página`.

### Task 2: índice, entrada actual y panel fuera del módulo de arranque

**Files:**
- Modify: `src/lab/storybook-ui.ts`
- Modify: `src/lab/storybook.ts` (bucle de `GROUPS`, `renderReadout`, bucle de `aria-current` en `show()`)
- Test: `src/lab/storybook-ui.test.ts`
- Test: `src/lab/storybook.test.ts` (sale el test de fuente de #117)

**Interfaces:**
- Consumes: `StorybookElements` de Task 1.
- Produces, en `src/lab/storybook-ui.ts`:
  - `export function buildIndex(nav: HTMLElement, groups: readonly { id: GroupId; title: string }[], exhibits: readonly Pick<Exhibit, "id" | "title" | "group">[]): void`: por cada grupo, en orden, añade un `<h2>` con el título y un `<ul>` con un `<li><a href="#id" data-id="id">título</a></li>` por cada exhibit del grupo, en orden. Es el mismo DOM que hoy.
  - `export function markCurrent(nav: HTMLElement, id: string): void`: pone `aria-current="page"` en el `a[data-id=id]` y lo quita de los demás. Si `outOfView(a.getBoundingClientRect(), nav.getBoundingClientRect())`, llama a `a.scrollIntoView({ block: "center" })`.
  - `export function renderReadout(panel: HTMLElement, r: Readout): void`: el mismo `<dl>` de nueve filas que hoy, con `replaceChildren`.

- [ ] **Step 1: Tests que fallan** en `src/lab/storybook-ui.test.ts`:
  - `buildIndex` con dos grupos y tres exhibits (uno del primer grupo y dos del segundo) deja en `nav` los hijos `H2, UL, H2, UL`. El texto de cada `h2` es el título del grupo, y los `a` de cada `ul` tienen `href` `#<id>`, `data-id` y el texto en el orden de los exhibits.
  - `buildIndex(nav, GROUPS, EXHIBITS)` crea `EXHIBITS.length` enlaces.
  - `markCurrent(nav, "b")` y luego `markCurrent(nav, "c")`: solo `c` tiene `aria-current="page"`.
  - `markCurrent` con la entrada fuera de la vista (se espía `getBoundingClientRect` del `a` para que devuelva `{ top: 1200, bottom: 1222 }`, y el del `nav`, `{ top: 0, bottom: 900 }`) llama a `scrollIntoView` una vez con `{ block: "center" }`. Con la entrada dentro (`{ top: 100, bottom: 122 }`) no lo llama.
  - `renderReadout` con una caja `min (0,0,0)`, `max (2,3,4)`, `w 2`, `d 3`, `h 4`, `solids 5`, `faces 12`, `accents 1`, `materials ["slab", "concrete"]` y `accentColors ["amber"]` deja un único `dl`. Sus pares `dt`/`dd` son `Sólidos 5`, `Caras 12`, `Acentos 1`, `Caja x 0.0 … 2.0`, `Caja y 0.0 … 3.0`, `Caja z 0.0 … 4.0`, `Ancho × fondo × alto 2.0 × 3.0 × 4.0 u`, `Materiales slab, concrete` y `Colores de acento amber`.
  - `renderReadout` con `box: null`, `materials: []` y `accentColors: []` muestra `—` en las cinco filas de caja, materiales y colores. Una segunda llamada reemplaza el `dl` y no lo duplica.

  En `src/lab/storybook.test.ts`, el `describe` de #117 que lee `outOfView(...)` del fuente se borra, porque lo cubre el test de `markCurrent`.
- [ ] **Step 2:** `npx vitest run src/lab/storybook-ui.test.ts` falla, porque las funciones no existen.
- [ ] **Step 3: Implementar las tres funciones y usarlas desde `storybook.ts`.** `show()` llama a `renderReadout(panel, readout(...src))` y a `markCurrent(nav, e.id)`, y el armado del índice pasa a ser `buildIndex(nav, GROUPS, EXHIBITS)`. Los imports que `storybook.ts` deje de usar (`outOfView`) salen de ahí. El comentario de #117 ("el índice no entra entero…") viaja con el código a `markCurrent`.
- [ ] **Step 4:** `npm test` y `npm run typecheck` en verde.
- [ ] **Step 5: Commit** `refactor(#187): índice, entrada actual y panel del storybook en storybook-ui.ts`.

## Grilling

- Rondas: 1 (la revisión no cambió tareas ni la costura del plan, solo precisó redacción y supuestos, así que no hizo falta una segunda).
- Preguntas: 17. Con fuente en el código: 13 (1, 2, 3, 6, 7, 9, 10, 11, 14, 16 y 17, más 4 y 8 en parte). Con fuente en el issue: 2 (13 y 15). Sin fuente: 4, que quedaron como supuestos técnicos (A1-A4: preguntas 4, 5, 8 y 12).
- Ambigüedades de spec: ninguna. Issues abiertos fuera de alcance: ninguno.
