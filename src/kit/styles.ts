import type { Style, StyleId } from "./types";

/** Style of each neighborhood (spec §6). `tone` 0: zoning varies it per block. */
export const STYLES: Record<StyleId, Style> = {
  downtown: { id: "downtown", mat: "office", trim: "officeDark", roof: "officeDark", tone: 0, floorH: 3, window: "windowCool" },
  bars: { id: "bars", mat: "plaster", trim: "officeDark", roof: "terracotta", tone: 0, floorH: 3, window: "windowWarm" },
  residential: { id: "residential", mat: "plaster", trim: "stone", roof: "terracotta", tone: 0, floorH: 3, window: "windowWarm" },
  civic: { id: "civic", mat: "marble", trim: "stone", roof: "copper", tone: 0, floorH: 3.5, window: "windowWarm" },
  riverside: { id: "riverside", mat: "office", trim: "officeDark", roof: "officeDark", tone: 0, floorH: 3, window: "windowWarm" },
  district: { id: "district", mat: "curtain", trim: "officeDark", roof: "copper", tone: 0, floorH: 3, window: "windowCool" },
  industrial: { id: "industrial", mat: "concrete", trim: "steel", roof: "sheetGreen", tone: 0, floorH: 4, window: "windowCool" },
};
