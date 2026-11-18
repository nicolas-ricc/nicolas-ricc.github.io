import { describe, expect, it, vi } from "vitest";
import { attachPan, keyPan, type PanPointer, type PanTarget } from "./pan";

type Kind = "pointerdown" | "pointermove" | "pointerup" | "pointercancel";

/** Pointer target double: records listeners, fires plain event objects. */
function fakeTarget(opts: { throwOnCapture?: boolean } = {}) {
  const listeners = new Map<Kind, ((e: PanPointer) => void)[]>();
  const el = {
    style: { cursor: "", touchAction: "" },
    addEventListener(type: Kind, fn: (e: PanPointer) => void) { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
    setPointerCapture: vi.fn((_id: number) => { if (opts.throwOnCapture) throw new Error("NotFoundError"); }),
    releasePointerCapture: vi.fn((_id: number) => {}),
    fire(type: Kind, clientX: number, clientY: number, pointerId = 1, button = 0) {
      for (const fn of listeners.get(type) ?? []) fn({ pointerId, clientX, clientY, button });
    },
  };
  return el satisfies PanTarget;
}

function setup(opts: { throwOnCapture?: boolean } = {}) {
  const el = fakeTarget(opts);
  const onStart = vi.fn(), onPan = vi.fn();
  const pan = attachPan(el, { onStart, onPan });
  return { el, pan, onStart, onPan };
}

/** Down at (0, 0), past the threshold to (10, 0). */
function drag(el: ReturnType<typeof fakeTarget>) {
  el.fire("pointerdown", 0, 0);
  el.fire("pointermove", 10, 0);
}

describe("attachPan (#438)", () => {
  it("disabled by default: pointer cursor, no touch-action, no drag", () => {
    const { el, onPan } = setup();
    expect(el.style.cursor).toBe("pointer");
    expect(el.style.touchAction).toBe("");
    el.fire("pointerdown", 0, 0);
    el.fire("pointermove", 50, 0);
    expect(onPan).not.toHaveBeenCalled();
  });

  it("setEnabled toggles cursor and touch-action", () => {
    const { el, pan } = setup();
    pan.setEnabled(true);
    expect(el.style.cursor).toBe("grab");
    expect(el.style.touchAction).toBe("none");
    pan.setEnabled(false);
    expect(el.style.cursor).toBe("pointer");
    expect(el.style.touchAction).toBe("");
  });

  it("below the threshold it is a click", () => {
    const { el, pan, onStart, onPan } = setup();
    pan.setEnabled(true);
    el.fire("pointerdown", 10, 10);
    el.fire("pointermove", 13, 13);
    el.fire("pointerup", 13, 13);
    expect(onStart).not.toHaveBeenCalled();
    expect(onPan).not.toHaveBeenCalled();
    expect(pan.dragging).toBe(false);
    expect(pan.consumeClick()).toBe(false);
  });

  it("crossing the threshold starts a drag with the whole offset", () => {
    const { el, pan, onStart, onPan } = setup();
    pan.setEnabled(true);
    el.fire("pointerdown", 10, 10);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    el.fire("pointermove", 16, 10);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onPan).toHaveBeenLastCalledWith(6, 0);
    expect(pan.dragging).toBe(true);
    expect(el.style.cursor).toBe("grabbing");
    el.fire("pointermove", 20, 13);
    expect(onPan).toHaveBeenLastCalledWith(4, 3);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("a drag suppresses exactly one click", () => {
    const { el, pan } = setup();
    pan.setEnabled(true);
    drag(el);
    el.fire("pointerup", 10, 0);
    expect(el.style.cursor).toBe("grab");
    expect(pan.dragging).toBe(false);
    expect(el.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(pan.consumeClick()).toBe(true);
    expect(pan.consumeClick()).toBe(false);
  });

  it("the next pointerdown clears a pending suppression", () => {
    const { el, pan } = setup();
    pan.setEnabled(true);
    drag(el);
    el.fire("pointerup", 10, 0);
    el.fire("pointerdown", 30, 30);
    el.fire("pointerup", 30, 30);
    expect(pan.consumeClick()).toBe(false);
  });

  it("disabling clears a pending suppression", () => {
    const { el, pan } = setup();
    pan.setEnabled(true);
    drag(el);
    el.fire("pointerup", 10, 0);
    pan.setEnabled(false);
    el.fire("pointerdown", 30, 30);
    el.fire("pointerup", 30, 30);
    expect(pan.consumeClick()).toBe(false);
  });

  it("re-enabling clears a pending suppression", () => {
    const { el, pan } = setup();
    pan.setEnabled(true);
    drag(el);
    el.fire("pointerup", 10, 0);
    pan.setEnabled(false);
    pan.setEnabled(true);
    expect(pan.consumeClick()).toBe(false);
  });

  it("a second pointer is ignored", () => {
    const { el, pan, onPan } = setup();
    pan.setEnabled(true);
    el.fire("pointerdown", 0, 0, 1);
    el.fire("pointerdown", 100, 100, 2);
    el.fire("pointermove", 200, 200, 2);
    expect(onPan).not.toHaveBeenCalled();
    el.fire("pointermove", 10, 0, 1);
    expect(onPan).toHaveBeenLastCalledWith(10, 0);
    el.fire("pointerup", 200, 200, 2);
    expect(pan.dragging).toBe(true);
  });

  it("pointercancel ends the drag without suppressing a click", () => {
    const { el, pan } = setup();
    pan.setEnabled(true);
    drag(el);
    el.fire("pointercancel", 10, 0);
    expect(pan.dragging).toBe(false);
    expect(pan.consumeClick()).toBe(false);
  });

  it("a throwing setPointerCapture does not stop the drag", () => {
    const { el, pan, onPan } = setup({ throwOnCapture: true });
    pan.setEnabled(true);
    drag(el);
    expect(onPan).toHaveBeenLastCalledWith(10, 0);
  });

  it("only the main mouse button drags", () => {
    const { el, pan, onPan } = setup();
    pan.setEnabled(true);
    el.fire("pointerdown", 0, 0, 1, 2);
    el.fire("pointermove", 50, 0, 1, 2);
    expect(onPan).not.toHaveBeenCalled();
  });

  it("setEnabled(false) mid-drag ends it", () => {
    const { el, pan, onPan } = setup();
    pan.setEnabled(true);
    drag(el);
    onPan.mockClear();
    pan.setEnabled(false);
    expect(pan.dragging).toBe(false);
    expect(el.style.cursor).toBe("pointer");
    el.fire("pointermove", 40, 0);
    expect(onPan).not.toHaveBeenCalled();
    expect(pan.consumeClick()).toBe(false);
  });
});

describe("keyPan (#438)", () => {
  const key = (k: string, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) =>
    keyPan({ key: k, altKey: false, ctrlKey: false, metaKey: false, ...mods }, 400, 800);
  it("arrows move by 10 % of the host side, toward what the key points at", () => {
    expect(key("ArrowRight")).toEqual({ dx: -40, dy: 0 });
    expect(key("ArrowLeft")).toEqual({ dx: 40, dy: 0 });
    expect(key("ArrowDown")).toEqual({ dx: 0, dy: -80 });
    expect(key("ArrowUp")).toEqual({ dx: 0, dy: 80 });
  });
  it("0 and Home recenter", () => {
    expect(key("0")).toBe("home");
    expect(key("Home")).toBe("home");
  });
  it("other keys and modified keys do nothing", () => {
    expect(key("a")).toBeNull();
    expect(key("ArrowRight", { ctrlKey: true })).toBeNull();
    expect(key("ArrowRight", { altKey: true })).toBeNull();
    expect(key("ArrowRight", { metaKey: true })).toBeNull();
  });
});
