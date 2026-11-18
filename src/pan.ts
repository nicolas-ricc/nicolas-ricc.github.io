/** Map drag and key mapping. Pixi-free and DOM-global-free: testable with a fake target. */

export const DRAG_THRESHOLD = 5;
export const KEY_STEP = 0.1;

export interface PanPointer { pointerId: number; clientX: number; clientY: number; button: number }
export interface PanTarget {
  style: { cursor: string; touchAction: string };
  addEventListener(type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", fn: (e: PanPointer) => void): void;
  setPointerCapture(id: number): void;
  releasePointerCapture(id: number): void;
}
export interface PanOptions { onStart(): void; onPan(dx: number, dy: number): void }
export interface Pan {
  readonly dragging: boolean;
  setEnabled(on: boolean): void;
  /** True once after a drag ended; the next pointerdown resets it. */
  consumeClick(): boolean;
}

/** One-pointer drag with a click threshold. Starts disabled. */
export function attachPan(el: PanTarget, opts: PanOptions): Pan {
  let enabled = false, dragging = false, suppress = false;
  let id: number | null = null;
  let startX = 0, startY = 0, lastX = 0, lastY = 0;
  const rest = () => { el.style.cursor = enabled ? "grab" : "pointer"; };
  const end = (armClick: boolean) => {
    if (id === null) return;
    try { el.releasePointerCapture(id); } catch { /* pointer already gone */ }
    suppress = armClick && dragging;
    id = null;
    dragging = false;
    rest();
  };
  rest();
  el.addEventListener("pointerdown", (e) => {
    if (!enabled) return;
    suppress = false;
    if (id !== null || e.button !== 0) return;
    id = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    try { el.setPointerCapture(id); } catch { /* inactive or synthetic pointer: drag works while over the canvas */ }
  });
  el.addEventListener("pointermove", (e) => {
    if (!enabled || e.pointerId !== id) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
      dragging = true;
      el.style.cursor = "grabbing";
      opts.onStart();
    }
    opts.onPan(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  el.addEventListener("pointerup", (e) => { if (e.pointerId === id) end(true); });
  el.addEventListener("pointercancel", (e) => { if (e.pointerId === id) end(false); });
  return {
    get dragging() { return dragging; },
    setEnabled(on) {
      if (on === enabled) return;
      end(false);
      enabled = on;
      el.style.touchAction = on ? "none" : "";
      rest();
    },
    consumeClick() { const s = suppress; suppress = false; return s; },
  };
}

/** Arrow keys pan by KEY_STEP of the host side toward where the key points; `0`/Home recenter. */
export function keyPan(
  e: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean },
  w: number,
  h: number,
): { dx: number; dy: number } | "home" | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  switch (e.key) {
    case "ArrowRight": return { dx: -KEY_STEP * w, dy: 0 };
    case "ArrowLeft": return { dx: KEY_STEP * w, dy: 0 };
    case "ArrowDown": return { dx: 0, dy: -KEY_STEP * h };
    case "ArrowUp": return { dx: 0, dy: KEY_STEP * h };
    case "0": case "Home": return "home";
    default: return null;
  }
}
