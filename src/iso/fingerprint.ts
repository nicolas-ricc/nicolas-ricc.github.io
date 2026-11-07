// src/iso/fingerprint.ts
// Short fingerprint of a list of solids, to pin in a test that a geometry did not change.
import type { Solid } from "./solids";

/** Rounding to 1e-6: the sums of a translation move a coordinate by an ε (157.1 − 95 is not exactly 62.1). */
export const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** 32-bit FNV-1a fingerprint of the solids' JSON, with numbers rounded to 1e-6 (and no −0). Order-sensitive. */
export function fingerprint(solids: readonly Solid[]): string {
  const json = JSON.stringify(solids, (_k, v: unknown) => (typeof v === "number" ? r6(v) + 0 : v));
  let h = 2166136261; // 32-bit FNV-1a seed and prime, in decimal: the palette guard takes any 6-digit hex for a color
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}
