# mapa — notas para agentes

Leer también `README.md` (arquitectura, scripts) y `.factory/config.toml`
(comandos de test, typecheck y dev server). El sitio se sirve en la raíz `/`
(`base: "/"` en `vite.config.ts`); las páginas del lab, en `/lab/<página>.html`.

## PixiJS DevTools en agent-browser

La extensión **PixiJS DevTools** (v2.3.1, https://github.com/pixijs/devtools)
está instalada, desempaquetada, en esta máquina:

    ~/.agent-browser/extensions/pixijs-devtools/ext

No se carga sola: hay que pasarla en cada lanzamiento. `--extension` fuerza
modo *headed* y las sesiones de agente no tienen `$DISPLAY`, así que se vuelve
a forzar headless por `--args`:

    export AGENT_BROWSER_SESSION=pixi            # sesión aparte, opcional
    agent-browser set viewport 1600 900 2         # capturas legibles (2x)
    agent-browser --extension ~/.agent-browser/extensions/pixijs-devtools/ext \
      --args "--headless=new" open http://localhost:5173/lab/world.html

En agent-browser headless la página corre a ~2 fps, y el Ticker de Pixi acota
`deltaMS` a 100 ms (`_maxElapsedMS`): `?speed=N` rinde solo ~0,2·N segundos
simulados por segundo real. Para un time-lapse hay que llamar al listener del
ticker con un `deltaMS` fijo y acumular los cuadros, como en el
[método del time-lapse](docs/superpowers/specs/2026-10-17-barcos-inventario.md#método-del-time-lapse).

El panel visual de la extensión no se ve desde la CLI; lo útil para un agente
es la API que inyecta en la página, consultable con `agent-browser eval`.
Pixi v8 llama a los ganchos `__PIXI_APP_INIT__` / `__PIXI_RENDERER_INIT__` al
inicializar, así que el sitio y las páginas del lab quedan enganchados sin
tocar código (no hace falta publicar `window.__PIXI_APP__`):

    # ¿enganchó? versión, renderer, hijos del stage
    agent-browser eval "(() => { const w = window.__PIXI_DEVTOOLS_WRAPPER__;
      return JSON.stringify({ active: w.isPixiActive, ver: w.version,
        renderer: w.rendererType, stageKids: w.stage.children.length }); })()"
    # → {"active":"pixi-active","ver":"8.20.1","renderer":"webgl2","stageKids":1}

    # radiografía de un frame: conteo por tipo, filtros, instrucciones, tiempo
    agent-browser eval "(async () => { const r = await
      window.__PIXI_DEVTOOLS_WRAPPER__.rendering.capture();
      return JSON.stringify({ totals: r.totals, drawCalls: r.drawCalls,
        renderTime: r.renderTime, instrucciones: r.instructions.length }); })()"
    # → totals: {containers, graphics, meshes, sprites, texts, filters, masks, …}

Qué expone `window.__PIXI_DEVTOOLS_WRAPPER__`: `isPixiActive`, `version`,
`rendererType`, `stage`, `renderer`, `canvas`, `pixi`, `rendering.capture()`
(instrucciones del render con `type`/`action`/`drawCalls`/`drawTextures`),
`textures.getWebTextures()` / `textures.getMemorySize()`. `scene.getStats()`
tira error sin el panel abierto: para recorrer el árbol usar `w.stage`
directamente. En una captura headless `drawCalls` salió 0 con 63
instrucciones: fiarse de `totals` e `instructions`, no de ese número.
`window.__PIXI_DEVTOOLS__` trae además `{ renderer, stage, version, extensions }`.

En el contenedor de factory la instala `.factory/setup.sh` (paso opcional, no
falla el run). Para reinstalarla a mano en otra máquina:

    mkdir -p /tmp/pixidev && cd /tmp/pixidev
    gh release download v2.3.1 -R pixijs/devtools -p chrome.zip
    unzip -q chrome.zip && mkdir -p ~/.agent-browser/extensions/pixijs-devtools
    mv dist/chrome ~/.agent-browser/extensions/pixijs-devtools/ext

Verificado 2026-10-17 con agent-browser 0.26.0 y HeadlessChrome 148 sobre
`lab/world.html`.
