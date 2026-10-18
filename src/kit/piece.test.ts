import { describe, expect, it } from "vitest";
import { shiftTone } from "./piece";

describe("piece", () => {
  it("shiftTone suma y recorta a −2..+2", () => {
    expect(shiftTone(0, 1)).toBe(1);
    expect(shiftTone(2, 1)).toBe(2);
    expect(shiftTone(-2, -1)).toBe(-2);
    expect(shiftTone(1, 2)).toBe(2);
  });
});
