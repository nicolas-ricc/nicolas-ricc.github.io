import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { BRIDGE, COLLAPSED, EAST_RING, STREET, WEST_QUAY, estuaryEast } from "../scenes/city-grid";
import { bridge, collapsed } from "./fixed";

describe("bridge", () => {
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; bridge(solids, accents); return { solids, accents }; };
  const top = BRIDGE.z + BRIDGE.deckH;

  it("tablero, rampas y estribo como hoy; sin los pilotes de plaza", () => {
    const { solids } = built();
    const deck = solids.find((s) => s.kind === "prism" && s.mat === "asphalt" && s.w > 60);
    expect(deck).toMatchObject({ at: { x: WEST_QUAY.x0, y: BRIDGE.y0, z: BRIDGE.z }, w: EAST_RING.x1 - WEST_QUAY.x0, d: BRIDGE.y1 - BRIDGE.y0, h: BRIDGE.deckH });
    const ramps = solids.filter((s) => s.kind === "ramp" && s.mat === "asphalt");
    expect(ramps.map((r) => r.kind === "ramp" && r.dir).sort()).toEqual(["e", "w"]);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "plaza" && s.at.x === WEST_QUAY.x0 && s.at.z === 0.6)).toBe(true);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "plaza" && s.at.z === -1)).toBe(false);
  });

  it("al menos cuatro pilas de piedra con tajamar, del fondo al tablero", () => {
    const piers = built().solids.filter((s): s is Solid & { kind: "poly" } => s.kind === "poly" && s.mat === "stone");
    expect(piers.length).toBeGreaterThanOrEqual(4);
    for (const p of piers) {
      expect(p.footprint).toHaveLength(6);
      expect(p.z).toBe(-1);
      expect(p.z + p.h).toBeCloseTo(BRIDGE.z, 9);
    }
  });

  it("18 losas de arco bajo el tablero; en cada vano el borde inferior sube hacia la clave", () => {
    const slabs = built().solids
      .filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && s.at.z < BRIDGE.z)
      .sort((a, b) => a.at.x - b.at.x);
    expect(slabs).toHaveLength(18);
    for (const s of slabs) {
      const b = bounds(s);
      expect(b.min.z).toBeGreaterThanOrEqual(-1);
      expect(Math.abs(b.max.z - BRIDGE.z)).toBeLessThan(1e-6);
    }
    for (let i = 0; i < 3; i++) {
      const zs = slabs.slice(i * 6, i * 6 + 6).map((s) => s.at.z);
      expect(Math.min(zs[2]!, zs[3]!)).toBeGreaterThan(Math.max(zs[0]!, zs[5]!));
    }
  });

  it("balaustrada de piedra: al menos 50 postes sobre el tablero y dos pasamanos; sin barandas officeDark", () => {
    const { solids } = built();
    const posts = solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.w === 0.3 && s.d === 0.3 && s.h === 0.9 && s.at.z === top);
    expect(posts.length).toBeGreaterThanOrEqual(50);
    const rails = solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.d === 0.2 && s.h === 0.2 && s.w > 60);
    expect(rails).toHaveLength(2);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "officeDark")).toBe(false);
  });

  it("cuatro obeliscos en las esquinas, cada uno con remate piramidal y un dot ámbar encima; sin faroles", () => {
    const { solids, accents } = built();
    const obelisks = solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && s.w === 1.2 && s.d === 1.2 && s.h === 4);
    expect(obelisks).toHaveLength(4);
    const dots = accents.filter((a) => a.kind === "dot" && a.color === "amber");
    expect(dots).toHaveLength(4);
    for (const o of obelisks) {
      const cx = o.at.x + 0.6, cy = o.at.y + 0.6;
      expect(solids.some((s) => s.kind === "cone" && s.mat === "stone" && s.sides === 4 && s.r === 0.6 && s.h === 1 && s.at.x === cx && s.at.y === cy && s.at.z === o.at.z + 4)).toBe(true);
      expect(dots.some((a) => a.kind === "dot" && a.at.x === cx && a.at.y === cy && a.at.z > o.at.z + 5)).toBe(true);
    }
    expect(solids.some((s) => s.kind === "prism" && s.mat === "steel" && s.h === 5)).toBe(false);
  });

  it("dos autos de la medida de props.car", () => {
    expect(built().solids.filter((s) => s.kind === "prism" && (s.mat === "steel" || s.mat === "rust") && s.h === 1.2)).toHaveLength(2);
  });

  it("ninguna pieza sale de la huella del puente con sus rampas", () => {
    const { solids, accents } = built();
    const inside = (x: number, y: number) => x >= BRIDGE.x0 - STREET - 1e-6 && x <= BRIDGE.x1 + STREET + 1e-6 && y >= BRIDGE.y0 - 1 - 1e-6 && y <= BRIDGE.y1 + 1 + 1e-6;
    for (const s of solids) { const b = bounds(s); expect(inside(b.min.x, b.min.y) && inside(b.max.x, b.max.y)).toBe(true); }
    for (const a of accents) if (a.kind === "dot") expect(inside(a.at.x, a.at.y)).toBe(true);
  });
});

describe("collapsed", () => {
  const built = () => { const solids: Solid[] = []; collapsed(solids, createRng(3)); return solids; };

  it("un fragmento de cúpula hundido, entero en agua, al oeste del labio de la rampa y sin tocar los bloques hundidos", () => {
    const solids = built();
    const domes = solids.filter((s): s is Solid & { kind: "dome" } => s.kind === "dome");
    expect(domes).toHaveLength(1);
    const d = domes[0]!;
    expect(d).toMatchObject({ mat: "officeDark", sides: 8, rings: 2, tone: -1 });
    expect(d.at.z).toBeLessThan(0);
    expect(d.h).toBeLessThan(d.r);
    expect(d.at.x + d.r).toBeLessThan(estuaryEast(d.at.y - d.r)); // la ribera se abre hacia el sur: el borde norte es el más justo
    expect(d.at.x + d.r).toBeLessThanOrEqual(COLLAPSED.x - 6);   // labio bajo de la rampa
    const box = { x0: d.at.x - d.r, x1: d.at.x + d.r, y0: d.at.y - d.r, y1: d.at.y + d.r };
    const sunk = solids.filter((s) => s.kind === "prism" && s.mat === "officeDark" && s.at.z < 0);
    expect(sunk).toHaveLength(3);
    for (const s of sunk) {
      const b = bounds(s);
      expect(box.x0 < b.max.x && box.x1 > b.min.x && box.y0 < b.max.y && box.y1 > b.min.y).toBe(false);
    }
  });

  it("la cúpula no consume rng: el resto del derrumbe es el de siempre", () => {
    expect(built().filter((s) => s.kind !== "dome")).toHaveLength(7); // rampa, plataforma, ruina, tres bloques hundidos, bloque en la calle
    const a = createRng(3), b = createRng(3);
    collapsed([], a); b.int(2, 3); // la única tirada: el alto de la ruina
    expect(a.next()).toBe(b.next());
  });
});
