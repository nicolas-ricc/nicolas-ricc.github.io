# Quitar el import sin uso de `brokenTone` en `city.ts` (#50): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que `src/scenes/city.ts` deje de importar `brokenTone` de `./city-pieces`, porque nunca lo usa.

**Architecture:** es un cambio de una línea en `src/scenes/city.ts:10`. `brokenTone` sigue exportado desde `src/scenes/city-pieces.ts:28`. Lo usan `tiles()` como valor por defecto de `tone` (`city-pieces.ts:33`) y `src/scenes/tech.ts:112`. Un import sin uso no tiene una salida que se pueda observar en ejecución. Por eso el test lee el fuente, como ya hacen `src/lab/lab-excluded.test.ts` y `src/lab/page.test.ts`, y codifica el criterio del issue, que también está escrito como grep.

**Tech Stack:** TypeScript y Vitest (`readFileSync` sobre el fuente).

**Spec:** issue #50 y su Agent Brief (comentario de triage). Fuera de alcance: activar `noUnusedLocals` / `noUnusedParameters` y limpiar lo que marquen.

## Global Constraints

- Criterio 1: `grep -n brokenTone src/scenes/city.ts` no devuelve nada.
- Criterio 2: `npm test`, `npm run typecheck` y `npm run build` en verde.
- `tsconfig.json` no se toca (no se activa `noUnusedLocals`).
- Tests, comentarios y mensajes en castellano. Commits `test(#50): …` y `fix(#50): …`.

## Decisiones técnicas (declaradas)

1. **Test sobre el fuente.** El criterio es un grep. Sin `noUnusedLocals`, ni el typecheck ni ningún test de comportamiento puede notar el import, así que el test lee `src/scenes/city.ts` y exige que no contenga `brokenTone`.
2. **El test vive en `src/scenes/city.test.ts`**, el archivo de tests de esa escena. No se crea un archivo nuevo para un solo `it`.
3. **La exportación de `brokenTone` queda.** La usan `tech.ts:9,112` y `tiles()` (`city-pieces.ts:33`). No hace falta un test que lo fije: si alguien la borra, `npm run typecheck` falla en el import de `tech.ts`.

## Review Focus

1. Que el import de `./city-pieces` siga trayendo `PLINTH_H`, `lamp`, `plazaTone`, `prism` y `tiles`, que `city.ts` sí usa. Lo cubren `npm run typecheck` y los tests existentes de `city.test.ts`.
2. Que `brokenTone` siga exportado desde `city-pieces.ts`, porque lo usan `tech.ts` y el default de `tiles()`. Lo cubre `npm run typecheck`: `tech.ts:9` lo importa por nombre.
3. Que `tsconfig.json` no cambie. Se revisa en el diff: la Task 1 no lo toca.
4. Que el render de la ciudad no cambie: `city.ts:98` llama a `tiles()` sin `tone`, y el default `brokenTone` lo resuelve `city-pieces.ts` por su cuenta. Lo cubren los tests existentes de `city.test.ts`, que arman la escena con `city(createRng(7), createRng(8))` y se corren sin tocarlos.
5. Que el build siga pasando. Se cubre corriendo `npm run build` en el Step 4.

---

### Task 1: quitar `brokenTone` del import de `city.ts`

**Files:**
- Modify: `src/scenes/city.ts:10`
- Test: `src/scenes/city.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada nuevo. `city()` y sus exports no cambian.

- [ ] **Step 1: Write the failing test**

En `src/scenes/city.test.ts`, agregar `import { readFileSync } from "node:fs";` como primera línea y, al final del archivo:

```ts
describe("imports de city.ts (#50)", () => {
  it("no importa brokenTone, que no usa", () => {
    expect(readFileSync(new URL("./city.ts", import.meta.url), "utf8")).not.toMatch(/brokenTone/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/city.test.ts -t "imports de city.ts"`
Expected: FAIL en "no importa brokenTone, que no usa". `brokenTone` aparece solo en `city.ts:10`, así que con el Step 3 pasa a verde.

- [ ] **Step 3: Write minimal implementation**

En `src/scenes/city.ts:10`:

```ts
import { PLINTH_H, lamp, plazaTone, prism, tiles } from "./city-pieces";
```

- [ ] **Step 4: Run tests, typecheck and build**

Run: `test -f src/scenes/city.ts && ! grep -n brokenTone src/scenes/city.ts && npm test && npm run typecheck && npm run build`
Expected: exit 0. El `test -f` descarta que el grep salga vacío por una ruta equivocada.

- [ ] **Step 5: Commit**

El test rojo ya se commiteó en la etapa 3 del pipeline (`test(#50): evals`). Acá va solo el fuente:

```bash
git add src/scenes/city.ts
git commit -m "fix(#50): quitar el import sin uso de brokenTone en city.ts"
```

## Assumptions

- **Ritmo de commits.** En la etapa 3 del pipeline se commitea el test rojo (`test(#50): evals`) y en la 4 la Task 1 (`fix(#50): …`). La PR entra a `main` con squash, así que `main` nunca ve el rojo.
- **Un `ENOENT` si se mueve `city.ts` es aceptable.** `readFileSync` tira y el test falla en rojo, con la ruta en el mensaje. Se descartó un `existsSync` previo: agregaría una guarda para un caso que ya falla de forma visible.
- **Sin test que fije el export ni el uso en `tech.ts`.** El issue no lo pide, y acoplaría `city.test.ts` a otra escena. El typecheck ya protege el export (`tech.ts:9`).
- **Sin script de navegador.** El cambio no toca la UI ni el render, así que no hay verificación con `agent-browser`.

## Grilling

- Rounds: 1 (the revisions were local: one assertion dropped and the commit step and grep command fixed, so no second round).
- Questions: 16. By source: CODE 12, ISSUE 2, DOC 1, NO SOURCE 1 (technical assumption).
- Answers:
  1, 8. CODE: `src/scenes/city.ts:10` is the only line containing `brokenTone` (`grep -n`).
  2. CODE: `src/lab/page.test.ts:1,24` and `src/scenes/ships-reference.test.ts:1,10` use `readFileSync` + `new URL(..., import.meta.url)`.
  3, 4. NO SOURCE → technical assumption: the `tech.ts`/export assertions were dropped (see Assumptions).
  5. CODE: `src/scenes/city-pieces.ts:28` is `export const brokenTone = ...` (moot now).
  6. CODE: `src/scenes/city.test.ts:1` starts with the vitest import, with no `vi.mock` and no env directive. There is no ESLint config in the repo.
  7. CODE: `vitest.config.ts` uses `environment: "node"`. `ships-reference.test.ts` in the same folder already imports `node:fs`.
  9. CODE: `city.ts` uses `PLINTH_H` 16x, `lamp` 7x, `plazaTone` 2x (`:145`), `prism` 34x, `tiles` 3x (`:98`, `:145`).
  10. DOC (pipeline): red test in stage 3, fix in stage 4. Step 5 now commits only `city.ts`.
  11. DOC: `.factory/config.toml` gives `test = "npm test"` and `lint = "npm run typecheck"`. `build` comes from `package.json` and from the issue criterion.
  12. Step 4 now runs `test -f` before `! grep`.
  13. CODE: `city.ts:98` calls `tiles(rng, b, 0.05, "leafDark")` with the default tone. The `scene()` helper in `city.test.ts` runs `city()` for every test.
  14. ISSUE (Agent Brief, nicolas-ricc): "No se activa `noUnusedLocals` en este cambio." / Out of scope: "Activar `noUnusedLocals` / `noUnusedParameters`".
  15. Technical assumption: ENOENT is accepted (see Assumptions).
  16. CODE: there is no `eslint.config*` or `.eslintrc*`. `.factory/config.toml`: "No linter is configured".
- Assumptions added: ENOENT accepted; no assertion on the export or on `tech.ts`.
- Issues opened: none.
- Status: ok
