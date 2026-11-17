import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { spotOf } from "../iso/spot-fixtures";
import { worldZoneAt } from "../map/geo";
import { BEAM_PERIOD_MS } from "../scenes/sea-anim";
import { assembleWorld, tag } from "../world/assemble";
import { accentZone } from "../world/veil";
import { contextAnimators, contextScene, cropAnimators, cropScene, pieceScene } from "./crop";
import { EXHIBITS } from "./exhibits";

/** The 11 exhibits of #395 that must draw no round haloed light (spec §1). */
const GATE = ["playa-camiones", "gradas", "estacion", "patio-contenedores", "grua-muelle", "cartel-taller-escena", "silos", "playa-contenedores", "autitos-chocadores", "faro", "pecio"];
const FRAMES = 32;

/** Static accents plus 32 frames of the accent layers across one beam turn (8 s), built the way `storybook.ts` builds the exhibit; fresh world per exhibit, memoized (nothing mutates the result). */
const memo = new Map<string, Accent[]>();
function lights(id: string): Accent[] {
  const hit = memo.get(id);
  if (hit) return hit;
  const e = EXHIBITS.find((x) => x.id === id);
  if (!e) throw new Error(`no exhibit ${id}`);
  const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
  const [s, anims] = e.kind === "region" ? [cropScene(scene, e.box), cropAnimators(animators, e.box)]
    : e.kind === "context" ? [contextScene(scene, e), contextAnimators(animators, e)]
    : [pieceScene(e.build, e.pad), e.animate ? [tag(e.animate({ reducedMotion: false }), e.zone)] : []];
  const out = [...s.accents];
  for (let k = 0; k < FRAMES; k++) {
    for (const a of anims) for (const lid of a.ids) { const l = a.layer(lid); if (l.kind === "accent") out.push(...l.accents); }
    for (const a of anims) a.tick(BEAM_PERIOD_MS / FRAMES);
  }
  memo.set(id, out);
  return out;
}

const spots = (as: readonly Accent[]) => as.flatMap((a) => { const s = spotOf(a); return s ? [s] : []; });
const has = (as: readonly Accent[], color: string, r: number) => spots(as).some((s) => s.color === color && Math.abs(s.r - r) < 1e-9);

describe("no round haloed lights in the 11 exhibits (#403)", () => {
  it.each(GATE)("%s draws no dot", (id) => {
    expect(lights(id).filter((a) => a.kind === "dot")).toEqual([]);
  }, 30_000); // one world build plus 32 frames per exhibit

  it("the wreck, lighthouse, station and train exhibits show their replacement spots", () => {
    expect(has(lights("pecio"), "magentaMid", 1)).toBe(true); // wreck buoy
    expect(has(lights("faro"), "magenta", 0.45)).toBe(true); // gallery
    const station = lights("estacion");
    expect(has(station, "magenta", 0.35)).toBe(true); // buffers
    expect(spots(station).some((s) => Math.abs(s.r - 0.4) < 1e-9)).toBe(true); // signals (SIGNAL_R_DOT)
    const train = lights("tren");
    expect(has(train, "cyan", 0.3)).toBe(true); // headlights
    expect(has(train, "magenta", 0.25)).toBe(true); // red lights
    expect(train.filter((a) => a.kind === "dot")).toEqual([]);
  });

  it("the only spots of the world are the replaced lights", () => {
    const { scene } = assembleWorld(undefined, { reducedMotion: false });
    const found = spots(scene.accents).map((s) => `${s.color} ${Math.round(s.r * 1e6) / 1e6}`);
    expect(found.filter((k) => k === "magenta 0.35")).toHaveLength(3); // the station buffers
    expect(found.filter((k) => k === "magentaMid 1")).toHaveLength(1); // the wreck buoy
    expect(found.filter((k) => !["magenta 0.35", "magentaMid 1"].includes(k))).toEqual([]); // the tinker sign is built only in the lab, not in the world
  });

  it("the rest of the world keeps its dots", () => {
    for (const id of ["calle-faroles", "boyas"]) expect(lights(id).filter((a) => a.kind === "dot").length, id).toBeGreaterThanOrEqual(1);
    expect(assembleWorld(undefined, { reducedMotion: false }).scene.accents.some((a) => a.kind === "dot")).toBe(true);
  });

  it("every spot is veiled with the zone of its light", () => {
    const { scene } = assembleWorld(undefined, { reducedMotion: false });
    const all = [...scene.accents, ...GATE.flatMap(lights)];
    let n = 0;
    for (const a of all) {
      const s = spotOf(a);
      if (!s) continue;
      n++;
      expect(accentZone(a), `${s.color} at ${s.at.x}, ${s.at.y}`).toBe(worldZoneAt(s.at.x, s.at.y));
    }
    expect(n).toBeGreaterThan(0);
  }, 30_000); // the 11 exhibits come from the memo, but the world build alone can pass 5 s under load
});
