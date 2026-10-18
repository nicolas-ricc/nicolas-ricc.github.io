# El pad de las piezas cubre su sombra (#118): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el pad de los exhibits de pieza del storybook cubra la huella de los sólidos más la sombra que proyectan, para que la sombra de la grúa torre (y de las demás piezas) no caiga al cielo vacío.

**Architecture:** `pieceScene` (`src/lab/crop.ts`) arma hoy un pad cuadrado de semilado `r + PAD_M` centrado en el origen. Pasa a ser un rectángulo: el mismo cuadrado `±r`, ampliado con los vértices de `shadowPolygon` (`src/iso/light.ts`) de cada sólido, y después con `PAD_M` por lado. La sombra sale del mismo proyector que usa `buildRenderList` para dibujarla, así que la dirección (`SHADOW_DIR`), el factor (`SHADOW_PER_UNIT`) y el tope de altura (`SHADOW_MAX_H`) son los del motor, sin una constante nueva.

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (solo para la captura).

**Spec:** issue #118 y su Agent Brief (comentario de triage).

## Global Constraints

- "El pad cubre la huella de los sólidos más la sombra proyectada de la pieza más alta."
- "El margen de sombra se calcula con la misma dirección y factor que usa el motor para dibujar sombras, no con una constante nueva."
- "El pad puede quedar descentrado respecto de la pieza si hace falta."
- "Un test en el test del módulo de recorte comprueba que la sombra proyectada de cada pieza del catálogo queda dentro del pad." El test va en `src/lab/crop.test.ts`.
- "En el exhibit `grua-torre` la sombra entera cae sobre el pad. Captura en la carpeta de assets de la spec del storybook." La carpeta es `docs/superpowers/specs/assets/97-storybook/`.
- Fuera de alcance: "Exhibits de región (usan el recorte del mundo, no un pad)."
- `npm test` y `npm run typecheck` en verde. Textos y nombres de test en castellano. Commits `test(#118): …`, `fix(#118): …`, `docs(#118): …`.

## Datos

- `SHADOW_DIR = (0.894, −0.447)`: la sombra cae hacia x+ e y−. `SHADOW_PER_UNIT = Z_SCALE / tan 25° ≈ 3.002` unidades por unidad de altura, con la altura recortada a `SHADOW_MAX_H = 18`.
- `shadowPolygon(s)` devuelve el casco convexo de los vértices proyectados a z = 0, o `null` si el sólido es plano o está entero bajo z 0. Los vértices bajo el suelo se quedan donde están. El núcleo (`maxH = SHADOW_CORE_H`) queda dentro del casco completo, así que alcanza con cubrir el completo.
- Medición actual (pad contra caja de la sombra completa, en x/y):

  | pieza | pad | sombra x | sombra y |
  |---|---|---|---|
  | grua-torre | ±19 | −8.6 … 64.3 | −25.2 … 0.6 |
  | farol | ±3.3 | −0.3 … 13.7 | −7.0 … 0.3 |
  | campus | ±15.5 | −10.5 … 33.9 | −19.2 … 7.5 |
  | selva | ±19 | −15.5 … 32.5 | −21.1 … 16 |
  | carguero | ±33 | −26.9 … 51.9 | −20.2 … 3.8 |
  | remolcador | ±12.5 | −8.6 … 28.4 | −13.4 … 3.2 |
  | convoy | ±33 | −29.0 … 30.7 | −11.1 … 4.0 |
  | lancha | ±10.5 | −6.8 … 15.1 | −5.0 … 2.3 |

  Siete de las ocho piezas sacan sombra del pad por el este. Solo `convoy` queda adentro.
- El storybook encuadra una pieza con `solidsBox([...piece.ground, ...piece.solids])` (`src/lab/storybook.ts:96`): el pad entra en la caja, así que un pad más grande agranda el cuadro solo, sin tocar `storybook.ts`.

## Decisiones técnicas (declaradas)

1. **Rectángulo, no cuadrado.** El pad es la caja de unión entre el cuadrado `±r` de hoy y los vértices de las sombras, más `PAD_M` por lado. El lado oeste, el norte y el sur no cambian para una pieza cuya sombra no los cruza. El lado este (y el norte de la grúa) se estira hasta la sombra. Así queda descentrado, como permite el brief, y una pieza sin sombra, o con una sombra que no sale del cuadrado, conserva el pad de antes.
2. **Las sombras se miden a z 0.** El motor dibuja la sombra en z 0, también sobre el pad de agua de los barcos (cara de arriba en z −1). La comparación es en coordenadas de mundo x/y, la misma que hace el brief. El corrimiento en pantalla del agua a z −1 (1.4 u hacia abajo) queda dentro de `PAD_M`.
3. **Mismo `PAD_M` para la sombra.** El brief dice que la sombra entera tiene que caer sobre el pad. El margen de 3 u que ya rodeaba la pieza rodea ahora también la sombra, para que la banda suave no toque el borde. No hay constante nueva.
4. **Captura nueva, la vieja queda.** Se agrega `docs/superpowers/specs/assets/97-storybook/grua-torre-sombra.png`, tomada con `?bloom=off` como las de cierre de #97. `grua-torre.png` se queda como evidencia del corte que cita el issue, igual que `faro.png` en #116. La spec del storybook suma una nota en su lista de capturas.

## Review Focus

1. Pieza sin sombra (todos sus sólidos planos): el pad tiene que seguir siendo el cuadrado `±(r + PAD_M)` centrado. Lo fija un test de la Tarea 1.
2. Pieza más alta que `SHADOW_MAX_H` (el mástil de la grúa es de 20): el pad tiene que seguir la sombra recortada que dibuja el motor, no una sombra sin tope. Lo fija el test ajustado de la Tarea 1: el borde este es exactamente `max(sombra.x) + PAD_M`.
3. Barco a z −1 sobre agua: el casco asoma sobre z 0 y proyecta algo de sombra. El pad sigue con la cara de arriba en z −1 y la cubre. Lo cubren el test del barco y el del catálogo (cuatro barcos).
4. Encuadre: el cuadro del storybook tiene que mostrar el pad entero, también cuando quede descentrado. Lo cubre `solidsBox` sobre `piece.ground`, y se verifica en la captura de la Tarea 2.
5. Exhibits de región: no cambian (fuera de alcance). Ninguna tarea toca `cropScene` ni las cajas de región.

---

### Task 1: el pad cubre la sombra proyectada

**Files:**
- Modify: `src/lab/crop.ts` (`pieceScene` y su comentario, import de `shadowPolygon`)
- Test: `src/lab/crop.test.ts` (bloque `describe("pieceScene", …)`)

**Interfaces:**
- Consumes: `shadowPolygon(s: Solid, maxH?: number): Vec2[] | null` de `src/iso/light.ts`; `EXHIBITS` de `src/lab/exhibits.ts`.
- Produces: `pieceScene` con la misma firma. `ground[0]` es un rectángulo, ya no necesariamente cuadrado ni centrado.

- [ ] **Step 1: tests que fallan.** En `src/lab/crop.test.ts`, agregar a los imports `shadowPolygon` (`../iso/light`) y `EXHIBITS` (`./exhibits`). Reemplazar el test `"los sólidos y acentos de build, y un pad de paving de 1 u centrado en el origen"` y agregar dos tests:

```ts
  it("los sólidos y acentos de build, y un pad de paving de 1 u que cubre la pieza y su sombra", () => {
    expect(scene.solids).toEqual([prism(-1, -1), prism(6, 0)]);
    expect(scene.accents).toEqual([lamp]);
    expect(scene.ground).toHaveLength(1);
    // malla plana: se pinta en la capa de suelo, debajo de sombras y sólidos
    expect(scene.ground[0]).toMatchObject({ kind: "ground", mat: "paving" });
    const { min, max } = bounds(scene.ground[0]!);
    // la pieza llega a ±8: oeste, norte y sur como antes, ±(8 + 3)
    expect(min.x).toBeCloseTo(-11);
    expect(min.y).toBeCloseTo(-11);
    expect(max.y).toBeCloseTo(11);
    // la sombra cae al este: el pad llega hasta su punta más el margen
    const tip = Math.max(...scene.solids.flatMap((s) => (shadowPolygon(s) ?? []).map((p) => p.x)));
    expect(tip).toBeGreaterThan(8);
    expect(max.x).toBeCloseTo(tip + 3);
    expect(max.z).toBe(0); // cara de arriba al nivel de las piezas de tierra
    expect(max.z - min.z).toBe(1);
  });
  it("una pieza sin sombra conserva el pad cuadrado centrado", () => {
    const flat: Solid = { kind: "ground", mat: "concrete", tris: [{ pts: [v3(-2, -2, 0), v3(4, -2, 0), v3(-2, 4, 0)] }] };
    const { min, max } = bounds(pieceScene((out) => { out.push(flat); }).ground[0]!);
    expect([min.x, min.y, max.x, max.y]).toEqual([-7, -7, 7, 7]);
  });
  it("la sombra de cada pieza del catálogo cae sobre el pad", () => {
    const out: string[] = [];
    for (const e of EXHIBITS) {
      if (e.kind !== "piece") continue;
      const s = pieceScene(e.build, e.pad);
      const { min, max } = bounds(s.ground[0]!);
      for (const so of s.solids) for (const p of shadowPolygon(so) ?? []) {
        if (p.x < min.x || p.x > max.x || p.y < min.y || p.y > max.y) out.push(`${e.id} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
      }
    }
    expect([...new Set(out.map((o) => o.split(" ")[0]))]).toEqual([]);
  });
```

- [ ] **Step 2: correrlos y verlos fallar.** `npx vitest run src/lab/crop.test.ts`. Se espera: falla el test del pad (`max.x` es 11, no `tip + 3`) y el del catálogo (lista `grua-torre`, `farol`, `campus`, `selva`, `carguero`, `remolcador`, `lancha`). El de la pieza sin sombra ya pasa: fija el comportamiento que no tiene que cambiar.

- [ ] **Step 3: implementación mínima.** En `src/lab/crop.ts`, importar `shadowPolygon` de `../iso/light` y reescribir el cuerpo de `pieceScene` desde el cálculo de `r`:

```ts
  let r = 0, floor = Infinity;
  for (const s of solids) {
    const { min, max } = bounds(s);
    r = Math.max(r, -min.x, max.x, -min.y, max.y);
    floor = Math.min(floor, min.z);
  }
  // la sombra cae al ENE y llega a ~3 veces la altura: el pad la cubre entera, aunque quede descentrado
  let x0 = -r, y0 = -r, x1 = r, y1 = r;
  for (const s of solids) for (const p of shadowPolygon(s) ?? []) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  x0 -= PAD_M; y0 -= PAD_M; x1 += PAD_M; y1 += PAD_M;
  const top = Math.floor(floor);
  // tapa y las dos caras que ve la cámara (este, sur), con la normal hacia afuera
  const nw = v3(x0, y0, top), ne = v3(x1, y0, top), se = v3(x1, y1, top), sw = v3(x0, y1, top);
  const neB = v3(x1, y0, top - 1), seB = v3(x1, y1, top - 1), swB = v3(x0, y1, top - 1);
```

  El resto de la función no cambia. El comentario de la función pasa a decir: "sobre un pad de 1 u de espesor que la cubre con margen, ella y la sombra que proyecta (con el proyector del motor: el pad queda descentrado hacia donde cae la sombra)". Se borra "cuadrado … centrado en el origen".

- [ ] **Step 4: verlos pasar.** `npx vitest run src/lab/crop.test.ts`, después `npm test` y `npm run typecheck`. Todo en verde. `exhibits.test.ts` y `storybook.test.ts` no deberían cambiar: no miden el pad.

- [ ] **Step 5: commit.** `git add src/lab/crop.ts src/lab/crop.test.ts && git commit -m "fix(#118): piece pad covers the projected shadow"`

### Task 2: captura de la grúa torre y nota en la spec

**Files:**
- Create: `docs/superpowers/specs/assets/97-storybook/grua-torre-sombra.png`
- Modify: `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` (lista de notas, junto a la línea de `faro-haz.png`)

**Interfaces:**
- Consumes: `pieceScene` de la Tarea 1.
- Produces: nada que use código.

- [ ] **Step 1: levantar el dev server.** `npm run dev -- --host --port 5173`.
- [ ] **Step 2: capturar.** Con agent-browser (viewport 1600 900 2, ver `CLAUDE.md`), abrir `http://localhost:5173/lab/storybook.html?bloom=off#grua-torre`, esperar el primer dibujo y comprobar con `__PIXI_DEVTOOLS_WRAPPER__` que el stage está activo. Capturar a `docs/superpowers/specs/assets/97-storybook/grua-torre-sombra.png`. Mirar la captura: la banda de sombra de la pluma y la contrapluma termina sobre el pad, con margen, y el pad entra entero en el cuadro.
- [ ] **Step 3: nota en la spec.** Agregar, después de la línea de `faro-haz.png`:

```md
- La captura `grua-torre` de #97 muestra la sombra de la pluma saliendo del pad. Desde #118 el pad de las piezas cubre también la sombra proyectada, medida con `shadowPolygon`, el mismo proyector que la dibuja: queda descentrado hacia el ENE. `grua-torre-sombra.png` lo muestra, con `?bloom=off`.
```

- [ ] **Step 4: commit.** `git add docs/superpowers/specs && git commit -m "docs(#118): grua-torre capture with the shadow on the pad"`
