import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { depthAt } from "./depth-map";
import type { Accent } from "../iso/accent";
import { hullsIntersect, isBehind, overlaps, screenBounds, screenHull } from "../iso/depth";
import { convexHull, polyline, v3, type Vec2 } from "../iso/geometry";
import { project } from "../iso/project";
import { bounds, hullRings, isFlat, type Bounds, type Solid } from "../iso/solids";
import { WORLD, inCoverQuad, worldZoneAt } from "../map/geo";
import { BEAM_INNER, BEAM_LEN, BEAM_PERIOD_MS, CYCLE_MS, FADE_U, FERRY_PAUSE_MS, FERRY_ROUTE, FERRY_SPEED, KEEPER_SIGN_MS, LANE_BACK, LANE_OUT, LANE_SPEED, NEON_STEP_MS, OFF_MS, PORT_MS, SHIPS, alphaAt, createSeaAnim, laneAt, laneLength } from "./sea-anim";
import { SHIP_SPECS, ship, shipAt } from "./ships";
import { bleedTerrainAt, terrainAt } from "./terrain";
import { world } from "./world";

const WATER = new Set(["water", "sea", "shore", "abyss"]);
type Static = { b: Bounds; sb: ReturnType<typeof screenBounds>; sh: Vec2[] };
const staticsOf = (solids: Solid[]): Static[] => solids.map((s) => { const b = bounds(s); return { b, sb: screenBounds(b), sh: screenHull(b) }; });
/** Alignment box of the freighter centered at `p` (z −1..13) and a check that no static solid overlapping it on screen covers it. */
const expectNotBehind = (statics: Static[], p: { x: number; y: number }, heading: number): void => {
  const parts = ship("cargo", shipAt("cargo", p, heading), heading).solids.map(bounds);
  const sb: Bounds = { min: v3(Math.min(...parts.map((b) => b.min.x)), Math.min(...parts.map((b) => b.min.y)), -1), max: v3(Math.max(...parts.map((b) => b.max.x)), Math.max(...parts.map((b) => b.max.y)), 13) };
  const scr = screenBounds(sb), sh = screenHull(sb);
  for (const s of statics) if (overlaps(scr, s.sb) && hullsIntersect(sh, s.sh)) expect(isBehind(sb, s.b)).toBe(false);
};
const setup = (reducedMotion = false) => { const w = world(7); return { w, a: createSeaAnim(w.sea!, { reducedMotion }) }; };

describe("route", () => {
  it("LANE_OUT starts at the harbor mouth (362, −16), inside the cover, and ends outside; water, depth ≥ 6, Blog for x ≥ 380; the sea fade falls in the bleed", () => {
    expect(LANE_OUT[0]).toEqual({ x: 362, y: -16 });
    expect(inCoverQuad(362, -16)).toBe(true);
    const end = LANE_OUT[LANE_OUT.length - 1]!;
    expect(inCoverQuad(end.x, end.y)).toBe(false);
    const L = laneLength("out");
    expect(Math.abs(L - 687.9)).toBeLessThan(5); // slack to move vertices up to 2 u
    for (let d = 0; d <= L; d += 1) {
      const p = laneAt("out", d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
      expect(inCoverQuad(p.x, p.y)).toBe(L - d > FADE_U); // at full alpha always in view; the sea fade, never
    }
    expect(laneAt("out", 0).heading).toBeCloseTo(Math.atan2(56, 36), 6); // leaves the harbor mouth toward the south-southeast
  });

  it("no point of the lane ends up behind a static solid that overlaps it on screen", () => {
    const statics = staticsOf(world(7).solids);
    for (let d = 0; d <= laneLength("out"); d += 4) {
      const p = laneAt("out", d);
      expectNotBehind(statics, p, p.heading);
    }
  });

  it("the ship is drawn centered on the lane: the hull starts at shipAt(kind, laneAt(lane, d))", () => {
    const { a } = setup();
    for (const k of [0, 1, 2]) {
      const s = a.state(k);
      if (s.lane !== "out" && s.lane !== "back") throw new Error(`ship ${k} outside the lanes at frame 0: ${s.lane}`);
      const p = laneAt(s.lane, s.dist), at = shipAt(SHIPS[k]!.kind, p, s.heading);
      const hull = a.ship(k).solids.find((s) => s.kind === "hull")!;
      expect(hull.kind === "hull" && hull.at.x).toBeCloseTo(at.x, 6);
      expect(hull.kind === "hull" && hull.at.y).toBeCloseTo(at.y, 6);
    }
  });
});

const inWorld = (x: number, y: number) => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1;

/** Convex on-screen silhouette of a freighter centered at `p`: deck ring projected at z −1 and z 13. */
const silhouette = (p: { x: number; y: number }, heading: number): Vec2[] => {
  const hull = ship("cargo", shipAt("cargo", p, heading), heading).solids.find((s) => s.kind === "hull")!;
  if (hull.kind !== "hull") throw new Error("no hull");
  return convexHull(hullRings(hull).deck.flatMap((q) => [project(v3(q.x, q.y, -1)), project(v3(q.x, q.y, 13))]));
};

describe("two lanes", () => {
  it("LANE_BACK starts outside the cover and ends at the harbor mouth (397, −39); water, depth ≥ 6, Blog for x ≥ 380; the sea fade falls in the bleed", () => {
    expect(LANE_BACK[0]).toEqual({ x: 424, y: 600 });
    expect(inCoverQuad(424, 600)).toBe(false);
    expect(LANE_BACK[LANE_BACK.length - 1]).toEqual({ x: 397, y: -39 });
    expect(inCoverQuad(397, -39)).toBe(true);
    const L = laneLength("back");
    expect(Math.abs(L - 664.9)).toBeLessThan(5); // slack to move vertices up to 2 u
    for (let d = 0; d <= L; d += 1) {
      const p = laneAt("back", d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
      expect(inCoverQuad(p.x, p.y)).toBe(d > FADE_U);
    }
  });

  it("no point of LANE_BACK ends up behind a static solid that overlaps it on screen", () => {
    const statics = staticsOf(world(7).solids);
    for (let d = 0; d <= laneLength("back"); d += 4) {
      const p = laneAt("back", d);
      expectNotBehind(statics, p, p.heading);
    }
  });

  it("separation: two freighters, one in each lane, never touch on screen", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    const backs = [] as Vec2[][];
    for (let d = 0; d <= Lb; d += 4) { const p = laneAt("back", d); backs.push(silhouette(p, p.heading)); }
    for (let d = 0; d <= Lo; d += 4) {
      const p = laneAt("out", d), s = silhouette(p, p.heading);
      for (const b of backs) expect(hullsIntersect(s, b)).toBe(false);
    }
  });

  it("the launch passes more than 20 u from both lanes", () => {
    const ferry = polyline(FERRY_ROUTE);
    for (const lane of ["out", "back"] as const) for (let d = 0; d <= laneLength(lane); d += 2) {
      const p = laneAt(lane, d);
      for (let f = 0; f <= ferry.length; f += 2) { const q = ferry.at(f); expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(20); }
    }
  });

  it("laneAt('back') interpolates the heading at the vertices and at the end arrives with the heading of the last leg", () => {
    const Lb = laneLength("back"), last = Math.atan2(-39 - 18, 397 - 434);
    expect(laneAt("back", Lb).heading).toBeCloseTo(last, 6);
    expect(laneAt("back", 0).heading).toBeCloseTo(Math.atan2(237 - 600, 462 - 424), 6);
  });

  it("coverage: over 2·T, always one in out and one in back (and one at full alpha in each), each ship goes out → offscreen → back → offscreen in order, and two in the same lane are ≥ 100 u apart", () => {
    const { a } = setup();
    const ORDER = ["out", "offscreen", "back", "offscreen"] as const;
    const step = [0, 1, 2].map((k) => ORDER.indexOf(a.state(k).lane as (typeof ORDER)[number])), seen: string[][] = [[], [], []];
    for (let t = 0; t < 2 * CYCLE_MS; t += 997) {
      a.tick(997);
      const ss = [0, 1, 2].map((k) => a.state(k));
      expect(ss.some((s) => s.lane === "out")).toBe(true);
      expect(ss.some((s) => s.lane === "back")).toBe(true);
      expect(ss.some((s) => s.lane === "out" && alphaAt("out", s.dist) === 1)).toBe(true);
      expect(ss.some((s) => s.lane === "back" && alphaAt("back", s.dist) === 1)).toBe(true);
      ss.forEach((s, k) => {
        if (s.lane !== ORDER[step[k]!]) { step[k] = (step[k]! + 1) % 4; expect(s.lane).toBe(ORDER[step[k]!]); seen[k]!.push(`${step[k]}`); }
      });
      for (const lane of ["out", "back"] as const) {
        const ds = ss.filter((s) => s.lane === lane).map((s) => s.dist);
        if (ds.length === 2) expect(Math.abs(ds[0]! - ds[1]!)).toBeGreaterThanOrEqual(100);
      }
    }
    for (const k of [0, 1, 2]) for (const i of [0, 1, 2, 3]) expect(seen[k]).toContain(`${i}`);
  });

  it("entering port: at the end of the return it spends PORT_MS off camera and reappears at the harbor mouth, faded", () => {
    const { a } = setup();
    const Lo = laneLength("out"), Lb = laneLength("back");
    a.tick(((Lo + Lb) / LANE_SPEED) * 1000 + OFF_MS + 1); // ship 0 just arrived at the harbor mouth
    expect(a.state(0)).toMatchObject({ lane: "offscreen", dist: Lb });
    expect(a.ship(0)).toEqual({ solids: [], lights: [], wake: [], alpha: 0 });
    a.tick(PORT_MS - 2);
    expect(a.state(0).lane).toBe("offscreen");
    a.tick(2);
    expect(a.state(0).lane).toBe("out");
    expect(a.state(0).dist).toBeLessThan(0.01);
    expect(a.state(0).heading).toBeCloseTo(Math.atan2(56, 36), 6); // heading of the first leg of LANE_OUT
    expect(a.ship(0).alpha).toBeLessThan(0.01);
  });

  it("a large dt crosses the return leg and PORT_MS at once: lands 6 u into the next outbound leg", () => {
    const { a } = setup();
    const Lo = laneLength("out"), Lb = laneLength("back");
    a.tick((Lo / LANE_SPEED) * 1000 + OFF_MS);
    a.tick((Lb / LANE_SPEED) * 1000 + PORT_MS + 5000);
    expect(a.state(0).lane).toBe("out");
    expect(a.state(0).dist).toBeCloseTo(5 * LANE_SPEED, 6);
  });
});

describe("ships", () => {
  it("three ships at the same speed, each starts at phase k·T/3 of its cycle; after CYCLE_MS all return to their state", () => {
    const { a } = setup();
    expect(LANE_SPEED).toBe(1.2);
    expect(SHIPS.map((s) => s.kind)).toEqual(["cargo", "tug", "barge"]);
    expect(SHIPS.map((s) => s.phase)).toEqual([0, 1 / 3, 2 / 3]);
    const Lo = laneLength("out"), Lb = laneLength("back");
    expect(CYCLE_MS).toBeCloseTo(((Lo + Lb) / LANE_SPEED) * 1000 + OFF_MS + PORT_MS, 6);
    const s0 = [0, 1, 2].map((k) => a.state(k));
    expect(s0[0]).toMatchObject({ lane: "out", dist: 0 }); // setting sail from the harbor mouth
    expect(s0[1]!.lane).toBe("out"); expect(s0[1]!.dist).toBeGreaterThan(Lo / 2); // far along the outbound leg
    expect(s0[2]!.lane).toBe("back"); expect(s0[2]!.dist).toBeGreaterThan(Lb / 4); expect(s0[2]!.dist).toBeLessThan((3 * Lb) / 4); // halfway through the return
    a.tick(CYCLE_MS);
    for (const k of [0, 1, 2]) { const s = a.state(k); expect(s.lane).toBe(s0[k]!.lane); expect(s.dist).toBeCloseTo(s0[k]!.dist, 6); }
  });

  it("alpha: 0 at both ends of each lane, 1 at FADE_U from them; offscreen 0", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    expect(alphaAt("out", 0)).toBe(0);
    expect(alphaAt("out", FADE_U / 2)).toBeCloseTo(0.5, 6);
    expect(alphaAt("out", FADE_U)).toBe(1);
    expect(alphaAt("out", Lo / 2)).toBe(1);
    expect(alphaAt("out", Lo - FADE_U)).toBe(1);
    expect(alphaAt("out", Lo)).toBe(0);
    expect(alphaAt("back", 0)).toBe(0);
    expect(alphaAt("back", FADE_U)).toBe(1);
    expect(alphaAt("back", Lb - FADE_U)).toBe(1);
    expect(alphaAt("back", Lb)).toBe(0);
    expect(alphaAt("offscreen", Lo)).toBe(0);
  });

  it("offscreen: the frame has no solids, lights or wake and its alpha is 0", () => {
    const { a } = setup();
    a.tick((laneLength("out") / LANE_SPEED) * 1000 + OFF_MS / 2); // ship 0 halfway through offscreen
    expect(a.state(0)).toMatchObject({ lane: "offscreen", dist: laneLength("out") });
    expect(a.ship(0)).toEqual({ solids: [], lights: [], wake: [], alpha: 0 });
  });

  it("a large dt crosses states and consumes the remainder: from the end of the outbound leg, OFF_MS + 5 s later it is 6 u along the return", () => {
    const { a } = setup();
    a.tick((laneLength("out") / LANE_SPEED) * 1000);
    a.tick(OFF_MS + 5000);
    expect(a.state(0).lane).toBe("back");
    expect(a.state(0).dist).toBeCloseTo(5 * LANE_SPEED, 6);
  });

  it("reduced motion: tick does not change any ship's state", () => {
    const { a } = setup(true);
    const s0 = [0, 1, 2].map((k) => a.state(k));
    a.tick(60000);
    expect([0, 1, 2].map((k) => a.state(k))).toEqual(s0);
  });
});

describe("fair launch", () => {
  it("the launch goes from the fair pier to the bulk pier and back, stopping 4 s at each end, always over water and never behind a static solid", () => {
    const { a: anim } = setup(false);
    const fpts = FERRY_ROUTE, fa = fpts[0]!, fb = fpts[fpts.length - 1]!;
    const L = fpts.slice(1).reduce((acc, b, i) => acc + Math.hypot(b.x - fpts[i]!.x, b.y - fpts[i]!.y), 0);
    const f0 = anim.ferry();
    expect(f0.alpha).toBe(1);
    const hull0 = f0.solids.find((s) => s.kind === "hull")!;
    expect(hull0.kind === "hull" && hull0.at).toMatchObject({ x: fa.x, y: fa.y });
    anim.tick(FERRY_PAUSE_MS + 100); // starts
    const seen: { x: number; y: number }[] = [];
    for (let t = 0; t < (2 * L) / FERRY_SPEED + 10; t += 1) { anim.tick(1000); const h = anim.ferry().solids.find((s) => s.kind === "hull")!; if (h.kind === "hull") seen.push({ x: h.at.x, y: h.at.y }); }
    expect(seen.some((p) => Math.hypot(p.x - fb.x, p.y - fb.y) < FERRY_SPEED)).toBe(true); // reached the other pier
    expect(seen.some((p) => Math.hypot(p.x - fa.x, p.y - fa.y) < FERRY_SPEED)).toBe(true); // and came back
    for (const p of seen) expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
    const statics = world(7).solids.filter((s) => !isFlat(s));
    for (let i = 0; i < fpts.length - 1; i++) {
      const a = fpts[i]!, b = fpts[i + 1]!;
      for (let t = 0; t <= 1; t += 0.05) {
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const box = bounds({ kind: "hull", at: v3(p.x, p.y, -1), len: SHIP_SPECS.ferry.len, beam: SHIP_SPECS.ferry.beam, h: SHIP_SPECS.ferry.h, mat: "hull" });
        for (const s of statics) { const sb = bounds(s); if (overlaps(screenBounds(box), screenBounds(sb))) expect(isBehind(box, sb)).toBe(false); }
      }
    }
  });
});

describe("sea, beam and buoys", () => {
  it("the beam turns once every 8 s and with reduced-motion points east", () => {
    const { a } = setup();
    const angle = (acc: ReturnType<typeof a.beam>) => { const p = acc[0]!; if (p.kind !== "poly") throw new Error("expected a poly wedge"); const apex = p.pts[0]!, tip = p.pts[1]!; return Math.atan2(tip.y - apex.y, tip.x - apex.x); };
    const a0 = angle(a.beam());
    a.tick(BEAM_PERIOD_MS / 4);
    expect(angle(a.beam()) - a0).toBeCloseTo(Math.PI / 2, 1);
    a.tick((BEAM_PERIOD_MS * 3) / 4);
    expect(Math.abs(angle(a.beam()) - a0) % (Math.PI * 2)).toBeCloseTo(0, 1);
    expect(a.beam()).toHaveLength(2);
    const r = setup(true).a;
    expect(Math.abs(angle(r.beam()))).toBeLessThan(0.2);
    expect(r.tick(500)).toEqual({ ships: [false, false, false], beam: false, buoys: false, ferry: false, neon: false });
  });
  it("the beam is not marked if it returns to the same angle; it is on any other tick (#71)", () => {
    const { a } = setup();
    a.tick(1);
    expect(a.tick(BEAM_PERIOD_MS / 4).beam).toBe(true);
    expect(a.tick(BEAM_PERIOD_MS).beam).toBe(false);
  });
  it("the beam is warm light: both wedges are from the amber family, none magenta, through the whole turn and with reduced-motion", () => {
    for (const reduced of [false, true]) {
      const { a } = setup(reduced);
      for (let t = 0; t < BEAM_PERIOD_MS; t += BEAM_PERIOD_MS / 4) {
        const b = a.beam();
        expect(b.map((x) => x.color)).toEqual(["amberBleed", "amber"]);
        for (const x of b) { expect(x.color).toMatch(/^amber/); expect(x.color).not.toMatch(/^magenta/); }
        a.tick(BEAM_PERIOD_MS / 4);
      }
    }
  });
  it("the buoys blink out of phase: never both off, each on for half the period", () => {
    const { a } = setup();
    let on0 = 0, on1 = 0;
    for (let t = 0; t < 2000; t += 50) {
      const b = a.buoys();
      expect(b.length).toBeGreaterThanOrEqual(1);
      on0 += b.some((d) => d.kind === "dot" && d.at.x === 398) ? 1 : 0;
      on1 += b.some((d) => d.kind === "dot" && d.at.x === 392) ? 1 : 0;
      a.tick(50);
    }
    expect(on0).toBe(20); expect(on1).toBe(20);
  });
});

describe("neons", () => {
  const dots = (xs: Accent[], color: string) => xs.filter((x): x is Extract<Accent, { kind: "dot" }> => x.kind === "dot" && x.color === color);
  const sign = (xs: Accent[]) => xs.find((x) => x.kind === "poly")!;

  it("frame 0 = reduced motion state: two gallery lights, coast at full, cyan sign; only cyan/magenta", () => {
    const { w, a } = setup(), r = setup(true).a;
    const n0 = a.neon();
    expect(n0).toEqual(r.neon());
    expect(dots(n0, "magenta").map((d) => d.at)).toEqual([w.sea!.neon.gallery[0], w.sea!.neon.gallery[1]]);
    for (const d of dots(n0, "magenta")) expect(d.r).toBe(0.45);
    expect(dots(n0, "cyan").map((d) => d.r)).toEqual(w.sea!.neon.coast.map(() => 0.6));
    expect(sign(n0).color).toBe("cyan");
    for (const x of n0) expect(x.color).toMatch(/^(cyan|magenta)/);
  });

  it("the gallery runs opposite to the beam, one place per 200 ms step", () => {
    const { w, a } = setup();
    expect(a.tick(NEON_STEP_MS).neon).toBe(true);
    expect(dots(a.neon(), "magenta").map((d) => d.at)).toEqual([w.sea!.neon.gallery[0], w.sea!.neon.gallery[7]]);
    expect(a.tick(NEON_STEP_MS / 2).neon).toBe(false); // within the same step: nothing to redraw
  });

  it("the coast is a traveling wave and the sign alternates cyan/magenta every 4 s", () => {
    const { a } = setup();
    a.tick(NEON_STEP_MS);
    const rs = dots(a.neon(), "cyan").map((d) => d.r);
    for (const r of rs) { expect(r).toBeGreaterThanOrEqual(0.3); expect(r).toBeLessThanOrEqual(0.6); }
    expect(new Set(rs).size).toBeGreaterThan(1);
    const peak = (xs: number[]) => xs.indexOf(Math.max(...xs));
    a.tick(4 * NEON_STEP_MS);
    expect(peak(dots(a.neon(), "cyan").map((d) => d.r))).not.toBe(peak(rs)); // the crest shifted: the wave travels
    a.tick(KEEPER_SIGN_MS);
    expect(sign(a.neon()).color).toBe("magenta");
    a.tick(KEEPER_SIGN_MS);
    expect(sign(a.neon()).color).toBe("cyan");
  });
});

describe("beam: a single angle per frame (#66)", () => {
  const src = readFileSync(new URL("./sea-anim.ts", import.meta.url), "utf8");
  it("wedge receives the angle and does not compute it", () => {
    const wedgeSrc = src.match(/const wedge = [\s\S]*?\n  };\n/)?.[0];
    expect(wedgeSrc).toBeDefined();
    expect(wedgeSrc).not.toMatch(/beamAngle/);
  });
  it("beam() calls beamAngle() once and passes the angle to both wedges", () => {
    expect(src.match(/beamAngle\(\)/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/beam: \(\) => \{\s*const \w+ = beamAngle\(\);/);
  });
  it("both wedges share rotation through the whole turn, with their lengths and alphas", () => {
    const { a } = setup();
    // Direction as a unit vector and not as atan2: at a = π the midpoint's y is ~0 and the sign can jump between +π and −π.
    const axis = (x: Accent) => {
      if (x.kind !== "poly") throw new Error("expected a poly wedge");
      expect(x.pts).toHaveLength(3);
      const o = x.pts[0]!, p = x.pts[1]!, q = x.pts[2]!;
      const mx = (p.x + q.x) / 2 - o.x, my = (p.y + q.y) / 2 - o.y, m = Math.hypot(mx, my);
      return { ux: mx / m, uy: my / m, len: Math.hypot(p.x - o.x, p.y - o.y), alpha: x.alpha };
    };
    for (let t = 0; t < BEAM_PERIOD_MS; t += BEAM_PERIOD_MS / 4) {
      const [outer, inner] = a.beam().map(axis);
      expect(inner!.ux).toBeCloseTo(outer!.ux, 9);
      expect(inner!.uy).toBeCloseTo(outer!.uy, 9);
      expect(outer!.len).toBeCloseTo(BEAM_LEN, 9);
      expect(inner!.len).toBeCloseTo(BEAM_INNER, 9);
      expect([outer!.alpha, inner!.alpha]).toEqual([0.5, 0.6]);
      a.tick(BEAM_PERIOD_MS / 4);
    }
  });
});

describe("beam: own vertex (#149)", () => {
  it("each wedge carries its own copy of the lantern", () => {
    const { w, a } = setup();
    const lantern = w.sea!.lantern, before = { ...lantern };
    const apex = (x: Accent) => { if (x.kind !== "poly") throw new Error("expected a poly wedge"); return x.pts[0]!; };
    const beam = a.beam();
    expect(beam).toHaveLength(2);
    const [o0, o1] = beam.map(apex);
    for (const o of [o0, o1]) { expect(o).toEqual(lantern); expect(o).not.toBe(lantern); }
    expect(o0).not.toBe(o1);
    o0!.x += 5;
    expect(lantern).toEqual(before);
    a.tick(100);
    expect(apex(a.beam()[0]!)).toEqual(before);
  });
});

describe("fair launch tick chunking", () => {
  const w = world(7);
  const fresh = () => createSeaAnim(w.sea!, { reducedMotion: false });
  const hullOf = (f: ReturnType<ReturnType<typeof fresh>["ferry"]>) => {
    const h = f.solids.find((s) => s.kind === "hull");
    if (!h || h.kind !== "hull") throw new Error("expected a hull");
    return { x: h.at.x, y: h.at.y, heading: h.heading! };
  };
  const expectSameHull = (a: ReturnType<typeof hullOf>, b: ReturnType<typeof hullOf>) => {
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.heading).toBeCloseTo(b.heading, 6);
  };
  const L = polyline(FERRY_ROUTE).length;
  const start = FERRY_ROUTE[0]!, end = FERRY_ROUTE[FERRY_ROUTE.length - 1]!;

  it("position and heading after one tick match the 100 ms chunking", () => {
    for (const T of [5000, 60000, 600000]) {
      const one = fresh(), chunked = fresh();
      one.tick(T);
      for (let t = 0; t < T; t += 100) chunked.tick(100);
      expectSameHull(hullOf(one.ferry()), hullOf(chunked.ferry()));
    }
  });

  it("the leftover of the pause is spent moving", () => {
    const a = fresh();
    a.tick(FERRY_PAUSE_MS - 100);
    expect(a.tick(1100).ferry).toBe(true);
    const h = hullOf(a.ferry());
    expect(Math.hypot(h.x - start.x, h.y - start.y)).toBeCloseTo(FERRY_SPEED, 6);
  });

  it("the leftover at an end comes off the next pause", () => {
    const a = fresh();
    a.tick(FERRY_PAUSE_MS + (L / FERRY_SPEED) * 1000 + 500);
    const atEnd = hullOf(a.ferry());
    expect(atEnd.x).toBeCloseTo(end.x, 6);
    expect(atEnd.y).toBeCloseTo(end.y, 6);
    expect(a.tick(FERRY_PAUSE_MS - 501).ferry).toBe(false);
    expectSameHull(hullOf(a.ferry()), atEnd);
    a.tick(1001);
    const back = hullOf(a.ferry());
    expect(Math.hypot(back.x - end.x, back.y - end.y)).toBeCloseTo(FERRY_SPEED, 6);
  });

  it("a non-finite first tick does not use up the first-tick marking", () => {
    const a = fresh();
    expect(a.tick(NaN)).toEqual({ ships: [false, false, false], beam: false, buoys: false, ferry: false, neon: false });
    const c = a.tick(100);
    expect(c.buoys).toBe(true);
    expect(c.neon).toBe(true);
    expect(c.ferry).toBe(true);
  });

  it("tick(NaN) and tick(Infinity) change nothing", { timeout: 2000 }, () => {
    const a = fresh();
    a.tick(4500);
    const snap = () => JSON.stringify([a.ferry(), a.beam(), a.buoys(), a.neon(), [0, 1, 2].map((k) => a.state(k))]);
    const before = snap();
    const none = { ships: [false, false, false], beam: false, buoys: false, ferry: false, neon: false };
    expect(a.tick(NaN)).toEqual(none);
    expect(a.tick(Infinity)).toEqual(none);
    expect(snap()).toBe(before);
  });
});
