import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { fingerprint } from "../iso/fingerprint";
import type { Solid } from "../iso/solids";
import { EXHIBITS } from "../lab/exhibits";

// Render baseline for #194 (English codebase): the guard on the world, zone and lab-scene hashes has done
// its job; #56 moves the seam and changes all geometry on purpose. Only the pieces stay: they must not move.
// On a mismatch, find what changed; re-record only a deliberate change, saying why here.
// #152 (re-recorded once): the interlocks mark enters the JSON; campus drops the trees that stood on its tables, grua-muelle only gains marks.
const hash = (v: unknown): string => fingerprint(v as Solid[]);

// keyed by exhibit id (kept in Spanish: it is the storybook URL hash); value is solids/accents
const PIECES: Record<string, string> = {
  "tanque-agua": "d0fbfe32/741638a5", "grua-torre": "1b24d1ba/b6ded264", farol: "af0034c3/b3c5d09b", tren: "acc6e446/741638a5",
  campus: "b68f62d8/dcd2e4b1", selva: "97e30e40/741638a5", viga: "9f08a4fc/741638a5", carguero: "2eeb07a8/89ab3362",
  remolcador: "98fd0f53/687d5415", convoy: "63361eab/35f8cf27", lancha: "8a99e66f/f2a9b6e3",
  "grua-muelle": "624cfd88/d3db2853",
  // #360: the four sign placeholders are new pieces; the earlier twelve did not move
  // #362: grafiti replaces its placeholder; the other pieces did not move
  // #375: gap 2 and KERN respace the words of the four signs (and the platform posts move in)
  // #378: cartel-torre (tower crown with helipad) replaces the two cartel-helipuerto placeholders
  "cartel-torre": "76848b7a/636e210a",
  // #379: the tinker sign (cartel-taller, on its hall stand-in) replaces grafiti
  "cartel-taller": "recorded-in-stage-4",
  // #363: plataforma replaces its placeholder (platform, railing, ladder, hut, beacon, Blog sign)
  // #376: the Blog sign uses SIGN_FONT, gains a backing panel and a raised frame, and is built at its site and then translated
  plataforma: "26c397da/240f731e",
};

describe("render baseline (#194)", () => {
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
