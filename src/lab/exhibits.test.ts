import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { project, Z_SCALE } from "../iso/project";
import { bounds, tessellate, type Solid } from "../iso/solids";
import { BLEED, WORLD } from "../map/geo";
import { STAIR_TOWER } from "../scenes/boiler-house";
import { WATER_TOWER, waterTower } from "../scenes/maltings";
import { createFactoryAnim } from "../scenes/factory-anim";
import { PLANT, factory } from "../scenes/factory";
import { BEAM_PERIOD_MS } from "../scenes/sea-anim";
import { trainLen } from "../scenes/train";
import { createRng } from "../map/seed";
import { assembleWorld } from "../world/assemble";
import { type Box, FRAME_H, HALO_BASE } from "../world/frame";
import { cropAnimators, cropScene } from "./crop";
import { EXHIBITS, GROUPS, type GroupId, outOfView, pickExhibit, stepExhibit } from "./exhibits";

const regions = EXHIBITS.flatMap((e) => (e.kind === "region" ? [e] : []));

// the index of spec §3, in order; pieces (#94) do not count
const CATALOG: Record<GroupId, string[]> = {
  factory: ["planta", "chimeneas", "subestacion", "playa-camiones", "playa-vias", "excavadora"],
  shipyard: ["gradas", "darsena", "grua-portico", "calle-faroles", "naves", "punta-norte", "estacion", "paso-a-nivel"],
  hinterland: ["central-termica", "tanques", "silos", "alta-tension", "playa-contenedores"],
  fair: ["noria", "montana-rusa", "torre-caida", "carrusel", "arcade", "autitos-chocadores", "muelle"],
  city: ["plaza", "torre", "puente", "malecon", "manzana-derrumbada", "manzana-distrito", "obra", "punta-sur", "galpones", "playa-carga"],
  tech: ["mastil", "arena", "auditorio", "torres", "monoblock", "casas", "escuela", "club", "plaza-barrio", "costanera", "barrio"],
  sea: ["faro", "casa-farero", "boyas", "pecio"],
};
const ANIMATED = ["chimeneas", "excavadora", "noria", "torre", "faro", "estacion", "paso-a-nivel", "playa-carga"];
const SLACK = 8; // any taller than this above the structure and it looks small in the frame

const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
const within = (s: Solid, b: Box): boolean => { const r = bounds(s); return r.min.x >= b.x0 && r.max.x <= b.x1 && r.min.y >= b.y0 && r.max.y <= b.y1; };
const top = (solids: readonly Solid[]): number => Math.max(0, ...solids.map((s) => bounds(s).max.z));

const TURN_STEPS = 32;
const HALO_K = Math.max(...HALO_BASE.map((h) => h.k)); // the largest disc `drawAccents` draws around a point

/** Height the structure's accents ask for (measured on screen against the north vertex of `boxFrame`), static and animated over one turn of the beam; fresh world so it does not depend on catalog order. */
function accentReach(box: Box): number {
  const north = (box.x0 + box.y0) / 2;
  const own = (a: Accent): boolean => { const p = a.kind === "dot" ? a.at : a.pts[0]!; return p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1; };
  const reach = (accents: readonly Accent[]): number => Math.max(0, ...accents.filter(own).flatMap((a) =>
    a.kind === "dot" ? [(north - project(a.at).y + a.r * HALO_K) / Z_SCALE] : a.pts.map((p) => (north - project(p).y) / Z_SCALE)));
  const sweep = assembleWorld(undefined, { reducedMotion: false });
  const anims = cropAnimators(sweep.animators, box);
  let max = reach(cropScene(sweep.scene, box).accents);
  for (let k = 0; k < TURN_STEPS; k++) {
    for (const a of anims) for (const id of a.ids) { const l = a.layer(id); if (l.kind === "accent") max = Math.max(max, reach(l.accents)); }
    for (const a of anims) a.tick(BEAM_PERIOD_MS / TURN_STEPS);
  }
  return max;
}

/** Heights of what the box crops: static inside, static + animated layers inside, the tallest cut neighbor and what the accents ask for. */
function measure(box: Box): { inside: number; withAnim: number; neighbor: number; accents: number } {
  const cs = cropScene(scene, box);
  const fixed = [...cs.ground, ...cs.solids];
  const anim = cropAnimators(animators, box).flatMap((a) => a.ids.flatMap((id) => { const l = a.layer(id); return l.kind === "solid" ? l.solids : []; }));
  const inside = top(fixed.filter((s) => within(s, box)));
  return {
    inside,
    withAnim: Math.max(inside, top(anim.filter((s) => within(s, box)))),
    neighbor: top(fixed.filter((s) => s.kind !== "ground" && !within(s, box))),
    accents: accentReach(box),
  };
}

describe("exhibit catalog", () => {
  it("unique ids matching the hash pattern", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("the index groups are contiguous, in GROUPS order and with their group's zone", () => {
    const order = GROUPS.map((g) => g.id);
    const seen = EXHIBITS.map((e) => e.group).filter((g, i, all) => i === 0 || all[i - 1] !== g);
    expect(seen).toEqual(order.filter((g) => seen.includes(g)));
    for (const e of EXHIBITS) expect(e.zone, e.id).toBe(GROUPS.find((g) => g.id === e.group)!.zone);
  });
  it("the rail yard exhibit ends at the seam, y 90", () => {
    const e = EXHIBITS.find((x) => x.id === "playa-vias")!;
    expect(e.kind === "region" && e.box.y1).toBe(90);
  });
  it("every box falls inside the world plus the bleed and is not inverted", () => {
    for (const { id, box } of regions) {
      expect(box.x0, id).toBeLessThan(box.x1); expect(box.y0, id).toBeLessThan(box.y1);
      expect(box.x0, id).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(box.x1, id).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(box.y0, id).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(box.y1, id).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
    }
  });
  it("estacion and paso-a-nivel crop the train animator in its initial state (#281)", () => {
    for (const id of ["estacion", "paso-a-nivel"]) {
      const e = regions.find((r) => r.id === id)!;
      expect(cropAnimators(animators, e.box).some((a) => a.ids.includes("rail.train")), id).toBe(true);
    }
  });
  it("the four exhibits of #92 crop an animator that is not the water", () => {
    for (const id of ANIMATED) {
      const e = regions.find((r) => r.id === id)!;
      expect(cropAnimators(animators, e.box).some((a) => a.zone !== null), id).toBe(true);
    }
  });

  describe.each(GROUPS.map((g) => g.id))("group %s", (group) => {
    const mine = regions.filter((e) => e.group === group);
    const measured = new Map(mine.map((e) => [e, measure(e.box)]));
    it("has the spec's regions, in order", () => {
      expect(mine.map((e) => e.id)).toEqual(CATALOG[group]);
    });
    it("non-empty: against the real world every region crops at least one solid", () => {
      for (const e of mine) expect(cropScene(scene, e.box).solids.length, e.id).toBeGreaterThan(0);
    });
    it("framing: h covers the structure and its accents and exceeds them by no more than SLACK", () => {
      for (const e of mine) {
        const h = e.h ?? FRAME_H, m = measured.get(e)!;
        expect(h, e.id).toBeGreaterThanOrEqual(Math.max(m.inside, m.accents));
        expect(h, e.id).toBeLessThanOrEqual(Math.max(m.withAnim, m.accents) + SLACK);
      }
    });
    it("neighbors: no solid cut by the edge rises above h", () => {
      for (const e of mine) expect(measured.get(e)!.neighbor, e.id).toBeLessThanOrEqual(e.h ?? FRAME_H);
    });
  });
});

describe("boiler house box (#213)", () => {
  it("planta reaches the east edge of the stair tower (STAIR_TOWER.x1): the tower is in and the first chimney is out", () => {
    const e = regions.find((r) => r.id === "planta")!;
    expect(e.box.x1).toBe(STAIR_TOWER.x1);
    const cs = cropScene(scene, e.box);
    expect(cs.solids.some((s) => s.kind === "prism" && s.mat === "steel" && s.w === 5 && s.d === 8)).toBe(true); // tower landings
    expect(cs.solids.some((s) => s.kind === "prism" && s.mat === "concrete" && s.w === 7 && s.d === 7)).toBe(false); // chimney pedestals: y ≥ 22.5, north of the box
    expect(cs.solids.filter((s) => s.kind === "cylinder" && s.mat === "rust" && s.r === 0.5)).toHaveLength(4); // metal chimneys
  });
});

describe("substation box (#244)", () => {
  it("follows the fence formula: {51, −5, 98, 12} h 13, without crossing `calle-faroles` (x0 99) or dropping to the wagons (y ≤ −6.8)", () => {
    const e = regions.find((x) => x.id === "subestacion")!, street = regions.find((x) => x.id === "calle-faroles")!;
    expect(e.box).toEqual({ x0: 51, y0: -5, x1: 98, y1: 12 });
    expect(e.h).toBe(13);
    expect(e.box.x1).toBeLessThan(street.box.x0);
    expect(e.box.y0).toBeGreaterThan(-6.8);
  });
});

describe("selection by hash", () => {
  const [first, second] = EXHIBITS;
  it("accepts the hash with or without #", () => {
    expect(pickExhibit(`#${second!.id}`)).toBe(second);
    expect(pickExhibit(second!.id)).toBe(second);
  });
  it("empty, just # or unknown → the first", () => {
    for (const h of ["", "#", "#nothing", "#%E0%A4%A", `#${second!.id.toUpperCase()}`]) expect(pickExhibit(h)).toBe(first);
  });
  it("the arrows wrap around at the ends", () => {
    const last = EXHIBITS[EXHIBITS.length - 1]!;
    expect(stepExhibit(first!.id, 1)).toBe(second);
    expect(stepExhibit(first!.id, -1)).toBe(last);
    expect(stepExhibit(last.id, 1)).toBe(first);
  });
  it("with an unknown id the arrows go to the first", () => {
    expect(stepExhibit("nothing", 1)).toBe(first);
    expect(stepExhibit("nothing", -1)).toBe(first);
  });
});

const pieces = EXHIBITS.flatMap((e) => (e.kind === "piece" ? [e] : []));

describe("piece exhibits", () => {
  it("the eleven pieces, each in its zone", () => {
    expect(Object.fromEntries(pieces.map((e) => [e.id, e.zone]))).toEqual({
      "tanque-agua": "portfolio", "grua-torre": "portfolio", "farol": "portfolio", "tren": "portfolio",
      "campus": "cv", "selva": "cv",
      "viga": "blog", "carguero": "blog", "remolcador": "blog", "convoy": "blog", "lancha": "blog",
    });
  });
  it("the beam is a single-solid beam piece, before the freighter", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("viga")).toBe(ids.indexOf("carguero") - 1);
    const e = EXHIBITS.find((x) => x.id === "viga")!;
    expect(e.kind).toBe("piece");
    const out: Solid[] = [];
    if (e.kind === "piece") e.build(out, []);
    expect(out.map((s) => s.kind)).toEqual(["beam"]);
  });
  it("the water tank (#214) stands alone, centered at the origin, after planta: planta's box does not contain it (#246)", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("tanque-agua")).toBe(ids.indexOf("planta") + 1);
    const e = EXHIBITS.find((x) => x.id === "tanque-agua")!;
    const out: Solid[] = [];
    if (e.kind === "piece") e.build(out, []);
    const ref: Solid[] = [];
    waterTower(ref, WATER_TOWER);
    expect(out).toHaveLength(ref.length);
    for (const s of out) if (s.kind === "cylinder" || s.kind === "cone") expect([s.at.x, s.at.y]).toEqual([0, 0]);
    const deck = out.find((s) => s.kind === "cylinder" && s.r === 4.6)!;
    expect(deck.kind === "cylinder" && deck.at.x === 0 && deck.at.y === 0).toBe(true);
  });
  it("the train (#281) comes after the lamp, on paving: solids only, ≤ 600 faces, centered at the origin", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("tren")).toBe(ids.indexOf("farol") + 1);
    const e = pieces.find((x) => x.id === "tren")!;
    expect(e.pad).toBe("paving");
    const out: Solid[] = [], accents: Accent[] = [];
    e.build(out, accents);
    expect(accents).toEqual([]); // the lights come from the piece's animator
    expect(out.flatMap(tessellate).length).toBeLessThanOrEqual(600);
    const xs = out.flatMap((s) => { const b = bounds(s); return [b.min.x, b.max.x]; });
    expect(Math.min(...xs)).toBeCloseTo(-trainLen(4) / 2, 9);
    expect(Math.max(...xs)).toBeCloseTo(trainLen(4) / 2, 9);
  });
  it("with animate, the train lights switch ends every 4 s; with reducedMotion they stay east", () => {
    const e = pieces.find((x) => x.id === "tren")!;
    expect(e.animate).toBeDefined();
    const cyanX = (a: ReturnType<NonNullable<typeof e.animate>>): number[] => {
      const l = a.layer("tren.lights");
      if (l.kind !== "accent") throw new Error("tren.lights");
      expect(l.zone).toBe("portfolio");
      return l.accents.flatMap((x) => (x.kind === "dot" && x.color === "cyan" ? [x.at.x] : []));
    };
    const a = e.animate!({ reducedMotion: false });
    expect([...a.ids]).toEqual(["tren.lights"]);
    expect(a.tick(16).has("tren.lights")).toBe(true);
    expect(cyanX(a).length).toBe(2);
    for (const x of cyanX(a)) expect(x).toBeGreaterThan(0);
    expect(a.tick(1000).size).toBe(0);
    expect(a.tick(3000).has("tren.lights")).toBe(true);
    for (const x of cyanX(a)) expect(x).toBeLessThan(0);
    const r = e.animate!({ reducedMotion: true });
    expect(r.tick(4000).size).toBe(0);
    expect(r.tick(4000).size).toBe(0);
    for (const x of cyanX(r)) expect(x).toBeGreaterThan(0);
  });
  it("every piece emits at least one solid", () => {
    for (const e of pieces) {
      const out: Solid[] = [], accents: Accent[] = [];
      e.build(out, accents);
      expect(out.length, e.id).toBeGreaterThan(0);
    }
  });
  it("building the same piece twice gives the same result", () => {
    for (const e of pieces) {
      const a: Solid[] = [], b: Solid[] = [], aa: Accent[] = [], ba: Accent[] = [];
      e.build(a, aa); e.build(b, ba);
      expect(b, e.id).toEqual(a);
      expect(ba, e.id).toEqual(aa);
    }
  });
});

describe("index entry out of view (#117)", () => {
  const view = { top: 0, bottom: 900 };
  it("fully inside, or flush with an edge, is not out", () => {
    expect(outOfView({ top: 100, bottom: 122 }, view)).toBe(false);
    expect(outOfView({ top: 0, bottom: 22 }, view)).toBe(false);
    expect(outOfView({ top: 878, bottom: 900 }, view)).toBe(false);
  });
  it("cut by an edge is out", () => {
    expect(outOfView({ top: 890, bottom: 912 }, view)).toBe(true);
    expect(outOfView({ top: -10, bottom: 12 }, view)).toBe(true);
  });
  it("entirely above or below is out", () => {
    expect(outOfView({ top: 1200, bottom: 1222 }, view)).toBe(true);
    expect(outOfView({ top: -300, bottom: -278 }, view)).toBe(true);
  });
  it("the view need not start at 0", () => {
    const low = { top: 100, bottom: 600 };
    expect(outOfView({ top: 50, bottom: 72 }, low)).toBe(true);
    expect(outOfView({ top: 100, bottom: 122 }, low)).toBe(false);
    expect(outOfView({ top: 590, bottom: 612 }, low)).toBe(true);
  });
});

describe("plant box with malting (#214, #246)", () => {
  const e = regions.find((r) => r.id === "planta")!;

  it("planta runs from PLANT.x − 3 to STAIR_TOWER.x1 and from PLANT.y − 3 to 2 south of the south wall: {2, 41, 98, 76}", () => {
    expect(e.box).toEqual({ x0: PLANT.x - 3, y0: PLANT.y - 3, x1: STAIR_TOWER.x1, y1: PLANT.y + PLANT.d + 2 });
    expect(e.box).toEqual({ x0: 2, y0: 41, x1: 98, y1: 76 });
    expect(e.title).toBe("Boiler house and malting");
  });

  it("rises to 26 for the kiln apex and does not contain the tank (no cylinder r 4.6)", () => {
    expect(e.h).toBe(26);
    const cs = cropScene(scene, e.box);
    expect(cs.solids.some((s) => s.kind === "cone" && s.sides === 4 && s.at.z + s.h === 26)).toBe(true);
    expect(cs.solids.some((s) => s.kind === "cylinder" && s.r === 4.6)).toBe(false);
  });

  it("plinth and hopper are in; trucks and street lamps are out, except the one at (5, 76), which touches the south edge (cropSolid includes edges)", () => {
    const cs = cropScene(scene, e.box);
    expect(cs.solids.some((s) => s.kind === "prism" && s.mat === "whitewash" && s.h === 3.5)).toBe(true); // plinth
    expect(cs.solids.some((s) => s.kind === "prism" && s.mat === "rust" && s.w === 3 && s.d === 2 && s.h === 2.5)).toBe(true); // hopper
    expect(cs.solids.some((s) => s.kind === "prism" && s.d === 2.4 && s.h === 2.8)).toBe(false); // trucks
    expect(cs.solids.flatMap((s) => (s.kind === "prism" && s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5 ? [[s.at.x, s.at.y]] : []))).toEqual([[5, 76]]); // street lamps
  });
});

describe("truck yard box (#246)", () => {
  const e = regions.find((r) => r.id === "playa-camiones")!;

  it("{2, 76, 98, 92} h 16: the three trucks, the six pallets and the belt are in; the tower crane is not", () => {
    expect(e.box).toEqual({ x0: 2, y0: 76, x1: 98, y1: 92 });
    expect(e.h).toBe(16);
    const cs = cropScene(scene, e.box);
    expect(cs.solids.filter((s) => s.kind === "prism" && s.w === 6 && s.d === 2.4 && s.h === 2.8)).toHaveLength(3);
    expect(cs.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && s.w === 3 && s.d === 2)).toHaveLength(6);
    expect(cs.solids.some((s) => s.kind === "beam" && s.mat === "rust" && s.w === 1.6)).toBe(true); // inclined belt
    expect(cs.solids.some((s) => s.kind === "prism" && s.h === 20 && s.w === 1.2)).toBe(false); // crane mast
  });
});

describe("chimneys box (#245)", () => {
  const e = regions.find((r) => r.id === "chimeneas")!;

  it("is computed from STACKS and COOLING: x0 COOLING.x − r − 3, 13 more to the east for the smoke, the platform to the south (r + 1.2); h 36", () => {
    expect(e.box.x0).toBeCloseTo(40 - 9 - 3, 9);
    expect(e.box.y0).toBeCloseTo(26 - 2.8 - 28, 9);
    expect(e.box.x1).toBeCloseTo(86 + 2.8 + 3 + 13, 9);
    expect(e.box.y1).toBeCloseTo(32 + 2.8 + 1.2 + 3, 9);
    expect(e.h).toBeCloseTo(29 + 28 * 0.25, 9);
  });

  it("no puff leaves the box in x/y over one turn (40 s at 33 ms)", () => {
    const anim = createFactoryAnim(factory(createRng(7)).stacks, createRng(1), { reducedMotion: false });
    const { x0, y0, x1, y1 } = e.box;
    for (let t = 0; t <= 40_000; t += 33) {
      for (let k = 0; k < 3; k++) for (const p of anim.puffs(k)) {
        const b = bounds(p);
        expect(b.min.x >= x0 && b.max.x <= x1 && b.min.y >= y0 && b.max.y <= y1, `t ${t} chimney ${k}: ${JSON.stringify(b)}`).toBe(true);
      }
      anim.tick(33);
    }
  });
});
