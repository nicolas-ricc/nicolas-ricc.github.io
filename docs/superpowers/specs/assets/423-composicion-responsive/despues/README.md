# Capturas "después" de la composición responsive

**Fecha:** 2026-11-18
**Commit:** rama `agent/429-verificacion-cierre`, con `PLATFORM_SITES.wide` = (570, 105). El sitio ancho se corrió 20 u al noreste en la etapa de revisión de #429; ver "Barcos contra Writing". Todo el set se retomó después del cambio.

Repite la secuencia de [antes](../antes/README.md) sobre el código terminado de #423 (cierra #429). Compara con la spec §5.

## Viewport y escala

El nombre de cada archivo lleva el viewport CSS `W×H`. Todas las capturas se toman a escala 2: cada PNG mide 2W×2H. Herramienta: agent-browser 0.27.0, headless, con HeadlessChrome 156. El dev server sirve `http://localhost:5173/` (host `localhost`, no `127.0.0.1`).

## Cómo se esperó

Cada captura de mapa, blog y lab reabre la página (`set viewport` y después `open`). Antes de capturar se espera, en este orden:

1. la clase `mapa-listo` en `<html>`;
2. la línea de consola `[mapa] bloom:` (en el lab, `[lab] bloom:`);
3. 3 s más.

Tope de 120 s por espera. El veredicto del bloom fue `fallback` en las nueve páginas de mapa y blog. Las capturas de rotación no reabren: ver su sección.

## Secuencia de comandos

El set entero sale de este script (`sh cap429.sh` desde la raíz del repo, con el dev server levantado):

```sh
#!/bin/sh
# Capture set "después" of #429. Needs the dev server on localhost:5173.
set -e
export AGENT_BROWSER_SESSION=cap429
D=docs/superpowers/specs/assets/423-composicion-responsive/despues
ab() { agent-browser "$@"; }
wait_ready() { # $1 = console tag ("[mapa] bloom:" or "[lab] bloom:"), $2 = 1 when the page sets mapa-listo
  if [ "$2" = 1 ]; then for i in $(seq 60); do [ "$(ab eval "document.documentElement.classList.contains('mapa-listo')")" = true ] && break; sleep 2; done; fi
  for i in $(seq 60); do ab console | grep -qF "$1" && break; sleep 2; done
  ab console | grep -F "$1" | tail -1
  sleep 3
}
shot_page() { # W H URL OUT
  ab set viewport "$1" "$2" 2 >/dev/null; ab console --clear >/dev/null; ab open "http://localhost:5173$3" >/dev/null
  wait_ready "[mapa] bloom:" 1; ab screenshot "$D/$4" >/dev/null; echo "$4"
}
for s in 390x750 430x932 820x1180 1024x768 1366x1024 1600x900 1920x955; do shot_page "${s%x*}" "${s#*x}" / "mapa-$s.png"; done
shot_page 1920 955 /area/blog/ blog-1920x955.png
shot_page 390 750 /area/blog/ blog-390x750.png
# mouth
ab set viewport 1600 900 2 >/dev/null; ab console --clear >/dev/null; ab open http://localhost:5173/lab/world.html >/dev/null
wait_ready "[lab] bloom:" 0; ab press 1 >/dev/null; sleep 3; ab screenshot "$D/boca-lab-1600x900.png" >/dev/null; echo boca
# rotation without reload
Q='(() => { const a = document.querySelector("#zonas a[data-zone=\"blog\"]"), r = a.getBoundingClientRect();
  return JSON.stringify({ marker: window.__rot429, transform: a.style.transform, centre: [((r.x + r.width / 2) / innerWidth).toFixed(3), ((r.y + r.height / 2) / innerHeight).toFixed(3)] }); })()'
ab set viewport 900 1440 2 >/dev/null; ab console --clear >/dev/null; ab open http://localhost:5173/ >/dev/null; wait_ready "[mapa] bloom:" 1
ab eval "window.__rot429 = Date.now()" >/dev/null
echo "900x1440: $(ab eval "$Q")"; ab screenshot "$D/rotacion-900x1440.png" >/dev/null
ab set viewport 1440 900 2 >/dev/null; sleep 1; echo "1440x900: $(ab eval "$Q")"; ab screenshot "$D/rotacion-1440x900.png" >/dev/null
ab screenshot "$D/rotacion-vuelta-1440x900.png" >/dev/null
ab set viewport 900 1440 2 >/dev/null; sleep 1; echo "900x1440 back: $(ab eval "$Q")"; ab screenshot "$D/rotacion-vuelta-900x1440.png" >/dev/null
# ships vs Writing: lab at ?speed=0.001 (clock nearly frozen), key 4, the app ticker's listener called with deltaMS 5e6 = 5 s simulated
V=$(curl -s localhost:5173/src/lab/page.ts | grep -o 'pixi__js.js?v=[a-z0-9]*' | head -1)
ab set viewport 1600 900 2 >/dev/null; ab console --clear >/dev/null; ab open "http://localhost:5173/lab/world.html?speed=0.001" >/dev/null
wait_ready "[lab] bloom:" 0; ab press 4 >/dev/null; sleep 2
ab eval "(async()=>{const m=await import('/node_modules/.vite/deps/$V');const P=m.Ticker.prototype,o=P.update;let tk=null;P.update=function(t){if(this._minElapsedMS)tk=this;return o.call(this,t)};await new Promise(r=>setTimeout(r,2000));P.update=o;window.__tk=tk;window.__sim=0;return !!tk})()" >/dev/null
n=0
for t in 100 155 490 790 810; do
  n=$((n + 1))
  ab eval "(()=>{const l=__tk._head.next;const k=Math.round(($t-__sim)/5);for(let i=0;i<k;i++)l._fn.call(l._context,{deltaMS:5e6});__sim+=5*k;return __sim})()" >/dev/null
  sleep 2; ab screenshot "$D/barcos-lab-1600x900-$n.png" >/dev/null; echo "barcos $n t=$t"
done
ab close >/dev/null
```

## Qué se ve

Las posiciones son fracciones del ancho y del alto de la imagen.

- `mapa-390x750.png`: vertical. Los tres carteles enteros: RESUME centro-izquierda, PORTFOLIO arriba a la derecha, Writing abajo (~(0,63; 0,84)). El cabo con el faro, dentro de cuadro a la derecha. Sin rótulo de borde (el de emergencia de Writing de "antes" ya no aparece). Un barco chico a la derecha de Writing, sin pisarlo.
- `mapa-430x932.png`: igual composición que 390×750. Tres carteles enteros, Writing abajo; el faro asoma pegado al borde derecho pero visible con su cabo. Sin rótulo de borde. Un barco asoma por el borde derecho, lejos del cartel.
- `mapa-820x1180.png`: tres carteles enteros, Writing abajo a la derecha del centro, faro entero con su cabo. Boca del astillero con el muelle rayado y mar, sin huecos ni terreno suelto. Sin rótulo de borde. Barco a la derecha de Writing, separado.
- `mapa-1024x768.png`: apaisado 4:3. Tres carteles enteros; Writing abajo, en tipografía script, bajo el cabo; faro entero en el cabo de la costa este. Los barcos quedan a la derecha de Writing, sin tapar letras ni cubierta.
- `mapa-1366x1024.png`: mismo encuadre que 1024×768 (misma proporción). Tres carteles y faro en las mismas posiciones relativas. Ningún barco sobre Writing.
- `mapa-1600x900.png`: Writing abajo a la derecha (~(0,82; 0,70)), así que el mar de la derecha queda ocupado. Tres carteles enteros, faro dentro, cabo sin terreno suelto. Borde del mundo arriba a la derecha. Los barcos quedan abajo a la izquierda de Writing, sin pisarlo.
- `mapa-1920x955.png`: como 1600×900. Tres carteles enteros, faro dentro, Writing a la derecha. Ningún barco sobre Writing.
- `blog-1920x955.png`: el mapa ocupa ~40 % a la izquierda y el artículo el resto. Writing entero y brillante en el panel del mapa, con el faro abajo a la izquierda y los barcos abajo, lejos del cartel. El resto del mapa, atenuado. RESUME y PORTFOLIO, fuera del panel, quedan como rótulos de emergencia atenuados en el borde izquierdo (PORTFOLIO cortado, "FOLIO").
- `blog-390x750.png`: apilado, mapa arriba (~40 %). Writing entero, chico y brillante, bajo el faro, que se ve completo. El encabezado "Volver al mapa" / "Writing" se superpone al mapa (PORTFOLIO queda detrás del encabezado), como en "antes". El ~40 % inferior de la página queda vacío.
- `boca-lab-1600x900.png`: `/lab/world.html`, encuadre Portfolio. Cartel PORTFOLIO entero, RESUME a la izquierda, astillero con su grúa, muelle de alistamiento (rayado amarillo y negro) que termina en agua. A la derecha, mar y la isla del astillero de contenedores; sin huecos ni terreno suelto donde estaba el cabo.
- `rotacion-900x1440.png`: vertical, sitio tall. Writing abajo, centro (0,609; 0,840). Tres carteles y faro enteros.
- `rotacion-1440x900.png`: tras girar sin recargar. Sitio wide: Writing abajo a la derecha, centro (0,916; 0,703), entero. Tres carteles y faro enteros.
- `rotacion-vuelta-1440x900.png`: control tomado antes de volver, mismo estado que `rotacion-1440x900.png` (sin recargar).
- `rotacion-vuelta-900x1440.png`: tras volver a 900×1440 sin recargar. Composición idéntica a `rotacion-900x1440.png`: Writing abajo, centro (0,609; 0,840), mismo `transform`.
- `barcos-lab-1600x900-1.png`: lab, tecla `4` (cover 16:9), t sim = 100 s: carguero de ida en su pasada más cercana (54 u en pantalla). Queda arriba a la izquierda, lejos de Writing.
- `barcos-lab-1600x900-2.png`: t sim = 155 s, barcaza de vuelta (17 u). Pasa a la izquierda de Writing, con mar de por medio.
- `barcos-lab-1600x900-3.png`: t sim = 490 s, remolcador de vuelta (32 u). A la izquierda de Writing, sin cruce.
- `barcos-lab-1600x900-4.png`: t sim = 790 s, carguero de vuelta, el cuadro en que en (550, 125) la proa tocaba la W. Ahora el casco queda a la izquierda del cartel, con mar de por medio.
- `barcos-lab-1600x900-5.png`: t sim = 810 s, carguero de vuelta en su pasada más cercana (2,9 u entre las cajas en pantalla). No toca letras ni cubierta.

## Rotación sin recargar

Marcador: `window.__rot429 = Date.now()` tras la espera a 900×1440. Se lee `document.querySelector('#zonas a[data-zone="blog"]').style.transform` y el centro de su `getBoundingClientRect()` como fracción del viewport. Se cambia con `agent-browser set viewport W H 2` sin `open` (sin recargar) y se espera 1 s.

| Paso | Viewport | marcador | `transform` | centro (x; y) |
|---|---|---|---|---|
| 1 | 900×1440 | 1795033855470 | `translate(447.6px, 1181.3px)` | (0,609; 0,840) |
| 2 | 1440×900 | 1795033855470 (igual) | `translate(1255.9px, 615.4px)` | (0,916; 0,703) |
| 3 | 900×1440 | 1795033855470 (igual) | `translate(447.6px, 1181.3px)` | (0,609; 0,840) |

El marcador se mantiene en ambos sentidos (no hubo recarga) y el `transform` cambia en ambos: la plataforma pasa del sitio tall (440, 400) al wide (570, 105) y vuelve. Esperado: tall ≈ (0,5–0,65; 0,84). Con el sitio wide corrido 20 u, el centro de Writing en 1440×900 pasa de ~0,87 a 0,916: la caja de la palabra sigue entera, con el margen de `WRITING_SITE_MARGIN`, porque `writingSite` eligió wide.

## Barcos contra Writing (desktop, 1600×900)

**Primera pasada (sitio (550, 125)).** Se tomaron cuatro cuadros en las pasadas más cercanas por distancia al centro del sitio, y ninguno mostraba un cruce. La revisión de código recalculó los tiempos con el convenio del reloj del lab: el barco k está, en el tiempo simulado t, en `shipStateAt((t + fase_k·CYCLE_MS) mod CYCLE_MS)`, como en `createSeaAnim`. Con ese convenio, el carguero de vuelta llega a su pasada más cercana a t ≈ 790..810 s, y ese cuadro no se había capturado. En t = 790 s la proa del carguero quedaba pegada a la W. La caja en pantalla de sus piezas entraba en la caja de la palabra (23 posiciones del carril con 2 u de paso), así que competía con el cartel a simple vista.

**Ajuste.** Como pide #429, el sitio ancho se corrió hacia el noreste de a 5 u. Con 5, 10 y 15 u la caja seguía tocada; con 20 u (el máximo) queda a 2,9 u proyectadas. `PLATFORM_SITES.wide` = (570, 105). El test "no ship piece's screen box reaches the box of the Writing word at the wide site" de `src/scenes/sea-anim.test.ts` lo fija.

**Tiempos.** Salen de este test descartable: copiarlo a `src/` y correrlo con vitest. Para cada barco y carril da el tiempo de menor distancia entre las cajas en pantalla y la palabra (paso de 500 ms):

```ts
// Run: cp .scratch/ship-times-429.test.ts src/zz-ship-times.test.ts && npx vitest run src/zz-ship-times.test.ts; rm src/zz-ship-times.test.ts
// Lab clock convention: ship k at simulated time t is shipStateAt((t + phase_k·CYCLE_MS) mod CYCLE_MS) (createSeaAnim).
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { screenBounds } from "./iso/depth";
import { bounds } from "./iso/solids";
import { signBox, zoneSigns } from "./world/signs";
import { CYCLE_MS, SHIPS, laneAt, shipStateAt } from "./scenes/sea-anim";
import { ship, shipAt } from "./scenes/ships";
it("ship times", () => {
  const box = signBox(zoneSigns("wide").blog), out: string[] = [];
  for (let k = 0; k < SHIPS.length; k++) {
    const kind = SHIPS[k]!.kind;
    for (const lane of ["out", "back"] as const) {
      let best = { g: Infinity, t: 0 };
      for (let t = 0; t < CYCLE_MS; t += 500) {
        const s = shipStateAt((t + SHIPS[k]!.phase * CYCLE_MS) % CYCLE_MS);
        if (s.lane !== lane) continue;
        const p = laneAt(lane, s.dist);
        for (const so of ship(kind, shipAt(kind, p, s.heading), s.heading).solids) {
          const b = screenBounds(bounds(so));
          const g = Math.hypot(Math.max(0, box.minX - b.maxX, b.minX - box.maxX), Math.max(0, box.minY - b.maxY, b.minY - box.maxY));
          if (g < best.g) best = { g, t };
        }
      }
      out.push(`${kind} ${lane} t=${best.t / 1000}s gap=${best.g.toFixed(1)}`);
    }
  }
  writeFileSync("/tmp/ship-times-429.out", out.join("\n") + "\n");
}, 60_000);
```

| Barco | Carril | t sim (s) | Distancia en pantalla (u) |
|---|---|---|---|
| carguero | ida | 99,5 | 54,2 |
| carguero | vuelta | 809,5 | 2,9 |
| remolcador | ida | 744 | 83,9 |
| remolcador | vuelta | 492,5 | 32,3 |
| barcaza | ida | 415,5 | 66,7 |
| barcaza | vuelta | 157 | 17,1 |

**Captura.** El lab se carga con `?speed=0.001`, que deja el reloj de los animadores casi congelado (t0 ≈ 0). Después se llama al listener del ticker de la app con `deltaMS` = 5 000 000, es decir 5 s simulados por llamada. El ticker se obtiene parcheando un momento `Ticker.prototype.update` (ver el script de arriba y el [método del time-lapse](../../../2026-10-17-barcos-inventario.md#método-del-time-lapse)). Los cuadros caen en 100, 155, 490, 790 y 810 s, redondeados a 5 s.

**Veredicto.** Con (570, 105) ningún barco cruza ni compite con Writing: siempre queda mar entre el casco y el cartel.
