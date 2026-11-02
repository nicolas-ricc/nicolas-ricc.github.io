import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { towerCrane } from "./pieces";

describe("towerCrane", () => {
  it("mast of the requested height, jib toward the requested side, hanging hook and light at the tip", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    towerCrane(out, accents, { at: { x: 100, y: 50 }, mastH: 20, jibLen: 30, dir: "e", light: "cyan" });
    const mast = out.find((s) => s.kind === "prism" && s.h === 20)!;
    expect(mast).toBeDefined();
    expect(bounds(mast).max.x - bounds(mast).min.x).toBeLessThanOrEqual(3); // slender
    const jib = out.find((s) => s.kind === "prism" && s.w === 30)!;
    expect(bounds(jib).min.x).toBeCloseTo(100, 6);
    expect(bounds(jib).max.x).toBeCloseTo(130, 6);
    expect(bounds(jib).min.z).toBeGreaterThan(18);
    const hook = out.find((s) => s.kind === "prism" && s.mat === "rust")!;
    expect(bounds(hook).min.x).toBeGreaterThan(110); expect(bounds(hook).max.x).toBeLessThan(120);
    expect(bounds(hook).min.z).toBeGreaterThan(5);
    expect(accents).toEqual([{ kind: "dot", at: { x: 130, y: 50, z: 19.4 }, r: 1, color: "cyan" }]);
    for (const s of out) expect(["steel", "rust"]).toContain(s.mat);
  });
  it("with dir w the jib goes west and respects z", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    towerCrane(out, accents, { at: { x: 0, y: 0 }, z: 0.3, mastH: 22, jibLen: 20, dir: "w", light: "amber" });
    const jib = out.find((s) => s.kind === "prism" && s.w === 20)!;
    expect(bounds(jib).min.x).toBeCloseTo(-20, 6);
    expect(bounds(out.find((s) => s.kind === "prism" && s.h === 22)!).min.z).toBe(0.3);
    expect(accents[0]!.kind === "dot" && accents[0]!.at.x).toBe(-20);
  });
});
