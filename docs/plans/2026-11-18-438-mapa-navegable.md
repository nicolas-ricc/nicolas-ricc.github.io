# Navigable map: dragging the scene (mouse, touch, keyboard) and the «Centrar vista» button (#438) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the map (not in a zone), the visitor drags the scene with a pointer or the arrow keys, always inside the bleed, and a «Centrar vista» button brings the camera back to `coverView`.

**Architecture:** `panView` (pure, `src/world/view.ts`) moves the view and clamps it with `clampToBleed`; `sameView` tells whether a view is still the main view. `src/pan.ts` (no Pixi, no DOM globals) turns pointer events on a target into drag deltas with a 5 px threshold, click suppression and cursor and `touch-action` handling, and maps keys to deltas (`keyPan`). `src/main.ts` wires both to the `Camera`, keeps a `moved` flag, shows or hides `#recentrar` and changes the `ResizeObserver` branch.

**Tech Stack:** TypeScript, Vitest (node env, plain fakes for the pointer target), PixiJS v8 (runtime only), agent-browser for the browser checks.

**Spec:** issue #438 ("Decisiones", "Diseño" and "Criterios de aceptación" are binding).

## Global Constraints

- Drag only: no zoom (wheel or pinch) and no inertia.
- Only on the map (`current === null`). In a zone the camera stays on `zoneView`, the cursor stays `pointer` and nothing drags.
- `panView(v, dx, dy, w, h) = clampToBleed({ x: v.x + dx, y: v.y + dy, scale: v.scale }, w, h)`.
- `DRAG_THRESHOLD = 5` px (distance from pointerdown) separates a drag from a click. Once a drag has happened, the `click` that follows does not navigate.
- One pointer only: a second `pointerId` is ignored while the first one is down.
- Cursor `grab` at rest and `grabbing` while dragging, map only. `touch-action: none` on the canvas while the map is shown, and `""` in a zone.
- Arrow keys pan by `KEY_STEP = 0.1` of the host side (width for ←/→, height for ↑/↓) per keydown, so native key repeat repeats it. `0` or `Home` recenters. They act only on the map and when focus is not inside `#content`, and they `preventDefault`.
- `#canvas-host` gets `role="region"`, `tabindex="0"` and `aria-label="Mapa: arrastrá o usá las flechas para recorrerlo"`. The `#zonas` links stay the accessible navigation (ADR 0003).
- `#recentrar` is a `<button type="button">` with the text `Centrar vista`, `hidden` while the view matches `coverView`. Clicking it runs `camera.tweenTo(coverView(w, h))`, which jumps when reduced motion is on, and hides it again. It has the look of `#back` and a visible focus ring.
- Visitor-facing Spanish lives in `index.html` only. Code, comments and test names are in English (`src/english.test.ts`).
- Labels follow the camera through `apply`: nothing extra for `placeLabels`.

## Technical decisions (declared; not in the issue's design)

1. **Click suppression is explicit, not an event trick.** `attachPan` returns `consumeClick(): boolean`, which is true exactly once after a pointerup that ended a drag, and is reset by the next pointerdown. `main.ts`'s click listener starts with `if (pan.consumeClick()) return;`. Two capture listeners on the same target have a fragile order, so the flag avoids that trick.
2. **The first drag delta catches up.** When the pointer crosses the threshold, `onStart()` fires, then `onPan(dx, dy)` with the whole offset since pointerdown, so the scene stays under the finger. After that the deltas are incremental, from the previous move.
3. **Arrow direction = direction you look.** `ArrowRight` shows what is to the right, so the scene moves left: `dx = −0.1·w`. `ArrowLeft` gives `+0.1·w`, `ArrowDown` `dy = −0.1·h`, `ArrowUp` `+0.1·h`. Keys with `altKey`, `ctrlKey` or `metaKey` are ignored, so browser shortcuts still work.
4. **`moved` is derived from the view.** After each pan or resize, `moved = !sameView(camera.state, coverView(w, h))`. `sameView` uses a tolerance of 0.5 px on x/y and 1e-9 relative on scale. A drag that `clampToBleed` swallows (against an edge right at cover) therefore leaves the button hidden.
5. **Button placement: top-right corner of `#canvas-host`** (`position: absolute; inset: 1rem 1rem auto auto; z-index: 2`). `#titulo` sits bottom-left and `#hud` top-left, but `#hud` only shows in a zone, where the button is always hidden. Task 4 checks with screenshots at 390×750 and 1600×900 that the button does not cover a sign at cover.
6. **Focus after recentering.** If `#recentrar` had focus when it was activated, focus moves to `#canvas-host`, so a keyboard user does not land on `<body>` once the button hides.
7. **The hover is frozen while dragging.** `main.ts`'s `pointermove` and `pointerleave` handlers return early while `pan.dragging`. The `hot` zone stays whatever it was when the drag started.
8. **Mouse buttons.** Only `button === 0` starts a drag. The right button and the middle button do nothing.
9. **`setPointerCapture` failures are tolerated.** It is wrapped in `try`/`catch`: it throws `NotFoundError` for a pointer that is no longer active, and for the synthetic `PointerEvent`s the browser check dispatches. Without capture the drag still works while the pointer stays over the canvas. Test: a fake whose `setPointerCapture` throws still drags.
10. **`pointercancel`** ends a drag like `pointerup`, but never arms the click suppression (no click follows a cancel).
11. **`#canvas-host` focus ring:** `#canvas-host:focus-visible { outline: 2px solid var(--fg); outline-offset: -2px; }`. The negative offset keeps the ring visible inside the `overflow: clip` box.

## Acceptance criteria → tasks

| Criterion of #438 | Where |
|---|---|
| Every edge of the bleed reachable at 390×750, 820×1180 and 1600×900, never sky | Task 1 tests; eval E1 |
| A click without a drag navigates, a drag does not | Task 2 tests; Task 4 wiring; eval E2 |
| Touch: one-finger drag moves the view, the page does not scroll | Task 2 (`touch-action`); eval E3 |
| Arrows pan, `0`/`Home` recenters, no key acts in `#content` or in a zone | Task 2 `keyPan`; Task 4 keydown; eval E4 |
| «Centrar vista» appears after a move, animates to `coverView`, disappears | Tasks 3 and 4; eval E5 |
| With the view moved, a resize keeps it inside the bleed and does not reset it | Task 1 test; Task 4 observer; eval E6 |
| In a zone nothing drags and the cursor and behaviour are today's | Task 2 `setEnabled`; Task 4 `render`; eval E7 |
| `npm test` and `npm run typecheck` pass, with new tests for `panView` and `src/pan.ts` | Tasks 1 and 2; full suite |
| Before/after captures on a phone and a desktop in the PR | Task 4 Step 3 |
| README paragraph next to `coverView`; CONTEXT terms | Task 4 Step 4 |

The evals file `.scratch/evals-438.md` (E1–E7, URL, steps and expected outcome) is written in pipeline stage 3, before Task 1, and `.scratch/` is in `.git/info/exclude`. It drives real mouse input with `agent-browser mouse` and touch with synthetic `PointerEvent`s (`pointerType: "touch"`) dispatched by `eval`, because headless Chromium has no real touch input. It reads the camera through `window.__PIXI_DEVTOOLS_WRAPPER__.stage.children[0].position` (CLAUDE.md) and checks the corners against the bleed by reproducing `viewCorners` in the page.

## Assumptions (from the plan grilling)

- **The arrow direction follows the look metaphor** (ArrowRight shows the right). The issue says only "Las flechas mueven la vista". Rejected: moving the scene in the key's direction, because that is the inverse of how a page scrolls with the arrows.
- **`role="region"` on `#canvas-host`**, so the `aria-label` is announced. ARIA does not name a generic `div`, and the issue only asks for `tabindex="0"` and an `aria-label`. Rejected: `role="application"`, which takes the screen reader out of browse mode and would hide the `#zonas` links that ADR 0003 makes the navigation.
- **The `main.ts` wiring has no unit test.** No test imports `main.ts`: `site-shell.test.ts` only reads it as text, and it needs Pixi and the DOM. The logic is cut into `panView`/`sameView`/`attachPan`/`keyPan`, which are tested, and the remaining glue is covered by evals E2 and E4–E7 in the browser. Rejected: pulling the resize branch out into a function of its own, whose test would be one tautological line.
- **Top-right corner for «Centrar vista».** The issue asks for "una esquina que no tape los carteles ni #titulo". `#titulo` is bottom-left (style.css), `#hud` top-left and only in a zone (views.ts). The check is to force the button visible at cover (`hidden = false` by `eval`) at 390×750 and 1600×900 and confirm with a screenshot that it overlaps no sign.
- **`setPointerCapture` inside `try`/`catch`** (decision 9).

## Review Focus

1. A tap (pointerdown and pointerup with less than 5 px of movement) must still navigate: `consumeClick()` is false. Test in Task 2.
2. A second finger landing during a one-finger drag must neither jump the view nor end the drag, and lifting it must not end the first finger's drag. Test in Task 2.
3. After a drag, the next plain click (a new pointerdown) must navigate even if no click event fired after the drag. Test in Task 2 (the reset on pointerdown).
4. Opening a zone in the middle of a drag (for instance a link activated by the keyboard while the mouse is down) must leave no `grabbing` cursor: `setEnabled(false)` cancels an active drag and sets cursor `pointer`. Test in Task 2.
5. A resize with the view moved must not snap back to the main view, and must not leave the view outside the bleed when the host shrinks: `clampToBleed` of the moved state lies inside the bleed. Test in Task 1 (`panView` from cover, then `clampToBleed` at a smaller host), and the browser check in Task 4.

---

**Stage 3 note.** The pipeline writes the failing tests of Tasks 1–3 before implementation (`test(#438): evals`). An implementer who finds a step's test already present runs it, confirms it fails for the expected reason, and moves on to the implementation step.

### Task 1: `panView` and `sameView` in `src/world/view.ts`

**Files:**
- Modify: `src/world/view.ts` (after `clampToBleed`)
- Test: `src/world/view.test.ts` (new `describe("panView (#438)")` and `describe("sameView (#438)")`)

**Interfaces:**
- Produces: `export function panView(v: View, dx: number, dy: number, w: number, h: number): View` and `export function sameView(a: View, b: View): boolean`.

- [ ] **Step 1: Write the failing tests.** They reuse `insideBleed` (with `VIEW_INSET`) and `viewCorners` from the existing file. Sizes: `PAN_SIZES = [[390, 750], [820, 1180], [1600, 900]]`.
  - `"%i×%i: no sequence of drags leaves a corner outside the bleed"`: from `coverView(w, h)`, apply 200 drags from a seeded LCG, each with dx and dy in `[−0.6w, 0.6w]` × `[−0.6h, 0.6h]`. After each drag, every corner of `viewCorners(v, w, h)` passes `insideBleed(c, VIEW_INSET)`, and `v.scale` equals the cover scale.
  - `"%i×%i: a large drag stops at the edge"`: for each of the 8 directions `(±1, 0), (0, ±1), (±1, ±1)` × 1e5 px: the result is inside the bleed, and a second identical drag returns the same view (`toEqual`), so it stopped.
  - `"%i×%i: every edge of the bleed is reachable"`: over those 8 large drags, for each of the four edges `X0 + VIEW_INSET`, `X1 − VIEW_INSET`, `Y0 + VIEW_INSET` and `Y1 − VIEW_INSET`, some drag leaves a corner within 1e-6 of that edge on its axis.
  - `"panView(v, 0, 0) returns v when it is already inside"`: for `coverView` at the three sizes, `expect(panView(v, 0, 0, w, h)).toEqual(v)`.
  - `"a moved view stays inside after the host shrinks"`: `v = panView(coverView(1600, 900), 4000, 4000, 1600, 900)`; `clampToBleed(v, 1200, 900)` has every corner inside the bleed at 1200×900.
  - `sameView`: `sameView(v, { ...v })` is true. A shift of 0.4 px on x is true, 0.6 px on x is false, 0.6 px on y is false, and scale × (1 + 1e-6) is false.
- [ ] **Step 2: Run** `npx vitest run src/world/view.test.ts`. Expected: FAIL (`panView` and `sameView` are not exported).
- [ ] **Step 3: Implement.** `panView` is the one-liner from Global Constraints. `sameView` compares `|Δx| <= 0.5 && |Δy| <= 0.5 && |Δscale| <= 1e-9 · b.scale`. Each gets a one-line doc comment in the style of the file.
- [ ] **Step 4: Run** the same command. Expected: PASS. Run `npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit** `feat(#438): panView and sameView`.

### Task 2: `src/pan.ts`, pointer drag and key mapping

**Files:**
- Create: `src/pan.ts`
- Test: `src/pan.test.ts` (node environment, a hand-written fake target, no Pixi and no happy-dom)

**Interfaces:**
- Produces:
  ```ts
  export const DRAG_THRESHOLD = 5;
  export const KEY_STEP = 0.1;
  export interface PanPointer { pointerId: number; clientX: number; clientY: number; button: number }
  export interface PanTarget {
    style: { cursor: string; touchAction: string };
    addEventListener(type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", fn: (e: PanPointer) => void): void;
    setPointerCapture(id: number): void;
    releasePointerCapture(id: number): void;
  }
  export interface PanOptions { onStart(): void; onPan(dx: number, dy: number): void }
  export interface Pan { readonly dragging: boolean; setEnabled(on: boolean): void; consumeClick(): boolean }
  export function attachPan(el: PanTarget, opts: PanOptions): Pan;
  export function keyPan(e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean }, w: number, h: number): { dx: number; dy: number } | "home" | null;
  ```
  If `HTMLCanvasElement` is not assignable to `PanTarget` under `tsc`, narrow `PanTarget` until it is (for example, type the listener parameter as `PointerEvent`-compatible) rather than casting in `main.ts`.
- Behaviour: `attachPan` starts **disabled** (cursor `pointer`, touchAction `""`). `setEnabled(true)` sets `grab` and `"none"`. `setEnabled(false)` sets `pointer` and `""`, and ends an active drag without arming the click suppression. While disabled, pointer events do nothing.

- [ ] **Step 1: Write the failing tests** (`describe("attachPan (#438)")`, `describe("keyPan (#438)")`). The fake records its listeners, has `fire(type, e)`, and `setPointerCapture`/`releasePointerCapture` as `vi.fn()`.
  - `"disabled by default: pointer cursor, no touch-action, no drag"`: down (0,0) and move (50,0) → `onPan` not called, cursor `pointer`, touchAction `""`.
  - `"setEnabled toggles cursor and touch-action"`: true → `grab`/`none`; false → `pointer`/`""`.
  - `"below the threshold it is a click"`: enabled, down (10,10), move (13,13) (≈4.2 px), up → `onStart` and `onPan` not called, `consumeClick()` false, `dragging` false.
  - `"crossing the threshold starts a drag with the whole offset"`: down (10,10), move (16,10) → `onStart` once, `onPan(6, 0)`, `dragging` true, cursor `grabbing`, `setPointerCapture` called with the pointerId on down. Then move (20,13) → `onPan(4, 3)`.
  - `"a drag suppresses exactly one click"`: after down, move past the threshold, up → cursor `grab`, `dragging` false, `releasePointerCapture` called, `consumeClick()` true, then false.
  - `"the next pointerdown clears a pending suppression"`: drag, up, new down/up without moving → `consumeClick()` false.
  - `"a second pointer is ignored"`: pointer 1 down (0,0), pointer 2 down (100,100), pointer 2 move (200,200) → no `onPan`. Pointer 1 move (10,0) → `onPan(10, 0)`. Pointer 2 up → still `dragging`.
  - `"pointercancel ends the drag without suppressing a click"`: drag, cancel → `dragging` false, `consumeClick()` false.
  - `"a throwing setPointerCapture does not stop the drag"`: the fake's `setPointerCapture` throws, and down, move 10 px → `onPan(10, 0)`.
  - `"only the main mouse button drags"`: down with `button: 2`, move 50 px → no `onPan`.
  - `"setEnabled(false) mid-drag ends it"`: drag, `setEnabled(false)` → `dragging` false, cursor `pointer`, a later move → no `onPan`.
  - `keyPan` at 400×800: `ArrowRight` → `{ dx: -40, dy: 0 }`, `ArrowLeft` → `{ dx: 40, dy: 0 }`, `ArrowDown` → `{ dx: 0, dy: -80 }`, `ArrowUp` → `{ dx: 0, dy: 80 }`, `"0"` and `"Home"` → `"home"`, `"a"` → `null`, `ArrowRight` with `ctrlKey` (and with `altKey`, and with `metaKey`) → `null`.
- [ ] **Step 2: Run** `npx vitest run src/pan.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/pan.ts`** with the interfaces above. A module doc comment says it is Pixi-free and DOM-global-free, so it can be tested with a fake target.
- [ ] **Step 4: Run** the test file. Expected: PASS. Run `npx vitest run src/iso/pixi-free.test.ts src/english.test.ts` and `npm run typecheck`. Expected: PASS and clean.
- [ ] **Step 5: Commit** `feat(#438): pan gestures and key mapping`.

### Task 3: Markup and CSS for the button and the focusable host

**Files:**
- Modify: `index.html` (`#canvas-host` attributes; `#recentrar` right after `#hud`)
- Modify: `src/style.css` (after the `#hud` rules)
- Test: `src/site-shell.test.ts` (new `describe("site shell: navigable map (#438)")`)

**Interfaces:**
- Produces: `#canvas-host[role="region"][tabindex="0"]` with the aria-label, and `<button id="recentrar" type="button" hidden>Centrar vista</button>` inside `#canvas-host`. Task 4 uses both ids.

- [ ] **Step 1: Write the failing tests** with the existing `block()` helper:
  - `HTML` contains `<div id="canvas-host" role="region" tabindex="0" aria-label="Mapa: arrastrá o usá las flechas para recorrerlo">`.
  - `HTML` contains `<button id="recentrar" type="button" hidden>Centrar vista</button>`, and its index is between the indexes of `id="canvas-host"` and `<main id="content"`.
  - `block(CSS, "#recentrar")` contains `position: absolute`, `inset: 1rem 1rem auto auto` and `z-index: 2`.
  - `block(CSS, "#recentrar:focus-visible")` contains `outline: 2px solid var(--fg)`.
  - `block(CSS, "#canvas-host:focus-visible")` contains `outline: 2px solid var(--fg)` and `outline-offset: -2px`.
  - `block(CSS, ".no-canvas #recentrar")` contains `display: none`.
- [ ] **Step 2: Run** `npx vitest run src/site-shell.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Write the markup as in Interfaces. `#recentrar` gets the look of `#back`: `color: var(--fg)`, `font-size: 0.9rem`, `text-shadow: 0 1px 2px #000`, `background: none`, `border: 0`, `padding: 0.25rem 0`, `cursor: pointer`, `font-family: inherit`. Add a `#recentrar[hidden] { display: none; }` guard only if the rule's `display` would override `hidden`. Hex colours stay within the palette guard (`src/map/palette-guard.test.ts`).
- [ ] **Step 4: Run** `npx vitest run src/site-shell.test.ts src/english.test.ts src/map/palette-guard.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#438): recenter button and focusable map host`.

### Task 4: Wiring in `src/main.ts`, browser check and docs

**Files:**
- Modify: `src/main.ts`
- Modify: `README.md` (a paragraph right after the `coverView` paragraph that ends "…on each axis it covers (`clampToCover`).")
- Modify: `CONTEXT.md` (new entry `### Pan` right after `### Cover frame`)
- Create: `docs/superpowers/specs/assets/438-mapa-navegable/*.png` (before and after captures, phone 390×750 and desktop 1600×900)

**Interfaces:**
- Consumes: `panView`, `sameView`, `clampToBleed` and `coverView` (Task 1); `attachPan`, `keyPan` and `Pan` (Task 2); `#recentrar` and `#canvas-host` (Task 3).

- [ ] **Step 1: Wire it.** The exact behaviour:
  - State: `let moved = false`. A helper `const syncMoved = (): void => { moved = current === null && !sameView(camera.state, coverView(w, h)); recenter.hidden = !moved; }`, where `w` and `h` are the host size.
  - `const pan = attachPan(app.canvas, { onStart: () => camera.jumpTo(camera.state), onPan: (dx, dy) => { camera.jumpTo(panView(camera.state, dx, dy, w, h)); syncMoved(); } })`. The `onStart` jump ends any active tween, so the drag wins. Remove the line `app.canvas.style.cursor = "pointer"`: `attachPan` owns the cursor.
  - In `render(id, animate)`: `pan.setEnabled(id === null)`, and when `id !== null`, set `moved = false` and `recenter.hidden = true`.
  - Canvas `pointermove`/`pointerleave` return early while `pan.dragging`. The canvas `click` returns early when `pan.consumeClick()` is true.
  - `const recenterView = (): void => { const hadFocus = document.activeElement === recenter; moved = false; recenter.hidden = true; void camera.tweenTo(coverView(w, h)); if (hadFocus) host.focus(); }`. `#recentrar` click → `recenterView()`.
  - `keydown`: keep the Escape branch. Then, if `current === null`, the active element is not inside `#content`, and `keyPan(e, w, h)` is not null: `e.preventDefault()`. On `"home"`, call `recenterView()`. Otherwise jump with `panView` (ending a tween first, through `jumpTo`) and call `syncMoved()`.
  - `ResizeObserver`: after `app.resize(); syncSite();`: if `camera.isTweening`, `camera.retarget(targetFor(current))`; else if `moved`, `camera.jumpTo(clampToBleed(camera.state, w, h))` then `syncMoved()`; else `camera.jumpTo(targetFor(current))`.
- [ ] **Step 2: Run** `npm test` and `npm run typecheck`. Expected: all green.
- [ ] **Step 3: Browser check.** Start `npm run dev -- --host --port 5173` and run `.scratch/evals-438.md` with agent-browser. Every step must pass. Take the four captures (before and after a drag, at 390×750 with touch and at 1600×900 with the mouse) into `docs/superpowers/specs/assets/438-mapa-navegable/` and check that `#recentrar` covers no sign.
- [ ] **Step 4: Docs.** In `src/docs-glossary.test.ts` add `"Pan"` to the list of the `defines ${term}` test (it is a fixed list, not discovered). In the README, after the `coverView` paragraph: on the map the visitor can drag the scene (Pointer Events: mouse, touch, pen; arrows by 10 % of the host; `0`/`Home`) with `panView`, always inside the bleed (`clampToBleed`) and with no zoom or inertia; a drag over 5 px does not navigate; «Centrar vista» tweens back to `coverView`; a resize keeps a moved view, clamped; in a zone the camera is fixed (`src/pan.ts`, #438). In `CONTEXT.md`, `### Pan` defines Pan (the visitor moving the map view, map only), Main view (`coverView`, which «Centrar vista» returns to) and Moved, with `Code: \`src/world/view.ts\` (\`panView\`, \`sameView\`, \`clampToBleed\`), \`src/pan.ts\` (\`attachPan\`, \`keyPan\`, \`DRAG_THRESHOLD\`, \`KEY_STEP\`), \`src/main.ts\``. Run `npx vitest run src/docs-glossary.test.ts src/english.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#438): wire pan, keyboard and recenter into the site`.

## Grilling

- Rounds: 1 (griller model: fable). The revision added an acceptance-criteria table, two assumptions with a test, `role="region"` and the evals reference. It added no steps, removed none and kept the same seams, so I did not run a second round.
- Questions: 18. By source: ISSUE 9 (1, 3, 4, 8, 10, 11, 12, 17 in part, 18 in part), CODE 9 (1, 6, 7, 12, 14, 15), DOC 2 (16 CLAUDE.md, 13 ADR 0003). NO SOURCE 5, all technical assumptions (arrow direction, `role="region"`, no unit test for the `main.ts` glue, top-right corner, `setPointerCapture` in `try`/`catch`).
- Spec ambiguities: none. Follow-up issues opened: none.
