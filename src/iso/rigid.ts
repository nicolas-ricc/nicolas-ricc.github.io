import { dot, v3, type Vec3 } from "./geometry";

/** Raft long axis in plan (unit, z = 0). */
export const RAFT_U: Vec3 = v3(Math.SQRT1_2, -Math.SQRT1_2, 0);
/** Raft cross axis in plan (unit, z = 0), perpendicular to `RAFT_U`. */
export const RAFT_N: Vec3 = v3(Math.SQRT1_2, Math.SQRT1_2, 0);

/** Rotation by `angle` about the unit `axis` through the origin (right-hand rule, Rodrigues). Does not normalize `axis`, does not mutate. */
export const rotateAbout = (axis: Vec3, angle: number): ((p: Vec3) => Vec3) => {
  const c = Math.cos(angle), s = Math.sin(angle), k = axis;
  return (p) => {
    const d = dot(k, p) * (1 - c);
    return v3(
      p.x * c + (k.y * p.z - k.z * p.y) * s + k.x * d,
      p.y * c + (k.z * p.x - k.x * p.z) * s + k.y * d,
      p.z * c + (k.x * p.y - k.y * p.x) * s + k.z * d,
    );
  };
};

/**
 * Rigid motion of the raft about `centre`: rotates about `RAFT_N` by `-pitch`,
 * then about `RAFT_U` by `roll`, then adds `dz` to z. Positive pitch raises the
 * +u end; positive roll raises the +n end. Returns new points, never mutates.
 */
export function rigid(pts: readonly Vec3[], centre: Vec3, pitch: number, roll: number, dz: number): Vec3[] {
  const pitchRot = rotateAbout(RAFT_N, -pitch), rollRot = rotateAbout(RAFT_U, roll);
  return pts.map((p) => {
    const q = rollRot(pitchRot(v3(p.x - centre.x, p.y - centre.y, p.z - centre.z)));
    return v3(centre.x + q.x, centre.y + q.y, centre.z + q.z + dz);
  });
}
