import { v3 } from "../iso/geometry";
import type { Plate, Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";

/**
 * Maltería de Mistley (`x 20..44, y −46..−16`, al oeste de la nave de calderas) y tanque de agua
 * sobre patas (`x ≤ 20, y ≤ −9.3`). La cámara ve techo, este (+x) y sur (+y): el detalle va ahí.
 * Decisiones (D1–D15): docs/plans/2026-10-24-214-malteria-tanque.md.
 */
export const MALT = { x: 20, y: -46, w: 24, d: 30, h: 18 } as const;
export const WATER_TOWER = { x: 10, y: -36 } as const;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });
const beam = (from: ReturnType<typeof v3>, to: ReturnType<typeof v3>, w: number, mat: Material, h = w): Solid => ({ kind: "beam", from, to, w, h, mat });

/** Prisma de fachada de cinco pisos, techo de seis faldones con óculos, pilastras y cornisas del piñón, puertas de carga, portón y horno con techo piramidal. */
export function maltings(out: Solid[]): void {
  const { x, y, w, d, h } = MALT;
  const rect = (u0: number, u1: number, z0: number, z1: number, toneOffset: number): Plate => ({ wall: 2, shape: "rect", u0, u1, z0, z1, mat: "steel", toneOffset });
  const plates: Plate[] = [1, 2, 3, 4].map((k) => rect(11 / 24, 13 / 24, 3.6 * k, 3.6 * k + 2.3, -1));
  plates.push(rect(10.5 / 24, 13.5 / 24, 0, 3, -2));
  out.push({
    ...prism(x, y, 0, w, d, h, "brick"),
    facade: {
      floors: 5, cols: 8, window: { w: 0.45, h: 0.5 }, head: "segmental", headMat: "stockbrick", sill: "stockbrick",
      piers: { every: 2, w: 0.5, mat: "stockbrick" }, courses: { mat: "stockbrick", h: 0.35 }, ties: { r: 0.25, mat: "steel" },
    },
    plates,
  });

  // techo: seis rampas; las del oeste se cortan en y −40 por el horno (D1). Óculos en la cara sur de las de w 6 (D4)
  const oculus = (): Plate[] => [
    { wall: 2, shape: "disc", u0: 0.35, u1: 0.65, z0: 18.8, z1: 20.6, mat: "stockbrick" },
    { wall: 2, shape: "disc", u0: 0.5 - 0.7 / 6, u1: 0.5 + 0.7 / 6, z0: 19, z1: 20.4, mat: "glass" },
  ];
  out.push({ kind: "ramp", at: v3(20, -40, 18), w: 6, d: 24, h: 6, mat: "steel", dir: "w", plates: oculus() });
  out.push({ kind: "ramp", at: v3(26, -40, 18), w: 6, d: 24, h: 6, mat: "steel", dir: "e", plates: oculus() });
  out.push({ kind: "ramp", at: v3(32, -46, 18), w: 6, d: 30, h: 6, mat: "steel", dir: "w", plates: oculus() });
  out.push({ kind: "ramp", at: v3(38, -46, 18), w: 6, d: 30, h: 6, mat: "steel", dir: "e", plates: oculus() });
  out.push({ kind: "ramp", at: v3(20, -46, 18), w: 2, d: 6, h: 2, mat: "steel", dir: "w" });  // al norte del corte, fuera del horno
  out.push({ kind: "ramp", at: v3(28, -46, 18), w: 4, d: 6, h: 4, mat: "steel", dir: "e" });

  // pilastras del piñón, adosadas por dentro; la de x 32 solo del tope de la puerta del piso 4 al valle (D2)
  for (const [px, pw, z0, z1] of [[20, 0.5, 0, 18], [25.75, 0.5, 0, 24], [31.75, 0.5, 16.7, 18], [37.75, 0.5, 0, 24], [43.5, 0.5, 0, 18]] as const) out.push(prism(px, -16.4, z0, pw, -16 - -16.4, z1 - z0, "stockbrick")); // d 0.4 exacto en coma flotante: el borde sur queda en y −16
  // cornisas: del alero (metido 0.15) a la cumbrera (D3)
  for (const [ax, rx] of [[20.15, 26], [31.85, 26], [32.15, 38], [43.85, 38]] as const) out.push(beam(v3(ax, -16.3, 18.15), v3(rx, -16.3, 24), 0.4, "stockbrick", 0.3));

  // horno con techo piramidal (D7)
  out.push(prism(22, -46, 18, 6, 6, 6, "brick"));
  out.push({ kind: "cone", at: v3(25, -43, 24), r: 4.2, h: 2, mat: "steel", sides: 4 });
}

/** Tanque de agua sobre cuatro patas inclinadas con tornapuntas, cruces, riser, escalera, pasarela con baranda, cuba y techo cónico; centrado en `at`. */
export function waterTower(out: Solid[], at: { x: number; y: number } = WATER_TOWER): void {
  const { x: cx, y: cy } = at;
  const s = (z: number) => 4 - (1.5 * z) / 14; // semilado a la altura z
  const cyl = (r: number, z: number, h: number): Solid => ({ kind: "cylinder", at: v3(cx, cy, z), r, h, mat: "steel" });
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;

  for (const [sx, sy] of corners) out.push(beam(v3(cx + sx * 4, cy + sy * 4, 0), v3(cx + sx * 2.5, cy + sy * 2.5, 14), 0.5, "rust"));
  out.push(cyl(0.6, 0, 14)); // riser

  for (const z of [5, 10]) {
    corners.forEach(([sx, sy], i) => {
      const [tx, ty] = corners[(i + 1) % 4]!;
      out.push(beam(v3(cx + sx * s(z), cy + sy * s(z), z), v3(cx + tx * s(z), cy + ty * s(z), z), 0.3, "rust"));
    });
  }
  for (const [z0, z1] of [[0, 5], [5, 10]] as const) {
    const a = s(z0), b = s(z1);
    for (const k of [-1, 1]) {
      out.push(beam(v3(cx + a, cy + k * a, z0), v3(cx + b, cy - k * b, z1), 0.15, "rust")); // paño este
      out.push(beam(v3(cx + k * a, cy + a, z0), v3(cx - k * b, cy + b, z1), 0.15, "rust")); // paño sur
    }
  }
  out.push(beam(v3(cx + 4.5, cy + 4.5, 0), v3(cx + 3, cy + 3, 14), 0.6, "steel", 0.15)); // escalera junto a la pata SE

  // pasarela con ocho postes y baranda (como la plataforma de las chimeneas)
  out.push(cyl(4.6, 14, 0.25));
  const pr = 4.6 * Math.cos(Math.PI / 8) - 0.15;
  const post = (k: number) => v3(cx + pr * Math.cos((k * Math.PI) / 4), cy + pr * Math.sin((k * Math.PI) / 4), 15.175);
  for (let k = 0; k < 8; k++) {
    const p = post(k), q = post((k + 1) % 8);
    out.push(prism(p.x - 0.075, p.y - 0.075, 14.25, 0.15, 0.15, 1, "steel"));
    out.push(beam(p, q, 0.15, "steel"));
  }

  // fondo escalonado, cuba, techo y bola
  out.push(cyl(2.2, 13, 0.6), cyl(3.2, 13.6, 0.6), cyl(3.8, 14.2, 0.6), cyl(4, 14.8, 8));
  out.push({ kind: "cone", at: v3(cx, cy, 22.8), r: 4.6, h: 1.4, mat: "steel", sides: 12 });
  out.push(cyl(0.3, 24.2, 0.5));
}
