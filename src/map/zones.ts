export type ZoneId = "portfolio" | "cv" | "blog";
export const ZONE_IDS: readonly ZoneId[] = ["portfolio", "cv", "blog"];

/** Artificial light color of a zone (the `core` ones of ISO_COLORS; in CSS, the labels). */
export type Accent = "cyan" | "amber" | "magenta";

export interface ZoneDef {
  id: ZoneId;
  name: string;
  /** Zone path under the base, without slashes. They live under `area/` so as not to clash with /blog/, which is the Hugo blog. */
  path: string;
  accent: Accent;
}

/** The three zones in tab order. The geography (which point belongs to which zone) lives in geo.ts (worldZoneAt). */
export const ZONES: readonly ZoneDef[] = [
  { id: "portfolio", name: "Portfolio", path: "area/portfolio", accent: "cyan" },
  { id: "cv", name: "Resume", path: "area/resume", accent: "amber" },
  { id: "blog", name: "Blog", path: "area/blog", accent: "magenta" },
];

export function zoneById(id: ZoneId): ZoneDef {
  const z = ZONES.find((z) => z.id === id);
  if (!z) throw new Error(`Unknown zone: ${id}`);
  return z;
}
