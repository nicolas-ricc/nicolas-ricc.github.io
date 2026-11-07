import { describe, expect, it } from "vitest";
import { Camera, DURATION_MS, easeOutCubic } from "./camera";

describe("easeOutCubic", () => {
  it("goes from 0 to 1 and decelerates", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("Camera", () => {
  it("interpolates and ends exactly on the target", async () => {
    const applied: { x: number; y: number; scale: number }[] = [];
    const cam = new Camera((s) => applied.push({ ...s }), { duration: 100 });
    cam.jumpTo({ x: 0, y: 0, scale: 1 });
    const done = cam.tweenTo({ x: 100, y: 50, scale: 3 });
    cam.tick(0);
    cam.tick(50);
    expect(cam.state.x).toBeGreaterThan(0);
    expect(cam.state.x).toBeLessThan(100);
    cam.tick(100);
    await done;
    expect(cam.state).toEqual({ x: 100, y: 50, scale: 3 });
    expect(applied.at(-1)).toEqual({ x: 100, y: 50, scale: 3 });
  });

  it("with reducedMotion it jumps to the target", async () => {
    const cam = new Camera(() => {}, { reducedMotion: true });
    const done = cam.tweenTo({ x: 5, y: 5, scale: 2 });
    cam.tick(0);
    await done;
    expect(cam.state).toEqual({ x: 5, y: 5, scale: 2 });
  });

  it("a new tween cancels the previous one", async () => {
    const cam = new Camera(() => {}, { duration: 100 });
    cam.jumpTo({ x: 0, y: 0, scale: 1 });
    const first = cam.tweenTo({ x: 100, y: 0, scale: 1 });
    cam.tick(0);
    cam.tick(20);
    const second = cam.tweenTo({ x: -100, y: 0, scale: 1 });
    cam.tick(20);
    cam.tick(120);
    await Promise.all([first, second]);
    expect(cam.state.x).toBe(-100);
  });

  it("retarget changes the target without restarting the tween", async () => {
    const cam = new Camera(() => {}, { duration: 100 });
    cam.jumpTo({ x: 0, y: 0, scale: 1 });
    const done = cam.tweenTo({ x: 100, y: 0, scale: 1 });
    cam.tick(0);
    expect(cam.isTweening).toBe(true);
    cam.retarget({ x: 200, y: 0, scale: 1 });
    cam.tick(100);
    await done;
    expect(cam.state.x).toBe(200);
    expect(cam.isTweening).toBe(false);
  });

  it("constants", () => {
    expect(DURATION_MS).toBe(500);
  });
});
