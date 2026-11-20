# Legibilidad, nivel 3

Generado por `npm run legibility`; no se edita a mano.

Fecha: 2026-11-20

Viewport: 1600×900 @2

Tick: 15838 ms

Preproceso del OCR, igual para todos los carteles: luminancia relativa (WCAG) por píxel, escalado ×3 por vecino más cercano y umbral binario en el punto medio entre la mediana del núcleo y la del anillo; la tinta (el lado del núcleo) queda negra sobre blanco. tesseract.js con datos `eng` 4.0.0_best_int locales, modo de página palabra única (PSM 8) y lista blanca A–Z a–z. En un cartel de suelo (`ground`) el OCR solo ve lo que el oráculo garantiza respaldado: los píxeles fuera de la caja de tinta de cada letra más el margen de respaldo (`backingW` · ancho, en su plano) quedan blancos, así el borde de la balsa no entra como un marco.

## cartel-taller-escena a 1.17

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 6.60:1 | ≥ 4.5:1 | ✓ |
| halo | 0.08 | ≤ 0.5 | ✓ |
| OCR | `PORTFOLIO` | = `PORTFOLIO` | ✓ |

![cartel-taller-escena 1.17](cartel-taller-escena-117-t15838.png) ![OCR](cartel-taller-escena-117-t15838-ocr.png)

## cartel-taller-escena a 0.83

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 5.75:1 | ≥ 3:1 | ✓ |
| halo | 0.08 | ≤ 0.5 | ✓ |
| OCR | `PORTFOLIO` | ≈ `PORTFOLIO` (sin mayúsculas) | ✓ |

![cartel-taller-escena 0.83](cartel-taller-escena-083-t15838.png) ![OCR](cartel-taller-escena-083-t15838-ocr.png)

## cartel-torre-escena a 1.17

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 10.44:1 | ≥ 4.5:1 | ✓ |
| halo | 0.05 | ≤ 0.5 | ✓ |
| OCR | `RESUME` | = `RESUME` | ✓ |

![cartel-torre-escena 1.17](cartel-torre-escena-117-t15838.png) ![OCR](cartel-torre-escena-117-t15838-ocr.png)

## cartel-torre-escena a 0.83

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 9.58:1 | ≥ 3:1 | ✓ |
| halo | 0.04 | ≤ 0.5 | ✓ |
| OCR | `RESUME` | ≈ `RESUME` (sin mayúsculas) | ✓ |

![cartel-torre-escena 0.83](cartel-torre-escena-083-t15838.png) ![OCR](cartel-torre-escena-083-t15838-ocr.png)

## plataforma-escena a 1.17

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 7.99:1 | ≥ 4.5:1 | ✓ |
| halo | 0.01 | ≤ 0.5 | ✓ |
| OCR | `WRITING` | = `WRITING` | ✓ |

![plataforma-escena 1.17](plataforma-escena-117-t15838.png) ![OCR](plataforma-escena-117-t15838-ocr.png)

## plataforma-escena a 0.83

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 7.99:1 | ≥ 3:1 | ✓ |
| halo | 0.01 | ≤ 0.5 | ✓ |
| OCR | `WRITING` | ≈ `WRITING` (sin mayúsculas) | ✓ |

![plataforma-escena 0.83](plataforma-escena-083-t15838.png) ![OCR](plataforma-escena-083-t15838-ocr.png)

## plataforma-escena-angosta a 1.17

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 7.99:1 | ≥ 4.5:1 | ✓ |
| halo | 0.01 | ≤ 0.5 | ✓ |
| OCR | `WRITING` | = `WRITING` | ✓ |

![plataforma-escena-angosta 1.17](plataforma-escena-angosta-117-t15838.png) ![OCR](plataforma-escena-angosta-117-t15838-ocr.png)

## plataforma-escena-angosta a 0.83

| Métrica | Valor | Umbral | ✓/✗ |
| --- | --- | --- | --- |
| contraste | 7.99:1 | ≥ 3:1 | ✓ |
| halo | 0.01 | ≤ 0.5 | ✓ |
| OCR | `WRITING` | ≈ `WRITING` (sin mayúsculas) | ✓ |

![plataforma-escena-angosta 0.83](plataforma-escena-angosta-083-t15838.png) ![OCR](plataforma-escena-angosta-083-t15838-ocr.png)

## Nivel 2 (checkSign)

Sin violaciones.
