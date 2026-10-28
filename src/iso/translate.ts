// src/iso/translate.ts
import type { Vec2, Vec3 } from "./geometry";
import type { Solid } from "./solids";

/** Punto movido `(dx, dy)` en planta: z no cambia. Devuelve un objeto nuevo. */
const move = <P extends Vec2>(p: P, dx: number, dy: number): P => ({ ...p, x: p.x + dx, y: p.y + dy });

/**
 * Sólido igual al dado pero desplazado `(dx, dy)` en planta; z no cambia.
 * Mueve solo los puntos (`at`, `from`/`to`, `footprint`, `path`, `tris`); lo demás se copia tal cual (mismas referencias).
 * No redondea ni muta `s`: los puntos movidos son objetos nuevos.
 */
export function translate(s: Solid, dx: number, dy: number): Solid {
  const p = (q: Vec2): Vec2 => move(q, dx, dy);
  const p3 = (q: Vec3): Vec3 => move(q, dx, dy);
  switch (s.kind) {
    case "prism":
    case "ramp":
    case "cylinder":
    case "cone":
    case "hull":
    case "wheel": return { ...s, at: p3(s.at) };
    case "poly": return { ...s, footprint: s.footprint.map(p) };
    case "beam": return { ...s, from: p3(s.from), to: p3(s.to) };
    case "strip": return { ...s, path: s.path.map(p) };
    case "ground": return { ...s, tris: s.tris.map((t) => ({ ...t, pts: [p3(t.pts[0]), p3(t.pts[1]), p3(t.pts[2])] })) };
  }
}
