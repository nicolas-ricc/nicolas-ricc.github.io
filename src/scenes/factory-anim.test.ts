import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { createRng } from "../map/seed";
import { PUFFS, PUFF_RANGE, createFactoryAnim } from "./factory-anim";

const stacks = [v3(130, -40, 25), v3(140, -34, 29)];

describe("smoke", () => {
  it("frame 0: five staggered puffs per chimney, gray cylinders that grow with distance", () => {
    const a = createFactoryAnim(stacks, createRng(1), { reducedMotion: false });
    const p = a.puffs(0);
    expect(p).toHaveLength(PUFFS);
    const rs = p.map((s) => (s.kind === "cylinder" ? s.r : 0));
    for (let i = 1; i < rs.length; i++) expect(rs[i]!).toBeGreaterThan(rs[i - 1]!);
    expect(p.every((s) => s.kind === "cylinder" && s.mat === "concrete" && s.at.z >= 25)).toBe(true);
    expect(p[0]!.kind === "cylinder" && p[0]!.at).toEqual(stacks[0]);
  });

  it("drifts NNE without getting more than PUFF_RANGE + 2 from the mouth, and is recycled", () => {
    const a = createFactoryAnim(stacks, createRng(1), { reducedMotion: false });
    for (let t = 0; t < 40000; t += 33) {
      expect(a.tick(33).smoke).toBe(true);
      for (const k of [0, 1]) for (const s of a.puffs(k)) {
        if (s.kind !== "cylinder") continue;
        const dx = s.at.x - stacks[k]!.x, dy = s.at.y - stacks[k]!.y;
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(PUFF_RANGE + 2);
        expect(dy).toBeLessThanOrEqual(0.5); // never to the south
        expect(s.at.z).toBeGreaterThanOrEqual(stacks[k]!.z);
      }
    }
  });

  it("with reduced-motion nothing changes", () => {
    const a = createFactoryAnim(stacks, createRng(1), { reducedMotion: true });
    const before = JSON.stringify(a.puffs(0));
    expect(a.tick(500)).toEqual({ smoke: false, wheel: false });
    expect(JSON.stringify(a.puffs(0))).toBe(before);
  });
});
