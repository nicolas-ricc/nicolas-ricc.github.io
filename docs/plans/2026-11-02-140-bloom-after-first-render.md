# Bloom tras el primer render real de Pixi (#140): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** garantía firme de que el bloom se engancha después del primer render real de Pixi, no por orden de rAF ni por `requestIdleCallback`.

**Architecture:** una función Pixi-free `afterFirstRender(postrender, fn)` en `src/world/bloom.ts` cuelga un listener de un solo uso del runner `postrender` del renderer; en su primer `postrender` programa `setTimeout(fn, 0)` y se descuelga con `queueMicrotask` (quitar dentro de `emit` rompe el loop de `SystemRunner`, mismo patrón que `attachBloom` en `src/world/bloom-runtime.ts:35`). Los tres arranques (`src/main.ts:164`, `src/lab/page.ts:72`, `src/lab/storybook.ts:127`) la usan en lugar de `scheduleIdle`, que se borra.

**Tech Stack:** TypeScript, Vitest (`environment: "node"`), Pixi v8 (`SystemRunner.emit` itera con `len` capturado: `node_modules/pixi.js/lib/rendering/renderers/shared/system/SystemRunner.mjs:16-22`).

**Spec:** issue #140, decisión del dueño (2026-11-01) y brief del planner (comentario "Plan (planner, 2026-11-02)").

## Global Constraints

- Garantía firme: "el bloom se engancha después del primer render real de Pixi (`renderer.runners.postrender`, y después una tarea), no por orden de rAF".
- "Test unitario con un runner falso." `src/world/bloom.test.ts` no nombra `pixi.js`; `PIXI_TESTS` de `src/iso/pixi-free.test.ts` no se toca.
- "Código, comentarios y mensajes de test nuevos, en inglés (ver #194)." Lo existente en castellano que no se toca, queda. README sigue en castellano.
- `attachBloom` y sus argumentos no cambian.
- `grep -rn scheduleIdle src` vacío al final. `docs/plans/2026-10-18-32-schedule-idle-raf.md` no se toca.
- `npm test` y `npm run typecheck` en verde.

## Decisiones técnicas (declaradas)

1. Tipo estructural, sin importar Pixi:
   `export interface RenderRunner { add(listener: { postrender(): void }): unknown; remove(listener: { postrender(): void }): unknown }`.
   `SystemRunner` de Pixi (`add(item: unknown): this`) lo satisface; lo confirma el typecheck de los tres arranques.
2. `setTimeout(fn, 0)` y no `fn()` dentro de `postrender`: el frame ya renderizado se presenta sin el bloom y `fn` corre en la tarea siguiente.
3. Flag `done`: un segundo `postrender` antes del microtask del `remove` no programa `fn` otra vez.
4. Pestaña oculta / sin render: `fn` espera al primer render. Se acepta: sin render no hay nada que mostrar (antes el fallback rAF ya esperaba igual).
5. Sin Safari ni captura en navegador como criterio (brief, punto 7): la garantía sale de la semántica del runner (`postrender` sólo se emite en `AbstractRenderer.render`).

## Review Focus

1. **`fn` síncrono dentro de `postrender`** (bloom en el mismo frame): test "does not run fn before any postrender, nor synchronously inside the first one".
2. **Doble programación** con dos renders antes del microtask: test "a second postrender before the task does not schedule fn twice".
3. **`remove` síncrono dentro de `emit`** saltea a otro listener del runner (p. ej. el de `attachBloom`): test con un runner falso que itera con `len` capturado.
4. **Listener que queda colgado** para siempre: test "detaches itself after the first postrender".
5. **Tipos de Pixi vs. `RenderRunner`**: `npm run typecheck` sobre los tres arranques.

---

### Task 1: `afterFirstRender` en `src/world/bloom.ts`

**Files:**
- Modify: `src/world/bloom.ts` (agregar al final)
- Test: `src/world/bloom.test.ts` (nuevo bloque `describe("afterFirstRender")`)

**Interfaces:**
- Produces: `export interface RenderRunner` (decisión 1) y `export function afterFirstRender(postrender: RenderRunner, fn: () => void): void`.

- [ ] **Step 1: Write the failing tests.** Runner falso local que imita `SystemRunner.emit`:

```ts
const fakeRunner = () => {
  const items: { postrender(): void }[] = [];
  return {
    items,
    add(l: { postrender(): void }) { items.push(l); },
    remove(l: { postrender(): void }) { const i = items.indexOf(l); if (i >= 0) items.splice(i, 1); },
    // same loop as Pixi's SystemRunner.emit: length captured up front
    emit() { for (let i = 0, len = items.length; i < len; i++) items[i]!.postrender(); },
  };
};
```

`afterEach(() => vi.useRealTimers())`; `vi.useFakeTimers()` en cada test. Casos y aserciones:
  - "does not run fn before any postrender, nor synchronously inside the first one": `advanceTimersByTime(0)` sin emitir → `fn` no llamado; `emit()` → `fn` todavía no llamado.
  - "runs fn once in the task after the first postrender": `emit(); advanceTimersByTime(0)` → `toHaveBeenCalledOnce()`.
  - "a second postrender before the task does not schedule fn twice": `emit(); emit(); advanceTimersByTime(0)` → una llamada.
  - "detaches itself after the first postrender": `emit(); await Promise.resolve()` → `items` vacío; `emit(); advanceTimersByTime(0)` → una sola llamada.
  - "detaching does not skip a listener added after it": `afterFirstRender` y después `runner.add(other)` con `other.postrender = vi.fn()`; `emit(); await Promise.resolve(); emit()` → `other.postrender` llamado 2 veces.

- [ ] **Step 2: Run** `npm test -- src/world/bloom.test.ts` → FAIL (`afterFirstRender` no existe).
- [ ] **Step 3: Implement** según Architecture y decisiones 1–3, con JSDoc en inglés: `/** Runs \`fn\` in the task after Pixi's first real render: a one-shot \`postrender\` listener, then \`setTimeout(fn, 0)\`. */`.
- [ ] **Step 4: Run** `npm test -- src/world/bloom.test.ts src/iso/pixi-free.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(#140): afterFirstRender`.

### Task 2: arranques, borrado de `scheduleIdle`, README

**Files:**
- Modify: `src/main.ts:18,163-164`, `src/lab/page.ts:5,71-72`, `src/lab/storybook.ts:5,124,127`
- Modify: `src/world/bloom.ts` (borrar `scheduleIdle` y su JSDoc), `src/world/bloom.test.ts` (borrar `describe("scheduleIdle")` y su import)
- Modify: `README.md:102-104`

**Interfaces:**
- Consumes: `afterFirstRender(postrender: RenderRunner, fn: () => void): void` de Task 1.

- [ ] **Step 1:** En los tres arranques, `scheduleIdle(() => {...})` → `afterFirstRender(app.renderer.runners.postrender, () => {...})`, mismo cuerpo. Comentario de la línea anterior reescrito en inglés: en `main.ts` `// bloom attaches in the task after Pixi's first real render: the first frame is served without the filter`; en `page.ts` `// deferred like the site; ?bloom= forces the mode and skips measuring`; en `storybook.ts` `// deferred like page.ts; later stages inherit the mode in show()` (la línea sobre `attachBloom` y el stage `live` queda como está).
- [ ] **Step 2:** Borrar `scheduleIdle` y su bloque de tests. Verificar `grep -rn scheduleIdle src` → vacío.
- [ ] **Step 3:** README, párrafo "El bloom de las luces…": "lo activan después del primer render real de Pixi (el `postrender` de `app.renderer`), en la tarea siguiente (`afterFirstRender`, `src/world/bloom.ts`; `attachBloom`, `src/world/bloom-runtime.ts`), no por orden de rAF ni por `requestIdleCallback`", resto igual.
- [ ] **Step 4: Run** `npm test` y `npm run typecheck` → todo verde.
- [ ] **Step 5: Commit** `fix(#140): attach bloom after Pixi's first render`.
