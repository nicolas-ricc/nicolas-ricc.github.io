/**
 * Primitivas puras de los neones animados, compartidas por las escenas: un
 * pulso de intensidad, un chase de luces corredizas y un cambio de color por
 * paso. Sin estado: todo deriva del reloj o del paso que pasa el animador.
 */

/** Pulso 0..1 cuantizado: 1 en fase 0 (frame 0 encendido). */
export function pulse(clockMs: number, periodMs: number, phase = 0): number {
  return 0.5 + 0.5 * Math.cos(2 * Math.PI * (clockMs / periodMs + phase));
}

/** Qué índices de n están encendidos en un chase de `lit` luces que avanza un lugar por paso. */
export function chase(n: number, step: number, lit: number): boolean[] {
  return Array.from({ length: n }, (_, k) => (((k - step) % n) + n) % n < lit);
}

/** Alterna entre dos colores por paso: par → a, impar → b. */
export function flip<T>(step: number, a: T, b: T): T {
  return step % 2 === 0 ? a : b;
}
