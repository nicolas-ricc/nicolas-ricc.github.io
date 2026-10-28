import { describe, expect, it } from "vitest";
import { accentItem, type Accent } from "./accent";
import { v3 } from "./geometry";
import { bounds, tessellateAll, type Solid } from "./solids";
import { translate, translateAccent } from "./translate";

const DX = 7, DY = -4;

// Coordenadas de posición diádicas: con desplazamientos enteros la ida y vuelta es exacta.
const SOLIDS: [string, Solid][] = [
  ["prism con facade y plates", { kind: "prism", at: v3(1, 2, 0.5), w: 4, d: 3, h: 2, mat: "concrete", facade: { floors: 2, cols: 3 }, plates: [{ wall: 2, shape: "rect", u0: 0.25, u1: 0.5, z0: 0.75, z1: 1.5, mat: "steel" }] }],
  ["prism gable", { kind: "prism", at: v3(-3, 1, 0), w: 6, d: 4, h: 3, mat: "brick", roof: "gable" }],
  ["poly con facade", { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 3 }, { x: 1, y: 4 }], z: 0.5, h: 3, mat: "concrete", facade: { floors: 1, cols: 2 } }],
  ["ramp con plates", { kind: "ramp", at: v3(2, -1, 0.25), w: 3, d: 2, h: 1, mat: "concrete", dir: "e", plates: [{ wall: 2, shape: "disc", u0: 0.25, u1: 0.75, z0: 0.25, z1: 0.75, mat: "steel" }] }],
  ["cylinder", { kind: "cylinder", at: v3(5, 5, 1), r: 2, h: 6, mat: "steel", sides: 12 }],
  ["cone", { kind: "cone", at: v3(-2, 3, 4), r: 1.5, h: 2, mat: "steel" }],
  ["beam", { kind: "beam", from: v3(0, 0, 2), to: v3(6, 3, 4.5), w: 0.5, h: 0.25, mat: "steel" }],
  ["hull con heading", { kind: "hull", at: v3(10, -6, 0), len: 12, beam: 4, h: 1.5, mat: "steel", topMat: "concrete", heading: 0.6 }],
  ["strip", { kind: "strip", path: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], width: 1, z: 0.25, mat: "concrete" }],
  ["ground", { kind: "ground", mat: "sand", tris: [
    { pts: [v3(0, 0, 0), v3(4, 0, 0.5), v3(0, 4, 1.5)], toneOffset: -1 },
    { pts: [v3(4, 0, 0.5), v3(4, 4, 1), v3(0, 4, 1.5)], baseTone: 2 },
  ] }],
  ["wheel con buckets y gondolas", { kind: "wheel", at: v3(3, 4, 8), r: 5, width: 0.5, mat: "steel", sides: 8, angle: 0.25, buckets: { n: 6, depth: 1, teeth: 2, mat: "steel" }, gondolas: { mat: "glass", w: 1, d: 1, h: 1 } }],
  ["wheel hollow", { kind: "wheel", at: v3(3, 4, 8), r: 5, width: 0.5, mat: "steel", sides: 8, angle: 0.25, hollow: true, slots: 4 }],
];

const ACCENTS: [string, Accent][] = [
  ["dot", { kind: "dot", at: v3(2, 3, 4.5), r: 1.5, color: "amber" }],
  ["poly", { kind: "poly", pts: [v3(0, 0, 1), v3(2, 0, 1), v3(2, 1, 3)], color: "cyan", alpha: 0.5 }],
];

const byName = (name: string): Solid => SOLIDS.find(([n]) => n === name)![1];

describe("translate", () => {
  it("las fixtures cubren los diez kind", () => {
    expect(new Set(SOLIDS.map(([, s]) => s.kind)).size).toBe(10);
  });

  for (const [name, s] of SOLIDS) {
    describe(name, () => {
      it("bounds se desplaza en x/y y no en z", () => {
        const a = bounds(s), b = bounds(translate(s, DX, DY));
        expect(b.min.x).toBeCloseTo(a.min.x + DX, 9); expect(b.max.x).toBeCloseTo(a.max.x + DX, 9);
        expect(b.min.y).toBeCloseTo(a.min.y + DY, 9); expect(b.max.y).toBeCloseTo(a.max.y + DY, 9);
        expect(b.min.z).toBeCloseTo(a.min.z, 9); expect(b.max.z).toBeCloseTo(a.max.z, 9);
      });

      it("las caras son las mismas con cada vértice desplazado", () => {
        const a = tessellateAll(s), b = tessellateAll(translate(s, DX, DY));
        expect(b).toHaveLength(a.length);
        a.forEach((f, i) => {
          const g = b[i]!;
          expect(g.pts).toHaveLength(f.pts.length);
          f.pts.forEach((p, j) => {
            expect(g.pts[j]!.x).toBeCloseTo(p.x + DX, 9);
            expect(g.pts[j]!.y).toBeCloseTo(p.y + DY, 9);
            expect(g.pts[j]!.z).toBeCloseTo(p.z, 9);
          });
          expect(g.normal.x).toBeCloseTo(f.normal.x, 9);
          expect(g.normal.y).toBeCloseTo(f.normal.y, 9);
          expect(g.normal.z).toBeCloseTo(f.normal.z, 9);
          expect(g.mat).toBe(f.mat);
          expect(g.tone).toBe(f.tone);
          expect(g.toneOffset).toBe(f.toneOffset);
        });
      });

      it("ida y vuelta vuelve al original", () => {
        expect(translate(translate(s, DX, DY), -DX, -DY)).toEqual(s);
      });

      it("no muta el original", () => {
        const copy = structuredClone(s);
        translate(s, DX, DY);
        expect(s).toEqual(copy);
      });

      it("desplazamiento nulo: objeto nuevo e igual", () => {
        const t = translate(s, 0, 0);
        expect(t).not.toBe(s);
        expect(t).toEqual(s);
      });
    });
  }

  it("los puntos movidos no son los del original", () => {
    const prism = byName("prism con facade y plates") as Solid & { kind: "prism" };
    expect((translate(prism, 0, 0) as typeof prism).at).not.toBe(prism.at);
    const beam = byName("beam") as Solid & { kind: "beam" };
    const tb = translate(beam, 0, 0) as typeof beam;
    expect(tb.from).not.toBe(beam.from);
    expect(tb.to).not.toBe(beam.to);
    const poly = byName("poly con facade") as Solid & { kind: "poly" };
    const tp = translate(poly, 0, 0) as typeof poly;
    expect(tp.footprint).not.toBe(poly.footprint);
    expect(tp.footprint[0]).not.toBe(poly.footprint[0]);
    const strip = byName("strip") as Solid & { kind: "strip" };
    const ts = translate(strip, 0, 0) as typeof strip;
    expect(ts.path).not.toBe(strip.path);
    expect(ts.path[0]).not.toBe(strip.path[0]);
    const ground = byName("ground") as Solid & { kind: "ground" };
    const tg = translate(ground, 0, 0) as typeof ground;
    expect(tg.tris).not.toBe(ground.tris);
    expect(tg.tris[0]).not.toBe(ground.tris[0]);
    expect(tg.tris[0]!.pts[0]).not.toBe(ground.tris[0]!.pts[0]);
  });

  it("lo que no depende de la posición se copia tal cual", () => {
    const prism = byName("prism con facade y plates") as Solid & { kind: "prism" };
    const tp = translate(prism, DX, DY) as typeof prism;
    expect(tp.plates).toBe(prism.plates);
    expect(tp.facade).toBe(prism.facade);
    const hull = translate(byName("hull con heading"), DX, DY) as Solid & { kind: "hull" };
    expect(hull.heading).toBe(0.6);
    const wheel = byName("wheel con buckets y gondolas") as Solid & { kind: "wheel" };
    const tw = translate(wheel, DX, DY) as typeof wheel;
    expect(tw.buckets).toEqual(wheel.buckets);
    expect(tw.gondolas).toEqual(wheel.gondolas);
  });
});

describe("translateAccent", () => {
  // project es lineal: sx += dx − dy, sy += (dx + dy)/2.
  const SX = DX - DY, SY = (DX + DY) / 2;

  for (const [name, a] of ACCENTS) {
    describe(name, () => {
      it("proyecta como el original desplazado", () => {
        const p = accentItem(a), q = accentItem(translateAccent(a, DX, DY));
        if (p.kind === "dot" && q.kind === "dot") {
          expect(q.x).toBeCloseTo(p.x + SX, 9);
          expect(q.y).toBeCloseTo(p.y + SY, 9);
          expect(q.r).toBe(p.r);
          expect(q.color).toBe(p.color);
        } else if (p.kind === "poly" && q.kind === "poly") {
          expect(q.pts).toHaveLength(p.pts.length);
          p.pts.forEach((v, i) => expect(q.pts[i]!).toBeCloseTo(v + (i % 2 === 0 ? SX : SY), 9));
          expect(q.color).toBe(p.color);
          expect(q.alpha).toBe(p.alpha);
        } else expect(q.kind).toBe(p.kind);
      });

      it("ida y vuelta vuelve al original", () => {
        expect(translateAccent(translateAccent(a, DX, DY), -DX, -DY)).toEqual(a);
      });

      it("no muta el original", () => {
        const copy = structuredClone(a);
        translateAccent(a, DX, DY);
        expect(a).toEqual(copy);
      });

      it("desplazamiento nulo: objeto nuevo e igual", () => {
        const t = translateAccent(a, 0, 0);
        expect(t).not.toBe(a);
        expect(t).toEqual(a);
      });
    });
  }

  it("los puntos movidos no son los del original", () => {
    const dot = ACCENTS[0]![1] as Accent & { kind: "dot" };
    expect((translateAccent(dot, 0, 0) as typeof dot).at).not.toBe(dot.at);
    const poly = ACCENTS[1]![1] as Accent & { kind: "poly" };
    const tp = translateAccent(poly, 0, 0) as typeof poly;
    expect(tp.pts).not.toBe(poly.pts);
    expect(tp.pts[0]).not.toBe(poly.pts[0]);
  });
});
