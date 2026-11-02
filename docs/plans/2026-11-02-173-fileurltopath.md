# Raíz del repo con `fileURLToPath` en los tests (#173): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que ningún test arme una ruta de disco con `new URL(…, import.meta.url).pathname`, para que la suite pase en un checkout cuya ruta tenga espacios o caracteres no ASCII.

**Architecture:** reemplazo mecánico de `new URL(X, import.meta.url).pathname` por `fileURLToPath(new URL(X, import.meta.url))` (de `node:url`) en las 9 apariciones de 8 archivos de test. Un test guard nuevo, `scripts/file-url.test.ts`, recorre `src/` y `scripts/` y falla si el patrón vuelve a aparecer. Un script de evals en `.scratch/evals-173.md`, que no se versiona, corre la suite desde una copia del repo en una ruta con espacio y con tilde.

**Tech Stack:** TypeScript, Vitest, `node:url`.

**Spec:** issue #173. El comentario del dueño suma #160 (`src/lab/docs.test.ts:4`), que es una de las 9 apariciones.

## Global Constraints

- El patrón que se elimina es `grep -rn "import.meta.url).pathname" src scripts`, y al terminar ese comando no devuelve nada.
- La forma correcta es `fileURLToPath(new URL("../../", import.meta.url))` de `node:url`, la que usa `scripts/agent-docs.test.ts:5` desde #99.
- Apariciones (9, en 8 archivos):
  - `src/iso/pixi-free.test.ts:5` (`ROOT`)
  - `src/lab/boot.test.ts:38` (`ROOT`)
  - `src/lab/docs.test.ts:4` (`ROOT`, #160)
  - `src/lab/host.test.ts:4` (`ROOT`)
  - `src/lab/lab-excluded.test.ts:4` (`ROOT`)
  - `src/lab/page.test.ts:26` (`ROOT`)
  - `src/map/palette-guard.test.ts:6` (`SRC`) y `:36` (`LAB`)
  - `src/map/seed.test.ts:40` (`ROOT`)
- Los usos que pasan un objeto `URL` directo a `fs` (`readFileSync(new URL(…))`, `src/map/background.test.ts`, `src/scenes/ships-reference.test.ts`, `scripts/barcos-inventario.test.ts`) ya son correctos, porque `fs` decodifica la URL. No se tocan.
- Solo cambian archivos de test. Ningún código de producción cambia.
- Commits `test(#173): …` y `fix(#173): …`.

## Decisiones técnicas (declaradas)

1. **La barra final se conserva.** `fileURLToPath` de una URL de directorio (`file:///work/`) devuelve `/work/`, con la barra. Los usos existentes concatenan con template strings (`` `${ROOT}lab/…` ``), así que el valor sigue siendo intercambiable y esos usos no cambian.
2. **El guard vive en `scripts/`.** Cubre `src/` y `scripts/`, el mismo alcance que el `grep` del issue. Ya está en el `include` de `vitest.config.ts`.
3. **El guard no se detecta a sí mismo.** Busca con la regex `/import\.meta\.url\)\.pathname/`. Su texto fuente lleva barras invertidas, así que no contiene la cadena literal que busca.
4. **La prueba con espacios va en un script y no en un test unitario.** Correr Vitest dentro de Vitest desde otra ruta es caro y frágil. El eval copia el repo a `/tmp/mis proyectos/mapá/`, enlaza `node_modules` y corre la suite **completa**. Ya se corrió antes del cambio y dio `8 failed | 91 passed (99)`: fallaron exactamente los 8 archivos de la lista, todos con `ENOENT … '/tmp/mis%20proyectos/map%C3%A1/…'`. Los otros 91 archivos pasaron desde esa ruta, así que Vitest en sí no tiene problema con el espacio ni con la tilde.

## Review Focus

1. **Ruta con espacio o con tilde.** Es el caso del issue. La cubre el eval de `.scratch/evals-173.md`, que se corre en la Task 2.
2. **Los guards no pueden quedar vacíos sin avisar.** `palette-guard` y `pixi-free` recorren directorios a partir de `SRC`, `LAB` y `ROOT`. Una ruta mal resuelta haría que `readdirSync` tire error o que no encuentre archivos. Los tests existentes "encuentra los fuentes de …" ya fijan el conteo mínimo y no hay que agregar nada.
3. **`relative(ROOT, f)` en `pixi-free`.** Compara contra `PIXI_TESTS` (rutas relativas). `fileURLToPath` devuelve una ruta POSIX absoluta, igual que antes, así que `relative` da lo mismo. Lo cubre el test existente "cada test de PIXI_TESTS existe".
4. **Una regresión futura.** Un test nuevo que copie el patrón viejo lo detecta el guard de la Task 1.
5. **El guard tiene que leer algo.** Si su propia raíz estuviera mal, no encontraría archivos y pasaría en vacío. Por eso exige que se lean `scripts/agent-docs.test.ts` y `src/lab/docs.test.ts`.

---

### Task 1: Guard contra `import.meta.url).pathname`

**Files:**
- Create: `scripts/file-url.test.ts`
- Create (no versionado): `.scratch/evals-173.md`

**Interfaces:**
- Produces: `describe("guard de rutas desde import.meta.url (#173)")`, que falla hasta que la Task 2 termine.

- [ ] **Step 1: Escribir el test**

`ROOT = fileURLToPath(new URL("../", import.meta.url))`. Una función recursiva `testSources(dir)` junta los `.ts` de `src/` y `scripts/`, del mismo estilo que `sourceFiles` en `palette-guard`, pero sin excluir los `.test.ts`. Tests:

```ts
it("recorre src/ y scripts/", () => {
  expect(files.map((f) => relative(ROOT, f))).toEqual(expect.arrayContaining(["scripts/agent-docs.test.ts", "src/lab/docs.test.ts"]));
});
it("ningún archivo arma una ruta con URL.pathname", () => {
  const hits = files.filter((f) => /import\.meta\.url\)\.pathname/.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
  expect(hits).toEqual([]);
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx vitest run scripts/file-url.test.ts`
Expected: FAIL. `hits` lista los 8 archivos de Global Constraints.

- [ ] **Step 3: Escribir `.scratch/evals-173.md`**

Es un Markdown con un único bloque ` ```bash `. Se corre con `sed -n '/^```bash$/,/^```$/{/^```/d;p}' .scratch/evals-173.md | bash`, y el bloque hace esto:
- `D="/tmp/mis proyectos/mapá"`, y `rm -rf "$D"` para arrancar limpio.
- Copia el árbol de trabajo con `tar --exclude=./node_modules --exclude=./.git`, porque la máquina no tiene `rsync`.
- Crea el enlace `ln -sfn <repo>/node_modules "$D/node_modules"`.
- Corre `npx vitest run` (la suite completa) y la salida va a `/tmp/evals-173.log`.

Resultado esperado: exit 0 y ningún `ENOENT` en el log. Agregar `.scratch/` a `.git/info/exclude`. El resultado (antes y después) va a la descripción del PR, que es la evidencia durable.

- [ ] **Step 4: Commit**

```bash
git add scripts/file-url.test.ts
git commit -m "test(#173): evals"
```

### Task 2: Reemplazar `.pathname` por `fileURLToPath`

**Files:**
- Modify: los 8 archivos de Global Constraints (9 líneas).

**Interfaces:**
- Consumes: el guard de la Task 1.

- [ ] **Step 1: Reemplazar en cada archivo**

En cada aparición, `new URL(X, import.meta.url).pathname` pasa a `fileURLToPath(new URL(X, import.meta.url))`. En cada archivo, agregar `import { fileURLToPath } from "node:url";` junto a los otros imports de `node:`, y conservar el comentario `// src/` de `palette-guard.test.ts:6`.

- [ ] **Step 2: Correr el guard y los 8 archivos**

Run: `npx vitest run scripts/file-url.test.ts src/iso/pixi-free.test.ts src/lab/boot.test.ts src/lab/docs.test.ts src/lab/host.test.ts src/lab/lab-excluded.test.ts src/lab/page.test.ts src/map/palette-guard.test.ts src/map/seed.test.ts`
Expected: PASS.

- [ ] **Step 3: Correr el eval con espacios**

Run: `sed -n '/^```bash$/,/^```$/{/^```/d;p}' .scratch/evals-173.md | bash`
Expected: exit 0. La suite completa pasa (99 archivos más el guard) y no hay ningún `ENOENT`.

- [ ] **Step 4: Suite completa y typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. `grep -rn "import.meta.url).pathname" src scripts` no devuelve nada.

- [ ] **Step 5: Commit**

```bash
git add src/iso/pixi-free.test.ts src/lab/boot.test.ts src/lab/docs.test.ts src/lab/host.test.ts src/lab/lab-excluded.test.ts src/lab/page.test.ts src/map/palette-guard.test.ts src/map/seed.test.ts
git commit -m "fix(#173): rutas de test con fileURLToPath"
```

## Assumptions

- **Solo POSIX.** CI corre en `ubuntu-latest` (`.github/workflows/deploy.yml:17`) y los usos existentes ya concatenan con `/`. No se adapta nada para Windows. Se descartó usar `path.join` en todos los usos: es un cambio más grande que el issue no pide.
- **El guard replica el `grep` del issue.** Busca el literal `import.meta.url).pathname`. Se descartó un análisis más amplio (por ejemplo, `.pathname` sobre una `URL` guardada en una variable): el issue define las apariciones con ese `grep`.
- **El eval corre la suite completa y no solo los 8 archivos.** El objetivo es que la suite pase desde esa ruta.
- **La caché de Vitest se escribe en el `node_modules` real a través del symlink** (`node_modules/.vite`). Es inocua y está gitignoreada.
- **El test rojo entra al branch antes del fix.** El commit `test(#173): evals` va solo en el branch del agente. El PR se abre con el fix ya aplicado.

## Grilling

- Rounds: 1 (griller model: fable). 15 preguntas.
- Fuentes: CODE 10 (1, 2, 6, 7, 8, 9, 11, 13 y 15 citan el código o la corrida del eval; 3 cita `deploy.yml`), ISSUE 2 (5 y 12), NO SOURCE → supuesto técnico 3 (4, 10 y 14).
- Cambios en el plan: el eval es un Markdown con un bloque bash, usa `tar` en vez de `rsync`, borra la copia anterior, corre la suite completa y quedó verificado antes del cambio (8 de 99 archivos fallan con ENOENT). El commit del fix nombra los archivos uno por uno. Se agregó `## Assumptions`.
- Spec ambiguities: ninguna. Issues abiertos: ninguno.
