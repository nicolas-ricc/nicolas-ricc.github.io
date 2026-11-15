import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// storybook.ts boots the app on import: the source is read, as in lab-excluded.test.ts
const src = readFileSync(new URL("./storybook.ts", import.meta.url), "utf8");

describe("storybook stage lifecycle (#102)", () => {
  it("recycles each stage with stage.destroy(), never destroying the container by hand", () => {
    expect(src).not.toMatch(/container\.destroy\(/);
    expect(src).toContain("stage?.destroy()");
  });
});

describe("page elements (#187)", () => {
  it("does not read them with getElementById: mountStorybook resolves them", () => {
    expect(src).not.toContain("getElementById(");
    expect(src).toMatch(/mountStorybook\(\s*document\s*,/);
  });
});

describe("storybook logs (#132)", () => {
  it("key 6 does not use the bloom: prefix of the measured verdict", () => {
    const infos = src.match(/console\.\w+\(\s*([`"'])[\s\S]*?\1/g) ?? [];
    expect(infos.length).toBeGreaterThan(0);
    expect(infos.filter((l) => l.includes("bloom:"))).toEqual([]);
    expect(src).toMatch(/stage\.setBloom\(nextBloomMode\(stage\.bloom\)\);\s*if \(log\) console\.info\(`\[storybook\] bloom by hand: \$\{stage\.bloom\}`\);/);
  });
  it("the key help still describes key 6", () => {
    expect(src).toMatch(/6 rotates the bloom/);
    expect(readFileSync(new URL("../../lab/storybook.html", import.meta.url), "utf8")).toMatch(/aria-label="[^"]*Key 6 rotates the bloom: off, on, fallback\.[^"]*"/);
  });
  it("worst and since accumulate only with log, as in src/main.ts", () => {
    expect(src).toMatch(/bloom\?\.tick\(dt\);\s*if \(log\) \{\s*worst = Math\.max\(worst, dt\);\s*since \+= ticker\.deltaMS;\s*if \(since > 5000\) \{.*worst = 0; since = 0; \}\s*\}/);
  });
});

describe("cover-scale key c (#360)", () => {
  it("the header comment and the aria-label document the c key", () => {
    expect(src.replace(/\n\s*\*\s*/g, " ")).toContain("c cycles the exhibit scale: real, 1.17 and 0.83, the cover scales of a laptop and a phone");
    expect(readFileSync(new URL("../../lab/storybook.html", import.meta.url), "utf8")).toMatch(/aria-label="[^"]*Key c cycles the exhibit scale: real, 1\.17 \(laptop cover\) and 0\.83 \(phone cover\)\.[^"]*"/);
  });
  it("c ignores held keys and logs the mode", () => {
    expect(src).toMatch(/ev\.key === "c" && !ev\.repeat/);
    expect(src).toContain("[storybook] cover scale: ");
  });
});
