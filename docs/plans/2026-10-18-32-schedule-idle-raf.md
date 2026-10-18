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
4. **Un test por rama.** El test existente "si no, setTimeout 0" pasa a anular también `requestAnimationFrame` de forma explícita. Así no depende de que node no lo tenga.

## Review Focus

1. **`fn` dentro del mismo callback de rAF.** Si alguien simplifica a `requestAnimationFrame(fn)`, el bloom entra en el frame que está por pintarse. El test nuevo ejecuta el callback de rAF y comprueba que `fn` todavía no corrió. Solo corre después de avanzar los timers.
2. **Con `requestIdleCallback` presente no se usa rAF.** El test existente se amplía: con los dos stubs presentes, `requestAnimationFrame` no se llama.
3. **`fn` corre una sola vez.** Lo cubre `toHaveBeenCalledOnce` en el test nuevo.
4. **Entorno sin rAF (node, tests).** Lo cubre el test existente, ahora con `requestAnimationFrame` anulado de forma explícita.
5. **Llamadores.** La firma `scheduleIdle(fn: () => void): void` no cambia, y el typecheck lo confirma.

---

### Task 1: fallback con `requestAnimationFrame` en `scheduleIdle`

**Files:**
- Modify: `src/world/bloom.ts:27-31`
- Test: `src/world/bloom.test.ts:48-66`

**Interfaces:**
- Consumes: nada.
- Produces: `export function scheduleIdle(fn: () => void): void`, con la misma firma.

- [ ] **Step 1: tests que fallan.** Dentro de `describe("scheduleIdle", …)` en `src/world/bloom.test.ts`, reemplazar los dos tests por estos tres:

```ts
  it("usa requestIdleCallback con timeout 1000 si existe, sin pasar por rAF", () => {
    const ric = vi.fn();
    const raf = vi.fn();
    vi.stubGlobal("requestIdleCallback", ric);
    vi.stubGlobal("requestAnimationFrame", raf);
    const fn = () => {};
    scheduleIdle(fn);
    expect(ric).toHaveBeenCalledWith(fn, { timeout: 1000 });
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
  it("sin requestIdleCallback ni rAF, setTimeout 0: no corre en el acto", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.useFakeTimers();
    const fn = vi.fn();
    scheduleIdle(fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: correr y ver el rojo.** `npx vitest run src/world/bloom.test.ts`. Esperado: falla el test "#32", porque `fn` corre con `advanceTimersByTime(0)` antes del callback de rAF (y `frame` queda `undefined`). Los otros dos pasan.

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
