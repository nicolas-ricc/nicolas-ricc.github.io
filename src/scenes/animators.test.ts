import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import type { Animator } from "./animator";
import { city } from "./city";
import { cityAnimator } from "./city-animator";
import { factory } from "./factory";
import { factoryAnimator } from "./factory-animator";
import { fair } from "./fair";
import { fairAnimator } from "./fair-animator";
import { railAnimator } from "./rail-animator";
import { seaAnimator } from "./sea-animator";
import { shipyard } from "./shipyard";
import { shipyardAnimator } from "./shipyard-animator";
import { tech } from "./tech";
import { techAnimator } from "./tech-animator";
import { waterAnimator } from "./water-animator";
import { world } from "./world";

const opts = { reducedMotion: false };
const w = world(7);
const animators: [string, () => Animator][] = [
  ["cityAnimator", () => cityAnimator(city(createRng(7), createRng(8)), createRng(3), opts)],
  ["factoryAnimator", () => factoryAnimator(factory(createRng(7)), createRng(3), opts)],
  ["fairAnimator", () => fairAnimator(fair(createRng(7)), opts)],
  ["railAnimator", () => railAnimator(opts)],
  ["seaAnimator", () => seaAnimator(w.sea!, opts)],
  ["shipyardAnimator", () => shipyardAnimator(shipyard(createRng(7)), createRng(3), opts)],
  ["techAnimator", () => techAnimator(tech(createRng(7)), createRng(3), opts)],
  ["waterAnimator", () => waterAnimator(w.terrain, opts)],
];

describe("capa desconocida en los adaptadores", () => {
  it.each(animators)("%s nombra el animador y el id", (name, mk) => {
    const a = mk();
    expect(() => a.layer("nada.capa")).toThrow(new Error(`Capa desconocida en ${name}: nada.capa`));
    expect(() => a.layer("toString")).toThrow(`Capa desconocida en ${name}: toString`);
  });

  it.each(animators)("%s sigue resolviendo todos sus ids", (_, mk) => {
    const a = mk();
    expect(a.ids.length).toBeGreaterThan(0);
    for (const id of a.ids) expect(["solid", "accent", "water"]).toContain(a.layer(id).kind);
  });
});
