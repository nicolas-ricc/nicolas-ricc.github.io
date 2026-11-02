# mapa — notes for agents

Also read `README.md` (architecture, scripts) and `.factory/config.toml`
(test, typecheck and dev server commands). The site is served at the root `/`
(`base: "/"` in `vite.config.ts`); the lab pages, at `/lab/<page>.html`.
The domain vocabulary is in `CONTEXT.md` and the architecture decisions are
in `docs/adr/`.

## PixiJS DevTools in agent-browser

The **PixiJS DevTools** extension (v2.3.1, https://github.com/pixijs/devtools)
is installed, unpacked, on this machine:

    ~/.agent-browser/extensions/pixijs-devtools/ext

It does not load by itself: it has to be passed on every launch. `--extension` forces
*headed* mode and agent sessions have no `$DISPLAY`, so headless is forced
again through `--args`:

    export AGENT_BROWSER_SESSION=pixi            # separate session, optional
    agent-browser set viewport 1600 900 2         # readable screenshots (2x)
    agent-browser --extension ~/.agent-browser/extensions/pixijs-devtools/ext \
      --args "--headless=new" open http://localhost:5173/lab/world.html

In headless agent-browser the page runs at ~2 fps, and Pixi's Ticker clamps
`deltaMS` to 100 ms (`_maxElapsedMS`): `?speed=N` yields only ~0.2·N simulated
seconds per real second. For a time-lapse you have to call the ticker's
listener with a fixed `deltaMS` and accumulate the frames, as in the
[time-lapse method](docs/superpowers/specs/2026-10-17-barcos-inventario.md#método-del-time-lapse).

The extension's visual panel cannot be seen from the CLI; what is useful to an agent
is the API it injects into the page, queryable with `agent-browser eval`.
Pixi v8 calls the `__PIXI_APP_INIT__` / `__PIXI_RENDERER_INIT__` hooks when it
initializes, so the site and the lab pages get hooked without touching
code (there is no need to publish `window.__PIXI_APP__`):

    # did it hook? version, renderer, stage children
    agent-browser eval "(() => { const w = window.__PIXI_DEVTOOLS_WRAPPER__;
      return JSON.stringify({ active: w.isPixiActive, ver: w.version,
        renderer: w.rendererType, stageKids: w.stage.children.length }); })()"
    # → {"active":"pixi-active","ver":"8.20.1","renderer":"webgl2","stageKids":1}

    # x-ray of a frame: count by type, filters, instructions, time
    agent-browser eval "(async () => { const r = await
      window.__PIXI_DEVTOOLS_WRAPPER__.rendering.capture();
      return JSON.stringify({ totals: r.totals, drawCalls: r.drawCalls,
        renderTime: r.renderTime, instructions: r.instructions.length }); })()"
    # → totals: {containers, graphics, meshes, sprites, texts, filters, masks, …}

What `window.__PIXI_DEVTOOLS_WRAPPER__` exposes: `isPixiActive`, `version`,
`rendererType`, `stage`, `renderer`, `canvas`, `pixi`, `rendering.capture()`
(render instructions with `type`/`action`/`drawCalls`/`drawTextures`),
`textures.getWebTextures()` / `textures.getMemorySize()`. `scene.getStats()`
throws an error without the panel open: to walk the tree use `w.stage`
directly. In a headless capture `drawCalls` came out 0 with 63
instructions: trust `totals` and `instructions`, not that number.
`window.__PIXI_DEVTOOLS__` also carries `{ renderer, stage, version, extensions }`.

In the factory container `.factory/setup.sh` installs it (an optional step, it does
not fail the run). To reinstall it by hand on another machine:

    mkdir -p /tmp/pixidev && cd /tmp/pixidev
    gh release download v2.3.1 -R pixijs/devtools -p chrome.zip
    unzip -q chrome.zip && mkdir -p ~/.agent-browser/extensions/pixijs-devtools
    mv dist/chrome ~/.agent-browser/extensions/pixijs-devtools/ext

Verified 2026-10-17 with agent-browser 0.26.0 and HeadlessChrome 148 on
`lab/world.html`.
