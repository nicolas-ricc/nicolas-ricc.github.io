import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import type { WorldZone } from "../map/geo";

/**
 * Contract between an animated scene and the runtime, without Pixi: each id names
 * its own layer (a shadow/solid pair, a Graphics of accents or one of
 * water) and `tick` says which ones need redrawing.
 */
export type AnimLayer =
  // `heading`: frame the solids are aligned to, for depth sorting
  | { kind: "solid"; solids: Solid[]; alpha?: number; heading?: number }
  // `zone`: zone that veils every light of the layer (lights mounted on a ship); without it, each light is veiled with the zone of its position
  | { kind: "accent"; accents: Accent[]; alpha?: number; zone?: WorldZone }
  | { kind: "water"; water: Solid[]; alpha?: number };

export interface Animator {
  readonly ids: readonly string[];
  /** Terrain water bodies this animator draws on its own (split into bands, for example): the runtime does not paint them static. */
  readonly claims?: readonly Solid[];
  /** Only defined for the ids in `ids`: any other id throws. */
  layer(id: string): AnimLayer;
  tick(dtMs: number): ReadonlySet<string>;
}

/** `layer(id)` of an adapter over its layer table; an id outside the table throws an error that names the animator. */
export function layerLookup(animator: string, layers: Readonly<Record<string, () => AnimLayer>>): (id: string) => AnimLayer {
  return (id) => {
    const layer = Object.hasOwn(layers, id) ? layers[id] : undefined;
    if (!layer) throw new Error(`Unknown layer in ${animator}: ${id}`);
    return layer();
  };
}
