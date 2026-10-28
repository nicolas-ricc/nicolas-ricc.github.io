import { describe, expect, it } from "vitest";
import { prism } from "./city-pieces";

describe("prism", () => {
  it("copia roofMat solo si viene (#249)", () => {
    expect(prism(0, 0, 0, 5, 4, 3, "whitewash", { roof: "gable", roofMat: "tile" }).roofMat).toBe("tile");
    expect("roofMat" in prism(0, 0, 0, 5, 4, 3, "whitewash", { roof: "gable" })).toBe(false);
  });
});
