/**
 * npm run wreck-sweep: pixel oracle for the faint vertical line in the storybook Wreck exhibit `#pecio` (#404). Does not run in CI (it needs a browser).
 *
 * Starts its own vite on port 5180 (unless --origin points at another server, e.g. a git worktree of origin/main), opens
 * `/lab/storybook.html?speed=0&bloom=<mode>#pecio` in agent-browser (session "wreck-sweep") per viewport (@2) and bloom
 * mode, advances the clock 250 ms per frame, reads the whole host through `window.__lab.pixels` and counts the pixels
 * that are not ISO_COLORS.sky outside the envelope of the drawn frame, or above its ceiling (2 px over the higher of the
 * north vertex and the solid tops). The envelope is computed in Node from contentFrame of the cropped pecio scene, or
 * boxFrame, whichever reproduces the page's `fit()`.
 *
 * Usage: npm run wreck-sweep [-- --frames 40 --modes off,on,fallback --viewports 900x1015,412x915 --origin <url> --hide 3,4].
 * --hide sets `visible = false` on those children of the Stage container (slot order: src/world/stage.ts buildStage) to bisect
 * which layer draws the line (with bloom on, `bloomSlot` is inserted right below `accentSlot`, which moves up one index); it needs the PixiJS DevTools extension (see CLAUDE.md), loaded on launch when installed.
 * `off-sky px` is summed over the frames (pixel-frames). Exit code 0 when clean, 1 when any row has off-sky pixels, 2 on a crash.
 *
 * Notes: `pixels` re-renders the stage through extract, so compositor artifacts are not seen. Where the page has no
 * `__lab.tick` (main) the clock is "live" (`?speed=20`, 250 ms sleeps): those frames are not comparable one by one.
 */
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { cropAnimators, cropScene } from "../src/lab/crop";
import { EXHIBITS } from "../src/lab/exhibits";
import { contentFrame } from "../src/lab/frame";
import { assembleWorld } from "../src/world/assemble";
import { boxFrame, type Fit } from "../src/world/frame";
import { agentBrowser, sleep, startVite } from "./lab-browser";
import { envelopeOf, formatSweepRow, offSky, parseSweepArgs, pickFrame, toScreen } from "./wreck-sweep-measure";

const PORT = 5180, EXT = resolve(homedir(), ".agent-browser/extensions/pixijs-devtools/ext");
const { ab, evalJson } = agentBrowser("wreck-sweep", "wreck-sweep");

/** Launches the browser before any `set viewport` (a running daemon ignores --extension/--args); loads the DevTools extension when installed. */
function launch(needExt: boolean): void {
  try { ab("close"); } catch { /* no session yet */ }
  if (existsSync(EXT)) ab("--extension", EXT, "--args", "--headless=new", "open", "about:blank");
  else if (needExt) throw new Error(`wreck-sweep: --hide needs the PixiJS DevTools extension at ${EXT} (see CLAUDE.md)`);
  else ab("open", "about:blank");
}

async function ready(mode: string): Promise<void> {
  let last = "";
  for (const t0 = Date.now(); Date.now() - t0 < 60_000; await sleep(500)) {
    try { if (evalJson<boolean>(`window.__lab?.exhibitId === 'pecio' && window.__lab.bloom === '${mode}'`)) return; } catch (err) { last = String(err).split("\n")[0]!; } // page not ready
  }
  throw new Error(`wreck-sweep: window.__lab did not appear for pecio in ${mode} in 60 s${last ? ` (last error: ${last})` : ""}`);
}

function hide(indices: readonly number[]): void {
  if (!indices.length) return;
  const ok = evalJson<boolean>(`(() => { const w = window.__PIXI_DEVTOOLS_WRAPPER__; const c = w?.stage?.children?.[0]?.children;
    if (!c) return false; for (const i of ${JSON.stringify(indices)}) { if (!c[i]) return false; c[i].visible = false; } return true; })()`);
  if (!ok) throw new Error("wreck-sweep: --hide failed: window.__PIXI_DEVTOOLS_WRAPPER__ is missing (the DevTools extension did not hook) or a slot index is out of range");
}

async function main(): Promise<void> {
  const args = parseSweepArgs(process.argv.slice(2));
  try { ab("--version"); } catch { throw new Error("wreck-sweep: agent-browser not found on PATH"); }
  const e = EXHIBITS.find((x) => x.id === "pecio");
  if (!e || e.kind !== "region" || e.h === undefined) throw new Error("wreck-sweep: pecio is not a region exhibit with a height");
  const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
  // contentFrame ticks the animators 8 s: computed once
  const candidates = [
    { name: "content", items: contentFrame(cropScene(scene, e.box), cropAnimators(animators, e.box), { box: e.box, h: e.h, clip: e.box }) },
    { name: "box", items: boxFrame(e.box, e.h) },
  ];
  const origin = args.origin ?? `http://localhost:${PORT}`;
  let vite: ChildProcess | null = null, dirty = false;
  try {
    if (!args.origin) vite = await startVite(PORT, "wreck-sweep");
    launch(args.hide.length > 0);
    for (const [vw, vh] of args.viewports) {
      ab("set", "viewport", String(vw), String(vh), "2");
      const viewport = `${vw}x${vh}`;
      let envLine = false;
      for (const mode of args.modes) {
        const url = (speed: number) => `${origin}/lab/storybook.html?speed=${speed}&bloom=${mode}#pecio`;
        ab("open", url(0));
        await ready(mode);
        let clock: "tick" | "live" = "tick";
        if (!evalJson<boolean>("typeof window.__lab.tick === 'function'")) { clock = "live"; ab("open", url(20)); await ready(mode); }
        const lay = evalJson<number[]>("[innerWidth, innerHeight, devicePixelRatio]");
        if (lay[0] !== vw || lay[1] !== vh || lay[2] !== 2) throw new Error(`wreck-sweep: viewport is ${lay[0]}x${lay[1]}@${lay[2]}, expected ${vw}x${vh}@2`);
        hide(args.hide);
        const fit = evalJson<Fit | null>("window.__lab.fit()"), host = evalJson<{ w: number; h: number }>("window.__lab.hostSize()");
        if (!fit) throw new Error(`wreck-sweep: no fit for pecio at ${viewport}`);
        const picked = pickFrame(candidates, fit, host);
        if (!picked) throw new Error(`wreck-sweep: no candidate frame reproduces the page fit (${JSON.stringify(fit)}, host ${host.w}x${host.h}) at ${viewport}`);
        const env = envelopeOf(picked.items, fit, e.box);
        if (!envLine) { console.log(`${viewport} envelope ${JSON.stringify(env)} fit ${JSON.stringify(fit)} host ${host.w}x${host.h}`); envLine = true; }
        let count = 0, first: { x: number; y: number } | null = null, firstFrame = -1;
        for (let k = 0; k < args.frames; k++) {
          if (clock === "tick") evalJson("(window.__lab.tick(250), true)"); else await sleep(250);
          const px = Buffer.from(evalJson<string>(`window.__lab.pixels(0, 0, ${host.w}, ${host.h})`), "base64");
          const r = offSky(px, host, 2, env);
          count += r.count;
          if (r.first && !first) { first = r.first; firstFrame = k; }
        }
        console.log(formatSweepRow({ viewport, mode, clock, frame: picked.name, frames: args.frames, count, first }));
        if (first) { const s = toScreen(first, fit); console.log(`  first offender at frame ${firstFrame}, world screen (${s.x.toFixed(2)}, ${s.y.toFixed(2)})`); }
        if (count > 0) dirty = true;
      }
    }
    process.exitCode = dirty ? 1 : 0;
  } finally {
    try { ab("close"); } catch { /* the session may never have opened */ }
    vite?.kill();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg.startsWith("wreck-sweep:") ? msg : `wreck-sweep: ${msg}`);
  process.exitCode = 2;
});
