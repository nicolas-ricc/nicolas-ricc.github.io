import { ZONES, zoneById, type ZoneId } from "./map/zones";

/** Prefijo bajo el que vive el sitio (Vite lo toma de `base`): "/" en producción. */
export const BASE = import.meta.env.BASE_URL;

export function zoneFromPath(pathname: string, base: string = BASE): ZoneId | null {
  const clean = pathname.split(/[?#]/)[0] ?? "";
  if (!clean.startsWith(base)) return null; // fuera del prefijo no es nuestro
  const rest = clean.slice(base.length);
  return ZONES.find((z) => rest === z.path || rest.startsWith(`${z.path}/`))?.id ?? null;
}

export function pathForZone(id: ZoneId | null, base: string = BASE): string {
  return id ? `${base}${zoneById(id).path}/` : base;
}
