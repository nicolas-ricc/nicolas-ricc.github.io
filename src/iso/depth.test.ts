import { describe, expect, it } from "vitest";
import { v3, type Vec2 } from "./geometry";
import { hides, hullsIntersect, hullsOverlap, isBehind, overlaps, screenBounds, screenHull, sortByDepth } from "./depth";
import { createRng } from "../map/seed";
import { bounds, type Solid } from "./solids";

const box = (x: number, y: number, z: number, w = 2, d = 2, h = 2): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat: "steel" });
// Box aligned with the local frame rotated by `h` around the origin (like a ship's pieces).
const rotBox = (h: number, x0: number, y0: number, w: number, d: number, z: number, hz: number): Solid => {
  const c = Math.cos(h), s = Math.sin(h);
  const footprint = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]].map(([x, y]) => ({ x: x! * c - y! * s, y: x! * s + y! * c }));
  return { kind: "poly", footprint, z, h: hz, mat: "steel" };
};
const rotCyl = (h: number, x: number, y: number, z: number, r: number, hz: number): Solid =>
  ({ kind: "cylinder", at: v3(x * Math.cos(h) - y * Math.sin(h), x * Math.sin(h) + y * Math.cos(h), z), r, h: hz, mat: "steel", sides: 8 });

describe("depth", () => {
  it("screenHull: a box projects a hexagon inside its screen box", () => {
    const b = { min: v3(0, 0, 0), max: v3(4, 2, 3) };
    const h = screenHull(b), sb = screenBounds(b);
    expect(h).toHaveLength(6);
    for (const p of h) {
      expect(p.x).toBeGreaterThanOrEqual(sb.minX - 1e-9); expect(p.x).toBeLessThanOrEqual(sb.maxX + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(sb.minY - 1e-9); expect(p.y).toBeLessThanOrEqual(sb.maxY + 1e-9);
    }
  });

  it("hullsOverlap: touching along an edge does not count", () => {
    const sq = (x: number) => [{ x, y: 0 }, { x: x + 1, y: 0 }, { x: x + 1, y: 1 }, { x, y: 1 }];
    expect(hullsOverlap(sq(0), sq(0.5))).toBe(true);
    expect(hullsOverlap(sq(0), sq(1))).toBe(false);
  });

  it("hides: the plaza tower hides the avenue's neon sign but not what falls in the empty corner of its screen box", () => {
    // cases measured on the world seed: neon sign on the south front of (102, 188) and plaza tower
    const neon = { min: v3(103.95, 204.45, 2.65), max: v3(107.05, 204.55, 3.95) };
    const tower = { min: v3(121, 220, 0), max: v3(137, 234, 30) };
    expect(hides(neon, tower)).toBe(true);
    const corner = { min: v3(119.5, 230.5, 32.5), max: v3(120, 231, 33) }; // west and high: northwest corner of the screen box
    expect(overlaps(screenBounds(corner), screenBounds(tower))).toBe(true);
    expect(isBehind(corner, tower)).toBe(true);
    expect(hides(corner, tower)).toBe(false);
  });

  it("hides: an overhanging roof above does not hide the window below on the south face", () => {
    const win = { min: v3(16, 169.95, 1), max: v3(21.4, 170.05, 2.6) };
    const roof = { min: v3(13, 165, 6.3), max: v3(35, 170.5, 8.32) };
    expect(isBehind(win, roof)).toBe(true);
    expect(overlaps(screenBounds(win), screenBounds(roof))).toBe(true);
    expect(hides(win, roof)).toBe(false);
  });

  it("hides: what is in front is not hidden by what is behind", () => {
    const front = { min: v3(10, 10, 0), max: v3(12, 12, 5) }, back = { min: v3(0, 0, 0), max: v3(8, 8, 20) };
    expect(hides(front, back)).toBe(false);
    expect(hides(back, front)).toBe(true);
  });

  it("screenBounds projects the 8 corners", () => {
    const sb = screenBounds(bounds(box(0, 0, 0, 2, 2, 2)));
    expect(sb).toEqual({ minX: -2, minY: -2.8, maxX: 2, maxY: 2 });
  });

  it("isBehind: separation in x, y or z", () => {
    expect(isBehind(bounds(box(0, 0, 0)), bounds(box(5, 0, 0)))).toBe(true);  // a to the west
    expect(isBehind(bounds(box(5, 0, 0)), bounds(box(0, 0, 0)))).toBe(false);
    expect(isBehind(bounds(box(0, 0, 0)), bounds(box(0, 5, 0)))).toBe(true);  // a to the north
    expect(isBehind(bounds(box(0, 0, -6)), bounds(box(0, 0, 0)))).toBe(true); // a sunken
  });

  it("sorts back to front along the diagonal", () => {
    const far = box(0, 0, 0), mid = box(3, 3, 0), near = box(6, 6, 0);
    expect(sortByDepth([near, far, mid])).toEqual([far, mid, near]);
  });

  it("a small object in front of a long hall is drawn after it", () => {
    const hall = box(0, 0, 0, 90, 16, 10);
    const car = box(40, 20, 0, 3, 4, 1.5);
    expect(sortByDepth([car, hall])).toEqual([hall, car]);
  });

  it("a small object behind a long hall is drawn before it", () => {
    const hall = box(0, 20, 0, 90, 16, 10);
    const car = box(40, 10, 0, 3, 4, 1.5);
    expect(sortByDepth([hall, car])).toEqual([car, hall]);
  });

  it("what is sunken goes before what rests on it in the same cell", () => {
    const pit = box(0, 0, -6, 10, 10, 6);
    const crate = box(2, 2, 0, 2, 2, 2);
    expect(sortByDepth([crate, pit])).toEqual([pit, crate]);
  });

  it("does not mutate the input and keeps all elements", () => {
    const input = [box(6, 6, 0), box(0, 0, 0)];
    const snapshot = [...input];
    const out = sortByDepth(input);
    expect(input).toEqual(snapshot);        // same content and order
    expect(out).not.toBe(input);            // new array
    expect(out).toHaveLength(2);
    expect(out).toEqual([input[1], input[0]]); // sorted back to front
  });
});

/** Reference: the version that compared all pairs in index order (before the x sweep). */
function sortByDepthNaive(solids: Solid[]): Solid[] {
  const n = solids.length;
  const bs = solids.map(bounds), sbs = bs.map(screenBounds);
  const keys = bs.map((b) => b.min.x + b.max.x + b.min.y + b.max.y + (b.min.z + b.max.z) * 0.5);
  const before: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!overlaps(sbs[i]!, sbs[j]!)) continue;
    const ij = isBehind(bs[i]!, bs[j]!), ji = isBehind(bs[j]!, bs[i]!);
    if (ij && ji) continue;
    if (ij === ji) { if (keys[i]! <= keys[j]!) before[j]!.push(i); else before[i]!.push(j); }
    else if (ij) before[j]!.push(i);
    else before[i]!.push(j);
  }
  const state = new Uint8Array(n), out: Solid[] = [];
  const visit = (i: number): void => { if (state[i] !== 0) return; state[i] = 1; for (const p of before[i]!) if (state[p] !== 1) visit(p); state[i] = 2; out.push(solids[i]!); };
  for (const i of solids.map((_, i) => i).sort((a, b) => keys[a]! - keys[b]!)) visit(i);
  return out;
}

describe("sortByDepth with sweep", () => {
  it("gives exactly the same order as comparing all pairs", () => {
    const rng = createRng(11);
    const solids: Solid[] = [];
    for (let i = 0; i < 400; i++) solids.push(box(rng.int(0, 200), rng.int(0, 120), rng.chance(0.1) ? -3 : 0, rng.int(1, 12), rng.int(1, 12), rng.int(1, 20)));
    expect(sortByDepth(solids)).toEqual(sortByDepthNaive(solids));
  });
});

describe("sortByDepth with hulls", () => {
  const hull: Solid = { kind: "hull", at: v3(0, 0, -1), len: 20, beam: 6, h: 5, mat: "steel", heading: 0, sheer: 1.25 };
  const deck = -1 + 5;

  it("a piece resting on a hull's deck is drawn after the hull, even in the far half", () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.3]) {
      const h: Solid = { ...hull, heading } as Solid;
      const c = Math.cos(heading), s = Math.sin(heading);
      // deckhouses on the deck at each end and on each side, in the hull's frame
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

  it("a piece that is not on the deck keeps the usual order", () => {
    const hb = bounds(hull);
    const behind = box(2, hb.min.y - 4, 0, 3, 3, 2); // north of the hull, base z 0
    const order = sortByDepth([hull, behind]);
    expect(order.indexOf(behind)).toBeLessThan(order.indexOf(hull));
  });
});

describe("sortByDepth in the ship's frame", () => {
  it("a piece resting on the far end of another rotated one is drawn after it, at any heading", () => {
    for (const h of [0.5, 0.3, 1.2, 2.3, -0.7, -2.6]) {
      const lower = rotBox(h, 0, 0, 40, 6, 0, 3);
      const upper = rotBox(h, 34, 0, 6, 6, 3, 3);
      expect(sortByDepth([upper, lower], h)).toEqual([lower, upper]);
      expect(sortByDepth([lower, upper], h)).toEqual([lower, upper]);
    }
  });

  it("three levels of house and bridge at heading 100 degrees: each piece is drawn after the one below it", () => {
    // Local measures (x, y, width, length, z, height) of a deckhouse, its bridge wing and a railing; the latter is not asserted, but without it the old order gets it right by chance.
    const specs = [[5, -2.4, 6.5, 4.8, 6.8, 1.4], [6.5, -5, 4, 10, 8.2, 1.5], [12.4, -3.5, 1, 7, 6.5, 0.3]] as const;
    const h = (100 * Math.PI) / 180;
    const pieces = specs.map(([x, y, w, d, z, hz]) => rotBox(h, x, y, w, d, z, hz));
    for (const input of [pieces, [...pieces].reverse()]) {
      const order = sortByDepth(input, h);
      expect(order.indexOf(pieces[0]!)).toBeLessThan(order.indexOf(pieces[1]!));
    }
  });

  it("with no heading or heading 0 the order is the usual one", () => {
    const rng = createRng(5);
    const solids: Solid[] = [];
    for (let i = 0; i < 60; i++) solids.push(box(rng.int(0, 60), rng.int(0, 40), rng.chance(0.1) ? -3 : 0, rng.int(1, 12), rng.int(1, 12), rng.int(1, 20)));
    expect(sortByDepth(solids, 0)).toEqual(sortByDepthNaive(solids));
    expect(sortByDepth(solids)).toEqual(sortByDepthNaive(solids));
  });
});

describe("sortByDepth with side pieces", () => {
  const ferryHull: Solid = { kind: "hull", at: v3(0, 0, -1), len: 15, beam: 4, h: 1.2, mat: "hull", topMat: "deck", heading: 0, sheer: 0.3 };
  const tugHull = (h: number): Solid => ({ kind: "hull", at: v3(0, 0, -1), len: 19, beam: 7, h: 2.2, mat: "hull", topMat: "hullBlue", heading: h, sheer: 0.3 });

  it("a side piece is drawn on the side of the hull face it hangs from, whatever its centroid says", () => {
    // ferry at heading 0: the starboard band faces the viewer, even for a fender in the far (aft) half of the hull
    const starboard = rotCyl(0, 5, 2.05, -0.2, 0.22, 0.5), port = rotCyl(0, 5, -2.05, -0.2, 0.22, 0.5);
    for (const input of [[starboard, ferryHull], [ferryHull, starboard]]) expect(sortByDepth(input, 0)).toEqual([ferryHull, starboard]);
    for (const input of [[port, ferryHull], [ferryHull, port]]) expect(sortByDepth(input, 0)).toEqual([port, ferryHull]);
    // tug stern corner at 145°: it hangs from the stern (|u| 0.91 > |w| 0.49), and the stern faces the viewer
    const h = (145 * Math.PI) / 180, hull = tugHull(h), corner = rotCyl(h, 0.9, 1.7, 1, 0.45, 0.9);
    for (const input of [[corner, hull], [hull, corner]]) expect(sortByDepth(input, h)).toEqual([hull, corner]);
  });

  it("the hull separates: what goes before the hull goes before what goes after it, even if a plane separates them", () => {
    // ferry at heading 0: cabin on the deck, starboard fender on the near band
    const cabin = rotBox(0, 3.5, -1.7, 10, 3.4, 0.2, 1.5), fender = rotCyl(0, 5, 2.05, -0.2, 0.22, 0.5);
    for (const input of [[ferryHull, cabin, fender], [fender, cabin, ferryHull], [cabin, ferryHull, fender]]) {
      expect(sortByDepth(input, 0)).toEqual([ferryHull, cabin, fender]);
    }
    // tug: a low piece inside the outline (before the hull) and a deck piece the x-plane puts behind it
    for (const h of [0, Math.PI]) {
      const hull = tugHull(h), low = rotBox(h, 10, -1, 2, 2, 0, 1), deckBox = rotBox(h, 7, -1, 2, 2, 1.2, 1.8);
      for (const input of [[hull, low, deckBox], [deckBox, low, hull], [low, hull, deckBox]]) {
        expect(sortByDepth(input, h), `heading ${h}`).toEqual([low, hull, deckBox]);
      }
    }
  });

  it("a deckhouse sunk slightly below the midship deck is drawn after the hull", () => {
    for (const deg of [0, 90, 180, 270, 145]) {
      const h = (deg * Math.PI) / 180, hull = tugHull(h), house = rotBox(h, 8.2, -2.2, 6, 4.4, 1.1, 1.7);
      for (const input of [[house, hull], [hull, house]]) expect(sortByDepth(input, h), `heading ${deg}°`).toEqual([hull, house]);
    }
    // hull at its own heading, sorted in the world frame (as the beached boats of the fair are)
    const h = Math.PI / 2, hull = tugHull(h), house = rotBox(h, 8.2, -2.2, 6, 4.4, 1.1, 1.7);
    for (const input of [[house, hull], [hull, house]]) expect(sortByDepth(input, 0)).toEqual([hull, house]);
  });

  it("with the view parallel to a frame axis, separating along that axis does not order (barge at 315°)", () => {
    const h = (315 * Math.PI) / 180;
    const hull: Solid = { kind: "hull", at: v3(0, 0, -1), len: 40, beam: 8, h: 1.2, mat: "hull", topMat: "rust", heading: h, sheer: 0 };
    const strip = rotBox(h, 0, -4, 36.4, 0.15, -0.9, 1.15); // port-side strake, far side
    const rake = [rotBox(h, 36.4, -4, 2, 8, -0.5, 0.75), rotBox(h, 38.4, -4, 1.6, 8, -0.1, 0.35)]; // bow rake, full beam
    const order = sortByDepth([hull, ...rake, strip], h);
    expect(order.indexOf(strip)).toBeLessThan(order.indexOf(hull));
  });
});

describe("beam order", () => {
  const cab: Solid = { kind: "prism", at: v3(-0.6, -0.6, 3), w: 1.2, d: 1.2, h: 1, mat: "whitewash" };
  const jib = (h: number): Solid => {
    const c = Math.cos(h), s = Math.sin(h), p = (x: number, z: number) => v3(x * c, x * s, z);
    return { kind: "beam", from: p(0.3, 4.2), to: p(4.8, 8.7), w: 0.4, h: 0.5, mat: "steel" };
  };
  it("a boom resting on a box's roof is drawn after it, in the world and in the rotated frame", () => {
    expect(sortByDepth([jib(0), cab]).indexOf(cab)).toBe(0);
    for (let k = 0; k < 72; k++) {
      const h = (k * 5 * Math.PI) / 180;
      const c = Math.cos(h), s = Math.sin(h);
      const box: Solid = { kind: "poly", footprint: [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]].map(([x, y]) => ({ x: x! * c - y! * s, y: x! * s + y! * c })), z: 3, h: 1, mat: "whitewash" };
      const j = jib(h);
      expect(sortByDepth([j, box], h).indexOf(box), `heading ${k * 5}°`).toBe(0);
    }
  });
  it("zero length does not break the order", () => {
    const z: Solid = { kind: "beam", from: v3(0, 0, 5), to: v3(0, 0, 5), w: 0.4, h: 0.4, mat: "steel" };
    expect(sortByDepth([z, cab])).toHaveLength(2);
    expect(sortByDepth([z, cab], 1.2)).toHaveLength(2);
  });
});

describe("screenHull / hullsIntersect", () => {
  const sq = (x: number, y: number): Vec2[] => [{ x, y }, { x: x + 2, y }, { x: x + 2, y: y + 2 }, { x, y: y + 2 }];
  it("SAT: the square of side 2 intersects the one shifted by 1 and not the one shifted by 3", () => {
    expect(hullsIntersect(sq(0, 0), sq(1, 1))).toBe(true);
    expect(hullsIntersect(sq(0, 0), sq(3, 0))).toBe(false);
  });
  it("a box's hexagon has 6 vertices inside its screenBounds", () => {
    const b = bounds(box(0, 0, 0)), sb = screenBounds(b), h = screenHull(b);
    expect(h).toHaveLength(6);
    for (const p of h) { expect(p.x).toBeGreaterThanOrEqual(sb.minX); expect(p.x).toBeLessThanOrEqual(sb.maxX); expect(p.y).toBeGreaterThanOrEqual(sb.minY); expect(p.y).toBeLessThanOrEqual(sb.maxY); }
  });
  it("a long diagonal box does not intersect another 35 u away even if their rectangles overlap (#83)", () => {
    const long = { min: v3(0, 0, 0), max: v3(4, 80, 13) }, far = { min: v3(40, 40, 0), max: v3(42, 42, 2) };
    expect(overlaps(screenBounds(long), screenBounds(far))).toBe(true);
    expect(hullsIntersect(screenHull(long), screenHull(far))).toBe(false);
  });
});
