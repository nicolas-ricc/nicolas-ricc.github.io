import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../iso/solids";
import { createRng, SEED, type Rng } from "../map/seed";
import { newCtx } from "./barrio-fixtures";
import { ACCESSES, costanera } from "./costanera";
import { tech } from "./tech";
import { COSTANERA_RECT, FACE_CAPS, facesIn } from "./tech-budget";
import { zoneRng } from "./world";

type Of<K extends Solid["kind"]> = Solid & { kind: K };
const R = COSTANERA_RECT, EPS = 1e-9;
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const scene = tech(zoneRng(SEED, "cv", 2));
/** Sólidos del mundo cuya caja en planta se cruza con el rect de la costanera. */
const own = scene.solids.filter((s) => { const b = bounds(s); return b.max.x > R.x0 && b.min.x < R.x1 && b.max.y > R.y0 && b.min.y < R.y1; });
const prisms = own.filter((s): s is Of<"prism"> => s.kind === "prism");
const box = (p: Of<"prism">, w: number, d: number, h: number) => near(p.w, w) && near(p.d, d) && near(p.h, h);
const centre = (s: Solid) => { const b = bounds(s); return { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }; };

const panels = prisms.filter((p) => p.mat === "officeDark" && near(p.h, 1) && near(p.w, 0.4) && near(p.at.x, 197.4));
const posts = prisms.filter((p) => p.mat === "stone" && box(p, 0.5, 0.5, 1.3));
const capitals = prisms.filter((p) => p.mat === "stone" && box(p, 0.6, 0.6, 0.15));
const lamps = prisms.filter((p) => p.mat === "steel" && box(p, 0.3, 0.3, 6.5));
const umbrellas = own.filter((s): s is Of<"cone"> => s.kind === "cone" && s.mat === "signal");
const carts = prisms.filter((p) => p.mat === "whitewash" && box(p, 1.6, 1, 1.2));
const cartPoles = prisms.filter((p) => p.mat === "steel" && box(p, 0.15, 0.15, 1));
const tables = prisms.filter((p) => p.mat === "steel" && box(p, 0.6, 0.6, 0.5));
const bodies = prisms.filter((p) => p.mat === "officeDark" && box(p, 0.4, 0.4, 1.2));
const heads = prisms.filter((p) => p.mat === "sand" && box(p, 0.25, 0.25, 0.25));
const rods = own.filter((s): s is Of<"beam"> => s.kind === "beam");
const benches = prisms.filter((p) => p.mat === "concrete" && near(p.h, 0.45));
const bins = own.filter((s): s is Of<"cylinder"> => s.kind === "cylinder" && s.mat === "steel" && near(s.r, 0.25) && near(s.h, 0.7));
const tipas = own.filter((s): s is Of<"cone"> => s.kind === "cone" && s.mat === "leaf" && near(s.at.x, 186.6));
const dots = scene.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.at.x >= R.x0 && a.at.x <= R.x1 && a.at.y >= R.y0 && a.at.y <= R.y1);

describe("costanera", () => {
  it("sin rng", () => {
    const noRng: Rng = { next: () => { throw new Error("rng"); }, int: () => { throw new Error("rng"); }, chance: () => { throw new Error("rng"); }, pick: () => { throw new Error("rng"); } };
    const ctx = newCtx(noRng);
    expect(() => costanera(ctx)).not.toThrow();
    expect(ctx.homes).toEqual([]);
    const again = newCtx(createRng(3)); costanera(again);
    expect(JSON.stringify(again.solids)).toBe(JSON.stringify(ctx.solids));
  });

  it("muelle sin bolardos", () => {
    const pier = prisms.filter((p) => p.mat === "plaza" && p.at.z === -1);
    expect(pier).toHaveLength(1);
    expect(bounds(pier[0]!)).toMatchObject({ min: { x: 192, y: 324 }, max: { x: 198, y: 624 } });
    expect(own.some((s) => s.kind === "cylinder" && s.mat === "rust")).toBe(false);
  });

  it("paseo y bicisenda", () => {
    const strips = scene.ground.filter((s): s is Of<"strip"> => s.kind === "strip");
    for (const [x, width, z, mat] of [[187.5, 3, 0.05, "paving"], [190.2, 1.6, 0.05, "asphalt"], [190.2, 0.15, 0.07, "whitewash"], [186.6, 1.2, 0.06, "leafDark"]] as const) {
      const hit = strips.filter((s) => s.mat === mat && near(s.width, width) && near(s.z, z) && s.path.every((p) => near(p.x, x)));
      expect(hit, mat).toHaveLength(1);
      const ys = hit[0]!.path.map((p) => p.y);
      expect(Math.min(...ys), mat).toBe(324); expect(Math.max(...ys), mat).toBe(624);
    }
  });

  it("tipas", () => {
    expect(tipas).toHaveLength(12);
    for (const t of tipas) { expect(t.sides).toBe(6); expect(t.r).toBe(2.2); expect(t.h).toBe(4.5); }
    expect(tipas.map((t) => t.at.y).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, k) => 336 + 24 * k));
  });

  it("baranda: paneles con calado", () => {
    expect(panels).toHaveLength(27);
    for (const p of panels) {
      expect(p.d).toBeGreaterThanOrEqual(0.15);
      expect(p.at.z).toBe(0.6);
      expect(p.plates).toEqual([{ wall: 1, shape: "rect", u0: 0.08, u1: 0.92, z0: 0.9, z1: 1.4, mat: "officeDark", toneOffset: -2 }]);
    }
  });

  it("baranda continua salvo en ACCESSES", () => {
    const spans = panels.map((p) => [p.at.y, p.at.y + p.d] as const).sort((a, b) => a[0] - b[0]);
    const gaps: [number, number][] = [[324, spans[0]![0]], ...spans.slice(1).map((s, i) => [spans[i]![1], s[0]] as [number, number]), [spans[spans.length - 1]![1], 624]];
    const holes = gaps.filter(([a, b]) => b - a > 0.5);
    expect(holes).toHaveLength(ACCESSES.length);
    for (const [a, b] of holes) expect(b - a).toBeLessThanOrEqual(2.2);
    const hit = holes.map(([a, b]) => ACCESSES.findIndex((y) => Math.abs((a + b) / 2 - y) < 0.1));
    expect(hit.every((i) => i >= 0)).toBe(true);
    expect(new Set(hit).size).toBe(ACCESSES.length);
  });

  it("postes con capitel cada 24 u desde y 324", () => {
    expect(posts).toHaveLength(13); expect(capitals).toHaveLength(13);
    for (let k = 0; k <= 12; k++) {
      const y = 324 + 24 * k;
      const post = posts.find((p) => near(centre(p).x, 197.6) && near(centre(p).y, y));
      expect(post, `poste ${y}`).toBeDefined();
      expect(post!.at.z).toBe(0.6);
      const cap = capitals.find((p) => near(centre(p).x, 197.6) && near(centre(p).y, y));
      expect(cap, `capitel ${y}`).toBeDefined();
      expect(cap!.at.z).toBeCloseTo(1.9);
    }
  });

  it("faroles cada ≤ 16 u en todo el largo", () => {
    const ys = lamps.map((p) => bounds(p).min.y).sort((a, b) => a - b);
    expect(ys).toHaveLength(20);
    expect(ys[0]).toBeLessThanOrEqual(340); expect(ys[ys.length - 1]).toBeGreaterThanOrEqual(608);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeLessThanOrEqual(16);
    for (const p of lamps) {
      const b = bounds(p);
      expect(dots.some((a) => a.kind === "dot" && a.at.z >= 7 && a.at.x >= b.min.x && a.at.x <= b.max.x && a.at.y >= b.min.y && a.at.y <= b.max.y), `farol ${b.min.y}`).toBe(true);
    }
  });

  it("carritos", () => {
    expect(umbrellas).toHaveLength(3);
    for (const u of umbrellas) { expect(u.sides).toBe(4); expect(u.r).toBe(1.1); expect(u.h).toBe(0.6); }
    expect(carts).toHaveLength(3); expect(cartPoles).toHaveLength(3); expect(tables).toHaveLength(3);
    expect(dots.filter((a) => a.kind === "dot" && a.r === 0.4 && a.at.z === 1.5)).toHaveLength(3);
  });

  it("pescadores", () => {
    expect(bodies).toHaveLength(4);
    for (const b of bodies) {
      const bb = bounds(b);
      expect(heads.some((h) => near(h.at.z, 1.8) && h.at.x >= bb.min.x && h.at.x + h.w <= bb.max.x && h.at.y >= bb.min.y && h.at.y + h.d <= bb.max.y)).toBe(true);
      expect(rods.some((r) => Math.hypot(r.from.x - (bb.min.x + bb.max.x) / 2, r.from.y - (bb.min.y + bb.max.y) / 2) < 0.5)).toBe(true);
    }
  });

  it("bancos y cestos", () => {
    expect(benches.length).toBeGreaterThanOrEqual(3);
    expect(bins.length).toBeGreaterThanOrEqual(3);
  });

  it("nada sobre el agua salvo las cañas", () => {
    for (const s of own) if (s.kind !== "beam") expect(bounds(s).max.x, s.kind + " " + s.mat).toBeLessThanOrEqual(198);
    expect(rods).toHaveLength(4);
    for (const r of rods) { const b = bounds(r); expect(b.max.x).toBeLessThanOrEqual(200); expect(b.min.x).toBeGreaterThanOrEqual(196.5); }
  });

  it("nada se solapa en planta entre grupos", () => {
    const groups: Solid[][] = [[...panels, ...posts, ...capitals], lamps, [...carts, ...cartPoles, ...umbrellas, ...tables], [...benches, ...bins], [...bodies, ...heads]];
    const apart = (a: Solid, b: Solid) => { const p = bounds(a), q = bounds(b); return p.max.x <= q.min.x + EPS || q.max.x <= p.min.x + EPS || p.max.y <= q.min.y + EPS || q.max.y <= p.min.y + EPS; };
    groups.forEach((g, i) => groups.forEach((h, j) => {
      if (j <= i) return;
      for (const a of g) for (const b of h) expect(apart(a, b), `${a.kind} ${a.mat} ↔ ${b.kind} ${b.mat} @ ${centre(a).y}`).toBe(true);
    }));
  });

  it("nada supera z 8", () => {
    for (const s of own) expect(bounds(s).max.z).toBeLessThanOrEqual(8);
  });

  it("dentro del tope", () => {
    expect(facesIn([...scene.solids, ...scene.ground], COSTANERA_RECT)).toBeLessThanOrEqual(FACE_CAPS.costanera);
  });
});
