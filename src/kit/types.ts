import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import type { Rect } from "../scenes/city-grid";

/**
 * Kit contract (spec §5). A recipe draws inside its lot, relative to
 * `lot.z` (the surface it rests on), and besides its solids it publishes the
 * walls and windows that face the camera and the slots for signs/neons.
 */
export type Side = "n" | "s" | "e" | "w";
export type StyleId = "downtown" | "bars" | "residential" | "civic" | "riverside" | "district";
/** `open`: sides with an open frontage (avenue, water, plaza). `maxH`: height cap above `lot.z`. */
export interface Lot { x: number; y: number; w: number; d: number; z: number; open: Side[]; maxH: number }
export interface Style { id: StyleId; mat: Material; trim: Material; roof: Material; tone: number; floorH: number; window: "windowWarm" | "windowCool" }
/** `wall`: wall normal. `building`: index of the solid in `Piece.solids`. */
export interface Window { pts: Vec3[]; floor: number; wall: Vec3; building: number }
/** `local`: index of the shop (ground-floor frontage) within the piece. */
export interface Slot { pts: Vec3[]; wall: Vec3; side: Side; kind: "neon" | "sign"; local: number }
/** Wall with a facade that faces the camera. */
export interface Wall { pts: Vec3[]; normal: Vec3; floorH: number; building: number }
export interface Piece { solids: Solid[]; ground: Solid[]; accents: Accent[]; windows: Window[]; slots: Slot[]; walls: Wall[]; courtyard?: Rect; landmarkTop?: Vec3 }
export type Recipe = (lot: Lot, rng: Rng, style: Style) => Piece;
export interface RecipeDef { name: string; recipe: Recipe; family: "modern" | "courtyard" | "composite" | "curved" | "lowrise" | "landmarks"; landmark?: boolean }
