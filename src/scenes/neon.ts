/**
 * Pure primitives of the animated neons, shared by the scenes: an intensity
 * pulse, a chase of sliding lights and a color swap per step. Stateless:
 * everything derives from the clock or the step the animator passes.
 */

/** Pulse 0..1: 1 at phase 0 (frame 0 on). The animator quantizes it by passing a stepped clock. */
export function pulse(clockMs: number, periodMs: number, phase = 0): number {
  return 0.5 + 0.5 * Math.cos(2 * Math.PI * (clockMs / periodMs + phase));
}

/** Which of the n indices are on in a chase of `lit` lights that advances one place per step. */
export function chase(n: number, step: number, lit: number): boolean[] {
  return Array.from({ length: n }, (_, k) => (((k - step) % n) + n) % n < lit);
}

/** Alternates between two colors per step: even → a, odd → b. */
export function flip<T>(step: number, a: T, b: T): T {
  return step % 2 === 0 ? a : b;
}
