import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import type { WorldZone } from "../map/geo";

/**
 * Contrato entre una escena animada y el runtime, sin Pixi: cada id nombra
 * una capa propia (un par sombra/sólido, una Graphics de acentos o una de
 * agua) y `tick` dice cuáles hay que redibujar.
 */
export type AnimLayer =
  // `heading`: marco en que los sólidos están alineados, para ordenar por profundidad
  | { kind: "solid"; solids: Solid[]; alpha?: number; heading?: number }
  // `zone`: zona con que se velan todas las luces de la capa (luces montadas en un barco); sin ella, cada luz se vela con la zona de su posición
  | { kind: "accent"; accents: Accent[]; alpha?: number; zone?: WorldZone }
  | { kind: "water"; water: Solid[]; alpha?: number };

export interface Animator {
  readonly ids: readonly string[];
  /** Cuerpos de agua del terreno que este animador dibuja por su cuenta (partidos en bandas, por ejemplo): el runtime no los pinta estáticos. */
  readonly claims?: readonly Solid[];
  /** Solo definida para los ids de `ids`: cualquier otro id lanza. */
  layer(id: string): AnimLayer;
  tick(dtMs: number): ReadonlySet<string>;
}

/** `layer(id)` de un adaptador sobre su tabla de capas; un id ajeno a la tabla lanza un error que nombra al animador. */
export function layerLookup(animator: string, layers: Readonly<Record<string, () => AnimLayer>>): (id: string) => AnimLayer {
  return (id) => {
    const layer = Object.hasOwn(layers, id) ? layers[id] : undefined;
    if (!layer) throw new Error(`Capa desconocida en ${animator}: ${id}`);
    return layer();
  };
}
