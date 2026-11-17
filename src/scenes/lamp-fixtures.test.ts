import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { industrialLamp, lamp, place } from "../kit/props";
import { prism } from "./city-pieces";
import { unpairedLampParts } from "./lamp-fixtures";

describe("unpairedLampParts", () => {
  it("pairs industrialLamp (default and center, h 6) and lamp()", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    place(out, accents, industrialLamp(v3(10, 20, 0)));
    place(out, accents, industrialLamp(v3(5, 5, 0.15), { h: 6, center: true }));
    place(out, accents, lamp(v3(0, 0, 0)));
    expect(unpairedLampParts(out, accents)).toEqual([]);
  });

  it("flags a post without its bulb and a bulb without its post", () => {
    const lit = industrialLamp(v3(10, 20, 0));
    expect(unpairedLampParts(lit.solids, [])).toEqual(["post at 10,20,0 h 5"]);
    expect(unpairedLampParts([], lit.accents)).toEqual(["bulb at 10.3,20.3,5"]);
  });

  it("a steel 0.6 × 0.6 prism of another height is not a lamp post", () => {
    expect(unpairedLampParts([prism(0, 0, 0, 0.6, 0.6, 3, "steel")], [])).toEqual([]);
  });
});
