import { describe, expect, it } from "vitest";
import { v3 } from "./geometry";
import { hides, hullsOverlap, isBehind, overlaps, screenBounds, screenHull, sortByDepth } from "./depth";
import { createRng } from "../map/seed";
import { bounds, type Solid } from "./solids";

const box = (x: number, y: number, z: number, w = 2, d = 2, h = 2): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat: "steel" });

describe("depth", () => {
  it("screenHull: una caja proyecta un hexágono dentro de su caja de pantalla", () => {
    const b = { min: v3(0, 0, 0), max: v3(4, 2, 3) };
    const h = screenHull(b), sb = screenBounds(b);
    expect(h).toHaveLength(6);
    for (const p of h) {
      expect(p.x).toBeGreaterThanOrEqual(sb.minX - 1e-9); expect(p.x).toBeLessThanOrEqual(sb.maxX + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(sb.minY - 1e-9); expect(p.y).toBeLessThanOrEqual(sb.maxY + 1e-9);
    }
  });

  it("hullsOverlap: tocarse en un borde no cuenta", () => {
    const sq = (x: number) => [{ x, y: 0 }, { x: x + 1, y: 0 }, { x: x + 1, y: 1 }, { x, y: 1 }];
    expect(hullsOverlap(sq(0), sq(0.5))).toBe(true);
    expect(hullsOverlap(sq(0), sq(1))).toBe(false);
  });

  it("hides: la torre de la plaza tapa el neón de la avenida pero no lo que cae en el rincón vacío de su caja de pantalla", () => {
    // casos medidos en la semilla del mundo: neón del frente sur de (102, 188) y torre de la plaza
    const neon = { min: v3(103.95, 204.45, 2.65), max: v3(107.05, 204.55, 3.95) };
    const tower = { min: v3(121, 220, 0), max: v3(137, 234, 30) };
    expect(hides(neon, tower)).toBe(true);
    const corner = { min: v3(119.5, 230.5, 32.5), max: v3(120, 231, 33) }; // al oeste y alto: rincón noroeste de la caja de pantalla
    expect(overlaps(screenBounds(corner), screenBounds(tower))).toBe(true);
    expect(isBehind(corner, tower)).toBe(true);
    expect(hides(corner, tower)).toBe(false);
  });

  it("hides: un techo con vuelo encima no tapa la ventana de abajo de la cara sur", () => {
    const win = { min: v3(16, 169.95, 1), max: v3(21.4, 170.05, 2.6) };
    const roof = { min: v3(13, 165, 6.3), max: v3(35, 170.5, 8.32) };
    expect(isBehind(win, roof)).toBe(true);
    expect(overlaps(screenBounds(win), screenBounds(roof))).toBe(true);
    expect(hides(win, roof)).toBe(false);
  });

  it("hides: lo de adelante no queda tapado por lo de atrás", () => {
    const front = { min: v3(10, 10, 0), max: v3(12, 12, 5) }, back = { min: v3(0, 0, 0), max: v3(8, 8, 20) };
    expect(hides(front, back)).toBe(false);
    expect(hides(back, front)).toBe(true);
  });

  it("screenBounds proyecta las 8 esquinas", () => {
    const sb = screenBounds(bounds(box(0, 0, 0, 2, 2, 2)));
    expect(sb).toEqual({ minX: -2, minY: -2.8, maxX: 2, maxY: 2 });
  });

  it("isBehind: separación en x, y o z", () => {
    expect(isBehind(bounds(box(0, 0, 0)), bounds(box(5, 0, 0)))).toBe(true);  // a al oeste
    expect(isBehind(bounds(box(5, 0, 0)), bounds(box(0, 0, 0)))).toBe(false);
    expect(isBehind(bounds(box(0, 0, 0)), bounds(box(0, 5, 0)))).toBe(true);  // a al norte
    expect(isBehind(bounds(box(0, 0, -6)), bounds(box(0, 0, 0)))).toBe(true); // a hundido
  });

  it("ordena de atrás hacia adelante en diagonal", () => {
    const far = box(0, 0, 0), mid = box(3, 3, 0), near = box(6, 6, 0);
    expect(sortByDepth([near, far, mid])).toEqual([far, mid, near]);
  });

  it("un objeto chico delante de una nave larga se dibuja después", () => {
    const hall = box(0, 0, 0, 90, 16, 10);
    const car = box(40, 20, 0, 3, 4, 1.5);
    expect(sortByDepth([car, hall])).toEqual([hall, car]);
  });

  it("un objeto chico detrás de una nave larga se dibuja antes", () => {
    const hall = box(0, 20, 0, 90, 16, 10);
    const car = box(40, 10, 0, 3, 4, 1.5);
    expect(sortByDepth([hall, car])).toEqual([car, hall]);
  });

  it("lo hundido va antes que lo apoyado en la misma celda", () => {
    const pit = box(0, 0, -6, 10, 10, 6);
    const crate = box(2, 2, 0, 2, 2, 2);
    expect(sortByDepth([crate, pit])).toEqual([pit, crate]);
  });

  it("no muta la entrada y conserva todos los elementos", () => {
    const input = [box(6, 6, 0), box(0, 0, 0)];
    const snapshot = [...input];
    const out = sortByDepth(input);
    expect(input).toEqual(snapshot);        // mismo contenido y orden
    expect(out).not.toBe(input);            // array nuevo
    expect(out).toHaveLength(2);
    expect(out).toEqual([input[1], input[0]]); // ordenado de atrás hacia adelante
  });
});

/** Referencia: la versión que comparaba todos los pares en orden de índice (antes del barrido por x). */
function sortByDepthNaive(solids: Solid[]): Solid[] {
  const n = solids.length;
  const bs = solids.map(bounds), sbs = bs.map(screenBounds);
  const keys = bs.map((b) => b.min.x + b.max.x + b.min.y + b.max.y + (b.min.z + b.max.z) * 0.5);
  const before: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!overlaps(sbs[i]!, sbs[j]!)) continue;
    const ij = isBehind(bs[i]!, bs[j]!), ji = isBehind(bs[j]!, bs[i]!);
    if (ij === ji) { if (keys[i]! <= keys[j]!) before[j]!.push(i); else before[i]!.push(j); }
    else if (ij) before[j]!.push(i);
    else before[i]!.push(j);
  }
  const state = new Uint8Array(n), out: Solid[] = [];
  const visit = (i: number): void => { if (state[i] !== 0) return; state[i] = 1; for (const p of before[i]!) if (state[p] !== 1) visit(p); state[i] = 2; out.push(solids[i]!); };
  for (const i of solids.map((_, i) => i).sort((a, b) => keys[a]! - keys[b]!)) visit(i);
  return out;
}

describe("sortByDepth con barrido", () => {
  it("da exactamente el mismo orden que comparar todos los pares", () => {
    const rng = createRng(11);
    const solids: Solid[] = [];
    for (let i = 0; i < 400; i++) solids.push(box(rng.int(0, 200), rng.int(0, 120), rng.chance(0.1) ? -3 : 0, rng.int(1, 12), rng.int(1, 12), rng.int(1, 20)));
    expect(sortByDepth(solids)).toEqual(sortByDepthNaive(solids));
  });
});
