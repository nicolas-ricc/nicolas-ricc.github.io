import { describe, expect, it } from "vitest";
import type { Solid } from "../iso/solids";
import { assembleWorld } from "../world/assemble";
import { platformAnimator } from "./platform-animator";
import { POSE_CYCLE_MS, REST_POSE, poseAt, seaPlatformAt, type RaftPose, type WritingSite } from "./sign-platform";

const built = (site: WritingSite, pose: RaftPose = REST_POSE) => { const solids: Solid[] = []; seaPlatformAt(solids, site, pose); return { solids }; };
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

describe("platformAnimator heaves, pitches and rolls the raft (#444, #456)", () => {
  const same = (a: RaftPose, b: RaftPose) => a.dz === b.dz && a.pitch === b.pitch && a.roll === b.roll;
  const pose = (a: ReturnType<typeof platformAnimator>) => ({ solid: a.layer("platform.solid") });
  const at = (site: WritingSite, p: RaftPose) => ({ solid: { kind: "solid", solids: built(site, p).solids } });

  it("before any tick the layer is the rest pose", () => {
    expect(pose(platformAnimator(MOVING))).toEqual(at("wide", REST_POSE));
  });

  it("tick(100) over 30 s reports the layer exactly when poseAt(clock) changes, and the layer is seaPlatformAt at poseAt(clock)", () => {
    const a = platformAnimator(MOVING);
    let n = 0, prev = poseAt(0), last: readonly unknown[] = solidsOf(a);
    for (let i = 1; i <= 300; i++) {
      const t = i * 100, now = poseAt(t), r = a.tick(100);
      expect(r.size > 0, `${t}`).toBe(!same(now, prev));
      // a deep compare of the ~1000-face mesh costs ~20 ms: every 10th report is compared in full, the others must be a new array
      if (r.size > 0) { expect(r).toEqual(BOTH); if (n % 10 === 0) expect(pose(a), `${t}`).toEqual(at("wide", now)); else { const m = solidsOf(a)[0], want = built("wide", now).solids[0]; expect(m).not.toBe(last[0]); if (m?.kind !== "mesh" || want?.kind !== "mesh") throw new Error("raft"); expect([m.faces[0], m.faces.at(-1)], `${t}`).toEqual([want.faces[0], want.faces.at(-1)]); } n++; }
      last = solidsOf(a);
      prev = now;
    }
    expect(n).toBeGreaterThanOrEqual(100);
  });

  it("two consecutive ticks on the same quantized pose: the second reports nothing and reuses the array", () => {
    const a = platformAnimator(MOVING);
    let t = 0;
    for (;;) {
      t += 100;
      const reported = a.tick(100).size > 0;
      if (reported && same(poseAt(t + 1), poseAt(t))) break;
      expect(t).toBeLessThan(30_000);
    }
    const first = solidsOf(a);
    expect(a.tick(1)).toEqual(new Set());
    expect(solidsOf(a)).toBe(first);
  });

  it("after ten ticks of 100 ms, tick(POSE_CYCLE_MS) leaves the same pose and reports nothing: the clock wraps without drift", () => {
    const a = platformAnimator(MOVING);
    for (let i = 0; i < 10; i++) a.tick(100);
    const before = pose(a);
    expect(a.tick(POSE_CYCLE_MS)).toEqual(new Set());
    expect(pose(a)).toEqual(before);
    expect(pose(a)).toEqual(at("wide", poseAt(1000)));
  });

  it("tick(NaN), tick(Infinity), tick(0) and tick(-5) report nothing and do not advance the clock", () => {
    const a = platformAnimator(MOVING), b = platformAnimator(MOVING);
    for (const dt of [NaN, Infinity, 0, -5]) expect(a.tick(dt)).toEqual(new Set());
    for (let i = 0; i < 300; i++) {
      expect(a.tick(100)).toEqual(b.tick(100));
      if (i % 30 === 0) expect(pose(a)).toEqual(pose(b)); // a full mesh compare is ~20 ms: sampled
    }
  });

  it("a site change mid-swing moves the raft at its current pose", () => {
    const a = platformAnimator(MOVING);
    for (let i = 0; i < 10; i++) a.tick(100);
    a.setSite("tall");
    expect(a.tick(100)).toEqual(BOTH);
    expect(pose(a)).toEqual(at("tall", poseAt(1100)));
    expect(same(poseAt(1100), REST_POSE)).toBe(false);
  });

  it("a site change during a swing is reported even with tick(0) or tick(NaN)", () => {
    const a = platformAnimator(MOVING);
    for (let i = 0; i < 5; i++) a.tick(100);
    a.setSite("tall");
    expect(a.tick(0)).toEqual(BOTH);
    a.setSite("wide");
    expect(a.tick(NaN)).toEqual(BOTH);
  });

  it("with reducedMotion nothing is reported in 10 s of ticks and the layer stays at rest", () => {
    const a = platformAnimator({ site: "tall", ...STILL });
    for (let t = 0; t < 10_000; t += 16.7) expect(a.tick(16.7)).toEqual(new Set());
    expect(pose(a)).toEqual(at("tall", REST_POSE));
  });

  it("with reducedMotion a site change is reported once, with the rest pose of the new site", () => {
    const a = platformAnimator(STILL);
    for (let i = 0; i < 10; i++) a.tick(100);
    a.setSite("tall");
    expect(a.tick(100)).toEqual(BOTH);
    expect(pose(a)).toEqual(at("tall", REST_POSE));
    expect(a.tick(100)).toEqual(new Set());
  });

  it("budget: tick(16.7) over 10 simulated seconds reports at most 250 times (≤ 25 per second)", () => {
    const a = platformAnimator(MOVING);
    let n = 0;
    for (let t = 0; t < 10_000; t += 16.7) if (a.tick(16.7).size > 0) n++;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(250);
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
