import { describe, expect, it } from "vitest";
import { spotOf } from "../iso/spot-fixtures";
import type { Accent } from "../iso/accent";
import { project, Z_SCALE } from "../iso/project";
import { bounds, tessellate, type Solid } from "../iso/solids";
import { BLEED, WORLD } from "../map/geo";
import { STAIR_TOWER } from "../scenes/boiler-house";
import { WATER_TOWER, waterTower } from "../scenes/maltings";
import { createFactoryAnim } from "../scenes/factory-anim";
import { PLANT, factory } from "../scenes/factory";
import { BEAM_PERIOD_MS } from "../scenes/sea-anim";
import { CROWN_SITE, RESUME_SIGN, towerCrown } from "../scenes/sign-crown";
import { PIECE_AT, TINKER_SIGN, TINKER_SITE, tinkerSign } from "../scenes/sign-tinker";
import { BLOG_SIGNS, seaPlatform, seaPlatformAt } from "../scenes/sign-platform";
import { trainLen } from "../scenes/train";
import { createRng } from "../map/seed";
import { assembleWorld } from "../world/assemble";
import { type Box, FRAME_H, HALO_BASE } from "../world/frame";
import { PLINTH_H } from "../scenes/city-pieces";
import { contextAnimators, contextScene, cropAnimators, cropScene, isLongPrism, readout } from "./crop";
import { EXHIBITS, GROUPS, type GroupId, outOfView, pickExhibit, stepExhibit } from "./exhibits";

const regions = EXHIBITS.flatMap((e) => (e.kind === "region" ? [e] : []));

// the index of spec §3, in order; pieces (#94) do not count
const CATALOG: Record<GroupId, string[]> = {
  factory: ["planta", "chimeneas", "subestacion", "playa-camiones", "playa-vias", "excavadora"],
  shipyard: ["gradas", "darsena", "grua-portico", "calle-faroles", "naves", "punta-norte", "estacion", "paso-a-nivel", "dique-flotante", "patio-contenedores"],
  hinterland: ["central-termica", "tanques", "silos", "alta-tension", "playa-contenedores"],
  fair: ["noria", "montana-rusa", "torre-caida", "carrusel", "arcade", "autitos-chocadores", "muelle", "tren-fantasma", "casa-espejos", "tobogan", "tronco-acuatico"],
  city: ["plaza", "torre", "puente", "malecon", "manzana-derrumbada", "manzana-distrito", "obra", "punta-sur", "galpones", "playa-carga", "mercado-pescado"],
  tech: ["mastil", "arena", "auditorio", "torres", "monoblock", "casas", "escuela", "club", "plaza-barrio", "costanera", "barrio"],
  sea: ["faro", "casa-farero", "boyas", "pecio"],
};
const ANIMATED = ["chimeneas", "excavadora", "noria", "torre", "faro", "estacion", "paso-a-nivel", "playa-carga", "tronco-acuatico"];
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
  it("the basin ends at y 72, where the floating dock begins (#323)", () => {
    const e = EXHIBITS.find((x) => x.id === "darsena")!;
    expect(e.kind === "region" && e.box.y1).toBe(72);
  });
  it("the east bank exhibits of #323: two regions after paso-a-nivel and the quay crane piece on concrete", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.slice(ids.indexOf("paso-a-nivel") + 1, ids.indexOf("paso-a-nivel") + 4)).toEqual(["dique-flotante", "patio-contenedores", "grua-muelle"]);
    const box = (id: string) => { const e = EXHIBITS.find((x) => x.id === id)!; return e.kind === "region" ? e.box : null; };
    expect(box("dique-flotante")).toEqual({ x0: 202, y0: 72, x1: 248, y1: 90 });
    expect(box("patio-contenedores")).toEqual({ x0: 278, y0: 27, x1: 305, y1: 84 });
    const crane = pieces.find((x) => x.id === "grua-muelle")!;
    expect(crane.pad).toBe("concrete");
    const solids: Solid[] = [], accents: Accent[] = [];
    crane.build(solids, accents);
    expect(accents).toEqual([]);
    expect(top(solids)).toBeCloseTo(17.5, 9);
  });
  it("the fair attractions of #327: four regions after muelle with the issue's boxes; the flume crops the logs layer", () => {
    const box = (id: string) => { const e = EXHIBITS.find((x) => x.id === id)!; return e.kind === "region" ? e.box : null; };
    expect(box("tren-fantasma")).toEqual({ x0: 96, y0: -260, x1: 120, y1: -244 });
    expect(box("casa-espejos")).toEqual({ x0: 122, y0: -260, x1: 142, y1: -244 });
    expect(box("tobogan")).toEqual({ x0: 111, y0: -299, x1: 125, y1: -285 });
    expect(box("tronco-acuatico")).toEqual({ x0: 158, y0: -300, x1: 226, y1: -290 });
    const fl = cropAnimators(animators, box("tronco-acuatico")!).find((a) => a.ids.includes("fair.logs"))!;
    const logs = fl.layer("fair.logs");
    expect(logs.kind === "solid" && logs.solids.length).toBe(2);
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
  it("the fifteen pieces, each in its zone", () => {
    expect(Object.fromEntries(pieces.map((e) => [e.id, e.zone]))).toEqual({
      "tanque-agua": "portfolio", "grua-muelle": "portfolio", "grua-torre": "portfolio", "farol": "portfolio", "tren": "portfolio", "cartel-taller": "portfolio",
      "campus": "cv", "selva": "cv", "cartel-torre": "cv",
      "viga": "blog", "carguero": "blog", "remolcador": "blog", "convoy": "blog", "lancha": "blog", "plataforma": "blog",
    });
  });
  it("the sign pieces (#360, #378): at the end of their group's run, with their titles, groups, pads and builders", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("cartel-taller")).toBe(ids.indexOf("tren") + 1);
    expect(ids.indexOf("cartel-torre")).toBe(ids.indexOf("selva") + 1);
    expect(ids.indexOf("plataforma")).toBe(ids.indexOf("lancha") + 1);
    const get = (id: string) => pieces.find((e) => e.id === id)!;
    expect(get("cartel-taller")).toMatchObject({ title: "Portfolio tinker sign", zone: "portfolio", group: "shipyard", kind: "piece", pad: "concrete" });
    expect(get("cartel-taller").animate).toBeDefined();
    expect(get("cartel-torre")).toMatchObject({ title: "Resume tower crown with helipad", zone: "cv", group: "city", kind: "piece" });
    expect(get("cartel-torre").pad).toBeUndefined();
    expect(ids).not.toContain("cartel-helipuerto");
    expect(ids).not.toContain("cartel-helipuerto-b");
    expect(ids).not.toContain("grafiti");
    expect(get("plataforma")).toMatchObject({ title: "Writing platform sign", zone: "blog", group: "sea", kind: "piece", pad: "water", build: seaPlatform });
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
      expect(l.accents.filter((x) => x.kind === "dot")).toEqual([]); // #403: the lights are spots
      return l.accents.flatMap((x) => { const p = spotOf(x); return p && p.color === "cyan" ? [p.at.x] : []; });
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

  it("plinth and hopper are in; trucks and street lamps are out, the one at (5, 76) too: it only touches the south edge (#399)", () => {
    const cs = cropScene(scene, e.box);
    expect(cs.solids.some((s) => s.kind === "prism" && s.mat === "whitewash" && s.h === 3.5)).toBe(true); // plinth
    expect(cs.solids.some((s) => s.kind === "prism" && s.mat === "rust" && s.w === 3 && s.d === 2 && s.h === 2.5)).toBe(true); // hopper
    expect(cs.solids.some((s) => s.kind === "prism" && s.d === 2.4 && s.h === 2.8)).toBe(false); // trucks
    expect(cs.solids.flatMap((s) => (s.kind === "prism" && s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5 ? [[s.at.x, s.at.y]] : []))).toEqual([]); // street lamps
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

const contexts = EXHIBITS.flatMap((e) => (e.kind === "context" ? [e] : []));

describe("context exhibits (#376)", () => {
  /** Like `measure`, on the context scene (a crop of the world, #392). */
  function measureContext(e: (typeof contexts)[number]): { inside: number; withAnim: number; neighbor: number; accents: number } {
    const cs = contextScene(scene, e), fixed = [...cs.ground, ...cs.solids];
    const anim = contextAnimators(animators, e).flatMap((a) => a.ids.flatMap((id) => { const l = a.layer(id); return l.kind === "solid" ? l.solids : []; }));
    const inside = top(fixed.filter((s) => within(s, e.box)));
    return {
      inside,
      withAnim: Math.max(inside, top(anim.filter((s) => within(s, e.box)))),
      neighbor: top(fixed.filter((s) => s.kind !== "ground" && !within(s, e.box))),
      accents: accentReach(e.box),
    };
  }

  it("at least one: plataforma-escena", () => {
    expect(contexts.map((e) => e.id)).toContain("plataforma-escena");
  });
  it("ids match the hash pattern, zone is the group's", () => {
    for (const e of contexts) {
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
      expect(e.zone, e.id).toBe(GROUPS.find((g) => g.id === e.group)!.zone);
    }
  });
  it("no context exhibit has build or animate: the sign and its animator come from the world (#392)", () => {
    for (const e of contexts) {
      expect("build" in e, e.id).toBe(false);
      expect("animate" in e, e.id).toBe(false);
    }
  });
  it("framing: h covers the structure and its accents and exceeds them by no more than SLACK", () => {
    for (const e of contexts) {
      const h = e.h ?? FRAME_H, m = measureContext(e);
      expect(h, e.id).toBeGreaterThanOrEqual(Math.max(m.inside, m.accents));
      expect(h, e.id).toBeLessThanOrEqual(Math.max(m.withAnim, m.accents) + SLACK);
    }
  });
  it("neighbors: no solid cut by the edge rises above h", () => {
    for (const e of contexts) expect(measureContext(e).neighbor, e.id).toBeLessThanOrEqual(e.h ?? FRAME_H);
  });
  it("every solid of sign.backing is in the crop (#390), except the Writing sea patch: terrain the oracle sees, not a built solid (#437)", () => {
    for (const e of contexts) {
      const solids = contextScene(scene, e).solids, writing = e.sign.text === "WRITING";
      for (const s of writing ? e.sign.backing.slice(0, -1) : e.sign.backing) expect(solids, e.id).toContainEqual(s);
    }
  });
  it("cartel-taller-escena (#379, #392): after cartel-taller, in the shipyard, the issue's box, a crop of the world with the sign and its animator", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("cartel-taller-escena")).toBe(ids.indexOf("cartel-taller") + 1);
    const e = contexts.find((x) => x.id === "cartel-taller-escena")!;
    expect(e).toMatchObject({ title: "Portfolio tinker sign in its scene", zone: "portfolio", group: "shipyard", kind: "context", box: { x0: 20, y0: -58, x1: 100, y1: 0 }, sign: TINKER_SIGN });
    expect(PIECE_AT).toEqual({ x: 0, y: 0, z: 13.5 });
    const c: Solid[] = [], d: Accent[] = [], cs = contextScene(scene, e);
    tinkerSign(c, d, TINKER_SITE);
    for (const s of c) expect(cs.solids).toContainEqual(s);
    for (const a of d) expect(cs.accents).toContainEqual(a);
    const lit = contextAnimators(animators, e).find((x) => x.ids.includes("tinker.lights"));
    expect(lit?.zone).toBe("portfolio");
  });
  it("plataforma-escena and plataforma-escena-angosta (#427): after plataforma, in the sea, one per Writing site, crops of the world (no build)", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("plataforma-escena")).toBe(ids.indexOf("plataforma") + 1);
    expect(ids.indexOf("plataforma-escena-angosta")).toBe(ids.indexOf("plataforma") + 2);
    const wide = contexts.find((x) => x.id === "plataforma-escena")!, tall = contexts.find((x) => x.id === "plataforma-escena-angosta")!;
    expect(wide).toMatchObject({ title: "Writing platform sign in its scene", zone: "blog", group: "sea", kind: "context", box: { x0: 536, y0: 71, x1: 604, y1: 139 }, h: 24, sign: BLOG_SIGNS.wide, writingSite: "wide" });
    expect(tall).toMatchObject({ title: "Writing platform sign in its scene, tall site", zone: "blog", group: "sea", kind: "context", box: { x0: 406, y0: 366, x1: 474, y1: 434 }, h: 24, sign: BLOG_SIGNS.tall, writingSite: "tall" });
    for (const e of [wide, tall]) expect("build" in e, e.id).toBe(false);
  });
  it.each(["plataforma-escena", "plataforma-escena-angosta"])("%s shows the platform once: 74 platform solids, one deck, no platform animator (#427)", (id) => {
    const e = contexts.find((x) => x.id === id)!;
    const own: Solid[] = [];
    seaPlatformAt(own, [], e.writingSite!);
    expect(own).toHaveLength(74);
    const cs = contextScene(scene, e), anims = contextAnimators(animators, e);
    expect(anims.some((a) => a.ids.includes("platform.solid"))).toBe(false);
    const layered = anims.flatMap((a) => a.ids.flatMap((lid) => { const l = a.layer(lid); return l.kind === "solid" ? l.solids : []; }));
    const all = [...cs.solids, ...layered];
    expect(all.filter((s) => s.kind === "poly" && s.mat === "deck")).toHaveLength(1);
    expect(own.filter((p) => all.some((s) => JSON.stringify(s) === JSON.stringify(p)))).toHaveLength(74);
    expect(readout(cs, anims).solids).toBe(all.length);
  });
});

describe("cartel-torre-escena (#378)", () => {
  it("after cartel-torre, in the city, the issue's box, a crop of the world (no build), signed RESUME_SIGN", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(ids.indexOf("cartel-torre-escena")).toBe(ids.indexOf("cartel-torre") + 1);
    const e = contexts.find((x) => x.id === "cartel-torre-escena")!;
    expect(e).toMatchObject({ title: "Resume tower crown in its scene", zone: "cv", group: "city", kind: "context", box: { x0: 108, y0: 206, x1: 150, y1: 248 }, sign: RESUME_SIGN });
    expect("build" in e).toBe(false);
    const c: Solid[] = [], d: Accent[] = [], cs = contextScene(scene, e);
    towerCrown(c, d, CROWN_SITE);
    for (const s of c) expect(cs.solids).toContainEqual(s);
    for (const a of d) expect(cs.accents).toContainEqual(a);
  });
});

describe("clean crops (#399)", () => {
  const EPS = 1e-9;
  const byId = (id: string) => EXHIBITS.find((e) => e.id === id)!;
  const boxOf = (id: string): Box => { const e = byId(id); if (e.kind === "piece") throw new Error(id); return e.box; };
  const cropOf = (id: string) => { const e = byId(id); return e.kind === "context" ? contextScene(scene, e) : cropScene(scene, boxOf(id)); };
  const animsOf = (id: string) => { const e = byId(id); return e.kind === "context" ? contextAnimators(animators, e) : cropAnimators(animators, boxOf(id)); };
  const inside = (p: { x: number; y: number }, b: Box, m = 0): boolean => p.x >= b.x0 - m - EPS && p.x <= b.x1 + m + EPS && p.y >= b.y0 - m - EPS && p.y <= b.y1 + m + EPS;
  const SPEC_REGIONS = ["playa-camiones", "gradas", "estacion", "patio-contenedores", "cartel-taller-escena", "silos", "playa-contenedores", "autitos-chocadores", "faro", "pecio"];

  it("playa-camiones: no city plinth (paving, PLINTH_H) at y 92 creeps in by touching the south edge", () => {
    const cs = cropOf("playa-camiones");
    expect([...cs.ground, ...cs.solids].filter((s) => s.kind === "prism" && s.mat === "paving" && s.h === PLINTH_H && s.at.y === 92)).toEqual([]);
  });

  it.each(["playa-camiones", "gradas", "estacion", "cartel-taller-escena", "silos"])("%s: every strip and every long prism of the crop stays inside the box", (id) => {
    const b = boxOf(id), cs = cropOf(id);
    const all = [...cs.ground, ...cs.solids, ...animsOf(id).flatMap((a) => a.ids.flatMap((i) => { const l = a.layer(i); return l.kind === "solid" ? l.solids : []; }))];
    let strips = 0;
    for (const s of all) {
      if (s.kind === "strip") {
        strips++;
        for (const p of s.path) expect(inside(p, b), `${id} strip ${s.mat} ${JSON.stringify(p)}`).toBe(true);
        const r = bounds(s);
        expect(inside(r.min, b, s.width / 2) && inside(r.max, b, s.width / 2), `${id} strip ${s.mat} bounds`).toBe(true);
      } else if (isLongPrism(s)) {
        const r = bounds(s);
        expect(inside(r.min, b) && inside(r.max, b), `${id} long prism ${s.mat} ${JSON.stringify(r)}`).toBe(true);
      }
    }
    if (id !== "silos") expect(strips, id).toBeGreaterThan(0);
  });

  it.each(SPEC_REGIONS)("%s: every terrain triangle of the crop, static and animated water, has its vertices inside the box", (id) => {
    const b = boxOf(id), { terrain } = cropOf(id);
    const meshes = [...terrain.ground, ...terrain.bleed, ...terrain.water, terrain.foam,
      ...animsOf(id).flatMap((a) => a.ids.flatMap((i) => { const l = a.layer(i); return l.kind === "water" ? l.water : []; }))];
    let n = 0;
    for (const m of meshes) if (m.kind === "ground") for (const t of m.tris) for (const p of t.pts) { n++; expect(inside(p, b), `${id} ${m.mat} ${JSON.stringify(p)}`).toBe(true); }
    expect(n, id).toBeGreaterThan(0);
  });
});
