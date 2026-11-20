# Balanceo de la balsa de tablones de Writing (#451, #456)

Subibaja, cabeceo y rolido de cuerpo rígido. La pose esperada de cada captura sale de `poseAt(t)` (`src/scenes/sign-platform.ts`): `HEAVE` (±0.15 u, 6700 ms), `PITCH` (±1.5°, 9100 ms, alrededor de n) y `ROLL` (±1.0°, 7300 ms, alrededor de u), cuantizados a `HEAVE_STEP` (0.01 u) y `ANGLE_STEP` (0.1°).

- `balanceo-1.png` — t = 0 ms: dz 0.00, pitch 0.0°, roll 0.0° (poseAt): pose de reposo.
- `balanceo-2.png` — t = 1675 ms: dz +0.15, pitch +1.4°, roll +1.0° (poseAt): cuarto de `HEAVE`, extremo superior.
- `balanceo-3.png` — t = 3350 ms: dz 0.00, pitch +1.1°, roll +0.3° (poseAt): medio periodo de `HEAVE`; la balsa sigue inclinada.
- `balanceo-4.png` — t = 5025 ms: dz −0.15, pitch −0.5°, roll −0.9° (poseAt): tres cuartos de `HEAVE`, extremo inferior.
- `balanceo-5.png` — t = 7919 ms: dz +0.14, pitch −1.1°, roll +0.5° (poseAt): cabeceo y rolido en fases opuestas.
- `balanceo-6.png` — t = 15838 ms: dz +0.11, pitch −1.5°, roll +0.9° (poseAt): cabeceo en su extremo, rolido casi en el suyo.

Los cuatro primeros instantes son los cuartos de `HEAVE`, como en el time-lapse de #445 (`../../441-tabla-flotante/`, que queda como historia). Los dos últimos son `k · 7919` ms, los mismos instantes que muestrea `CYCLE_POSES`.

## Cómo se tomaron

Se abrió `http://localhost:5173/lab/blog.html?bloom=on&speed=0.000001` con agent-browser y la extensión PixiJS DevTools (ver `CLAUDE.md`), con viewport de 1600×900 @2 (3200×1800) y bloom activado. Con `speed=0.000001` el reloj de los animadores casi no avanza solo: unos 1e-4 ms por cuadro.

El ticker se enganchó con el [método del time-lapse](../../../2026-10-17-barcos-inventario.md#método-del-time-lapse). Se parchea `Ticker.prototype.update` por un momento, se recorren los listeners de los tickers y se toma el que contiene `stage.tick(` (`src/lab/page.ts`). `balanceo-1` se capturó antes de cualquier llamada. Cada captura siguiente se obtuvo llamando a ese listener una sola vez con `deltaMS = Δt / 0.000001`, con Δt = 1675, 1675, 1675, 2894 y 7919 ms, y después `renderer.render(stage)`. La página pasa `ticker.deltaMS * speed` a `stage.tick`, así que el reloj recibe Δt. Se verificó que `poseAt` de la suma acumulada en coma flotante (y de esa suma + 0.01 ms) da la misma pose que `poseAt(t)` en los seis instantes.

No se usó el storybook: sus exhibiciones de contexto quitan el animador de la plataforma y muestran la pose de reposo.

Verificación de píxeles. La caja de pantalla de la balsa son las esquinas de `PLATFORM_DECK` en el sitio `wide`, a z −1.4 y −0.2, llevadas a píxeles con la posición (51.75, −198.56) y la escala 2.3456 del contenedor del stage; da x 1993..2577, y 1132..1250. Dentro de esa caja, la diferencia absoluta media RGB contra `balanceo-1` es 24.592 en `balanceo-2`, 20.288 en `balanceo-3`, 14.264 en `balanceo-4`, 20.671 en `balanceo-5` y 25.641 en `balanceo-6`. La balsa se mueve en todas, `balanceo-3` incluida, que en #445 era igual al reposo. El agua animada bajo la balsa también entra en la caja.
