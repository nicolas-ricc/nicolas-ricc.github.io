# Balanceo de la tabla flotante de Writing (#441, #445)

- `balanceo-1.png` — t = 0 ms (0), dz esperado 0.00 (heaveAt): pose de reposo.
- `balanceo-2.png` — t = 1675 ms (P/4), dz esperado +0.15 (heaveAt): extremo superior, + `amp`.
- `balanceo-3.png` — t = 3350 ms (P/2), dz esperado 0.00 (heaveAt): pose de reposo.
- `balanceo-4.png` — t = 5025 ms (3P/4), dz esperado −0.15 (heaveAt): extremo inferior, − `amp`.

## Cómo se tomaron

Se abrió `http://localhost:5173/lab/blog.html?bloom=on&speed=0.000001` con viewport 1600×900 @2 (3200×1800), bloom activado, con agent-browser y la extensión PixiJS DevTools. Con `speed=0.000001` el reloj de los animadores casi no avanza solo. Se enganchó el ticker de la app (método del time-lapse de CLAUDE.md: parchar `Ticker.prototype.update`, recorrer los listeners y quedarse con el que contiene `stage.tick(`) y se lo llamó a mano con `deltaMS` = 1675 / 0.000001, de modo que `stage.tick` recibe exactamente P/4 (1675 ms) por llamada, y después se hizo `renderer.render(stage)`. La pose esperada sale de `heaveAt` con `HEAVE` (`amp` 0.15, `periodMs` 6700). No se usó el storybook: sus exhibiciones de contexto quitan el animador de la plataforma y muestran la pose de reposo.

Verificación de píxeles (`.scratch/pose-diff.ts`, caja de pantalla de la tabla, diferencia absoluta media RGB contra `balanceo-1`): `balanceo-2` 3.566, `balanceo-3` 0.009, `balanceo-4` 3.613. Las poses 2 y 4 difieren de la de reposo; la 3 es igual a la 1.
