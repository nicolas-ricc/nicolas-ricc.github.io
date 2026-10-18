import type { Accent } from "../iso/accent";
import { centroid, polyline, v3, type Vec3 } from "../iso/geometry";
import type { RampDir, Solid } from "../iso/solids";
import type { AccentColor } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { prism } from "../scenes/city-pieces";

/**
 * Props del kit: una función por prop y una sola medida por rol (spec §5).
 * `at` es la esquina noroeste de la base salvo en las que dicen "centro".
 * Las que llevan luz devuelven `{ solids, accents }`.
 */
export type Lit = { solids: Solid[]; accents: Accent[] };

/** Vuelca un prop con luz en las listas de sólidos y acentos de destino. */
export function place(solids: Solid[], accents: Accent[], lit: Lit): void { solids.push(...lit.solids); accents.push(...lit.accents); }

/** Farol: poste más bombillo ámbar; `bulb` es dónde quedó el bombillo. */
export function lamp(at: Vec3): Lit & { bulb: Vec3 } {
  const bulb = v3(at.x + 0.3, at.y + 0.3, at.z + 5);
  return { solids: [prism(at.x, at.y, at.z, 0.6, 0.6, 5, "steel")], accents: [{ kind: "dot", at: bulb, r: 0.6, color: "amber" }], bulb };
}

/** Semáforo apagado: poste y caja oscura. */
export const trafficLight = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 0.3, 0.3, 4, "steel"), prism(at.x - 0.1, at.y - 0.1, at.z + 4, 0.5, 0.5, 1.2, "officeDark")];

/** La medida del auto: la usan `car()` y quien reserva lugar para uno. */
export const CAR = { w: 3, d: 1.5 } as const;
export const car = (at: Vec3, mat: "steel" | "rust"): Solid[] => [prism(at.x, at.y, at.z, CAR.w, CAR.d, 1.2, mat)];
export const bench = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 2, 0.6, 0.5, "paving")];
export const table = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 1, 1, 0.7, "paving")];
export const chair = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 0.5, 0.5, 0.5, "paving")];
/** Centro. */
export const bollard = (at: Vec3): Solid[] => [{ kind: "cylinder", at, r: 0.4, h: 0.8, mat: "rust", sides: 6 }];
/** Centro. */
export const streetTree = (at: Vec3): Solid[] => [{ kind: "cone", at, r: 1.5, h: 4, mat: "leaf" }];
/** Centro. */
export const patioTree = (at: Vec3): Solid[] => [{ kind: "cone", at, r: 1, h: 2.5, mat: "leaf" }];
/** Centro. La selva que crece en una terraza de la ciudad vieja. */
export const roofShrub = (at: Vec3): Solid[] => [{ kind: "cone", at, r: 1.2, h: 2.5, mat: "leaf" }];

/** Toldo de `len` a lo largo de la fachada, con 0.8 de vuelo, que baja hacia la calle (`dir`). */
export function awning(at: Vec3, len: number, dir: RampDir): Solid[] {
  const alongX = dir === "n" || dir === "s";
  return [{ kind: "ramp", at, w: alongX ? len : 0.8, d: alongX ? 0.8 : len, h: 0.4, mat: "awning", dir }];
}

export const kiosk = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 2, 2, 2.4, "officeDark"), prism(at.x, at.y, at.z + 2.4, 2, 2, 0.8, "terracotta", { roof: "hip" })];

/** Cartel: caja oscura de 0.4 de fondo y el panel ámbar 0.02 delante de su cara sur (o este, con `face: "e"`, y `w` a lo largo de y). */
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

/** Reloj: octógono `amberBleed` de radio 1.2 centrado en (cx, cz), 0.02 delante de una cara sur en `southY`. */
export function clock(cx: number, southY: number, cz: number): Accent {
  return { kind: "poly", pts: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return v3(cx + 1.2 * Math.cos(a), southY + 0.02, cz + 1.2 * Math.sin(a)); }), color: "amberBleed", alpha: 0.9 };
}

const NEON_HALO = 1.3, NEON_BACK = 0.05;

/** Tubo de neón: el halo `Bleed` (1.3× alrededor del centro, apenas detrás) y el tubo encima. */
export function neon(pts: Vec3[], color: "amber" | "cyan" | "magenta"): Accent[] {
  const c = centroid(pts);
  const halo = pts.map((p) => v3(c.x + (p.x - c.x) * NEON_HALO - NEON_BACK, c.y + (p.y - c.y) * NEON_HALO - NEON_BACK, c.z + (p.z - c.z) * NEON_HALO));
  return [{ kind: "poly", pts: halo, color: `${color}Bleed`, alpha: 0.6 }, { kind: "poly", pts, color, alpha: 1 }];
}

const PUDDLE_ALPHA = 0.25;
const PUDDLE_RADII = [2.5, 1.8, 1.2] as const;

/**
 * Charco de luz: tres octógonos planos concéntricos de radio decreciente. Proyectados
 * se ven como elipses achatadas y, con poco alfa y superpuestos, el borde se deshace.
 */
export function puddle(x: number, y: number, bleed: AccentColor, z = 0.12): Accent[] {
  return PUDDLE_RADII.map((r) => ({
    kind: "poly",
    pts: Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return v3(x + r * Math.cos(a), y + r * Math.sin(a), z); }),
    color: bleed,
    alpha: PUDDLE_ALPHA,
  }));
}

/** Centro. Pileta, surtidor y el reflejo ámbar sobre el agua. */
export function fountain(at: Vec3): Lit {
  const water = at.z + 0.6;
  return {
    solids: [{ kind: "cylinder", at, r: 3, h: 0.6, mat: "marble", sides: 12 }, { kind: "cylinder", at: v3(at.x, at.y, water), r: 0.6, h: 1.5, mat: "marble", sides: 8 }],
    accents: puddle(at.x, at.y, "amberBleed", water),
  };
}

/** Alto total sobre `at.z` de los remates de techo: las recetas lo descuentan de su tope (el tanque son patas de 1.1 y tanque de 2). */
export const WATER_TANK_H = 3.1, MACHINE_ROOM_H = 2, ANTENNA_H = 4, HELIPAD_H = 0.3;

/** Centro. Tanque de agua sobre cuatro postes (1.1, no 1.2: distingue el poste del auto en el filtro de tests). */
export function waterTank(at: Vec3): Solid[] {
  const legs = ([[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]] as const).map(([dx, dy]) => prism(at.x + dx - 0.15, at.y + dy - 0.15, at.z, 0.3, 0.3, 1.1, "steel"));
  return [...legs, { kind: "cylinder", at: v3(at.x, at.y, at.z + 1.1), r: 1.2, h: WATER_TANK_H - 1.1, mat: "rust", sides: 6 }];
}

export const machineRoom = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 4, 3, MACHINE_ROOM_H, "officeDark")];
/** Base de la antena. */
export const antenna = (at: Vec3): Solid[] => [{ kind: "cylinder", at, r: 0.2, h: ANTENNA_H, mat: "steel", sides: 4 }];

/** Centro. */
export const helipad = (at: Vec3): Lit => ({
  solids: [{ kind: "cylinder", at, r: 3, h: HELIPAD_H, mat: "paving", sides: 8 }],
  accents: [{ kind: "dot", at: v3(at.x, at.y, at.z + HELIPAD_H), r: 0.6, color: "amberMid" }],
});

export const beacon = (at: Vec3): Lit => ({ solids: [], accents: [{ kind: "dot", at, r: 0.5, color: "amberMid" }] });

/** Terraza verde: losa fina de selva (un `ground` no puede ir sobre un techo) y 3..5 conos sobre ella, a 1 del borde. */
export function rooftopGarden(at: Vec3, w: number, d: number, rng: Rng): Solid[] {
  const out: Solid[] = [prism(at.x, at.y, at.z, w, d, 0.3, "leafDark")];
  for (let k = 0, n = rng.int(3, 5); k < n; k++) out.push({ kind: "cone", at: v3(at.x + 1 + rng.next() * (w - 2), at.y + 1 + rng.next() * (d - 2), at.z + 0.3), r: 1, h: 2, mat: "leaf" });
  return out;
}

export const solarPanel = (at: Vec3): Solid[] => [{ kind: "ramp", at, w: 3, d: 1.6, h: 0.5, mat: "glass", dir: "s" }];

/** Cerco de obra de 0.3 de espesor por dentro del rectángulo. */
export function fence(at: Vec3, w: number, d: number): Solid[] {
  return ([[0, 0, w, 0.3], [0, d - 0.3, w, 0.3], [0, 0, 0.3, d], [w - 0.3, 0, 0.3, d]] as const).map(([dx, dy, fw, fd]) => prism(at.x + dx, at.y + dy, at.z, fw, fd, 1.2, "officeDark"));
}

export const container = (at: Vec3): Solid[] => [prism(at.x, at.y, at.z, 6, 2.4, 2.4, "rust")];

/** Lamparitas ámbar cada `step` a lo largo de la polilínea, a la altura de sus puntos (z 3 en la calle). */
export function garland(path: Vec3[], step = 1.5): Accent[] {
  const line = polyline(path), out: Accent[] = [];
  for (let s = 0; s <= line.length + 1e-9; s += step) { const p = line.at(s); out.push({ kind: "dot", at: v3(p.x, p.y, p.z), r: 0.25, color: "amber" }); }
  return out;
}

/** Losas de un arco escalonado de piedra. */
export const ARCH_SLABS = 6;

/**
 * Arco escalonado de piedra a lo largo de x: seis losas verticales `stone` de `w/6`
 * de ancho y `d − 0.4` de fondo centradas en `y..y+d`, del borde inferior `bottom(s)`
 * hasta `zTop`; `s = sin(π·(k + 0.5)/6)` vale ≈ 0.26 en los extremos y ≈ 0.97 en el centro.
 */
export function stoneArch(x: number, y: number, w: number, d: number, zTop: number, bottom: (s: number) => number): Solid[] {
  return Array.from({ length: ARCH_SLABS }, (_, k) => {
    const z = bottom(Math.sin((Math.PI * (k + 0.5)) / ARCH_SLABS));
    return prism(x + (k * w) / ARCH_SLABS, y + 0.2, z, w / ARCH_SLABS, d - 0.4, zTop - z, "stone");
  });
}

/** Grúa chica de muelle: mástil y pluma hacia el agua (`dir`). */
export function dockCrane(at: Vec3, dir: "e" | "w"): Solid[] {
  const jibX = dir === "e" ? at.x : at.x + 1 - 6;
  return [prism(at.x, at.y, at.z, 1, 1, 6, "steel"), prism(jibX, at.y + 0.2, at.z + 5.5, 6, 0.6, 0.5, "steel")];
}
