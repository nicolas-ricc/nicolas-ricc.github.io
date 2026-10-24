import type { Solid } from "../iso/solids";

/**
 * Subestación de intemperie de la fábrica (Pont-l'Abbé + celosía de Davis Dam), dentro del cerco `x 149..190, y −60..−47`.
 * Spec: docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md §9; plan: docs/plans/2026-10-24-215-subestacion.md.
 */
export const SUBSTATION = { x0: 149, x1: 190, y0: -60, y1: -47 } as const;
export const PHASES_Y = [-57, -53.5, -50] as const;
export const TRANSFORMERS_Y = [-59, -53] as const; // y0 de cada cuba: T1 al norte, T2 al sur
export const FIREWALL = { x: 171.5, y: -54.3, w: 7, d: 0.6, h: 5.5 } as const;

export function latticePortal(_out: Solid[], _x: number): void {}
export function phases(_out: Solid[]): void {}
export function disconnector(_out: Solid[], _y: number): void {}
export function currentTransformer(_out: Solid[], _y: number): void {}
export function powerTransformer(_out: Solid[], _y0: number, _southBank: boolean): void {}
export function droppers(_out: Solid[]): void {}
export function fence(_out: Solid[]): void {}
export function substation(_out: Solid[]): void {}
