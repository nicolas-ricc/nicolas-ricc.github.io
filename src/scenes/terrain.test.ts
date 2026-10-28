import { describe, expect, it } from "vitest";
import { BLEED, MOUTH_Y, TIP_BOX, QUAY_X, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, riverCenter, worldZoneAt } from "../map/geo";
import { createRng } from "../map/seed";
import type { Solid, Tri } from "../iso/solids";
import { BLEED_WATER } from "./terrain-classify";
import { CELL, baseToneAt, bleedTerrainAt, bleedZ, buildTerrain, seaTerrainAt, shipyardTerrainAt, terrainAt, waterBand } from "./terrain";

const tris = (s: Solid): Tri[] => (s.kind === "ground" ? s.tris : []);
// La fila de vértices más cercana a ZONE_SPLIT_Y = 146 es y = 144: la comparten la última fila de celdas del astillero (centro 141) y la primera de la ciudad (centro 147).
const SEAM_Y = Math.floor(ZONE_SPLIT_Y / CELL) * CELL;
const allTris = (m: ReturnType<typeof buildTerrain>): Tri[] => [...m.ground, ...m.water].flatMap(tris);

describe("clasificación", () => {
  it("astillero: losa al oeste del muelle, río, desembocadura y selva en los bordes", () => {
    expect(shipyardTerrainAt(50, 50)).toBe("slab");
    expect(shipyardTerrainAt(QUAY_X + 20, 60)).toBe("water");
    expect(shipyardTerrainAt(300, 10)).toBe("water");     // bahía
    expect(shipyardTerrainAt(300, MOUTH_Y + 2)).toBe("east");
    expect(shipyardTerrainAt(10, 144)).toBe("jungle");
    expect(shipyardTerrainAt(150, 20)).toBe("dock");
    expect(shipyardTerrainAt(-30, 50)).toBe("slab");     // playa de vías
    expect(shipyardTerrainAt(-30, 130)).toBe("jungle");
    expect(shipyardTerrainAt(50, -30)).toBe("slab");     // banda de la fábrica
    expect(shipyardTerrainAt(300, -30)).toBe("water");   // la bahía sigue al norte
  });
  it("astillero: la costa norte nueva, con tierra frente a los galpones, caleta y punta NE", () => {
    expect(terrainAt(300, 18)).toBe("east");   // tierra nueva frente a los galpones (antes agua: costa en y 21)
    expect(terrainAt(286, 27)).toBe("water");  // caleta al NO
    expect(terrainAt(339, 9)).not.toBe("water"); // punta NE
  });
  it("mar: punta, arrecife, orilla y mar abierto", () => {
    expect(terrainAt(380, 118)).toBe("headland");
    expect(terrainAt(336, 115)).toBe("headland");          // la base de la punta gana en la zona del astillero
    expect(seaTerrainAt(404, 118)).toBe("reef");
    expect(seaTerrainAt(350, 60)).toBe("shore");           // pegado a la costa del astillero
    expect(seaTerrainAt(400, 200)).toBe("sea");
    expect(seaTerrainAt(350, 10)).toBe("shore");           // frente a la bahía hay bajío
    expect(seaTerrainAt(370, 10)).toBe("sea");
    expect(seaTerrainAt(500, 200)).toBe("abyss");
    expect(seaTerrainAt(410, 60)).toBe("sea");
    expect(terrainAt(ZONE_SPLIT_X + 2, 200)).toBe("shore"); // clickea Resume pero es orilla
  });
  it("ciudad: cinturón de selva, estuario, ribera este de selva, cráteres y asfalto", () => {
    expect(terrainAt(50, ZONE_SPLIT_Y + 4)).toBe("jungle");   // cinturón
    expect(terrainAt(-56, 200)).toBe("asphalt");               // borde oeste: el distrito tecnológico sigue derecho desde la ciudad
    expect(terrainAt(100, 330)).toBe("asphalt");               // borde sur, ídem
    expect(terrainAt(255, 200)).toBe("water");                 // estuario
    expect(terrainAt(268, 200)).toBe("jungle");                // ribera este, antes del anillo
    expect(terrainAt(290, 200)).toBe("asphalt");               // ciudad del este
    expect(terrainAt(60, 185)).toBe("jungle");                 // cráter
    expect(terrainAt(50, 200)).toBe("asphalt");
    expect(terrainAt(340, 200)).toBe("asphalt");               // bajo el malecón
    expect(terrainAt(ZONE_SPLIT_X, 200)).toBe("shore");        // la costura este sigue siendo mar
    expect(terrainAt(-30, 290)).toBe("asphalt");
    expect(terrainAt(300, 300)).toBe("jungle");
    expect(terrainAt(338, 300)).toBe("asphalt");
    expect(terrainAt(300, 267)).toBe("jungle");
    expect(terrainAt(335, 300)).toBe("jungle");
  });
  it("en la zona cv solo hay asfalto, selva y agua", () => {
    const seen = new Set<string>();
    for (let y = ZONE_SPLIT_Y + 3; y < WORLD.y1; y += CELL) for (let x = WORLD.x0 + 3; x < ZONE_SPLIT_X; x += CELL) seen.add(terrainAt(x, y));
    expect([...seen].sort()).toEqual(["asphalt", "jungle", "water"]);
  });
  it("el agua es continua en la costura y el estuario no llega al límite con Blog", () => {
    // la última fila de celdas del astillero (centro 141) y la primera de la ciudad (centro 147) mojan las mismas columnas
    const waterX = (y: number) => { const xs: number[] = []; for (let x = 3; x < ZONE_SPLIT_X; x += CELL) if (terrainAt(x, y) === "water") xs.push(x); return xs; };
    const north = waterX(141), south = waterX(147);
    expect(north.length).toBeGreaterThan(3);
    expect(south[0]).toBe(north[0]);
    expect(Math.abs(south[south.length - 1]! - north[north.length - 1]!)).toBeLessThanOrEqual(CELL);
    // al sur del todo el estuario sigue dejando tierra antes de x = 344
    expect(terrainAt(ZONE_SPLIT_X - 3, WORLD.y1 - 3)).not.toBe("water");
  });
  it("ningún punto de tierra clickea Blog y toda la fosa clickea Blog", () => {
    const land = new Set(["slab", "east", "jungle", "dock", "asphalt", "headland", "reef"]);
    for (let y = WORLD.y0 + 3; y < WORLD.y1; y += CELL) for (let x = WORLD.x0 + 3; x < WORLD.x1; x += CELL) {
      const t = terrainAt(x, y), z = worldZoneAt(x, y);
      if (z === "blog") expect(land.has(t)).toBe(false);
      if (t === "abyss") expect(z).toBe("blog");
    }
  });
  it("sangrado: tierra construida cerca del contenido, selva y lomas más allá; el estuario y el mar siguen al sur, la bahía al norte", () => {
    expect(bleedTerrainAt(-100, 100)).toBe("industrial");   // oeste de Portfolio
    expect(bleedTerrainAt(-100, 200)).toBe("urban");        // oeste de Resume
    expect(bleedTerrainAt(100, 400)).toBe("urban");         // sur de Resume
    expect(bleedTerrainAt(100, -100)).toBe("industrial");   // norte de la fábrica
    expect(bleedTerrainAt(-100, -100)).toBe("industrial");  // esquina NO
    expect(bleedTerrainAt(-100, 400)).toBe("urban");        // esquina SO
    expect(bleedTerrainAt(-300, 100)).toBe("jungle");       // más allá del alcance oeste
    expect(bleedTerrainAt(100, -400)).toBe("jungle");       // más allá del alcance norte (ahora hasta y −348 más el alcance, con la feria de por medio)
    expect(bleedTerrainAt(100, 700)).toBe("jungle");        // más allá del alcance sur
    expect(bleedTerrainAt(250, 400)).toBe("river");         // el estuario sigue
    expect(bleedTerrainAt(330, 340)).toBe("jungle");        // la base de la punta sur, entre el estuario y el mar
    expect(bleedTerrainAt(325, 370)).toBe("jungle");        // cerca del extremo de la punta sur (en y 370 la tierra va de x 317 a 338; termina en y 380)
    expect(bleedTerrainAt(330, 385)).toBe("river");         // al sur del extremo de la punta: todo agua
    expect(bleedTerrainAt(338, 400)).toBe("river");         // más al sur la punta ya no existe; el estuario es todo agua hasta el mar
    expect(bleedTerrainAt(346, 400)).toBe("shore");         // orilla frente a la costa de Resume
    expect(bleedTerrainAt(400, 400)).toBe("sea");
    expect(bleedTerrainAt(560, 500)).toBe("abyss");
    expect(bleedTerrainAt(250, 460)).toBe("river");         // en y 460 el estuario ya llegó a 344: agua continua hasta el mar
    expect(bleedTerrainAt(343, 460)).toBe("river");
    expect(bleedTerrainAt(360, -100)).toBe("sea");         // bahía al norte, al oeste de la fosa
    expect(bleedTerrainAt(440, -100)).toBe("abyss");       // la fosa sigue al norte del contenido (abyssX(−100) ≈ 382)
    expect(bleedTerrainAt(600, 100)).toBe("abyss");
    expect(bleedZ(-380, 100)).toBeGreaterThan(9);   // loma al oeste, más allá de la tierra construida
    expect(bleedZ(-380, -430)).toBeGreaterThan(9);  // loma al norte, dentro de la grilla del sangrado
    expect(bleedZ(-100, 100)).toBe(0.6);            // sobre la tierra construida no sube
    expect(bleedZ(100, 500)).toBe(0.6);             // chato al sur
    expect(bleedZ(-60, 100)).toBe(0.6);             // en la costura no sube
    expect(bleedZ(riverCenter(-300) - RIVER_HALF - 10, -300)).toBeLessThan(3); // la loma baja antes del corte con la bahía: sin acantilado
  });
});

describe("buildTerrain", () => {
  it("la punta sur se dibuja en celdas de 6 u", () => {
    const m = buildTerrain(createRng(7));
    const side = (t: Tri) => Math.max(...t.pts.map((p) => p.x)) - Math.min(...t.pts.map((p) => p.x));
    const inBox = (t: Tri) => t.pts.every((p) => p.x >= TIP_BOX.x0 && p.x <= TIP_BOX.x1 && p.y >= TIP_BOX.y0 && p.y <= TIP_BOX.y1);
    const bleed = m.bleed.flatMap(tris).filter(inBox);
    expect(bleed.length).toBeGreaterThanOrEqual(50);
    for (const t of [...bleed, ...m.water.flatMap(tris).filter(inBox)]) expect(side(t)).toBe(6);
  });
  it("el borde de la caja de la punta sur es agua, salvo la costura", () => {
    for (let v = TIP_BOX.x0; v <= TIP_BOX.x1; v += 6) expect(BLEED_WATER.has(bleedTerrainAt(v, TIP_BOX.y1))).toBe(true);
    for (let v = TIP_BOX.y0 + 6; v <= TIP_BOX.y1; v += 6) {
      expect(BLEED_WATER.has(bleedTerrainAt(TIP_BOX.x0, v))).toBe(true);
      expect(BLEED_WATER.has(bleedTerrainAt(TIP_BOX.x1, v))).toBe(true);
    }
  });
  it("la subdivisión no toca el rng", () => {
    const r = createRng(7); let n = 0; const next = r.next; r.next = () => { n++; return next(); };
    buildTerrain(r);
    expect(n).toBe(11912);
  });
  it("una sola malla determinística que cubre el mundo", () => {
    const a = buildTerrain(createRng(7)), b = buildTerrain(createRng(7));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const t = allTris(a);
    expect(t.length).toBeGreaterThan(2 * ((WORLD.x1 - WORLD.x0) / CELL) * ((WORLD.y1 - WORLD.y0) / CELL) * 0.9);
    // el agua (m.water) mezcla contenido y sangrado: solo el suelo (m.ground) queda acotado a WORLD.
    for (const tri of a.ground.flatMap(tris)) for (const p of tri.pts) {
      expect(p.x).toBeGreaterThanOrEqual(WORLD.x0); expect(p.x).toBeLessThanOrEqual(WORLD.x1);
      expect(p.y).toBeGreaterThanOrEqual(WORLD.y0); expect(p.y).toBeLessThanOrEqual(WORLD.y1);
    }
  });
  it("el agua se reparte por profundidad en cuatro materiales, toda a z −1, con baseTone en [−1, 1] y espuma junto a la costa", () => {
    const m = buildTerrain(createRng(7));
    expect(m.water.map((w) => w.mat)).toEqual(["shallow", "water", "waterDeep", "abyss"]);
    for (const w of m.water) {
      expect(tris(w).length).toBeGreaterThan(100);
      for (const t of tris(w)) { expect(t.pts.every((p) => p.z === -1)).toBe(true); expect(t.toneOffset ?? 0).toBe(0); expect(Math.abs(t.baseTone ?? 0)).toBeLessThanOrEqual(1); }
    }
    expect(m.foam.mat).toBe("foam");
    expect(tris(m.foam).length).toBeGreaterThan(200);
    expect(waterBand(200, 300)).toBe("shallow"); expect(waterBand(240, 300)).toBe("water"); // orilla y centro del estuario
    expect(waterBand(560, 60)).toBe("abyss"); expect(waterBand(100, 100)).toBeNull();
    expect(tris(m.water[3]!).length).toBeGreaterThan(400);
    // baseTone tiene dientes: "shallow" no queda todo en 0 (depthAt cuantiza en pasos de CELL, así que la
    // primera celda de agua junto a tierra, d = CELL, es el borde somero: +1), y "water" cruza por las dos puntas.
    expect(tris(m.water[0]!).some((t) => t.baseTone === 1)).toBe(true);
    expect(tris(m.water[1]!).some((t) => t.baseTone === 1)).toBe(true);
    expect(tris(m.water[1]!).some((t) => t.baseTone === -1)).toBe(true);
    // (200,300) es la orilla del estuario (waterBand "shallow"), a depthAt = CELL = 6 de tierra: la
    // primera celda de agua, el borde más somero posible, así que baseToneAt da +1 exacto.
    expect(waterBand(200, 300)).toBe("shallow");
    expect(baseToneAt(200, 300, "shallow")).toBe(1);
  });

  it("el sangrado no deja agujeros: toda celda de 18 con agua dentro del cover produce 2 triángulos (sin subdividir, gateado por medición)", () => {
    const m = buildTerrain(createRng(7));
    const all = m.water.flatMap(tris);
    // celda real del sangrado (ancla bx0 = -402, by0 = -438), en la bahía al norte, dentro del cover.
    const x0 = 282, y0 = -420, x1 = 300, y1 = -402;
    const inCell = all.filter((t) => t.pts.every((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1));
    expect(inCell.length).toBe(2);
  });

  it("el canal del astillero y la bahía siguen clasificando como agua (no como agujero) en m.water", () => {
    const m = buildTerrain(createRng(7));
    const all = m.water.flatMap(tris);
    // la bahía es río: al norte de la desembocadura, al este del canal, sigue habiendo agua en m.water.
    expect(all.some((t) => t.pts.every((p) => p.y < MOUTH_Y && p.x > 300))).toBe(true);
    // el canal del astillero nunca cruza al oeste del muelle: ningún triángulo de agua del contenido
    // (dentro de WORLD, y < ZONE_SPLIT_Y) tiene vértices en x < QUAY_X.
    const inContent = (p: { x: number; y: number }) => p.x >= WORLD.x0 && p.x <= WORLD.x1 && p.y >= WORLD.y0 && p.y <= WORLD.y1;
    expect(all.filter((t) => t.pts.every((p) => inContent(p) && p.y < ZONE_SPLIT_Y))).not.toEqual([]);
    expect(all.filter((t) => t.pts.every((p) => inContent(p) && p.y < ZONE_SPLIT_Y)).every((t) => t.pts.every((p) => p.x >= QUAY_X))).toBe(true);
  });

  it("el agua del sangrado usa celdas de 18, dentro y fuera del cover (gateado por medición: peor redibujo)", () => {
    const m = buildTerrain(createRng(7));
    const side = (t: Tri) => Math.max(...t.pts.map((p) => p.x)) - Math.min(...t.pts.map((p) => p.x));
    const at = (x: number, y: number) => m.water.flatMap(tris).filter((t) => t.pts.some((p) => Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1));
    // vértices reales de la grilla (anclada en bx0=-402, by0=-438): dentro del cover, (264,−348), en la
    // bahía al norte de la feria; afuera, (858,660), mar abierto al sureste. Los `every` no dicen nada
    // sobre un conjunto vacío (era el caso del (597,300) de antes, que caía en el centro de una celda,
    // no en un vértice): primero hay que haber encontrado celdas ahí.
    expect(at(264, -348).length).toBeGreaterThan(0);
    expect(at(858, 660).length).toBeGreaterThan(0);
    expect(at(264, -348).every((t) => side(t) === 18)).toBe(true);
    expect(at(858, 660).every((t) => side(t) === 18)).toBe(true);
  });
  it("la punta está alta y cae al mar; el dique seco no tiene suelo (lo pone la escena)", () => {
    const m = buildTerrain(createRng(7));
    const rock = m.ground.filter((g) => g.kind === "ground" && g.mat === "rock").flatMap(tris);
    const high = rock.filter((t) => t.pts.every((p) => p.z >= 4));
    expect(high.length).toBeGreaterThan(20);
    // la base de la punta (x < 340) es baja: nada alto junto a los galpones del muelle
    const base = rock.filter((t) => t.pts.every((p) => p.x <= 340 && p.y > 96 && p.y < 136));
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((t) => t.pts.every((p) => p.z < 4))).toBe(true);
    const inDock = allTris(m).filter((t) => t.pts.every((p) => p.x > 122 && p.x < 190 && p.y > 8 && p.y < 28));
    expect(inDock).toEqual([]);
  });
  it("filtrar por zona conserva las alturas en la costura", () => {
    const p = buildTerrain(createRng(7), ["portfolio"]), c = buildTerrain(createRng(7), ["cv"]);
    const onSeam = (m: ReturnType<typeof buildTerrain>) => new Map(allTris(m).flatMap((t) => t.pts).filter((v) => v.y === SEAM_Y).map((v) => [`${v.x},${v.y}`, v.z]));
    const a = onSeam(p), b = onSeam(c);
    expect(a.size).toBeGreaterThan(10);
    expect([...a.keys()].filter((k) => b.has(k)).length).toBeGreaterThan(10);
    for (const [k, z] of a) if (b.has(k)) expect(b.get(k)).toBe(z);
    expect(allTris(p).every((t) => t.pts.every((v) => v.y <= ZONE_SPLIT_Y + CELL))).toBe(true);
  });
  it("el asfalto es casi plano y sale como su propio ground", () => {
    const m = buildTerrain(createRng(7), ["cv"]);
    const asphalt = m.ground.filter((g) => g.kind === "ground" && g.mat === "asphalt").flatMap(tris);
    expect(asphalt.length).toBeGreaterThan(600);
    expect(asphalt.every((t) => t.pts.every((p) => Math.abs(p.z) <= 0.1 || terrainAt(p.x, p.y) !== "asphalt"))).toBe(true);
    expect(m.ground.some((g) => g.kind === "ground" && g.mat === "paving")).toBe(false);
  });
  it("el sangrado rodea el contenido con celdas de 18, sin lomas al sur ni al este, y sin jitter en la costura", () => {
    const m = buildTerrain(createRng(7));
    expect(m.bleed.length).toBeGreaterThan(0);
    const bt = m.bleed.flatMap(tris);
    expect(bt.length).toBeGreaterThan(3000);
    const mats = new Set(m.bleed.map((s) => s.kind === "ground" && s.mat));
    for (const mt of mats) expect(["leafDark", "rock", "slab", "asphalt", "sand"]).toContain(mt);
    for (const t of bt) for (const p of t.pts) {
      expect(p.x).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(p.x).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(p.y).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(p.y).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
      if ((p.y > WORLD.y1 && p.x >= WORLD.x0) || p.x > WORLD.x1) expect(p.z).toBeLessThanOrEqual(1.4); // al sur (salvo la esquina SO, que queda detrás) y al este, chato
    }
    expect(bt.some((t) => t.pts.every((p) => p.y < WORLD.y0 - 250 && p.x < 100 && p.z > 6))).toBe(true); // lomas al norte, más allá de la tierra construida
    expect(m.water.flatMap(tris).some((t) => t.pts.every((p) => p.y > WORLD.y1 && p.x > QUAY_X && p.x < 300 && p.z === -1))).toBe(true); // el estuario sigue al sur (ahora en m.water, no en m.bleed)
    // costura: los vértices del sangrado sobre el borde del contenido tienen la z base del contenido, sin jitter.
    // Solo el tramo del borde que toca el contenido: un vértice en x = WORLD.x0 pero y = 400 es selva común del sangrado.
    const onSeam = (p: { x: number; y: number }) =>
      ((p.x === WORLD.x0 || p.x === WORLD.x1) && p.y >= WORLD.y0 && p.y <= WORLD.y1) ||
      ((p.y === WORLD.y0 || p.y === WORLD.y1) && p.x >= WORLD.x0 && p.x <= WORLD.x1);
    const seamZ = new Set(bt.flatMap((t) => t.pts).filter(onSeam).map((p) => p.z));
    expect(seamZ.size).toBeGreaterThan(0);
    for (const z of seamZ) expect([0, 0.6, -1]).toContain(z);
    const contentSeamZ = new Set(allTris(m).flatMap((t) => t.pts).filter(onSeam).map((p) => p.z));
    for (const z of contentSeamZ) expect([0, 0.6, -1]).toContain(z);
    // con filtro por zona no hay sangrado
    expect(buildTerrain(createRng(7), ["cv"]).bleed).toEqual([]);
  });

  it("la feria es arena plana en el sangrado norte", () => {
    expect(bleedTerrainAt(150, -264)).toBe("fair");
    const m = buildTerrain(createRng(7));
    const sand = m.bleed.find((s) => s.kind === "ground" && s.mat === "sand");
    expect(sand && sand.kind === "ground" && sand.tris.length).toBeGreaterThan(50);
    for (const t of tris(sand!)) for (const p of t.pts) expect(Math.abs(p.z)).toBeLessThanOrEqual(0.1);
  });
});
