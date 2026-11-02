import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { PLANT_SHIFT, emitPlant } from "./plant-frame";

const post: Solid = { kind: "prism", at: { x: 20, y: -14, z: 0 }, w: 0.6, d: 0.6, h: 5, mat: "steel" };
const light: Accent = { kind: "dot", at: { x: 20.3, y: -13.7, z: 5 }, r: 1.2, color: "cyan" };

describe("emitPlant", () => {
  it("pushes solids and accents moved by PLANT_SHIFT exactly once, in order, without touching z", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    emitPlant(out, (o, a) => { o.push(post, post); a.push(light); }, accents);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ at: { x: 20 + PLANT_SHIFT.x, y: -14 + PLANT_SHIFT.y, z: 0 } });
    expect(accents).toHaveLength(1);
    expect(accents[0]!.kind === "dot" && accents[0]!.at.z).toBe(5);
    expect(post.kind === "prism" && post.at.x).toBe(20); // does not mutate what was built in local
  });

  it("with no destination for accents, throws if the piece emits any (does not lose them silently)", () => {
    expect(() => emitPlant([], (_o, a) => { a.push(light); })).toThrow("accents without a destination");
    expect(() => emitPlant([], (o) => { o.push(post); })).not.toThrow();
  });
});
