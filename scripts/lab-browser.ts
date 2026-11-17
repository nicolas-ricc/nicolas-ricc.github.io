/** Shared harness of the browser-bound lab scripts (legibility, wreck-sweep): a vite dev server and an agent-browser session. */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { parseEval } from "./legibility-measure";

const ROOT = resolve(import.meta.dirname, "..");

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts vite on `port` (strict) and waits up to 30 s for the storybook page; errors are prefixed `${label}:`. */
export async function startVite(port: number, label: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, [resolve(ROOT, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let err = "", exited = false;
  child.stderr.on("data", (d) => { err += d; });
  child.stdout.resume();
  child.on("exit", () => { exited = true; });
  for (const t0 = Date.now(); Date.now() - t0 < 30_000; await sleep(250)) {
    if (exited) throw new Error(`${label}: vite exited early: ${err.trim()}`);
    try { if ((await fetch(`http://localhost:${port}/lab/storybook.html`)).status === 200) return child; } catch { /* not up yet */ }
  }
  child.kill();
  throw new Error(`${label}: vite did not answer in 30 s`);
}

/** agent-browser calls bound to `session`: `ab` returns stdout, `evalJson` parses the `eval` output. */
export function agentBrowser(session: string, label: string, timeoutMs = 30_000): { ab(...args: string[]): string; evalJson<T>(js: string): T } {
  const ab = (...args: string[]): string =>
    execFileSync("agent-browser", args, { env: { ...process.env, AGENT_BROWSER_SESSION: session }, maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const evalJson = <T>(js: string): T => {
    try { return parseEval<T>(ab("eval", js)); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg.replace(/^legibility:/, `${label}:`));
    }
  };
  return { ab, evalJson };
}
