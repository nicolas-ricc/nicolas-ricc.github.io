# Capturas «antes» de la composición responsive

**Fecha:** 2026-11-18
**Commit:** `main` 6cbbe9e (`src/` sin cambios)

Línea base visual de [la spec](../../../2026-11-18-composicion-responsive-design.md) §5, tomada antes de recomponer. Corresponde a los issues #423 (padre) y #424 (esta tarea). El set «después» lo repite #429 con la misma secuencia.

## Viewport y escala

El nombre de cada archivo lleva el viewport CSS `W×H`. Todas las capturas se toman a escala 2, así que cada PNG mide 2W×2H. Herramienta: agent-browser 0.27.0, headless, con HeadlessChrome 156. El dev server sirve `http://localhost:5173/`.

## Cómo se esperó

Cada captura reabre la página (`set viewport` y después `open`), de modo que ningún tamaño hereda el estado de un resize. Antes de capturar se espera, en este orden:

1. la clase `mapa-listo` en `<html>`;
2. la línea de consola `[mapa] bloom:` (en el lab, `[lab] bloom:`), que sale al terminar de medir 60 cuadros: en headless tarda entre 9 y 50 s según la página;
3. 3 s más.

El veredicto del bloom fue `fallback` en las diez páginas. En el lab no hay `mapa-listo`: se espera `[lab] bloom:`, se pulsa `1` (encuadre Portfolio) y se esperan 3 s.

## Secuencia de comandos

```sh
export AGENT_BROWSER_SESSION=capt424
D=docs/superpowers/specs/assets/423-composicion-responsive/antes

# mapa y blog: repetir por cada W H (URL: / o /area/blog/)
agent-browser set viewport W H 2
agent-browser console --clear
agent-browser open http://localhost:5173/
until [ "$(agent-browser eval "document.documentElement.classList.contains('mapa-listo')")" = true ]; do sleep 1; done
until agent-browser console | grep -q '\[mapa\] bloom:'; do sleep 2; done   # tope: 120 s
sleep 3
agent-browser screenshot $D/mapa-WxH.png

# lab
agent-browser set viewport 1600 900 2
agent-browser console --clear
agent-browser open http://localhost:5173/lab/world.html
until agent-browser console | grep -q '\[lab\] bloom:'; do sleep 2; done
agent-browser press 1
sleep 3
agent-browser screenshot $D/boca-lab-1600x900.png
```

## Qué se ve

Las posiciones son fracciones del ancho y del alto de la imagen.

- `mapa-390x750.png`: vertical. RESUME entero, centro-izquierda. PORTFOLIO cortado por el borde derecho («PORTFOLI»). Writing dentro de la ventana, pegado al borde derecho, chico y en sans común. Faro fuera de cuadro (a la derecha). Barcos abajo y mucho mar vacío.
- `mapa-430x932.png`: igual composición que 390×750. RESUME entero, PORTFOLIO cortado («PORTFO»), Writing dentro cerca del borde derecho, faro fuera de cuadro.
- `mapa-820x1180.png`: RESUME y PORTFOLIO enteros (PORTFOLIO arriba, a la derecha del centro). Writing pegado al borde derecho pero sin cortarse. Faro fuera de cuadro. El astillero se corta a la derecha.
- `mapa-1024x768.png`: apaisado. RESUME, PORTFOLIO y Writing dentro; Writing en tipografía script, a la izquierda de la base del faro. Faro a la derecha (~87 % x, ~55 % y).
- `mapa-1366x1024.png`: mismo encuadre que 1024×768 (misma proporción 4:3). Los tres carteles y el faro dentro, en las mismas posiciones relativas.
- `mapa-1600x900.png`: los tres carteles dentro. Faro dentro (~65 % x, ~55 % y). Queda a la derecha un mar oscuro vacío de ~35 % del ancho; arriba a la derecha, el borde del mundo y la noria.
- `mapa-1920x955.png`: como 1600×900. Tres carteles dentro, faro dentro (~64 % x, ~56 % y), mar vacío a la derecha y mucho espacio sin usar.
- `blog-1920x955.png`: el mapa ocupa ~40 % a la izquierda y el artículo el resto, a la derecha y casi vacío. Writing (brillante, zona activa) y el faro dentro del panel del mapa; el resto del mapa, atenuado. RESUME atenuado en el borde izquierdo; PORTFOLIO cortado por ese borde («FOLIO»).
- `blog-390x750.png`: apilado, mapa arriba (~40 %) y artículo abajo. El encabezado «Volver al mapa» / «Writing» se superpone al mapa; RESUME atenuado choca con el título «Writing». Writing chico, con el faro cerca. PORTFOLIO cortado arriba a la izquierda. La mitad inferior de la página queda vacía.
- `boca-lab-1600x900.png`: `/lab/world.html` con encuadre Portfolio, a mayor escala que en el mapa. Cartel PORTFOLIO entero, RESUME a la izquierda, astillero con su grúa, muelle de alistamiento (rayado amarillo y negro) en la boca. Cabo con el faro abajo a la derecha (~77 % x, ~92 % y). Writing cortado por el borde inferior. Noria arriba a la derecha.
