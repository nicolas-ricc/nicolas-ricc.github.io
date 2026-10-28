/**
 * Traslado de la planta (maltería, tanque de agua, playa de camiones y faroles) al lugar nuevo (#246).
 * Cada escena dibuja en su marco local, el de antes del traslado, y lo mueve `(−15, +90)` a mundo.
 * Todo lo exportado por las escenas está en coordenadas de mundo; el marco local es privado.
 */
export const PLANT_SHIFT = { x: -15, y: 90 } as const;
