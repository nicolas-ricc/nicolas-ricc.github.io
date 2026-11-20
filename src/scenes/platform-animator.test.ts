import { describe, expect, it } from "vitest";
import type { Solid } from "../iso/solids";
import { assembleWorld } from "../world/assemble";
import { platformAnimator } from "./platform-animator";
import { HEAVE, HEAVE_STEP, heaveAt, seaPlatformAt, type WritingSite } from "./sign-platform";

const built = (site: WritingSite, dz = 0) => { const solids: Solid[] = []; seaPlatformAt(solids, site, { dz, pitch: 0, roll: 0 }); return { solids }; };
/** Still (reducedMotion) and moving options: the site-change tests run still, so only the site reports. */
const STILL = { reducedMotion: true }, MOVING = { reducedMotion: false };
const BOTH = new Set(["platform.solid"]);
const solidsOf = (a: ReturnType<typeof platformAnimator>) => { const l = a.layer("platform.solid"); if (l.kind !== "solid") throw new Error(l.kind); return l.solids; };

describe("platformAnimator (#427)", () => {
  it("one layer, platform.solid (#454: the paint is a decal of the raft, not an accent); the site starts wide unless given", () => {
    expect(platformAnimator(STILL).ids).toEqual(["platform.solid"]);
    expect(() => platformAnimator(STILL).layer("platform.lights")).toThrow(/platformAnimator/);
    expect(platformAnimator(STILL).site).toBe("wide");
    expect(platformAnimator({ site: "tall", ...STILL }).site).toBe("tall");
  });

  it("the layer holds seaPlatformAt's raft at the current site", () => {
    const a = platformAnimator(STILL), { solids } = built("wide");
    expect(a.layer("platform.solid")).toEqual({ kind: "solid", solids });
    expect(solids).toHaveLength(1);
    expect(solids[0]).toMatchObject({ kind: "mesh", mat: "timber" });
  });

  it("tick reports the layer once after a site change, and nothing without one", () => {
    const a = platformAnimator(STILL);
    expect(a.tick(16)).toEqual(new Set());
    a.setSite("tall");
    expect(a.site).toBe("tall");
    expect(a.tick(16)).toEqual(BOTH);
    expect(solidsOf(a)).toEqual(built("tall").solids);
    expect(a.tick(16)).toEqual(new Set());
  });

  it("setSite with the current site marks nothing", () => {
    const a = platformAnimator({ site: "tall", ...STILL });
    a.setSite("tall");
    expect(a.tick(16)).toEqual(new Set());
  });

  it("there and back before a tick: the site did not change since the last tick, so nothing is redrawn", () => {
    const a = platformAnimator(STILL);
    a.setSite("tall");
    a.setSite("wide");
    expect(a.tick(16)).toEqual(new Set());
  });

  it("each site is built once: coming back to a site reuses its arrays", () => {
    const a = platformAnimator(STILL), first = solidsOf(a);
    a.setSite("tall"); a.tick(16);
    a.setSite("wide"); a.tick(16);
    expect(solidsOf(a)).toBe(first);
  });

  it("a site change is not motion: tick(0) and tick(NaN) still report it", () => {
    const a = platformAnimator(STILL);
    a.setSite("tall");
    expect(a.tick(0)).toEqual(BOTH);
    a.setSite("wide");
    expect(a.tick(NaN)).toEqual(BOTH);
  });

  it("an unknown layer id throws", () => {
    expect(() => platformAnimator(STILL).layer("nope")).toThrow(/platformAnimator/);
  });
});

describe("platformAnimator heaves the board (#444)", () => {
  const step = (t: number) => Math.round(heaveAt(t) / HEAVE_STEP);
  const pose = (a: ReturnType<typeof platformAnimator>) => ({ solid: a.layer("platform.solid") });
  const at = (site: WritingSite, dz: number) => ({ solid: { kind: "solid", solids: built(site, dz).solids } });

  it("before any tick the layers are the rest pose", () => {
    expect(pose(platformAnimator(MOVING))).toEqual(at("wide", 0));
  });

  it("tick(100) over a period reports the layer at least 20 times and nothing else; each report is the pose at heaveAt(t)", () => {
    const a = platformAnimator(MOVING);
    let n = 0;
    for (let t = 100; t <= HEAVE.periodMs; t += 100) {
      const r = a.tick(100);
      if (r.size === 0) continue;
      expect(r).toEqual(BOTH);
      expect(pose(a)).toEqual(at("wide", heaveAt(t)));
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });

  it("two ticks with the same quantized dz: the second reports nothing", () => {
    const a = platformAnimator(MOVING);
    let t = 0, reported = false;
    while (!reported && t < HEAVE.periodMs) { t += 100; reported = a.tick(100).size > 0; }
    expect(reported).toBe(true);
    expect(step(t + 1)).toBe(step(t)); // the precondition: 1 ms later the board is on the same step
    expect(a.tick(1)).toEqual(new Set());
  });

  it("after a whole period (67 × tick(100)) the board is back at rest: the clock wraps without drift", () => {
    const a = platformAnimator(MOVING);
    for (let i = 0; i < 67; i++) a.tick(100);
    expect(pose(a)).toEqual(at("wide", 0));
  });

  it("tick(NaN), tick(Infinity), tick(0) and tick(-5) report nothing and do not advance the clock", () => {
    const a = platformAnimator(MOVING), b = platformAnimator(MOVING);
    for (const dt of [NaN, Infinity, 0, -5]) expect(a.tick(dt)).toEqual(new Set());
    for (let i = 0; i < 67; i++) {
      expect(a.tick(100)).toEqual(b.tick(100));
      expect(pose(a)).toEqual(pose(b));
    }
  });

  it("a site change mid-swing moves the board at its current dz", () => {
    const a = platformAnimator(MOVING);
    for (let i = 0; i < 10; i++) a.tick(100);
    a.setSite("tall");
    expect(a.tick(100)).toEqual(BOTH);
    expect(pose(a)).toEqual(at("tall", heaveAt(1100)));
    expect(heaveAt(1100)).not.toBe(0);
  });

  it("a site change during a swing is reported even with tick(0) or tick(NaN)", () => {
    const a = platformAnimator(MOVING);
    for (let i = 0; i < 5; i++) a.tick(100);
    a.setSite("tall");
    expect(a.tick(0)).toEqual(BOTH);
    a.setSite("wide");
    expect(a.tick(NaN)).toEqual(BOTH);
  });

  it("with reducedMotion nothing is reported in 10 s of ticks and the layers stay at rest", () => {
    const a = platformAnimator({ site: "tall", ...STILL });
    for (let t = 0; t < 10_000; t += 16.7) expect(a.tick(16.7)).toEqual(new Set());
    expect(pose(a)).toEqual(at("tall", 0));
  });

  it("with reducedMotion a site change is reported once, with the rest pose of the new site", () => {
    const a = platformAnimator(STILL);
    for (let i = 0; i < 10; i++) a.tick(100);
    a.setSite("tall");
    expect(a.tick(100)).toEqual(BOTH);
    expect(pose(a)).toEqual(at("tall", 0));
    expect(a.tick(100)).toEqual(new Set());
  });

  it("budget: tick(16.7) over 10 simulated seconds reports at most 120 times (≤ 12 per second)", () => {
    const a = platformAnimator(MOVING);
    let n = 0;
    for (let t = 0; t < 10_000; t += 16.7) if (a.tick(16.7).size > 0) n++;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(120);
  });

  it("each pose is built once: the same (site, dz) reuses its arrays", () => {
    const a = platformAnimator(MOVING), first = solidsOf(a);
    for (let i = 0; i < 67; i++) a.tick(100);
    expect(solidsOf(a)).toBe(first);
  });
});

describe("assembleWorld passes reducedMotion to the platform (#444)", () => {
  it("with reducedMotion the world's platform reports nothing in 10 s of ticks", () => {
    const { platform } = assembleWorld(undefined, { reducedMotion: true });
    if (!platform) throw new Error("no platform");
    for (let t = 0; t < 10_000; t += 16.7) expect(platform.tick(16.7)).toEqual(new Set());
  });

  it("without it, the world's platform heaves", () => {
    const { platform } = assembleWorld(undefined, { reducedMotion: false });
    if (!platform) throw new Error("no platform");
    let n = 0;
    for (let i = 0; i < 67; i++) if (platform.tick(100).size > 0) n++;
    expect(n).toBeGreaterThanOrEqual(20);
  });
});
