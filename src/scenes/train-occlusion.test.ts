import { describe, expect, it } from "vitest";
import { hullsIntersect, isBehind, overlaps, screenBounds, screenHull } from "../iso/depth";
import { bounds } from "../iso/solids";
import { WORLD } from "../map/geo";
import { WEST_RAIL_X0 } from "./hinterland";
import { STOP_X, TRACKS_Y } from "./station";
import { trainBox, trainLen } from "./train";
import { world } from "./world";

/**
 * Las capas animadas se pintan encima de toda la escena estática (`stage.ts`): si un sólido estático quedara delante
 * del tren en pantalla, el tren lo taparía mal. §6.2 da la regla; acá se prueba sobre el mundo armado, barriendo la
 * caja del tren por la vía 3 desde el borde del sangrado hasta el tope. Los sólidos de alto ≤ 0.4 (rieles, durmientes,
 * tablones) están exentos.
 */
describe("oclusión del tren por la vía del oeste (#280)", () => {
  const statics = world(7).solids.map((s) => {
    const b = bounds(s);
    return { s, b, sb: screenBounds(b), sh: screenHull(b) };
  }).filter((o) => o.b.max.z - o.b.min.z > 0.4);
  const x0s: number[] = [];
  for (let x0 = WEST_RAIL_X0 - trainLen(4); x0 <= STOP_X - trainLen(4) + 1e-9; x0 += 4) x0s.push(x0);
  x0s.push(STOP_X - trainLen(4)); // detenido: el paso de 4 no cae en 111.2
  const overlapping = (x0: number) => {
    const tb = trainBox(x0, TRACKS_Y[2], 4), sb = screenBounds(tb), sh = screenHull(tb);
    return { tb, hits: statics.filter((o) => overlaps(sb, o.sb) && hullsIntersect(sh, o.sh)) };
  };

  it("ningún sólido estático alto queda delante del tren en todo el recorrido", () => {
    expect(x0s[0]).toBeCloseTo(-448.8, 9);
    expect(x0s[x0s.length - 1]).toBeCloseTo(111.2, 9);
    let pairs = 0;
    for (const x0 of x0s) {
      const { tb, hits } = overlapping(x0);
      pairs += hits.length;
      for (const o of hits) expect(isBehind(tb, o.b), `x0 ${x0}: ${JSON.stringify(o.s).slice(0, 160)}`).toBe(false);
    }
    expect(pairs).toBeGreaterThan(0);
  });

  it("el barrido cubre el sangrado: hay sólidos al oeste del mundo que se superponen con el tren", () => {
    expect(x0s.some((x0) => overlapping(x0).hits.some((o) => o.b.max.x < WORLD.x0))).toBe(true);
  });
});
