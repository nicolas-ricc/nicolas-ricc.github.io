import type { Accent } from "../iso/accent";
import { centroid, polyline, v3, type Vec3 } from "../iso/geometry";
import type { RampDir, Solid } from "../iso/solids";
import type { AccentColor, Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { prism } from "../scenes/city-pieces";

/**
 * Kit props: one function per prop and a single measure per role (spec §5).
 * `at` is the northwest corner of the base except in those that say "Center".
 * The ones that carry light return `{ solids, accents }`.
 */
export type Lit = { solids: Solid[]; accents: Accent[] };

/** Pours a lit prop into the destination lists of solids and accents. */
export function place(solids: Solid[], accents: Accent[], lit: Lit): void { solids.push(...lit.solids); accents.push(...lit.accents); }

/** Street lamp: post plus amber bulb; `bulb` is where the bulb ended up. */
export function lamp(at: Vec3): Lit & { bulb: Vec3 } {
  const bulb = v3(at.x + 0.3, at.y + 0.3, at.z + 5);
  return { solids: [prism(at.x, at.y, at.z, 0.6, 0.6, 5, "steel")], accents: [{ kind: "dot", at: bulb, r: 0.6, color: "amber" }], bulb };
}

/** Traffic light, off: post and dark box. */
export const trafficLight = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 0.3, 0.3, 4, "steel"), prism(at.x - 0.1, at.y - 0.1, at.z + 4, 0.5, 0.5, 1.2, "officeDark")];

/** The car's size: used by `car()` and by whoever reserves room for one. */
export const CAR = { w: 3, d: 1.5 } as const;
export const car = (at: Vec3, mat: "steel" | "rust"): Solid[] => [prism(at.x, at.y, at.z, CAR.w, CAR.d, 1.2, mat)];
export const bench = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 2, 0.6, 0.5, "paving")];
export const table = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 1, 1, 0.7, "paving")];
export const chair = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 0.5, 0.5, 0.5, "paving")];
/** Center. */
export const bollard = (at: Vec3): Solid[] => [{ kind: "cylinder", at, r: 0.4, h: 0.8, mat: "rust", sides: 6 }];
/** Center. */
export const streetTree = (at: Vec3): Solid[] => [{ kind: "cone", at, r: 1.5, h: 4, mat: "leaf" }];
/** Center. */
export const patioTree = (at: Vec3): Solid[] => [{ kind: "cone", at, r: 1, h: 2.5, mat: "leaf" }];
/** Center. The jungle that grows on a terrace of the old city. */
export const roofShrub = (at: Vec3): Solid[] => [{ kind: "cone", at, r: 1.2, h: 2.5, mat: "leaf" }];

/** Awning of `len` along the facade, with 0.8 overhang, sloping down toward the street (`dir`). */
export function awning(at: Vec3, len: number, dir: RampDir): Solid[] {
  const alongX = dir === "n" || dir === "s";
  return [{ kind: "ramp", at, w: alongX ? len : 0.8, d: alongX ? 0.8 : len, h: 0.4, mat: "awning", dir }];
}

export const kiosk = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 2, 2, 2.4, "officeDark"), prism(at.x, at.y, at.z + 2.4, 2, 2, 0.8, "terracotta", { roof: "hip" })];

/** Sign: dark box 0.4 deep and the amber panel 0.02 in front of its south face (or east, with `face: "e"`, and `w` along y). */
export function sign(at: Vec3, w: number, h: number, face: "s" | "e" = "s"): Lit {
  const z0 = at.z + 0.2, z1 = at.z + h - 0.2;
  if (face === "e") {
    const x = at.x + 0.42;
    return {
      solids: [prism(at.x, at.y, at.z, 0.4, w, h, "officeDark")],
      accents: [{ kind: "poly", pts: [v3(x, at.y + 0.3, z0), v3(x, at.y + w - 0.3, z0), v3(x, at.y + w - 0.3, z1), v3(x, at.y + 0.3, z1)], color: "amber", alpha: 1 }],
    };
  }
  const y = at.y + 0.42;
  return {
    solids: [prism(at.x, at.y, at.z, w, 0.4, h, "officeDark")],
    accents: [{ kind: "poly", pts: [v3(at.x + 0.3, y, z0), v3(at.x + w - 0.3, y, z0), v3(at.x + w - 0.3, y, z1), v3(at.x + 0.3, y, z1)], color: "amber", alpha: 1 }],
  };
}

/** Clock: `amberBleed` octagon of radius 1.2 centered at (cx, cz), 0.02 in front of a south face at `southY`. */
export function clock(cx: number, southY: number, cz: number): Accent {
  return { kind: "poly", pts: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return v3(cx + 1.2 * Math.cos(a), southY + 0.02, cz + 1.2 * Math.sin(a)); }), color: "amberBleed", alpha: 0.9 };
}

const NEON_HALO = 1.3, NEON_BACK = 0.05;

/** Neon tube: the `Bleed` halo (1.3× around the center, just behind) and the tube on top. city-anim flickers these two by position: do not reorder. */
export function neon(pts: Vec3[], color: "amber" | "cyan" | "magenta"): Accent[] {
  const c = centroid(pts);
  const halo = pts.map((p) => v3(c.x + (p.x - c.x) * NEON_HALO - NEON_BACK, c.y + (p.y - c.y) * NEON_HALO - NEON_BACK, c.z + (p.z - c.z) * NEON_HALO));
  return [{ kind: "poly", pts: halo, color: `${color}Bleed`, alpha: 0.6 }, { kind: "poly", pts, color, alpha: 1 }];
}

const PUDDLE_ALPHA = 0.25, FOUNTAIN_ALPHA = 0.35; // the fountain is not confused with the tower's two puddles
const PUDDLE_RADII = [2.5, 1.8, 1.2] as const;

/**
 * Puddle of light: three flat concentric octagons of decreasing radius. Projected
 * they look like flattened ellipses and, with low alpha and overlapped, the edge dissolves.
 */
export function puddle(x: number, y: number, bleed: AccentColor, z = 0.12, alpha = PUDDLE_ALPHA): Accent[] {
  return PUDDLE_RADII.map((r) => ({
    kind: "poly",
    pts: Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return v3(x + r * Math.cos(a), y + r * Math.sin(a), z); }),
    color: bleed,
    alpha,
  }));
}

/** Center. Basin, spout and the amber reflection on the water. */
export function fountain(at: Vec3): Lit {
  const water = at.z + 0.6;
  return {
    solids: [{ kind: "cylinder", at, r: 3, h: 0.6, mat: "marble", sides: 12 }, { kind: "cylinder", at: v3(at.x, at.y, water), r: 0.6, h: 1.5, mat: "marble", sides: 8 }],
    accents: puddle(at.x, at.y, "amberBleed", water, FOUNTAIN_ALPHA),
  };
}

/** Total height above `at.z` of the roof toppers: recipes subtract it from their cap (the tank is 1.1 legs and a 2 tank). */
export const WATER_TANK_H = 3.1, MACHINE_ROOM_H = 2, ANTENNA_H = 4, HELIPAD_H = 0.3;

/** Center. Water tank on four posts (1.1, not 1.2: tells the post apart from the car in the test filter). */
export function waterTank(at: Vec3): Solid[] {
  const legs = ([[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]] as const).map(([dx, dy]) => prism(at.x + dx - 0.15, at.y + dy - 0.15, at.z, 0.3, 0.3, 1.1, "steel"));
  return [...legs, { kind: "cylinder", at: v3(at.x, at.y, at.z + 1.1), r: 1.2, h: WATER_TANK_H - 1.1, mat: "rust", sides: 6 }];
}

export const machineRoom = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 4, 3, MACHINE_ROOM_H, "officeDark")];
/** Base of the antenna. */
export const antenna = (at: Vec3): Solid[] => [{ kind: "cylinder", at, r: 0.2, h: ANTENNA_H, mat: "steel", sides: 4 }];

/** Center. */
export const helipad = (at: Vec3): Lit => ({
  solids: [{ kind: "cylinder", at, r: 3, h: HELIPAD_H, mat: "paving", sides: 8 }],
  accents: [{ kind: "dot", at: v3(at.x, at.y, at.z + HELIPAD_H), r: 0.6, color: "amberMid" }],
});

export const beacon = (at: Vec3): Lit => ({ solids: [], accents: [{ kind: "dot", at, r: 0.5, color: "amberMid" }] });

/** Green terrace: thin jungle slab (a `ground` cannot sit on a roof) and 3..5 cones on it, 1 from the edge. */
export function rooftopGarden(at: Vec3, w: number, d: number, rng: Rng): Solid[] {
  const out: Solid[] = [prism(at.x, at.y, at.z, w, d, 0.3, "leafDark")];
  for (let k = 0, n = rng.int(3, 5); k < n; k++) out.push({ kind: "cone", at: v3(at.x + 1 + rng.next() * (w - 2), at.y + 1 + rng.next() * (d - 2), at.z + 0.3), r: 1, h: 2, mat: "leaf" });
  return out;
}

export const solarPanel = (at: Vec3): Solid[] => [{ kind: "ramp", at, w: 3, d: 1.6, h: 0.5, mat: "glass", dir: "s" }];

/** Construction fence 0.3 thick, inside the rectangle. */
export function fence(at: Vec3, w: number, d: number): Solid[] {
  return ([[0, 0, w, 0.3], [0, d - 0.3, w, 0.3], [0, 0, 0.3, d], [w - 0.3, 0, 0.3, d]] as const).map(([dx, dy, fw, fd]) => prism(at.x + dx, at.y + dy, at.z, fw, fd, 1.2, "officeDark"));
}

export const container = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 6, 2.4, 2.4, "rust")];

/** Amber bulbs every `step` along the polyline, at the height of its points (z 3 on the street). */
export function garland(path: Vec3[], step = 1.5): Accent[] {
  const line = polyline(path), out: Accent[] = [];
  for (let s = 0; s <= line.length + 1e-9; s += step) { const p = line.at(s); out.push({ kind: "dot", at: v3(p.x, p.y, p.z), r: 0.25, color: "amber" }); }
  return out;
}

/** Slabs of a stepped stone arch. */
export const ARCH_SLABS = 6;

/**
 * Stepped stone arch along x: `ARCH_SLABS` vertical `stone` slabs of
 * equal width and `d − 0.4` deep centered on `y..y+d`, from the lower edge `bottom(s)`
 * up to `zTop`; `s = Math.sin(π·(k + 0.5)/ARCH_SLABS)` is small at the ends and nearly 1 at the center.
 */
export function stoneArch(x: number, y: number, w: number, d: number, zTop: number, bottom: (s: number) => number): Solid[] {
  return Array.from({ length: ARCH_SLABS }, (_, k) => {
    const z = bottom(Math.sin((Math.PI * (k + 0.5)) / ARCH_SLABS));
    return prism(x + (k * w) / ARCH_SLABS, y + 0.2, z, w / ARCH_SLABS, d - 0.4, zTop - z, "stone");
  });
}

/** Small dock crane: mast and jib toward the water (`dir`). */
export function dockCrane(at: Vec3, dir: "e" | "w"): Solid[] {
  const jibX = dir === "e" ? at.x : at.x + 1 - 6;
  return [prism(at.x, at.y, at.z, 1, 1, 6, "steel"), prism(jibX, at.y + 0.2, at.z + 5.5, 6, 0.6, 0.5, "steel")];
}

/** Food truck, 5×2.2: `mat` cargo box of 3.8, steel cab of 1.2 at the east (`dir` "s") or south ("e") end, awning and amber hatch on the `dir` face. */
export function foodTruck(at: Vec3, mat: Material, dir: "s" | "e"): Lit {
  const s = dir === "s";
  const box = s ? prism(at.x, at.y, at.z, 3.8, 2.2, 2.6, mat) : prism(at.x, at.y, at.z, 2.2, 3.8, 2.6, mat);
  const cab = s ? prism(at.x + 3.8, at.y, at.z, 1.2, 2.2, 2, "steel") : prism(at.x, at.y + 3.8, at.z, 2.2, 1.2, 2, "steel");
  const roof = awning(s ? v3(at.x, at.y + 2.2, at.z + 2.2) : v3(at.x + 2.2, at.y, at.z + 2.2), 3.8, dir);
  const z0 = at.z + 1.2, z1 = at.z + 2;
  const pts = s
    ? [1.1, 2.7].flatMap((u) => [v3(at.x + u, at.y + 2.22, z0), v3(at.x + u, at.y + 2.22, z1)])
    : [1.1, 2.7].flatMap((u) => [v3(at.x + 2.22, at.y + u, z0), v3(at.x + 2.22, at.y + u, z1)]);
  // [lo-bottom, lo-top, hi-bottom, hi-top] -> perimeter order
  return { solids: [box, cab, ...roof], accents: [{ kind: "poly", pts: [pts[0]!, pts[2]!, pts[3]!, pts[1]!], color: "amber", alpha: 0.9 }] };
}
