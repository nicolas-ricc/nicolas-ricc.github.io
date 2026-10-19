import { describe, expect, it } from "vitest";
import { v3 } from "./geometry";
import { isBehind, overlaps, screenBounds, sortByDepth } from "./depth";
import { createRng } from "../map/seed";
import { bounds, type Solid } from "./solids";

const box = (x: number, y: number, z: number, w = 2, d = 2, h = 2): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat: "steel" });
// Caja alineada con el marco local rotado `h` alrededor del origen (como las piezas de un barco).
const rotBox = (h: number, x0: number, y0: number, w: number, d: number, z: number, hz: number): Solid => {
  const c = Math.cos(h), s = Math.sin(h);
  const footprint = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]].map(([x, y]) => ({ x: x! * c - y! * s, y: x! * s + y! * c }));
  return { kind: "poly", footprint, z, h: hz, mat: "steel" };
};
const rotCyl = (h: number, x: number, y: number, z: number, r: number, hz: number): Solid =>
  ({ kind: "cylinder", at: v3(x * Math.cos(h) - y * Math.sin(h), x * Math.sin(h) + y * Math.cos(h), z), r, h: hz, mat: "steel", sides: 8 });

describe("depth", () => {
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

describe("sortByDepth con cascos", () => {
  const hull: Solid = { kind: "hull", at: v3(0, 0, -1), len: 20, beam: 6, h: 5, mat: "steel", heading: 0, sheer: 1.25 };
  const deck = -1 + 5;

  it("una pieza apoyada en la cubierta de un casco se dibuja después del casco, aunque quede en la mitad lejana", () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.3]) {
      const h: Solid = { ...hull, heading } as Solid;
      const c = Math.cos(heading), s = Math.sin(heading);
      // casetas sobre la cubierta en cada extremo y en cada banda, en el marco del casco
      const onDeck = (x0: number, y0: number, w: number, d: number): Solid => ({
        kind: "poly", z: deck, h: 3, mat: "steel",
        footprint: [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]].map(([x, y]) => ({ x: x! * c - y! * s, y: x! * s + y! * c })),
      });
      const pieces = [onDeck(2, -1, 2, 2), onDeck(14, -1, 2, 2), onDeck(9, -2.5, 2, 1), onDeck(9, 1.5, 2, 1)];
      const order = sortByDepth([...pieces, h], heading);
      const hullAt = order.indexOf(h);
      for (const p of pieces) expect(order.indexOf(p)).toBeGreaterThan(hullAt);
    }
  });

  it("una pieza que no está sobre la cubierta conserva el orden de siempre", () => {
    const hb = bounds(hull);
    const behind = box(2, hb.min.y - 4, 0, 3, 3, 2); // al norte del casco, base z 0
    const order = sortByDepth([hull, behind]);
    expect(order.indexOf(behind)).toBeLessThan(order.indexOf(hull));
  });
});

describe("sortByDepth en el marco del barco", () => {
  it("una pieza apoyada en el extremo lejano de otra rotada se dibuja después, a cualquier rumbo", () => {
    for (const h of [0.5, 0.3, 1.2, 2.3, -0.7, -2.6]) {
      const lower = rotBox(h, 0, 0, 40, 6, 0, 3);
      const upper = rotBox(h, 34, 0, 6, 6, 3, 3);
      expect(sortByDepth([upper, lower], h)).toEqual([lower, upper]);
      expect(sortByDepth([lower, upper], h)).toEqual([lower, upper]);
    }
  });

  it("tres niveles de casa y puente a rumbo 100 grados: cada pieza se dibuja después de la que tiene debajo", () => {
    // Medidas locales (x, y, ancho, largo, z, alto) de una caseta, su ala de puente y una barandilla; esta no se afirma, pero sin ella el orden viejo acierta por casualidad.
    const specs = [[5, -2.4, 6.5, 4.8, 6.8, 1.4], [6.5, -5, 4, 10, 8.2, 1.5], [12.4, -3.5, 1, 7, 6.5, 0.3]] as const;
    const h = (100 * Math.PI) / 180;
    const pieces = specs.map(([x, y, w, d, z, hz]) => rotBox(h, x, y, w, d, z, hz));
    for (const input of [pieces, [...pieces].reverse()]) {
      const order = sortByDepth(input, h);
      expect(order.indexOf(pieces[0]!)).toBeLessThan(order.indexOf(pieces[1]!));
    }
  });

  it("sin rumbo o con rumbo 0 el orden es el de siempre", () => {
    const rng = createRng(5);
    const solids: Solid[] = [];
    for (let i = 0; i < 60; i++) solids.push(box(rng.int(0, 60), rng.int(0, 40), rng.chance(0.1) ? -3 : 0, rng.int(1, 12), rng.int(1, 12), rng.int(1, 20)));
    expect(sortByDepth(solids, 0)).toEqual(sortByDepthNaive(solids));
    expect(sortByDepth(solids)).toEqual(sortByDepthNaive(solids));
  });
});

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
