import { describe, expect, it } from "vitest";
import { sortByDepth } from "../iso/depth";
import { bounds, type Plate, type Solid } from "../iso/solids";
import { METAL_STACK_X, NAVE, STAIR_TOWER, boilerHouse, gableEnd, inclineBelt, metalStacks, naveBody, stairTower } from "./boiler-house";

type Kind<K extends Solid["kind"]> = Solid & { kind: K };
const build = (f: (out: Solid[]) => void): Solid[] => { const out: Solid[] = []; f(out); return out; };
const prisms = (ss: Solid[]) => ss.filter((s): s is Kind<"prism"> => s.kind === "prism");
const beams = (ss: Solid[]) => ss.filter((s): s is Kind<"beam"> => s.kind === "beam");
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const PIER_X = Array.from({ length: 12 }, (_, k) => NAVE.x + (k * NAVE.w) / 11);

describe("nave de calderas: cuerpo", () => {
  const body = build(naveBody);

  it("muros: dos prismas apilados con fachada de 11 y 22 columnas, parteluces 3 × 4, dintel recto y entramado rust", () => {
    const walls = prisms(body).filter((p) => p.mat === "brick" && p.at.x === 44 && p.at.y === -46 && p.w === 76 && p.d === 30 && p.h === 7);
    expect(walls.map((w) => w.at.z).sort((a, b) => a - b)).toEqual([0, 7]);
    for (const w of walls) {
      expect(w.facade).toMatchObject({ floors: 1, window: { w: 0.6, h: 0.55 }, grid: { cols: 3, rows: 4 }, head: "flat", courses: { mat: "rust", h: 0.4 } });
      expect(w.facade!.cols).toBe(w.at.z === 0 ? 11 : 22);
    }
  });

  it("12 pilastras rust salientes del muro sur, con zapata sobre el zócalo, montante de celosía y ménsula", () => {
    const piers = prisms(body).filter((p) => p.mat === "rust" && p.w === 0.5 && p.d === 0.5);
    expect(piers).toHaveLength(12);
    for (const [k, p] of piers.entries()) {
      const b = bounds(p);
      expect(b.min.x + 0.25).toBeCloseTo(PIER_X[k]!, 6);
      expect(b.min.y).toBe(-16); expect(b.max.y).toBe(-15.5);
      expect(b.min.z).toBeCloseTo(4.1, 6); expect(b.max.z).toBe(14);
    }
    const feet = prisms(body).filter((p) => p.mat === "concrete" && p.w === 0.9 && p.d === 0.9 && p.h === 0.6);
    expect(feet).toHaveLength(12);
    for (const f of feet) { expect(f.at.z).toBe(3.5); expect(f.at.y).toBe(-16); }
    expect(prisms(body).filter((p) => p.mat === "rust" && p.w === 0.15 && p.d === 0.15 && p.at.y === -16)).toHaveLength(12);
    const brackets = beams(body).filter((b) => b.mat === "rust" && b.w === 0.3);
    expect(brackets).toHaveLength(12);
    for (const b of brackets) { expect(b.from.y).toBe(-15.85); expect(bounds(b).min.y).toBeGreaterThanOrEqual(-16); expect(b.to.y - b.from.y).toBeGreaterThanOrEqual(0.7 - 1e-9); /* diagonal, sin entrar en el muro */ expect(b.to.z).toBeGreaterThan(b.from.z); expect(b.to.y).toBeGreaterThan(b.from.y); }
  });

  it("banda de celosía de ladrillo en damero bajo el alero, en los muros sur y este del prisma alto", () => {
    const upper = prisms(body).find((p) => p.mat === "brick" && p.at.z === 7 && p.w === 76)!;
    const plates: Plate[] = upper.plates ?? [];
    const on = (wall: number) => plates.filter((p) => p.wall === wall && p.mat === "brick" && p.toneOffset === -2 && p.z0 === 12.8 && p.z1 === 13.6);
    expect(on(2)).toHaveLength(76);
    expect(on(1)).toHaveLength(30);
    for (const p of on(2)) expect((p.u1 - p.u0) * 76).toBeCloseTo(0.5, 6);
  });

  it("zócalo whitewash adosado al muro sur con ventanales en cuadrícula y 20 tubos alternados", () => {
    const plinth = prisms(body).find((p) => p.mat === "whitewash" && p.h === 3.5)!;
    expect(plinth).toMatchObject({ at: { x: 44, y: -16, z: 0 }, w: 76, d: 1.5 });
    expect(plinth.facade).toMatchObject({ floors: 1, cols: 20, window: { w: 0.7, h: 0.6 }, grid: { cols: 4, rows: 5 } });
    const tubes = body.filter((s): s is Kind<"cylinder"> => s.kind === "cylinder" && s.r === 0.3 && s.h === 0.8);
    expect(tubes).toHaveLength(20);
    expect(tubes.map((t) => t.mat)).toEqual(Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? "whitewash" : "rust")));
    for (const t of tubes) { expect(t.at.z).toBe(3.5); expect(t.at.y - t.r).toBeGreaterThanOrEqual(-15.1 - 1e-9); expect(t.at.y + t.r).toBeLessThanOrEqual(-14.5 + 1e-9); }
  });

  it("techo de pizarra a dos aguas con cumbrera E-O a z 17, alero sur, remate claro y 4 caperuzas", () => {
    const roof = body.filter((s): s is Kind<"ramp"> => s.kind === "ramp");
    for (const r of roof) { expect(r.mat).toBe("steel"); expect(r.at.z).toBe(14); expect(r.h).toBe(3); }
    const south = roof.filter((r) => r.dir === "s"), north = roof.filter((r) => r.dir === "n");
    expect(south).toHaveLength(1);
    expect(south[0]!.at).toEqual({ x: 44, y: -31, z: 14 }); expect(south[0]!.w).toBe(75.5); expect(south[0]!.at.y + south[0]!.d).toBeCloseTo(-15.4, 6);
    // faldón norte en tramos E-O, cada uno con su chimenea metálica cerca del centro (orden de pintado)
    expect(north.map((r) => [r.at.x, r.at.x + r.w])).toEqual([[44, 62.5], [62.5, 77.5], [77.5, 92.5], [92.5, 107.5], [107.5, 119.5]]);
    for (const r of north) { expect(r.at.y).toBeCloseTo(-46.6, 6); expect(r.at.y + r.d).toBeCloseTo(-31, 6); }
    expect(prisms(body).some((p) => p.mat === "whitewash" && p.at.y === -15.4 && near(p.d, 0.3) && near(p.h, 0.3))).toBe(true); // remate sur
    const vents = prisms(body).filter((p) => p.mat === "steel" && p.w === 1.2 && p.d === 1.2 && p.h === 0.8);
    expect(vents).toHaveLength(4);
    for (const v of vents) { expect(v.at.z).toBe(17); expect(v.at.y).toBeCloseTo(-31.6, 6); }
  });
});

describe("nave de calderas: testero y chimeneas metálicas", () => {
  it("testero: marco whitewash y piñón escalonado de 3 niveles con tapa y celosía", () => {
    const g = build(gableEnd);
    const piers = prisms(g).filter((p) => p.mat === "whitewash" && p.w === 1 && p.d === 1);
    expect(piers.map((p) => p.at.y).sort((a, b) => a - b)).toEqual([-46, -36, -26, -17]);
    for (const p of piers) expect(p.at.x).toBe(120);
    expect(prisms(g).some((p) => p.mat === "whitewash" && p.at.x === 120 && p.w === 1 && p.d === 30 && p.at.z === 13.7)).toBe(true); // cornisa
    expect(prisms(g).filter((p) => p.mat === "whitewash" && p.at.z === 7 && near(p.h, 0.3))).toHaveLength(3); // bandas entre pilastras
    const steps = prisms(g).filter((p) => p.mat === "brick" && p.at.x === 119.5 && p.w === 1);
    expect(steps.map((s) => [s.at.y, s.at.y + s.d, s.at.z])).toEqual([[-44, -18, 14], [-38, -24, 15.5], [-33, -29, 17]]);
    for (const s of steps) {
      expect(near(s.h, 1.2)).toBe(true);
      expect(prisms(g).some((c) => c.mat === "whitewash" && c.at.x === 119.5 && c.at.y === s.at.y && c.d === s.d && near(c.at.z, s.at.z + 1.2) && near(c.h, 0.3))).toBe(true);
      expect((s.plates ?? []).filter((p) => p.wall === 1 && p.toneOffset === -2).length).toBeGreaterThan(0);
    }
    for (const s of g) expect(bounds(s).max.z).toBeLessThanOrEqual(20);
  });

  it("cuatro chimeneas metálicas rust en fila sobre el faldón norte, con 4 tensores cada una, sin humo", () => {
    const m = build(metalStacks);
    const stacks = m.filter((s): s is Kind<"cylinder"> => s.kind === "cylinder");
    expect(stacks.map((s) => s.at.x)).toEqual([...METAL_STACK_X]);
    expect(METAL_STACK_X).toEqual([55, 70, 85, 100]);
    for (const s of stacks) expect(s).toMatchObject({ mat: "rust", r: 0.5, h: 6, at: { y: -33, z: 16.6 } });
    const guys = beams(m);
    expect(guys).toHaveLength(16);
    for (const g of guys) { expect(g.w).toBe(0.15); expect(g.h).toBe(0.15); expect(g.mat).toBe("rust"); expect(g.to.z).toBeLessThan(g.from.z); }
    for (const g of guys) expect(bounds(g).max.y).toBeLessThanOrEqual(-31); // no pisan el faldón sur
  });

  it("las chimeneas metálicas y sus tensores se pintan después del faldón norte que pisan", () => {
    const order = sortByDepth(build(boilerHouse));
    const north = order.filter((s): s is Kind<"ramp"> => s.kind === "ramp" && s.dir === "n");
    const stacks = order.filter((s) => (s.kind === "cylinder" && s.mat === "rust" && s.r === 0.5) || (s.kind === "beam" && s.w === 0.15 && s.mat === "rust" && s.from.z === 21));
    expect(stacks).toHaveLength(20);
    for (const s of stacks) {
      const b = bounds(s);
      for (const r of north) if (b.min.x < r.at.x + r.w && b.max.x > r.at.x) expect(order.indexOf(s), JSON.stringify(s).slice(0, 80)).toBeGreaterThan(order.indexOf(r));
    }
  });
});

describe("nave de calderas: torre de escalera y cinta inclinada", () => {
  it("torre de escalera steel: 4 postes partidos entre 4 descansos, tramos en zigzag y baranda este y sur", () => {
    const t = build(stairTower);
    for (const s of t) {
      expect(s.mat).toBe("steel");
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(STAIR_TOWER.x0 - 1e-9); expect(b.max.x).toBeLessThanOrEqual(STAIR_TOWER.x1 + 1e-9);
      expect(b.min.y).toBeGreaterThanOrEqual(STAIR_TOWER.y0 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(STAIR_TOWER.y1 + 1e-9);
    }
    const landings = prisms(t).filter((p) => p.w === 5 && p.d === 8 && p.h === 0.25);
    expect(landings.map((l) => l.at.z)).toEqual([3.5, 7, 10.5, 14]);
    const posts = prisms(t).filter((p) => p.w === 0.4 && p.d === 0.4);
    expect(posts).toHaveLength(20);
    expect(Math.max(...posts.map((p) => p.at.z + p.h))).toBe(16);
    const flights = beams(t).filter((b) => b.w === 1);
    expect(flights).toHaveLength(4);
    expect(new Set(flights.map((f) => f.from.x)).size).toBe(2); // zigzag
    expect(beams(t).filter((b) => b.w === 0.15)).toHaveLength(8); // baranda este y sur de cada descanso
  });

  it("cinta inclinada rust desde la playa de camiones hasta una tolva colgada junto al alero, con 2 caballetes", () => {
    const c = build(inclineBelt);
    for (const s of c) expect(s.mat).toBe("rust");
    const belt = beams(c);
    expect(belt).toHaveLength(1);
    expect(belt[0]).toMatchObject({ from: { x: 50, y: -4, z: 0.5 }, to: { x: 59.7, y: -15, z: 12.5 }, w: 1.6, h: 0.6 });
    const hopper = prisms(c).find((p) => p.w === 3 && p.d === 2 && p.h === 2.5)!;
    expect(hopper.at).toEqual({ x: 58.2, y: -16, z: 11 });
    expect(prisms(c).filter((p) => p.w === 0.4 && p.d === 0.4 && p.at.z === 0)).toHaveLength(2);
  });
});

describe("nave de calderas completa", () => {
  const all = build(boilerHouse);
  it("junta las cinco partes", () => {
    expect(all.length).toBe(build(naveBody).length + build(gableEnd).length + build(metalStacks).length + build(stairTower).length + build(inclineBelt).length);
  });
  it("toda pieza de la nave mide al menos 0.15 u", () => {
    const dims = (s: Solid): number[] => {
      switch (s.kind) {
        case "prism": case "ramp": return [s.w, s.d, s.h];
        case "cylinder": return [2 * s.r, s.h];
        case "beam": return [s.w, s.h, Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y, s.to.z - s.from.z)];
        default: return [];
      }
    };
    for (const s of all) for (const d of dims(s)) expect(d, JSON.stringify(s).slice(0, 80)).toBeGreaterThanOrEqual(0.15 - 1e-9);
    for (const s of all) {
      if (s.kind !== "prism" || !s.plates) continue;
      for (const p of s.plates) {
        const len = p.wall % 2 === 0 ? s.w : s.d;
        expect((p.u1 - p.u0) * len).toBeGreaterThanOrEqual(0.15 - 1e-9);
        expect(p.z1 - p.z0).toBeGreaterThanOrEqual(0.15 - 1e-9);
      }
    }
  });
});
