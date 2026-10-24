import { describe, expect, it } from "vitest";
import { bounds, tessellate, tessellateAll, type Solid } from "../iso/solids";
import type { Accent } from "../iso/accent";
import { overlaps, screenBounds, sortByDepth } from "../iso/depth";
import { VIEW_DIR, Z_SCALE, project } from "../iso/project";
import { createRng } from "../map/seed";
import { EXCAVATOR, excavator, excavatorBox, excavatorWheel, local } from "./excavator";
import { factory } from "./factory";
import { factoryAnimator } from "./factory-animator";

const animator = (reducedMotion: boolean) => factoryAnimator(factory(createRng(7)), createRng(3), { reducedMotion });
const wheelLayer = (a: ReturnType<typeof animator>) => { const l = a.layer("factory.wheel"); if (l.kind !== "solid") throw new Error("factory.wheel no es una capa de sólidos"); return l.solids; };
const angleOf = (a: ReturnType<typeof animator>) => { const w = wheelLayer(a)[0]!; if (w.kind !== "wheel") throw new Error("no es wheel"); return w.angle; };

describe("rueda de la excavadora", () => {
  it.each([0, Math.PI / 7, Math.PI / 3, 2])("tesela en ≤ 400 caras con ángulo %d", (a) => {
    const w = excavatorWheel(a);
    expect(w.kind).toBe("wheel");
    expect(tessellate(w).length).toBeLessThanOrEqual(400);
  });

  it("rust, hueca, 28 lados y ranuras, 14 cangilones de 2 dientes, eje en (−14, 60, 9.2)", () => {
    const w = excavatorWheel(0);
    if (w.kind !== "wheel") throw new Error("no es wheel");
    expect(w).toMatchObject({ mat: "rust", r: 5.5, width: 0.5, sides: 28, hollow: true, slots: 28, buckets: { n: 14, depth: 1.2, teeth: 2, mat: "rust" } });
    expect(w.at.x).toBeCloseTo(-14, 6); expect(w.at.y).toBeCloseTo(60, 6); expect(w.at.z).toBeCloseTo(9.2, 6);
    expect(EXCAVATOR.at).toEqual({ x: -30, y: 76 });
  });
});

describe("capa factory.wheel", () => {
  it("un solo sólido wheel y ≤ 400 caras", () => {
    const a = animator(false);
    expect(a.ids).toContain("factory.wheel");
    const s = wheelLayer(a);
    expect(s).toHaveLength(1);
    expect(s[0]!.kind).toBe("wheel");
    expect(s.flatMap(tessellate).length).toBeLessThanOrEqual(400);
  });

  it("gira ~0.5 rad/s: tras tick(2000) el ángulo está en 1 ± 0.06", () => {
    const a = animator(false);
    expect(angleOf(a)).toBe(0);
    expect(a.tick(2000).has("factory.wheel")).toBe(true);
    expect(Math.abs(angleOf(a) - 1)).toBeLessThanOrEqual(0.06);
  });

  it("con reducedMotion el ángulo es 0 y tick nunca marca factory.wheel", () => {
    const a = animator(true);
    for (const dt of [16, 100, 250, 2000, 60000]) { expect(a.tick(dt).has("factory.wheel")).toBe(false); expect(angleOf(a)).toBe(0); }
  });

  it("el humo sigue marcándose como hoy", () => {
    const a = animator(false);
    const smoke = a.ids.filter((id) => id.startsWith("factory.smoke"));
    expect(smoke.length).toBeGreaterThan(0);
    const changed = a.tick(33);
    for (const id of smoke) expect(changed.has(id)).toBe(true);
    for (const id of smoke) expect(animator(true).tick(33).has(id)).toBe(false);
  });

  it("tick(0) no marca nada", () => expect(animator(false).tick(0).size).toBe(0));

  it("tras 10 min el ángulo sigue en [0, 2π) y la capa en ≤ 400 caras", () => {
    const a = animator(false);
    for (let k = 0; k < 600; k++) a.tick(1000);
    const ang = angleOf(a);
    expect(ang).toBeGreaterThanOrEqual(0); expect(ang).toBeLessThan(2 * Math.PI);
    expect(wheelLayer(a).flatMap(tessellate).length).toBeLessThanOrEqual(400);
  });
});

describe("chasis y plataforma de la excavadora", () => {
  const out: Solid[] = [];
  excavator(out, []);
  const polys = out.filter((s) => s.kind === "poly");
  const crawlers = polys.filter((s) => s.mat === "rust" && s.z === 0);
  const rollers = out.filter((s) => s.kind === "cylinder" && s.r === 0.3);
  const sameXY = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

  it("orugas rust con 12 zapatas toneOffset −2 en la pared visible y 3 rodillos steel cada una", () => {
    expect(crawlers).toHaveLength(2);
    for (const c of crawlers) {
      if (c.kind !== "poly") throw new Error();
      expect(c.h).toBeCloseTo(1.6, 6);
      expect(c.plates).toHaveLength(12);
      c.plates!.forEach((p, k) => {
        expect(p).toMatchObject({ wall: 2, shape: "rect", mat: "rust", toneOffset: -2, z0: 0, z1: 1.6 });
        expect((p.u1 - p.u0) * 10).toBeCloseTo(0.3, 6);
        expect(p.u0 * 10).toBeCloseTo(0.2 + 0.8 * k, 6);
      });
    }
    expect(rollers).toHaveLength(6);
    for (const r of rollers) expect(r).toMatchObject({ mat: "steel", h: 0.3 });
    for (const dy of [4.5, -1.5]) for (const dx of [-3, 0, 3]) expect(rollers.some((r) => r.kind === "cylinder" && sameXY(r.at, local(dx, dy)) && Math.abs(r.at.z - 0.65) < 1e-9)).toBe(true);
  });

  it("anillo de giro steel r 4 a z 1.6", () => {
    const ring = out.find((s) => s.kind === "cylinder" && s.r === 4);
    expect(ring).toMatchObject({ kind: "cylinder", mat: "steel", h: 1 });
    if (ring?.kind !== "cylinder") throw new Error();
    expect(ring.at.z).toBeCloseTo(1.6, 6); expect(sameXY(ring.at, EXCAVATOR.at)).toBe(true);
  });

  it("plataforma office a z 2.6..3.4 con barandas safety", () => {
    const pl = polys.find((s) => s.mat === "office");
    expect(pl).toMatchObject({ z: 2.6 }); expect(pl?.kind === "poly" && pl.h).toBeCloseTo(0.8, 6);
    const rails = out.filter((s) => s.kind === "beam" && s.mat === "safety" && s.w === 0.15 && s.from.z === 4.475);
    expect(rails).toHaveLength(2);
    for (const r of rails) if (r.kind === "beam") { expect(r.from.z).toBe(4.475); expect(r.to.z).toBe(4.475); }
    const posts = polys.filter((s) => s.mat === "safety" && s.z === 3.4);
    expect(posts.length).toBeGreaterThanOrEqual(10);
    for (const p of posts) expect(p.kind === "poly" && p.h).toBe(1);
  });

  it("casa baja whitewash con fachada de 3 columnas y techo rust a z 6.1", () => {
    const casa = polys.find((s) => s.mat === "whitewash");
    expect(casa).toMatchObject({ z: 3.4, facade: { floors: 1, cols: 3 } });
    expect(casa?.kind === "poly" && casa.h).toBeCloseTo(2.5, 6);
    const techo = polys.find((s) => s.mat === "rust" && s.z === 5.9);
    expect(techo?.kind === "poly" && techo.h).toBeCloseTo(0.2, 6);
    expect(techo?.kind === "poly" && techo.z + techo.h).toBeCloseTo(6.1, 6);
  });

  it("dos escaleras safety", () => {
    const st = out.filter((s) => s.kind === "beam" && s.mat === "safety" && s.w === 0.6);
    expect(st).toHaveLength(2);
    for (const s of st) expect(s).toMatchObject({ h: 0.15 });
  });

  it("ninguna pieza mide menos de 0.15", () => {
    for (const s of out) {
      const { min, max } = bounds(s);
      for (const k of ["x", "y", "z"] as const) expect(max[k] - min[k], `${s.kind} ${s.kind === "poly" ? s.mat : ""}`).toBeGreaterThanOrEqual(0.15 - 1e-9);
    }
  });

  it("la pared visible de cada caja girada es la arista 2", () => {
    const boxes = polys.filter((s) => s.kind === "poly" && !s.facade && !s.plates);
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      const f = tessellateAll(b)[4]!;
      expect(f.normal.x * VIEW_DIR.x + f.normal.y * VIEW_DIR.y + f.normal.z * VIEW_DIR.z).toBeGreaterThan(0);
    }
  });
});

describe("superestructura, plumas y cabina de la excavadora", () => {
  const out: Solid[] = []; const accents: Accent[] = [];
  excavator(out, accents);
  const { axleDx, axleZ } = EXCAVATOR, EPS = 1e-6, S2 = Math.SQRT2;
  const E = (dx: number) => 17 - (dx - 4.5) * (17 - axleZ) / (axleDx - 4.5);
  const C = EXCAVATOR.at;
  const toLocal = (x: number, y: number) => ({ dx: ((x - C.x) - (y - C.y)) / S2, dy: ((x - C.x) + (y - C.y)) / S2 });
  type LBox = { dx0: number; dx1: number; dy0: number; dy1: number; z0: number; z1: number };
  const lbox = (s: Solid): LBox => {
    const b: LBox = { dx0: Infinity, dx1: -Infinity, dy0: Infinity, dy1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const f of tessellateAll(s)) for (const p of f.pts) {
      const l = toLocal(p.x, p.y);
      b.dx0 = Math.min(b.dx0, l.dx); b.dx1 = Math.max(b.dx1, l.dx); b.dy0 = Math.min(b.dy0, l.dy); b.dy1 = Math.max(b.dy1, l.dy); b.z0 = Math.min(b.z0, p.z); b.z1 = Math.max(b.z1, p.z);
    }
    return b;
  };
  const apart = (a: Solid, b: Solid) => { const p = lbox(a), q = lbox(b); return p.dx1 <= q.dx0 + 1e-4 || q.dx1 <= p.dx0 + 1e-4 || p.dy1 <= q.dy0 + 1e-4 || q.dy1 <= p.dy0 + 1e-4 || p.z1 <= q.z0 + 1e-4 || q.z1 <= p.z0 + 1e-4; };
  type Beam = Solid & { kind: "beam" };
  type Poly = Solid & { kind: "poly" };
  const beams = (w: number, mat: string, h = w) => out.filter((s): s is Beam => s.kind === "beam" && s.w === w && s.h === h && s.mat === mat);
  type P3 = { dx: number; dy: number; z: number };
  const pt = (b: Beam, end: "from" | "to") => ({ ...toLocal(b[end].x, b[end].y), z: b[end].z });
  const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
  const polyAt = (mat: string, z: number) => out.find((s): s is Poly => s.kind === "poly" && s.mat === mat && Math.abs(s.z - z) < EPS);
  const ends = (b: Beam): [P3, P3] => { const f = pt(b, "from"), t = pt(b, "to"); return f.dx <= t.dx ? [f, t] : [t, f]; };
  const byZ = (b: Beam): [P3, P3] => { const f = pt(b, "from"), t = pt(b, "to"); return f.z <= t.z ? [f, t] : [t, f]; };

  const legs = beams(0.7, "office");
  const cordones = beams(0.5, "office").sort((a, b) => pt(a, "from").dy - pt(b, "from").dy);
  const cordonRueda = (sy: number) => cordones[sy < 0 ? 0 : 1]!;
  const sup = polyAt("office", 11)!, casa = polyAt("whitewash", 3.4)!;
  const descarga = beams(0.4, "office").filter((b) => pt(b, "from").dx < 0).sort((a, b) => pt(a, "from").dy - pt(b, "from").dy);
  const escudo = polyAt("office", 9.2)!, tolva = polyAt("rust", 5)!, cortina = polyAt("steel", 7.5)!;
  const tambor = out.find((s): s is Beam => s.kind === "beam" && s.mat === "steel" && s.w === 1)!;
  const cabina = polyAt("steel", 9.5)!, techo = polyAt("steel", 11.7)!;

  it("mástil en A: 2 brazos de 0.7 en tramos cortados en z 11..16 y 3 travesaños", () => {
    expect(legs).toHaveLength(4);
    const segs = legs.map((b) => { const [lo, hi] = byZ(b); return { sy: Math.sign(lo.dy), lo, hi }; });
    const z = (sy: number) => segs.filter((s) => s.sy === sy).map((s) => [s.lo.z, s.hi.z]).sort((a, b) => a[0]! - b[0]!);
    expect(z(1)).toEqual([[3.4, 11], [16, 20]]);
    expect(z(-1)).toEqual([[6.1, 11], [16, 20]]);
    for (const s of segs) { const t = (s.lo.z - 3.4) / 16.6; near(s.lo.dx, -2 + t); near(s.lo.dy, s.sy * 2.5 * (1 - t)); }
    const trav = beams(0.3, "office").filter((b) => b.from.z === b.to.z);
    expect(trav.map((b) => b.from.z).sort((a, b) => a - b)).toEqual([7, 9.5, 18]);
    for (const b of trav) { const [p, q] = ends(b).sort((a, c) => a.dy - c.dy); near(p!.dy, -q!.dy); expect(q!.dy).toBeGreaterThan(0); }
  });

  it("2 tirantes de (−1, 0, 20) a E(12)+0.4 y E(21)+0.4", () => {
    const ti = beams(0.3, "office").filter((b) => b.from.z !== b.to.z);
    expect(ti).toHaveLength(2);
    const fin = ti.map((b) => { const f = pt(b, "from"), t = pt(b, "to"); return f.z > t.z ? [f, t] : [t, f]; }).sort((a, b) => a[1]!.dx - b[1]!.dx);
    for (const [a] of fin) { near(a!.dx, -1); near(a!.dy, 0); near(a!.z, 20); }
    near(fin[0]![1]!.dx, 12); near(fin[0]![1]!.z, E(12) + 0.4); near(fin[1]![1]!.dx, 21); near(fin[1]![1]!.z, E(21) + 0.4);
  });

  it("pórtico intermedio: 2 patas de 0.4 en dx 12 hasta z 20 y travesaño", () => {
    const po = beams(0.4, "office").filter((b) => Math.abs(pt(b, "from").dx - 12) < 1e-3 && Math.abs(pt(b, "to").dx - 12) < 1e-3);
    expect(po).toHaveLength(3);
    const patas = po.filter((b) => b.from.z !== b.to.z);
    expect(patas).toHaveLength(2);
    for (const b of patas) { const [lo, hi] = byZ(b); near(lo!.z, E(12) + 0.25); near(hi!.z, 20); near(Math.abs(lo!.dy), 1.6); }
    const tr = po.find((b) => b.from.z === b.to.z)!;
    near(tr.from.z, 20); near(Math.abs(pt(tr, "from").dy), 1.6); near(pt(tr, "from").dy, -pt(tr, "to").dy);
  });

  it("viga superior 0.6 de (−1,0,20) a (−20,0,20) y cajón office con tope z 20", () => {
    const [v] = beams(0.6, "office");
    expect(v).toBeDefined();
    const [a, b] = ends(v!);
    near(a!.dx, -20); near(b!.dx, -1); near(a!.z, 20); near(b!.z, 20); near(a!.dy, 0);
    const caj = polyAt("office", 18.5)!;
    expect(caj.z + caj.h).toBeCloseTo(20, 6);
    const l = lbox(caj); near(l.dx0, -22); near(l.dx1, -20); near(l.dy0, -0.75); near(l.dy1, 0.75);
  });

  it("superestructura office dx −6..3, dy ±3, z 11..16 con fachada grid y cartel whitewash en la arista 2", () => {
    expect(sup).toBeDefined();
    expect(sup.h).toBeCloseTo(5, 6);
    expect(sup.facade).toEqual({ floors: 1, cols: 4, window: { w: 0.7, h: 0.4 }, grid: { cols: 2, rows: 1 } });
    const l = lbox({ ...sup, facade: undefined, plates: undefined }); near(l.dx0, -6); near(l.dx1, 3); near(l.dy0, -3); near(l.dy1, 3);
    expect(sup.plates).toHaveLength(1);
    const p = sup.plates![0]!;
    expect(p).toMatchObject({ wall: 2, shape: "rect", mat: "whitewash", z0: 14.6, z1: 15.6 });
    near((p.u1 - p.u0) * 9, 3); near((p.u0 + p.u1) / 2, 0.5);
  });

  it("pluma de la rueda: 2 cordones de 0.5 hasta el eje, 6 diagonales de 0.2 en zigzag", () => {
    expect(cordones).toHaveLength(2);
    for (const sy of [-1, 1]) { const [a, b] = ends(cordonRueda(sy)); near(a!.dx, 4.5); near(a!.dy, sy * 1.6); near(a!.z, 17); near(b!.dx, axleDx); near(b!.dy, sy * 1.6); near(b!.z, axleZ); }
    const diag = beams(0.2, "office").filter((b) => pt(b, "from").dx > 0);
    expect(diag).toHaveLength(6);
    const sorted = diag.map((b) => ends(b)).sort((a, b) => a[0]!.dx - b[0]!.dx);
    sorted.forEach(([a, b], k) => {
      near(a!.dx, 4.5 + 3 * k); near(b!.dx, 4.5 + 3 * (k + 1)); near(a!.z, E(a!.dx)); near(b!.z, E(b!.dx));
      near(Math.abs(a!.dy), 1.6); near(a!.dy, -b!.dy);
      if (k > 0) near(a!.dy, sorted[k - 1]![1]!.dy);
    });
  });

  it("cinta steel 2.6 × 0.2 de dx 4.5 a 19.5, 0.15 bajo el eje; 2 rodillos en V en dx 15", () => {
    const cinta = out.find((s): s is Beam => s.kind === "beam" && s.mat === "steel" && s.w === 2.6)!;
    expect(cinta.h).toBe(0.2);
    const [a, b] = ends(cinta); near(a!.dx, 4.5); near(a!.z, 16.85); near(b!.dx, 19.5); near(b!.z, E(19.5) - 0.15);
    const rod = beams(0.2, "steel");
    expect(rod).toHaveLength(2);
    for (const r of rod) { const [p, q] = [pt(r, "from"), pt(r, "to")]; near(p.dx, 15); near(q.dx, 15); }
    const e = E(15);
    const ys = rod.map((r) => [pt(r, "from"), pt(r, "to")]).flat();
    expect(ys.filter((p) => Math.abs(p.dy) < 1e-6).every((p) => Math.abs(p.z - e) < 1e-6)).toBe(true);
    expect(ys.filter((p) => Math.abs(Math.abs(p.dy) - 1.3) < 1e-6).every((p) => Math.abs(p.z - (e + 0.35)) < 1e-6)).toBe(true);
  });

  it("pasarela office 0.6 y baranda safety 0.15 sobre el cordón dy +1.6, dx 4.5..15", () => {
    const pas = out.find((s): s is Beam => s.kind === "beam" && s.mat === "office" && s.w === 0.6 && s.h === 0.15)!;
    const [a, b] = ends(pas); near(a!.dx, 4.5); near(b!.dx, 15); near(a!.dy, 1.6); near(a!.z, 17.33); near(b!.z, E(15) + 0.33);
    const ba = out.find((s): s is Beam => s.kind === "beam" && s.mat === "safety" && s.w === 0.15 && Math.min(s.from.z, s.to.z) > 10)!;
    const [c, d] = ends(ba); near(c!.dx, 4.5); near(d!.dx, 15); near(c!.dy, 1.85); near(c!.z, 18.33); near(d!.z, E(15) + 1.33);
  });

  it("escudo en dy < −0.3; tolva, cortina y tambor en dy ≤ −0.3", () => {
    const l = lbox({ ...escudo, plates: undefined }); near(l.dx0, axleDx); near(l.dx1, axleDx + 6); near(l.dy0, -0.8); near(l.dy1, -0.5); near(l.z0, 9.2); near(l.z1, 15.2);
    expect(tolva.mat).toBe("rust"); expect(cortina.mat).toBe("steel");
    for (const s of [escudo, tolva, cortina, tambor]) expect(lbox(s).dy1).toBeLessThanOrEqual(-0.3 + 1e-4);
    const t = lbox(tolva); near(t.dx0, 21.1); near(t.dx1, 24.1); near(t.dy0, -1.3); near(t.z1, 7.5);
    const c = lbox(cortina); near(c.dx0, 21.6); near(c.dx1, 23.6); near(c.dy0, -0.5); near(c.z1, 10);
    const [a, b] = [pt(tambor, "from"), pt(tambor, "to")]; near(a.dx, 20); near(b.dx, 20); near(a.z, E(20)); near(Math.min(a.dy, b.dy), -1.3); near(Math.max(a.dy, b.dy), -0.3);
  });

  it("pluma de descarga: 2 cordones de 0.4 de dx −5.2 a −24, diagonales cada 3 u y tolva colgante", () => {
    expect(descarga).toHaveLength(2);
    for (const [k, sy] of [-1, 1].entries()) { const [a, b] = ends(descarga[k]!); near(a!.dx, -24); near(a!.dy, sy * 1.2); near(a!.z, 4); near(b!.dx, -5.2); near(b!.z, 5.88); }
    const diag = beams(0.2, "office").filter((b) => pt(b, "from").dx < 0);
    expect(diag).toHaveLength(6);
    for (const d of diag) { const [a, b] = ends(d); near(Math.abs(a!.dy), 1.2); near(a!.dy, -b!.dy); near(b!.dx - a!.dx, 3); }
    const th = out.find((s): s is Poly => s.kind === "poly" && s.mat === "rust" && s.z === 2)!;
    const l = lbox(th); near(l.dx0, -25); near(l.dx1, -23); near(l.dy0, -1); near(l.dy1, 1); near(l.z1, 4);
  });

  it("cabina steel con fachada de 2 pisos × 3 y techo con alero; 3 acentos amber r 0.6", () => {
    expect(cabina.facade).toEqual({ floors: 2, cols: 3, window: { w: 0.7, h: 0.6 } });
    const l = lbox({ ...cabina, facade: undefined }); near(l.dx0, 13); near(l.dx1, 15.5); near(l.dy0, 1.5); near(l.dy1, 3.5); near(l.z1, 11.7);
    const t = lbox(techo); near(t.dx0, 12.75); near(t.dx1, 15.65); near(t.dy0, 1.25); near(t.dy1, 3.75); near(t.z1, 11.9);
    expect(accents).toHaveLength(3);
    [13.5, 14.25, 15].forEach((dx, k) => {
      const a = accents[k]!;
      if (a.kind !== "dot") throw new Error("no es dot");
      expect(a).toMatchObject({ color: "amber", r: 0.6 }); near(a.at.z, 12);
      const p = local(dx, 3.5); near(a.at.x, p.x); near(a.at.y, p.y);
    });
  });

  it("ningún sólido supera z 20.5 y ninguna pieza mide menos de 0.15", () => {
    for (const s of out) {
      const { min, max } = bounds(s);
      expect(max.z).toBeLessThanOrEqual(20.5);
      for (const k of ["x", "y", "z"] as const) expect(max[k] - min[k], `${s.kind}`).toBeGreaterThanOrEqual(0.15 - 1e-9);
    }
  });

  it("nada estático entero en dy > 0 cae en el disco de la rueda en pantalla salvo el cordón dy +1.6", () => {
    const w = EXCAVATOR.wheel, R = w.r + w.buckets.depth, c = project({ x: local(axleDx, 0).x, y: local(axleDx, 0).y, z: axleZ });
    const a = R * S2, b = R * Z_SCALE;
    for (const s of out) {
      if (lbox({ ...s, plates: undefined } as Solid).dy0 <= EPS) continue;
      if (s === cordonRueda(1)) continue;
      for (const f of tessellateAll(s)) for (const p of f.pts) {
        const q = project(p);
        expect(((q.x - c.x) / a) ** 2 + ((q.y - c.y) / b) ** 2, `${s.kind} ${"mat" in s ? s.mat : ""}`).toBeGreaterThanOrEqual(1 - 1e-9);
      }
    }
  });

  it("las piezas nombradas no se pisan en el marco local", () => {
    const pairs: [string, Solid, Solid][] = [["superestructura/casa", sup, casa]];
    for (const d of descarga) pairs.push(["casa/cordón de descarga", casa, d]);
    for (const c of cordones) pairs.push(["tambor/cordón", tambor, c]);
    pairs.push(["casa/tolva colgante", casa, out.find((s) => s.kind === "poly" && s.mat === "rust" && s.z === 2)!], ["escudo/cortina", escudo, cortina], ["escudo/tolva", escudo, tolva], ["cortina/tolva", cortina, tolva], ["cabina/techo", cabina, techo]);
    for (const [n, a, b] of pairs) expect(apart(a, b), n).toBe(true);
    // la cabina y su techo pasan bajo el cordón dy +1.6 (que se inclina): el fondo del cordón en su tramo de dx queda sobre el techo
    const [p, q] = ends(cordonRueda(1)), slope = (q!.z - p!.z) / (q!.dx - p!.dx), half = 0.25 * Math.sqrt(1 + slope * slope);
    for (const [n, x] of [["cabina", cabina], ["techo", techo]] as const) { const l = lbox(x); expect(p!.z + slope * (l.dx1 - p!.dx) - half, `${n}/cordón`).toBeGreaterThanOrEqual(l.z1 - 1e-6); }
  });

  // Pares (abajo ← arriba) que `sortByDepth` con rumbo 0 no puede ordenar: las cajas alineadas al mundo de las vigas a 45° se inflan y forman ciclos que se cortan.
  // Quedan fijados a propósito: si el orden mejora o empeora, el test lo marca. Los pares solo del chasis (Task 2) no se evalúan.
  const PAINTER_CONOCIDOS: string[] = [
    "4:poly/rust después de 28:beam/office",
    "4:poly/rust después de 61:beam/office",
    "4:poly/rust después de 62:beam/office",
    "9:poly/office después de 30:beam/office",
    "9:poly/office después de 32:beam/office",
    "9:poly/office después de 33:beam/office",
    "9:poly/office después de 35:poly/office",
    "9:poly/office después de 39:beam/office",
    "9:poly/office después de 40:beam/office",
    "9:poly/office después de 47:beam/steel",
    "9:poly/office después de 53:beam/office",
    "9:poly/office después de 61:beam/office",
    "9:poly/office después de 62:beam/office",
    "9:poly/office después de 63:beam/office",
    "9:poly/office después de 64:beam/office",
    "10:beam/safety después de 39:beam/office",
    "10:beam/safety después de 40:beam/office",
    "10:beam/safety después de 53:beam/office",
    "10:beam/safety después de 63:beam/office",
    "19:poly/safety después de 39:beam/office",
    "19:poly/safety después de 40:beam/office",
    "19:poly/safety después de 47:beam/steel",
    "19:poly/safety después de 53:beam/office",
    "25:poly/rust después de 32:beam/office",
    "25:poly/rust después de 33:beam/office",
    "25:poly/rust después de 35:poly/office",
    "25:poly/rust después de 53:beam/office",
    "26:beam/safety después de 62:beam/office",
    "28:beam/office después de 52:beam/office",
    "61:beam/office después de 35:poly/office",
    "70:poly/steel después de 44:beam/office",
    "70:poly/steel después de 52:beam/office",
    "71:poly/steel después de 52:beam/office",
  ];
  it("orden painter: lo que se solapa en pantalla y está separado en z va de abajo hacia arriba (salvo los ciclos conocidos)", () => {
    const sorted = sortByDepth(out), pos = new Map(sorted.map((s, i) => [s, i])), first = out.indexOf(legs[0]!);
    const name = (k: number) => `${k}:${out[k]!.kind}/${"mat" in out[k]! ? out[k]!.mat : ""}`;
    const bad: string[] = [];
    for (let i = 0; i < out.length; i++) for (let j = 0; j < out.length; j++) {
      if (i === j || (i < first && j < first)) continue;
      const a = bounds(out[i]!), b = bounds(out[j]!);
      if (a.max.z > b.min.z + EPS || !overlaps(screenBounds(a), screenBounds(b))) continue;
      if (pos.get(out[i]!)! > pos.get(out[j]!)!) bad.push(`${name(i)} después de ${name(j)}`);
    }
    expect(bad).toEqual(PAINTER_CONOCIDOS);
  });

  it("excavatorBox contiene todos los bounds y la envolvente de la rueda", () => {
    const box = excavatorBox(), w = EXCAVATOR.wheel, ax = local(axleDx, 0), R = (w.r + w.buckets.depth) * Math.SQRT1_2;
    for (const s of out) { const b = bounds(s); expect(b.min.x).toBeGreaterThanOrEqual(box.x0 - EPS); expect(b.max.x).toBeLessThanOrEqual(box.x1 + EPS); expect(b.min.y).toBeGreaterThanOrEqual(box.y0 - EPS); expect(b.max.y).toBeLessThanOrEqual(box.y1 + EPS); }
    expect(box.x0).toBeLessThanOrEqual(ax.x - R + EPS); expect(box.x1).toBeGreaterThanOrEqual(ax.x + R - EPS);
    expect(box.y0).toBeLessThanOrEqual(ax.y - R + EPS); expect(box.y1).toBeGreaterThanOrEqual(ax.y + R - EPS);
  });
});
