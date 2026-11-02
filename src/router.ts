import { ZONES, zoneById, type ZoneId } from "./map/zones";

/** Prefix the site lives under (Vite takes it from `base`): "/" in production. */
export const BASE = import.meta.env.BASE_URL;

export function zoneFromPath(pathname: string, base: string = BASE): ZoneId | null {
  const clean = pathname.split(/[?#]/)[0] ?? "";
  if (!clean.startsWith(base)) return null; // outside the prefix it is not ours
  const rest = clean.slice(base.length);
  return ZONES.find((z) => rest === z.path || rest.startsWith(`${z.path}/`))?.id ?? null;
}

export function pathForZone(id: ZoneId | null, base: string = BASE): string {
  return id ? `${base}${zoneById(id).path}/` : base;
}
