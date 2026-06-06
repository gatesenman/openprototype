import { describe, it, expect } from "vitest";
import {
  pathToSvgData,
  flattenPath,
  pathBounds,
  booleanPaths,
  strokeToOutline,
  rectPath,
  ellipsePath,
} from "./geometry";
import type { VectorPath } from "../schema/types";

const rect = (x: number, y: number, w: number, h: number): VectorPath => ({
  closed: true,
  anchors: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});

describe("pathToSvgData", () => {
  it("serializes a closed corner path with L commands and Z", () => {
    const d = pathToSvgData(rect(0, 0, 10, 10));
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d).toContain("L");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("emits cubic C commands when bezier handles exist", () => {
    const d = pathToSvgData(ellipsePath(20, 20));
    expect(d).toContain("C");
  });

  it("returns empty string for an empty path", () => {
    expect(pathToSvgData({ anchors: [], closed: false })).toBe("");
  });
});

describe("pathBounds / flattenPath", () => {
  it("computes the bounding box of a rect path", () => {
    const b = pathBounds(rect(5, 7, 30, 20));
    expect(b).toMatchObject({ x: 5, y: 7, width: 30, height: 20 });
  });

  it("flattens a closed rect into a polyline", () => {
    const pts = flattenPath(rect(0, 0, 10, 10));
    expect(pts.length).toBeGreaterThanOrEqual(4);
  });
});

describe("booleanPaths", () => {
  it("union of two overlapping rects yields one merged shape larger than either", () => {
    const res = booleanPaths("union", [rect(0, 0, 20, 20), rect(10, 10, 20, 20)]);
    expect(res.length).toBe(1);
    // Merged bounds should span both rects (0..30).
    expect(res[0].bounds.width).toBeCloseTo(30, 0);
    expect(res[0].bounds.height).toBeCloseTo(30, 0);
  });

  it("intersection of two overlapping rects yields the small overlap region", () => {
    const res = booleanPaths("intersect", [rect(0, 0, 20, 20), rect(10, 10, 20, 20)]);
    expect(res.length).toBe(1);
    expect(res[0].bounds.width).toBeCloseTo(10, 0);
    expect(res[0].bounds.height).toBeCloseTo(10, 0);
  });

  it("subtract removes the overlapping region from the base", () => {
    const res = booleanPaths("subtract", [rect(0, 0, 20, 20), rect(10, 0, 20, 20)]);
    expect(res.length).toBe(1);
    // Left half remains: width ~10.
    expect(res[0].bounds.width).toBeCloseTo(10, 0);
  });

  it("returns empty for fewer than two subjects", () => {
    expect(booleanPaths("union", [rect(0, 0, 10, 10)])).toEqual([]);
  });
});

describe("strokeToOutline", () => {
  it("expands a straight open stroke into a filled closed outline", () => {
    const line: VectorPath = { closed: false, anchors: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    const res = strokeToOutline(line, 10);
    expect(res.length).toBe(1);
    expect(res[0].path.closed).toBe(true);
    // Outline should be roughly the stroke width tall (>= 10).
    expect(res[0].bounds.height).toBeGreaterThanOrEqual(10);
    expect(res[0].bounds.width).toBeGreaterThan(100);
  });

  it("returns empty for zero width", () => {
    const line: VectorPath = { closed: false, anchors: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
    expect(strokeToOutline(line, 0)).toEqual([]);
  });
});

describe("rectPath / ellipsePath", () => {
  it("rectPath has 4 corner anchors and is closed", () => {
    const p = rectPath(40, 20);
    expect(p.anchors).toHaveLength(4);
    expect(p.closed).toBe(true);
    expect(p.anchors.every((a) => !a.hIn && !a.hOut)).toBe(true);
  });

  it("ellipsePath has 4 smooth anchors with bezier handles", () => {
    const p = ellipsePath(40, 20);
    expect(p.anchors).toHaveLength(4);
    expect(p.anchors.every((a) => a.hIn && a.hOut)).toBe(true);
  });
});
