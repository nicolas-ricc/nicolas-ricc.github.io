import { describe, expect, it } from "vitest";
import { lightBox, WINDOW_ALPHA } from "../city/lights";
import type { Accent } from "../iso/accent";
import { hides, overlaps, screenBounds } from "../iso/depth";
import { bounds } from "../iso/solids";
import { createRng } from "../map/seed";
import { portfolioWindows, windowCandidates } from "./portfolio-lights";
import { world } from "./world";

const w = world(7);
const sy = w.shipyard!;
const cands = windowCandidates(sy.solids);
const visible = cands.filter((c) => !c.hidden);
const lit = sy.accents.filter((a): a is Extract<Accent, { kind: "poly" }> => a.kind === "poly" && a.color === "windowCool");
const same = (a: { x: number; y: number; z: number }[], b: { x: number; y: number; z: number }[]) => a.length === b.length && a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y && p.z === b[i]!.z);

describe("Portfolio windowCool windows", () => {
  it("candidates: south walls of the halls, east and south of the workshops, east of the sheds", () => {
    expect(cands).toHaveLength(2 * 12 + 2 * (5 + 5) + 2 * 10);
    expect(new Set(cands.map((c) => c.owner)).size).toBe(6);
    for (const c of cands) expect(c.pts).toHaveLength(4);
    const sheds = cands.filter((c) => c.owner.kind === "prism" && c.owner.at.x >= 300);
    expect(sheds).toHaveLength(20);
    for (const c of sheds) for (const p of c.pts) expect(p.x).toBeCloseTo(bounds(c.owner).max.x, 9); // only their east wall
    expect(visible.length).toBeGreaterThanOrEqual(20);
  });

  it("25..35 % of the visible candidates are lit, all windowCool polys with WINDOW_ALPHA", () => {
    expect(lit).toHaveLength(Math.round(0.3 * visible.length));
    expect(lit.length / visible.length).toBeGreaterThanOrEqual(0.25);
    expect(lit.length / visible.length).toBeLessThanOrEqual(0.35);
    for (const a of lit) {
      expect(a.alpha).toBe(WINDOW_ALPHA);
      expect(visible.some((c) => same(c.pts, a.pts))).toBe(true);
    }
  });

  it("no lit window is hidden by another raised shipyard solid", () => {
    for (const a of lit) {
      const owner = cands.find((c) => same(c.pts, a.pts))!.owner;
      const box = lightBox(a.pts), sb = screenBounds(box);
      for (const s of sy.solids) {
        if (s === owner) continue;
        const b = bounds(s);
        expect(overlaps(sb, screenBounds(b)) && hides(box, b), JSON.stringify(b)).toBe(false);
      }
    }
  });

  it("deterministic by seed", () => {
    const a = JSON.stringify(portfolioWindows(sy.solids, createRng(5)));
    expect(JSON.stringify(portfolioWindows(sy.solids, createRng(5)))).toBe(a);
    expect(JSON.stringify(portfolioWindows(sy.solids, createRng(6)))).not.toBe(a);
  });
});
