import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import type { FixedLight } from "../city/lights";
import { checkSign, checkSignFont, COVER_LAPTOP, COVER_PHONE, signMetrics } from "../kit/legibility";
import { MARQUEE_FACE } from "../kit/marquee";
import { SIDEWALK } from "./city-grid";
import { HOTEL_LOT } from "./city-plan";
import { sideKeys, visibleKeys } from "./sides-fixtures";
import { HOTEL_BLOCK, HOTEL_ROOF, RESUME_SIGN, SIGN_BACKING, SIGN_SITE, hotel, hotelSign } from "./sign-hotel";

// Acceptance criteria of #494: the hotel as one block to z 60 and RESUME standing on its roof, on the grid, under the train rule.

const build = () => { const out: Solid[] = [], accents: Accent[] = [], lights: FixedLight[] = []; const lit = hotel(out, accents, lights); return { out, accents, lit }; };
const H = build();
const signOnly = (() => { const out: Solid[] = [], accents: Accent[] = []; hotelSign(out, accents); return { out, accents }; })();
const EPS = 1e-6;

describe("the block (#494)", () => {
  it("HOTEL_BLOCK is the lot minus the sidewalk and the roof is at z 60", () => {
    expect(HOTEL_BLOCK).toEqual({ x0: HOTEL_LOT.x + SIDEWALK, y0: HOTEL_LOT.y + SIDEWALK, x1: HOTEL_LOT.x + HOTEL_LOT.w - SIDEWALK, y1: HOTEL_LOT.y + HOTEL_LOT.d - SIDEWALK });
    expect(HOTEL_ROOF).toBe(60);
  });
  it("one plaster solid from the ground to the roof covers the block, and nothing of the building stops at z 10", () => {
    const block = H.out.filter((s) => s.kind === "poly" && s.mat === "plaster" && s.z === 0);
    expect(block).toHaveLength(1);
    const b = bounds(block[0]!);
    expect([b.min.x, b.min.y, b.max.x, b.max.y]).toEqual([HOTEL_BLOCK.x0, HOTEL_BLOCK.y0, HOTEL_BLOCK.x1, HOTEL_BLOCK.y1]);
    const crown = Math.max(...H.out.filter((s) => s.kind === "poly" && bounds(s).min.z < HOTEL_ROOF).map((s) => bounds(s).max.z));
    expect(crown).toBeCloseTo(HOTEL_ROOF, 9);
    expect(H.out.filter((s) => s.kind === "poly" && Math.abs(bounds(s).min.z - 10) < EPS)).toEqual([]); // the old base cornice is gone
  });
  it("the rooms are amber windows on the visible walls (+x at x 125.5, +y at y 313.5)", () => {
    expect(H.lit.rooms.length).toBeGreaterThan(96);
    for (const r of H.lit.rooms) {
      expect(r.kind === "poly" && r.color === "amber").toBe(true);
      if (r.kind !== "poly") continue;
      const onX = r.pts.every((p) => Math.abs(p.x - HOTEL_BLOCK.x1) < 1e-3), onY = r.pts.every((p) => Math.abs(p.y - HOTEL_BLOCK.y1) < 1e-3);
      expect(onX || onY).toBe(true);
    }
  });
  it("paperWindow is on a middle floor of the plaza face (+x)", () => {
    const w = H.lit.paperWindow;
    expect(w.x).toBeGreaterThan(HOTEL_BLOCK.x1);
    expect(w.x).toBeLessThan(HOTEL_BLOCK.x1 + 1);
    expect(w.z).toBeGreaterThan(HOTEL_ROOF / 3);
    expect(w.z).toBeLessThan((2 * HOTEL_ROOF) / 3);
  });
});

describe("RESUME standing on the roof (#494)", () => {
  it("RESUME_SIGN is a facade sign along −y, cap 12, baseline about z 62, top about z 74", () => {
    expect(RESUME_SIGN).toMatchObject({ id: "cartel-torre", text: "RESUME", size: 12, color: "greenMid", xHeight: 12, stroke: MARQUEE_FACE * 12, facade: true });
    expect(RESUME_SIGN.backing).toEqual([SIGN_BACKING]);
    for (const g of RESUME_SIGN.glyphs) {
      expect(g.plane.u.x).toBeCloseTo(0, 9);
      expect(g.plane.u.y).toBeLessThan(0);
      expect(g.plane.v).toEqual(v3(0, 0, 1));
    }
    const pts = RESUME_SIGN.glyphs.flatMap((g) => g.quads.flat()), zs = pts.map((p) => p.z), ys = pts.map((p) => p.y);
    expect(Math.min(...zs)).toBeGreaterThan(HOTEL_ROOF);
    expect(Math.min(...zs)).toBeCloseTo(62, 0);
    expect(Math.max(...zs)).toBeCloseTo(74, 0);
    expect(Math.max(...zs)).toBeLessThanOrEqual(75);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(HOTEL_BLOCK.y0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(HOTEL_BLOCK.y1);
    expect(SIGN_SITE.z).toBe(RESUME_SIGN.glyphs[0]!.plane.origin.z);
  });
  it("the oracle is green at both scales against the hotel, with aspect margin", () => {
    expect(checkSignFont(RESUME_SIGN)).toEqual([]);
    for (const s of [COVER_LAPTOP, COVER_PHONE]) {
      expect(checkSign(RESUME_SIGN, s, H.out), `${s}`).toEqual([]);
      expect(signMetrics(RESUME_SIGN, s).aspectError).toBeLessThanOrEqual(0.075);
    }
    expect(signMetrics(RESUME_SIGN, COVER_LAPTOP).xHeightPx).toBeGreaterThanOrEqual(12);
    expect(signMetrics(RESUME_SIGN, COVER_PHONE).xHeightPx).toBeGreaterThanOrEqual(8);
  });
  it("letters, sides and bulbs are accents: faces greenMid, darker sides before them, warm bulbs", () => {
    const quads = new Set(RESUME_SIGN.glyphs.flatMap((g) => g.quads).map((q) => JSON.stringify(q)));
    const faces = signOnly.accents.filter((a) => a.kind === "poly" && a.color === "greenMid");
    expect(faces.map((a) => (a.kind === "poly" ? JSON.stringify(a.pts) : "")).every((q) => quads.has(q))).toBe(true);
    expect(faces).toHaveLength(quads.size);
    const sides = signOnly.accents.filter((a) => a.kind === "poly" && a.color === "greenBleed");
    expect(sides.length).toBeGreaterThanOrEqual(RESUME_SIGN.glyphs.length);
    const firstFace = signOnly.accents.findIndex((a) => a.kind === "poly" && a.color === "greenMid");
    expect(signOnly.accents.findIndex((a) => a.kind === "poly" && a.color === "greenBleed")).toBeLessThan(firstFace);
    for (const s of sides) {
      if (s.kind !== "poly") continue;
      const xs = s.pts.map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1.2, 6); // extruded 1.2 u along x
    }
    expect(signOnly.accents.filter((a) => a.kind === "dot" && a.color === "windowWarm").length).toBeGreaterThan(0);
    expect(signOnly.out.some((s) => s.mat === "glass")).toBe(false); // no glass panel
  });
  it("a steel lattice behind reaches z 75; a walkway in front", () => {
    const front = Math.min(...RESUME_SIGN.glyphs.flatMap((g) => g.quads.flat()).map((p) => p.x));
    const beams = signOnly.out.filter((s) => s.kind === "beam" && s.mat === "steel");
    expect(beams.length).toBeGreaterThanOrEqual(20);
    expect(Math.max(...beams.map((b) => bounds(b).max.z))).toBeCloseTo(75, 6);
    for (const b of beams) if (bounds(b).max.z > HOTEL_ROOF + 2) expect(bounds(b).max.x).toBeLessThan(front);
    expect(signOnly.out.some((s) => bounds(s).min.x > front && bounds(s).max.z <= HOTEL_ROOF + 2 && bounds(s).max.z > HOTEL_ROOF)).toBe(true);
  });
});

describe("on the grid and under the train rule (#494)", () => {
  const all = [...H.out];
  it("no 45° slab: every poly edge is axis-aligned or a short chamfer, every beam runs along x, y or z in plan", () => {
    for (const s of all) {
      if (s.kind === "poly") {
        s.footprint.forEach((p, i) => {
          const q = s.footprint[(i + 1) % s.footprint.length]!, dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
          expect(dx < EPS || dy < EPS || Math.hypot(dx, dy) < 4, `${s.mat} ${JSON.stringify(p)}`).toBe(true);
        });
      }
      if (s.kind === "beam") {
        const dx = Math.abs(s.to.x - s.from.x), dy = Math.abs(s.to.y - s.from.y);
        expect(dx < EPS || dy < EPS, JSON.stringify(s)).toBe(true);
      }
    }
  });
  it("every solid of the hotel and its sign keeps y_min − 1.4·z_max ≥ 134.5", () => {
    for (const s of all) { const b = bounds(s); expect(b.min.y - 1.4 * b.max.z, `${s.kind} ${s.mat} ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(134.5 - 1e-9); }
  });
  it("the sides of the letters face the camera: exactly the segments whose outward normal has a positive dot with VIEW_DIR", () => {
    const sides = signOnly.accents.flatMap((a) => (a.kind === "poly" && a.color === "greenBleed" ? [a.pts] : []));
    expect(sides.length).toBeGreaterThan(0);
    expect(sideKeys(sides)).toEqual(visibleKeys(RESUME_SIGN));
  });
});
