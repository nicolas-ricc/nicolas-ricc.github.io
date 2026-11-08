# `aria-label` of the world lab pages names every key (#302): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the `aria-label` of `#lab-host` in `lab/world.html`, `lab/blog.html`, `lab/resume.html` and `lab/portfolio.html` keeps its own description and names, in English, every key `bootWorldPage` handles (0..6) and what each does.

**Architecture:** static text only. Each of the four labels becomes `<own description>. <WORLD_HELP>` (world keeps its `?bloom=` / `?speed=` sentences after it). A new test in the `SHORTCUTS` loop of `src/lab/host-keyboard.test.ts` checks, for the four world pages, that the label mentions each key of `WORLD_KEYS` and contains the shared help sentence.

**Tech Stack:** static HTML, Vitest with happy-dom.

**Spec:** issue #302 and its Agent Brief (triage comment).

## Global Constraints

- Criterion 1: the four labels name keys 0 to 6 with what each one does.
- Criterion 2: a test checks, for the four world pages, that the `aria-label` mentions each key of `WORLD_KEYS`, so they do not drift again.
- Criterion 3: `npm test` and `npm run typecheck` green.
- Labels in English, following the pattern of `lab/kit.html` and `lab/storybook.html` ("Key 6 rotates the bloom: off, on, fallback.").
- `world.html` keeps its `?bloom=` and `?speed=` sentences, verbatim.
- Out of scope: the keys or the listener (`src/lab/page.ts`), the labels of `kit.html` and `storybook.html`, the focus ring (#303), `aria-keyshortcuts`.
- Test names in English, like the rest of the file. Commits `test(#302): …` / `fix(#302): …`.

## Technical decisions (declared)

1. **The shared help text.** Exactly, as the four labels carry it:
   `Keys 0..4 frame world, Portfolio, Resume, Blog and cover. Key 5 rotates the focus/veil. Key 6 rotates the bloom: off, on, fallback.`
   It takes the existing wording of `world.html` ("Keys 0..3 frame world, Portfolio, Resume, Blog. Key 5 rotates the focus/veil. Key 6 …") and `blog.html` ("Keys 0..4 frame world, Portfolio, Resume, Blog and cover."), and matches `KEY_ZONE` (`"0": "all"`, `"1": "portfolio"`, `"2": "cv"`, `"3": "blog"`, `"4": "cover"`) and the `5` / `6` branches of the listener in `src/lab/page.ts`.
2. **The descriptions stay.** world: `Isometric world: shipyard, city and sea.`; blog: `Isometric Blog: the sea, the lighthouse and the ships sailing away; the whole world around.`; resume: `Isometric Resume: the office city and the shipyard.`; portfolio: `Isometric shipyard.` (today `Isometric shipyard` with no period; a period is added so the help text starts a new sentence).
3. **Final labels.**
   - world: `Isometric world: shipyard, city and sea. <HELP> ?bloom= forces it on load: on, off or fallback. ?speed= scales the animation clock up to 100; ?speed=0 freezes it.`
   - blog: `Isometric Blog: the sea, the lighthouse and the ships sailing away; the whole world around. <HELP>`
   - resume: `Isometric Resume: the office city and the shipyard. <HELP>`
   - portfolio: `Isometric shipyard. <HELP>`
4. **What "mentions a key" means in the test.** A helper `labelKeys(label: string): Set<string>` collects the keys the label names: every `a..b` digit range expands to `a`..`b` inclusive, and every `Key N` / `Keys N` names `N`. The test asserts that every key of `WORLD_KEYS.split(" ")` is in that set. A bare digit elsewhere (`100`, `?speed=0`) does not count, so world's `?speed=0` cannot pass for key 0.
5. **Pinning "what each does".** The same test asserts that the label contains `WORLD_HELP` verbatim (a `const` in the test file next to `WORLD_KEYS`). That is the drift guard for the meaning; `labelKeys` alone would pass a label that names a key with the wrong action.
6. **Which pages.** A separate `for (const page of WORLD_PAGES)` after the existing loop, with `WORLD_PAGES = Object.keys(SHORTCUTS).filter((p) => SHORTCUTS[p] === WORLD_KEYS)`. A fifth world page added to `SHORTCUTS` gets the test with no edit, and `kit` / `storybook` stay out.

## Review Focus

1. A label that names key 4 only inside a range written differently (`0-4`, `0 to 4`): `labelKeys` would not see it and the test fails; that is wanted, the format is fixed by decision 1.
2. `?speed=0` or `100` in world's label counting as keys 0 or 1: excluded by decision 4; Task 1 adds a test on `labelKeys` with world's `?speed=` sentence alone, expecting an empty set.
3. The listener gains a key 7 and `WORLD_KEYS` follows: the `aria-keyshortcuts` test already fails until the HTML follows; the new test then demands the label names 7 as well.
4. A label that lists the keys but swaps two actions: caught by the `WORLD_HELP` containment of decision 5.
5. `kit` / `storybook` caught by the new test: excluded by `WORLD_PAGES` (decision 6).

---

### Task 1: complete the four labels and test them

**Files:**
- Modify: `lab/world.html:16`, `lab/blog.html:16`, `lab/resume.html:16`, `lab/portfolio.html:16` (the `aria-label` attribute only)
- Test: `src/lab/host-keyboard.test.ts`

**Interfaces:**
- Consumes: `WORLD_KEYS`, `SHORTCUTS`, `mountHost` of the same file.
- Produces: `WORLD_HELP: string`, `WORLD_PAGES: string[]`, `labelKeys(label: string): Set<string>`, all local to the test file.

- [ ] **Step 1: write the failing tests** (in the evals stage). After the existing `for` over `SHORTCUTS`, inside the `describe`:
  ```ts
  for (const page of WORLD_PAGES) {
    it(`lab/${page}.html: aria-label names every key of the page and what it does (#302)`, () => {
      const label = mountHost(page).getAttribute("aria-label") ?? "";
      const named = labelKeys(label);
      for (const k of WORLD_KEYS.split(" ")) expect(named, `key ${k} in ${page}'s aria-label`).toContain(k);
      expect(label).toContain(WORLD_HELP);
    });
  }
  it("labelKeys reads ranges and Key/Keys, not bare digits (#302)", () => {
    expect([...labelKeys("Keys 0..4 frame. Key 5 rotates. Key 6 rotates.")].sort()).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    expect(labelKeys("?speed= scales the animation clock up to 100; ?speed=0 freezes it.").size).toBe(0);
  });
  ```
- [ ] **Step 2: run and see it fail.** `npx vitest run src/lab/host-keyboard.test.ts`. Expected: the four `aria-label names every key` tests FAIL (world misses 4, resume 4..6, blog 5..6, portfolio all); the `labelKeys` test passes.
- [ ] **Step 3: edit the four `aria-label`s** to the exact text of decision 3. Nothing else in the files changes.
- [ ] **Step 4: run and see it pass.** `npx vitest run src/lab/host-keyboard.test.ts`: all PASS. Then `npm test` and `npm run typecheck`: green.
- [ ] **Step 5: commit.** `git add lab/world.html lab/blog.html lab/resume.html lab/portfolio.html && git commit -m "fix(#302): world lab labels name keys 0..6"`
