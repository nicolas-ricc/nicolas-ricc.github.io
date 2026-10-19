# Orden de piezas de cubierta y de costado en barcos girados (#74): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que `sortByDepth` dibuje toda pieza de cubierta después de su casco y toda pieza de costado del lado correcto del casco, en los cuatro barcos y a cualquier rumbo, con un test de barrido de 72 rumbos que hoy falla por la lancha.

**Architecture:** tres reglas nuevas en `src/iso/depth.ts`, cada una con su test. (1) Regla de costado (`besideHull`): una pieza que solapa el casco en planta, empieza bajo la cubierta y se cruza en z con el casco va antes o después de él según el signo del centro de la pieza menos el centro del casco, proyectado sobre la vista en el marco girado. (2) El casco separa: si una pieza va antes de un casco y otra después de ese mismo casco (por la regla de cubierta o la de costado), la primera va antes que la segunda, aunque la separación o la clave digan otra cosa. (3) Eje degenerado: si la componente de la vista en un eje del marco es ~0, una separación en ese eje no ordena (ninguno tapa al otro).

**Tech Stack:** TypeScript, Vitest, agent-browser para las capturas.

**Spec:** issue #74, segundo Agent Brief (re-triage 2026-10-19), que absorbe #77.

## Global Constraints

- "En cada barco y a cualquier rumbo, toda pieza de cubierta se dibuja después de su casco."
- "Toda pieza de costado se dibuja después del casco si está en el costado que mira al espectador y antes si está en el costado lejano. El costado se mide con el centro de la pieza respecto del centro del casco, proyectado sobre la dirección de la vista en el marco del barco."
- "La causa de la regresión de la lancha se diagnostica […] y se corrige en el orden de profundidad o en el modelo de la lancha. No vale esconderla moviendo piezas a mano solo en los rumbos que fallan."
- "`ShipKind` = `cargo | tug | barge | ferry`: el test recorre todos los valores, así un barco nuevo queda cubierto sin tocar el test." El test toma los tipos de `Object.keys(SHIP_SPECS)`, no de una lista escrita a mano.
- "Un test recorre cada `ShipKind` en 72 rumbos (cada 5°) y verifica las dos reglas." "El test falla en `main` antes del arreglo (por la lancha) y pasa después."
- "Los baselines de las escenas estáticas no cambian, o cada cambio se justifica con una captura antes/después en el PR."
- "Captura del lab de la lancha a rumbo 0 y a uno de los rumbos fallidos (por ejemplo 20° o 230°), antes y después."
- Fuera de alcance: el sólido inclinado para plumas (#78), cambiar los modelos de barcos más allá de lo que exija la lancha, y el orden entre barcos distintos o entre un barco y el escenario.
- `npm test` y `npm run typecheck` en verde. Textos, comentarios y nombres de test en castellano, como el resto del repo. Commits `test(#74): …`, `fix(#74): …`, `docs(#74): …`.

## Vocabulario (del brief; `CONTEXT.md` no existe en el repo)

- **Pieza de cubierta:** sólido no casco con base en z ≥ cubierta de crujía (`hull.at.z + hull.h`) y que solapa el casco en planta, en el marco del barco. Es la condición de `restsOnHull`.
- **Pieza de costado:** sólido no casco que solapa el casco en planta, con base bajo la cubierta y tope por encima del fondo del casco (se cruza con él en z). Un sólido entero bajo la quilla no es pieza de costado: ahí ya ordena la separación en z. Esta última condición es una decisión técnica nuestra; el brief no habla de sólidos bajo la quilla.
- **Lado:** `t = (centro de la pieza − centro del casco) · (vx, vy)`, con las cajas en el marco girado y `(vx, vy)` la vista en ese marco (como en `sortByDepth`). `t > 0` es el costado cercano (después del casco), `t < 0` el lejano (antes). Si `|t| ≤ 1e-6` (la vista corre paralela al eje que separa los centros, por ejemplo una pieza de manga completa a rumbo 315°), no hay lado y la regla no se aplica ni se verifica.

## Diagnóstico (medido en `main`, `be29968`)

Barrido con el test de la tarea 1 sobre `main`:

| Barco | Cubierta antes del casco | Costado del lado equivocado |
|---|---|---|
| Carguero | 0/72 | 0/72 |
| Remolcador | 0/72 | 3/72 (145°, 305°, 315°) |
| Barcaza | 0/72 | 1/72 (315°) |
| Lancha | 22/72 (0°–45°, 230°–290°, 355°) | 3/72 (250°, 290°, 355°) |

La causa de la lancha es un ciclo, sin desempate raro. A rumbo 0 hay casco → cabina (regla de cubierta), cabina → defensa de estribor en x 5 (las separa el plano y = 1,7: la defensa cuelga afuera) y defensa → casco. Esta última arista la pone la clave de profundidad, porque defensa y casco se solapan en los tres ejes. La DFS corta el ciclo en la arista que lo cierra, casco → cabina, y la cabina sale antes del casco. Por la regla de lado del brief, la defensa en x 5 está en el costado lejano (`t < 0`, la mitad de popa pesa más que la banda), así que defensa → casco es correcta. Lo que sobra es cabina → defensa: el ciclo está en las reglas mismas. De ahí la regla (2): el casco separa, y lo que va antes que él va antes de lo que va después.

El remolcador a 145° y 305° (cilindros de esquina de popa) y la lancha a 250°, 290° y 355° (defensas) fallan porque la clave decide entre casco y pieza de costado. Eso lo arregla la regla (1). La barcaza y el remolcador a 315° fallan porque ahí `vx ≈ −1,7e-16`. `isBehindView` decide por el signo de ese ruido que el bloque de lanzamiento de proa (x 36,4..40) está detrás de la faja de babor (x 0..36,4), y cierra el ciclo casco → bloque → faja → casco. Con la vista paralela al plano x = c, ninguno de los dos tapa al otro: eso es la regla (3).

Prototipo con las tres reglas (`.scratch/prototype.diff`, revertido): barrido en 0/72 para los cuatro barcos en las dos reglas, el render list estático de `world(SEED)` idéntico ítem por ítem (32 447 ítems, 0 posiciones distintas) y `npm test` en verde (866 tests).

## Review Focus

- Escenas estáticas con cascos (astillero: dos cascos a rumbo 0 con andamios y cunas alrededor; feria: botes varados con rumbo propio): las reglas nuevas valen con cualquier rumbo, así que pueden reordenar algo. La comparación del render list estático de la tarea 5 lo cubre. Si cambia algo, hacen falta capturas.
- Rumbos exactos de 45°, 135°, 225° y 315°, donde una componente de la vista es ~0: lo cubre la regla (3) con su test, y el barrido pasa por los cuatro.
- Barcaza con dos cascos (empujador y barcaza): una pieza puede solapar los dos en planta. La regla (2) mira cada casco por separado. El barrido recorre los dos cascos de la barcaza.
- Rendimiento: `sortByDepth` corre cada cuadro para cada barco animado. Los cascos se buscan una vez por llamada y la clasificación es O(n·cascos). El test de equivalencia con la versión ingenua (400 cajas sin cascos) sigue cubriendo el caso sin cascos.
- Un barco nuevo agregado a `SHIP_SPECS` queda dentro del barrido sin tocar el test.

---

### Task 1: Evals (se escriben en la etapa 3, en rojo)

**Files:**
- Create: `src/scenes/ships-depth.test.ts`
- Modify: `src/iso/depth.test.ts` (tres tests nuevos al final)

**Interfaces:**
- Consumes: `ship(kind, at, heading)`, `SHIP_SPECS`, `ShipKind` de `src/scenes/ships.ts`; `sortByDepth(solids, heading)` de `src/iso/depth.ts`; `tessellateAll` de `src/iso/solids.ts`; `VIEW_DIR` de `src/iso/project.ts`.
- Produces: nada que use el código; las tareas 2 a 4 los ponen en verde.

- [ ] **Step 1: test de barrido** en `src/scenes/ships-depth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sortByDepth } from "../iso/depth";
import { VIEW_DIR } from "../iso/project";
import { tessellateAll, type Solid } from "../iso/solids";
import { SHIP_SPECS, ship, type ShipKind } from "./ships";

const EPS = 1e-6;
const KINDS = Object.keys(SHIP_SPECS) as ShipKind[];
const AT = { x: 37, y: -12 };

/** Caja del sólido en el marco del barco: vértices trasladados a la popa y girados −heading. */
function localBox(s: Solid, heading: number) {
  const c = Math.cos(heading), sn = Math.sin(heading);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    const dx = p.x - AT.x, dy = p.y - AT.y, v = [dx * c + dy * sn, -dx * sn + dy * c, p.z];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i]!, v[i]!); max[i] = Math.max(max[i]!, v[i]!); }
  }
  return { min, max };
}

describe("orden de las piezas de cada barco respecto de su casco", () => {
  it("en 72 rumbos: piezas de cubierta después del casco, piezas de costado del lado que mira la vista", () => {
    const fails: string[] = [];
    for (const kind of KINDS) for (let deg = 0; deg < 360; deg += 5) {
      const h = (deg * Math.PI) / 180;
      const { solids } = ship(kind, AT, h), order = sortByDepth(solids, h);
      const vx = VIEW_DIR.x * Math.cos(h) + VIEW_DIR.y * Math.sin(h), vy = -VIEW_DIR.x * Math.sin(h) + VIEW_DIR.y * Math.cos(h);
      for (const hull of solids) {
        if (hull.kind !== "hull") continue;
        const hb = localBox(hull, h), deck = hull.at.z + hull.h, at = order.indexOf(hull);
        for (const [i, p] of solids.entries()) {
          if (p.kind === "hull") continue;
          const pb = localBox(p, h);
          const inPlan = pb.min[0]! < hb.max[0]! - EPS && hb.min[0]! < pb.max[0]! - EPS && pb.min[1]! < hb.max[1]! - EPS && hb.min[1]! < pb.max[1]! - EPS;
          if (!inPlan) continue;
          const after = order.indexOf(p) > at;
          if (pb.min[2]! >= deck - EPS) { if (!after) fails.push(`${kind} ${deg}°: pieza de cubierta #${i} antes del casco`); continue; }
          if (pb.max[2]! <= hb.min[2]! + EPS) continue; // bajo la quilla: no es pieza de costado
          const t = ((pb.min[0]! + pb.max[0]! - hb.min[0]! - hb.max[0]!) * vx + (pb.min[1]! + pb.max[1]! - hb.min[1]! - hb.max[1]!) * vy) / 2;
          if (Math.abs(t) <= EPS) continue; // la vista corre paralela: no hay lado
          if (after !== t > 0) fails.push(`${kind} ${deg}°: pieza de costado #${i} ${t > 0 ? "cercana antes" : "lejana después"} del casco`);
        }
      }
    }
    expect(fails).toEqual([]);
  });
});
```

- [ ] **Step 2: tres tests de unidad** al final de `src/iso/depth.test.ts`, en un `describe("sortByDepth con piezas de costado", …)`. Reusan `rotBox` (hoy local al `describe` del marco del barco: moverlo arriba, al nivel del módulo, para compartirlo) y suman un cilindro girado:

```ts
const rotCyl = (h: number, x: number, y: number, z: number, r: number, hz: number): Solid =>
  ({ kind: "cylinder", at: v3(x * Math.cos(h) - y * Math.sin(h), x * Math.sin(h) + y * Math.cos(h), z), r, h: hz, mat: "steel", sides: 8 });

describe("sortByDepth con piezas de costado", () => {
  it("una pieza de costado se dibuja del lado del casco que le toca, aunque la clave diga otra cosa", () => {
    // cilindro de esquina de popa del remolcador a 145°: lado lejano, y la clave lo mandaba después del casco
    const h = (145 * Math.PI) / 180;
    const hull: Solid = { kind: "hull", at: v3(0, 0, -1), len: 19, beam: 7, h: 2.2, mat: "hull", topMat: "hullBlue", heading: h, sheer: 0.3 };
    const corner = rotCyl(h, 0.9, 1.7, 1, 0.45, 0.9);
    for (const input of [[corner, hull], [hull, corner]]) expect(sortByDepth(input, h)).toEqual([corner, hull]);
  });

  it("el casco separa: lo que va antes del casco va antes de lo que va después, aunque los separe un plano", () => {
    // lancha a rumbo 0: cabina sobre la cubierta, defensa de estribor en la mitad de popa (lado lejano) que el plano y = 1,7 pone después de la cabina
    const hull: Solid = { kind: "hull", at: v3(0, 0, -1), len: 15, beam: 4, h: 1.2, mat: "hull", topMat: "deck", heading: 0, sheer: 0.3 };
    const cabin = rotBox(0, 3.5, -1.7, 10, 3.4, 0.2, 1.5), fender = rotCyl(0, 5, 2.05, -0.2, 0.22, 0.5);
    for (const input of [[hull, cabin, fender], [fender, cabin, hull], [cabin, hull, fender]]) {
      expect(sortByDepth(input, 0)).toEqual([fender, hull, cabin]);
    }
  });

  it("con la vista paralela a un eje del marco, separarse en ese eje no ordena (barcaza a 315°)", () => {
    const h = (315 * Math.PI) / 180;
    const hull: Solid = { kind: "hull", at: v3(0, 0, -1), len: 40, beam: 8, h: 1.2, mat: "hull", topMat: "rust", heading: h, sheer: 0 };
    const strip = rotBox(h, 0, -4, 36.4, 0.15, -0.9, 1.15); // faja de babor, lado lejano
    const rake = [rotBox(h, 36.4, -4, 2, 8, -0.5, 0.75), rotBox(h, 38.4, -4, 1.6, 8, -0.1, 0.35)]; // lanzamiento de proa, manga completa
    const order = sortByDepth([hull, ...rake, strip], h);
    expect(order.indexOf(strip)).toBeLessThan(order.indexOf(hull));
  });
});
```

En el segundo test, `toEqual([fender, hull, cabin])` es el único orden que cumple las dos reglas: la defensa es lejana (`t = −2,5·vx + 2,05·vy < 0`, con `vx = vy`).

- [ ] **Step 3: correr y ver rojo.** `npx vitest run src/scenes/ships-depth.test.ts src/iso/depth.test.ts`. Esperado: el barrido falla con las 22 + 3 de la lancha, 3 del remolcador y 1 de la barcaza. Los tres tests nuevos de `depth.test.ts` fallan y los viejos pasan.

- [ ] **Step 4: capturas "antes"** (con `depth.ts` todavía igual a `main`). Ver la tarea 5, step 2, para el procedimiento. Guardar `lancha-0-antes.png` y `lancha-230-antes.png` en `docs/superpowers/specs/assets/74-barcos/`.

- [ ] **Step 5: commit** `test(#74): evals` con los dos archivos de test y las capturas "antes".

### Task 2: regla de costado

**Files:**
- Modify: `src/iso/depth.ts` (función nueva junto a `restsOnHull`, rama nueva en el bucle de pares)

**Interfaces:**
- Consumes: `Bounds`, `Solid`, `EPS`; las cajas del marco `bs` y la vista `vx`, `vy` que ya calcula `sortByDepth`.
- Produces: `function besideHull(hull: Solid, other: Solid, hb: Bounds, ob: Bounds, vx: number, vy: number): number` (privada), que devuelve `1` si `other` va después del casco, `−1` si va antes y `0` si la regla no aplica (`hull` no es casco, `other` es casco, no solapa en planta, no empieza bajo la cubierta de crujía, queda entero bajo la quilla, o `|t| ≤ EPS`). La tarea 3 la reusa.

- [ ] **Step 1:** correr `npx vitest run src/iso/depth.test.ts -t "del lado del casco"` y ver que falla.
- [ ] **Step 2: implementar.**

```ts
/**
 * Pieza de costado: solapa el casco en planta, empieza bajo su cubierta de crujía y no queda entera bajo la quilla
 * (defensas, goma, bloques que cuadran la barcaza). Va después del casco si su centro cae del lado de la vista respecto
 * del centro del casco (proyectado en el marco) y antes si cae del lado lejano. 1 después, −1 antes, 0 no aplica: con la
 * vista paralela al eje que separa los centros no hay lado.
 */
function besideHull(hull: Solid, other: Solid, hb: Bounds, ob: Bounds, vx: number, vy: number): number {
  if (hull.kind !== "hull" || other.kind === "hull") return 0;
  if (ob.min.z >= hull.at.z + hull.h - EPS || ob.max.z <= hb.min.z + EPS) return 0;
  if (!(ob.min.x < hb.max.x && hb.min.x < ob.max.x && ob.min.y < hb.max.y && hb.min.y < ob.max.y)) return 0;
  const t = ((ob.min.x + ob.max.x - hb.min.x - hb.max.x) * vx + (ob.min.y + ob.max.y - hb.min.y - hb.max.y) * vy) / 2;
  return Math.abs(t) <= EPS ? 0 : Math.sign(t);
}
```

En el bucle, después de las dos ramas de `restsOnHull`:

```ts
      else if ((side = besideHull(solids[i]!, solids[j]!, bs[i]!, bs[j]!, vx, vy) || -besideHull(solids[j]!, solids[i]!, bs[j]!, bs[i]!, vx, vy)) !== 0) {
        if (side > 0) before[j]!.push(i); else before[i]!.push(j);
      }
```

`side` es el lado de `j` respecto de `i` cuando `i` es el casco, o el de `i` respecto de `j` cambiado de signo. Positivo quiere decir que `j` va después de `i`. Declararla con `let side: number;` junto a `i`, `j`.

- [ ] **Step 3:** el test del step 1 pasa, y todos los de `depth.test.ts` y `ships.test.ts` siguen en verde. `npx tsx` del barrido no hace falta: el test del barrido sigue rojo (lancha y 315°) y eso es lo esperado.
- [ ] **Step 4: commit** `fix(#74): pieza de costado del lado de la vista`.

### Task 3: el casco separa

**Files:**
- Modify: `src/iso/depth.ts` (`sortByDepth`: clasificación por casco antes del bucle, rama nueva en el bucle)

**Interfaces:**
- Consumes: `restsOnHull`, `besideHull` (tarea 2).
- Produces: nada público.

- [ ] **Step 1:** `npx vitest run src/iso/depth.test.ts -t "el casco separa"` en rojo.
- [ ] **Step 2: implementar.** Antes del bucle de pares, clasificar cada sólido respecto de cada casco de la lista (los cascos son pocos: uno o dos por barco, unos seis en el mundo estático):

```ts
  // Lado de cada sólido respecto de cada casco (1 después, −1 antes): el casco separa, y lo que va antes de él va antes de lo que va después.
  const hulls = solids.flatMap((s, i) => (s.kind === "hull" ? [i] : []));
  const sides = solids.map((s, i) => {
    const m = new Map<number, number>();
    for (const h of hulls) {
      const c = restsOnHull(solids[h]!, s, bs[h]!, bs[i]!) ? 1 : besideHull(solids[h]!, s, bs[h]!, bs[i]!, vx, vy);
      if (c !== 0) m.set(h, c);
    }
    return m;
  });
  const across = (i: number, j: number): number => {
    for (const [h, c] of sides[i]!) { const d = sides[j]!.get(h); if (d !== undefined && d !== c) return d; }
    return 0;
  };
```

`across(i, j)` vale 1 si `j` va después de `i` porque un casco los separa (i antes, j después), −1 al revés y 0 si ningún casco los separa. Con `h === i`, `restsOnHull` y `besideHull` devuelven falso/0 porque `other` es casco, así que no hace falta saltearlo. En el bucle, después de la rama de `besideHull` y antes de la de "dos planos en el marco girado":

```ts
      else if ((side = across(i, j)) !== 0) { if (side > 0) before[j]!.push(i); else before[i]!.push(j); }
```

Actualizar el JSDoc de `sortByDepth`: la línea "La regla del casco (`restsOnHull`) vale con cualquier rumbo" pasa a nombrar las tres reglas del casco (cubierta, costado y casco que separa), que valen con cualquier rumbo.

- [ ] **Step 3:** el test pasa y `depth.test.ts` sigue en verde. El barrido queda rojo solo en 315°.
- [ ] **Step 4: commit** `fix(#74): el casco separa lo que va antes y lo que va después`.

### Task 4: eje degenerado

**Files:**
- Modify: `src/iso/depth.ts` (`isBehindView`)

- [ ] **Step 1:** `npx vitest run src/iso/depth.test.ts -t "paralela a un eje"` en rojo.
- [ ] **Step 2: implementar.** En `isBehindView`, con la componente de la vista ~0 en un eje, una separación en ese eje cuenta como "detrás" en los dos sentidos. Así cae en la rama `ij && ji`, que en el marco girado no impone relación:

```ts
function isBehindView(a: Bounds, b: Bounds, vx: number, vy: number): boolean {
  // Con la vista paralela al plano que separa (componente ~0), ninguno tapa al otro: vale como detrás en los dos sentidos.
  const far = (v: number, aMin: number, aMax: number, bMin: number, bMax: number): boolean =>
    (v > -EPS && aMax <= bMin + EPS) || (v < EPS && aMin >= bMax - EPS);
  return far(vx, a.min.x, a.max.x, b.min.x, b.max.x) || far(vy, a.min.y, a.max.y, b.min.y, b.max.y)
    || a.max.z <= b.min.z + EPS;
}
```

Con `|v| ≥ EPS` es exactamente la condición de hoy. Actualizar su JSDoc con una línea sobre el caso paralelo.

- [ ] **Step 3:** `npm test` entero en verde, barrido incluido, y `npm run typecheck`.
- [ ] **Step 4: commit** `fix(#74): la vista paralela a un eje del marco no ordena`.

### Task 5: escenas estáticas, capturas y cierre

**Files:**
- Create: `docs/superpowers/specs/assets/74-barcos/lancha-0-despues.png`, `lancha-230-despues.png`
- Scratch (no se commitea): `.scratch/baseline.ts`

- [ ] **Step 1: render list estático.** `.scratch/baseline.ts` arma `buildRenderList([...terrain.ground, ...scene.ground, ...scene.solids])` de `world(SEED)` (el mismo que `src/world/stage.ts:66`), lo serializa ítem por ítem (`capa|color|puntos`) y lo compara con `.scratch/baseline-main.json`, grabado en `main`. Esperado: 0 posiciones distintas. Si hay diferencias, capturar antes/después de la zona afectada y justificarlas en el PR.
- [ ] **Step 2: capturas.** Con `npm run dev -- --host --port 5173`:
  - Rumbo 0: `http://localhost:5173/lab/storybook.html#lancha` (la lancha del storybook se arma a rumbo 0 y pasa por `buildRenderList` de la escena estática, sin rumbo, que es `sortByDepth(…, 0)`). Captura con agent-browser a 1600×900 ×2.
  - Rumbo 230°: el storybook no gira las piezas, y la escena estática se ordena sin rumbo. La lancha animada de la feria sí pasa por `buildRenderList(l.solids, l.heading)` (`src/world/stage.ts:113`). Así que, sobre la misma página del lab, un `agent-browser eval` importa del dev server `/src/scenes/ships.ts` y `/src/iso/render-list.ts`, arma `buildRenderList(ship("ferry", shipAt("ferry", {x:0,y:0}, h), h).solids, h)` con h = 230° y dibuja los polígonos de la capa `solid` con su color en un canvas 2D a pantalla completa, centrado y escalado. Es el mismo orden y los mismos colores que dibuja Pixi, sin luces ni bloom.
  - Mismo procedimiento antes (tarea 1, con `depth.ts` de `main`) y después.
- [ ] **Step 3:** `npm test` y `npm run typecheck` en verde.
- [ ] **Step 4: commit** `docs(#74): capturas de la lancha antes y después`.
