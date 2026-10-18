# `Stage.destroy()` que libere el `bloomSlot`, los filtros y los contextos (#102): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el `Stage` que devuelve `buildStage` expone `destroy()`, que libera todo lo que el stage armó (árbol con sus contextos, `bloomSlot` aunque esté separado, filtros), y el storybook lo usa en lugar de destruir el contenedor a mano.

**Architecture:** la Task 1 agrega `destroy()` al tipo `Stage` y a su implementación en `src/world/stage.ts`. Un flag `destroyed` en el closure hace que `destroy()` sea idempotente y que `setFocus`, `setBloom`, `setLayer` y `tick` no hagan nada después. La Task 2 cambia la línea de `show()` en `src/lab/storybook.ts` que hoy llama `stage?.container.destroy(...)` por `stage?.destroy()`.

**Tech Stack:** TypeScript, PixiJS v8 y Vitest.

**Spec:** issue #102 y su Agent Brief (el comentario de triage). Fuera de alcance: los velos perezosos y el repintado del agua recortada (los dos puntos "relacionados y menores" del issue).

## Global Constraints

- Criterio 1: un test del stage, sin Pixi real y con el patrón de dobles que ya usa `stage.test.ts` (el `vi.mock` de `AlphaFilter` y `BlurFilter`), verifica que `destroy()` destruye el `bloomSlot` creado por `setBloom("on")` aunque el modo actual sea `off`.
- Criterio 2: el storybook no llama a `container.destroy` directamente.
- Criterio 3: `npm test`, `npm run typecheck` y `npm run build` en verde.
- Del brief: `destroy()` destruye el contenedor con `children: true, context: true`, además del `bloomSlot` si existe, y libera su filtro. Después de `destroy()`, `setBloom`, `setLayer` y `setFocus` no lanzan (no-op).
- Ninguna expectativa existente de `stage.test.ts` se edita. Los tests nuevos solo se agregan.
- Commits: los tests de las dos tasks se escriben y se commitean juntos antes de implementar, como `test(#102): evals` (los dos fallan). Cada task después commitea solo su código de producción. Si el implementer encuentra los tests ya escritos, el Step 1 se salta y el Step 2 confirma que fallan.
- Tests y comentarios en castellano, como el resto del código. Los mensajes de commit en inglés, como en el historial (`fix(#98): …`).

## Decisiones técnicas (declaradas)

1. **Filtros a mano.** En Pixi v8, `Container.destroy` (`node_modules/pixi.js/lib/scene/container/Container.mjs:1133`) no destruye `filters`: solo pone en null `_filterEffect`. Por eso `destroy()` junta antes los filtros del stage (el `BlurFilter` del `bloomSlot` y los dos `AlphaFilter` de `shadowSlot` y `coreSlot`) y los destruye después. Los `AlphaFilter` no aparecen en el issue, pero se filtran igual y los arma el mismo stage. Liberarlos es parte de "liberar lo que el stage armó", y es una línea.
2. **Espejos sin `context`.** Los espejos del `bloomSlot` son `new Graphics({ context: e.g.context })`, así que el contexto no es suyo y `Graphics.destroy` no lo toca. Lo libera la Graphics de acentos original cuando se destruye el árbol con `context: true`. El `bloomSlot` se destruye con `{ children: true }`.
3. **Orden.** Primero se leen los filtros, porque después de `Container.destroy` el getter `filters` ya no los devuelve. Después se destruye `bloomSlot`, luego `container` y al final los filtros. Si el modo es `on`, el `bloomSlot` es hijo de `container`, y destruirlo primero lo saca del árbol (`removeFromParent`). Así no se destruye dos veces, aunque `Container.destroy` igual se protege con `if (this.destroyed) return`.
4. **Idempotencia y no-op.** Un `let destroyed = false` en el closure. `destroy()` repetido no hace nada, y lo mismo `setFocus`, `setBloom`, `setLayer` y `tick` (el ticker del storybook podría correr un frame más). `bloom` conserva el último modo.
5. **Doble de filtro.** El `StubFilter` del mock gana `destroyed = false` y `destroy() { this.destroyed = true; }`, siguiendo el patrón de `Container.destroyed` de Pixi. Así el test sabe si el filtro se liberó sin compilar shaders.
6. **El criterio 2 se prueba leyendo el fuente**, como en `src/lab/lab-excluded.test.ts` y en #68 (`ships.test.ts`). `storybook.ts` arranca la app al importarse (`void boot()`), así que no se puede importar en node. El test nuevo `src/lab/storybook.test.ts` lee el archivo y exige que no aparezca `container.destroy(` y que sí aparezca `stage?.destroy()`.

## Review Focus

1. Destroy con bloom en `on` (el `bloomSlot` está en el árbol): no lanza y el filtro se libera. Lo cubre un test de la Task 1.
2. Destroy sin bloom armado nunca (`bloomSlot` null): no lanza. Lo cubre un test de la Task 1.
3. Destroy llamado dos veces: no lanza. Lo cubre un test de la Task 1.
4. Un `tick` después de destroy (un frame tardío del ticker): no lanza ni redibuja. Lo cubre un test de la Task 1.
5. El storybook, al cambiar de exhibit con el bloom en `on`, hereda el modo en el stage nuevo y no queda ningún stage viejo en `app.stage`. Lo cubre el script de agent-browser (`.scratch/evals-102.md`).

---

### Task 1: `Stage.destroy()`

**Files:**
- Modify: `src/world/stage.ts` (interfaz `Stage`, closure de `buildStage`, objeto devuelto)
- Test: `src/world/stage.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `Stage.destroy(): void`, en la interfaz exportada `Stage`.

- [ ] **Step 1: Write the failing test**

En `src/world/stage.test.ts`, el `StubFilter` del mock pasa a:

```ts
  class StubFilter { destroyed = false; constructor(readonly options?: unknown) {} destroy() { this.destroyed = true; } }
```

y al final del archivo:

```ts
describe("destroy", () => {
  type Stub = { destroyed: boolean };
  const shadowFilters = (c: Container) => [c.children[3]!, c.children[4]!].flatMap((k) => k.filters as unknown as Stub[]);

  it("destruye el bloomSlot creado por on aunque el modo actual sea off, y libera su filtro", () => {
    const s = build();
    s.setBloom("on");
    const slot = bloomSlotOf(s.container)!;
    const blur = (slot.filters as unknown as Stub[])[0]!;
    s.setBloom("off");
    s.destroy();
    expect(slot.destroyed).toBe(true);
    expect(slot.children).toHaveLength(0);
    expect(blur.destroyed).toBe(true);
  });

  it("destruye el árbol con sus contextos y los filtros de sombra", () => {
    const s = build();
    const accent = accentSlotOf(s.container).children[0] as Graphics, ctx = accent.context;
    const alphas = shadowFilters(s.container);
    s.destroy();
    expect(s.container.destroyed).toBe(true);
    expect(accent.destroyed).toBe(true);
    expect(ctx.destroyed).toBe(true);
    expect(alphas).toHaveLength(2);
    alphas.forEach((f) => expect(f.destroyed).toBe(true));
  });

  it("con el bloom en on el slot está en el árbol: se destruye una vez y libera su filtro", () => {
    const s = build();
    s.setBloom("on");
    const slot = bloomSlotOf(s.container)!, blur = (slot.filters as unknown as Stub[])[0]!;
    expect(() => s.destroy()).not.toThrow();
    expect(slot.destroyed).toBe(true);
    expect(blur.destroyed).toBe(true);
  });

  it("sin bloom armado nunca no lanza", () => {
    expect(() => build().destroy()).not.toThrow();
  });

  it("después de destroy, todo es no-op: destroy, setBloom, setLayer, setFocus y tick", () => {
    const s = build();
    s.setBloom("fallback");
    s.destroy();
    expect(() => {
      s.destroy();
      s.setBloom("on");
      s.setBloom("off");
      s.setLayer("accents", false);
      s.setFocus("blog");
      s.tick(100);
    }).not.toThrow();
    expect(s.bloom).toBe("fallback");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/stage.test.ts`
Expected: FAIL. `s.destroy is not a function` en los tests nuevos, y `npm run typecheck` marca que `destroy` no existe en `Stage`.

- [ ] **Step 3: Write minimal implementation**

En `src/world/stage.ts`, en la interfaz `Stage`, después de `tick`:

```ts
  /** Libera el árbol con sus contextos, el `bloomSlot` aunque esté fuera del árbol y los filtros; después todo es no-op. */
  destroy(): void;
```

En el closure, junto a `let bloom …`, agregar `destroyed = false` a esa misma declaración `let`:

```ts
  let bloom: BloomMode = "off", halo: HaloStyle = HALO_BASE, bloomSlot: Container | null = null, accentsVisible = true, destroyed = false;
```

Cada método del objeto devuelto empieza con la guarda:
- `setFocus(zone) { if (!destroyed) target = focusAlphas(zone); },`
- `setBloom(mode) { if (destroyed || mode === bloom) return; …`
- `setLayer(layer, visible) { if (destroyed) return; …`
- `tick(dtMs) { if (destroyed) return; …`

y se agrega:

```ts
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Container.destroy no destruye `filters`; se leen antes, porque después el getter ya no los devuelve
      const filters = [shadowSlot, coreSlot, bloomSlot].flatMap((c) => c?.filters ?? []);
      // los espejos comparten el contexto de su original: lo libera el árbol con `context: true`
      bloomSlot?.destroy({ children: true });
      container.destroy({ children: true, context: true });
      for (const f of filters) f.destroy();
    },
```

En el doc de `buildStage`, agregar al final: `` `destroy()` libera también el `bloomSlot` separado del árbol (#102). ``

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/world/stage.test.ts && npm run typecheck`
Expected: PASS, todos los tests (los viejos sin tocar).

- [ ] **Step 5: Commit**

```bash
git add src/world/stage.ts src/world/stage.test.ts
git commit -m "feat(#102): Stage.destroy releases the bloom slot, filters and contexts"
```

### Task 2: el storybook llama a `stage.destroy()`

**Files:**
- Modify: `src/lab/storybook.ts:83-84` (en `show()`)
- Create: `src/lab/storybook.test.ts`

**Interfaces:**
- Consumes: `Stage.destroy(): void` de la Task 1.
- Produces: nada.

- [ ] **Step 1: Write the failing test**

`src/lab/storybook.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// storybook.ts arranca la app al importarse: se lee el fuente, como en lab-excluded.test.ts
const src = readFileSync(new URL("./storybook.ts", import.meta.url), "utf8");

describe("ciclo de vida de los stages del storybook (#102)", () => {
  it("recicla cada stage con stage.destroy(), nunca destruyendo el contenedor a mano", () => {
    expect(src).not.toMatch(/container\.destroy\(/);
    expect(src).toContain("stage?.destroy()");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lab/storybook.test.ts`
Expected: FAIL, porque el fuente contiene `stage?.container.destroy(`.

- [ ] **Step 3: Write minimal implementation**

En `src/lab/storybook.ts`, en `show()`, reemplazar:

```ts
    // sin `context: true` los GraphicsContext de cada Graphics sobreviven hasta el GC de Pixi
    stage?.container.destroy({ children: true, context: true });
```

por:

```ts
    stage?.destroy();
```

(El comentario sobre `context: true` ya vive en `stage.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS los tres.

- [ ] **Step 5: Commit**

```bash
git add src/lab/storybook.ts src/lab/storybook.test.ts
git commit -m "fix(#102): storybook recycles stages through Stage.destroy"
```
