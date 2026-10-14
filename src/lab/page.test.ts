import { describe, expect, it } from "vitest";
import { bloomFromSearch, nextBloomMode } from "./page";

describe("bloom en el lab", () => {
  it("?bloom= acepta los tres modos", () => {
    expect(bloomFromSearch("?bloom=on")).toBe("on");
    expect(bloomFromSearch("?speed=0.1&bloom=fallback")).toBe("fallback");
    expect(bloomFromSearch("?bloom=off")).toBe("off");
  });
  it("sin parámetro o con un valor desconocido no fuerza nada", () => {
    expect(bloomFromSearch("")).toBeNull();
    expect(bloomFromSearch("?bloom=")).toBeNull();
    expect(bloomFromSearch("?bloom=ON")).toBeNull();
    expect(bloomFromSearch("?bloom=foo")).toBeNull();
  });
  it("la tecla 6 rota off → on → fallback → off", () => {
    expect(nextBloomMode("off")).toBe("on");
    expect(nextBloomMode("on")).toBe("fallback");
    expect(nextBloomMode("fallback")).toBe("off");
  });
});
