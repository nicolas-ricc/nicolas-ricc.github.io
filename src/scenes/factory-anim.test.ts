import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { createRng } from "../map/seed";
import { PUFFS, PUFF_R1, PUFF_RANGE, createFactoryAnim } from "./factory-anim";

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

describe("smoke tick chunking", () => {
  const run = (chunks: number[]) => {
    const a = createFactoryAnim(stacks, createRng(1), { reducedMotion: false });
    for (const dt of chunks) a.tick(dt);
    return a;
  };
  /** `pattern` repeated, closed with the remainder so the chunks add up to exactly `total`. */
  const chop = (total: number, pattern: number[]) => {
    const out: number[] = [];
    let left = total;
    for (let i = 0; left > 0; i++) { const dt = Math.min(pattern[i % pattern.length]!, left); out.push(dt); left -= dt; }
    return out;
  };
  const expectSamePuffs = (a: ReturnType<typeof run>, b: ReturnType<typeof run>) => {
    for (const k of [0, 1]) {
      const pa = a.puffs(k), pb = b.puffs(k);
      expect(pa).toHaveLength(pb.length);
      pa.forEach((s, i) => {
        const t = pb[i]!;
        if (s.kind !== "cylinder" || t.kind !== "cylinder") throw new Error("expected cylinders");
        expect(s.at.x).toBeCloseTo(t.at.x, 6);
        expect(s.at.y).toBeCloseTo(t.at.y, 6);
        expect(s.at.z).toBeCloseTo(t.at.z, 6);
        expect(s.r).toBeCloseTo(t.r, 6);
      });
    }
  };

  it("one 60 s tick leaves the puffs where 600 × 100 ms and an irregular chunking do", () => {
    const one = run([60000]);
    expectSamePuffs(one, run(Array<number>(600).fill(100)));
    expectSamePuffs(one, run(chop(60000, [16, 33, 100, 250, 1000, 5000, 7000, 33])));
  });

  it("no puff goes past PUFF_RANGE, even after one 600 s tick", () => {
    // r grows linearly with dist and reaches PUFF_R1 at PUFF_RANGE
    for (const T of [60000, 600000]) {
      const a = run([T]);
      for (const k of [0, 1]) for (const s of a.puffs(k)) expect(s.kind === "cylinder" && s.r).toBeLessThan(PUFF_R1);
    }
  });

  it("tick(NaN) and tick(Infinity) change nothing", { timeout: 2000 }, () => {
    const a = run([1234]);
    const snap = () => JSON.stringify([a.puffs(0), a.puffs(1), a.angle()]);
    const before = snap();
    expect(a.tick(NaN)).toEqual({ smoke: false, wheel: false });
    expect(a.tick(Infinity)).toEqual({ smoke: false, wheel: false });
    expect(snap()).toBe(before);
    expect(a.tick(100).smoke).toBe(true);
  });
});
