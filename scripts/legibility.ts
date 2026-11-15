/**
 * npm run legibility: level 3 of the sign legibility guardrails (spec §4.3). Does not run in CI (it needs a browser).
 *
 * Starts its own vite on port 5179, opens every context exhibit of the storybook in agent-browser (session
 * "legibility", viewport 1600x900 @2) at the laptop and phone cover scales with bloom on, reads the stage pixels
 * through `window.__lab`, measures contrast, halo and OCR on them and writes REPORT.md plus the crops into
 * docs/superpowers/specs/assets/carteles-legibilidad/.
 *
 * OCR preprocess, the same for every sign (English rendering of PREPROCESS): WCAG relative luminance per pixel,
 * x3 nearest-neighbour upscaling and a binary threshold at the midpoint between the core median and the ring
 * median; the ink (the core side) ends up black on white. tesseract.js with the local `eng` 4.0.0_best_int data
 * (scripts/tessdata), page segmentation mode single word (PSM 8, SINGLE_WORD) and the whitelist A-Z a-z.
 *
 * Usage: npm run legibility [-- --only <context id>]. Exit code 1 when any row is a failure or level 2 lists a violation.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWorker, OEM, PSM } from "tesseract.js";
import { COVER_LAPTOP, COVER_PHONE, checkSign } from "../src/kit/legibility";
import { contextScene } from "../src/lab/crop";
import { EXHIBITS } from "../src/lab/exhibits";
import type { Fit } from "../src/world/frame";
import { assembleWorld } from "../src/world/assemble";
import { encodePng } from "./png";
import {
  measure, ocrImage, OCR_WHITELIST, parseEval, pickContexts, renderReport, reportFails, RES, scaleTag, signMasks, verdicts, wordCrop,
  type ReportEntry,
} from "./legibility-measure";

const PORT = 5179, ORIGIN = `http://localhost:${PORT}`, ROOT = resolve(import.meta.dirname, ".."), OUT = resolve(ROOT, "docs/superpowers/specs/assets/carteles-legibilidad");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ab = (...args: string[]): string =>
  execFileSync("agent-browser", args, { env: { ...process.env, AGENT_BROWSER_SESSION: "legibility" }, maxBuffer: 64 * 1024 * 1024, timeout: 30_000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const evalJson = <T>(js: string): T => parseEval<T>(ab("eval", js));

async function startVite(): Promise<ChildProcess> {
  const child = spawn(process.execPath, [resolve(ROOT, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let err = "", exited = false;
  child.stderr.on("data", (d) => { err += d; });
  child.stdout.resume();
  child.on("exit", () => { exited = true; });
  for (const t0 = Date.now(); Date.now() - t0 < 30_000; await sleep(250)) {
    if (exited) throw new Error(`legibility: vite exited early: ${err.trim()}`);
    try { if ((await fetch(`${ORIGIN}/lab/storybook.html`)).status === 200) return child; } catch { /* not up yet */ }
  }
  child.kill();
  throw new Error("legibility: vite did not answer in 30 s");
}

async function main(): Promise<void> {
  const picked = pickContexts(EXHIBITS, process.argv.slice(2));
  try { ab("--version"); } catch { throw new Error("legibility: agent-browser not found on PATH"); }
  let vite: ChildProcess | null = null, worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    vite = await startVite();
    ab("set", "viewport", "1600", "900", "2");
    worker = await createWorker("eng", OEM.LSTM_ONLY, { langPath: resolve(ROOT, "scripts/tessdata"), gzip: true, cacheMethod: "none" });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: OCR_WHITELIST });
    mkdirSync(OUT, { recursive: true });
    const { scene } = assembleWorld(undefined, { reducedMotion: false });
    const entries: ReportEntry[] = [], violations: { id: string; scale: number; list: ReturnType<typeof checkSign> }[] = [];
    for (const e of picked) {
      ab("open", `${ORIGIN}/lab/storybook.html?bloom=on&speed=0#${e.id}`);
      let ready = false, last = "";
      for (const t0 = Date.now(); Date.now() - t0 < 30_000 && !ready; ) {
        try { ready = evalJson<boolean>(`window.__lab?.exhibitId === '${e.id}' && window.__lab.bloom === 'on'`); } catch (err) { last = String(err).split("\n")[0]!; } // page not ready
        if (!ready) await sleep(500);
      }
      if (!ready) throw new Error(`legibility: window.__lab did not appear for ${e.id} in 30 s${last ? ` (last error: ${last})` : ""}`);
      for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
        evalJson(`(window.__lab.setCoverScale(${scale}), true)`);
        const fit = evalJson<Fit | null>("window.__lab.fit()"), host = evalJson<{ w: number; h: number }>("window.__lab.hostSize()");
        if (!fit) throw new Error(`legibility: no fit for ${e.id}`);
        const crop = wordCrop(e.sign, fit, host), masks = signMasks(e.sign, fit, crop);
        const b64 = evalJson<string>(`window.__lab.pixels(${crop.x}, ${crop.y}, ${crop.w}, ${crop.h})`);
        const px = Buffer.from(b64, "base64"), w = crop.w * RES, h = crop.h * RES;
        if (px.length !== w * h * 4) throw new Error(`legibility: ${e.id} at ${scale}: got ${px.length} bytes, expected ${w * h * 4}`);
        const m = measure(px, masks), img = ocrImage(px, w, h, m.core, m.ring);
        const ocrPng = encodePng(img.data, img.w, img.h), rawPng = encodePng(px, w, h);
        const text = (await worker.recognize(ocrPng)).data.text;
        const tag = `${e.id}-${scaleTag(scale)}`;
        writeFileSync(resolve(OUT, `${tag}.png`), rawPng);
        writeFileSync(resolve(OUT, `${tag}-ocr.png`), ocrPng);
        const rows = verdicts(m, text, e.sign.text, scale);
        entries.push({ id: e.id, text: e.sign.text, scale, rows, crop: `${tag}.png`, ocrCrop: `${tag}-ocr.png` });
        violations.push({ id: e.id, scale, list: checkSign(e.sign, scale, contextScene(scene, e).solids) });
        console.log(`${e.id} at ${scale}: ${rows.map((r) => `${r.metric} ${r.value} ${r.ok ? "ok" : "FAIL"}`).join(", ")}`);
      }
    }
    const report = { date: new Date().toISOString().slice(0, 10), viewport: "1600×900 @2", entries, violations };
    writeFileSync(resolve(OUT, "REPORT.md"), renderReport(report));
    process.exitCode = reportFails(report) ? 1 : 0;
  } finally {
    await worker?.terminate().catch(() => {});
    try { ab("close"); } catch { /* the session may never have opened */ }
    vite?.kill();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg.startsWith("legibility:") ? msg : `legibility: ${msg}`);
  process.exitCode = 1;
});
