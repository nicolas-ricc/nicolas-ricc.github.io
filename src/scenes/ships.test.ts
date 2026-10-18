import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bounds, isFlat, tessellateAll, type Solid } from "../iso/solids";
import { SHIP_MATS, SHIP_SPECS, ship, shipAt, wake, type ShipKind } from "./ships";

const KINDS: ShipKind[] = ["cargo", "tug", "barge", "ferry"];

describe("ships", () => {
  it("cada barco: casco con topMat y arrufo, ≤ 40 sólidos, ≤ 8 luces, todo dentro de la caja del casco (margen 2) y sobre la cubierta", () => {
    for (const kind of KINDS) {
      const s = ship(kind, { x: 100, y: 100 }, 0), spec = SHIP_SPECS[kind];
      const hull = s.solids.find((x) => x.kind === "hull")!;
      expect(hull).toMatchObject({ len: spec.len, beam: spec.beam, h: spec.h, sheer: spec.sheer, topMat: spec.topMat, mat: "hull", at: { x: 100, y: 100, z: -1 } });
      expect(s.solids.length).toBeLessThanOrEqual(40); expect(s.lights.length).toBeLessThanOrEqual(8);
      const x0 = kind === "barge" ? 100 - 20 : 100; // el empujador va detrás de la barcaza
      for (const x of s.solids) {
        const b = bounds(x);
        expect(b.min.x).toBeGreaterThanOrEqual(x0 - 2); expect(b.max.x).toBeLessThanOrEqual(100 + spec.len + 2);
        expect(b.min.y).toBeGreaterThanOrEqual(100 - spec.beam / 2 - 2); expect(b.max.y).toBeLessThanOrEqual(100 + spec.beam / 2 + 2);
        // la goma (defensas, pudding) cuelga del costado; en barge, los bloques que cuadran los cascos (tope ≤ cubierta del empujador) bajan al agua
        const filler = kind === "barge" && b.max.z <= 0.66;
        if (x.kind !== "hull" && !filler && x.mat !== "asphalt") expect(b.min.z).toBeGreaterThanOrEqual(-1 + spec.h - 0.01);
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
    expect(shipAt("barge", { x: 0, y: 0 }, 0)).toEqual({ x: -10, y: 0 });
    expect(shipAt("cargo", { x: 0, y: 0 }, 0)).toEqual({ x: -30, y: 0 });
  });
  it("remolcador: casco del ASD Tug 2810 (28.7 × 10.4 m → 19 × 7 u) con goma asphalt entre los materiales", () => {
    expect(SHIP_SPECS.tug).toEqual({ len: 19, beam: 7, h: 2.2, sheer: 0.3, topMat: "hullBlue" });
    expect(SHIP_MATS).toContain("asphalt");
  });
  it("remolcador ASD 2810: timonera de vidrio a proa de la mitad sobre una caseta más ancha, dos chimeneas laterales detrás, mástil como punto más alto (≤ z 13), dos balsas en el techo", () => {
    const s = ship("tug", { x: 0, y: 0 }, 0);
    const polys = s.solids.filter((x) => x.kind === "poly");
    const wheel = polys.find((x) => x.facade?.base === "glass")!;
    const house = polys.find((x) => x.mat === "whitewash" && x.facade && x.facade.base !== "glass")!;
    const wb = bounds(wheel), hb = bounds(house);
    expect(wheel.mat).toBe("whitewash");
    expect(wb.min.x).toBeGreaterThan(SHIP_SPECS.tug.len / 2); // a proa de la mitad
    expect(wb.min.z).toBeCloseTo(hb.max.z, 6); // apoyada sobre la caseta
    expect(hb.max.y - hb.min.y).toBeGreaterThan(wb.max.y - wb.min.y); // caseta más ancha
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h === 2.7);
    expect(stacks).toHaveLength(2);
    expect(stacks.map((x) => Math.sign(bounds(x).min.y + bounds(x).max.y)).sort()).toEqual([-1, 1]); // una por banda
    for (const c of stacks) expect(bounds(c).max.x).toBeLessThanOrEqual(wb.min.x); // detrás de la timonera
    const top = Math.max(...s.solids.map((x) => bounds(x).max.z));
    expect(top).toBeLessThanOrEqual(13);
    expect(top).toBeGreaterThan(wb.max.z + 3); // el mástil sobresale de la timonera
    const rafts = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "whitewash");
    expect(rafts).toHaveLength(2);
    for (const r of rafts) expect(bounds(r).min.z).toBeGreaterThanOrEqual(wb.max.z);
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
  });
  it("remolcador ASD 2810: guinche y bitas a proa, pudding macizo en la roda, defensas en ambas bandas, proa y esquinas de popa; rota con el rumbo", () => {
    const s = ship("tug", { x: 0, y: 0 }, 0), { len, beam } = SHIP_SPECS.tug;
    const rubber = s.solids.filter((x) => x.mat === "asphalt").map(bounds);
    expect(rubber.some((b) => b.min.y <= -beam / 2 && b.max.x - b.min.x >= 5)).toBe(true); // riel de babor
    expect(rubber.some((b) => b.max.y >= beam / 2 && b.max.x - b.min.x >= 5)).toBe(true); // riel de estribor
    expect(rubber.filter((b) => b.max.x >= len - 1)).not.toHaveLength(0); // pudding en la roda
    expect(rubber.filter((b) => b.max.x <= 2)).toHaveLength(2); // cilindros de esquina de popa
    const winch = s.solids.find((x) => x.kind === "cylinder" && x.mat === "steel" && x.r === 0.6)!;
    expect(bounds(winch).min.x).toBeGreaterThan(14); // a proa de la caseta
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h <= 0.6).length).toBeGreaterThanOrEqual(3); // bitas
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "hullBlue")).toHaveLength(2); // amurada de proa
    expect(s.solids.length).toBeLessThanOrEqual(40); expect(s.lights.length).toBeLessThanOrEqual(8);
    const south = ship("tug", { x: 100, y: 100 }, Math.PI / 2);
    expect(Math.max(...south.solids.map((x) => bounds(x).max.y))).toBeCloseTo(100 + len, 6); // la punta del pudding es la roda
  });
  it("lancha colectiva del Tigre: casco de madera de 15 × 4 u, una sola cabina de ventanas corridas de dos tercios de la eslora, toldilla clara con alero, popa abierta y defensas; nada por encima de z 5", () => {
    expect(SHIP_SPECS.ferry).toEqual({ len: 15, beam: 4, h: 1.2, sheer: 0.3, topMat: "deck" });
    const ferry = ship("ferry", { x: 0, y: 0 }, 0), { len } = SHIP_SPECS.ferry;
    const cabins = ferry.solids.filter((x) => x.kind === "poly" && x.facade);
    expect(cabins).toHaveLength(1);
    const cabin = cabins[0]!, cb = bounds(cabin);
    expect(cabin.mat).toBe("deck"); // madera barnizada, no superestructura blanca
    expect(cabin.kind === "poly" && cabin.facade?.base).toBe("glass");
    expect(cb.max.x - cb.min.x).toBeGreaterThanOrEqual(len * 0.6);
    expect(cb.min.x).toBeGreaterThanOrEqual(3); // popa abierta detrás de la cabina
    const roof = ferry.solids.find((x) => x.kind === "poly" && x.mat === "whitewash" && Math.abs(bounds(x).min.z - cb.max.z) < 1e-6)!;
    const rb = bounds(roof);
    expect(rb.min.x).toBeLessThan(cb.min.x); expect(rb.max.x).toBeGreaterThan(cb.max.x); // alero
    expect(rb.min.y).toBeLessThan(cb.min.y); expect(rb.max.y).toBeGreaterThan(cb.max.y);
    expect(ferry.solids.filter((x) => x.mat === "asphalt")).toHaveLength(3); // defensas
    expect(ferry.solids.filter((x) => x.kind === "poly" && x.mat === "deck" && !x.facade)).toHaveLength(2); // barandas de popa
    expect(Math.max(...ferry.solids.map((x) => bounds(x).max.z))).toBeLessThanOrEqual(5);
    expect(ferry.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(ferry.lights.some((l) => l.color === "amber")).toBe(true);
    expect(ferry.lights.some((l) => l.kind === "poly" && l.color === "amberBleed")).toBe(true); // ventanas encendidas, cálidas y no neón
  });
  it("la estela son 17 triángulos detrás y a los lados del casco, con la ola de proa más clara", () => {
    for (const kind of KINDS) {
      const w = wake(kind, { x: 0, y: 0 }, 0);
      expect(w).toHaveLength(17);
      expect(w.filter((t) => t.toneOffset === 1).length).toBeGreaterThanOrEqual(2);
      for (const t of w) for (const p of t.pts) { expect(p.z).toBeCloseTo(-0.95, 6); expect(p.x).toBeLessThanOrEqual(SHIP_SPECS[kind].len + 0.01); }
    }
  });
  it("barge: la V y el remolino arrancan detrás del empujador (popa en −20)", () => {
    const w = wake("barge", { x: 0, y: 0 }, 0);
    for (const t of w.slice(-3)) { expect(t.pts[0]!.x).toBeCloseTo(-20, 6); expect(t.pts[0]!.y).toBeCloseTo(0, 6); }
    expect(Math.min(...w.flatMap((t) => t.pts.map((p) => p.x)))).toBeCloseTo(-36, 6);
  });
});

describe("barge: empujador de tres cubiertas con barcaza tolva Jumbo", () => {
  const s = ship("barge", { x: 0, y: 0 }, 0), b = s.solids.map(bounds);
  const near = (a: number, c: number) => Math.abs(a - c) < 1e-6;
  it("unidad de 60 × 8 u, nada por encima de z 13: barcaza 40 × 8 (h 1.2, sin arrufo) y empujador de 20 × 7 a dx −20, sin contenedores", () => {
    expect(SHIP_SPECS.barge).toEqual({ len: 40, beam: 8, h: 1.2, sheer: 0, topMat: "rust" });
    const hulls = s.solids.filter((x) => x.kind === "hull");
    expect(hulls).toHaveLength(2);
    expect(hulls[1]).toMatchObject({ at: { x: -20, y: 0, z: -1 }, len: 20, beam: 7, h: 1.6, sheer: 0 });
    expect(Math.min(...b.map((x) => x.min.x))).toBeCloseTo(-20, 6); expect(Math.max(...b.map((x) => x.max.x))).toBeCloseTo(40, 6);
    expect(Math.max(...b.map((x) => Math.max(-x.min.y, x.max.y)))).toBeLessThanOrEqual(4 + 1e-9);
    expect(Math.max(...b.map((x) => x.max.z))).toBeLessThanOrEqual(13);
    expect(s.solids.some((x, i) => x.kind === "poly" && b[i]!.min.x >= 0 && x.h >= 2)).toBe(false); // sin contenedores sobre la barcaza
  });
  it("proa de la barcaza cuadrada hasta el cabezal (rake) y proa del empujador cuadrada", () => {
    expect(b.some((x) => x.max.x > 40 - 1e-6 && near(x.max.z, 0.25) && x.max.y - x.min.y > 7.9)).toBe(true);
    expect(b.some((x) => near(x.max.x, 0) && x.min.x < -5 && near(x.max.z, 0.65) && x.max.y - x.min.y > 6.9)).toBe(true);
  });
  it("barcaza: brazola perimetral, cuatro tapas abovedadas dentro de ella y bitas en las cuatro esquinas", () => {
    const coaming = s.solids.filter((x) => x.kind === "poly" && x.mat === "rust" && near(x.z, 0.25) && near(x.h, 0.9)).map(bounds);
    expect(coaming).toHaveLength(4);
    expect(Math.min(...coaming.map((x) => x.min.x))).toBeCloseTo(3, 6); expect(Math.max(...coaming.map((x) => x.max.x))).toBeCloseTo(34.2, 6);
    expect(Math.min(...coaming.map((x) => x.min.y))).toBeCloseTo(-3.6, 6); expect(Math.max(...coaming.map((x) => x.max.y))).toBeCloseTo(3.6, 6);
    const lids = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, 1.15)).map(bounds);
    const crests = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, 1.55)).map(bounds);
    expect(lids).toHaveLength(4); expect(crests).toHaveLength(4);
    for (const l of lids) { expect(l.min.x).toBeGreaterThanOrEqual(3); expect(l.max.x).toBeLessThanOrEqual(34.2); }
    for (const c of crests) {
      const l = lids.find((x) => x.min.x < c.min.x && x.max.x > c.max.x); // cada cresta sobre su base, más angosta: bóveda
      expect(l).toBeDefined(); expect(c.min.y).toBeGreaterThan(l!.min.y); expect(c.max.y).toBeLessThan(l!.max.y);
    }
    expect(Math.max(...b.filter((x) => x.min.x >= 0).map((x) => x.max.z))).toBeCloseTo(1.85, 6);
    const bitts = b.filter((x, i) => s.solids[i]!.kind === "cylinder" && x.min.x >= 0);
    expect(bitts).toHaveLength(4);
    expect(new Set(bitts.map((x) => `${(x.min.x + x.max.x) / 2 > 20}${x.min.y + x.max.y > 0}`)).size).toBe(4);
  });
  it("empujador: dos pechos a proa por encima de la barcaza, torre de tres niveles escalonada con timonera vidriada, dos chimeneas a popa de la torre, mástil, bote y barandas", () => {
    const bargeTop = Math.max(...b.filter((x) => x.min.x >= 0).map((x) => x.max.z));
    const knees = b.filter((x, i) => { const p = s.solids[i]!; return p.kind === "poly" && p.mat === "whitewash" && !p.facade && x.min.x >= -1.5 && x.max.x <= 1e-9; });
    expect(knees).toHaveLength(2);
    for (const kn of knees) expect(kn.max.z).toBeGreaterThan(bargeTop);
    const tower = s.solids.flatMap((x) => (x.kind === "poly" && x.mat === "whitewash" && x.facade ? [x] : [])).sort((p, q) => p.z - q.z);
    expect(tower).toHaveLength(3);
    const area = (x: Solid) => { const t = bounds(x); return (t.max.x - t.min.x) * (t.max.y - t.min.y); };
    for (let i = 1; i < 3; i++) { expect(tower[i]!.z).toBeCloseTo(tower[i - 1]!.z + tower[i - 1]!.h, 6); expect(area(tower[i]!)).toBeLessThan(area(tower[i - 1]!)); }
    expect(tower[2]!.facade?.base).toBe("glass");
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "whitewash").map(bounds);
    expect(stacks).toHaveLength(2);
    for (const st of stacks) expect(st.max.x).toBeLessThanOrEqual(bounds(tower[1]!).min.x + 1e-9);
    expect(stacks[0]!.min.y * stacks[1]!.min.y).toBeLessThan(0); // una por banda
    expect(Math.max(...b.map((x) => x.max.z))).toBeCloseTo(8.2, 6); // mástil sobre la timonera
    const roof1 = tower[0]!.z + tower[0]!.h;
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, roof1))).toHaveLength(3); // bote y dos barandas
  });
  it("luces: tope, babor y estribor primero; dos proyectores ámbar y ventanas encendidas en la timonera; ≤ 8", () => {
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.filter((l) => l.color === "amber")).toHaveLength(2);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
    expect(s.lights.length).toBeLessThanOrEqual(8);
  });
});

describe("carguero (Damen Combi Freighter 3850)", () => {
  const s = ship("cargo", { x: 0, y: 0 }, 0);
  it("casa y puente a popa: las piezas con fachada quedan en el último tercio; puente con alerones a la manga; escapes detrás del puente; nada por encima de z 13", () => {
    const faced = s.solids.filter((x) => x.kind === "poly" && x.facade);
    expect(faced.length).toBeGreaterThanOrEqual(4);
    for (const x of faced) expect(bounds(x).max.x).toBeLessThanOrEqual(60 / 3);
    const bridge = bounds(faced.find((x) => x.kind === "poly" && x.facade?.base === "glass")!);
    expect(bridge.min.y).toBeCloseTo(-5, 6); expect(bridge.max.y).toBeCloseTo(5, 6);
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && bounds(x).max.x <= bridge.min.x);
    expect(stacks).toHaveLength(2);
    expect(Math.max(...s.solids.map((x) => bounds(x).max.z))).toBeLessThanOrEqual(13);
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
    const south = ship("cargo", { x: 100, y: 100 }, Math.PI / 2);
    expect(Math.max(...south.solids.map((x) => bounds(x).max.y))).toBeCloseTo(160, 6);
  });
  it("bodega única: brazola rust larga con tres tapas planas encima, entre la casa y el castillo", () => {
    const coaming = s.solids.filter((x) => x.kind === "poly" && x.mat === "rust" && x.h === 1);
    expect(coaming).toHaveLength(1);
    const cb = bounds(coaming[0]!);
    expect(cb.max.x - cb.min.x).toBeGreaterThanOrEqual(30); expect(cb.min.x).toBeGreaterThanOrEqual(12); expect(cb.max.x).toBeLessThanOrEqual(50);
    const covers = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && Math.abs(x.z - cb.max.z) < 1e-6);
    expect(covers).toHaveLength(3);
    for (const c of covers) { const b = bounds(c); expect(b.min.x).toBeGreaterThanOrEqual(cb.min.x); expect(b.max.x).toBeLessThanOrEqual(cb.max.x); expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.5); }
  });
  it("dos grúas en babor: pedestal, cabina y pluma de tres tramos subiendo a 45° hacia proa", () => {
    const pedestals = s.solids.flatMap((x) => (x.kind === "cylinder" && x.r === 0.5 && x.h === 3 ? [x] : []));
    expect(pedestals).toHaveLength(2);
    const steps = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 1.5).map((x) => bounds(x));
    expect(steps).toHaveLength(6);
    for (const p of pedestals) {
      expect(p.at.y).toBeLessThan(-3.4); expect(p.at.z).toBeCloseTo(4, 6);
      const boom = steps.filter((b) => b.min.x > p.at.x && b.min.x < p.at.x + 6).sort((a, b) => a.min.x - b.min.x);
      expect(boom).toHaveLength(3);
      for (const b of boom) expect(b.max.y).toBeLessThan(0);
      for (let i = 1; i < 3; i++) {
        const dx = boom[i]!.min.x - boom[i - 1]!.min.x, dz = boom[i]!.min.z - boom[i - 1]!.min.z;
        expect(dz).toBeGreaterThan(0); expect(dz).toBeCloseTo(dx, 6);
        expect(boom[i]!.min.z).toBeCloseTo(boom[i - 1]!.max.z, 6);
      }
    }
  });
  it("proa: castillo con mástil, molinete y dos bitas; ancla asomando a estribor; amurada en las dos bandas de la casa al castillo", () => {
    const forecastle = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 1.6);
    expect(forecastle).toHaveLength(1); expect(bounds(forecastle[0]!).min.x).toBeGreaterThanOrEqual(48);
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.r === 0.3)).toHaveLength(2); // bitas
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.r === 0.6)).toHaveLength(1); // molinete
    const anchor = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && bounds(x).min.x >= 54);
    expect(anchor).toHaveLength(1); expect(bounds(anchor[0]!).max.y).toBeGreaterThan(1.79);
    const rails = s.solids.filter((x) => x.kind === "poly" && x.mat === "hullBlue" && x.h === 0.8).map((x) => bounds(x));
    expect(rails).toHaveLength(4);
    for (const side of [rails.filter((b) => b.max.y < 0), rails.filter((b) => b.min.y > 0)]) {
      expect(side).toHaveLength(2);
      expect(Math.min(...side.map((b) => b.min.x))).toBeLessThanOrEqual(12); expect(Math.max(...side.map((b) => b.max.x))).toBeGreaterThanOrEqual(50);
    }
    expect(s.lights.filter((l) => l.color === "magentaMid")).toHaveLength(2); // tope de popa y de proa
  });
  it("con cualquier rumbo, todas las piezas quedan en el círculo de la eslora y por debajo de z 13; presupuesto 40 / 8", () => {
    for (const h of [0, Math.PI / 2, 2.3, -0.7]) {
      const r = ship("cargo", { x: 0, y: 0 }, h), cx = 30 * Math.cos(h), cy = 30 * Math.sin(h);
      expect(r.solids.length).toBeLessThanOrEqual(40); expect(r.lights.length).toBeLessThanOrEqual(8);
      for (const x of r.solids) for (const f of tessellateAll(x)) for (const p of f.pts) {
        expect(Math.hypot(p.x - cx, p.y - cy)).toBeLessThanOrEqual(Math.hypot(30, 5) + 0.01);
        expect(p.z).toBeLessThanOrEqual(13);
      }
    }
  });
});

describe("eslora del empujador (#68)", () => {
  it("sternOf deriva la popa de PUSHER_LEN, sin literales propios", () => {
    const src = readFileSync(new URL("./ships.ts", import.meta.url), "utf8");
    const barge = src.match(/^const sternOf = [\s\S]*?kind === "barge" \? ([^:]+):/m)?.[1];
    expect(barge?.trim()).toBe("-PUSHER_LEN");
  });
  it("la casilla larga, las barandas y el bote quedan donde estaban, referidos a la popa del empujador en −20", () => {
    const s = ship("barge", { x: 0, y: 0 }, 0);
    const pick = (mat: string, z: number, h: number) =>
      s.solids.filter((x) => x.kind === "poly" && x.mat === mat && Math.abs(x.z - z) < 1e-9 && Math.abs(x.h - h) < 1e-9).map(bounds);
    const pDeck = -1 + 1.6 + 0.05;
    const [house] = pick("whitewash", pDeck, 1.55).filter((b) => b.min.x < -10);
    expect(house!.min.x).toBe(-17.5); expect(house!.max.x).toBeCloseTo(-1.6, 9);
    const rails = pick("steel", pDeck + 1.55, 0.4);
    expect(rails).toHaveLength(2);
    for (const r of rails) { expect(r.min.x).toBe(-17.4); expect(r.max.x).toBeCloseTo(-8.4, 9); }
    const [boat] = pick("steel", pDeck + 1.55, 0.5);
    expect(boat!.min.x).toBe(-14); expect(boat!.max.x).toBeCloseTo(-9.8, 9);
  });
});
