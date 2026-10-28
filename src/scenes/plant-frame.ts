/**
 * Traslado de la planta al lugar nuevo (#246): `PLANT_SHIFT (−15, +90)`.
 * El marco local de la planta son las coordenadas de mundo de antes del traslado: maltería `x 20..44`,
 * nave `x 44..107`, torre `x 108..113`, `y −46..−1`.
 * Todo lo que se arma en ese marco se emite trasladado con `translate`.
 * El tanque de agua NO se traslada: va a un lugar nuevo, `WATER_TOWER` en `maltings.ts`.
 */
export const PLANT_SHIFT = { x: -15, y: 90 } as const;
