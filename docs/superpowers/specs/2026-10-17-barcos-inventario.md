# Inventario de los conjuntos de barcos (antes de #85)

**Fecha:** 2026-10-17
**Estado:** "antes" completo; "después" pendiente (#88)
**Issues:** #85 (regresión de los barcos), #86 (este inventario). Lo completa el hijo de verificación de #85.
**Alcance:** inventario verificado en código y en el sitio de todos los conjuntos de assets de barco, tal como están antes de #85 (`main` 9dc191c, que era la base de `feature/85-barcos-semirrecta` antes de #87; las referencias a código de este documento son a ese commit), con capturas y conteos por frame. No cambia código.

Las capturas viven en `assets/85-barcos/`. Cada una se tomó con agent-browser, viewport 1600 × 900 a 2x (PNG de 3200 × 1800), sin cambiar nada de `src/`.

## Inventario

La tabla sale de `grep -n 'kind: "hull"\|boya\|bote\|lancha\|buoy\|wreck' src/scenes/*.ts` y de las capturas. "Correcto" es la lectura visual del conjunto en la captura: casco, superestructura, luces y estela completos, sin tapar ni superponerse mal, y con el fade solo en el sangrado y no a la vista. Los botes salvavidas y las balsas que llevan los kits de `ships.ts` (bote salvavidas del carguero en `ships.ts:62`, bote del remolcador en `ships.ts:125`) son piezas del barco, no un conjunto aparte, y se cuentan en la fila del barco.

| Conjunto | Archivo | Instancias simultáneas | Instancias por ciclo | Dónde | Animación | Correcto |
|---|---|---|---|---|---|---|
| `cargo`, `tug`, `barge` (carguero, remolcador solo, empujador con barcaza) | `src/scenes/ships.ts` (kits), `src/scenes/sea-anim.ts` (`SHIPS`, `shipStateAt`) | 3 barcos, 2 o 3 a la vista según la fase (ver el ciclo) | 3 (uno por fase 0, 1/3, 2/3) (ver Ciclo de los barcos) | Carril de ida y de vuelta sobre la bahía y el mar abierto; zarpe y atraque en la dársena del astillero | Se mueven por los carriles, con estela de espuma y luces (`magentaMid` de tope, `magenta` a babor y `cyanMid` a estribor). Desvanecido (`alphaAt`) solo en los últimos 30 u (`FADE_U`) del extremo de mar de cada carril, a pleno en el fondeadero. Pausa de 24 s (`BERTH_MS`) en `BERTH` con giro en el lugar entre los 8 y 16 s (`BERTH_TURN_MS`). No se anima el casco ni los botes salvavidas | sí, sin tapados ni solapes; fade solo en el sangrado (ver abajo): [antes-cover](assets/85-barcos/antes-cover.png), [antes-recorrido](assets/85-barcos/antes-recorrido.png) |
| `ferry` (lancha colectiva) | `src/scenes/ships.ts`, `src/scenes/sea-anim.ts` (`FERRY_ROUTE`) | 1 | 1 | Entre el muelle de la feria y el de graneles, parando 4 s en cada punta | Camina `FERRY_ROUTE` sin suavizado de giro; estela corta y luces. Sin fade (alpha 1, `sea-anim.ts:159`). La cabina no se anima | sí: [antes-lancha](assets/85-barcos/antes-lancha.png) |
| pecio partido | `src/scenes/sea.ts` (`wreck()`) | 1 (dos mitades visibles: proa y casa de popa) | 1 (estático) | Fosa, junto a la boya del pecio | Nada: sin luces ni estela; solo los anillos de espuma del agua | sí, como pecio: [antes-pecio](assets/85-barcos/antes-pecio.png) |
| boya del pecio | `src/scenes/sea.ts` (`buoysAndWreck()`, `WRECK_BUOY`) | 1 | 1 (estática) | Pegada a la casa de popa del pecio | Cilindro `steel` con luz fija `magentaMid` y anillo de espuma; no parpadea | sí: [antes-pecio](assets/85-barcos/antes-pecio.png) |
| boyas de canal (2) | `src/scenes/sea.ts` (`BUOYS`, `buoysAndWreck()`) | 2, en (420, 80) y (430, 160) | 2 (estáticas) | Canal, al oeste del pecio | Luz rosa que parpadea desfasada (`sea-anim.ts`, `buoyOn`): nunca las dos apagadas. El cilindro no se mueve | sí: [antes-pecio](assets/85-barcos/antes-pecio.png), una encendida y la otra apagada |
| casco en construcción (quilla y cuadernas, grada 1) | `src/scenes/shipyard.ts` (`slipways()`, `i === 0`) | 1 | 1 (estático) | Grada 1 del astillero, bajo la grúa pórtico | Sin animación del casco; las chispas de soldadura (`weldSpots`) son un acento aparte | sí, esqueleto a la vista: [antes-darsena](assets/85-barcos/antes-darsena.png) |
| casco entero en grada 2 | `src/scenes/shipyard.ts` (`slipways()`, `hull` de 74 × 10 u) | 1 | 1 (estático) | Grada 2 del astillero | Sin animación | sí en geometría; la popa queda parcialmente tapada por las chimeneas, sólidos estáticos: [antes-darsena](assets/85-barcos/antes-darsena.png) |
| casco en el dique seco | `src/scenes/shipyard.ts` (`dryDock()`, `DOCK` (120, 6), 72 × 24, z = −6) | 1 | 1 (estático) | Dársena, arriba a la derecha en el encuadre del astillero | Sin animación | sí: casco oxidado hundido en el dique, completo: [antes-darsena](assets/85-barcos/antes-darsena.png) |
| botes del muelle de la feria | `src/scenes/fair.ts:199` (`hull` de 5 u, `bayShoreX(y) - 9`) | 4, en y = −284, −256, −228, −200 | 4 (estáticos) | Franja de arena de la feria | Sin animación, sin luces ni estela. Los visibles se leen como elipses claras; el 4 es nítido, junto a una sombrilla | parcial: el bote 3, en (247, −228), queda enterrado en el tramo de entarimado del muelle (`fair.ts` ~98-102, x 240..248, y −228..−210, z 0..0,6). No está bajo la sombra del muelle sino dentro del sólido, así que cuenta como tapado por sólidos estáticos. Los otros tres, sí: [antes-feria-botes](assets/85-barcos/antes-feria-botes.png) |

Fade de los barcos: en código el alpha baja de 1 solo dentro de `FADE_U` del extremo de mar de cada carril, y esos extremos caen fuera del cover, en (376, 640) a la ida y (430, 655) a la vuelta. En el time-lapse las estelas llegan al borde inferior izquierdo del cover a pleno brillo, así que el fade no se ve: ocurre en el sangrado.

Resultado del grep: no aparece ningún otro conjunto de barcos fuera de estas filas. Los demás `kind: "hull"` están en los tests o son los de las filas de arriba.

### Ciclo de los barcos

Medido en código con `.scratch/cycle.ts` (el script está al final de esta sección). Las constantes son de `src/scenes/sea-anim.ts`.

- `CYCLE_MS` = 1 805 380 ms (unos 1805 s, 30 min).
- Ida (`OUT`): 796 168 ms, carril de 955,4 u a 1,2 u/s.
- Fuera de pantalla (`OFF_MS`): 15 000 ms.
- Vuelta (`BACK`): 970 212 ms, carril de 1164,3 u.
- Atraque (`BERTH_MS`): 24 000 ms, con un giro en el lugar entre los 8 y los 16 s.
- Fases de los tres barcos: 0, 1/3 y 2/3 del ciclo.

Proporción del ciclo que pasan los tres barcos en cada combinación de estados, muestreando cada 100 ms:

| combinación | proporción |
|---|---|
| 2 de ida + 1 de vuelta | 32,4 % |
| 1 de ida + 2 de vuelta | 61,3 % |
| 1 de ida + 1 de vuelta + 1 atracado | 3,9 % |
| 1 de ida + 1 de vuelta + 1 fuera de pantalla | 2,4 % |

Es decir que casi siempre hay tres barcos navegando y solo en un 6,3 % del ciclo hay uno atracado o fuera de pantalla.

```ts
// .scratch/cycle.ts, se corre con: npx tsx .scratch/cycle.ts
import { CYCLE_MS, OFF_MS, BERTH_MS, laneLength, LANE_SPEED, shipStateAt, SHIPS } from "../src/scenes/sea-anim";
const OUT = laneLength("out")/LANE_SPEED*1000, BACK = laneLength("back")/LANE_SPEED*1000;
console.log({CYCLE_MS, OUT, BACK, OFF_MS, BERTH_MS, out: laneLength("out"), back: laneLength("back")});
const combos = new Map<string, number>();
for (let t=0;t<CYCLE_MS;t+=100){ const key = SHIPS.map(s=>shipStateAt((t+s.phase*CYCLE_MS)%CYCLE_MS).lane).join(","); combos.set(key,(combos.get(key)??0)+100); }
for (const [k,v] of combos) console.log(k, (v/1000).toFixed(1)+"s", (100*v/CYCLE_MS).toFixed(1)+"%");
```

## Conteos por frame (PixiJS DevTools)

Se tomaron con la extensión PixiJS DevTools 2.3.1 en agent-browser (HeadlessChrome, Pixi 8.20.1, renderer webgl2) y `window.__PIXI_DEVTOOLS_WRAPPER__.rendering.capture()`, como indica `CLAUDE.md`. La columna "Página" dice de dónde sale cada fila: el sitio (`/map/lab/world.html`, ver el método) o el lab real (`/lab/world.html`). Todas las filas están en el encuadre cover: contenedor en (625,63; 157,14), escala 1,4904 a 1600 × 900. `meshes`, `texts`, `masks`, `tilingSprites` y `nineSliceSprites` dan 0 en todas.

| # | Página | Instante | Estado de los barcos (leído de la captura) | containers | graphics | sprites | filters | instrucciones | renderTime ms |
|---|---|---|---|---|---|---|---|---|---|
| 1 | sitio, carga A | ~+3 s | carguero frente a la grada y el fondeadero; remolcador con barcaza en mar abierto al SE; remolcador solo al SO; lancha en la orilla de la feria | 9 | 105 | 0 | 3 | 63 | 0,40 |
| 2 | sitio, carga B | ~+35 s | igual, con corrimientos de pocos px | 9 | 105 | 0 | 3 | 63 | 0,40 |
| 3 | sitio, carga B | +3 s del anterior | igual | 9 | 105 | 0 | 3 | 63 | 0,50 |
| 4 | sitio, carga B | ~+80 s | carguero un poco al E; lancha ya a la izquierda del muelle de la feria | 9 | 105 | 0 | 3 | 63 | 0,30 |
| 5 | sitio, carga C | ~+30 s | carguero casi en el fondeadero; los otros dos en mar abierto | 8 | 82 | 0 | 2 | 53 | 4,70 |
| 6 | sitio, carga C | ~+130 s | carguero en camino hacia el E, lancha salida de la feria | 8 | 82 | 0 | 2 | 53 | 0,30 |
| 7 | lab (`/lab/world.html`, tecla 4) | 2026-10-17 20:52:56 UTC | cover; sin lectura de tramos por barco | 8 | 82 | 0 | 2 | 53 | 0,50 |
| 8 | lab (`/lab/world.html`, tecla 4) | 20:53:32 UTC, 36 s después | cover; sin lectura de tramos por barco | 8 | 82 | 0 | 2 | 53 | 0,40 |

Observaciones:

- `drawCalls` dio 0 en todas las capturas: en headless no es fiable. Valen `totals` e `instructions`.
- Los barcos son `Graphics`: no suman sprites ni meshes. Los totales no cambian con el movimiento de los barcos, aunque sí a lo largo de una misma carga (ver el punto siguiente); el mundo estático está cacheado en pocos objetos.
- Los totales no son constantes: 9/105/3/63 (containers/graphics/filters/instrucciones) en las filas 1 a 4 y 8/82/2/53 en las demás. La causa no está verificada. Coincide con la tarea diferida del bloom (`attachBloom` en `scheduleIdle`, después del primer dibujo): los conteos altos salen primero y bajan después, así que no es el bloom sumándose. Una explicación posible es que el bloom se prueba encendido, mide 60 frames y, a ~2 fps en headless, pasa el presupuesto de 15 ms y queda en `fallback`, que quita el filtro; no se verificó. En el lab, el primer conteo de esta sesión dio 9/105/3/63 y unos 40 s después, en la misma carga, 8/82/2/53. El renderTime de 4,70 ms de la fila 5 es un pico aislado.
- El estado por barco entre instantes no se puede leer: la página no expone `state(k)`. Cerca del cover, el carguero (el barco que sale del astillero) está junto al fondeadero; no se afirma nada de los tramos entre un instante y otro.

## Método del time-lapse

- **URL.** La que da el issue, `http://localhost:5173/map/lab/world.html`, no sirve el lab. `vite.config.ts:4` fija `base: "/"`, así que esa ruta cae al `index.html` del sitio (`src/main.ts`, título "Nicolás Riccomini"). El lab real es `http://localhost:5173/lab/world.html` (`src/lab/world.ts` y `page.ts`). Por eso todas las capturas y conteos de las filas 1 a 6, y el time-lapse, se tomaron en el sitio, en su encuadre cover (contenedor en (625,63; 157,14), escala 1,4904 a 1600 × 900). Ahí las teclas 0 a 6 y `?speed=` no se aplican. Las filas 7 y 8 se tomaron en el lab real, apretando 4. El sitio es lo que ve un visitante, así que vale como "antes".
- **Velocidad.** Headless corre a unos 2 fps, y el ticker de Pixi acota `deltaMS` a 100 ms (`_maxElapsedMS`). En el lab, `?speed=N` rinde solo unos 0,2·N s simulados por s real. No alcanza.
- **Método A.** En cambio se llamó al listener del ticker de la página con `deltaMS` = 15 000 ms por cuadro, sin tocar `src/`. En cada `requestAnimationFrame` se hace `renderer.render(stage)` y, en la misma tarea, `drawImage` del canvas sobre un acumulador con `globalCompositeOperation = "lighten"`. El `lighten` no saturó el fondo, así que no hizo falta la variante de diferencia.
- **Duración.** 170 cuadros, 170 × 15 s = 2550 s simulados (1,41 × `CYCLE_MS`), en unos 133 s reales (~1,3 fps), desde el estado inicial de la página. Cada cuadro avanza 18 u de ruta.
- **Qué no es ruta.** Los rastros de la lancha y de las luces de la noria y la grúa pórtico (zonas de la feria y del astillero) salen del `lighten` y no son rutas de barcos.

Para obtener el ticker de la app se parchea `Ticker.prototype.update` un momento, para tomar el que tiene `_minElapsedMS` y dejarlo en `window.__tk`. El import lleva el hash de Vite del momento (`?v=...`; hay que tomarlo del bundle servido). Paso previo, `.scratch/hook-ticker.js`:

```js
(async()=>{const m=await import('/node_modules/.vite/deps/pixi__js.js?v=730f03ea');const P=m.Ticker.prototype;const o=P.update;let tk=null;P.update=function(t){if(this._minElapsedMS)tk=this;return o.call(this,t)};await new Promise(r=>setTimeout(r,2000));P.update=o;window.__tk=tk;return String(tk._head.next._fn).slice(0,100)})()
```

Bucle, `.scratch/hook2.js` (`accA` es el acumulado `lighten` que se exporta como PNG; `accB` es la variante por diferencia contra el cuadro 0, que no se usó):

```js
(() => { const w = __PIXI_DEVTOOLS_WRAPPER__, src = w.canvas; const l = __tk._head.next; const fn = l._fn, ctx = l._context; const DT = 15000;
const mk=()=>{const c=document.createElement('canvas');c.width=src.width;c.height=src.height;return c}; const f0=mk(), tmp=mk(), accB=mk(), accA=mk(); const g0=f0.getContext('2d'), gt=tmp.getContext('2d'), gB=accB.getContext('2d'), gA=accA.getContext('2d'); gB.fillStyle='#000'; gB.fillRect(0,0,accB.width,accB.height); gB.globalCompositeOperation='lighten'; gA.globalCompositeOperation='lighten';
const T = window.__tl = { accA, accB, n: 0, t0: performance.now(), simMs: 0, run: true, DT };
const loop = () => { if (!T.run) return; fn.call(ctx, { deltaMS: DT }); T.simMs += DT; w.renderer.render(w.stage); gA.drawImage(src,0,0); if(T.n===0){g0.drawImage(src,0,0);} else { gt.globalCompositeOperation='copy'; gt.drawImage(f0,0,0); gt.globalCompositeOperation='difference'; gt.drawImage(src,0,0); gB.drawImage(tmp,0,0);} T.n++; requestAnimationFrame(loop); };
requestAnimationFrame(loop); return 'ok'; })()
```

## Antes

![time-lapse del recorrido viejo](assets/85-barcos/antes-recorrido.png)

El recorrido viejo, tal como queda en el time-lapse: el barco sale de la dársena del astillero, sube por la bahía, sale por la bocana y rodea la punta por el este (x ≥ 500). Después vira al SSW hacia la esquina inferior izquierda del cover y sale de pantalla. La vuelta entra por abajo, sube por el lado este y cruza la bahía hacia el norte. Se ven los tres barcos con ida y vuelta, el time-lapse cubre 1,41 ciclos, así que cada barco hace al menos una ida y una vuelta completas.

### Capturas por conjunto y encuadres

Para repetir cada captura (#88): el contenedor es `stage.children[0]`; el punto de mundo (x, y) se proyecta con sx = x − y, sy = (x + y)/2 (`src/iso/project.ts`), y la posición es `(W/2 − sx·s, H/2 − sy·s)` con W × H = 1600 × 900 px CSS. El encuadre manual dura hasta la próxima tecla o `resize`, que llaman a `fit()` (`src/lab/page.ts`).

| Captura | x | y | s | Posición del contenedor | Conjuntos |
|---|---|---|---|---|---|
| [antes-cover](assets/85-barcos/antes-cover.png) | encuadre inicial del sitio, o tecla 4 en el lab | | 1,4904 | (625,63; 157,14) | barcos, lancha, todo el mundo |
| [antes-darsena](assets/85-barcos/antes-darsena.png) | 185 | 48 | 4 | (252, −16) | gradas 1 y 2, dique seco |
| [antes-pecio](assets/85-barcos/antes-pecio.png) | 437,5 | 132,5 | 6 | (−1030, −1260) | pecio, boya del pecio, boyas de canal |
| [antes-lancha](assets/85-barcos/antes-lancha.png) | 262 | −160 | 3,5 | (−677; 271,5) | lancha. No se reencuadró siguiendo a la lancha: se mueve y no se expone su posición |
| [antes-feria-botes](assets/85-barcos/antes-feria-botes.png) | 236,5 | −241,5 | 11 | (−4458; 477,5) | botes de la feria (antes 264, −242, s = 8) |

La posición de `antes-cover` se verificó también en el lab real a 1600 × 900. Sin desplazamiento extra: la proyección se calibró con la boya del pecio en (470, 160).

## Después

pendiente: lo completa el hijo de verificación de #85
