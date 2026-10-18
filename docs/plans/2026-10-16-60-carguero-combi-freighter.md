# Carguero como Damen Combi Freighter 3850 (#60) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `cargo()` en `src/scenes/ships.ts` para que el carguero del mar de Blog reproduzca al Damen Combi Freighter 3850: casa y puente a popa, bodega única con tapas, dos grúas en babor con pluma a 45°, castillo de proa con mástil, molinete, bitas y ancla, y amurada baja de la casa al castillo.

**Architecture:** Solo cambia la función `cargo` (y su test). Las piezas siguen siendo las del kit local (`hull`, `box`, `cyl`, `dot`, `poly`), rotadas por `heading`; se suma una pieza `plate` al kit (huella de cuatro puntos arbitrarios en coordenadas locales) para la amurada que sigue el afinamiento de la proa. La pluma inclinada de cada grúa se arma con tres cajas finas escalonadas a 45° (el kit no tiene sólidos inclinados). `SHIP_SPECS.cargo` queda en 60 × 10, `h` 5, `sheer` 0.25, `topMat` `hullBlue`, así las rutas y la estela no cambian.

**Tech Stack:** TypeScript, PixiJS (pipeline iso de `src/iso/`), Vitest (`npm test`), `npm run typecheck`, `npm run build`, `agent-browser` sobre `/lab/blog.html`.

**Spec:** issue #60 (hijo de #57, rama base `feature/57-barcos-reales-rutas`) y `docs/superpowers/specs/2026-10-16-barcos-referencia.md`, sección `cargo` (traducción a la escala del mapa y piezas sugeridas 1–33).

## Global Constraints

- Se conserva el id `ShipKind` `cargo`; el docstring de `ships.ts` dice qué modelo reproduce.
- Caja: eslora total ≤ 60 u, manga ≤ 10 u, ningún sólido por encima de z = 13 (agua en z −1; `deck = WATER_Z + spec.h` = 4).
- Presupuesto: ≤ 40 sólidos y ≤ 8 luces por barco (el test general pasa de 30 / 6 a 40 / 8). En `/lab/blog.html`, `[lab] peor redibujo en 5 s` ≤ 15 ms con los tres barcos a la vista.
- Materiales: solo `Material` existentes, y si no están en `SHIP_MATS` se agregan ahí. Este plan usa solo los que ya están (`hull`, `hullBlue`, `whitewash`, `steel`, `rust`, `deck`, `glass`). No se agregan colores a la paleta.
- Luces de navegación: tope `magentaMid`, babor `magenta`, estribor `cyanMid` (en ese orden, primeras tres luces); ventanas encendidas como `poly` `magentaBleed`. `wake()` no cambia (17 triángulos).
- Piezas dentro de la caja del casco en planta (margen 2) y con base sobre la cubierta (z ≥ 4 − 0.01); la excepción actual (cilindros r 0.45) no se toca.
- Las grúas van en **babor** (y < 0) con pluma a 45° hacia proa, como pide el issue. El documento de referencia las daba como opcionales en estribor porque el CF 3850 real no las tiene; manda el issue.
- Capturas `docs/superpowers/specs/assets/57-barcos/cargo-antes.png` (antes de tocar código) y `cargo-despues.png`, tomadas con `agent-browser` en `/lab/blog.html`.

## Review Focus

1. Rumbos distintos de 0 (los carriles van al SSO y al NNE): toda pieza tiene que rotar con el barco y quedar dentro de su caja → test en la tarea 4 con cuatro rumbos.
2. Una pieza más alta que z = 13 que rompe la validación de rutas (la caja de alineación de `sea-anim.test.ts`) → test de altura en la tarea 1, y la tarea 4 lo repite para el barco entero en cualquier rumbo.
3. Piezas que quedan medio dentro del casco (ancla en el costado, bases de casa en la popa con arrufo) y se pintan en orden de profundidad equivocado → revisión visual en el lab (tarea 5), cuatro rumbos.
4. Presupuesto de redibujo con fachadas nuevas (cuatro cajas con ventanas) → medición en el lab (tarea 5); si pasa de 15 ms, bajar `cols` de las fachadas antes que quitar piezas.
5. Los tests de rutas y animación (`sea-anim.test.ts`, `sea-animator.test.ts`) asumen la caja del carguero → se corre la suite completa al cerrar cada tarea.

---

## Coordenadas de referencia

Locales al barco: x de popa (0) a proa (60), y hacia estribor (+). Cubierta `deck = 4`. Media manga de la cubierta (de `DECK_RING`): 5 entre x 10.8 y 34.2; 3.18 en x 50; 2.14 en x 54; 1.79 en x 55. La cubierta sube en la proa por el arrufo (≈ 4.83 en x 55).

### Task 1: Casa de popa y puente

**Files:**
- Modify: `src/scenes/ships.ts` (docstring, `cargo`, se borra la constante `BRIDGE` si queda sin uso)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: `Kit` (`box`, `cyl`, `dot`, `poly`), `WATER_Z`.
- Produces: `cargo()` con la casa a popa; las tres primeras luces son tope, babor, estribor. Las tareas 2–4 agregan piezas al final de la misma función.

- [ ] **Step 1: Write the failing test**

En `src/scenes/ships.test.ts`: cambiar el test general a `≤ 40` sólidos y `≤ 8` luces (y su título), importar `type Solid` de `../iso/solids`, y reemplazar el test `"carguero: tres escotillas, …"` por este bloque:

```ts
describe("carguero (Damen Combi Freighter 3850)", () => {
  const s = ship("cargo", { x: 0, y: 0 }, 0);
  it("casa y puente a popa: las piezas con fachada quedan en el último tercio; puente con alerones a la manga; escapes detrás del puente; nada por encima de z 13", () => {
    const faced = s.solids.filter((x) => x.kind === "poly" && x.facade);
    expect(faced.length).toBeGreaterThanOrEqual(4);
    for (const x of faced) expect(bounds(x).max.x).toBeLessThanOrEqual(60 / 3);
    const bridge = bounds(faced.find((x) => x.kind === "poly" && x.facade?.base === "glass")!);
    expect(bridge.min.y).toBeCloseTo(-5, 6); expect(bridge.max.y).toBeCloseTo(5, 6);
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && bounds(x).max.x <= bridge.min.x);
    expect(stacks).toHaveLength(2);
    expect(Math.max(...s.solids.map((x) => bounds(x).max.z))).toBeLessThanOrEqual(13);
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
    const south = ship("cargo", { x: 100, y: 100 }, Math.PI / 2);
    expect(Math.max(...south.solids.map((x) => bounds(x).max.y))).toBeCloseTo(160, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/ships.test.ts`
Expected: FAIL en el bloque del carguero (la superestructura actual está en x 40–50).

- [ ] **Step 3: Write minimal implementation**

Reemplazar el cuerpo entero de `cargo` por:

```ts
function cargo(k: Kit, spec: ShipSpec, solids: Solid[], lights: Accent[]): void {
  const deck = WATER_Z + spec.h;
  solids.push( // casa de popa: tres niveles que se angostan, puente con alerones a toda la manga
    k.box(4.5, -3.5, 7.5, 7, deck, 1.4, "whitewash", { floors: 1, cols: 4 }),
    k.box(4.7, -2.7, 7, 5.4, deck + 1.4, 1.4, "whitewash", { floors: 1, cols: 4 }),
    k.box(5, -2.4, 6.5, 4.8, deck + 2.8, 1.4, "whitewash", { floors: 1, cols: 3 }),
    k.box(6.5, -5, 4, 10, deck + 4.2, 1.5, "whitewash", { floors: 1, cols: 4, base: "glass" }),
    k.box(6.3, -5.1, 4.4, 10.2, deck + 5.7, 0.2, "steel"), // techo del puente
  );
  solids.push(k.cyl(5.8, -1, deck + 4.2, 0.5, 1.8, "steel"), k.cyl(5.8, 1, deck + 4.2, 0.5, 1.8, "steel")); // escapes detrás del puente
  solids.push(k.box(6, -3.6, 3, 0.9, deck + 1.4, 0.9, "rust")); // bote salvavidas en babor
  solids.push(k.box(8, -0.2, 0.4, 0.4, deck + 5.9, 2.1, "steel"), k.box(8, -1.5, 0.4, 3, deck + 7, 0.25, "steel")); // mástil de radar y cruceta
  lights.push(k.dot(8.2, 0, deck + 8.2, 0.7, "magentaMid"), k.dot(10, -5, deck + 5.2, 0.4, "magenta"), k.dot(10, 5, deck + 5.2, 0.4, "cyanMid"));
  lights.push(k.poly([[10.52, -4.6, deck + 4.9], [10.52, 4.6, deck + 4.9], [10.52, 4.6, deck + 5.5], [10.52, -4.6, deck + 5.5]], "magentaBleed", 0.8)); // ventanas del puente encendidas, cara de proa
}
```

Actualizar el docstring de la cabecera de `ships.ts` agregando una línea: `` `cargo` reproduce al Damen Combi Freighter 3850 (casa y puente a popa, bodega con tapas, dos grúas en babor); ver docs/superpowers/specs/2026-10-16-barcos-referencia.md. `` Borrar `BRIDGE` si ningún otro barco lo usa (`grep -n BRIDGE src/scenes/ships.ts`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/ships.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ships.ts src/scenes/ships.test.ts
git commit -m "feat(#60): casa y puente a popa del Combi Freighter 3850"
```

### Task 2: Bodega con tapas de escotilla y pórtico

**Files:**
- Modify: `src/scenes/ships.ts` (`cargo`)
- Test: `src/scenes/ships.test.ts` (bloque `describe("carguero …")`)

**Interfaces:**
- Consumes: `cargo()` de la tarea 1, `Kit.box`.
- Produces: brazola `rust` de alto 1 (única pieza `rust` con `h === 1`) y tres tapas `steel` apoyadas en `deck + 1`.

- [ ] **Step 1: Write the failing test**

```ts
  it("bodega única: brazola rust larga con tres tapas planas encima, entre la casa y el castillo", () => {
    const coaming = s.solids.filter((x) => x.kind === "poly" && x.mat === "rust" && x.h === 1);
    expect(coaming).toHaveLength(1);
    const cb = bounds(coaming[0]!);
    expect(cb.max.x - cb.min.x).toBeGreaterThanOrEqual(30); expect(cb.min.x).toBeGreaterThanOrEqual(12); expect(cb.max.x).toBeLessThanOrEqual(50);
    const covers = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && Math.abs(x.z - cb.max.z) < 1e-6);
    expect(covers).toHaveLength(3);
    for (const c of covers) { const b = bounds(c); expect(b.min.x).toBeGreaterThanOrEqual(cb.min.x); expect(b.max.x).toBeLessThanOrEqual(cb.max.x); expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.5); }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/ships.test.ts`
Expected: FAIL (`coaming` tiene largo 0).

- [ ] **Step 3: Write minimal implementation**

Al final de `cargo`:

```ts
  solids.push(k.box(14, -3.4, 34, 6.8, deck, 1, "rust")); // brazola de la bodega
  for (let i = 0; i < 3; i++) solids.push(k.box(14.2 + i * 11.2, -3.2, 11, 6.4, deck + 1, 0.3, "steel")); // tapas de escotilla
  solids.push(k.box(12.5, -3.2, 0.5, 0.5, deck, 2.5, "steel"), k.box(12.5, 2.7, 0.5, 0.5, deck, 2.5, "steel"), k.box(12.4, -3.5, 1, 7, deck + 2.5, 0.3, "steel")); // pórtico de tapas, estacionado a proa de la casa
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/ships.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ships.ts src/scenes/ships.test.ts
git commit -m "feat(#60): bodega del carguero con tapas de escotilla y pórtico"
```

### Task 3: Dos grúas de cubierta en babor con pluma a 45°

**Files:**
- Modify: `src/scenes/ships.ts` (`cargo`)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: `cargo()` de las tareas 1–2.
- Produces: pedestales `cyl` r 0.5 h 3 en babor (únicos cilindros con esas medidas); plumas como tres cajas `steel` de alto 0.7 por grúa (únicas cajas `steel` con `h === 0.7`).

- [ ] **Step 1: Write the failing test**

```ts
  it("dos grúas en babor: pedestal, cabina y pluma de tres tramos subiendo a 45° hacia proa", () => {
    const pedestals = s.solids.flatMap((x) => (x.kind === "cylinder" && x.r === 0.5 && x.h === 3 ? [x] : []));
    expect(pedestals).toHaveLength(2);
    const steps = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 0.7).map((x) => bounds(x));
    expect(steps).toHaveLength(6);
    for (const p of pedestals) {
      expect(p.at.y).toBeLessThan(-3.4); expect(p.at.z).toBeCloseTo(4, 6);
      const boom = steps.filter((b) => b.min.x > p.at.x && b.min.x < p.at.x + 6).sort((a, b) => a.min.x - b.min.x);
      expect(boom).toHaveLength(3);
      for (const b of boom) expect(b.max.y).toBeLessThan(0);
      for (let i = 1; i < 3; i++) {
        const dx = boom[i]!.min.x - boom[i - 1]!.min.x, dz = boom[i]!.min.z - boom[i - 1]!.min.z;
        expect(dz).toBeGreaterThan(0); expect(dz).toBeCloseTo(dx, 6);
      }
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/ships.test.ts`
Expected: FAIL (0 pedestales).

- [ ] **Step 3: Write minimal implementation**

Al final de `cargo`. Los pedestales van entre tapas (x 25.3 y 36.5), a babor de la brazola:

```ts
  for (const dx of [25.3, 36.5]) { // grúas de cubierta en babor: pedestal, cabina y pluma escalonada a 45° hacia proa
    solids.push(k.cyl(dx, -3.9, deck, 0.5, 3, "steel"), k.box(dx - 0.6, -4.5, 1.2, 1.2, deck + 3, 1, "whitewash"));
    for (let i = 0; i < 3; i++) solids.push(k.box(dx + 0.6 + 1.5 * i, -4.1, 1.8, 0.4, deck + 3.5 + 1.5 * i, 0.7, "steel"));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/ships.test.ts`
Expected: PASS (la punta de la pluma queda en z 11.2 < 13).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ships.ts src/scenes/ships.test.ts
git commit -m "feat(#60): dos grúas de cubierta en babor con pluma a 45°"
```

### Task 4: Castillo de proa, ancla y amurada

**Files:**
- Modify: `src/scenes/ships.ts` (interfaz `Kit` y `kit()`: pieza `plate`; `cargo`)
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Consumes: `cargo()` de las tareas 1–3.
- Produces: `Kit.plate(pts: [number, number][], z: number, h: number, mat: Material): Solid`, un `poly` con huella en coordenadas locales rotadas por `heading`.

- [ ] **Step 1: Write the failing test**

```ts
  it("proa: castillo con mástil, molinete y dos bitas; ancla asomando a estribor; amurada en las dos bandas de la casa al castillo", () => {
    const forecastle = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 1.6);
    expect(forecastle).toHaveLength(1); expect(bounds(forecastle[0]!).min.x).toBeGreaterThanOrEqual(48);
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.r === 0.3)).toHaveLength(2); // bitas
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.r === 0.6)).toHaveLength(1); // molinete
    const anchor = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && bounds(x).min.x >= 54);
    expect(anchor).toHaveLength(1); expect(bounds(anchor[0]!).max.y).toBeGreaterThan(1.79);
    const rails = s.solids.filter((x) => x.kind === "poly" && x.mat === "hullBlue" && x.h === 0.8).map((x) => bounds(x));
    expect(rails).toHaveLength(4);
    for (const side of [rails.filter((b) => b.max.y < 0), rails.filter((b) => b.min.y > 0)]) {
      expect(side).toHaveLength(2);
      expect(Math.min(...side.map((b) => b.min.x))).toBeLessThanOrEqual(12); expect(Math.max(...side.map((b) => b.max.x))).toBeGreaterThanOrEqual(50);
    }
    expect(s.lights.filter((l) => l.color === "magentaMid")).toHaveLength(2); // tope de popa y de proa
  });
  it("con cualquier rumbo, todas las piezas quedan en el círculo de la eslora y por debajo de z 13; presupuesto 40 / 8", () => {
    for (const h of [0, Math.PI / 2, 2.3, -0.7]) {
      const r = ship("cargo", { x: 0, y: 0 }, h), cx = 30 * Math.cos(h), cy = 30 * Math.sin(h);
      expect(r.solids.length).toBeLessThanOrEqual(40); expect(r.lights.length).toBeLessThanOrEqual(8);
      for (const x of r.solids) for (const f of tessellateAll(x)) for (const p of f.pts) {
        expect(Math.hypot(p.x - cx, p.y - cy)).toBeLessThanOrEqual(Math.hypot(30, 5) + 0.01);
        expect(p.z).toBeLessThanOrEqual(13);
      }
    }
  });
```

(Importar `tessellateAll` de `../iso/solids`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/ships.test.ts`
Expected: FAIL (no hay castillo, bitas, ancla ni amurada).

- [ ] **Step 3: Write minimal implementation**

En `interface Kit` agregar:

```ts
  plate: (pts: [number, number][], z: number, h: number, mat: Material) => Solid;
```

y en `kit()`:

```ts
    plate: (pts, z, h, mat) => ({ kind: "poly", footprint: pts.map(([dx, dy]) => local(dx, dy)), z, h, mat }),
```

Al final de `cargo`:

```ts
  solids.push(k.box(50, -2.1, 4, 4.2, deck, 1.6, "steel")); // castillo de proa
  solids.push(k.box(52, -0.2, 0.4, 0.4, deck + 1.6, 5.4, "steel"), k.box(52.05, -1.5, 0.3, 3, deck + 5.5, 0.25, "steel")); // mástil de proa y cruceta
  solids.push(k.cyl(50.9, 0, deck + 1.6, 0.6, 0.6, "steel"), k.cyl(53.3, -1.2, deck + 1.6, 0.3, 0.5, "steel"), k.cyl(53.3, 1.2, deck + 1.6, 0.3, 0.5, "steel")); // molinete y bitas
  solids.push(k.box(54.6, 1.6, 0.8, 0.5, deck, 0.8, "steel")); // ancla en el escobén de estribor, bajo el arrufo de la proa
  solids.push(k.box(12, -5, 22.2, 0.3, deck, 0.8, "hullBlue"), k.box(12, 4.7, 22.2, 0.3, deck, 0.8, "hullBlue")); // amurada en el tramo recto
  solids.push( // amurada que sigue el afinamiento de la proa hasta el castillo
    k.plate([[34.2, -5], [50, -3.18], [50, -2.88], [34.2, -4.7]], deck, 0.8, "hullBlue"),
    k.plate([[34.2, 4.7], [50, 2.88], [50, 3.18], [34.2, 5]], deck, 0.8, "hullBlue"),
  );
  lights.push(k.dot(52.2, 0, deck + 6.7, 0.5, "magentaMid")); // tope de proa
```

Las luces de esta tarea van **después** de las de la tarea 1, para no romper el orden tope/babor/estribor.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run typecheck`
Expected: PASS en toda la suite (38 sólidos, 5 luces).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ships.ts src/scenes/ships.test.ts
git commit -m "feat(#60): castillo de proa, ancla y amurada del carguero"
```

### Task 5: Verificación en el lab (capturas y presupuesto)

**Files:**
- Create: `docs/superpowers/specs/assets/57-barcos/cargo-despues.png` (`cargo-antes.png` se toma en la etapa de evals, antes de tocar código)

- [ ] **Step 1:** `npm run dev -- --host --port 5173`, abrir `http://localhost:5173/lab/blog.html?speed=10` con `agent-browser`, tecla `3`, esperar a que el carguero esté a la vista y capturar `cargo-despues.png`. Mirar el carguero con al menos dos rumbos (ida y vuelta): casa a popa, grúas en babor, tapas, ancla; ninguna pieza dibujada por delante del casco cuando debería quedar detrás.
- [ ] **Step 2:** Leer en la consola el log `[lab] peor redibujo en 5 s` durante 15 s con los tres barcos a la vista; anotar el peor valor. Si pasa de 15 ms: bajar `cols` de las fachadas de la casa y medir de nuevo.
- [ ] **Step 3:** `npm test`, `npm run typecheck`, `npm run build` en verde.
- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/assets/57-barcos/cargo-despues.png
git commit -m "docs(#60): captura del carguero Combi Freighter en el lab"
```

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas en la revisión del plan (van también a la descripción del PR):

1. **Pluma de las grúas en tres cajas escalonadas a 45°.** El issue sugiere "`poly` con puntos a distinta z o una caja fina rotada". El `poly` sólido extruye una huella 2D (`src/iso/solids.ts:12`), así que no puede inclinarse, y el `poly` de acento es una luz: brilla, se suma al bloom y cuenta contra las 8 luces. Se descartó agregar un sólido inclinado nuevo al pipeline iso, que comparte todo el mapa; el issue mismo dice que los sólidos inclinados no existen.
2. **Piezas de proa con base en `deck` (z 4) aunque el arrufo levanta la cubierta a ~4.5 en x 50 y ~4.8 en x 55.** La parte enterrada queda dentro del casco. El castillo asoma 1.1 en vez de 1.6, y el ancla queda en el costado de estribor justo bajo el borde de la cubierta. Así se cumple la regla del test general (base ≥ cubierta) sin ampliar sus excepciones. Alternativa descartada: calcular la cubierta con arrufo por pieza, que agrega un helper con una sola llamada.
3. **Pieza `plate` en el kit** para la amurada de la proa, en vez de cajas rectangulares que se saldrían del casco donde se afina. El contorno de la cubierta es lineal entre los puntos de `DECK_RING` (`src/iso/solids.ts:134-137`: de (0.57, 0.5) a (0.86, 0.3)), así que una placa recta de (34.2, ±5) a (50, ±3.18) sigue el borde exacto. El sentido de los vértices no importa: `face()` orienta la normal hacia afuera del centro (`src/iso/solids.ts:35-40`).
4. **Las piezas se identifican en los tests por material y medida** (`rust`/`h 1`, `steel`/`h 0.7`, cilindros por radio), como hace el test actual del carguero (`ships.test.ts`, kingposts `h === 8`). Las medidas elegidas no chocan entre tareas.
5. **No va la fila de contenedores sobre las tapas.** El issue la da como opcional. Sin ella, el carguero queda en 38 sólidos, con margen dentro de los 40.
6. **Rollback por tarea.** Cada tarea es un commit que deja la suite en verde; revertir la tarea 4 deja un carguero sin proa ni amurada, pero válido.
7. **La captura `cargo-antes.png`** se toma en la etapa de evals del pipeline (antes del primer commit de código) con `agent-browser` sobre `/lab/blog.html`, y entra en el commit `test(#60): evals`.

## Grilling

- Rondas: 1 (el plan no cambió de forma sustancial: se sumaron supuestos y notas, sin tareas nuevas).
- Preguntas: 20. Fuentes: ISSUE 6 (1, 7, 15, 16, 17, 18), CODE 17 (2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 20), DOC 1 (17: spec mundo-3 §presupuesto). Algunas preguntas tienen más de una fuente.
- Supuestos técnicos: 7 (sección anterior).
- Ambigüedades de spec: 0.
- Fuera de alcance: 1 (pregunta 20; ver abajo).
- Issues abiertos: ninguno. La pregunta 20 (¿documentar `plate` en CONTEXT.md/ADR?) no aplica: el repo no tiene CONTEXT.md ni docs/adr, y `plate` es una pieza interna de `ships.ts` (la interfaz `Kit` no se exporta).
