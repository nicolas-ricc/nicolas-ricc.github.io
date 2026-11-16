import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { isBehind } from "../iso/depth";
import { dot, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { project } from "../iso/project";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import { backingMargin, checkSign, COVER_LAPTOP, COVER_PHONE, SIGN_FONT, type SignGlyph } from "../kit/legibility";
import { polygonDistance, toWorld } from "../kit/lettering";
import { neon } from "../kit/props";
import { HALO_BASE } from "../world/frame";
import { assembleWorld } from "../world/assemble";
import {
  hallStandIn, PIECE_AT, roofUnder, roofZ, SHIPYARD_HALLS, STAND_IN_HALL, TINKER_LETTERS, TINKER_SIGN, TINKER_SITE, tinkerAnimator, tinkerLights, tinkerModules,
  tinkerSign, tinkerSpec, tinkerWordPlane, type Hall,
} from "./sign-tinker";

const U = v3(Math.SQRT1_2, -Math.SQRT1_2, 0), N = v3(Math.SQRT1_2, Math.SQRT1_2, 0);
const SCALES = [COVER_LAPTOP, COVER_PHONE];
const AT = [["site", TINKER_SITE], ["piece", PIECE_AT]] as const;
const deg = (r: number) => (r * 180) / Math.PI;
const sub = (a: Vec3, b: Vec3) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const strokeQuads = (g: SignGlyph) => g.layout.quads.map((q) => q.map((c) => toWorld(g.plane, c.x, c.y)));
const center = (g: SignGlyph, plane = g.plane) => { const b = g.layout.box; return toWorld(plane, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); };
const overlap = (A: Bounds, B: Bounds) => (["x", "y", "z"] as const).every((k) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]) > 1e-6);
const polys = (a: Accent[]) => a.flatMap((x) => (x.kind === "poly" ? [x] : []));
const dots = (a: Accent[]) => a.flatMap((x) => (x.kind === "dot" ? [x] : []));
const steelPosts = (out: Solid[]) => out.flatMap((s) => (s.kind === "prism" && s.mat === "steel" && Math.abs(s.w - 0.3) < 1e-9 && Math.abs(s.d - 0.3) < 1e-9 ? [s] : []));
const beams = (out: Solid[], w: number) => out.flatMap((s) => (s.kind === "beam" && s.mat === "steel" && Math.abs(s.w - w) < 1e-9 ? [s] : []));
const foot = (s: { at: Vec3; w: number; d: number }) => [v3(s.at.x, s.at.y, 0), v3(s.at.x + s.w, s.at.y, 0), v3(s.at.x + s.w, s.at.y + s.d, 0), v3(s.at.x, s.at.y + s.d, 0)];
/** Independent oracle: the highest roof under a square foot, sampled on an 11 × 11 grid plus each hall's ridge line clamped into the foot. */
const maxRoof = (x: number, y: number, w: number, halls: readonly Hall[]) => {
  const ys = [...Array.from({ length: 11 }, (_, k) => y + (w * k) / 10), ...halls.map((h) => Math.min(Math.max((h.y0 + h.y1) / 2, y), y + w))];
  return Math.max(...ys.flatMap((b) => Array.from({ length: 11 }, (_, k) => roofZ(x + (w * k) / 10, b, halls))));
};
const inHall = (p: { x: number; y: number }, h: Hall) => p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1;

function sign(at: Vec3, halls: readonly Hall[] = SHIPYARD_HALLS) { const out: Solid[] = [], accents: Accent[] = []; tinkerSign(out, accents, at, halls); return { out, accents }; }
function piece() { const out: Solid[] = [], accents: Accent[] = []; hallStandIn(out); tinkerSign(out, accents, PIECE_AT, [STAND_IN_HALL]); return { out, accents }; }

/** Pairs of solids whose boxes interpenetrate, both-interlocked pairs and (solid, hall) pairs whose solid stands on the roof excused. */
function clashes(out: Solid[], halls: readonly { solid: Solid; hall: Hall }[] = []): string[] {
  const b = out.map(bounds), bad: string[] = [];
  const onRoof = (s: Solid, h: Hall) => s.kind === "prism" && foot(s).every((p) => inHall(p, h) && s.at.z >= maxRoof(s.at.x, s.at.y, s.w, [h]) - 1e-9);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i]!, c = out[j]!;
    if (a.interlocks && c.interlocks) continue;
    const ha = halls.find((x) => x.solid === a), hc = halls.find((x) => x.solid === c);
    if ((ha && onRoof(c, ha.hall)) || (hc && onRoof(a, hc.hall))) continue;
    if (overlap(b[i]!, b[j]!)) bad.push(`${i} ${a.kind}/${a.mat} × ${j} ${c.kind}/${c.mat}`);
  }
  return bad;
}

describe("tinker sign letters (#379)", () => {
  it("TINKER_SIGN: Portfolio at SIGN_FONT in amber, built by tinkerSpec at TINKER_SITE", () => {
    expect(TINKER_SIGN).toMatchObject({ id: "cartel-taller", text: "Portfolio", size: SIGN_FONT.size, width: SIGN_FONT.width, color: "amber" });
    expect(TINKER_SIGN.glyphs.map((g) => g.char)).toEqual([..."Portfolio"]);
    expect(tinkerSpec(TINKER_SITE)).toEqual(TINKER_SIGN);
  });

  it.each(AT)("nine modules at the %s, each with its own panel in its letter's material, no two neighbours alike", (_n, at) => {
    const spec = tinkerSpec(at), mods = tinkerModules(at);
    expect(mods.map((m) => m.char)).toEqual([..."Portfolio"]);
    expect(spec.backing).toHaveLength(9);
    mods.forEach((m, i) => {
      expect(m.panel.kind).toBe("poly");
      expect(m.panel.mat).toBe(TINKER_LETTERS[i]!.panel);
      expect(spec.backing[i]).toEqual(m.panel);
      if (i > 0) expect(m.panel.mat, `${i}`).not.toBe(mods[i - 1]!.panel.mat);
    });
  });

  it.each(AT)("each panel alone backs its glyph with ≥ 1 w all round (%s)", (_n, at) => {
    const spec = tinkerSpec(at);
    spec.glyphs.forEach((g, i) => expect(backingMargin({ ...spec, glyphs: [g], backing: [spec.backing[i]!] }, []), `${i} ${g.char}`).toBe(1));
  });

  it("five techniques, the issue's default map, no two neighbours alike", () => {
    const t = TINKER_LETTERS.map((l) => l.technique);
    expect(t).toEqual(["cutout", "marquee", "neon", "painted", "welded", "cutout", "neon", "painted", "marquee"]);
    expect(new Set(t).size).toBe(5);
    for (let i = 1; i < t.length; i++) expect(t[i]).not.toBe(t[i - 1]);
    expect(TINKER_LETTERS.filter((l) => l.hung).map((l) => l.char)).toEqual(["l"]);
  });

  it.each(AT)("each module draws its technique from the spec's glyph (%s)", (_n, at) => {
    const spec = tinkerSpec(at), mods = tinkerModules(at), lights = tinkerLights(at);
    mods.forEach((m, i) => {
      const g = spec.glyphs[i]!, fill = (alpha: number) => g.quads.map((q) => ({ kind: "poly", pts: q, color: "amber", alpha }));
      const tube = strokeQuads(g).flatMap((q) => neon(q, "amber", 0.9));
      const own = [...m.accents, ...(m.char === "l" ? lights.filter((a) => a.kind === "poly") : [])];
      switch (TINKER_LETTERS[i]!.technique) {
        case "cutout": expect(own).toEqual(fill(0.9)); break;
        case "neon": expect(own).toEqual(tube); break;
        case "marquee": {
          expect(polys(own)).toEqual(fill(0.7));
          const bulbs = [...dots(own), ...(i === 8 ? dots(lights) : [])];
          expect(bulbs.length).toBeGreaterThanOrEqual(4);
          expect(new Set(bulbs.map((d) => JSON.stringify(d.at))).size, "no two bulbs on one spot").toBe(bulbs.length);
          for (const d of bulbs) {
            expect(d).toMatchObject({ color: "amberMid", r: 0.3 });
            expect(Math.abs(dot(sub(d.at, g.plane.origin), N))).toBeLessThan(0.01);
          }
          break;
        }
        case "painted": {
          expect(own).toEqual(fill(0.6));
          expect((m.panel.plates ?? []).filter((p) => p.shape === "poly" && p.mat === "safety" && p.wall === 0)).toHaveLength(g.quads.length);
          break;
        }
        case "welded": {
          expect(own).toEqual(tube);
          const bars = beams(m.solids, 0.25);
          expect(bars).toHaveLength(g.layout.quads.length);
          for (const b of bars) {
            expect(b.h).toBeCloseTo(0.25, 9);
            for (const p of [b.from, b.to]) expect(dot(sub(p, g.plane.origin), N)).toBeLessThan(-0.125 + 1e-9);
          }
          break;
        }
      }
    });
  });

  it("the moving lights: the whole l tube, then one marquee bulb of the last o", () => {
    const g = TINKER_SIGN.glyphs[6]!, lights = tinkerLights(TINKER_SITE);
    expect(polys(lights)).toEqual(strokeQuads(g).flatMap((q) => neon(q, "amber", 0.9)));
    expect(dots(lights)).toHaveLength(1);
    expect(lights.at(-1)).toMatchObject({ kind: "dot", color: "amberMid", r: 0.3 });
  });

  it.each(AT)("glyph planes: turned ≤ 3° within the word plane, moved ≤ 0.5 in z and ≤ 0.4 along n (%s)", (_n, at) => {
    const spec = tinkerSpec(at), word = tinkerWordPlane(at);
    spec.glyphs.forEach((g, i) => {
      const L = TINKER_LETTERS[i]!;
      expect(Math.abs(L.turnDeg), g.char).toBeLessThanOrEqual(3);
      expect(Math.abs(L.dz), g.char).toBeLessThanOrEqual(0.5);
      expect(Math.abs(L.dn), g.char).toBeLessThanOrEqual(0.4);
      expect(Math.abs(dot(g.plane.u, N))).toBeLessThan(1e-12);
      expect(Math.abs(dot(g.plane.v, N))).toBeLessThan(1e-12);
      expect(deg(Math.acos(Math.min(1, dot(g.plane.u, U))))).toBeCloseTo(Math.abs(L.turnDeg), 9);
      const d = sub(center(g), center(g, word));
      expect(d.z).toBeCloseTo(L.dz, 9);
      expect(dot(d, N)).toBeCloseTo(L.dn, 9);
      expect(dot(d, U)).toBeCloseTo(0, 9);
    });
  });

  it.each(AT)("levels 1–2 on the sign alone at 1.17 and 0.83 (%s)", (_n, at) => {
    for (const s of SCALES) expect(checkSign(tinkerSpec(at), s, [])).toEqual([]);
  });

  it.each(AT)("panel boxes never interpenetrate; each near panel is in front of its far neighbours (%s)", (_n, at) => {
    const P = tinkerSpec(at).backing.map(bounds);
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) expect(overlap(P[i]!, P[j]!), `${i} × ${j}`).toBe(false);
    for (let i = 0; i + 1 < P.length; i++) {
      const [far, near] = i % 2 === 0 ? [P[i]!, P[i + 1]!] : [P[i + 1]!, P[i]!];
      expect(isBehind(far, near), `${i}`).toBe(true);
    }
  });

  it("deterministic", () => {
    expect(tinkerModules(TINKER_SITE)).toEqual(tinkerModules(TINKER_SITE));
    expect(sign(TINKER_SITE)).toEqual(sign(TINKER_SITE));
  });
});

describe("tinker sign scaffold (#379)", () => {
  it("roofZ: ridge 13.5, eave 10, halfway 11.75, 0 off every hall", () => {
    const h = [STAND_IN_HALL];
    expect(roofZ(0, 0, h)).toBeCloseTo(13.5, 12);
    expect(roofZ(5, 8, h)).toBeCloseTo(10, 12);
    expect(roofZ(-5, -4, h)).toBeCloseTo(11.75, 12);
    expect(roofZ(0, 9, h)).toBe(0);
    expect(roofZ(60, -24, SHIPYARD_HALLS)).toBeCloseTo(13.5, 12);
    expect(roofZ(60, -34, SHIPYARD_HALLS)).toBe(0);
    expect(roofUnder(-0.15, -0.15, 0.3, h)).toBeCloseTo(13.5, 12);
  });

  it("SHIPYARD_HALLS are the world's two assembly halls (concrete gable prisms 90 × 16 × 10)", () => {
    const { scene } = assembleWorld(undefined, { reducedMotion: true });
    const halls = scene.solids.flatMap((s) => (s.kind === "prism" && s.roof === "gable" && s.mat === "concrete" && s.w === 90 && s.d === 16 ? [s] : []));
    expect(halls.map((s) => ({ x0: s.at.x, y0: s.at.y, x1: s.at.x + s.w, y1: s.at.y + s.d, z: s.at.z, h: s.h }))).toEqual(SHIPYARD_HALLS.map((h) => ({ ...h, z: 0, h: 10 })));
  });

  it("hallStandIn: one concrete gable prism 40 × 16 × 10 centred at the origin", () => {
    const out: Solid[] = [];
    hallStandIn(out);
    expect(out).toEqual([{ kind: "prism", at: v3(-20, -8, 0), w: 40, d: 16, h: 10, mat: "concrete", roof: "gable" }]);
    expect(STAND_IN_HALL).toEqual({ x0: -20, y0: -8, x1: 20, y1: 8 });
  });

  it.each([["site", TINKER_SITE, SHIPYARD_HALLS], ["piece", PIECE_AT, [STAND_IN_HALL]]] as const)("posts: interlocked steel 0.3², based on the roof or the ground, none across a hall edge (%s)", (_n, at, halls) => {
    const posts = steelPosts(sign(at, halls).out);
    expect(posts.length).toBeGreaterThanOrEqual(8);
    const where = new Set<string>();
    for (const s of posts) {
      expect(s.interlocks).toBe(true);
      const f = foot(s), hall = halls.find((h) => f.every((p) => inHall(p, h)));
      expect(hall !== undefined || f.every((p) => halls.every((h) => !inHall(p, h))), `post at ${s.at.x}, ${s.at.y}`).toBe(true);
      expect(Math.abs(s.at.z - maxRoof(s.at.x, s.at.y, s.w, halls))).toBeLessThan(1e-9);
      where.add(hall ? `${hall.y0}` : "ground");
    }
    const crossed = halls.filter((h) => [-30, -20, -10, 0, 10, 20, 30].some((s) => inHall({ x: at.x + U.x * s, y: at.y + U.y * s }, h)));
    expect([...where].sort()).toEqual([...crossed.map((h) => `${h.y0}`), "ground"].sort());
  });

  it("ladder at the P end, two sagging cables, two chains from the top beam to the l panel", () => {
    const { out } = sign(TINKER_SITE), spec = TINKER_SIGN, s0 = (p: Vec3) => dot(sub(p, TINKER_SITE), U);
    const rails = beams(out, 0.12).filter((b) => Math.abs(b.from.z - b.to.z) > 1);
    expect(rails).toHaveLength(2);
    const p0 = spec.backing[0]!;
    if (p0.kind !== "poly") throw new Error("panel");
    const firstPanel = Math.min(...p0.footprint.map((q) => s0(v3(q.x, q.y, TINKER_SITE.z))));
    for (const r of rails) expect(Math.max(s0(r.from), s0(r.to))).toBeLessThan(firstPanel);
    expect(beams(out, 0.1).filter((b) => Math.abs(b.from.z - b.to.z) < 1e-9).length).toBeGreaterThanOrEqual(3);
    const thin = beams(out, 0.08), chains = thin.filter((b) => b.from.x === b.to.x && b.from.y === b.to.y), cables = thin.filter((b) => !chains.includes(b));
    expect(chains).toHaveLength(2);
    const l = bounds(spec.backing[6]!);
    for (const c of chains) expect(Math.min(c.from.z, c.to.z)).toBeCloseTo(l.max.z, 9);
    expect(cables).toHaveLength(4);
    for (let k = 0; k < 4; k += 2) {
      const [a, b] = [cables[k]!, cables[k + 1]!], mid = a.to;
      expect(b.from).toEqual(mid);
      expect(mid.z).toBeLessThan(Math.min(a.from.z, b.to.z));
    }
    expect(out.filter((x) => x.interlocks).every((x) => x.mat === "steel")).toBe(true);
  });

  it.each(AT)("every rust plank rests on a steel beam under it (%s)", (_n, at) => {
    const { out } = sign(at), steel = out.filter((s) => s.kind === "beam" && s.mat === "steel").map(bounds);
    for (const p of out.filter((s) => s.kind === "beam" && s.mat === "rust").map(bounds)) {
      expect(steel.some((b) => Math.abs(b.max.z - p.min.z) < 1e-9 && b.min.x < p.max.x && p.min.x < b.max.x && b.min.y < p.max.y && p.min.y < b.max.y)).toBe(true);
    }
  });

  it.each(AT)("floodlight: one amber bulb r 1.2 on a 1.2 post on the roof, no cyan, its halo clear of every letter (%s)", (_n, at) => {
    const halls = at === PIECE_AT ? [STAND_IN_HALL] : SHIPYARD_HALLS, { out, accents } = sign(at, halls);
    expect(accents.some((a) => a.color === "cyan")).toBe(false);
    const bulbs = dots(accents).filter((d) => d.color === "amber");
    expect(bulbs).toHaveLength(1);
    expect(bulbs[0]!.r).toBe(1.2);
    const post = out.find((s) => s.kind === "prism" && s.mat === "steel" && s.w === 0.6 && s.h === 1.2);
    expect(post).toBeDefined();
    if (post?.kind === "prism") expect(post.at.z).toBeCloseTo(Math.max(...foot(post).map((p) => roofZ(p.x, p.y, halls))), 9);
    const c = project(bulbs[0]!.at), R = 1.2 * Math.max(...HALO_BASE.map((h) => h.k));
    const disc: Vec2[] = Array.from({ length: 16 }, (_, k) => ({ x: c.x + R * Math.cos((k * Math.PI) / 8), y: c.y + R * Math.sin((k * Math.PI) / 8) }));
    for (const q of tinkerSpec(at).glyphs.flatMap((g) => g.quads)) expect(polygonDistance(disc, q.map(project))).toBeGreaterThan(0);
  });

  it("the scaffold stays under the deck: above the lowest panel bottom only panels, steel beams (chains, top beam, welded bars) and 0.3² posts", () => {
    const { out } = sign(TINKER_SITE), lo = Math.min(...TINKER_SIGN.backing.map((p) => bounds(p).min.z));
    const above = out.filter((s) => bounds(s).max.z > lo + 1e-9);
    for (const s of above) {
      const ok = TINKER_SIGN.backing.some((p) => JSON.stringify({ ...p, plates: undefined }) === JSON.stringify({ ...s, plates: undefined })) || (s.kind === "beam" && s.mat === "steel") || (s.kind === "prism" && s.mat === "steel" && s.w === 0.3);
      expect(ok, `${s.kind}/${s.mat}`).toBe(true);
    }
  });

  it("the piece's own solids neither hide nor unback the word (levels 1–2 with the scaffold and the stand-in hall)", () => {
    const { out } = piece();
    for (const s of SCALES) expect(checkSign(tinkerSpec(PIECE_AT), s, out)).toEqual([]);
  });

  it("no interpenetration: the sign alone, and the sign on the stand-in hall; interlock only on steel", () => {
    expect(clashes(sign(TINKER_SITE).out)).toEqual([]);
    const { out } = piece();
    expect(clashes(out, [{ solid: out[0]!, hall: STAND_IN_HALL }])).toEqual([]);
    expect(out.filter((s) => s.interlocks).every((s) => s.mat === "steel")).toBe(true);
  });

  it("deterministic", () => {
    expect(piece()).toEqual(piece());
  });
});

describe("tinker animator (#379)", () => {
  const layer = (a: ReturnType<typeof tinkerAnimator>) => { const l = a.layer("tinker.lights"); if (l.kind !== "accent") throw new Error("accent layer"); return l.accents; };
  const run = (a: ReturnType<typeof tinkerAnimator>, ms: number, f: (t: number) => void) => { for (let t = 20; t <= ms; t += 20) { a.tick(20); f(t); } };

  it.each(AT)("one accent layer tinker.lights, all lights on at t = 0 (%s)", (_n, at) => {
    const a = tinkerAnimator({ reducedMotion: false, at });
    expect(a.ids).toEqual(["tinker.lights"]);
    expect(layer(a)).toEqual(tinkerLights(at));
  });

  it("the default position is TINKER_SITE; an unknown layer throws", () => {
    const a = tinkerAnimator({ reducedMotion: false });
    expect(layer(a)).toEqual(tinkerLights(TINKER_SITE));
    expect(() => a.layer("nope")).toThrow(/tinkerAnimator/);
  });

  it("tick(0) (?speed=0) changes nothing", () => {
    const a = tinkerAnimator({ reducedMotion: false });
    for (let k = 0; k < 50; k++) expect(a.tick(0).size).toBe(0);
    expect(layer(a)).toEqual(tinkerLights(TINKER_SITE));
  });

  it("reduced motion: 5 s of ticks never redraw and the layer stays at t = 0", () => {
    const a = tinkerAnimator({ reducedMotion: true });
    run(a, 5000, () => undefined);
    for (let k = 0; k < 10; k++) expect(a.tick(20).size).toBe(0);
    expect(layer(a)).toEqual(tinkerLights(TINKER_SITE));
  });

  it("within 5 s the bulb goes dark and the l dims to 0.3; over 20 s never both at once", () => {
    const a = tinkerAnimator({ reducedMotion: false }), n = polys(tinkerLights(TINKER_SITE)).length;
    let bulbOff = false, lLow = false, both = false;
    run(a, 20_000, (t) => {
      const acc = layer(a), dark = dots(acc).length === 0, tube = polys(acc).slice(0, n).find((p) => p.color === "amber");
      const low = tube !== undefined && Math.abs((tube.alpha ?? 1) - 0.3) < 1e-9;
      if (t <= 5000) { bulbOff ||= dark; lLow ||= low; }
      both ||= dark && low;
    });
    expect(bulbOff).toBe(true);
    expect(lLow).toBe(true);
    expect(both).toBe(false);
  });

  it("tick returns tinker.lights exactly when the layer changes, and it changes within 5 s", () => {
    const b = tinkerAnimator({ reducedMotion: false });
    let prev = JSON.stringify(layer(b)), redraws = 0;
    for (let t = 20; t <= 5000; t += 20) {
      const ids = b.tick(20), now = JSON.stringify(layer(b));
      expect([...ids], `t ${t}`).toEqual(now === prev ? [] : ["tinker.lights"]);
      if (ids.size) redraws++;
      prev = now;
    }
    expect(redraws).toBeGreaterThan(0);
  });

  it("deterministic: two animators fed the same ticks agree", () => {
    const a = tinkerAnimator({ reducedMotion: false }), b = tinkerAnimator({ reducedMotion: false });
    for (let k = 0; k < 400; k++) { expect(a.tick(17)).toEqual(b.tick(17)); }
    expect(layer(a)).toEqual(layer(b));
  });
});

describe("tinker sign in its scene (#379)", () => {
  const { scene } = assembleWorld(undefined, { reducedMotion: true });
  it("TINKER_SITE is on a ridge of an assembly hall, x within 40..80", () => {
    expect(TINKER_SITE).toEqual({ x: 60, y: -24, z: 13.5 });
    expect(TINKER_SITE.z).toBe(13.5);
    expect([-24, -44]).toContain(TINKER_SITE.y);
    expect(TINKER_SITE.x).toBeGreaterThanOrEqual(40);
    expect(TINKER_SITE.x).toBeLessThanOrEqual(80);
  });
  it("levels 1–2 against the world beyond the exhibit's crop, the factory chimneys (y 26..32) included", () => {
    const near = scene.solids.filter((s) => { const b = bounds(s); return b.max.x >= 0 && b.min.x <= 130 && b.max.y >= -70 && b.min.y <= 60; });
    const all = [...near, ...sign(TINKER_SITE).out];
    for (const s of SCALES) expect(checkSign(TINKER_SIGN, s, all)).toEqual([]);
  }, 20_000);
  it("no sign solid overlaps a world solid, posts and floodlight on a hall roof excused", () => {
    const own = sign(TINKER_SITE).out, world = scene.solids.filter((s) => s.kind !== "ground" && s.kind !== "strip");
    const halls = world.flatMap((s) => { const h = SHIPYARD_HALLS.find((x) => s.kind === "prism" && s.roof === "gable" && s.at.x === x.x0 && s.at.y === x.y0); return h ? [{ solid: s, hall: h }] : []; });
    const ownB = own.map(bounds), bad: string[] = [];
    for (const w of world) {
      const wb = bounds(w), hall = halls.find((x) => x.solid === w);
      own.forEach((s, i) => {
        if (!overlap(wb, ownB[i]!)) return;
        if (hall && clashes([w, s], [hall]).length === 0) return;
        bad.push(`${s.kind}/${s.mat} × world ${w.kind}/${w.mat}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
