import type { Style, StyleId } from "./types";

/** Estilo de cada barrio (spec §6). `tone` 0: la zonificación lo varía por manzana. */
export const STYLES: Record<StyleId, Style> = {
  centro: { id: "centro", mat: "office", trim: "officeDark", roof: "officeDark", tone: 0, floorH: 3, window: "windowCool" },
  bares: { id: "bares", mat: "plaster", trim: "officeDark", roof: "terracotta", tone: 0, floorH: 3, window: "windowWarm" },
  residencial: { id: "residencial", mat: "plaster", trim: "stone", roof: "terracotta", tone: 0, floorH: 3, window: "windowWarm" },
  civico: { id: "civico", mat: "marble", trim: "stone", roof: "copper", tone: 0, floorH: 3.5, window: "windowWarm" },
  ribera: { id: "ribera", mat: "office", trim: "officeDark", roof: "officeDark", tone: 0, floorH: 3, window: "windowWarm" },
  distrito: { id: "distrito", mat: "curtain", trim: "officeDark", roof: "copper", tone: 0, floorH: 3, window: "windowCool" },
};
