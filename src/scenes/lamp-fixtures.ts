import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";

const EPS = 1e-9;
const near = (a: number, b: number): boolean => Math.abs(a - b) < EPS;

/** Steel 0.6 × 0.6 post of h 5 or 6: the shape of `lamp()` and `industrialLamp()`. */
export const isLampPost = (s: Solid): s is Solid & { kind: "prism" } =>
  s.kind === "prism" && s.mat === "steel" && near(s.w, 0.6) && near(s.d, 0.6) && (near(s.h, 5) || near(s.h, 6));

/**
 * Lamp parts left without their partner, for the scene tests (#401): every lamp post needs a dot at
 * (+0.3, +0.3, +h) from its corner (the axis, also with `center`), and every r 1.2 dot (`industrialLamp`) needs its post.
 * One line per orphan; `[]` when everything pairs.
 */
export function unpairedLampParts(solids: readonly Solid[], accents: readonly Accent[]): string[] {
  const dots = accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");
  const posts = solids.filter(isLampPost);
  const tip = (p: Solid & { kind: "prism" }) => ({ x: p.at.x + 0.3, y: p.at.y + 0.3, z: p.at.z + p.h });
  const on = (d: Accent & { kind: "dot" }, p: Solid & { kind: "prism" }) => { const t = tip(p); return near(d.at.x, t.x) && near(d.at.y, t.y) && near(d.at.z, t.z); };
  return [
    ...posts.filter((p) => !dots.some((d) => on(d, p))).map((p) => `post at ${p.at.x},${p.at.y},${p.at.z} h ${p.h}`),
    ...dots.filter((d) => near(d.r, 1.2) && !posts.some((p) => on(d, p))).map((d) => `bulb at ${d.at.x},${d.at.y},${d.at.z}`),
  ];
}
