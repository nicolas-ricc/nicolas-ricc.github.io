import { describe, expect, it } from "vitest";
import { HEADLAND, MOUTH_Y, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, abyssX, distToHeadland, estuaryEast, estuaryInset, inHeadland, inMouth, islandEastX, islandWestX, northCoastY, pointInPolygon, riverCenter, shoreWidth, worldZoneAt } from "./geo";

describe("mundo", () => {
  it("el contenido tiene origen negativo y lados múltiplos de 18", () => {
    expect(WORLD).toEqual({ x0: -60, y0: -60, x1: 570, y1: 336 });
    expect([ZONE_SPLIT_X, ZONE_SPLIT_Y]).toEqual([344, 146]);
    expect((WORLD.x1 - WORLD.x0) % 18).toBe(0);
    expect((WORLD.y1 - WORLD.y0) % 18).toBe(0);
  });

  it("zona clickeable: la punta y su orilla son Portfolio, la orilla del malecón Resume, el mar abierto Blog", () => {
    expect(worldZoneAt(10, 10)).toBe("portfolio");
    expect(worldZoneAt(-30, -30)).toBe("portfolio");   // banda de la fábrica
    expect(worldZoneAt(10, 200)).toBe("cv");
    expect(worldZoneAt(-30, 300)).toBe("cv");          // distrito
    expect(worldZoneAt(380, 118)).toBe("portfolio");   // punta
    expect(worldZoneAt(404, 118)).toBe("portfolio");   // arrecife
    expect(worldZoneAt(350, 100)).toBe("portfolio");   // orilla del astillero
    expect(worldZoneAt(350, 200)).toBe("cv");          // orilla del malecón
    expect(worldZoneAt(500, 200)).toBe("blog");
    expect(worldZoneAt(400, 10)).toBe("blog");
    expect(worldZoneAt(400, 260)).toBe("blog");
    for (let y = -60; y < 336; y += 6) expect(worldZoneAt(ZONE_SPLIT_X + shoreWidth(y) - 0.5, y)).not.toBe("blog");
  });

  it("la fosa empieza en x ≈ 392 al norte, a más de 30 u de la punta, y se abre al este hacia el sur", () => {
    expect(abyssX(-60)).toBeCloseTo(392 + 6 * Math.sin(-60 / 17), 6);
    expect(abyssX(118) - 400).toBeGreaterThan(30);
    expect(abyssX(336)).toBeGreaterThan(abyssX(-60) + 90);
    expect(shoreWidth(0)).toBeGreaterThan(4);
  });

  it("la boca llega hasta la costa norte de la isla", () => {
    expect(MOUTH_Y).toBe(24);
    for (let x = 280; x <= 360; x += 4) {
      const c = northCoastY(x);
      expect(inMouth(x, c - 1)).toBe(true);  // un paso al norte de la costa: agua de la boca
      expect(inMouth(x, c + 1)).toBe(false); // un paso al sur: ya es tierra
    }
    expect(inMouth(riverCenter(0) - RIVER_HALF - 1, 0)).toBe(false); // al oeste del río no hay boca
  });

  it("la punta nace en el muelle de alistamiento y llega hasta x≈400 con el faro en la punta", () => {
    expect(inHeadland(336, 115)).toBe(true);
    expect(inHeadland(396, 118)).toBe(true);
    expect(inHeadland(410, 118)).toBe(false);
    expect(inHeadland(360, 90)).toBe(false);
    expect(Math.min(...HEADLAND.map(([x]) => x))).toBeLessThanOrEqual(330);
    expect(Math.max(...HEADLAND.map(([x]) => x))).toBe(400);
  });

  it("distToHeadland es 0 adentro y crece afuera", () => {
    expect(distToHeadland(380, 118)).toBe(0);
    expect(distToHeadland(400, 118)).toBe(0);
    expect(distToHeadland(410, 118)).toBeCloseTo(10, 1);
    expect(distToHeadland(380, 80)).toBeGreaterThan(20);
  });

  it("pointInPolygon vive en geo", () => {
    expect(pointInPolygon(1, 1, [0, 0, 4, 0, 4, 4, 0, 4])).toBe(true);
    expect(pointInPolygon(5, 1, [0, 0, 4, 0, 4, 4, 0, 4])).toBe(false);
  });
});

describe("costa de la isla", () => {
  it("islandEastX queda entre el corte y el borde de la orilla; el malecón es recto; la punta sur cierra", () => {
    for (let y = 0; y <= 145; y++) {
      expect(islandEastX(y)).toBeGreaterThan(330);
      expect(islandEastX(y)).toBeLessThanOrEqual(ZONE_SPLIT_X + shoreWidth(y) - 1.5 + 1e-9);
    }
    for (let y = 158; y <= 336; y += 2) expect(islandEastX(y)).toBe(ZONE_SPLIT_X);
    expect(islandEastX(400)).toBe(-Infinity);
  });

  it("islandEastX cambia de escala al norte: varía al menos dos celdas", () => {
    const xs = Array.from({ length: 146 }, (_, y) => islandEastX(y));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(12);
  });

  it("frente a los galpones la costa norte queda en y ≤ 21", () => {
    for (let x = 303; x <= 327; x += 6) expect(northCoastY(x)).toBeLessThanOrEqual(21);
  });

  it("northCoastY: la caleta al NO baja de y 24 y la punta al NE sube al norte de y 12", () => {
    expect(northCoastY(286)).toBeGreaterThan(26);
    let min = Infinity;
    for (let x = 330; x <= 350; x++) min = Math.min(min, northCoastY(x));
    expect(min).toBeLessThan(12);
  });

  it("estuaryInset: en [0, 10], nulo en la costura y bajo la manzana derrumbada; islandWestX no pasa de la ribera", () => {
    for (let y = 146; y <= 336; y++) {
      expect(estuaryInset(y)).toBeGreaterThanOrEqual(0);
      expect(estuaryInset(y)).toBeLessThanOrEqual(10);
    }
    expect(estuaryInset(150)).toBe(0);
    for (let y = 196; y <= 262; y += 2) expect(estuaryInset(y)).toBe(0);
    for (let y = 146; y <= 400; y++) expect(islandWestX(y)).toBeLessThanOrEqual(estuaryEast(y));
  });
});
