import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import { awning, dockCrane } from "../kit/props";
import { createRng } from "../map/seed";
import { AVENUE, BLOCK_W, BRIDGE, COLLAPSED, EAST_RING, MALECON, PLAZA, SIDEWALK, STREET, TOWER, WEST_QUAY, blocks, estuaryEast } from "../scenes/city-grid";
import { plazaTone, tiles } from "../scenes/city-pieces";
import { bridge, collapsed, malecon, plazaAndTower, westQuay } from "./fixed";

const EPS = 1e-6;
/** Solape estricto de cajas: dos sólidos que solo se tocan (uno apoyado sobre otro) no cuentan. */
const overlaps = (a: Bounds, b: Bounds) =>
  a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS && a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS && a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS;
const overlapping = (solids: Solid[]) => {
  const bs = solids.map(bounds), out: [Solid, Solid][] = [];
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (overlaps(bs[i]!, bs[j]!)) out.push([solids[i]!, solids[j]!]);
  return out;
};
const prisms = (solids: Solid[]) => solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism");
const dots = (accents: Accent[]) => accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");

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

describe("malecon", () => {
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; const bulbs = malecon(solids, accents); return { solids, accents, bulbs }; };
  const { x0, x1, y0, y1, z } = MALECON;

  it("los dos muros largos llevan galería de arcos sobre el agua", () => {
    const walls = prisms(built().solids).filter((s) => s.at.z === -1 && s.d > 30);
    expect(walls).toHaveLength(2);
    for (const w of walls) expect(w.facade).toEqual({ floors: 1, cols: Math.round(w.d / 6), base: "arcade", bands: false });
  });

  it("pérgola: cuatro postes deck sobre el paseo, fuera de la escalera, dos vigas de 12 y una guirnalda a z ≈ 3.6", () => {
    const { solids, accents } = built();
    const posts = prisms(solids).filter((s) => s.mat === "deck" && s.w === 0.4 && s.d === 0.4 && s.h === 3);
    expect(posts).toHaveLength(4);
    for (const p of posts) {
      expect(p.at.z).toBe(z);
      expect(p.at.x).toBeGreaterThanOrEqual(x0);
      expect(p.at.x + p.w).toBeLessThanOrEqual(x1 - 6); // la escalera ocupa x1 − 6 .. x1
    }
    const beams = prisms(solids).filter((s) => s.mat === "deck" && s.d === 12);
    expect(beams).toHaveLength(2);
    for (const b of beams) expect(b).toMatchObject({ w: 0.3, h: 0.3, at: { y: 221, z: z + 3 } });
    const lights = dots(accents).filter((a) => a.color === "amber" && a.r === 0.25 && Math.abs(a.at.z - 3.6) < EPS && a.at.x >= x0 && a.at.x <= x1 && a.at.y >= y0 && a.at.y <= y1);
    expect(lights.length).toBeGreaterThanOrEqual(6);
  });

  it("un kiosco en (x0 + 2, 240) sobre el paseo", () => {
    const k = prisms(built().solids).filter((s) => s.mat === "officeDark" && s.w === 2 && s.d === 2 && s.h === 2.4);
    expect(k).toHaveLength(1);
    expect(k[0]!.at).toEqual(v3(x0 + 2, 240, z));
  });

  it("devuelve los 8 bombillos de hoy", () => {
    expect(built().bulbs).toEqual([180, 210, 250, 272, 284, 296, 308, 320].map((y) => v3(x1 - 3 + 0.3, y + 0.3, z + 5.4)));
  });

  it("ningún sólido del malecón se solapa en caja con otro", () => {
    expect(overlapping(built().solids)).toEqual([]);
  });
});

describe("westQuay", () => {
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; westQuay(solids, accents); return { solids, accents }; };
  const { x0, x1 } = WEST_QUAY;
  const inQuay = (b: Bounds) => b.min.x >= x0 - EPS && b.max.x <= x1 + EPS;

  it("muro en dos tramos y escalera como hoy", () => {
    const { solids } = built();
    expect(prisms(solids).filter((s) => s.mat === "plaza" && s.at.x === x0 && s.at.z === -1 && s.w === x1 - x0 && s.h === 1.6)).toHaveLength(2);
    expect(solids.filter((s) => s.kind === "ramp" && s.mat === "plaza" && s.at.y === 194 && s.at.z === -1 && s.d === 6)).toHaveLength(1);
  });

  it("dos galpones vault rust sobre el muelle, en y 164..176 y 178..190, dentro de 192..198 y sin solaparse", () => {
    const vaults = built().solids.filter((s): s is Solid & { kind: "vault" } => s.kind === "vault");
    expect(vaults).toHaveLength(2);
    for (const v of vaults) {
      expect(v).toMatchObject({ mat: "rust", axis: "y", len: 12, w: 5, h: 2.5, segments: 6 });
      expect(v.at.z).toBe(0.6);
      expect(inQuay(bounds(v))).toBe(true);
    }
    expect(vaults.map((v) => v.at.y).sort((a, b) => a - b)).toEqual([164, 178]);
    expect(overlaps(bounds(vaults[0]!), bounds(vaults[1]!))).toBe(false);
  });

  it("una grúa de muelle sobre el muro y al menos seis bolardos fuera de galpones y escalera", () => {
    const { solids } = built();
    const masts = prisms(solids).filter((s) => s.mat === "steel" && s.w === 1 && s.d === 1 && s.h === 6);
    expect(masts).toHaveLength(1);
    expect(masts[0]!.at).toEqual(v3(195, 202, 0.6));
    const bollards = solids.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "rust" && s.r === 0.4);
    expect(bollards.length).toBeGreaterThanOrEqual(6);
    for (const b of bollards) {
      expect(b.at.z).toBe(0.6);
      expect(inQuay(bounds(b))).toBe(true);
      expect(b.at.y + b.r <= 194 || b.at.y - b.r >= 200).toBe(true);
    }
  });

  it("terrazas: al menos seis mesas y doce sillas en la calle del muelle, antes de la avenida, sin entrar al muro ni a una manzana", () => {
    const { solids } = built();
    const tables = prisms(solids).filter((s) => s.mat === "paving" && s.w === 1 && s.d === 1 && s.h === 0.7);
    const chairs = prisms(solids).filter((s) => s.mat === "paving" && s.w === 0.5 && s.d === 0.5 && s.h === 0.5);
    expect(tables.length).toBeGreaterThanOrEqual(6);
    expect(chairs.length).toBeGreaterThanOrEqual(12);
    const terrace = solids.filter((s) => bounds(s).max.x <= x0 + EPS && s.mat !== "awning"); // los toldos cuelgan de la pared del lote, sobre la vereda de la manzana
    expect(terrace.length).toBeGreaterThanOrEqual(tables.length + chairs.length);
    for (const s of terrace) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(186 - EPS);
      expect(b.max.y).toBeLessThan(AVENUE.y0);
      expect(blocks().some((k) => b.min.x < k.x + k.w - EPS && b.max.x > k.x + EPS && b.min.y < k.y + k.d - EPS && b.max.y > k.y + EPS)).toBe(false);
    }
  });

  it("toldos contra la pared del lote (x 184.5, la vereda de 1.5 por dentro de la manzana), mirando a la calle, y una guirnalda entre postes", () => {
    const { solids, accents } = built();
    const awnings = solids.filter((s) => s.kind === "ramp" && s.mat === "awning");
    expect(awnings.length).toBeGreaterThanOrEqual(6);
    for (const a of awnings) expect(a.kind === "ramp" && a.dir === "e" && a.at.x === 162 + BLOCK_W - SIDEWALK).toBe(true);
    const posts = prisms(solids).filter((s) => s.mat === "steel" && s.w === 0.3 && s.d === 0.3 && s.h === 3);
    expect(posts.length).toBeGreaterThanOrEqual(2);
    const lights = dots(accents).filter((a) => a.color === "amber" && a.r === 0.25 && a.at.x >= 186 && a.at.x <= x0 && a.at.y < AVENUE.y0);
    expect(lights.length).toBeGreaterThanOrEqual(6);
  });

  it("una mesa frente a una vidriera que ya trae toldo no suma otro encima", () => {
    const solids: Solid[] = [...awning(v3(184.5, 166, 2.3), 5, "e")], accents: Accent[] = [];
    westQuay(solids, accents);
    const awnings = solids.filter((s) => s.kind === "ramp" && s.mat === "awning");
    expect(awnings).toHaveLength(6); // el de la vidriera más cinco de las seis mesas
    expect(overlapping(awnings)).toEqual([]);
  });

  it("ningún sólido del muelle se solapa en caja con otro", () => {
    // mástil y pluma de la grúa son una sola prop: su solape interno no cuenta, el resto sí
    const crane = dockCrane(v3(195, 202, 0.6), "e").map((c) => JSON.stringify(c));
    const own = (s: Solid) => crane.includes(JSON.stringify(s));
    expect(overlapping(built().solids).filter(([a, b]) => !(own(a) && own(b)))).toEqual([]);
  });
});

describe("plazaAndTower", () => {
  const built = () => { const solids: Solid[] = [], ground: Solid[] = [], accents: Accent[] = []; const tower = plazaAndTower(solids, ground, accents, createRng(7)); return { solids, ground, accents, tower }; };
  const fountainOf = (solids: Solid[]) => solids.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "marble" && s.r === 3);
  const kiosksOf = (solids: Solid[]) => prisms(solids).filter((s) => s.mat === "officeDark" && s.w === 2 && s.d === 2 && s.h === 2.4);

  it("una fuente de mármol r 3 centrada en (150, 227) con su charco alpha 0.35", () => {
    const { solids, accents } = built();
    const f = fountainOf(solids);
    expect(f).toHaveLength(1);
    expect(f[0]!.at.x).toBe(150);
    expect(f[0]!.at.y).toBe(227);
    expect(accents.filter((a) => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.35)).toHaveLength(3);
  });

  it("dos kioscos dentro de la plaza, en las esquinas norte", () => {
    const { solids } = built();
    const ks = kiosksOf(solids);
    expect(ks).toHaveLength(2);
    for (const k of ks) {
      const b = bounds(k);
      expect(b.min.x >= PLAZA.x && b.max.x <= PLAZA.x + PLAZA.w && b.min.y >= PLAZA.y && b.max.y <= PLAZA.y + PLAZA.d).toBe(true);
      expect(b.min.y).toBeLessThan(PLAZA.y + 3);
    }
    expect(Math.min(...ks.map((k) => k.at.x))).toBeLessThan(PLAZA.x + 6);
    expect(Math.max(...ks.map((k) => k.at.x))).toBeGreaterThan(PLAZA.x + PLAZA.w - 6);
  });

  it("la torre como antes: 8 ventanas encendidas, antena y la ventana del papel en la pared este", () => {
    const { tower } = built();
    expect(tower.litWindows).toHaveLength(8);
    expect(tower.paperWindow.x).toBeCloseTo(TOWER.x + TOWER.w, 6);
    expect(tower.antenna.z).toBeGreaterThan(35);
  });

  it("lo nuevo no pasa de 5 ni se solapa con bancos, faroles, cordón ni torre", () => {
    const { solids } = built();
    const fountain = solids.filter((s) => s.mat === "marble"), kiosks = solids.filter((s) => s.mat === "terracotta" || kiosksOf(solids).includes(s as Solid & { kind: "prism" }));
    const fresh = [...fountain, ...kiosks];
    expect(fresh.length).toBe(2 + 4);
    const rest = solids.filter((s) => !fresh.includes(s)).map(bounds);
    for (const s of fresh) {
      const b = bounds(s);
      expect(b.max.z).toBeLessThanOrEqual(5);
      expect(rest.some((r) => overlaps(b, r))).toBe(false);
    }
  });

  it("los dos charcos de la torre siguen con alpha 0.25 y el rng se consume como hoy", () => {
    expect(built().accents.filter((a) => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.25)).toHaveLength(6);
    const a = createRng(7), b = createRng(7);
    plazaAndTower([], [], [], a); tiles(b, PLAZA, 0.05, "plaza", plazaTone);
    expect(a.next()).toBe(b.next());
  });
});
