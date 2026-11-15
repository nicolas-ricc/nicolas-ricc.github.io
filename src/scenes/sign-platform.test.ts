import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { xHeightPx } from "../kit/lettering";
import { SIGN_SIZE, SIGN_TUBE, seaPlatform } from "./sign-platform";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatform(out, accents); return { out, accents }; };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const prisms = (out: Solid[]) => out.flatMap((s) => (s.kind === "prism" ? [s] : []));
const beams = (out: Solid[]) => out.flatMap((s) => (s.kind === "beam" ? [s] : []));
const isPile = (s: Solid) => s.kind === "cylinder" && s.mat === "steel" && s.at.z === -1;
const isDeck = (s: Solid) => s.kind === "prism" && s.mat === "deck";

describe("sea platform (#363)", () => {
  it("the piles stand in the water: the piece starts at z −1, six steel piles r 0.3 from z −1 to 1.2", () => {
    const { out } = build();
    expect(Math.min(...out.map((s) => bounds(s).min.z))).toBeCloseTo(-1, 9);
    const steel = out.filter((s) => s.kind === "cylinder" && s.mat === "steel");
    expect(steel.length).toBeGreaterThanOrEqual(6);
    const piles = steel.filter((s) => s.kind === "cylinder" && s.r === 0.3 && s.at.z === -1 && near(s.at.z + s.h, 1.2));
    expect(piles).toHaveLength(6);
  });

  it("a 14 × 12 deck prism with its top at z 1.6", () => {
    const decks = prisms(build().out).filter((s) => s.mat === "deck" && s.w === 14 && s.d === 12);
    expect(decks).toHaveLength(1);
    expect(decks[0]!.at.z + decks[0]!.h).toBeCloseTo(1.6, 9);
  });

  it("at least 10 railing posts 0.15² h 1 on the deck along the S and E edges", () => {
    const posts = prisms(build().out).filter((s) => s.mat === "steel" && near(s.w, 0.15) && near(s.d, 0.15) && near(s.h, 1) && near(s.at.z, 1.6));
    expect(posts.filter((s) => near(s.at.x, 7 - 0.15) || near(s.at.y, 6 - 0.15)).length).toBeGreaterThanOrEqual(10);
  });

  it("a ladder off the E edge: steel beams from the deck top z 1.6 down to z −0.6", () => {
    const rails = beams(build().out).filter((b) => b.mat === "steel" && near(Math.min(b.from.z, b.to.z), -0.6) && near(Math.max(b.from.z, b.to.z), 1.6));
    expect(rails.length).toBeGreaterThanOrEqual(2);
    for (const r of rails) expect(Math.min(r.from.x, r.to.x)).toBeGreaterThanOrEqual(7);
  });

  it("exactly one cyan dot (the beacon, z ≥ 5.5) and one cyanMid dot (the hut light)", () => {
    const dots = build().accents.flatMap((a) => (a.kind === "dot" ? [a] : []));
    const cyan = dots.filter((d) => d.color === "cyan");
    expect(cyan).toHaveLength(1);
    expect(cyan[0]!.at.z).toBeGreaterThanOrEqual(5.5);
    expect(dots.filter((d) => d.color === "cyanMid")).toHaveLength(1);
  });

  it("the sign polygons are cyan neon at 0.75 (tube) and 0.45 (halo), each on a plane of normal (1, 1, 0)/√2; the tubes on the frame's plane", () => {
    const { out, accents } = build();
    const polys = accents.flatMap((a) => (a.kind === "poly" ? [a] : []));
    expect(polys.length).toBeGreaterThan(0);
    for (const a of polys) {
      expect(["cyan", "cyanBleed"]).toContain(a.color);
      expect(a.alpha).toBeCloseTo(a.color === "cyan" ? 0.75 : 0.45, 12);
      const k = a.pts[0]!.x + a.pts[0]!.y;
      for (const p of a.pts) expect(Math.abs(p.x + p.y - k)).toBeLessThan(1e-9);
    }
    const frame = beams(out).filter((b) => near(b.from.z, 2.8) || near(b.from.z, 2.8 + 8.55 + 1));
    expect(frame).toHaveLength(2);
    const plane = (frame[0]!.from.x + frame[0]!.to.x + frame[0]!.from.y + frame[0]!.to.y) / 2;
    for (const b of frame) expect((b.from.x + b.to.x + b.from.y + b.to.y) / 2).toBeCloseTo(plane, 9);
    for (const a of polys.filter((p) => p.color === "cyan")) expect(a.pts[0]!.x + a.pts[0]!.y).toBeCloseTo(plane, 9);
  });

  it("the two sign posts 0.2² stand on the deck, inside it in plan", () => {
    const posts = prisms(build().out).filter((s) => s.mat === "steel" && near(s.w, 0.2) && near(s.d, 0.2));
    expect(posts).toHaveLength(2);
    for (const s of posts) {
      expect(s.at.z).toBeCloseTo(1.6, 9);
      expect(s.at.x).toBeGreaterThanOrEqual(-7);
      expect(s.at.x + s.w).toBeLessThanOrEqual(7);
      expect(s.at.y).toBeGreaterThanOrEqual(-6);
      expect(s.at.y + s.d).toBeLessThanOrEqual(6);
    }
  });

  it("readable at cover scale 1.17: x-height ≥ 10 px, tube ≥ 1.5 px", () => {
    expect(SIGN_SIZE).toBe(8.55);
    expect(xHeightPx(SIGN_SIZE, 1.17)).toBeGreaterThanOrEqual(10);
    expect(SIGN_TUBE * 1.17 * 1.4).toBeGreaterThanOrEqual(1.5);
  });

  it("no solid interpenetrates another (boxes disjoint on x, y or z within 1e-6), except the piles with the deck", () => {
    const { out } = build();
    const boxes = out.map(bounds), bad: string[] = [];
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      if ((isPile(a) && isDeck(b)) || (isPile(b) && isDeck(a))) continue;
      const A = boxes[i]!, B = boxes[j]!;
      if ((["x", "y", "z"] as const).every((k) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]) > 1e-6)) bad.push(`${i} ${a.kind}/${a.mat} × ${j} ${b.kind}/${b.mat}`);
    }
    expect(bad).toEqual([]);
  });

  it("deterministic: two builds are equal", () => {
    expect(build()).toEqual(build());
  });
});
