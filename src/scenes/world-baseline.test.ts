import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { fingerprint } from "../iso/fingerprint";
import type { Solid } from "../iso/solids";
import { EXHIBITS } from "../lab/exhibits";

// Render baseline for #194 (English codebase): the guard on the world, zone and lab-scene hashes has done
// its job; #56 moves the seam and changes all geometry on purpose. Only the pieces stay: they must not move.
// On a mismatch, find what changed; never re-record.
const hash = (v: unknown): string => fingerprint(v as Solid[]);

// keyed by exhibit id (kept in Spanish: it is the storybook URL hash); value is solids/accents
const PIECES: Record<string, string> = {
  "tanque-agua": "d0fbfe32/741638a5", "grua-torre": "1b24d1ba/b6ded264", farol: "af0034c3/b3c5d09b", tren: "acc6e446/741638a5",
  campus: "2a791f89/dcd2e4b1", selva: "97e30e40/741638a5", viga: "9f08a4fc/741638a5", carguero: "2eeb07a8/89ab3362",
  remolcador: "98fd0f53/687d5415", convoy: "63361eab/35f8cf27", lancha: "8a99e66f/f2a9b6e3",
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
