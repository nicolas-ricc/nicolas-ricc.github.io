# README names both plan folders (#204) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the README sentence that says where plans live names both `docs/plans/` (agent runs) and `docs/superpowers/plans/`, pinned by a test in `src/lab/docs.test.ts`.

**Architecture:** one sentence of copy in `README.md:12`. No files move. The test reads `README.md` as text, like the other cases in `src/lab/docs.test.ts`, and checks that every plan folder it names exists and holds plans, so the copy cannot point at an empty or missing folder.

**Tech Stack:** Markdown, TypeScript strict, Vitest (`environment: "node"`).

**Spec:** issue #204 and the owner's decision comment of 2026-11-01: "El README nombra las dos carpetas: `docs/plans/` (corridas de agentes) y `docs/superpowers/plans/`. No se mueve ningún archivo, para no romper enlaces de issues y PRs."

## Global Constraints

- No file under `docs/plans/` or `docs/superpowers/plans/` is moved, renamed or edited (owner's decision).
- README copy stays in Spanish, like the rest of the README; new test names are in English (#194, as in #167 and #180).
- Only the plan sentence of `README.md:12` changes; the rest of that paragraph (the `content/*.json` and `public/cv.pdf` sentences) and "Diseño en `docs/superpowers/specs/`" stay as they are.
- Commits `<type>(#204): ...`. `npm test` and `npm run typecheck` green.
- Pipeline evals stage: Task 1 Step 1 (the failing test) is committed alone as `test(#204): evals` before implementation; implementers start at Task 1 Step 3.

## Technical decisions (declared)

1. **Exact copy.** In `README.md:12`, replace

   `Diseño en \`docs/superpowers/specs/\`, plan en \`docs/superpowers/plans/\`.`

   with

   `Diseño en \`docs/superpowers/specs/\`. Planes en dos carpetas: \`docs/plans/\` (corridas de agentes) y \`docs/superpowers/plans/\`; no se mueven, para no romper enlaces de issues y PRs.`

   The parenthetical and the reason are the owner's wording ("No se mueve ningún archivo, para no romper enlaces de issues y PRs"). `docs/superpowers/plans/` gets no label: its plans overlap in date with `docs/plans/` (e.g. `2026-10-24-wheel-cangilones.md` vs `docs/plans/2026-10-16-59-…`), so any "older"/"by hand" label would be a guess.
2. **No other file is touched.** `CLAUDE.md` and `AGENTS.md` do not mention plan folders; the `.agents/skills/` default (`docs/superpowers/plans/`) is not part of the repo (AGENTS.md: "never commit them"). Source comments pointing at `docs/plans/…` files (`src/scenes/boiler-house.ts:13` etc.) are already correct.
3. **Test locates the sentence by the paragraph containing `docs/superpowers/specs/` and "Planes en"**, not by line number, so reflowing the paragraph does not break it.

## Review Focus

1. The README names a folder that does not exist or is empty (typo, trailing slash dropped) — the test extracts every `docs/…plans/` path in the sentence and asserts each is a directory with at least one `.md`.
2. Only one of the two folders named (the original bug) — the test asserts both `` `docs/plans/` `` and `` `docs/superpowers/plans/` `` appear in the paragraph.
3. The old singular sentence survives next to the new one, contradicting it — the test asserts `plan en \`docs/superpowers/plans/\`` is gone from the README.
4. Plans moved or deleted by accident while editing — Step 4 checks `git diff --stat $(git merge-base origin/main HEAD) -- docs/plans docs/superpowers/plans` shows only this plan file added.
5. Agent-run plans not identified as such — the test asserts `` `docs/plans/` (corridas de agentes) ``.

---

### Task 1: README names both plan folders

**Files:**
- Modify: `README.md:12` (last sentence of the paragraph)
- Test: `src/lab/docs.test.ts` (new `describe` at the end of the file)

**Interfaces:**
- Consumes: `ROOT`, `readme`, `existsSync`, `readFileSync` already defined/imported at the top of `src/lab/docs.test.ts`; add `readdirSync` to the `node:fs` import.

- [ ] **Step 1: Write the failing test** at the end of `src/lab/docs.test.ts`:

```ts
describe("README names both plan folders (#204)", () => {
  const para = readme.split(/\n\s*\n/).find((p) => p.includes("docs/superpowers/specs/") && p.includes("Planes en")) ?? "";
  it("names docs/plans/ as the agent runs' folder and docs/superpowers/plans/", () => {
    expect(para).toContain("`docs/plans/` (corridas de agentes)");
    expect(para).toContain("`docs/superpowers/plans/`");
  });
  it("drops the old single-folder sentence", () => {
    expect(readme).not.toContain("plan en `docs/superpowers/plans/`");
  });
  it("every plan folder it names exists and holds plans", () => {
    const dirs = [...para.matchAll(/`(docs\/[\w/]*plans\/)`/g)].map((m) => m[1]);
    expect(dirs).toEqual(["docs/plans/", "docs/superpowers/plans/"]);
    for (const d of dirs) {
      expect(existsSync(`${ROOT}${d}`), d).toBe(true);
      expect(readdirSync(`${ROOT}${d}`).some((f) => f.endsWith(".md")), d).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lab/docs.test.ts`. Expected: the three new cases FAIL (`para` is empty; the old sentence is still there); every pre-existing case PASSES.
- [ ] **Step 3: Implement** — replace the sentence of decision 1 in `README.md:12`; nothing else on the line changes.
- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lab/docs.test.ts` → all PASS; `git diff --stat $(git merge-base origin/main HEAD) -- docs/plans docs/superpowers/plans` lists only this plan file (merge-base, so plans landed on `main` after the branch was cut do not show up).
- [ ] **Step 5: Full suite and typecheck** — `npm test` and `npm run typecheck`, both green.
- [ ] **Step 6: Commit**

```bash
git add README.md src/lab/docs.test.ts
git commit -m "docs(#204): README nombra docs/plans/ y docs/superpowers/plans/"
```

## Assumptions

- **`ROOT` ends in `/`**: `src/lab/docs.test.ts:5` builds it with `fileURLToPath(new URL("../../", import.meta.url))`, so `${ROOT}docs/plans/` is a valid path. `readme` is a module-scope string (`src/lab/docs.test.ts:6`), so `para` is computed eagerly.
- **The paragraph split is sound**: `README.md:11` and `README.md:13` are blank lines, so `para` is exactly line 12.
- **The old sentence occurs once** (`grep -c` → 1) and "Planes en" occurs zero times, so case 2 and the `find` in case 1 flip from red to green with only the line-12 edit.
- **Test naming**: every `describe` in `src/lab/docs.test.ts` ends with `(#NNN)`. The title is in English per #194; the rejected alternative was a Spanish title like its neighbours.
- **The order is pinned by the copy, not by a requirement**: `toEqual` pins the order of decision 1. The rejected alternative was a set comparison, which would also accept a third or duplicated folder. A mistyped folder (e.g. no trailing slash) shows up as a length mismatch in the `toEqual` diff, and that diff names what was extracted.
- **Step 6 also commits the test file** when the evals commit did not already include it.
- **The commit types `plan`, `test`, `docs` and the `evals` subject** come from the pipeline brief; the `test(#NNN):` and `docs(#NNN):` forms already appear in `git log` (e.g. `1749776`, `7412bdb`).

## Grilling

- Rounds: 1 (the revisions were local wording and step fixes, not a different seam).
- Questions: 14. Sources: ISSUE 3 (Q5, Q6, Q7), CODE 6 (Q1, Q2, Q3, Q8, Q12, Q13), DOC 1 (Q12: `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md:351` "los planes están en `docs/plans/`"), NO SOURCE → technical assumption 4 (Q4, Q9, Q10, Q11, Q14 folded with Q11).
- Assumptions: see above. Spec ambiguities: none. Follow-up issues opened: none.
