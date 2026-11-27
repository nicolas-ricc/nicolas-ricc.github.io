# #499 Icons instead of the «Volver al mapa» and «Centrar vista» texts — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The two text controls over the map canvas, `#back` («← Volver al mapa», top-left) and `#recentrar` («Centrar vista», top-right), show an inline SVG icon instead of visible text. Their accessible name, ids, position, initial `hidden`, focus ring and JS behaviour stay the same.

**Architecture:** Markup only in `index.html` (an inline `<svg>` replaces the text node, the text moves to `aria-label` and `title`). Styles in `src/style.css`: both controls become a ≥ 32×32 px box that centres a 22 px icon drawn in `currentColor`, with `filter: drop-shadow(0 1px 2px #000)` in place of the text shadow. `src/main.ts` is not touched. The tests are string checks over `index.html` and `src/style.css` in `src/site-shell.test.ts`, like the rest of that file.

**Tech Stack:** HTML, CSS, TypeScript, vitest, agent-browser (screenshots).

**Spec:** issue #499 (binding).

## Global Constraints

- Icons are **inline SVG** in `index.html`, `fill`/`stroke` in `currentColor`. No new dependency, no icon font.
- `#back`: `aria-label="Volver al mapa"` and `title="Volver al mapa"`. `#recentrar`: `aria-label="Centrar vista"` and `title="Centrar vista"`. Each `<svg>` carries `aria-hidden="true"` and `focusable="false"`.
- Do not change: the ids, `inset` (`#hud`: `1rem auto auto 1rem`; `#recentrar`: `1rem 1rem auto auto`), `z-index: 2`, the initial `hidden` (`#hud hidden`, `#recentrar hidden`), `#recentrar:focus-visible` (`outline: 2px solid var(--fg); outline-offset: 2px`), `href="/"` on `#back`, and `src/main.ts`.
- The same look for both: icon 22 px (`width="22" height="22"`), `color: var(--fg)`, `filter: drop-shadow(0 1px 2px #000)`, touch area at least 32×32 px (`min-width: 2rem; min-height: 2rem`).
- `.no-canvas #hud` and `.no-canvas #recentrar` stay `display: none`.
- Only hex colour in the new CSS is `#000`, already in `STYLE_CSS_ALLOWLIST` (`src/map/palette-guard.test.ts`).
- Code comments and test names in English (`src/english.test.ts`). `npm test` and `npm run typecheck` green.

## Decisions (declared)

- **D1. Icons.** Back: a left arrow, 24×24 viewBox, `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, paths `M19 12H5` and `M12 19l-7-7 7-7`. Recenter: a crosshair in the same style: `<circle cx="12" cy="12" r="7"/>` plus the four ticks `M12 2v4`, `M12 18v4`, `M2 12h4`, `M18 12h4`, and a centre dot `<circle cx="12" cy="12" r="1.5" fill="currentColor"/>`.
- **D2. The `hidden` guard.** The 32×32 box centres the icon with `display: inline-flex`. An author `display` beats the UA `[hidden] { display: none }`, which would show the button on load. So the plan adds an explicit `#recentrar[hidden] { display: none; }`. `#hud` keeps its own `hidden`. Nothing sets `display` on `#hud`, only on `#hud a`, so `#hud` needs no guard.
- **D3. `#hud`'s `text-shadow` stays.** It is part of the `#hud` rule (position, z-index) and does nothing to an SVG. The icon's shadow is the `filter` on `#hud a` and on `#recentrar`. `#recentrar` drops `text-shadow`, `font-size` and the `0.25rem 0` padding, which only served the text.
- **D4. No focus ring is added to `#back`.** Today it has no `:focus-visible` rule and uses the browser's ring. "No cambiar … el focus ring" means it stays that way.

## Review Focus

1. The recenter button showing on load because the new `display` overrides `hidden`. Pinned by `#recentrar[hidden]` → `display: none` (Task 1).
2. Leftover visible text (the «←» arrow, a space-padded label) next to the icon. Pinned by "no text outside the svg" in the markup tests (Tasks 1 and 2).
3. A screen reader reading the SVG or the SVG taking focus. Pinned by `aria-hidden="true" focusable="false"` (Tasks 1 and 2).
4. A touch target smaller than 32 px on a narrow viewport. Pinned by `min-width: 2rem` / `min-height: 2rem` (Tasks 1 and 2) and the narrow screenshot (stage 3 script).
5. The icon losing its colour in forced-colours / high-contrast mode. Avoided by `currentColor` only: pinned by "no fill/stroke other than currentColor or none" (Tasks 1 and 2).

## Acceptance criteria → tasks

| Criterion (issue #499) | Where |
|---|---|
| No visible text, each shows its icon | Tasks 1, 2 (markup tests) + browser script |
| `aria-label` and `title` with the names | Tasks 1, 2 |
| Click and keyboard (Enter/Space, visible focus) as before | browser script (`src/main.ts` untouched) |
| `site-shell.test.ts`: recenter test checks `aria-label` + SVG; equivalent test for `#back` | Tasks 1, 2 |
| Tests and typecheck green | Task 2, last step |
| Desktop and narrow screenshots in the PR | browser script, attached to the PR |

The browser script is not a task of this plan. The pipeline's stage 3 writes it to `.scratch/evals-499.md` (git-excluded), and stage 4 runs it against `npm run dev -- --host --port 5173` once both tasks are in. Desktop is 1600×900 and narrow is 390×750. The controls are shown without touching `main.ts`: `#hud` by opening a zone (`/area/resume/`, which `src/views.ts:20` unhides), and `#recentrar` by pressing an arrow key on the focused `#canvas-host` (`src/main.ts:86-90`, `syncMoved`).

## Shared test helper

In `src/site-shell.test.ts`, next to `block`:

```ts
/** The markup from the opening tag that starts with `open` to its closing `</tag>`. */
function element(html: string, open: string, tag: string): string
```

It takes the first occurrence of `open` and slices up to the first `</tag>` after it (the two controls are not nested in an element of their own tag, so the first close is theirs). It asserts `open` is present with ``expect(at, `missing element ${open}`).toBeGreaterThanOrEqual(0)``, the same way `block` does (`src/site-shell.test.ts:11-15`). Task 1 adds it. Task 2 reuses it.

## English guard

`src/english.test.ts` scans every `src/**/*.ts` and `.css` file (not `index.html`, `src/english.test.ts:85-86`), and `al` is one of its Spanish `WORDS`. The visitor-facing labels in the shell test are allowlisted the way the map host's label already is (`src/english.test.ts:42-43`). Task 1 extends that entry to `[/Mapa: arrastrá o usá las flechas para recorrerlo/g, /Centrar vista/g, /Volver al mapa/g]`. The test *names* stay English ("named by its aria-label") and never quote the labels.

---

### Task 1: the recenter button shows a crosshair

**Files:**
- Modify: `index.html:18`
- Modify: `src/style.css:42-44`
- Test: `src/site-shell.test.ts` (block "site shell: navigable map (#438)")

**Interfaces:**
- Produces: `element(html, open, tag)` in `src/site-shell.test.ts`.

- [ ] **Step 1: Write the failing tests.** Replace "the recenter button starts hidden inside the host" with:

```ts
it("the recenter button starts hidden inside the host and is an icon named by its aria-label", () => {
  const open = `<button id="recentrar" type="button" aria-label="Centrar vista" title="Centrar vista" hidden>`;
  const btn = HTML.indexOf(open);
  expect(btn).toBeGreaterThan(HTML.indexOf(`id="canvas-host"`));
  expect(btn).toBeLessThan(HTML.indexOf(`<main id="content"`));
  const el = element(HTML, open, "button");
  expect(el).toMatch(/<svg [^>]*aria-hidden="true"[^>]*focusable="false"/);
  expect(el.replace(/<svg[\s\S]*<\/svg>/, "").replace(/<[^>]+>/g, "").trim()).toBe("");
  for (const m of el.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(["currentColor", "none"]).toContain(m[1]);
});
```

and add to "style.css puts the button in the top-right corner with a focus ring":

```ts
for (const d of ["color: var(--fg)", "filter: drop-shadow(0 1px 2px #000)", "min-width: 2rem", "min-height: 2rem"]) expect(b).toContain(d);
expect(block(CSS, "#recentrar[hidden]")).toContain("display: none");
```

- [ ] **Step 2: Run and see them fail.** `npx vitest run src/site-shell.test.ts`. Expected: FAIL, `missing element <button id="recentrar" …` and `missing rule #recentrar[hidden]`.

- [ ] **Step 3: Implement.** In `index.html`, the button gets `aria-label="Centrar vista" title="Centrar vista"` before `hidden`, and its content becomes the D1 crosshair `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false" …>`. In `src/style.css`, the `#recentrar` rule keeps `position`, `inset`, `z-index`, `color`, `background: none`, `border: 0`, `cursor: pointer`, and replaces `font`, `font-size`, `text-shadow` and `padding` with `display: inline-flex; align-items: center; justify-content: center; min-width: 2rem; min-height: 2rem; padding: 0; filter: drop-shadow(0 1px 2px #000);`. Add `#recentrar[hidden] { display: none; }` right after it. Update the comment above to say it is an icon button like `#back`. In `src/english.test.ts`, extend the `"src/site-shell.test.ts"` entry of `ALLOW` as in "English guard" above.

- [ ] **Step 4: Run and see them pass.** `npx vitest run src/site-shell.test.ts src/map/palette-guard.test.ts src/english.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.** `git add index.html src/style.css src/site-shell.test.ts src/english.test.ts && git commit -m "feat(#499): recenter button as a crosshair icon"`

### Task 2: the back link shows a left arrow

**Files:**
- Modify: `index.html:16`
- Modify: `src/style.css:41`
- Test: `src/site-shell.test.ts` (block "site shell: navigable map (#438)")

**Interfaces:**
- Consumes: `element(html, open, tag)` from Task 1.

- [ ] **Step 1: Write the failing tests.** Add:

```ts
it("the back link is an icon named by its aria-label inside the hidden hud", () => {
  const open = `<a id="back" href="/" aria-label="Volver al mapa" title="Volver al mapa">`;
  expect(HTML.indexOf(open)).toBeGreaterThan(HTML.indexOf(`<div id="hud" hidden>`));
  const el = element(HTML, open, "a");
  expect(el).toMatch(/<svg [^>]*aria-hidden="true"[^>]*focusable="false"/);
  expect(el.replace(/<svg[\s\S]*<\/svg>/, "").replace(/<[^>]+>/g, "").trim()).toBe("");
  for (const m of el.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(["currentColor", "none"]).toContain(m[1]);
});

it("style.css gives the back link the same icon box as the button", () => {
  const b = block(CSS, "#hud a");
  for (const d of ["color: var(--fg)", "filter: drop-shadow(0 1px 2px #000)", "min-width: 2rem", "min-height: 2rem", "display: inline-flex"]) expect(b).toContain(d);
  for (const d of ["position: absolute", "inset: 1rem auto auto 1rem", "z-index: 2"]) expect(block(CSS, "#hud")).toContain(d);
  expect(block(CSS, ".no-canvas #canvas-host canvas, .no-canvas #hud, .no-canvas #titulo")).toContain("display: none");
});
```

- [ ] **Step 2: Run and see them fail.** `npx vitest run src/site-shell.test.ts`. Expected: FAIL, `missing element <a id="back" …` and the missing `filter` in `#hud a`.

- [ ] **Step 3: Implement.** In `index.html`, `<a id="back" href="/" aria-label="Volver al mapa" title="Volver al mapa">` with the D1 arrow `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false" …>` as its only content (the «←» and the text go). In `src/style.css`, `#hud a` keeps `color: var(--fg); text-decoration: none;` and replaces `font-size: 0.9rem` with `display: inline-flex; align-items: center; justify-content: center; min-width: 2rem; min-height: 2rem; filter: drop-shadow(0 1px 2px #000);`. `#hud` stays as it is (D3).

- [ ] **Step 4: Run and see them pass.** `npx vitest run src/site-shell.test.ts src/map/palette-guard.test.ts src/english.test.ts`. Expected: PASS.

- [ ] **Step 5: Full gate.** `npm test` and `npm run typecheck`. Expected: both green.

- [ ] **Step 6: Commit.** `git add index.html src/style.css src/site-shell.test.ts && git commit -m "feat(#499): back link as a left-arrow icon"`

## Assumptions

From the grilling. Each one is technical: any option satisfies the issue.

- **A1. `main.ts` and `views.ts` only toggle `hidden`.** `src/main.ts:89,101,110` set `recenter.hidden`, `src/main.ts:143,166` add the click listeners, and `src/views.ts:11,20` set `hud().hidden`. Nothing writes `textContent`, `innerHTML` or `style.display` on `#back`, `#hud` or `#recentrar` (`innerHTML` only on `#content`, `src/views.ts:18`). So the SVG survives and the D2 guard holds.
- **A2. Selectors quoted from `src/style.css` at `e5278c9`.** `#hud` is at line 40 (`position: absolute; inset: 1rem auto auto 1rem; z-index: 2; text-shadow: 0 1px 2px #000; cursor: default;`, no `display`). `#hud a` is at line 41. `#recentrar` is at line 43 and already has `color: var(--fg)`. `#recentrar:focus-visible` is at line 44. `.no-canvas #canvas-host canvas, .no-canvas #hud, .no-canvas #titulo` is at line 97, and `.no-canvas #recentrar` at line 98, already pinned by `site-shell.test.ts:97-99`. The line numbers in the tasks were taken on this branch's base, after #497, #498 and #500.
- **A3. No formatter or HTML validator.** `package.json` has no prettier, husky or lint-staged, and CI runs `npm ci`, `feed`, `typecheck`, `test`, `build` (`.github/workflows/deploy.yml:22-28`). Single-line attributes in the written order stay as written. `focusable="false"` is not checked by anything. It is kept because the issue requires it.
- **A4. `1rem` = 16 px.** `src/style.css` has no `html { font-size }` and sets `font: 16px/1.5` on `html, body` (line 8). `2rem` is 32 px. Rejected: `min-width: 32px`, which ignores the user's font scaling.
- **A5. Palette guard.** `#000` is in `STYLE_CSS_ALLOWLIST` (`src/map/palette-guard.test.ts:81`). The guard reads `src/style.css` only, so `currentColor` and `none` in `index.html` are outside it.
- **A6. Visibility of `#back`'s focus ring.** It is the browser default today, and the issue says not to change it. The stage-3 browser script tabs to it and screenshots it. If the ring cannot be seen, that goes in the PR as a finding. No ring is added.
- **A7. Intermediate state.** After Task 1, `#recentrar` is an icon and `#back` is still text. Both are valid sites with a green suite. Undoing Task 1 means reverting its single commit. Rejected: one combined task, because the two controls can be rejected separately.

## Grilling

- Rounds: 1. The revision added no task and no seam: it added the English-guard edit inside Task 1's steps and clarified sources.
- Questions: 14. Sources: CODE 11 (main.ts/views.ts, english.test.ts, style.css, palette-guard.test.ts, package.json/deploy.yml, site-shell.test.ts). The other 3 (Q2, Q13, Q14, about the browser script and task granularity) are answered from the pipeline's stage 3/4 definition and declared as technical assumptions A6 and A7.
- Finding that changed the plan: Q3. `al` in «Volver al mapa» trips `src/english.test.ts`. Fixed with the `ALLOW` entry and English test names.
- Spec ambiguities: none. Follow-up issues opened: none.
- Status: ok.
