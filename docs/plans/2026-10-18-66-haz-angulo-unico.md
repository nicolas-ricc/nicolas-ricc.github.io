# Calcular el ángulo del haz una sola vez por frame (#66): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que `beam()` en `src/scenes/sea-anim.ts` calcule `beamAngle()` una sola vez y pase ese ángulo a las dos llamadas a `wedge`, en lugar de que cada `wedge` lo calcule por su cuenta.

**Architecture:** es un cambio local dentro de `createSeaAnim`, en `src/scenes/sea-anim.ts:157-160` (`wedge`; `beamAngle` está en `:156`) y `:178`. `wedge` pasa a recibir el ángulo como primer parámetro, `(a: number, len, color, alpha)`, y deja de llamar a `beamAngle()`. `beam` pasa de ser una flecha de expresión a una con cuerpo: hace `const a = beamAngle()` y arma las dos cuñas con ese `a`. `beamAngle` queda tal cual. La interfaz pública `SeaAnim.beam(): Accent[]` no cambia, y la salida tampoco: los dos valores ya eran iguales porque `clock` no se mueve entre las dos llamadas.

**Tech Stack:** TypeScript y Vitest (`readFileSync` sobre el fuente, igual que `src/scenes/city.test.ts:231`).

**Spec:** issue #66 y su Agent Brief (comentario de triage). Fuera de alcance: color, período o geometría del haz.

## Global Constraints

- Criterio 1: el cálculo del ángulo aparece una sola vez por tick en la construcción del haz.
- Criterio 2: los tests existentes de la animación del mar siguen en verde sin cambios de valores esperados.
- Criterio 3: `npm run typecheck` en verde.
- No se tocan `BEAM_LEN`, `BEAM_INNER`, `BEAM_HALF`, `BEAM_PERIOD_MS`, los colores (`"amberBleed"`, `"amber"`) ni los alfas (`0.5`, `0.6`).
- Tests, comentarios y mensajes de los tests en castellano. Commits `test(#66): …` y `refactor(#66): …`, en inglés como los más recientes (`004f160`, `bfe221f`).

## Decisiones técnicas (declaradas)

1. **Test sobre el fuente.** `beamAngle` y `wedge` son clausuras privadas de `createSeaAnim`: no hay forma de espiarlas desde un test sin exportarlas, y la salida de `beam()` es idéntica antes y después. El criterio 1 habla de dónde está el cálculo, así que el test lee `sea-anim.ts`. Exige dos cosas: que el cuerpo de `wedge` no mencione `beamAngle`, y que la única llamada `beamAngle()` del archivo esté dentro de `beam`. Contar llamadas solas no alcanza, porque hoy también hay una sola en el fuente (está dentro de `wedge`, que corre dos veces).
2. **El ángulo va primero en la firma de `wedge`.** Así `wedge(a, BEAM_LEN, …)` y `wedge(a, BEAM_INNER, …)` muestran a simple vista que las dos cuñas comparten rotación, que es lo que pide el issue.
3. **Un test de comportamiento como red.** Se agrega un test que fija que las dos cuñas de un mismo `beam()` tienen la misma rotación (bisectriz apex→punto medio de las puntas) en varios momentos del giro. Pasa antes y después del cambio. Protege contra que un refactor futuro desfase las cuñas.
4. **El test vive en `src/scenes/sea-anim.test.ts`**, dentro de un `describe` nuevo. No se crea un archivo aparte.

## Review Focus

1. Reduced motion: `beamAngle()` devuelve 0 y las dos cuñas apuntan al este. Lo cubre el test existente "el haz da una vuelta cada 8 s y con reduced-motion apunta al este", que no se toca.
2. El orden y los atributos de las cuñas: `["amberBleed", "amber"]`, con alfas 0.5 y 0.6 y largos `BEAM_LEN` y `BEAM_INNER`. El orden y los colores los cubre el test existente "el haz es luz cálida…". Los largos y alfas los fija el test nuevo de la Task 1.
3. Las dos cuñas tienen que compartir rotación en todo el giro, no solo en t=0. Lo cubre el test nuevo de la Task 1, que recorre cuatro momentos del período.
4. `SeaAnim.beam(): Accent[]` no cambia de firma, así que `sea-animator.ts` sigue igual. Lo cubren `npm run typecheck` y `src/scenes/sea-animator.test.ts`.
5. Que el regex del test sobre el fuente no quede vacío por un formato distinto. El test exige primero que el bloque de `wedge` exista (`toBeDefined`), y recién después mira su contenido.

---

### Task 1: `beam()` calcula el ángulo una vez y se lo pasa a `wedge`

**Files:**
- Modify: `src/scenes/sea-anim.ts:157-160` (`wedge`) y `:178` (`beam`)
- Test: `src/scenes/sea-anim.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada público nuevo. Internamente, `wedge(a: number, len: number, color: Accent["color"], alpha: number): Accent`.

- [ ] **Step 1: Write the failing tests**

En `src/scenes/sea-anim.test.ts`, agregar `import { readFileSync } from "node:fs";` como primera línea y, al final del archivo:

```ts
describe("haz: un solo ángulo por frame (#66)", () => {
  const src = readFileSync(new URL("./sea-anim.ts", import.meta.url), "utf8");
  it("wedge recibe el ángulo y no lo calcula", () => {
    const wedgeSrc = src.match(/const wedge = [\s\S]*?\n  };\n/)?.[0];
    expect(wedgeSrc).toBeDefined();
    expect(wedgeSrc).not.toMatch(/beamAngle/);
  });
  it("beam() llama una sola vez a beamAngle() y pasa el ángulo a las dos cuñas", () => {
    expect(src.match(/beamAngle\(\)/g)).toHaveLength(1);
    expect(src).toMatch(/beam: \(\) => \{\s*const \w+ = beamAngle\(\);/);
  });
  it("las dos cuñas comparten rotación en todo el giro, con sus largos y alfas", () => {
    const { a } = setup();
    // Dirección como vector unitario y no como atan2: en a = π la y del punto medio es ~0 y el signo puede saltar entre +π y −π.
    const axis = (x: Accent) => {
      if (x.kind !== "poly") throw new Error();
      expect(x.pts).toHaveLength(3);
      const o = x.pts[0]!, p = x.pts[1]!, q = x.pts[2]!;
      const mx = (p.x + q.x) / 2 - o.x, my = (p.y + q.y) / 2 - o.y, m = Math.hypot(mx, my);
      return { ux: mx / m, uy: my / m, len: Math.hypot(p.x - o.x, p.y - o.y) };
    };
    for (let t = 0; t < BEAM_PERIOD_MS; t += BEAM_PERIOD_MS / 4) {
      const [outer, inner] = a.beam().map(axis);
      expect(inner!.ux).toBeCloseTo(outer!.ux, 9);
      expect(inner!.uy).toBeCloseTo(outer!.uy, 9);
      expect(outer!.len).toBeCloseTo(BEAM_LEN, 9);
      expect(inner!.len).toBeCloseTo(BEAM_INNER, 9);
      expect(a.beam().map((x) => x.alpha)).toEqual([0.5, 0.6]);
      a.tick(BEAM_PERIOD_MS / 4);
    }
  });
});
```

Agregar `BEAM_INNER` y `BEAM_LEN` al import de `./sea-anim` (ya están exportados en `sea-anim.ts:47`). `Accent` ya está importado (`sea-anim.test.ts:3`) y `setup` ya existe (`sea-anim.test.ts:39`, reduced motion apagado por defecto).

Los Steps 1 y 2 los hace la etapa 3 del pipeline, que commitea los tests en rojo como `test(#66): evals`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/scenes/sea-anim.test.ts -t "un solo ángulo"`
Expected: FAIL en "wedge recibe el ángulo y no lo calcula" y en "beam() llama una sola vez…". PASS en "las dos cuñas comparten rotación…", que es la red de comportamiento.

- [ ] **Step 3: Write minimal implementation**

En `src/scenes/sea-anim.ts`, reemplazar `wedge`:

```ts
  const wedge = (a: number, len: number, color: Accent["color"], alpha: number): Accent => {
    const o: Vec3 = scene.lantern;
    return { kind: "poly", pts: [o, v3(o.x + len * Math.cos(a - BEAM_HALF), o.y + len * Math.sin(a - BEAM_HALF), o.z), v3(o.x + len * Math.cos(a + BEAM_HALF), o.y + len * Math.sin(a + BEAM_HALF), o.z)], color, alpha };
  };
```

y la línea de `beam` en el objeto que devuelve `createSeaAnim`:

```ts
    beam: () => {
      const a = beamAngle();
      return [wedge(a, BEAM_LEN, "amberBleed", 0.5), wedge(a, BEAM_INNER, "amber", 0.6)];
    },
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: exit 0. Los tests existentes de "mar, haz y boyas" pasan sin cambios.

- [ ] **Step 5: Commit**

El test rojo ya se commiteó en la etapa 3 del pipeline (`test(#66): evals`). Acá va solo el fuente:

```bash
git add src/scenes/sea-anim.ts
git commit -m "refactor(#66): beam() computes the beam angle once and passes it to both wedges"
```

## Assumptions

1. **Unidad de "por tick".** `sea-animator.ts:9` llama a `anim.beam()` una vez cada vez que se redibuja la capa `sea.beam`, y `sea-animator.ts:28` la marca sucia una vez por `tick` con `c.beam`. Por eso "una vez por `beam()`" equivale a "una vez por tick". Alternativa descartada: cachear el ángulo en `tick()`. Cambia dónde vive el estado y el issue no lo pide.
2. **Test sobre el fuente, sin exportar internos.** Ningún documento lo prohíbe ni lo exige. Se elige no ensanchar la API pública de `sea-anim.ts` solo para un test. Alternativa descartada: exportar `beamAngle`/`wedge` o inyectar el reloj.
3. **Nombre de la variable libre.** El regex acepta cualquier identificador (`const \w+ = beamAngle()`), así que renombrar `a` no rompe el test. Lo que sí fija es que el ángulo se calcule al abrir el cuerpo de `beam`.
4. **Formato.** El repo no tiene formateador (`package.json` sin prettier/eslint/biome). El regex de `wedge` se apoya en el `\n  };\n` de cierre (`sea-anim.ts:160`), y el cuerpo, a cuatro espacios, no lo contiene. Si el formato cambia, el test falla en rojo. No pasa en verde en silencio.
5. **Red de comportamiento.** La dirección se compara como vector unitario y no con `atan2`, para evitar el salto ±π en a = π (t = BEAM_PERIOD_MS/2).

## Grilling

- Rondas: 1. Preguntas: 14 (griller: fable).
- Fuentes: CODE 11 (`sea-anim.ts:47,156-160,178`, `sea-animator.ts:9,28`, `sea-anim.test.ts:3,39`, `iso/geometry.ts:2`, `iso/accent.ts:8`, `package.json`, `git log`), ISSUE 2 (criterios del Agent Brief), DOC 0, NO SOURCE 4 → supuestos técnicos 1-3 y 5. Ambigüedades de spec: 0. Fuera de alcance: 0.
- Cambios al plan: el test de rotación usa vectores unitarios (pregunta 3), el regex de `beam` acepta cualquier nombre (7), se aclaró que los Steps 1-2 corren en la etapa 3 (1, 14), se corrigieron los números de línea (13) y se quitó `Vec3`/`as` del test (9, 10).
- Issues abiertos: ninguno.
