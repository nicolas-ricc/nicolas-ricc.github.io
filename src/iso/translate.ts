// src/iso/translate.ts
// Shift solids and accents in plan, leaving z untouched.
import type { Accent } from "./accent";
import type { Vec2, Vec3 } from "./geometry";
import type { Solid } from "./solids";

/** Point moved `(dx, dy)` in plan: z does not change. Returns a new object. */
const move = <P extends Vec2>(p: P, dx: number, dy: number): P => ({ ...p, x: p.x + dx, y: p.y + dy });

/** Solid shifted `(dx, dy)` in plan. Only the points are new objects; the rest (plates, facade…) shares references. Does not mutate `s`. */
export function translate(s: Solid, dx: number, dy: number): Solid {
  const p = (q: Vec2): Vec2 => move(q, dx, dy);
  const p3 = (q: Vec3): Vec3 => move(q, dx, dy);
  switch (s.kind) {
    case "prism":
    case "ramp":
    case "cylinder":
    case "cone":
    case "hull":
    case "dome":
    case "vault":
    case "wheel": return { ...s, at: p3(s.at) };
    case "poly": return { ...s, footprint: s.footprint.map(p) };
    case "beam": return { ...s, from: p3(s.from), to: p3(s.to) };
    case "strip": return { ...s, path: s.path.map(p) };
    case "ground": return { ...s, tris: s.tris.map((t) => ({ ...t, pts: [p3(t.pts[0]), p3(t.pts[1]), p3(t.pts[2])] })) };
  }
}

/** Accent shifted `(dx, dy)` in plan. Does not mutate `a`. */
export function translateAccent(a: Accent, dx: number, dy: number): Accent {
  switch (a.kind) {
    case "dot": return { ...a, at: move(a.at, dx, dy) };
    case "poly": return { ...a, pts: a.pts.map((q) => move(q, dx, dy)) };
  }
}
