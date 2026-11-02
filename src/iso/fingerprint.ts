// src/iso/fingerprint.ts
// Huella corta de una lista de sólidos, para fijar en un test que una geometría no cambió.
import type { Solid } from "./solids";

/** Redondeo a 1e-6: las sumas de un traslado mueven una coordenada un ε (157.1 − 95 no es exactamente 62.1). */
export const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Huella FNV-1a de 32 bits del JSON de los sólidos, con los números redondeados a 1e-6 (y sin −0). Sensible al orden. */
export function fingerprint(solids: readonly Solid[]): string {
  const json = JSON.stringify(solids, (_k, v: unknown) => (typeof v === "number" ? r6(v) + 0 : v));
  let h = 2166136261; // semilla y primo FNV-1a de 32 bits, en decimal: el guard de paleta toma todo hex de 6 dígitos por un color
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}
