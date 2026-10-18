# Fallback de `scheduleIdle` tras un frame pintado (#32): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que en navegadores sin `requestIdleCallback` el bloom se adjunte después del primer frame pintado, y no antes.

**Architecture:** el cambio vive entero en `scheduleIdle` (`src/world/bloom.ts:27-31`). El orden de preferencia queda así: `requestIdleCallback(fn, { timeout: 1000 })` si existe; si no, `requestAnimationFrame(() => setTimeout(fn, 0))`; si tampoco hay `requestAnimationFrame` (Vitest corre con `environment: "node"`), `setTimeout(fn, 0)`. Los tres llamadores (`src/main.ts:156`, `src/lab/page.ts:60`, `src/lab/storybook.ts:121`) no cambian.

**Tech Stack:** TypeScript y Vitest (`environment: "node"`, `vitest.config.ts`). Dobles con `vi.stubGlobal` y `vi.useFakeTimers`, como los tests existentes de `scheduleIdle` en `src/world/bloom.test.ts:48-66`.

**Spec:** issue #32 y su Agent Brief (comentario de triage). Fuera de alcance: la medición de presupuesto y el veredicto del bloom.

## Global Constraints

- Decisión del brief: "la garantía 'el bloom no está en el primer dibujo' vale también para el primer frame pintado en navegadores sin `requestIdleCallback`".
- Fallback pedido: `requestAnimationFrame(() => setTimeout(fn, 0))`. Sin `requestAnimationFrame`: `setTimeout(fn, 0)`.
- Criterio 1: un test con `requestIdleCallback` ausente y `requestAnimationFrame` presente verifica que `fn` no corre hasta después del callback de rAF.
- Criterio 2: los tests existentes del bloom siguen en verde (`src/world/bloom.test.ts`, `src/world/bloom-runtime.test.ts`). Ninguno se borra.
- Criterio 3: `npm test` y `npm run typecheck` en verde.
- Comentarios y nombres de tests en castellano, como el resto de `src/world`. Commit de los tests en rojo antes de implementar (`test(#32): evals`), después la implementación (`fix(#32): …`).

## Decisiones técnicas (declaradas)

1. **Por qué `setTimeout` dentro del rAF.** El callback de rAF corre antes del pintado de ese frame. Adjuntar el bloom ahí mismo lo metería en el frame que está por pintarse. El `setTimeout(fn, 0)` lo pasa a una tarea posterior, después de que ese frame se pinte.
2. **La detección es por `typeof … === "function"`**, igual que la rama de `requestIdleCallback` que ya existe. Así funciona con `vi.stubGlobal(name, undefined)` y en node, donde ninguno de los dos existe.
3. **Pestaña oculta.** Con la pestaña en segundo plano, rAF no dispara, así que el bloom espera a que vuelva a estar visible. Se acepta: tampoco se pinta nada mientras tanto, y el ticker de Pixi también usa rAF.
4. **Los tests existentes se conservan.** Ninguno se borra ni cambia de nombre, y se agregan dos tests nuevos. En la etapa de fixes, por la revisión de código, el de "si no, setTimeout 0" suma `vi.stubGlobal("requestAnimationFrame", undefined)`. Así cubre la rama sin rAF a propósito y no por depender de que node no lo tenga.

## Review Focus

1. **`fn` dentro del mismo callback de rAF.** Si alguien simplifica a `requestAnimationFrame(fn)`, el bloom entra en el frame que está por pintarse. El test nuevo ejecuta el callback de rAF y comprueba que `fn` todavía no corrió. Solo corre después de avanzar los timers.
2. **Con `requestIdleCallback` presente no se usa rAF.** Lo cubre un test nuevo: con los dos stubs presentes, `requestAnimationFrame` no se llama.
3. **`fn` corre una sola vez.** Lo cubre `toHaveBeenCalledOnce` en el test nuevo.
4. **Entorno sin rAF (node, tests).** Lo cubre el test existente "si no, setTimeout 0", sin cambios.
5. **Llamadores.** La firma `scheduleIdle(fn: () => void): void` no cambia, y el typecheck lo confirma.

---

### Task 1: fallback con `requestAnimationFrame` en `scheduleIdle`

**Files:**
- Modify: `src/world/bloom.ts:27-31`
- Test: `src/world/bloom.test.ts:48-66`

**Interfaces:**
- Consumes: nada.
- Produces: `export function scheduleIdle(fn: () => void): void`, con la misma firma.

- [ ] **Step 1: tests que fallan.** Dentro de `describe("scheduleIdle", …)` en `src/world/bloom.test.ts`, que ya tiene `afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); })` en la línea 49, dejar los dos tests existentes como están y agregar estos dos al final:

```ts
  it("con requestIdleCallback no pasa por requestAnimationFrame", () => {
    const raf = vi.fn();
    vi.stubGlobal("requestIdleCallback", vi.fn());
    vi.stubGlobal("requestAnimationFrame", raf);
    scheduleIdle(() => {});
    expect(raf).not.toHaveBeenCalled();
  });
  it("sin requestIdleCallback, espera un frame pintado: rAF y después setTimeout 0 (#32)", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1; }));
    vi.useFakeTimers();
    const fn = vi.fn();
    scheduleIdle(fn);
    vi.advanceTimersByTime(0);
    expect(fn).not.toHaveBeenCalled();
    frame!(0);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: correr y ver el rojo.** `npx vitest run src/world/bloom.test.ts`. Esperado: falla el test "#32" en el primer `expect(fn).not.toHaveBeenCalled()`, porque con el código actual `fn` corre con `advanceTimersByTime(0)` antes del callback de rAF. Los demás pasan. Medido en la etapa de grilling: `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times`.

- [ ] **Step 3: commit de los tests.** `git add src/world/bloom.test.ts && git commit -m "test(#32): evals"`.

- [ ] **Step 4: implementación mínima.** En `src/world/bloom.ts`:

```ts
/**
 * Corre `fn` cuando el navegador esté ocioso (a más tardar en 1 s). Sin `requestIdleCallback`, en la tarea
 * siguiente al próximo frame: el `setTimeout` deja que ese frame se pinte sin el bloom. Sin rAF, en la próxima tarea.
 */
export function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1000 });
  else if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(fn, 0));
  else setTimeout(fn, 0);
}
```

- [ ] **Step 5: verde.** `npx vitest run src/world/bloom.test.ts src/world/bloom-runtime.test.ts`, después `npm test` y `npm run typecheck`. Esperado: todo en verde.

- [ ] **Step 6: commit.** `git add src/world/bloom.ts && git commit -m "fix(#32): scheduleIdle waits for a painted frame without requestIdleCallback"`.

## Assumptions

1. **Orden respecto del ticker.** `app.init` corre (`src/main.ts:39`, `src/lab/page.ts:40`, `src/lab/storybook.ts:68`) antes de `scheduleIdle` (`main.ts:156`, `page.ts:60`, `storybook.ts:121`). Pixi arranca el ticker en `init` (`node_modules/pixi.js/lib/app/TickerPlugin.mjs:14,44-45`, `autoStart: true`), así que su rAF ya está pedido cuando el fallback pide el suyo. Lo esperable es que en ese frame el ticker renderice primero y que el `setTimeout` adjunte el bloom después del pintado. Pixi no lo garantiza: `Ticker.update` (`node_modules/pixi.js/lib/ticker/Ticker.mjs:423`) solo emite si `currentTime > lastTime`, y `lastTime` sale de `performance.now()` en `start()`. Con `maxFPS = 30` (`page.ts:42`, `storybook.ts:70`), `_minElapsedMS` también puede saltear ese frame. En ese caso el bloom entra antes del primer render real. El brief prescribe exactamente `rAF → setTimeout 0`, así que el arreglo se queda así. La garantía fuerte, que sería enganchar el primer `postrender` de Pixi, queda para #140. Alternativa descartada: doble rAF, que tampoco garantiza nada frente a `maxFPS`.
2. **Tests existentes intactos y dos nuevos.** Alternativa descartada: reescribir los existentes, que choca con "los tests existentes del bloom siguen en verde".
3. **Sin verificación en un navegador sin `requestIdleCallback`.** agent-browser corre Chromium, que tiene `requestIdleCallback`. Queda como verificación manual en Safari en el PR. En Chromium se verifica con el script de agent-browser de la etapa 3 que el bloom sigue adjuntándose (la rama de `requestIdleCallback` no cambió).
4. **Pestaña oculta.** `main.ts:133` frena el ticker cuando `document.hidden`, así que tampoco hay frames de Pixi mientras rAF no dispara. El brief prescribe el fallback sin cota de tiempo (ISSUE: "El fallback es `requestAnimationFrame(() => setTimeout(fn, 0))`").
5. **Si la Task 1 falla a mitad de camino,** la rama queda con `test(#32): evals` en rojo, que es el estado que el pipeline prescribe para la etapa de evals. No se revierte nada, y el estado se documenta en el issue.

## Grilling

- Rondas: 1. Fueron 12 preguntas. La revisión cambió el armado de los tests (se conservan los existentes y se agregan dos), no la costura ni las tareas, así que no hizo falta una segunda ronda.
- Fuentes de las respuestas: CODE 6 (Q1, Q2, Q4, Q7, Q8, Q10), ISSUE 3 (Q3, Q5, Q9) y sin fuente 3 (Q6, Q11, Q12). Las tres sin fuente se resolvieron como supuestos técnicos (3, 2 y 5).
- Supuestos: ver `## Assumptions` 1 a 5.
- Issues abiertos: ninguno. No hubo preguntas fuera de alcance ni ambigüedades de spec.
- Q1, sobre los fake timers y el stub de rAF: Vitest 5.0.0, sin `fakeTimers` en `vitest.config.ts`. Una prueba con la implementación aplicada dio 9/9 en verde, así que `useFakeTimers()` no pisa el stub de `requestAnimationFrame`.
