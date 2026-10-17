import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { ZONE_SPLIT_X, inHeadland, worldZoneAt } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { BUOYS, COAST, COAST_Z, GALLERY_R, KEEPER, LIGHTHOUSE, WRECK, WRECK_BUOY, sea, type SeaScene } from "./sea";
import { headlandZ, terrainAt } from "./terrain";

const scene = (): SeaScene => sea(createRng(7));
const SEA_MATS: readonly Material[] = ["rock", "whitewash", "rust", "steel", "glass", "hull", "deck", "foam", "leaf", "leafDark"];
const water = new Set(["water", "sea", "shore", "abyss", "reef"]);

describe("sea", () => {
  it("es determinística, trae ≥ 80 sólidos elevados y usa solo materiales del Blog o compartidos", () => {
    expect(JSON.stringify(sea(createRng(7)))).toBe(JSON.stringify(sea(createRng(7))));
    const s = scene();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeGreaterThanOrEqual(80);
    for (const x of [...s.ground, ...s.solids]) { expect(SEA_MATS).toContain(x.mat); expect(bounds(x).min.x).toBeGreaterThanOrEqual(330); }
  });

  it("faro: seis tambores alternados, galería con ocho postes, linterna de vidrio y cono; ≈ 29.6 sobre la roca", () => {
    const s = scene();
    const drums = s.solids.filter((x) => x.kind === "cylinder" && x.h === 4 && Math.abs(x.at.x - LIGHTHOUSE.x) < 0.01);
    expect(drums).toHaveLength(6);
    expect(drums.map((d) => d.mat)).toEqual(["whitewash", "rust", "whitewash", "rust", "whitewash", "rust"]);
    expect(s.solids.filter((x) => x.kind === "prism" && x.h === 1.2 && x.w === 0.3)).toHaveLength(8);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "glass" && x.h === 3)).toBe(true);
    const top = Math.max(...s.solids.filter((x) => Math.abs(bounds(x).min.x - (LIGHTHOUSE.x - 3.2)) < 4 && Math.abs(bounds(x).min.y - (LIGHTHOUSE.y - 3.2)) < 4).map((x) => bounds(x).max.z));
    expect(top - LIGHTHOUSE.z).toBeCloseTo(29.6, 1);
    expect(s.lantern.z).toBeCloseTo(LIGHTHOUSE.z + 24 + 0.6 + 1.5, 6);
    expect(worldZoneAt(LIGHTHOUSE.x, LIGHTHOUSE.y)).toBe("portfolio"); // el faro clickea Portfolio
  });

  it("casa del farero, sendero de roca escalonado sobre la punta, afloramientos, pedruscos y arrecife", () => {
    const s = scene();
    const house = s.solids.find((x) => x.kind === "prism" && x.mat === "whitewash" && x.roof === "gable") as Extract<Solid, { kind: "prism" }>;
    expect(house.at).toMatchObject({ x: KEEPER.x, y: KEEPER.y });
    expect(house.at.z).toBeCloseTo(headlandZ(KEEPER.x + 4), 6);
    const path = s.ground.filter((x) => x.kind === "strip" && x.mat === "rock");
    expect(path).toHaveLength(10);
    for (const p of path) if (p.kind === "strip") for (const q of p.path) expect(inHeadland(q.x, q.y)).toBe(true);
    expect(path.map((p) => p.kind === "strip" && p.z)).toEqual([...path].map((p) => p.kind === "strip" && p.z).sort((a, b) => Number(a) - Number(b))); // sube hacia el faro
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "rock")).toHaveLength(6);
    const reef = s.solids.filter((x) => x.kind === "cone" && x.mat === "rock" && x.h === 1) as Extract<Solid, { kind: "cone" }>[];
    expect(reef.length).toBeGreaterThanOrEqual(30); expect(reef.length).toBeLessThanOrEqual(40);
    for (const c of reef) expect(terrainAt(c.at.x, c.at.y)).toBe("reef");
    expect(s.solids.filter((x) => x.kind === "cone" && x.mat === "rock" && x.h === 1.5)).toHaveLength(20); // pedruscos sobre la punta
  });

  it("boyas y pecio sobre el agua; la boya del pecio tiene luz fija y anillo de espuma", () => {
    const s = scene();
    for (const b of BUOYS) expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "rust" && x.at.x === b.x && x.at.y === b.y && x.at.z === -1)).toBe(true);
    expect(s.buoys).toHaveLength(2);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "steel" && x.at.x === WRECK_BUOY.x)).toBe(true);
    expect(s.accents).toEqual([{ kind: "poly", pts: expect.any(Array), color: "magentaBleed", alpha: expect.any(Number) }, { kind: "dot", at: { x: WRECK_BUOY.x, y: WRECK_BUOY.y, z: 1 }, r: 1, color: "magentaMid" }]);
    expect(s.ground.some((g) => g.kind === "ground" && g.mat === "foam" && g.tris.length === 8)).toBe(true);
    // pecio (#83): sin casco entero a flote; asoman la proa (cuña de óxido con cubierta) y la casa de popa (caseta con ventanas, chimenea, mástil), todo sobre el agua
    expect(s.solids.some((x) => x.kind === "hull")).toBe(false);
    const near = (x: Solid) => { const b = bounds(x); return Math.hypot((b.min.x + b.max.x) / 2 - WRECK.x, (b.min.y + b.max.y) / 2 - WRECK.y) < 45; };
    const parts = s.solids.filter(near);
    expect(parts.filter((x) => x.kind === "poly" && x.mat === "hull" && x.footprint.length === 5)).toHaveLength(1); // cuña de proa, obra viva
    expect(parts.filter((x) => x.kind === "poly" && x.mat === "rust" && x.footprint.length === 5)).toHaveLength(1); // y su franja oxidada de obra muerta
    expect(s.ground.filter((g) => g.kind === "ground" && g.mat === "foam" && g.tris.length === 8).length).toBeGreaterThanOrEqual(3); // espuma: boya, proa y popa del pecio
    expect(parts.filter((x) => x.kind === "poly" && x.mat === "whitewash" && x.facade)).toHaveLength(2); // caseta de popa
    expect(parts.some((x) => x.kind === "cylinder" && x.mat === "rust" && x.h > 2)).toBe(true); // chimenea
    expect(parts.some((x) => x.kind === "poly" && x.mat === "steel" && x.h >= 4)).toBe(true); // mástil
    for (const x of parts) expect(bounds(x).min.z).toBeGreaterThanOrEqual(-1); // nada bajo el agua
    const bow = parts.find((x) => x.kind === "poly" && x.mat === "hull" && x.footprint.length === 5)!, house = parts.find((x) => x.kind === "poly" && x.mat === "whitewash" && x.facade)!;
    const bb = bounds(bow), hb = bounds(house);
    expect(Math.hypot((bb.min.x + bb.max.x) / 2 - (hb.min.x + hb.max.x) / 2, (bb.min.y + bb.max.y) / 2 - (hb.min.y + hb.max.y) / 2)).toBeGreaterThan(20); // partido en dos: el centro está hundido
    for (const x of s.solids) if (x.kind === "cylinder" || x.kind === "hull") if (bounds(x).min.x > ZONE_SPLIT_X + 60) expect(water.has(terrainAt(x.at.x, x.at.y))).toBe(true);
  });

  it("neones: galería de ocho luces alrededor del fuste, balizas de costa en Blog y cartel cian del farero", () => {
    const s = scene();
    const { gallery, coast, keeperSign } = s.neon;
    expect(gallery).toHaveLength(8);
    for (const p of gallery) {
      expect(p.z).toBeCloseTo(s.lantern.z - 2, 6);
      expect(Math.abs(Math.hypot(p.x - LIGHTHOUSE.x, p.y - LIGHTHOUSE.y) - GALLERY_R)).toBeLessThan(1e-6);
    }
    expect(GALLERY_R).toBeCloseTo(2.2 + 0.5, 6); // último tambor + 0.5
    expect(coast.length).toBeGreaterThanOrEqual(6); expect(coast.length).toBeLessThanOrEqual(10);
    expect(coast).toEqual(COAST.map((p) => ({ x: p.x, y: p.y, z: COAST_Z })));
    expect(COAST_Z).toBe(1.2);
    coast.forEach((p, k) => {
      expect(worldZoneAt(p.x, p.y)).toBe("blog");
      expect(p.x).toBeGreaterThan(LIGHTHOUSE.x);
      if (k > 0) { const d = Math.hypot(p.x - coast[k - 1]!.x, p.y - coast[k - 1]!.y); expect(d).toBeGreaterThan(5); expect(d).toBeLessThan(7); }
    });
    const z = headlandZ(KEEPER.x + 4);
    expect(keeperSign.kind).toBe("poly");
    if (keeperSign.kind !== "poly") return;
    expect(keeperSign.color).toBe("cyan");
    const xs = keeperSign.pts.map((p) => p.x), ys = keeperSign.pts.map((p) => p.y), zs = keeperSign.pts.map((p) => p.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2, 6);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1, 6);
    expect(Math.min(...zs)).toBeCloseTo(z + 4, 6); // apoyado en el alero
    for (const y of ys) expect(y).toBeCloseTo(KEEPER.y + 6.42, 6); // frente de la caja, en la cara sur
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "steel" && x.at.y === KEEPER.y + 6 && x.at.z <= z + 4 && x.at.z + x.h >= z + 5 && x.at.x <= Math.min(...xs) && x.at.x + x.w >= Math.max(...xs))).toBe(true); // caja oscura detrás
    expect(s.accents).toHaveLength(2); // los acentos estáticos no cambian
  });

  it("todo el render usa colores del atlas", () => {
    const s = scene();
    const colors = allIsoColors();
    for (const i of buildRenderList([...s.ground, ...s.solids])) expect(colors.has(i.color)).toBe(true);
  });
});
