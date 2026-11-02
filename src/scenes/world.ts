import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { WorldZone } from "../map/geo";
import { createRng, type Rng } from "../map/seed";
import { city, type CityScene } from "./city";
import { factory, type FactoryScene } from "./factory";
import { fair, type FairScene } from "./fair";
import { hinterland, type HinterlandScene } from "./hinterland";
import { sea, type SeaScene } from "./sea";
import { shipyard, type Scene } from "./shipyard";
import { tech, type TechScene } from "./tech";
import { buildTerrain, type TerrainMesh } from "./terrain";

/**
 * El mundo entero: terreno compartido más una escena por zona. Cada escena
 * recibe su propio Rng derivado del seed, así retocar una no reordena las otras.
 */
export interface WorldScene {
  terrain: TerrainMesh;
  ground: Solid[];
  solids: Solid[];
  accents: Accent[];
  landmarks: Record<WorldZone, Vec3>;
  shipyard: Scene | null;
  city: CityScene | null;
  factory: FactoryScene | null;
  sea: SeaScene | null;
  /** Los márgenes construidos viven sobre el sangrado: solo existen con el mundo entero (sin filtro de zonas). */
  hinterland: HinterlandScene | null;
  tech: TechScene | null;
  fair: FairScene | null;
}

const ALL_ZONES: readonly WorldZone[] = ["portfolio", "cv", "blog"];
const ZONE_INDEX: Record<WorldZone, number> = { portfolio: 1, cv: 2, blog: 3 };

/** Grúa pórtico, torre de oficinas, faro. Coordenadas de mundo; la reintegración proyecta con project(). */
export const LANDMARKS: Record<WorldZone, Vec3> = {
  portfolio: v3(150, 50, 0),
  cv: v3(129, 227, 0),
  blog: v3(470, 160, 0),
};

/** Rng por zona y parte (0 = escena principal, 1 = escena secundaria: fábrica, distrito; 2 = margen: hinterland, distrito tecnológico; 3 = luces de la ciudad). Retocar una no reordena las otras. */
export function zoneRng(seed: number, zone: WorldZone, part = 0): Rng {
  return createRng(seed * 31 + ZONE_INDEX[zone] + 16 * part);
}

export function world(seed: number, opts: { zones?: readonly WorldZone[] } = {}): WorldScene {
  const zones = opts.zones ?? ALL_ZONES;
  // sin filtro explícito de zonas, buildTerrain recibe `undefined`: solo entonces construye el sangrado.
  const terrain = buildTerrain(createRng(seed), opts.zones);
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [];
  let sy: Scene | null = null, ct: CityScene | null = null, fa: FactoryScene | null = null;
  if (zones.includes("portfolio")) {
    sy = shipyard(zoneRng(seed, "portfolio"));
    fa = factory(zoneRng(seed, "portfolio", 1));
    for (const sc of [sy, fa]) { ground.push(...sc.ground); solids.push(...sc.solids); accents.push(...sc.accents); }
  }
  if (zones.includes("cv")) {
    ct = city(zoneRng(seed, "cv"), zoneRng(seed, "cv", 1), zoneRng(seed, "cv", 3));
    ground.push(...ct.ground); solids.push(...ct.solids); accents.push(...ct.accents);
  }
  let se: SeaScene | null = null;
  if (zones.includes("blog")) {
    se = sea(zoneRng(seed, "blog"));
    ground.push(...se.ground); solids.push(...se.solids); accents.push(...se.accents);
  }
  let hi: HinterlandScene | null = null, su: TechScene | null = null, fa2: FairScene | null = null;
  if (!opts.zones) {
    hi = hinterland(zoneRng(seed, "portfolio", 2));
    su = tech(zoneRng(seed, "cv", 2));
    fa2 = fair(zoneRng(seed, "portfolio", 3));
    for (const sc of [hi, su, fa2]) { ground.push(...sc.ground); solids.push(...sc.solids); accents.push(...sc.accents); }
  }
  return { terrain, ground, solids, accents, landmarks: LANDMARKS, shipyard: sy, city: ct, factory: fa, sea: se, hinterland: hi, tech: su, fair: fa2 };
}
