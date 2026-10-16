import { describe, expect, it } from "vitest";
import { bounds, isFlat } from "../iso/solids";
import { SHIP_MATS, SHIP_SPECS, ship, shipAt, wake, type ShipKind } from "./ships";

const KINDS: ShipKind[] = ["cargo", "tug", "barge", "ferry"];

describe("ships", () => {
  it("cada barco: casco con topMat y arrufo, ≤ 30 sólidos, ≤ 6 luces, todo dentro de la caja del casco (margen 2) y sobre la cubierta", () => {
    for (const kind of KINDS) {
      const s = ship(kind, { x: 100, y: 100 }, 0), spec = SHIP_SPECS[kind];
      const hull = s.solids.find((x) => x.kind === "hull")!;
      expect(hull).toMatchObject({ len: spec.len, beam: spec.beam, h: spec.h, sheer: spec.sheer, topMat: spec.topMat, mat: "hull", at: { x: 100, y: 100, z: -1 } });
      expect(s.solids.length).toBeLessThanOrEqual(30); expect(s.lights.length).toBeLessThanOrEqual(6);
      const x0 = kind === "barge" ? 100 - 10 : 100; // el empujador va detrás de la barcaza
      for (const x of s.solids) {
        const b = bounds(x);
        expect(b.min.x).toBeGreaterThanOrEqual(x0 - 2); expect(b.max.x).toBeLessThanOrEqual(100 + spec.len + 2);
        expect(b.min.y).toBeGreaterThanOrEqual(100 - spec.beam / 2 - 2); expect(b.max.y).toBeLessThanOrEqual(100 + spec.beam / 2 + 2);
        if (x.kind !== "hull" && !(x.kind === "cylinder" && x.r === 0.45)) expect(b.min.z).toBeGreaterThanOrEqual(-1 + spec.h - 0.01); // las defensas cuelgan del costado
        expect(SHIP_MATS).toContain(x.mat);
        expect(isFlat(x)).toBe(false);
      }
    }
  });
  it("shipAt: el centro de la unidad (barcaza + empujador incluido) cae en el punto pedido, para cualquier rumbo", () => {
    for (const kind of KINDS) for (const h of [0, Math.PI / 2, 2.3, -0.7]) {
      const c = { x: 400, y: 100 }, at = shipAt(kind, c, h);
      // extremos de la unidad = popa y proa de cada casco (en barge: empujador y barcaza), proyectados sobre el eje del barco
      const along = ship(kind, at, h).solids.flatMap((s) => (s.kind === "hull" ? [0, s.len].map((dx) => (s.at.x + dx * Math.cos(h) - c.x) * Math.cos(h) + (s.at.y + dx * Math.sin(h) - c.y) * Math.sin(h)) : []));
      expect(Math.max(...along) + Math.min(...along)).toBeCloseTo(0, 6);
    }
    expect(shipAt("barge", { x: 0, y: 0 }, 0)).toEqual({ x: -15, y: 0 });
    expect(shipAt("cargo", { x: 0, y: 0 }, 0)).toEqual({ x: -30, y: 0 });
  });
  it("carguero: tres escotillas, superestructura con ventanas, chimenea con tapa, dos grúas; proa según heading", () => {
    const s = ship("cargo", { x: 0, y: 0 }, 0);
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "rust" && x.h === 1.2)).toHaveLength(3);
    expect(s.solids.filter((x) => x.kind === "poly" && x.facade).length).toBeGreaterThanOrEqual(4);
    expect(s.solids.filter((x) => x.kind === "cylinder")).toHaveLength(2);
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 8)).toHaveLength(2); // kingposts
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "hullBlue" && x.h === 0.8)).toHaveLength(2); // amurada
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    const south = ship("cargo", { x: 100, y: 100 }, Math.PI / 2);
    expect(Math.max(...south.solids.map((x) => bounds(x).max.y))).toBeCloseTo(160, 6);
  });
  it("remolcador con defensas y timonera; barcaza con diez contenedores (seis dobles) y empujador; lancha de dos cubiertas", () => {
    const tug = ship("tug", { x: 0, y: 0 }, 0);
    expect(tug.solids.filter((x) => x.kind === "cylinder" && x.r === 0.45)).toHaveLength(6);
    expect(tug.solids.some((x) => x.kind === "poly" && x.mat === "whitewash" && x.facade?.base === "glass")).toBe(true);
    const barge = ship("barge", { x: 0, y: 0 }, 0);
    expect(barge.solids.filter((x) => x.kind === "poly" && x.h === 2.6 && (x.mat === "rust" || x.mat === "steel"))).toHaveLength(16);
    expect(barge.solids.filter((x) => x.kind === "hull")).toHaveLength(2);
    const ferry = ship("ferry", { x: 0, y: 0 }, 0);
    expect(ferry.solids.filter((x) => x.kind === "poly" && x.mat === "whitewash" && x.facade)).toHaveLength(2);
    expect(ferry.lights.some((l) => l.color === "amber")).toBe(true);
  });
  it("la estela son 17 triángulos detrás y a los lados del casco, con la ola de proa más clara", () => {
    for (const kind of KINDS) {
      const w = wake(kind, { x: 0, y: 0 }, 0);
      expect(w).toHaveLength(17);
      expect(w.filter((t) => t.toneOffset === 1).length).toBeGreaterThanOrEqual(2);
      for (const t of w) for (const p of t.pts) { expect(p.z).toBeCloseTo(-0.95, 6); expect(p.x).toBeLessThanOrEqual(SHIP_SPECS[kind].len + 0.01); }
    }
  });
});
