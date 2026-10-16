# Convoy fluvial (#62) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `barge` en `src/scenes/ships.ts` como un empujador fluvial de tres cubiertas (20 × 7 u) pegado a la popa de una barcaza tolva Jumbo Mississippi (40 × 8 u) con tapas abovedadas, de modo que se reconozca como convoy en `/lab/blog.html`.

**Architecture:** Todo vive en el constructor `barge(k, spec, solids, lights)` y en `sternOf()` de `ships.ts`. El kit no cambia: todas las piezas son `hull`, `box`, `cyl`, `dot` y `poly`, con las coordenadas y materiales de la lista de piezas de la sección `barge` del documento de referencia, recortada al presupuesto (ver "Desvíos"). `shipAt()` y `wake()` ya derivan su popa de `sternOf()`, así que solo cambia la constante −10 → −20.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc --noEmit` (`npm run typecheck`), Vite (`npm run build`, lab en `npm run dev -- --host --port 5173`), `agent-browser` para capturas.

**Spec:** issue #62 (hijo de #57) y `docs/superpowers/specs/2026-10-16-barcos-referencia.md`, sección `` `barge` `` (traducción a escala y piezas 1–46) y "Decisiones".

## Global Constraints

- Rama base `feature/57-barcos-reales-rutas`. Se conserva el id `ShipKind` `"barge"`; el docstring de `ships.ts` dice qué modelo reproduce.
- Caja: eslora total ≤ 60 u (barcaza x 0..40 + empujador x −20..0), manga ≤ 10 u, ningún sólido por encima de z = 13. Agua en z −1; `deck = WATER_Z + spec.h`.
- Presupuesto: ≤ 40 sólidos y ≤ 8 luces por barco (el casco cuenta como sólido; los `poly` de acento cuentan como luces). El test pasa de ≤ 30 / ≤ 6 a ≤ 40 / ≤ 8.
- Materiales: solo `Material` existentes y dentro de `SHIP_MATS` (`hull`, `hullBlue`, `whitewash`, `steel`, `rust`, `deck`, `glass`). No se agregan colores a la paleta.
- Luces de navegación: tope `magentaMid`, babor `magenta`, estribor `cyanMid`, en ese orden al principio de `lights`; ventanas encendidas como `poly` `magentaBleed`.
- `wake()` sigue devolviendo 17 triángulos; la V y el remolino arrancan en `stern = −20`.
- `[lab] peor redibujo en 5 s` ≤ 15 ms con los tres barcos a la vista, pegado en el PR.
- Capturas `docs/superpowers/specs/assets/57-barcos/barge-antes.png` (antes de tocar código) y `barge-despues.png`.

## Decisiones técnicas declaradas

1. **`SHIP_SPECS.barge = { len: 40, beam: 8, h: 1.2, sheer: 0, topMat: "rust" }`**. El issue dice "`h` ~2"; el documento de referencia (que el issue manda leer primero) fija `h` 1.2 y deriva de ahí todas las cotas z (cubierta 0.2, brazola 0.25–1.15, tapas hasta 1.85). Se toma 1.2.
2. **Tapas: 4 secciones** (el issue pide 3–4; el documento sugiere 5). Paso 7.7 u, base 7.5 × 7.2 u (z 1.15–1.55) y cresta 6.8 × 4.4 u (z 1.55–1.85): dos escalones = bóveda baja, porque `prism` no está en el kit y extenderlo no es necesario.
3. **Brazola perimetral**: las dos bandas del documento (piezas 17–18) más dos testeros (x 3–3.4 y x 33.8–34.2), porque el issue pide "brazola perimetral".
4. **Bitas en las cuatro esquinas de la barcaza** (x 1.5 y 35.5, y ±2.8) en lugar de las dos de amarre del documento; se omiten los cabos de amarre, las bitas del empujador y los barriles (piezas 31–38 de menor prioridad) para quedar en presupuesto.
5. **Barandas**: dos cajas de acero de 9 × 0.1 × 0.4 u en los bordes del techo del nivel 1 (x −17.4..−8.4, y −2.6..−2.5 y 2.5..2.6), a popa de las chimeneas. El documento no las listaba; el issue sí.
6. **Bote**: el skiff del documento sobre el techo del nivel 1, que es la cubierta superior abierta del empujador.
7. **Excepción del test de caja**: en `barge`, las piezas que cuadran los cascos (bloques de popa/proa, escalones del rake, placas laterales y bloque de proa del empujador) bajan del nivel de cubierta. El test las exime si su tope es ≤ 0.66 (cubierta del empujador 0.6 + 0.05 del bloque + tolerancia), la pista del documento ("ampliar esa excepción en el hijo que las construya").
8. Total: **38 sólidos** (23 barcaza + 15 empujador) y **6 luces**.

## Review Focus

1. Rumbos no nulos: la unidad debe quedar centrada en el carril para cualquier `heading` → el test existente de `shipAt` recorre cuatro rumbos sobre los dos cascos; se ajusta la constante esperada a `{ x: -10, y: 0 }`.
2. Orden de dibujo del bloque de popa de la barcaza contra la popa redondeada del casco (pista del documento) → no se puede testear sin render; se verifica en el lab con la captura "después" en los rumbos de ida y de vuelta.
3. Barco que se cruza con otro en el carril: la caja de 60 × 10 u es la que validaron las rutas → test: extremos en x de la unidad exactamente −20 y 40, |y| ≤ 4.
4. Piezas que asomen por encima de la caja (mástil, luces) → test: `max z ≤ 13` para los cuatro tipos.
5. Presupuesto de dibujo con los tres barcos → medición `[lab] peor redibujo en 5 s` en el lab (no unitaria).

## Criterios de aceptación → tareas

| Criterio de #62 | Dónde se cumple |
| --- | --- |
| En `/lab/blog.html` se reconoce un convoy fluvial (barcaza tolva con tapas abovedadas adelante, empujador de tres cubiertas atrás); capturas antes/después en el PR | Tasks 1–3 (geometría) + paso "Captura antes" (etapa de evals) + "Verificación en el lab" (captura después); el reconocimiento a ojo es verificación manual en el PR |
| `ships.test.ts` actualizado: barcaza sin contenedores con tapas abovedadas, empujador de 20 u con torre de tres niveles y dos pechos; estela de 17 triángulos detrás del empujador; ≤ 40 sólidos, ≤ 8 luces; caja (eslora total 60) y materiales | Task 1 (caja, estela, presupuesto, sin contenedores), Task 2 (tapas), Task 3 (torre, pechos, luces) |
| `[lab] peor redibujo en 5 s` ≤ 15 ms, pegado en el PR | "Verificación en el lab"; línea base medida junto con la captura "antes" |

## Assumptions

- `h` 1.2 en vez del "~2" del issue: el issue manda leer primero el documento de referencia, que fija 1.2 y deriva de ahí todas las cotas. Ningún criterio de aceptación depende de `h`. Alternativa descartada: h 2 (obliga a recalcular todas las cotas del documento sin ganancia de silueta).
- Excepción del test de caja por umbral de altura (`max.z ≤ 0.66`) y no por lista de piezas: el test no tiene identidad de pieza; un umbral en la cubierta del empujador captura exactamente las piezas que rellenan casco. Alternativa descartada: marcar las piezas con un campo extra en `Solid` (cambia un tipo compartido por todo el mapa).
- La casilla del nivel 1 apoya en z 0.65 (documento: "z 0.65 a 2.2"), 0.05 sobre la cubierta del casco (0.6), igual que los bloques de la barcaza; evita caras coplanares. El hueco no se ve en el iso a esa escala (1 px ≈ 1 u).
- Si en el lab la popa redonda del casco de la barcaza pinta sobre el bloque de popa, se resuelve en la etapa 4 (subir el tope del bloque o reordenar `push`), con 2 sólidos de margen (38/40).
- Si el peor redibujo supera 15 ms, se recortan primero radar, bote y barandas (piezas de menor prioridad del documento), sin tocar silueta (pechos, torre, chimeneas, tapas).
- Commits intermedios con tests en rojo: el pipeline commitea los evals antes de implementar; el PR se mergea con squash solo con CI verde (`.github/workflows/deploy.yml` corre typecheck, test y build en cada PR).

### Captura "antes" (etapa de evals, antes de tocar `ships.ts`)

- `npm run dev -- --host --port 5173`; `agent-browser` a `http://localhost:5173/lab/blog.html?speed=10`, tecla `3`, esperar al convoy (`barge` es el barco 2, fase 2/3) y capturar `docs/superpowers/specs/assets/57-barcos/barge-antes.png`. Anotar el `[lab] peor redibujo en 5 s` de línea base. Se commitea con los evals (`test(#62): evals`). Convención de carpeta como `assets/58-faro/`.

---

### Task 1: Unidad del convoy (casco de barcaza, empujador, popa en −20, cuadrado de cascos)

**Files:**
- Modify: `src/scenes/ships.ts` (`SHIP_SPECS.barge`, `barge()`, `sternOf()`, docstrings de `sternOf`)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: `Kit` (`hull`, `box`), `SHIP_SPECS`.
- Produces: `sternOf("barge") === -20`; `shipAt("barge", {x:0,y:0}, 0)` → `{ x: -10, y: 0 }`; `ship("barge", at, h)` con dos `hull` (barcaza en `at`, empujador a dx −20). Tasks 2 y 3 agregan piezas dentro de `barge()` usando `const deck = WATER_Z + spec.h` (0.2) y `const pDeck = WATER_Z + 1.6` (0.6).

- [ ] **Step 1: Tests (escritos en la etapa de evals)**

En `ships.test.ts`, en el test de caja:

```ts
      expect(s.solids.length).toBeLessThanOrEqual(40); expect(s.lights.length).toBeLessThanOrEqual(8);
      expect(Math.max(...s.solids.map((x) => bounds(x).max.z))).toBeLessThanOrEqual(13);
      const x0 = kind === "barge" ? 100 - 20 : 100; // el empujador va detrás de la barcaza
      ...
        // las defensas cuelgan del costado; en barge, los bloques que cuadran los cascos (tope ≤ cubierta del empujador) bajan al agua
        const filler = kind === "barge" && b.max.z <= 0.66;
        if (x.kind !== "hull" && !filler && !(x.kind === "cylinder" && x.r === 0.45)) expect(b.min.z).toBeGreaterThanOrEqual(-1 + spec.h - 0.01);
```

`expect(shipAt("barge", { x: 0, y: 0 }, 0)).toEqual({ x: -10, y: 0 });`

Nuevo bloque:

```ts
describe("barge: empujador de tres cubiertas con barcaza tolva Jumbo", () => {
  const s = ship("barge", { x: 0, y: 0 }, 0), b = s.solids.map(bounds);
  const near = (a: number, c: number) => Math.abs(a - c) < 1e-6;
  it("unidad de 60 × 8 u: barcaza 40 × 8 (h 1.2, sin arrufo) y empujador de 20 × 7 a dx −20, sin contenedores", () => {
    expect(SHIP_SPECS.barge).toEqual({ len: 40, beam: 8, h: 1.2, sheer: 0, topMat: "rust" });
    const hulls = s.solids.filter((x) => x.kind === "hull");
    expect(hulls).toHaveLength(2);
    expect(hulls[1]).toMatchObject({ at: { x: -20, y: 0, z: -1 }, len: 20, beam: 7, h: 1.6, sheer: 0 });
    expect(Math.min(...b.map((x) => x.min.x))).toBeCloseTo(-20, 6); expect(Math.max(...b.map((x) => x.max.x))).toBeCloseTo(40, 6);
    expect(Math.max(...b.map((x) => Math.max(-x.min.y, x.max.y)))).toBeLessThanOrEqual(4 + 1e-9);
    expect(s.solids.some((x, i) => x.kind === "poly" && b[i]!.min.x >= 0 && x.h >= 2)).toBe(false); // sin contenedores sobre la barcaza
  });
  it("proa de la barcaza cuadrada hasta el cabezal (rake) y proa del empujador cuadrada", () => {
    expect(b.some((x) => x.max.x > 40 - 1e-6 && Math.abs(x.max.z - 0.25) < 1e-6 && x.max.y - x.min.y > 7.9)).toBe(true);
    expect(b.some((x) => Math.abs(x.max.x) < 1e-6 && x.min.x < -5 && Math.abs(x.max.z - 0.65) < 1e-6 && x.max.y - x.min.y > 6.9)).toBe(true);
  });
});
```

Y en el test de estela:

```ts
  it("barge: la V y el remolino arrancan detrás del empujador (popa en −20)", () => {
    const w = wake("barge", { x: 0, y: 0 }, 0);
    for (const t of w.slice(-3)) { expect(t.pts[0]!.x).toBeCloseTo(-20, 6); expect(t.pts[0]!.y).toBeCloseTo(0, 6); }
    expect(Math.min(...w.flatMap((t) => t.pts.map((p) => p.x)))).toBeCloseTo(-36, 6);
  });
```

Borrar del test "remolcador con defensas…" las dos líneas de `barge` (16 contenedores, dos cascos) y renombrarlo a "remolcador con defensas y timonera; lancha de dos cubiertas".

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/scenes/ships.test.ts`
Expected: FAIL en spec de barge, `shipAt` `{-15,0}`, estela en −10, casco del empujador a −10.

- [ ] **Step 3: Implementar**

```ts
  barge: { len: 40, beam: 8, h: 1.2, sheer: 0, topMat: "rust" },
```

```ts
function barge(k: Kit, spec: ShipSpec, solids: Solid[], lights: Accent[]): void {
  // barcaza: el anillo fijo del casco tiene popa redonda y proa en punta; cajas que lo cuadran, rake en dos escalones y placas que tapan la muesca de la flotación
  solids.push(k.box(0, -4, 7.2, 8, -0.9, 1.15, "rust"), k.box(22.8, -4, 13.6, 8, -0.9, 1.15, "rust"));
  solids.push(k.box(36.4, -4, 2, 8, -0.5, 0.75, "rust"), k.box(38.4, -4, 1.6, 8, -0.1, 0.35, "rust"));
  solids.push(k.box(0, -4, 36.4, 0.15, -0.9, 1.15, "rust"), k.box(0, 3.85, 36.4, 0.15, -0.9, 1.15, "rust"));
  // empujador pegado a la popa, con proa cuadrada
  solids.push(k.hull(-20, 20, 7, 1.6, 0, "hullBlue"), k.box(-5.5, -3.5, 5.5, 7, -0.9, 1.55, "hullBlue"));
}
```

(La variable `deck` de la barcaza y `pDeck` del empujador se introducen en Task 2/3 cuando se usen; Task 1 no deja variables sin uso.)

```ts
/** Popa de la unidad en coordenadas locales: el empujador va 20 u detrás de la barcaza. */
const sternOf = (kind: ShipKind): number => (kind === "barge" ? -20 : 0);
```

- [ ] **Step 4: Correr**

Run: `npx vitest run src/scenes/ships.test.ts src/scenes/sea-anim.test.ts src/scenes/sea-animator.test.ts`
Expected: pasan los tests de Task 1 (los de Task 2/3 siguen en rojo).

- [ ] **Step 5: Commit** `feat(#62): unidad del convoy, empujador de 20 u y popa en −20`

### Task 2: Barcaza tolva (brazola perimetral, cuatro tapas abovedadas, bitas en las esquinas)

**Files:**
- Modify: `src/scenes/ships.ts` (`barge()`)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: `barge()` de Task 1.
- Produces: piezas de barcaza con `min.x ≥ 0`; tope de la barcaza z 1.85 (Task 3 lo usa para exigir que los pechos suban por encima).

- [ ] **Step 1: Test (en el bloque `describe("barge: …")`)**

```ts
  it("barcaza: brazola perimetral, cuatro tapas abovedadas dentro de ella y bitas en las cuatro esquinas", () => {
    const coaming = s.solids.filter((x) => x.kind === "poly" && x.mat === "rust" && near(x.z, 0.25) && near(x.h, 0.9)).map(bounds);
    expect(coaming).toHaveLength(4);
    expect(Math.min(...coaming.map((x) => x.min.x))).toBeCloseTo(3, 6); expect(Math.max(...coaming.map((x) => x.max.x))).toBeCloseTo(34.2, 6);
    expect(Math.min(...coaming.map((x) => x.min.y))).toBeCloseTo(-3.6, 6); expect(Math.max(...coaming.map((x) => x.max.y))).toBeCloseTo(3.6, 6);
    const lids = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, 1.15)).map(bounds);
    const crests = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, 1.55)).map(bounds);
    expect(lids).toHaveLength(4); expect(crests).toHaveLength(4);
    for (const l of lids) { expect(l.min.x).toBeGreaterThanOrEqual(3); expect(l.max.x).toBeLessThanOrEqual(34.2); }
    for (const c of crests) {
      const l = lids.find((x) => x.min.x < c.min.x && x.max.x > c.max.x)!; // cada cresta sobre su base, más angosta: bóveda
      expect(l).toBeDefined(); expect(c.min.y).toBeGreaterThan(l.min.y); expect(c.max.y).toBeLessThan(l.max.y);
    }
    expect(Math.max(...b.filter((x) => x.min.x >= 0).map((x) => x.max.z))).toBeCloseTo(1.85, 6);
    const bitts = b.filter((x, i) => s.solids[i]!.kind === "cylinder" && x.min.x >= 0);
    expect(bitts).toHaveLength(4);
    const quad = new Set(bitts.map((x) => `${(x.min.x + x.max.x) / 2 > 20}${x.min.y + x.max.y > 0}`));
    expect(quad.size).toBe(4);
  });
```

- [ ] **Step 2: Correr y ver que falla** — `npx vitest run src/scenes/ships.test.ts -t "barcaza: brazola"` → FAIL (0 brazolas).

- [ ] **Step 3: Implementar** (al principio de `barge()`, después de las cajas que cuadran el casco)

```ts
  const deck = WATER_Z + spec.h, top = deck + 0.05; // tope de los bloques que cuadran el casco
  solids.push(k.box(3, -3.6, 31.2, 0.4, top, 0.9, "rust"), k.box(3, 3.2, 31.2, 0.4, top, 0.9, "rust")); // brazola: bandas
  solids.push(k.box(3, -3.2, 0.4, 6.4, top, 0.9, "rust"), k.box(33.8, -3.2, 0.4, 6.4, top, 0.9, "rust")); // y testeros
  for (let i = 0; i < 4; i++) solids.push(k.box(3.2 + i * 7.7, -3.6, 7.5, 7.2, top + 0.9, 0.4, "steel"), k.box(3.55 + i * 7.7, -2.2, 6.8, 4.4, top + 1.3, 0.3, "steel")); // tapas abovedadas en dos escalones
  for (const dx of [1.5, 35.5]) for (const dy of [-2.8, 2.8]) solids.push(k.cyl(dx, dy, top, 0.3, 0.5, "steel")); // bitas
```

Los tests comparan cotas con `near()` (tolerancia 1e-6), así que las sumas en coma flotante (`top + 0.9`) sirven.

- [ ] **Step 4: Correr** `npx vitest run src/scenes/ships.test.ts` → pasa el test de barcaza.
- [ ] **Step 5: Commit** `feat(#62): barcaza tolva con brazola, tapas abovedadas y bitas`

### Task 3: Empujador de tres cubiertas (pechos, torre, chimeneas, mástil, bote, barandas, luces) y docstring

**Files:**
- Modify: `src/scenes/ships.ts` (`barge()`, docstring del módulo)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: Task 1 (casco del empujador, `pDeck` 0.6, bloque de proa con tope 0.65), Task 2 (tope de barcaza 1.85).
- Produces: el `barge` completo: 38 sólidos, 6 luces.

- [ ] **Step 1: Test**

```ts
  it("empujador: dos pechos a proa por encima de la barcaza, torre de tres niveles escalonada con timonera vidriada, dos chimeneas a popa de la torre, mástil, bote y barandas", () => {
    const bargeTop = Math.max(...b.filter((x) => x.min.x >= 0).map((x) => x.max.z));
    const knees = s.solids.filter((x, i) => x.kind === "poly" && x.mat === "whitewash" && !x.facade && b[i]!.min.x >= -1.5 && b[i]!.max.x <= 0);
    expect(knees).toHaveLength(2);
    for (const kn of knees) expect(bounds(kn).max.z).toBeGreaterThan(bargeTop);
    const tower = s.solids.filter((x) => x.kind === "poly" && x.mat === "whitewash" && x.facade).sort((p, q) => (p.kind === "poly" && q.kind === "poly" ? p.z - q.z : 0));
    expect(tower).toHaveLength(3);
    const area = (x: (typeof tower)[number]) => { const t = bounds(x); return (t.max.x - t.min.x) * (t.max.y - t.min.y); };
    for (let i = 1; i < 3; i++) {
      const lo = tower[i - 1]!, hi = tower[i]!;
      if (lo.kind !== "poly" || hi.kind !== "poly") throw new Error("torre");
      expect(hi.z).toBeCloseTo(lo.z + lo.h, 6); expect(area(hi)).toBeLessThan(area(lo));
    }
    const wheel = tower[2]!;
    expect(wheel.kind === "poly" && wheel.facade?.base).toBe("glass");
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "whitewash").map(bounds);
    expect(stacks).toHaveLength(2);
    for (const st of stacks) expect(st.max.x).toBeLessThanOrEqual(bounds(tower[1]!).min.x + 1e-9);
    expect(stacks[0]!.min.y * stacks[1]!.min.y).toBeLessThan(0); // una por banda
    expect(Math.max(...b.map((x) => x.max.z))).toBeCloseTo(8.2, 6); // mástil sobre la timonera
    const roof1 = bounds(tower[0]!).max.z;
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && Math.abs(x.z - roof1) < 1e-6)).toHaveLength(3); // bote y dos barandas
    expect(s.solids.length).toBeLessThanOrEqual(40);
  });
  it("luces: tope, babor y estribor primero; dos proyectores ámbar y ventanas encendidas en la timonera; ≤ 8", () => {
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.filter((l) => l.color === "amber")).toHaveLength(2);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
    expect(s.lights.length).toBeLessThanOrEqual(8);
  });
```

- [ ] **Step 2: Correr y ver que falla** → FAIL (0 pechos).

- [ ] **Step 3: Implementar** (al final de `barge()`, después del casco y bloque de proa del empujador)

```ts
  const pDeck = WATER_Z + 1.6 + 0.05; // tope del bloque de proa del empujador
  solids.push(k.box(-1.2, -3, 1.2, 1.2, pDeck, 1.6, "whitewash"), k.box(-1.2, 1.8, 1.2, 1.2, pDeck, 1.6, "whitewash")); // pechos de empuje
  solids.push(k.box(-17.5, -2.6, 15.9, 5.2, pDeck, 1.55, "whitewash", { floors: 1, cols: 10 })); // nivel 1, la casilla larga
  solids.push(k.box(-6.2, -2.3, 4.6, 4.6, pDeck + 1.55, 1.55, "whitewash", { floors: 1, cols: 4 })); // nivel 2
  solids.push(k.box(-5.7, -2, 3.6, 4, pDeck + 3.1, 1.7, "whitewash", { floors: 1, cols: 4, base: "glass" }), k.box(-5.9, -2.2, 4, 4.4, pDeck + 4.8, 0.15, "steel")); // timonera y techo
  solids.push(k.cyl(-7.4, -1.3, pDeck + 1.55, 0.8, 1.5, "whitewash"), k.cyl(-7.4, 1.3, pDeck + 1.55, 0.8, 1.5, "whitewash")); // chimeneas gemelas
  solids.push(k.box(-3.9, -0.125, 0.25, 0.25, pDeck + 4.95, 2.6, "steel"), k.box(-5.4, -0.5, 0.8, 1, pDeck + 4.95, 0.5, "steel")); // mástil y radar
  solids.push(k.box(-14, 0.6, 4.2, 1.5, pDeck + 1.55, 0.5, "steel")); // bote
  solids.push(k.box(-17.4, -2.6, 9, 0.1, pDeck + 1.55, 0.4, "steel"), k.box(-17.4, 2.5, 9, 0.1, pDeck + 1.55, 0.4, "steel")); // barandas
  lights.push(k.dot(-3.775, 0, 8.3, 0.7, "magentaMid"), k.dot(-2.3, -2.15, 5, 0.4, "magenta"), k.dot(-2.3, 2.15, 5, 0.4, "cyanMid"));
  lights.push(k.dot(-2.3, -1.7, 5.85, 0.35, "amber"), k.dot(-2.3, 1.7, 5.85, 0.35, "amber")); // proyectores
  lights.push(k.poly([[-2.08, -1.6, 4.1], [-2.08, 1.6, 4.1], [-2.08, 1.6, 5.2], [-2.08, -1.6, 5.2]], "magentaBleed", 0.8)); // ventanas encendidas de la timonera
```

Cotas absolutas resultantes (deben coincidir con el documento): pechos 0.65–2.25; nivel 1 0.65–2.2; nivel 2 2.2–3.75; timonera 3.75–5.45; techo 5.45–5.6; chimeneas 2.2–3.7; mástil 5.6–8.2; bote y barandas desde 2.2. Si la suma flotante rompe una igualdad del test (`toBeCloseTo` tolera), usar literales.

Docstring del módulo: agregar una línea "`barge` reproduce un empujador fluvial de tres cubiertas (tipo *Steel Trader*) empujando una barcaza tolva Jumbo Mississippi; ver `docs/superpowers/specs/2026-10-16-barcos-referencia.md`."

- [ ] **Step 4: Correr** `npm test` y `npm run typecheck` → verde.
- [ ] **Step 5: Commit** `feat(#62): empujador de tres cubiertas con pechos, torre y chimeneas gemelas`

### Verificación en el lab (después de Task 3, la hace el orquestador)

- `npm run dev -- --host --port 5173`, abrir `http://localhost:5173/lab/blog.html?speed=10`, tecla `3`, esperar a que el convoy esté a la vista, `?speed=0.1` para congelarlo; captura `docs/superpowers/specs/assets/57-barcos/barge-despues.png`.
- Leer el log de consola `[lab] peor redibujo en 5 s: N ms` con los tres barcos a la vista; N ≤ 15.
- Revisar a ojo el orden de dibujo del bloque de popa de la barcaza frente al casco redondeado.

## Desvíos respecto del documento de referencia

- 4 tapas en lugar de 5 (el issue pide 3–4).
- Testeros de brazola agregados (brazola perimetral).
- Bitas en las cuatro esquinas de la barcaza; sin bitas de empujador, cabos ni barriles.
- Barandas agregadas (las pide el issue).

## Grilling

- Rondas: 1 (el plan no cambió de forma sustancial: se corrigió un test, se agregó el paso de la captura "antes", la tabla de criterios y las suposiciones).
- Preguntas: 18. Fuentes: ISSUE 6 (2, 3, 4, 12, 13, 16), CODE 11 (1, 5, 8, 9, 10, 11, 14, 17, 18, y 2 con `sea-anim.test.ts:44`), DOC 1 (6, documento de referencia, "Decisiones"), NO SOURCE → suposición técnica 5 (3, 6, 7, 14, 15).
- Hallazgo corregido: el assert "sin contenedores" (`h === 2.6`) chocaba con el mástil (`h` 2.6); ahora mira solo piezas de la barcaza (x ≥ 0) con `h ≥ 2`.
- Suposiciones: ver "Assumptions".
- Issues abiertos: ninguno (no hubo preguntas fuera de alcance ni ambigüedades de spec).
