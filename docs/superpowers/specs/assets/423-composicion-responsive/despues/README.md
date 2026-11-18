# Capturas "después" de la composición responsive

**Fecha:** 2026-11-18
**Commit:** `80675c5` (rama `agent/429-verificacion-cierre`, `src/` sin cambios en esta tarea)

Repite la secuencia de [antes](../antes/README.md) sobre el código terminado de #423 (cierra #429). Compara con la spec §5.

## Viewport y escala

El nombre de cada archivo lleva el viewport CSS `W×H`. Todas las capturas se toman a escala 2: cada PNG mide 2W×2H. Herramienta: agent-browser, headless. El dev server sirve `http://localhost:5173/` (host `localhost`, no `127.0.0.1`).

## Cómo se esperó

Cada captura de mapa, blog y lab reabre la página (`set viewport` y después `open`). Antes de capturar se espera, en este orden:

1. la clase `mapa-listo` en `<html>`;
2. la línea de consola `[mapa] bloom:` (en el lab, `[lab] bloom:`);
3. 3 s más.

Tope de 120 s por espera. El veredicto del bloom fue `fallback` en las nueve páginas de mapa y blog. Las capturas de rotación no reabren: ver su sección.

## Secuencia de comandos

```sh
export AGENT_BROWSER_SESSION=t429
D=docs/superpowers/specs/assets/423-composicion-responsive/despues

# mapa (7 tamaños) y blog (2): reabrir por captura
agent-browser set viewport $W $H 2
agent-browser console --clear
agent-browser open "http://localhost:5173$URL"      # / o /area/blog/
# esperar mapa-listo, luego "[mapa] bloom:", luego sleep 3
agent-browser screenshot "$D/$OUT"

# boca (lab)
agent-browser set viewport 1600 900 2
agent-browser open http://localhost:5173/lab/world.html
# esperar "[lab] bloom:"
agent-browser press 1; sleep 3
agent-browser screenshot "$D/boca-lab-1600x900.png"

# rotación y barcos: ver sus secciones
```

## Qué se ve

Las posiciones son fracciones del ancho y del alto de la imagen.

- `mapa-390x750.png`: vertical. Los tres carteles enteros: RESUME centro-izquierda, PORTFOLIO arriba a la derecha, Writing abajo (~(0,63; 0,84)). El cabo con el faro, dentro de cuadro a la derecha. Sin rótulo de borde (el de emergencia de Writing de "antes" ya no aparece). Un barco chico a la derecha de Writing, sin pisarlo.
- `mapa-430x932.png`: igual composición que 390×750. Tres carteles enteros, Writing abajo; el faro asoma pegado al borde derecho pero visible con su cabo. Sin rótulo de borde. Un barco asoma por el borde derecho, lejos del cartel.
- `mapa-820x1180.png`: tres carteles enteros, Writing abajo a la derecha del centro, faro entero con su cabo. Boca del astillero con el muelle rayado y mar, sin huecos ni terreno suelto. Sin rótulo de borde. Barco a la derecha de Writing, separado.
- `mapa-1024x768.png`: apaisado 4:3. Tres carteles enteros; Writing abajo, en tipografía script, bajo el cabo; faro entero en el cabo de la costa este. Los barcos quedan a la derecha de Writing, sin tapar letras ni cubierta.
- `mapa-1366x1024.png`: mismo encuadre que 1024×768 (misma proporción). Tres carteles y faro en las mismas posiciones relativas. Ningún barco sobre Writing.
- `mapa-1600x900.png`: Writing abajo a la derecha (~(0,78; 0,68)), así que el mar de la derecha queda ocupado. Tres carteles enteros, faro dentro, cabo sin terreno suelto. Borde del mundo arriba a la derecha. Los barcos quedan abajo a la izquierda de Writing, sin pisarlo.
- `mapa-1920x955.png`: como 1600×900. Tres carteles enteros, faro dentro, Writing a la derecha. Ningún barco sobre Writing.
- `blog-1920x955.png`: el mapa ocupa ~40 % a la izquierda y el artículo el resto. Writing entero y brillante en el panel del mapa, con el faro a su izquierda y los barcos debajo. El resto del mapa, atenuado. RESUME y PORTFOLIO, fuera del panel, quedan como rótulos de emergencia atenuados en el borde izquierdo (PORTFOLIO cortado, "FOLIO").
- `blog-390x750.png`: apilado, mapa arriba (~40 %). Writing entero, chico y brillante, bajo el faro, que se ve completo. El encabezado "Volver al mapa" / "Writing" se superpone al mapa (PORTFOLIO queda detrás del encabezado), como en "antes". El ~40 % inferior de la página queda vacío.
- `boca-lab-1600x900.png`: `/lab/world.html`, encuadre Portfolio. Cartel PORTFOLIO entero, RESUME a la izquierda, astillero con su grúa, muelle de alistamiento (rayado amarillo y negro) que termina en agua. A la derecha, mar y la isla del astillero de contenedores; sin huecos ni terreno suelto donde estaba el cabo.
- `rotacion-900x1440.png`: vertical, sitio tall. Writing abajo, centro (0,609; 0,840). Tres carteles y faro enteros.
- `rotacion-1440x900.png`: tras girar sin recargar. Sitio wide: Writing a la derecha, centro (0,874; 0,703). Tres carteles y faro enteros.
- `rotacion-vuelta-1440x900.png`: control tomado antes de volver, mismo estado que `rotacion-1440x900.png` (sin recargar).
- `rotacion-vuelta-900x1440.png`: tras volver a 900×1440 sin recargar. Composición idéntica a `rotacion-900x1440.png`: Writing abajo, centro (0,609; 0,840), mismo `transform`.
- `barcos-lab-1600x900-1.png`: lab, tecla `4` (cover 16:9), t sim = 100 s (barcaza en su pasada más cercana, 70 u del sitio wide). Pasa a la izquierda de Writing con aire entre casco y cartel; no toca letras ni cubierta.
- `barcos-lab-1600x900-2.png`: t sim = 135 s (carguero de ida, 111 u). Dos barcos a la izquierda de Writing, separados; ninguno sobre el cartel.
- `barcos-lab-1600x900-3.png`: t sim = 425 s (remolcador, 70 u). A la izquierda de Writing, sin cruce.
- `barcos-lab-1600x900-4.png`: t sim = 745 s (carguero de vuelta, 70 u). A la izquierda de Writing, sin cruce.

## Rotación sin recargar

Marcador: `window.__rot429 = Date.now()` tras la espera a 900×1440. Se lee `document.querySelector('#zonas a[data-zone="blog"]').style.transform` y el centro de su `getBoundingClientRect()` como fracción del viewport. Se cambia con `agent-browser set viewport W H 2` sin `open` (sin recargar) y se espera 1 s.

| Paso | Viewport | marcador | `transform` | centro (x; y) |
|---|---|---|---|---|
| 1 | 900×1440 | 1795031617181 | `translate(447.6px, 1181.3px)` | (0,609; 0,840) |
| 2 | 1440×900 | 1795031617181 (igual) | `translate(1196.3px, 615.4px)` | (0,874; 0,703) |
| 3 | 900×1440 | 1795031617181 (igual) | `translate(447.6px, 1181.3px)` | (0,609; 0,840) |

El marcador se mantiene en ambos sentidos (no hubo recarga) y el `transform` cambia en ambos: la plataforma pasa del sitio tall (440, 400) al wide (550, 125) y vuelve. Esperado: wide ≈ (0,87; 0,70) ±0,05, tall ≈ (0,5–0,65; 0,84). Cumple.

## Barcos contra Writing (desktop, 1600×900)

Los barcos recorren `LANE_OUT`/`LANE_BACK` con fase de un tercio de ciclo (`CYCLE_MS` 966 970 ms). Con un script descartable (`shipStateAt`/`laneAt`, paso de 500 ms) se calculó el tiempo simulado en que cada barco queda más cerca de `PLATFORM_SITES.wide` = (550, 125):

| Barco | Pasada | t sim (s) | Distancia (u) | Punto (x, y) |
|---|---|---|---|---|
| barcaza | vuelta | 101,5 | 70 | (492, 165) |
| carguero | ida | 137,5 | 111 | (439, 129) |
| remolcador | vuelta | 424 | 70 | (492, 165) |
| carguero | vuelta | 746 | 70 | (492, 165) |

Las tres pasadas de 70 u son las más cercanas de cada barco; la cuarta captura (carguero de ida, 111 u) cubre la ruta de ida.

Para no depender del reloj de pared (headless ~2 fps, `deltaMS` acotado a 100 ms) se cargó el lab con `?speed=0.001` (reloj de los animadores casi congelado, t0 ≈ 0) y se llamó al listener del ticker con `deltaMS` = 5 000 000 (5 s simulados), como en el [método del time-lapse](../../../2026-10-17-barcos-inventario.md#método-del-time-lapse). Los tiempos se alcanzaron en pasos de 5 s: 100, 135, 425 y 745 s (error ≤ 2,5 s, ≤ 3 u).

Veredicto: ningún barco cruza ni compite con Writing; en la pasada más cercana el casco queda a la izquierda del cartel con mar de por medio. `PLATFORM_SITES.wide` no se movió (0 rondas de ajuste).
