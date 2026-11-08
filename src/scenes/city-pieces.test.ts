import { describe, expect, it } from "vitest";
import { fingerprint } from "../iso/fingerprint";
import type { Solid, Tri } from "../iso/solids";
import { recipe } from "../kit/index";
import { STYLES } from "../kit/styles";
import { createRng } from "../map/seed";
import type { Rect } from "./city-grid";
import { brokenTone, plazaTone, prism, tiles } from "./city-pieces";

describe("prism", () => {
  it("copies roofMat only if present (#249)", () => {
    expect(prism(0, 0, 0, 5, 4, 3, "whitewash", { roof: "gable", roofMat: "tile" }).roofMat).toBe("tile");
    expect("roofMat" in prism(0, 0, 0, 5, 4, 3, "whitewash", { roof: "gable" })).toBe(false);
  });
});

const tris = (s: Solid): Tri[] => (s.kind === "ground" ? s.tris : []);
/** Plan box of each tile: its two triangles are pushed together. */
function tileBoxes(s: Solid): Rect[] {
  const t = tris(s), out: Rect[] = [];
  for (let i = 0; i < t.length; i += 2) {
    const pts = [...t[i]!.pts, ...t[i + 1]!.pts], xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    out.push({ x, y, w: Math.max(...xs) - x, d: Math.max(...ys) - y });
  }
  return out;
}

describe("tiles", () => {
  // recorded on main (3c486ea), before #143
  it("with size omitted, the output is the one before #143", () => {
    const h = (v: unknown): string => fingerprint(v as Solid[]);
    expect(h(tiles(createRng(1), { x: 6.5, y: 6.5, w: 11, d: 5 }, 0.05, "paving"))).toBe("304b66d6");
    expect(h(tiles(createRng(2), { x: 0, y: 0, w: 24, d: 18 }, 0.05, "leafDark"))).toBe("dd78d6ad");
    expect(h(tiles(createRng(3), { x: 1.5, y: 2.5, w: 13, d: 7.5 }, 0.05, "plaza", plazaTone))).toBe("a21d17ed");
    const lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s" as const], maxH: 24 };
    const grounds = (name: string): string[] => [1, 2, 3].map((s) => h(recipe(name)(lot, createRng(s), STYLES.residential).ground));
    expect(grounds("library")).toEqual(["2053011d", "fd61cf5f", "b2745486"]);
    expect(grounds("campus")).toEqual(["04266b6f", "47b393f7", "dd5fbddb"]);
    expect(grounds("eatenRuin")).toEqual(["b5875f00", "c3e34368", "9277cefc"]);
  });

  it("size = 2 on an 11×5 rect gives 6×3 tiles clipped to the rect", () => {
    const r = { x: 6.5, y: 6.5, w: 11, d: 5 }, g = tiles(createRng(1), r, 0.05, "paving", brokenTone, 2);
    expect(tris(g)).toHaveLength(36);
    expect(tris(g).every((t) => t.pts.every((p) => p.z === 0.05))).toBe(true);
    const boxes = tileBoxes(g);
    expect(new Set(boxes.map((b) => `${b.x},${b.y}`)).size).toBe(18);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(r.x - 1e-9);
      expect(b.y).toBeGreaterThanOrEqual(r.y - 1e-9);
      expect(b.x + b.w).toBeLessThanOrEqual(r.x + r.w + 1e-9);
      expect(b.y + b.d).toBeLessThanOrEqual(r.y + r.d + 1e-9);
      expect(Math.max(b.w, b.d)).toBeLessThanOrEqual(2);
    }
    expect(boxes.reduce((a, b) => a + b.w * b.d, 0)).toBeCloseTo(55, 9);
    expect([...new Set(boxes.map((b) => b.w))].sort()).toEqual([1, 2]);
    expect([...new Set(boxes.map((b) => b.d))].sort()).toEqual([1, 2]);
  });

  it("a size larger than the rect gives one tile, clipped", () => {
    for (const size of [2, Infinity]) {
      const t = tris(tiles(createRng(1), { x: 0, y: 0, w: 1, d: 1 }, 0, "paving", brokenTone, size));
      expect(t).toHaveLength(2);
      expect(t.every((tri) => tri.pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))).toBe(true);
    }
  });

  it("a non-positive size throws", () => {
    for (const size of [0, -1, NaN]) expect(() => tiles(createRng(1), { x: 0, y: 0, w: 4, d: 4 }, 0, "paving", brokenTone, size)).toThrow(RangeError);
  });
});
