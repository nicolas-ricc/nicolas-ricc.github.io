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
2. **DOM library: `happy-dom`** (`npm i -D happy-dom@^21`), the lighter of the two environments Vitest supports out of the box. Only the new test file opts in; the rest of the suite stays in `node`.
3. **The test mounts only the host.** It parses the page with `DOMParser`, imports `#lab-host` into `document.body` (so no `<script type="module">` runs) and checks `getAttribute("tabindex") === "0"`, `tabIndex === 0`, `focus()` making it `document.activeElement`, and the exact `aria-keyshortcuts` string.
4. **Listeners on `window` are pinned** by a source test in the same file: both scripts contain `window.addEventListener("keydown"` and neither contains `host.addEventListener(`.
5. **No focus-ring styling.** The browser's default focus indicator is kept: hiding it would hurt keyboard users, and the issue does not ask for a style.

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
  it("keydown listeners stay on window", () => {
    for (const f of ["src/lab/page.ts", "src/lab/storybook.ts"]) {
      const src = readFileSync(`${ROOT}${f}`, "utf8");
      expect(src, f).toContain('window.addEventListener("keydown"');
      expect(src, f).not.toContain("host.addEventListener(");
    }
  });
});
```

`mountHost` reads `lab/<page>.html`, parses it with `new DOMParser().parseFromString(html, "text/html")`, and `document.body.replaceChildren(document.importNode(host, true))`, returning the imported node. (Writing the storybook entry now is fine: its two cases fail until Task 2.)

- [ ] **Step 3: Run to verify it fails** — `npx vitest run src/lab/host-keyboard.test.ts`. Expected: the world-page cases FAIL (`tabindex` is `null`), the window-listener case PASSES.
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
