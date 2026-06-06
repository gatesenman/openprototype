import { describe, expect, it } from "vitest";
import { applyConstraints } from "./constraints";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const grow = { from: { width: 100, height: 100 }, to: { width: 200, height: 100 } };

describe("applyConstraints (horizontal)", () => {
  it("pins to left by default (no movement)", () => {
    const r = applyConstraints(box(10, 0, 50, 20), grow.from, grow.to);
    expect(r.x).toBe(10);
    expect(r.width).toBe(50);
  });

  it("pins to the right edge", () => {
    const r = applyConstraints({ ...box(40, 0, 50, 20), constraints: { h: "right", v: "top" } }, grow.from, grow.to);
    expect(r.x).toBe(140); // 200 - 10(right gap) - 50
    expect(r.width).toBe(50);
  });

  it("stretches with left-right", () => {
    const r = applyConstraints({ ...box(10, 0, 80, 20), constraints: { h: "left-right", v: "top" } }, grow.from, grow.to);
    expect(r.x).toBe(10);
    expect(r.width).toBe(180); // 200 - 10 - 10
  });

  it("keeps relative center", () => {
    const r = applyConstraints({ ...box(25, 0, 50, 20), constraints: { h: "center", v: "top" } }, grow.from, grow.to);
    expect(r.x).toBe(75); // new center 100, half-width 25
  });

  it("scales proportionally", () => {
    const r = applyConstraints({ ...box(10, 0, 50, 20), constraints: { h: "scale", v: "top" } }, grow.from, grow.to);
    expect(r.x).toBe(20);
    expect(r.width).toBe(100);
  });
});

describe("applyConstraints (vertical)", () => {
  const tall = { from: { width: 100, height: 100 }, to: { width: 100, height: 300 } };
  it("pins to bottom edge", () => {
    const r = applyConstraints({ ...box(0, 60, 20, 30), constraints: { h: "left", v: "bottom" } }, tall.from, tall.to);
    expect(r.y).toBe(260); // 300 - 10(bottom gap) - 30
  });
  it("scales height", () => {
    const r = applyConstraints({ ...box(0, 10, 20, 50), constraints: { h: "left", v: "scale" } }, tall.from, tall.to);
    expect(r.y).toBe(30);
    expect(r.height).toBe(150);
  });
});
