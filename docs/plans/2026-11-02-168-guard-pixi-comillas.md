# Guard de motor sin Pixi con cualquier comilla y convención en el README (#168): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el guard de fuentes de `src/iso` y `src/scenes` detecte cualquier import de Pixi (comillas simples o dobles, `import()`, `import type`) con la misma expresión que el guard de tests, y que el README documente la convención «los tests del motor no usan Pixi» con sus excepciones.

**Architecture:** en `src/iso/pixi-free.test.ts` una sola constante `PIXI_IMPORT = /["']pixi\.js["']/` reemplaza los dos literales; un `it` nuevo fija qué formas detecta. Un párrafo nuevo del README, bajo `## Tests` al final, enuncia la convención y nombra las excepciones de `PIXI_TESTS`; un `describe` nuevo en `src/lab/docs.test.ts` lo guarda y comprueba que cada excepción del guard figura en el párrafo.

**Tech Stack:** TypeScript, Vitest (`readFileSync` sobre fuentes y README).

**Spec:** issue #168 (follow-up de #103) y su comentario del 2026-11-02 (decisión de #166).

## Global Constraints

- Archivos que cambian: `src/iso/pixi-free.test.ts`, `src/lab/docs.test.ts`, `README.md`.
- Expresión del guard, la del guard de tests de #103: `/["']pixi\.js["']/`.
- Frase exacta del README (comentario del issue): «los tests del motor no usan Pixi».
- Excepciones (comentario del issue): los tests de `stage` y `bloom-runtime`, es decir `src/world/stage.test.ts` y `src/world/bloom-runtime.test.ts`, «quedan explícitas».
- **Ningún test puede contener `pixi.js` entre comillas** (`'pixi.js'`, `"pixi.js"`): el guard de tests de #103 lo rechaza en todo `src/**/*.test.ts`, incluido el propio `pixi-free.test.ts`. Los fixtures arman el nombre del módulo con `["pixi", "js"].join(".")` y templates.
- Tests, comentarios y mensajes en castellano. Commits `test(#168): evals`, `fix(#168): …`, `docs(#168): …`.

## Decisiones técnicas (declaradas)

1. **Una constante para los dos guards.** El issue pide que el de fuentes «use el mismo» regex que el de tests. Compartir `PIXI_IMPORT` lo hace por construcción y evita que vuelvan a divergir.
2. **Sin buscar `from` ni `import`.** `/["']pixi\.js["']/` cubre `from '…'`, `import("…")`, `import type … from '…'` y `export … from '…'` porque solo mira el especificador. No coincide con `pixi.js-legacy` ni con `@pixi/…` (otros paquetes) ni con `pixi.js` sin comillas en un comentario: hoy ningún fuente de `src/iso`/`src/scenes` lo menciona entre comillas (`grep -rnE "[\"']pixi\.js[\"']" src/iso src/scenes` vacío), así que ampliar no rompe nada.
3. **Sección `## Tests` al final del README.** Es una convención de tests, no del mundo isométrico; los párrafos existentes no se tocan (otros tests de `docs.test.ts` parten el README por párrafos).
4. **El README no repite la lista a mano sin control.** El test lee `PIXI_TESTS` del texto de `pixi-free.test.ts` y exige que cada ruta aparezca en el párrafo; si #166 o un sucesor agrega una excepción, el test pide documentarla.

## Review Focus

1. Comillas simples en un fuente del motor (`import { Graphics } from 'pixi.js'`): el guard debe fallar. Lo fija el `it` de formas detectadas (Task 1).
2. `import("pixi.js")` dinámico e `import type` con comillas simples: mismo `it` (Task 1).
3. Falsos positivos con paquetes vecinos (`'pixi.js-legacy'`, `'@pixi/core'`) o la palabra pixi.js suelta en un comentario: el `it` exige que no coincidan (Task 1).
4. Que el propio archivo de guard y `docs.test.ts` no se disparen a sí mismos: el guard de tests corre sobre ambos en la suite completa (Tasks 1 y 2, paso de suite).
5. Excepción nueva en `PIXI_TESTS` sin documentar en el README: el test de Task 2 la detecta.

---

### Task 1: Guard de fuentes con `PIXI_IMPORT`

**Files:**
- Modify: `src/iso/pixi-free.test.ts` (constante arriba, `:28` y `:56` la usan, `it` nuevo)

**Interfaces:**
- Consumes: nada.
- Produces: `const PIXI_IMPORT: RegExp` (no exportada) y el `Set` `PIXI_TESTS` con su forma actual `new Set(["…", "…"])`, que Task 2 lee como texto.

- [ ] **Step 1: Escribir el test que falla**

`describe("PIXI_IMPORT (#168)")`, arriba de los otros dos:

```ts
describe("PIXI_IMPORT (#168)", () => {
  // armado, para que este archivo no caiga en su propio guard de tests
  const MOD = ["pixi", "js"].join(".");
  it("detecta comillas simples y dobles, import() e import type", () => {
    for (const src of [
      `import { Graphics } from "${MOD}";`,
      `import { Graphics } from '${MOD}';`,
      `import type { Container } from '${MOD}';`,
      `const pixi = await import("${MOD}");`,
      `export { Ticker } from '${MOD}';`,
    ])
      expect(src).toMatch(PIXI_IMPORT);
  });
  it("no confunde paquetes vecinos ni menciones sueltas", () => {
    for (const src of [`from '${MOD}-legacy'`, `from "@pixi/core"`, `// sin ${MOD} acá`]) expect(src).not.toMatch(PIXI_IMPORT);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx vitest run src/iso/pixi-free.test.ts`
Expected: FAIL, `PIXI_IMPORT is not defined` (o error de TS/referencia).

- [ ] **Step 3: Definir `const PIXI_IMPORT = /["']pixi\.js["']/;`** debajo de `DIRS`, con un comentario de una línea (cualquier comilla, también `import()` e `import type`), y usarla en `:28` (`not.toMatch(PIXI_IMPORT)`) y en el guard de tests (`:56`).

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/iso/pixi-free.test.ts`
Expected: PASS, todos los `it`.

- [ ] **Step 5: Commit** `fix(#168): guard de fuentes sin Pixi con cualquier comilla`

### Task 2: Convención en el README

**Files:**
- Modify: `README.md` (sección nueva al final)
- Modify: `src/lab/docs.test.ts` (`describe` nuevo al final)

**Interfaces:**
- Consumes: el texto de `src/iso/pixi-free.test.ts` con `const PIXI_TESTS = new Set([...])` (Task 1 no lo cambia).
- Produces: nada.

- [ ] **Step 1: Escribir el test que falla**

```ts
describe("convención de tests sin Pixi (#103, #168)", () => {
  const sec = readme.slice(Math.max(0, readme.search(/^## Tests$/m)));
  const guard = readFileSync(`${ROOT}src/iso/pixi-free.test.ts`, "utf8");
  it("README tiene una sección de tests con la convención", () => {
    expect(readme).toMatch(/^## Tests$/m);
    expect(sec).toContain("los tests del motor no usan Pixi");
    expect(sec).toContain("src/iso/pixi-free.test.ts");
    for (const d of ["src/iso/", "src/scenes/"]) expect(sec).toContain(d);
  });
  it("README nombra cada excepción de PIXI_TESTS", () => {
    const set = /PIXI_TESTS = new Set\(\[([^\]]*)\]\)/.exec(guard)?.[1] ?? "";
    const paths = [...set.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(sec).toContain(p);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: FAIL en los dos `it` nuevos (no hay `## Tests`).

- [ ] **Step 3: Agregar al final de `README.md`** una línea en blanco, `## Tests` y un párrafo que diga, con estas piezas: «los tests del motor no usan Pixi»; el guard `src/iso/pixi-free.test.ts` falla si un fuente de `src/iso/` o `src/scenes/` importa `pixi.js` o si un test de `src/` lo nombra, con comillas simples o dobles, `import()` o `import type`; los tests usan dobles; las excepciones explícitas son los tests de módulos de Pixi, `src/world/stage.test.ts` y `src/world/bloom-runtime.test.ts` (`PIXI_TESTS` en el guard, #166), y una excepción nueva se agrega ahí y en este párrafo.

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lab/docs.test.ts src/iso/pixi-free.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite y typecheck**

Run: `npm test && npm run typecheck`
Expected: todo verde.

- [ ] **Step 6: Commit** `docs(#168): convención de tests sin Pixi en el README`
