import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { fingerprint } from "../iso/fingerprint";
import { buildRenderList } from "../iso/render-list";
import type { Solid } from "../iso/solids";
import { EXHIBITS } from "../lab/exhibits";
import type { WorldZone } from "../map/geo";
import { SEED } from "../map/seed";
import { world } from "./world";

// Render baseline for #194 (English codebase): recorded on the branch before any translation,
// whose src/ was byte-identical to origin/main at 0f4e234. A rename must not move these hashes.
// On a mismatch, find what changed; never re-record.
const hash = (v: unknown): string => fingerprint(v as Solid[]);

function sceneHashes(zones?: readonly WorldZone[]) {
  const w = world(SEED, zones ? { zones } : {});
  return { solids: hash(w.solids), ground: hash(w.ground), accents: hash(w.accents), renderList: hash(buildRenderList(w.solids)) };
}

// #142: library and paved courtyardO patios lose their plinth (ground decides it); re-recorded once.
// #143: courtyardO paves its patio with 2×2 tiles (more rng draws in the city); re-recorded once.
// #144: windows on faces covered by a touching solid are not lit; accents re-recorded once.
// #171: hidden fixed lights and neon puddles are not published; accents re-recorded once.
const WORLD = { solids: "9fa7090d", ground: "97251ecf", accents: "4badcb4f", renderList: "c778a92a" };
const ZONES: Record<WorldZone, typeof WORLD> = {
  portfolio: { solids: "475f3f5b", ground: "8f1e1033", accents: "1eeef7d8", renderList: "e3d76a36" },
  cv: { solids: "661793da", ground: "bdcc7493", accents: "04ecdbf2", renderList: "30f36bab" },
  blog: { solids: "a975772d", ground: "47b0356c", accents: "f1574cea", renderList: "b6ad2d44" },
};
const RESUME_LAB = { solids: "162cdce4", ground: "551a8161", accents: "5a749523", renderList: "db3d76be" };
// keyed by exhibit id (kept in Spanish: it is the storybook URL hash); value is solids/accents
const PIECES: Record<string, string> = {
  "tanque-agua": "d0fbfe32/741638a5", "grua-torre": "1b24d1ba/b6ded264", farol: "af0034c3/b3c5d09b", tren: "acc6e446/741638a5",
  campus: "2a791f89/dcd2e4b1", selva: "97e30e40/741638a5", viga: "9f08a4fc/741638a5", carguero: "2eeb07a8/89ab3362",
  remolcador: "98fd0f53/687d5415", convoy: "63361eab/35f8cf27", lancha: "8a99e66f/f2a9b6e3",
};

describe("render baseline (#194)", () => {
  it("the whole world matches the baseline", () => {
    expect(sceneHashes()).toEqual(WORLD);
  });
  for (const z of ["portfolio", "cv", "blog"] as const) {
    it(`the ${z} zone alone matches the baseline`, () => {
      expect(sceneHashes([z])).toEqual(ZONES[z]);
    });
  }
  it("the resume lab scene (portfolio + cv) matches the baseline", () => {
    expect(sceneHashes(["portfolio", "cv"])).toEqual(RESUME_LAB);
  });
  it("every piece exhibit builds the same solids and accents", () => {
    const got: Record<string, string> = {};
    for (const e of EXHIBITS) {
      if (e.kind !== "piece") continue;
      const solids: Solid[] = [], accents: Accent[] = [];
      e.build(solids, accents);
      got[e.id] = `${hash(solids)}/${hash(accents)}`;
    }
    expect(got).toEqual(PIECES);
  });
});
