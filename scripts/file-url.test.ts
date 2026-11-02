import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function testSources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) testSources(full, out);
    else if (/\.[cm]?[jt]sx?$/.test(e.name)) out.push(full);
  }
  return out;
}

/** `URL.pathname` deja el percent-encoding: una ruta con espacios o tildes no existe en disco. */
describe("guard de rutas desde import.meta.url (#173)", () => {
  const files = ["src", "scripts"].flatMap((d) => testSources(join(ROOT, d)));

  it("recorre src/ y scripts/", () => {
    expect(files.map((f) => relative(ROOT, f))).toEqual(expect.arrayContaining(["scripts/agent-docs.test.ts", "src/lab/docs.test.ts"]));
  });

  it("ningún archivo arma una ruta con URL.pathname", () => {
    const hits = files.filter((f) => /import\.meta\.url\)\.pathname/.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});
