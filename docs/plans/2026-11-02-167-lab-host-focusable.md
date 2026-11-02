# Lab host keyboard-focusable (#167) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the `#lab-host` element (`role="application"`) of the five lab pages is reachable by keyboard focus (`tabindex="0"`) and declares its keys in `aria-keyshortcuts`, checked by a DOM test.

**Architecture:** static attributes on the `<div id="lab-host">` of each `lab/*.html`. The `keydown` listeners stay on `window` (`src/lab/page.ts`, `src/lab/storybook.ts`): a keydown on the focused host bubbles to `window`, so nothing changes in the scripts. A new Vitest file runs under `happy-dom` (new devDependency), parses each page, mounts its host into the document, focuses it and reads the attributes.

**Tech Stack:** TypeScript strict, Vitest 5 (`environment: "node"` by default; the new file opts into `happy-dom` with a `// @vitest-environment happy-dom` docblock), Vite, agent-browser for the browser check.

**Spec:** issue #167 and the owner's decision comment of 2026-11-01: "`#lab-host` gets `tabindex="0"` and `aria-keyshortcuts` with the keys; listeners stay on `window`. Verified with a DOM test. New code, comments and test messages in English (see #194)."

## Global Constraints

- `tabindex="0"` exactly (never positive: it would jump the tab order).
- `aria-keyshortcuts` is a space-separated list of `KeyboardEvent.key` values, the keys each page's `window` `keydown` listener actually handles.
- Listeners stay on `window`; `src/lab/page.ts` and `src/lab/storybook.ts` are not changed.
- The existing `role="application"` and `aria-label` stay on the same element (`src/lab/host.test.ts`, #103, keeps passing untouched). The Spanish `aria-label` text is visitor-facing copy and is not translated here.
- New test names, comments and messages in English (#194). Commits `<type>(#167): ...`.
- `npm test` and `npm run typecheck` green.
- Pipeline evals stage: Task 1 Steps 1–2 (the `happy-dom` install and the whole test file) are done and committed together as `test(#167): evals` before implementation. Implementers start at Task 1 Step 3; Task 1's commit then holds only the four HTML files.

## Technical decisions (declared)

1. **Key lists, from the listeners.**
   - World pages (`world`, `blog`, `resume`, `portfolio`) all boot through `bootWorldPage` (`src/lab/page.ts`), whose listener handles `KEY_ZONE` keys `0`..`4`, `5` (focus/veil) and `6` (bloom): `aria-keyshortcuts="0 1 2 3 4 5 6"`. This holds for `portfolio.html` too, even though its `aria-label` names no keys, and for `world`/`resume`, whose labels say `0..3`: the attribute lists what the code handles; the label copy is not touched.
   - Storybook (`src/lab/storybook.ts`): `NEXT` = `ArrowRight ArrowDown j`, `PREV` = `ArrowLeft ArrowUp k`, `LAYER_KEY` = `g h a`, and `6`: `aria-keyshortcuts="ArrowRight ArrowDown ArrowLeft ArrowUp j k g h a 6"`.
2. **DOM library: `happy-dom`** (`npm i -D happy-dom@^21`), one of the two DOM environments Vitest supports by name. Only the new test file opts in; the rest of the suite stays in `node`.
3. **The test mounts only the host.** It parses the page with `DOMParser`, imports `#lab-host` into `document.body` (so no `<script type="module">` runs) and checks `getAttribute("tabindex") === "0"`, `tabIndex === 0`, `focus()` making it `document.activeElement`, and the exact `aria-keyshortcuts` string.
4. **Listeners on `window` are pinned** by a source test in the same file: both scripts contain `window.addEventListener("keydown"` and neither contains `host.addEventListener(`.
5. **No focus-ring styling.** The owner's decision does not cover CSS. The default outline of a full-viewport host is likely clipped at the viewport edge; that is follow-up #303, not this issue.
6. **Page inventory pinned.** The test asserts the `.html` files in `lab/` are exactly the keys of `SHORTCUTS`, so a sixth lab page without the attributes fails the suite.

## Review Focus

1. A key that the listener handles but the attribute omits (or vice versa) — pinned by the exact-string assertions per page in Task 1/Task 2.
2. A keydown while the host has focus must still reach the `window` listener (bubbling) — browser script `.scratch/evals-167.md` (focus host, press `1` on world, `ArrowRight` on storybook).
3. `tabindex` positive or on another element (e.g. the canvas) — test asserts `"0"` on `#lab-host` itself.
4. `role`/`aria-label` lost while editing the tag — `src/lab/host.test.ts` stays green.
5. Clicking the canvas should leave focus on the host (nearest focusable ancestor), so keys keep working after a click — browser script.

---

### Task 1: world pages focusable, with their shortcuts

**Files:**
- Modify: `package.json`, `package-lock.json` (devDependency `happy-dom`, evals stage)
- Modify: `lab/world.html`, `lab/blog.html`, `lab/resume.html`, `lab/portfolio.html` (the `<div id="lab-host" …>` line)
- Create: `src/lab/host-keyboard.test.ts`

**Interfaces:**
- Produces: `src/lab/host-keyboard.test.ts` with a `SHORTCUTS: Record<string, string>` table keyed by page name and a `mountHost(page: string): HTMLElement` helper; Task 2 adds the `storybook` entry.

- [ ] **Step 1: Install** `npm i -D happy-dom@^21`.
- [ ] **Step 2: Write the failing test** — `src/lab/host-keyboard.test.ts`, first line `// @vitest-environment happy-dom`:

```ts
const WORLD_KEYS = "0 1 2 3 4 5 6";
const SHORTCUTS: Record<string, string> = {
  world: WORLD_KEYS, blog: WORLD_KEYS, resume: WORLD_KEYS, portfolio: WORLD_KEYS,
  storybook: "ArrowRight ArrowDown ArrowLeft ArrowUp j k g h a 6",
};

describe("lab host keyboard access (#167)", () => {
  for (const [page, keys] of Object.entries(SHORTCUTS)) {
    it(`lab/${page}.html: #lab-host is in the tab order and takes focus`, () => {
      const host = mountHost(page);
      expect(host.getAttribute("tabindex")).toBe("0");
      expect(host.tabIndex).toBe(0);
      host.focus();
      expect(document.activeElement).toBe(host);
    });
    it(`lab/${page}.html: aria-keyshortcuts lists the keys its listener handles`, () => {
      expect(mountHost(page).getAttribute("aria-keyshortcuts")).toBe(keys);
    });
  }
  it("covers every page in lab/", () => {
    expect(readdirSync(`${ROOT}lab`).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5)).sort()).toEqual(Object.keys(SHORTCUTS).sort());
  });
  it("keydown listeners stay on window", () => {
    for (const f of ["src/lab/page.ts", "src/lab/storybook.ts"]) {
      const targets = [...readFileSync(`${ROOT}${f}`, "utf8").matchAll(/(\w+)\.addEventListener\(\s*["']key\w+["']/g)].map((m) => m[1]);
      expect(targets, f).toEqual(["window"]);
    }
  });
});
```

`ROOT` is `${resolve(import.meta.dirname, "../..")}/`: under happy-dom `import.meta.url` is a `/@fs/` URL, so the `new URL(…, import.meta.url).pathname` of `src/lab/host.test.ts` does not work here. `mountHost(page: string): HTMLElement` reads `lab/<page>.html`, parses it with `new DOMParser().parseFromString(html, "text/html")`, and `document.body.replaceChildren(document.importNode(host, true))`, returning the imported node; a missing host throws (`Error(`lab/${page}.html has no #lab-host`)`), which also narrows the `getElementById` result under `strict`. (Writing the storybook entry now is fine: its two cases fail until Task 2.)

- [ ] **Step 3: Run to verify it fails** — `npx vitest run src/lab/host-keyboard.test.ts`. Expected: the tabindex and shortcut cases FAIL for every page; the inventory and window-listener cases PASS.
- [ ] **Step 4: Implement** — in the four world HTML files, `<div id="lab-host" role="application"` becomes `<div id="lab-host" role="application" tabindex="0" aria-keyshortcuts="0 1 2 3 4 5 6"`, rest of the tag unchanged.
- [ ] **Step 5: Run to verify it passes** — `npx vitest run src/lab/host-keyboard.test.ts src/lab/host.test.ts src/lab/page.test.ts`. Expected: everything PASSES except the two storybook cases.
- [ ] **Step 6: Commit** — `git add lab/world.html lab/blog.html lab/resume.html lab/portfolio.html && git commit -m "fix(#167): focusable lab host with aria-keyshortcuts on the world pages"`.

### Task 2: storybook host focusable, with its shortcuts

**Files:**
- Modify: `lab/storybook.html` (the `<div id="lab-host" …>` line)

**Interfaces:**
- Consumes: `src/lab/host-keyboard.test.ts` from Task 1 (the `storybook` entry is already in `SHORTCUTS`).

- [ ] **Step 1: Run to verify it fails** — `npx vitest run src/lab/host-keyboard.test.ts -t storybook`. Expected: 2 FAIL.
- [ ] **Step 2: Implement** — `tabindex="0" aria-keyshortcuts="ArrowRight ArrowDown ArrowLeft ArrowUp j k g h a 6"` after `role="application"` on the storybook host.
- [ ] **Step 3: Run the full suite and typecheck** — `npm test && npm run typecheck`. Expected: all PASS.
- [ ] **Step 4: Commit** — `git add lab/storybook.html && git commit -m "fix(#167): focusable storybook host with aria-keyshortcuts"`.

## Assumptions

- **happy-dom over jsdom.** Either satisfies "a DOM test"; happy-dom 21 was checked to reflect `tabIndex` (`0` with `tabindex="0"`, `-1` without), `DOMParser` + `importNode` + `focus()` set `document.activeElement`, and removing the node resets it to `<body>`. happy-dom also lets `focus()` land on a `<div>` *without* `tabindex`, so the discriminating assertions are `getAttribute("tabindex")` and `tabIndex`; the `activeElement` check only proves the mounted node is live.
- **A second test file** instead of extending `src/lab/host.test.ts`: that file runs in `node`; the owner asked for a DOM test, and opting a single new file into `happy-dom` keeps the rest of the suite in `node`.
- **`aria-keyshortcuts` lists every handled key**, even where a key frames a region that a page does not draw (e.g. `2`/`3` on `portfolio`): `zoneFrame` frames fixed world boxes (`src/world/frame.ts:24-32`) and the listener (`src/lab/page.ts:76-80`) runs them on every page, ungated (only the log is behind `import.meta.env.DEV`).
- **Focus after a click.** No lab or world code installs pointer handlers or calls `preventDefault` on pointer/mouse events (grep of `src/lab`, `src/world`); Pixi's `EventSystem._onPointerDown` only calls `preventDefault` on *normalized* (non-PointerEvent) input. The browser script checks it.
- **Browser evidence** for Review Focus 2 and 5 comes from the pipeline's stage 4, which runs `.scratch/evals-167.md` (untracked by design) against the dev server; its result goes into the PR description.
- **`fix` commit type**, as #103's a11y change (`e2fe6b6 fix(#103): lab host role …`): the issue reports a defect ("no es enfocable").

## Grilling

- Rounds: 2. Questions: 14 + 16 = 30.
- Sources: CODE 21 (`src/lab/page.ts:74-80`, `src/lab/storybook.ts:128-135`, `src/lab/host.test.ts:9-14`, `src/lab/page.test.ts:36`, `src/world/frame.ts:24-32`, `tsconfig.json`, `ls lab/`, `grep keydown src` → only `page.ts:76`, `storybook.ts:129` and the site's `src/main.ts:140`, which no lab page loads, `node_modules/vitest/package.json` peer `happy-dom: "*"`, Pixi `EventSystem._onPointerDown`, `git log`); ISSUE 3 (owner's decision comment); DOC 1 (`.factory/config.toml` commands); NO SOURCE 5.
- Technical assumptions: see `## Assumptions` (happy-dom, separate test file, every handled key listed, focus after click, browser evidence in stage 4, `fix` type, `mountHost` throws on a missing host).
- Out of scope, issues opened: #302 (the `aria-label` copy does not match the handled keys), #303 (focus ring of the full-viewport host clipped at the viewport edge). Round 1 had added a CSS focus-ring change; round 2 found no source for it, so it was removed from the plan and became #303.
- No spec ambiguity: status `ok`.
