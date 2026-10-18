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
3. **La exportación de `brokenTone` queda.** La usan `tech.ts` y `tiles()`. El test también lo fija, para que nadie "complete" la limpieza borrándola.

## Review Focus

1. Que el import de `./city-pieces` siga trayendo `PLINTH_H`, `lamp`, `plazaTone`, `prism` y `tiles`, que `city.ts` sí usa. Lo cubren `npm run typecheck` y los tests existentes de `city.test.ts`.
2. Que `brokenTone` siga exportado desde `city-pieces.ts`, porque lo usan `tech.ts` y el default de `tiles()`. Lo cubre el segundo `it` de la Task 1.
3. Que `tsconfig.json` no cambie. Se revisa en el diff: la Task 1 no lo toca.
4. Que el render de la ciudad no cambie: `tiles()` ya usaba `brokenTone` como default por su propio import. Lo cubren los tests existentes de `city.test.ts`, que se corren sin tocarlos.
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
  const src = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  it("no importa brokenTone, que no usa", () => {
    expect(src("./city.ts")).not.toMatch(/brokenTone/);
  });
  it("brokenTone sigue exportado para tech.ts y tiles()", () => {
    expect(src("./city-pieces.ts")).toMatch(/export const brokenTone/);
    expect(src("./tech.ts")).toMatch(/brokenTone/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/city.test.ts -t "imports de city.ts"`
Expected: FAIL en "no importa brokenTone, que no usa"; PASS en el otro.

- [ ] **Step 3: Write minimal implementation**

En `src/scenes/city.ts:10`:

```ts
import { PLINTH_H, lamp, plazaTone, prism, tiles } from "./city-pieces";
```

- [ ] **Step 4: Run tests, typecheck and build**

Run: `grep -n brokenTone src/scenes/city.ts; npm test && npm run typecheck && npm run build`
Expected: el grep no imprime nada; los tres comandos en verde.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/city.ts src/scenes/city.test.ts
git commit -m "fix(#50): quitar el import sin uso de brokenTone en city.ts"
```

## Assumptions

- **Ritmo de commits.** En la etapa 3 del pipeline se commitea el test rojo (`test(#50): evals`) y en la 4 la Task 1 (`fix(#50): …`). La PR entra a `main` con squash, así que `main` nunca ve el rojo.
- **Sin script de navegador.** El cambio no toca la UI ni el render, así que no hay verificación con `agent-browser`.
