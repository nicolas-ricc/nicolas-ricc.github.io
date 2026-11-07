# Palette guard over `src/style.css` (#203): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/map/palette-guard.test.ts` also scans `src/style.css` with `offPalette` and fails on any off-palette hex literal that is not in an explicit, commented allowlist of the site's UI colours.

**Architecture:** One new `describe` block in `src/map/palette-guard.test.ts`, next to the `lab/*.html` one. It reuses `offPalette` and subtracts a commented allowlist, `STYLE_CSS_ALLOWLIST`, through a small helper, `styleCssOffenders(text)`. Two more tests keep the allowlist honest: every entry must be off-palette, because an on-palette entry is redundant, and every entry must still appear in `style.css`, because a stale entry would silently allow a colour. A one-line comment in `src/style.css` points editors at the guard. No production code changes: the render is identical.

**Tech Stack:** TypeScript, Vitest, `node:fs`.

**Spec:** issue #203 and the owner's decision comment of 2026-11-01. That comment absorbs #177.

## Global Constraints

- Owner's decision: "`palette-guard` también recorre `src/style.css` (`offPalette`), con una allowlist explícita y comentada de los grises de la UI (`#e6edf3`, `#9aa7b2`, `#22303c`, …); cualquier otro hex fuera de la paleta falla."
- "Código, comentarios y mensajes de test nuevos, en inglés (ver #194)". The existing Spanish test names stay as they are: translating them is #194's job.
- `npm test` and `npm run typecheck` are green. Commits: Steps 1–2 land as `test(#203): evals` (the pipeline's evals stage, red); Steps 3–8 as `feat(#203): …`, following `feat(#112): palette guard covers lab/*.html` (723ce0e).

## Data

`src/style.css` today has these hex literals (checked against `allIsoColors()`):

| Literal | Where | On palette? |
|---|---|---|
| `#100e19` | `--bg` | yes (`ISO_COLORS.sky`) |
| `#7cf5ff` | `#content a`, the Blog label | yes (`cyan`) |
| `#ffc457` | the PDF button, the Portfolio label, `#titulo` | yes (`amber`) |
| `#5a3d14` | the PDF viewer border | yes (`amberBleed`) |
| `#e6edf3` | `--fg`, the UI text | no |
| `#9aa7b2` | `--muted`, the lead and h2 text | no |
| `#22303c` | the h2 bottom rule | no |
| `#000` | the `#hud` and `#titulo` text shadows | no (also 3 digits, which `offPalette` always reports) |
| `#8ec07c` | the Resume label, "el verde de acento del blog" | no |

`offPalette` (`palette-guard.test.ts`) matches `/#[0-9a-fA-F]+\b/g`. The id selectors in `style.css` (`#app`, `#canvas-host`, `#content`, `#hud`, `#titulo`, `#zonas`) do not match, because a word character follows the hex prefix. `rgba(8, 10, 18, 0.62)` is not a hex literal and stays outside the guard, as it does for the lab (#112, Decision 3).

## Technical decisions (declared)

1. **The allowlist holds all five off-palette literals.** These are the three greys the owner named, `#000` and `#8ec07c`. The owner's list ends in "…", so it is open. `#000` is the text-shadow black, which is UI chrome. `#8ec07c` is not a grey, but `style.css` documents it as a deliberate external colour (the blog's accent green, myxomatosis.xyz/blog). The alternatives were to recolour the Resume label, which changes the site, or to add it to `ISO_COLORS`, which would make it a palette colour the scenes could draw. Both change more than the guard. Each entry gets a comment saying what it colours.
2. **The allowlist is a lowercase `Set<string>`, and matching is case-insensitive.** `#E6EDF3` passes, as `#100E19` already does for the palette. The match is exact on the literal: `#000000` is not `#000`, so it fails. This keeps the allowlist literal and easy to read.
3. **The allowlist cannot rot.** Each entry must be off-palette, otherwise the entry is redundant. Each entry must also still appear in `style.css`, otherwise a removed colour would stay allowed.
4. **Comments are scanned too.** The guard reads the whole file, as it does for the lab, so a stale hex inside a CSS comment also fails.
5. **`src/style.css` gets a comment** above `:root` that names the guard and the allowlist, so whoever adds a colour knows a test checks it.

## Review Focus

1. An uppercase allowlisted literal (`#E6EDF3`) must pass. Covered by the helper test in Task 1.
2. A new off-palette colour must fail even when it is close to an allowlisted grey (`#e6edf4`). Covered by the helper test.
3. A long or short form of an allowlisted value (`#000000`, `#e6edf3ff`) must fail, because the allowlist matches exact literals. Covered by the helper test.
4. On-palette literals in any case (`#100E19`) must still pass. Covered by the helper test.
5. Deleting a colour from `style.css` without removing it from the allowlist must fail. Covered by the "still used" test.

---

### Task 1: guard `src/style.css`

**Files:**
- Modify: `src/map/palette-guard.test.ts` (new block at the end of the file)
- Modify: `src/style.css` (comment above `:root`)

**Interfaces:**
- Consumes: `offPalette(text: string): string[]`, already in `palette-guard.test.ts`.
- Produces, local to the test file:
  - `STYLE_CSS_ALLOWLIST: ReadonlySet<string>`, lowercase literals, one comment per entry.
  - `styleCssOffenders(text: string): string[]`, which returns `offPalette(text)` minus the literals whose lowercase form is in `STYLE_CSS_ALLOWLIST`.

- [ ] **Step 1: Write the failing tests.** Append this block to `src/map/palette-guard.test.ts`. The allowlist starts empty here: Step 3 fills it.

```ts
const STYLE_CSS = fileURLToPath(new URL("../style.css", import.meta.url));

/** Off-palette hex literals src/style.css may use (lowercase). */
const STYLE_CSS_ALLOWLIST: ReadonlySet<string> = new Set<string>([]);

function styleCssOffenders(text: string): string[] {
  return offPalette(text).filter((h) => !STYLE_CSS_ALLOWLIST.has(h.toLowerCase()));
}

describe("palette guard on src/style.css", () => {
  const css = readFileSync(STYLE_CSS, "utf8");

  it("reports off-palette literals unless allowlisted, ignoring case", () => {
    expect(styleCssOffenders("color: #e6edf3; color: #E6EDF3; text-shadow: 0 0 2px #000;")).toEqual([]);
    expect(styleCssOffenders("background: #100E19; color: #9aa7b2;")).toEqual([]);
    expect(styleCssOffenders("color: #e6edf4;")).toEqual(["#e6edf4"]);
    expect(styleCssOffenders("color: #000000; border: #e6edf3ff;")).toEqual(["#000000", "#e6edf3ff"]);
    expect(styleCssOffenders("#content a { color: inherit; } #app {}")).toEqual([]);
  });

  it("src/style.css only uses palette colours or allowlisted UI colours", () => {
    expect(styleCssOffenders(css)).toEqual([]);
  });

  it("allowlist entries are off-palette", () => {
    expect([...STYLE_CSS_ALLOWLIST].filter((hex) => offPalette(hex).length === 0)).toEqual([]);
  });

  it("allowlist entries are still used in src/style.css", () => {
    const used = new Set(offPalette(css).map((h) => h.toLowerCase()));
    expect([...STYLE_CSS_ALLOWLIST].filter((hex) => !used.has(hex))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and see them fail.**

Run: `npx vitest run src/map/palette-guard.test.ts -t "style.css"`
Expected: FAIL. The helper test fails at its first assertion with `["#e6edf3", "#E6EDF3", "#000"]`. The file test reports `["#e6edf3", "#9aa7b2", "#22303c", "#000", "#8ec07c", "#000", "#000"]`, in file order. The two allowlist tests pass, because the allowlist is empty.

- [ ] **Step 3: Fill `STYLE_CSS_ALLOWLIST`.** Add the five entries `"#e6edf3"`, `"#9aa7b2"`, `"#22303c"`, `"#000"` and `"#8ec07c"`. Give each a trailing comment that names its use from the Data table, for example `// --fg: UI text`, `// text-shadow behind #hud and #titulo` and `// Resume label: the blog's accent green (myxomatosis.xyz/blog)`. Extend the JSDoc in one sentence: these are the site's UI colours, which are deliberately not scene colours, and any other off-palette hex fails.

- [ ] **Step 4: Add the pointer comment to `src/style.css`.** Add one comment line above `:root`, in English: `/* Hex colours here are checked by src/map/palette-guard.test.ts: palette values, or the UI colours in its STYLE_CSS_ALLOWLIST. */`. Do not use a hex literal in the comment.

- [ ] **Step 5: Run the tests and see them pass.**

Run: `npx vitest run src/map/palette-guard.test.ts src/map/background.test.ts`
Expected: PASS. `background.test.ts` still finds `--bg: #100e19`.

- [ ] **Step 6: Check the guard by hand.** Temporarily change `#22303c` in `style.css` to `#22303d`, then run Step 5's command. Expected: FAIL with `["#22303d"]` from the file test, and the "still used" test reports `["#22303c"]`. Revert the change, then confirm the revert: `grep -c 22303d src/style.css` prints `0` and `git diff src/style.css` shows only the Step 4 comment.

- [ ] **Step 7: Full suite and typecheck.** Run: `npm test && npm run typecheck`. Expected: all green.

- [ ] **Step 8: Commit** (the tests of Steps 1–2 are already committed as `test(#203): evals`).

```bash
git add src/map/palette-guard.test.ts src/style.css
git commit -m "feat(#203): palette guard scans src/style.css with a UI colour allowlist"
```

## Assumptions

Decided in the grilling (no written source; any option satisfies the issue):

- **`#000` and `#8ec07c` are allowlisted, not recoloured.** The owner's list of greys ends in "…" and #177, which #203 absorbs, already listed `#000` among the off-palette values to handle. `#8ec07c` (added in 3c26e1c, "Blog en verde", later swapped to Resume) is documented in `style.css` as the blog's accent green. Allowlisting keeps the site pixel-identical. Rejected: recolouring the Resume label to a palette value (visible change nobody asked for) or adding it to `ISO_COLORS` (makes it drawable by scenes).
- **Hex only.** The owner's comment scopes the guard to `offPalette`, which only reads hex literals; `rgb()`, `hsl()` and named colours stay outside, as in the lab guard (#112, Decision 3). Rejected: parsing every CSS colour notation.
- **Hex-only id selectors stay a known false positive**, as in the lab guard (#112, Decision 2). None exists today: the file's hex tokens, in order, are `#100e19 #e6edf3 #9aa7b2 #22303c #7cf5ff #ffc457 #5a3d14 #000 #ffc457 #8ec07c #7cf5ff #ffc457 #000 #000`.
- **The allowlist tests always assert once** (a filtered array compared to `[]`), so an empty allowlist does not make them vacuous. `vitest.config.ts` has no `requireAssertions`.
- **Coupling to the palette is intended** (Decision 3): if `ISO_COLORS` gains one of the greys, the "off-palette" test fails and the entry must be removed from the allowlist.
- **The pointer comment in `style.css`** is a comment only; it changes no rule. Its text has no hex literal, and `background.test.ts` matches `/--bg:\s*(#[0-9a-fA-F]{6})/`, so it keeps finding `--bg`.

## Grilling

One round, 16 questions (griller model: fable). Sources: ISSUE 4, CODE 9, DOC 0, NO SOURCE 3 (all technical assumptions, listed above). No spec ambiguities, no follow-up issues. The plan changed in detail only (allowlist test form, revert check, commit split), so no second round.
