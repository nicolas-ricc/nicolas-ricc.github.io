import type { WorldZone } from "../map/geo";
import { createRng, SEED } from "../map/seed";
import type { Animator } from "../scenes/animator";
import { cityAnimator } from "../scenes/city-animator";
import { factoryAnimator } from "../scenes/factory-animator";
import { fairAnimator } from "../scenes/fair-animator";
import { seaAnimator } from "../scenes/sea-animator";
import { shipyardAnimator } from "../scenes/shipyard-animator";
import { techAnimator } from "../scenes/tech-animator";
import { waterAnimator } from "../scenes/water-animator";
import { world, type WorldScene } from "../scenes/world";

/** Un animador con su zona de origen (la del lab y los recortes); `null` es el agua. El velo de las luces no la usa: va por la posición de cada luz o por la zona que declare la capa. */
export type ZonedAnimator = Animator & { zone: WorldZone | null };
export interface Assembled { scene: WorldScene; animators: ZonedAnimator[] }

const tag = (a: Animator, zone: WorldZone | null): ZonedAnimator => Object.assign(a, { zone });

/** El mundo (o algunas zonas) y sus animadores, con los seeds del laboratorio. */
export function assembleWorld(zones: readonly WorldZone[] | undefined, opts: { reducedMotion: boolean }): Assembled {
  const { reducedMotion } = opts;
  const scene = world(SEED, zones ? { zones } : {});
  const animators: ZonedAnimator[] = [tag(waterAnimator(scene.terrain, { reducedMotion }), null)];
  if (scene.shipyard) animators.push(tag(shipyardAnimator(scene.shipyard, createRng(SEED + 1), { reducedMotion }), "portfolio"));
  if (scene.city) animators.push(tag(cityAnimator(scene.city, createRng(SEED + 2), { reducedMotion }), "cv"));
  if (scene.factory) animators.push(tag(factoryAnimator({ ...scene.factory, stacks: [...scene.factory.stacks, ...(scene.hinterland?.stacks ?? [])] }, createRng(SEED + 4), { reducedMotion }), "portfolio"));
  if (scene.tech) animators.push(tag(techAnimator(scene.tech, createRng(SEED + 5), { reducedMotion }), "cv"));
  if (scene.fair) animators.push(tag(fairAnimator(scene.fair, { reducedMotion }), "portfolio"));
  if (scene.sea) animators.push(tag(seaAnimator(scene.sea, { reducedMotion }), "blog"));
  return { scene, animators };
}
