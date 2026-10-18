import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { centroid, v3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { antenna, awning, beacon, bench, bollard, car, chair, container, dockCrane, fence, fountain, garland, helipad, kiosk, lamp, machineRoom, neon, patioTree, puddle, roofShrub, rooftopGarden, sign, solarPanel, streetTree, table, trafficLight, waterTank } from "./props";

const AT = v3(10, 20, 0.3);
const size = (s: Solid) => { const b = bounds(s); return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((n) => Math.round(n * 100) / 100); };
const only = (ss: Solid[]) => { expect(ss).toHaveLength(1); return ss[0]!; };

describe("props", () => {
  it("farol: poste steel 0.6×0.6×5 y bombillo ámbar r 0.6 arriba del poste", () => {
    const l = lamp(AT);
    expect(only(l.solids)).toMatchObject({ kind: "prism", at: AT, w: 0.6, d: 0.6, h: 5, mat: "steel" });
    const bulb = v3(AT.x + 0.3, AT.y + 0.3, AT.z + 5);
    expect(l.accents).toEqual([{ kind: "dot", at: bulb, r: 0.6, color: "amber" }]);
    expect(l.bulb).toEqual(bulb);
  });

  it("semáforo: poste 0.3×0.3×4 y caja officeDark 0.5×0.5×1.2 encima", () => {
    const [post, box] = trafficLight(AT);
    expect(post).toMatchObject({ kind: "prism", w: 0.3, d: 0.3, h: 4, mat: "steel" });
    expect(box).toMatchObject({ kind: "prism", at: v3(AT.x - 0.1, AT.y - 0.1, AT.z + 4), w: 0.5, d: 0.5, h: 1.2, mat: "officeDark" });
  });

  it("auto: una sola medida 3×1.5×1.2, steel o rust", () => {
    for (const mat of ["steel", "rust"] as const) expect(only(car(AT, mat))).toMatchObject({ kind: "prism", at: AT, w: 3, d: 1.5, h: 1.2, mat });
  });

  it("banco, mesa, silla de paving", () => {
    expect(only(bench(AT))).toMatchObject({ w: 2, d: 0.6, h: 0.5, mat: "paving" });
    expect(only(table(AT))).toMatchObject({ w: 1, d: 1, h: 0.7, mat: "paving" });
    expect(only(chair(AT))).toMatchObject({ w: 0.5, d: 0.5, h: 0.5, mat: "paving" });
  });

  it("bolardo, árboles y arbusto de terraza", () => {
    expect(only(bollard(AT))).toEqual({ kind: "cylinder", at: AT, r: 0.4, h: 0.8, mat: "rust", sides: 6 });
    expect(only(streetTree(AT))).toEqual({ kind: "cone", at: AT, r: 1.5, h: 4, mat: "leaf" });
    expect(only(patioTree(AT))).toEqual({ kind: "cone", at: AT, r: 1, h: 2.5, mat: "leaf" });
    expect(only(roofShrub(AT))).toEqual({ kind: "cone", at: AT, r: 1.2, h: 2.5, mat: "leaf" });
  });

  it("toldo: rampa awning de 0.8 de vuelo y 0.4 de alto hacia la calle", () => {
    expect(only(awning(AT, 5, "s"))).toEqual({ kind: "ramp", at: AT, w: 5, d: 0.8, h: 0.4, mat: "awning", dir: "s" });
    expect(only(awning(AT, 5, "e"))).toEqual({ kind: "ramp", at: AT, w: 0.8, d: 5, h: 0.4, mat: "awning", dir: "e" });
  });

  it("kiosco: caja officeDark 2×2×2.4 y techo hip terracotta de 0.8", () => {
    const [box, roof] = kiosk(AT);
    expect(box).toMatchObject({ kind: "prism", at: AT, w: 2, d: 2, h: 2.4, mat: "officeDark" });
    expect(roof).toMatchObject({ kind: "prism", at: v3(AT.x, AT.y, AT.z + 2.4), w: 2, d: 2, h: 0.8, mat: "terracotta", roof: "hip" });
  });

  it("cartel: caja officeDark y un poly ámbar coplanar en y, delante de la caja", () => {
    const s = sign(AT, 4, 1.2);
    expect(only(s.solids)).toMatchObject({ kind: "prism", at: AT, w: 4, d: 0.4, h: 1.2, mat: "officeDark" });
    expect(s.accents).toHaveLength(1);
    const a = s.accents[0]!;
    if (a.kind !== "poly") throw new Error("cartel no poly");
    expect(a.color).toBe("amber");
    expect(new Set(a.pts.map((p) => p.y))).toEqual(new Set([AT.y + 0.42]));
  });

  it("neón: dos polys, halo Bleed 1.3× el frente y detrás de él (más al oeste y al norte)", () => {
    const front = [v3(0, 5, 1), v3(2, 5, 1), v3(2, 5, 2), v3(0, 5, 2)];
    const [halo, tube] = neon(front, "magenta") as [Accent & { kind: "poly" }, Accent & { kind: "poly" }];
    expect(tube).toMatchObject({ kind: "poly", pts: front, color: "magenta" });
    expect(halo.color).toBe("magentaBleed");
    const span = (pts: { x: number }[]) => Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    expect(span(halo.pts)).toBeCloseTo(1.3 * span(tube.pts), 9);
    const ch = centroid(halo.pts), ct = centroid(tube.pts);
    expect(ch.x).toBeLessThan(ct.x);
    expect(ch.y).toBeLessThan(ct.y);
  });

  it("fuente: pileta marble r 3 h 0.6, surtidor r 0.6 h 1.5 y charco amberBleed sobre el agua", () => {
    const f = fountain(AT);
    expect(f.solids[0]).toMatchObject({ kind: "cylinder", at: AT, r: 3, h: 0.6, mat: "marble" });
    expect(f.solids[1]).toMatchObject({ kind: "cylinder", at: v3(AT.x, AT.y, AT.z + 0.6), r: 0.6, h: 1.5, mat: "marble" });
    expect(f.accents.length).toBe(3);
    for (const a of f.accents) expect(a.kind === "poly" && a.color === "amberBleed" && a.pts.every((p) => Math.abs(p.z - (AT.z + 0.6)) < 1e-9)).toBe(true);
  });

  it("charco: tres octógonos concéntricos de radio 2.5, 1.8 y 1.2 a z 0.12, alpha 0.25, del color pedido", () => {
    const p = puddle(4, 6, "cyanBleed");
    expect(p).toHaveLength(3);
    p.forEach((a, i) => {
      if (a.kind !== "poly") throw new Error("charco no poly");
      expect(a.pts).toHaveLength(8);
      expect(a.color).toBe("cyanBleed");
      expect(a.alpha).toBe(0.25);
      expect(Math.max(...a.pts.map((q) => Math.hypot(q.x - 4, q.y - 6)))).toBeCloseTo([2.5, 1.8, 1.2][i]!, 9);
      expect(a.pts.every((q) => q.z === 0.12)).toBe(true);
    });
  });

  it("detalles de techo con las medidas de hoy", () => {
    const tank = waterTank(AT);
    expect(tank.filter((s) => s.kind === "prism")).toHaveLength(4);
    for (const leg of tank.slice(0, 4)) expect(leg).toMatchObject({ w: 0.3, d: 0.3, h: 1.1, mat: "steel" }); // 1.1: no es un auto
    expect(tank[4]).toEqual({ kind: "cylinder", at: v3(AT.x, AT.y, AT.z + 1.1), r: 1.2, h: 2, mat: "rust", sides: 6 });
    expect(only(machineRoom(AT))).toMatchObject({ kind: "prism", at: AT, w: 4, d: 3, h: 2, mat: "officeDark" });
    expect(only(antenna(AT))).toEqual({ kind: "cylinder", at: AT, r: 0.2, h: 4, mat: "steel", sides: 4 });
    const hp = helipad(AT);
    expect(only(hp.solids)).toEqual({ kind: "cylinder", at: AT, r: 3, h: 0.3, mat: "paving", sides: 8 });
    expect(hp.accents).toEqual([{ kind: "dot", at: v3(AT.x, AT.y, AT.z + 0.3), r: 0.6, color: "amberMid" }]);
    expect(beacon(AT)).toEqual({ solids: [], accents: [{ kind: "dot", at: AT, r: 0.5, color: "amberMid" }] });
  });

  it("terraza verde: losa leafDark de 0.3 y 3..5 conos r 1 h 2 dentro de la losa", () => {
    const g = rooftopGarden(AT, 8, 6, createRng(3));
    expect(g[0]).toMatchObject({ kind: "prism", at: AT, w: 8, d: 6, h: 0.3, mat: "leafDark" });
    const cones = g.slice(1);
    expect(cones.length).toBeGreaterThanOrEqual(3);
    expect(cones.length).toBeLessThanOrEqual(5);
    for (const c of cones) {
      expect(c).toMatchObject({ kind: "cone", r: 1, h: 2, mat: "leaf" });
      if (c.kind !== "cone") throw new Error("no cono");
      expect(c.at.z).toBeCloseTo(AT.z + 0.3, 9);
      expect(c.at.x).toBeGreaterThanOrEqual(11);
      expect(c.at.x).toBeLessThanOrEqual(17);
    }
  });

  it("panel solar, cerco y contenedor", () => {
    expect(only(solarPanel(AT))).toEqual({ kind: "ramp", at: AT, w: 3, d: 1.6, h: 0.5, mat: "glass", dir: "s" });
    const f = fence(AT, 21, 15);
    expect(f).toHaveLength(4);
    for (const s of f) expect(s).toMatchObject({ kind: "prism", h: 1.2, mat: "officeDark" });
    const b = f.map(bounds);
    expect(Math.min(...b.map((q) => q.min.x))).toBe(10);
    expect(Math.max(...b.map((q) => q.max.x))).toBe(31);
    expect(Math.max(...b.map((q) => q.max.y))).toBe(35);
    expect(only(container(AT))).toMatchObject({ kind: "prism", at: AT, w: 6, d: 2.4, h: 2.4, mat: "rust" });
  });

  it("guirnalda: dots ámbar r 0.25 cada 1.5 sobre la polilínea, a su altura", () => {
    const g = garland([v3(0, 0, 3), v3(6, 0, 3)]);
    expect(g).toHaveLength(5);
    g.forEach((a, i) => expect(a).toEqual({ kind: "dot", at: v3(1.5 * i, 0, 3), r: 0.25, color: "amber" }));
  });

  it("grúa de muelle: mástil 1×1×6 steel y pluma 6×0.6×0.5 hacia el lado pedido", () => {
    const [mast, jib] = dockCrane(AT, "w");
    expect(size(mast!)).toEqual([1, 1, 6]);
    expect(mast).toMatchObject({ mat: "steel", at: AT });
    expect(size(jib!)).toEqual([6, 0.6, 0.5]);
    expect(bounds(jib!).max.z).toBeCloseTo(AT.z + 6, 9);
    expect(bounds(jib!).max.x).toBeCloseTo(11, 9);  // al oeste: termina sobre el mástil
    expect(bounds(dockCrane(AT, "e")[1]!).min.x).toBeCloseTo(10, 9);
  });
});
