import { describe, expect, it } from "vitest";
import { bounds, tessellate, tessellateAll, type Solid } from "../iso/solids";
import { VIEW_DIR } from "../iso/project";
import { createRng } from "../map/seed";
import { EXCAVATOR, excavator, excavatorWheel, local } from "./excavator";
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
    const rails = out.filter((s) => s.kind === "beam" && s.mat === "safety" && s.w === 0.15);
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
