import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import type { Rect } from "../scenes/city-grid";

/**
 * Contrato del kit (spec §5). Una receta dibuja dentro de su lote, relativa a
 * `lot.z` (la superficie donde apoya), y publica además de sus sólidos las
 * paredes y ventanas que miran a la cámara y los huecos para carteles/neones.
 */
export type Side = "n" | "s" | "e" | "w";
export type StyleId = "centro" | "bares" | "residencial" | "civico" | "ribera" | "distrito";
/** `open`: lados con frente abierto (avenida, agua, plaza). `maxH`: tope de altura sobre `lot.z`. */
export interface Lot { x: number; y: number; w: number; d: number; z: number; open: Side[]; maxH: number }
export interface Style { id: StyleId; mat: Material; trim: Material; roof: Material; tone: number; floorH: number; window: "windowWarm" | "windowCool" }
/** `wall`: normal de la pared. `building`: índice del sólido en `Piece.solids`. */
export interface Window { pts: Vec3[]; floor: number; wall: Vec3; building: number }
/** `local`: índice del local (frente de planta baja) dentro de la pieza. */
export interface Slot { pts: Vec3[]; wall: Vec3; side: Side; kind: "neon" | "sign"; local: number }
/** Pared con fachada que mira a la cámara. */
export interface Wall { pts: Vec3[]; normal: Vec3; floorH: number; building: number }
export interface Piece { solids: Solid[]; ground: Solid[]; accents: Accent[]; windows: Window[]; slots: Slot[]; walls: Wall[]; courtyard?: Rect; landmarkTop?: Vec3 }
export type Recipe = (lot: Lot, rng: Rng, style: Style) => Piece;
export interface RecipeDef { name: string; recipe: Recipe; family: "modern" | "courtyard" | "composite" | "curved" | "lowrise" | "landmarks"; landmark?: boolean }
