# Nota de desvío sobre `ROUTE` y las velocidades por barco en dos specs viejas (#69): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que las dos specs de diseño del 2026-09-14 avisen, junto a cada mención de la polilínea `ROUTE` y de las velocidades por barco 1.2 / 2 / 0.8, que eso fue reemplazado por los carriles de #87 y la velocidad única de #63, sin reescribir el texto original.

**Architecture:** cambio solo de documentación. Cada viñeta afectada recibe, al principio, una nota corta en cursiva; el resto de la viñeta queda igual, como registro. Un test en `src/lab/docs.test.ts` (que ya lee `README.md` con `readFileSync` para la documentación de la flota) parte cada spec en viñetas y exige que toda viñeta que nombre `` `ROUTE` `` o `1.2 / 2 / 0.8` empiece con la nota y que el número de esas viñetas no cambie.

**Tech Stack:** Markdown y Vitest (`readFileSync` sobre los `.md`).

**Spec:** issue #69 y su Agent Brief (comentario de triage). Fuera de alcance: reescribir las specs.

## Global Constraints

- Archivos que cambian: `docs/superpowers/specs/2026-09-14-mundo-isometrico-design.md`, `docs/superpowers/specs/2026-09-14-mundo-2-fabrica-distrito-blog-design.md`, `src/lab/docs.test.ts`.
- `docs/superpowers/plans/` no se toca (criterio 2 del brief).
- El texto original de cada viñeta queda entero; solo se antepone la nota.
- Texto de la nota, idéntico en las cuatro viñetas (puede cortarse en varias líneas a ~78 columnas como el resto de la spec):

  ```
  *Desvío: reemplazado por los carriles semirrectos de #87 (`LANE_OUT` /
  `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63, con fases 0,
  1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  ```

- Tests, comentarios y mensajes en castellano. Commits `test(#69): …` y `docs(#69): …`.

## Decisiones técnicas (declaradas)

1. **Una nota por viñeta, al principio de la viñeta.** El brief pide la nota "al principio" de cada sección afectada y "junto a cada mención". Las menciones son cuatro viñetas: isométrica `:193-197` (**Rutas**, con las velocidades en `:197`), fábrica `:86` ("Ruta de barcos ejecutada (`ROUTE` …)", en "Desvíos de la implementación"), fábrica `:438` (**Ruta**) y fábrica `:443` (**Marcha**). **Ruta** y **Marcha** son vecinas, pero cada una lleva su nota, porque el criterio dice "cada mención".
2. **Dónde va la nota dentro de la viñeta.** En las viñetas con título en negrita va después del título (`- **Rutas.** *Desvío: …* Nacen en …`). En la de `:86`, que no tiene título, va al principio del texto (`- *Desvío: …* Ruta de barcos ejecutada …`).
3. **La nota nombra dos documentos.** El brief dice "ver el documento de referencia de barcos" (`2026-10-16-barcos-referencia.md`, que registra en "Desvíos respecto del plan de #57" el cambio de API de #63). Los carriles de #87 están descritos en `2026-10-17-barcos-inventario.md` (estado "después", `LANE_OUT`/`LANE_BACK`, ida a 1,2 u/s). Se nombran los dos para que el lector encuentre la ruta vigente.
4. **El test no lee `docs/superpowers/plans/`.** El criterio "los planes históricos no se tocan" es sobre el diff, no sobre el contenido. Se verifica con `git diff --name-only origin/main -- docs/superpowers/plans`, que debe salir vacío (script en `.scratch/evals-69.md` y en la descripción del PR).
5. **Conteo exacto de viñetas.** El test exige 1 viñeta afectada en la isométrica y 3 en la de fábrica. Si alguien reescribe una viñeta y borra la mención, el conteo cambia y el test avisa: el texto original queda como registro.

## Review Focus

1. Una mención cortada entre dos líneas (`1.2 / 2 /` al final de una línea y `0.8` en la siguiente) se le escaparía al regex. Hoy las tres apariciones están en una sola línea; el conteo exacto de la Task 1 lo fija.
2. `FERRY_ROUTE` no es `ROUTE`: el regex exige la comilla invertida antes de `ROUTE`, así `` `FERRY_ROUTE` `` no cuenta. Ninguna de las dos specs lo nombra hoy.
3. La nota no puede contener `1.2 / 2 / 0.8` ni `` `ROUTE` ``, o se contaría a sí misma. El texto fijado arriba no los contiene.
4. Que la nota preceda a la mención dentro de la viñeta, no que la siga: el test compara posiciones.
5. Que no se toque ningún archivo de `docs/superpowers/plans/`: lo cubre el `git diff` de la decisión 4.

---

### Task 1: Test de las notas y nota en la spec isométrica

**Files:**
- Modify: `src/lab/docs.test.ts` (nuevo `describe` al final)
- Modify: `docs/superpowers/specs/2026-09-14-mundo-isometrico-design.md:193`

**Interfaces:**
- Consumes: la constante `ROOT` ya definida en `src/lab/docs.test.ts:4`.
- Produces: el `describe("specs viejas de los barcos (#69)")`, que la Task 2 hace pasar para la spec de fábrica.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `src/lab/docs.test.ts`:

```ts
describe("specs viejas de los barcos (#69)", () => {
  // `ROUTE` con comilla delante, para no contar `FERRY_ROUTE`
  const OLD = /`ROUTE`|1\.2 \/ 2 \/ 0\.8/;
  const NOTE = /\*Desvío: reemplazado por los carriles semirrectos de #87[\s\S]*?#63[\s\S]*?2026-10-16-barcos-referencia\.md[\s\S]*?Lo que sigue queda como registro\.\*/;
  const specs = { "2026-09-14-mundo-isometrico-design.md": 1, "2026-09-14-mundo-2-fabrica-distrito-blog-design.md": 3 };
  for (const [name, count] of Object.entries(specs)) {
    const spec = readFileSync(`${ROOT}docs/superpowers/specs/${name}`, "utf8");
    const items = spec.split(/\n(?=- |\s*\n)/).filter((item) => OLD.test(item));
    it(`${name}: cada viñeta con ROUTE o las velocidades por barco empieza con la nota de desvío`, () => {
      expect(items).toHaveLength(count);
      for (const item of items) {
        expect(item).toMatch(NOTE);
        expect(item.search(NOTE)).toBeLessThan(item.search(OLD));
      }
    });
  }
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: FAIL en los dos `it` nuevos (`expected … to match /\*Desvío: …/`).

- [ ] **Step 3: Agregar la nota a la spec isométrica**

En `docs/superpowers/specs/2026-09-14-mundo-isometrico-design.md`, la viñeta **Rutas** (línea 193) pasa de:

```
- **Rutas.** Nacen en la desembocadura (`MOUTH`, esquina NE del astillero),
```

a:

```
- **Rutas.** *Desvío: reemplazado por los carriles semirrectos de #87
  (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63,
  con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Nacen en la desembocadura (`MOUTH`, esquina NE del astillero),
```

El resto de la viñeta (líneas 194-203) no cambia.

- [ ] **Step 4: Correr el test**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: PASS el `it` de la spec isométrica; sigue FAIL el de la spec de fábrica (lo arregla la Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lab/docs.test.ts docs/superpowers/specs/2026-09-14-mundo-isometrico-design.md
git commit -m "docs(#69): nota de desvío sobre las rutas en la spec isométrica"
```

### Task 2: Notas en la spec de fábrica, distrito y blog

**Files:**
- Modify: `docs/superpowers/specs/2026-09-14-mundo-2-fabrica-distrito-blog-design.md:86`, `:438`, `:443`

**Interfaces:**
- Consumes: el `describe("specs viejas de los barcos (#69)")` de la Task 1.
- Produces: nada.

- [ ] **Step 1: Correr el test y verlo fallar**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: FAIL `2026-09-14-mundo-2-fabrica-distrito-blog-design.md: cada viñeta …`.

- [ ] **Step 2: Nota en la viñeta de desvíos (línea 86)**

De:

```
- Ruta de barcos ejecutada (`ROUTE` en `src/scenes/sea-anim.ts`):
```

a:

```
- *Desvío: reemplazado por los carriles semirrectos de #87 (`LANE_OUT` /
  `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63, con fases 0,
  1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Ruta de barcos ejecutada (`ROUTE` en `src/scenes/sea-anim.ts`):
```

- [ ] **Step 3: Nota en **Ruta** (línea 438)**

De:

```
- **Ruta.** Una sola polilínea `ROUTE`: (290, -6) → (380, 56) → (432, 118)
```

a:

```
- **Ruta.** *Desvío: reemplazado por los carriles semirrectos de #87
  (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63,
  con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Una sola polilínea `ROUTE`: (290, -6) → (380, 56) → (432, 118)
```

- [ ] **Step 4: Nota en **Marcha** (línea 443, que ahora queda unas líneas más abajo)**

De:

```
- **Marcha.** Velocidades 1.2 / 2 / 0.8 u/s, fases 0 / 0.4 / 0.75 del ciclo.
```

a:

```
- **Marcha.** *Desvío: reemplazado por los carriles semirrectos de #87
  (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63,
  con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y
  `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*
  Velocidades 1.2 / 2 / 0.8 u/s, fases 0 / 0.4 / 0.75 del ciclo.
```

- [ ] **Step 5: Correr la suite y verificar los planes históricos**

Run: `npm test && npm run typecheck && git diff --name-only origin/main -- docs/superpowers/plans`
Expected: todo en verde y el `git diff` sin salida.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-14-mundo-2-fabrica-distrito-blog-design.md
git commit -m "docs(#69): notas de desvío sobre ROUTE y las velocidades en la spec de fábrica"
```
