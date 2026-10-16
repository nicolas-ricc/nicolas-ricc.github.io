import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";

/**
 * Contrato entre una escena animada y el runtime, sin Pixi: cada id nombra
 * una capa propia (un par sombra/sólido, una Graphics de acentos o una de
 * agua) y `tick` dice cuáles hay que redibujar.
 */
export type AnimLayer =
  // `heading`: marco en que los sólidos están alineados, para ordenar por profundidad
  | { kind: "solid"; solids: Solid[]; alpha?: number; heading?: number }
  | { kind: "accent"; accents: Accent[]; alpha?: number }
  | { kind: "water"; water: Solid[]; alpha?: number };

export interface Animator {
  readonly ids: readonly string[];
  /** Cuerpos de agua del terreno que este animador dibuja por su cuenta (partidos en bandas, por ejemplo): el runtime no los pinta estáticos. */
  readonly claims?: readonly Solid[];
  layer(id: string): AnimLayer;
  tick(dtMs: number): ReadonlySet<string>;
}
