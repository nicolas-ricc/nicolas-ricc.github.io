# Capa desconocida en los animadores (#25): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que pedir una capa con un id que no existe lance un `Error` que nombra el animador y el id, en lugar de `TypeError: layers[id] is not a function`.

**Architecture:** `src/scenes/animator.ts`, el módulo que define el contrato `Animator`, gana un helper puro `layerLookup(animator, layers)`. Recibe el nombre del adaptador y la tabla `Record<string, () => AnimLayer>` que ya arma cada uno, y devuelve la función `layer(id)`. Esa función busca el id con `Object.hasOwn` y, si no está, lanza `Error("Capa desconocida en <animator>: <id>")`. Los siete adaptadores (`city`, `factory`, `fair`, `sea`, `shipyard`, `tech`, `water`) cambian `layer: (id) => layers[id]!()` por `layer: layerLookup("<nombre>Animator", layers)`.

**Tech Stack:** TypeScript (target ES2022, así que `Object.hasOwn` está disponible) y Vitest. Sin Pixi: los adaptadores son lógica pura.

**Spec:** issue #25 y su Agent Brief (comentario de triage). Fuera de alcance: cambiar los ids de capas existentes.

## Global Constraints

- Criterio 1: un test unitario del helper verifica que el mensaje incluye el animador y el id.
- Criterio 2: `grep -rn 'layers\[id\]!' src/` no devuelve nada.
- Criterio 3: `npm test` y `npm run typecheck` en verde.
- No cambia ningún id de capa ni el comportamiento con ids válidos. Los tests existentes de los adaptadores siguen en verde sin tocarlos.
- Nombres de tests, comentarios y mensajes en castellano, como el resto de `src/scenes`. El mensaje sigue el estilo de `src/map/zones.ts:24` (`Zona desconocida: ${id}`). Commits `test(#25): …`, `feat(#25): …`, `refactor(#25): …`.

## Decisiones técnicas (declaradas)

1. **Forma del helper.** Es una fábrica (`layerLookup(animator, layers) => (id) => AnimLayer`) y no una función de tres argumentos. Así cada adaptador escribe `layer: layerLookup("seaAnimator", layers)` en una línea, igual que hoy. La tabla se lee en cada llamada, no se copia, así que las capas que `sea-animator.ts` agrega después de declarar la tabla (`SHIPS.forEach`) siguen visibles. Esto pasa igual hoy.
2. **Nombre del animador.** Se usa el nombre de la función exportada (`seaAnimator`, `techAnimator`, …) porque es lo que se busca con grep en el código y en el stack. Los prefijos de id (`sea.`) no sirven: el id pedido puede no tener ningún prefijo.
3. **`Object.hasOwn` en vez de `layers[id]`.** Con un acceso indexado, `layer("toString")` o `layer("constructor")` encontrarían el método heredado de `Object.prototype` y devolverían basura en vez de fallar. `Object.hasOwn` solo acepta claves propias de la tabla.
4. **`Error`, no una subclase.** El brief pide un `Error` con el animador y el id. Nadie captura este error: es un error de programación. Una clase propia sería abstracción especulativa.

## Review Focus

1. Un id heredado de `Object.prototype` (`"toString"`, `"constructor"`, `"__proto__"`) debe lanzar el error descriptivo, no devolver ni llamar el método heredado. Lo cubre un test de la Task 1.
2. Una capa agregada a la tabla después de crear el lookup (el caso de `sea-animator.ts`) tiene que resolverse. Lo cubre un test de la Task 1.
3. Con un id válido, cada adaptador devuelve la misma capa que antes, y la función de la tabla se llama en cada `layer(id)`, sin cachear: los adaptadores reconstruyen la geometría por frame. Lo cubren un test de la Task 1 (dos llamadas, dos invocaciones) y los tests existentes de los adaptadores.
4. Ningún adaptador queda con el acceso viejo. Lo cubre el test por adaptador de la Task 2 (los siete lanzan el error descriptivo) y, además, el grep del criterio 2.
5. `factory-animator.ts` no tiene archivo de test propio. El test de la Task 2 lo construye con `factory(createRng(7))`, igual que `world.ts:58`.

---

### Task 1: helper `layerLookup` en `animator.ts`

**Files:**
- Modify: `src/scenes/animator.ts` (agregar la función al final)
- Create: `src/scenes/animator.test.ts`

**Interfaces:**
- Consumes: el tipo `AnimLayer` de `src/scenes/animator.ts`.
- Produces:
  ```ts
  export function layerLookup(animator: string, layers: Readonly<Record<string, () => AnimLayer>>): (id: string) => AnimLayer;
  ```
  Error lanzado: `new Error(\`Capa desconocida en ${animator}: ${id}\`)`.

- [ ] **Step 1: test que falla**

Crear `src/scenes/animator.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { layerLookup, type AnimLayer } from "./animator";

const capa: AnimLayer = { kind: "accent", accents: [] };

describe("layerLookup", () => {
  it("resuelve un id de la tabla llamando a su función en cada pedido", () => {
    const f = vi.fn(() => capa);
    const layer = layerLookup("pruebaAnimator", { "prueba.a": f });
    expect(layer("prueba.a")).toBe(capa);
    expect(layer("prueba.a")).toBe(capa);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("con un id desconocido lanza un Error que nombra el animador y el id", () => {
    const layer = layerLookup("pruebaAnimator", { "prueba.a": () => capa });
    expect(() => layer("prueba.b")).toThrow(new Error("Capa desconocida en pruebaAnimator: prueba.b"));
  });

  it("no confunde las claves heredadas de Object.prototype con capas", () => {
    const layer = layerLookup("pruebaAnimator", {});
    for (const id of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(() => layer(id)).toThrow(`Capa desconocida en pruebaAnimator: ${id}`);
    }
  });

  it("ve las capas agregadas a la tabla después de crear el lookup", () => {
    const layers: Record<string, () => AnimLayer> = {};
    const layer = layerLookup("pruebaAnimator", layers);
    layers["prueba.tarde"] = () => capa;
    expect(layer("prueba.tarde")).toBe(capa);
  });
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `npx vitest run src/scenes/animator.test.ts`
Expected: FAIL. `layerLookup` no existe todavía (`layerLookup is not a function` o un error de import).

- [ ] **Step 3: implementación mínima**

Al final de `src/scenes/animator.ts`:

```ts
/** `layer(id)` de un adaptador sobre su tabla de capas; un id ajeno a la tabla lanza un error que nombra al animador. */
export function layerLookup(animator: string, layers: Readonly<Record<string, () => AnimLayer>>): (id: string) => AnimLayer {
  return (id) => {
    const layer = Object.hasOwn(layers, id) ? layers[id] : undefined;
    if (!layer) throw new Error(`Capa desconocida en ${animator}: ${id}`);
    return layer();
  };
}
```

Sin `!`: el criterio 2 pide que `grep -rn 'layers\[id\]!' src/` no devuelva nada, y eso incluye al helper. `hasOwn` no estrecha el tipo del acceso indexado, así que se estrecha con la variable local.

- [ ] **Step 4: correr y ver que pasa**

Run: `npx vitest run src/scenes/animator.test.ts && npm run typecheck`
Expected: 4 tests PASS, typecheck sin errores.

- [ ] **Step 5: commit**

```bash
git add src/scenes/animator.ts src/scenes/animator.test.ts
git commit -m "feat(#25): layerLookup names the animator and id of an unknown layer"
```

---

### Task 2: los siete adaptadores usan `layerLookup`

**Files:**
- Modify: `src/scenes/city-animator.ts:17`, `src/scenes/factory-animator.ts:13`, `src/scenes/fair-animator.ts:18`, `src/scenes/sea-animator.ts:23`, `src/scenes/shipyard-animator.ts:16`, `src/scenes/tech-animator.ts:17`, `src/scenes/water-animator.ts:14`
- Create: `src/scenes/animators.test.ts`

**Interfaces:**
- Consumes: `layerLookup(animator: string, layers: Readonly<Record<string, () => AnimLayer>>): (id: string) => AnimLayer` de la Task 1. Constructores existentes: `cityAnimator(scene, rng, opts)`, `factoryAnimator(scene, rng, opts)`, `fairAnimator(scene, opts)`, `seaAnimator(scene, opts)`, `shipyardAnimator(scene, rng, opts)`, `techAnimator(scene, rng, opts)`, `waterAnimator(terrain, opts)`. Escenas: `city(createRng(7), createRng(8))`, `factory(createRng(7))`, `fair(createRng(7))`, `world(7).sea!`, `shipyard(createRng(7))`, `tech(createRng(7))`, `world(7).terrain`.
- Produces: nada nuevo para otras tareas.

- [ ] **Step 1: test que falla**

Crear `src/scenes/animators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import type { Animator } from "./animator";
import { city } from "./city";
import { cityAnimator } from "./city-animator";
import { factory } from "./factory";
import { factoryAnimator } from "./factory-animator";
import { fair } from "./fair";
import { fairAnimator } from "./fair-animator";
import { seaAnimator } from "./sea-animator";
import { shipyard } from "./shipyard";
import { shipyardAnimator } from "./shipyard-animator";
import { tech } from "./tech";
import { techAnimator } from "./tech-animator";
import { waterAnimator } from "./water-animator";
import { world } from "./world";

const opts = { reducedMotion: false };
const w = world(7);
const animators: [string, () => Animator][] = [
  ["cityAnimator", () => cityAnimator(city(createRng(7), createRng(8)), createRng(3), opts)],
  ["factoryAnimator", () => factoryAnimator(factory(createRng(7)), createRng(3), opts)],
  ["fairAnimator", () => fairAnimator(fair(createRng(7)), opts)],
  ["seaAnimator", () => seaAnimator(w.sea!, opts)],
  ["shipyardAnimator", () => shipyardAnimator(shipyard(createRng(7)), createRng(3), opts)],
  ["techAnimator", () => techAnimator(tech(createRng(7)), createRng(3), opts)],
  ["waterAnimator", () => waterAnimator(w.terrain, opts)],
];

describe("capa desconocida en los adaptadores", () => {
  it.each(animators)("%s nombra el animador y el id", (name, mk) => {
    const a = mk();
    expect(() => a.layer("nada.capa")).toThrow(new Error(`Capa desconocida en ${name}: nada.capa`));
    expect(() => a.layer("toString")).toThrow(`Capa desconocida en ${name}: toString`);
  });

  it.each(animators)("%s sigue resolviendo todos sus ids", (_, mk) => {
    const a = mk();
    expect(a.ids.length).toBeGreaterThan(0);
    for (const id of a.ids) expect(["solid", "accent", "water"]).toContain(a.layer(id).kind);
  });
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `npx vitest run src/scenes/animators.test.ts`
Expected: los siete casos "nombra el animador y el id" FAIL: se lanza `TypeError: layers[id] is not a function`, no el mensaje esperado. Los siete "sigue resolviendo" PASS.

- [ ] **Step 3: migrar los adaptadores**

En cada uno de los siete archivos, cambiar el import de tipos de `./animator` para traer también el helper:

```ts
import { layerLookup, type AnimLayer, type Animator } from "./animator";
```

y reemplazar la línea `layer: (id) => layers[id]!(),` por la del adaptador:

| Archivo | Línea nueva |
|---|---|
| `city-animator.ts` | `layer: layerLookup("cityAnimator", layers),` |
| `factory-animator.ts` | `layer: layerLookup("factoryAnimator", layers),` |
| `fair-animator.ts` | `layer: layerLookup("fairAnimator", layers),` |
| `sea-animator.ts` | `layer: layerLookup("seaAnimator", layers),` |
| `shipyard-animator.ts` | `layer: layerLookup("shipyardAnimator", layers),` |
| `tech-animator.ts` | `layer: layerLookup("techAnimator", layers),` |
| `water-animator.ts` | `layer: layerLookup("waterAnimator", layers),` |

Nada más cambia en los adaptadores.

- [ ] **Step 4: correr y ver que pasa**

Run: `npx vitest run src/scenes/animators.test.ts && grep -rn 'layers\[id\]!' src/ ; npm test && npm run typecheck`
Expected: 14 tests PASS. El grep no imprime nada. Suite completa y typecheck en verde.

- [ ] **Step 5: commit**

```bash
git add src/scenes/*-animator.ts src/scenes/animators.test.ts
git commit -m "refactor(#25): animator adapters resolve layers through layerLookup"
```
