/**
 * Vector geometry helpers: SVG path serialization, flattening to polylines,
 * boolean operations (via polygon-clipping) and stroke-to-outline conversion.
 *
 * All anchors/points here are in a single coordinate space (node-local unless
 * stated otherwise). Boolean ops and outline produce corner-only paths
 * (curves are flattened), which is an acceptable first-cut for a Figma-like tool.
 */
import polygonClipping from "polygon-clipping";
import type { MultiPolygon, Ring } from "polygon-clipping";
import type { VectorAnchor, VectorPath } from "../schema/types";

// polygon-clipping ships only a default export at runtime (ESM build); the
// type declarations expose the ops as named exports. Destructure from default.
const { union, difference, intersection, xor } = polygonClipping;

export interface Pt {
  x: number;
  y: number;
}
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Serialize a vector path to an SVG path `d` string (cubic beziers where handles exist). */
export function pathToSvgData(path: VectorPath): string {
  const a = path.anchors;
  if (a.length === 0) return "";
  let d = `M ${a[0].x} ${a[0].y}`;
  const segCount = path.closed ? a.length : a.length - 1;
  for (let i = 0; i < segCount; i++) {
    const cur = a[i];
    const next = a[(i + 1) % a.length];
    const c1 = cur.hOut ? { x: cur.x + cur.hOut.x, y: cur.y + cur.hOut.y } : null;
    const c2 = next.hIn ? { x: next.x + next.hIn.x, y: next.y + next.hIn.y } : null;
    if (c1 || c2) {
      const p1 = c1 ?? { x: cur.x, y: cur.y };
      const p2 = c2 ?? { x: next.x, y: next.y };
      d += ` C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${next.x} ${next.y}`;
    } else {
      d += ` L ${next.x} ${next.y}`;
    }
  }
  if (path.closed) d += " Z";
  return d;
}

function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Flatten a path to a polyline (array of points). Beziers are sampled. */
export function flattenPath(path: VectorPath, samples = 16): Pt[] {
  const a = path.anchors;
  if (a.length === 0) return [];
  const pts: Pt[] = [{ x: a[0].x, y: a[0].y }];
  const segCount = path.closed ? a.length : a.length - 1;
  for (let i = 0; i < segCount; i++) {
    const cur = a[i];
    const next = a[(i + 1) % a.length];
    const hasCurve = cur.hOut || next.hIn;
    if (hasCurve) {
      const p0 = { x: cur.x, y: cur.y };
      const p1 = cur.hOut ? { x: cur.x + cur.hOut.x, y: cur.y + cur.hOut.y } : p0;
      const p3 = { x: next.x, y: next.y };
      const p2 = next.hIn ? { x: next.x + next.hIn.x, y: next.y + next.hIn.y } : p3;
      for (let s = 1; s <= samples; s++) pts.push(cubicPoint(p0, p1, p2, p3, s / samples));
    } else {
      pts.push({ x: next.x, y: next.y });
    }
  }
  return pts;
}

export function pathBounds(path: VectorPath): Bounds {
  const pts = flattenPath(path);
  return pointsBounds(pts);
}

export function pointsBounds(pts: Pt[]): Bounds {
  if (pts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Convert a closed path to a polygon-clipping ring (in the given coord space). */
function pathToRing(path: VectorPath, dx = 0, dy = 0): Ring {
  return flattenPath(path).map((p) => [p.x + dx, p.y + dy] as [number, number]);
}

function ringToAnchors(ring: number[][]): VectorAnchor[] {
  // polygon-clipping closes rings by repeating the first point; drop the duplicate.
  const pts = ring.slice();
  if (pts.length > 1) {
    const f = pts[0];
    const l = pts[pts.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) pts.pop();
  }
  return pts.map(([x, y]) => ({ x, y }));
}

export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

/**
 * Apply a boolean op to closed paths (each already in a shared coord space).
 * `subjects[0]` is the base; the rest are clips. Returns resulting closed paths
 * (one per output ring), each normalized so its anchors start at (0,0) with the
 * provided bounds origin baked out — callers receive paths + their bounds.
 */
export function booleanPaths(
  op: BooleanOp,
  subjects: VectorPath[],
): { path: VectorPath; bounds: Bounds }[] {
  if (subjects.length < 2) return [];
  const polys: MultiPolygon[] = subjects.map((p) => [[pathToRing(p)]]);
  const [base, ...rest] = polys;
  let result: MultiPolygon;
  switch (op) {
    case "union":
      result = union(base, ...rest);
      break;
    case "subtract":
      result = difference(base, ...rest);
      break;
    case "intersect":
      result = intersection(base, ...rest);
      break;
    case "exclude":
      result = xor(base, ...rest);
      break;
  }
  const out: { path: VectorPath; bounds: Bounds }[] = [];
  for (const poly of result) {
    // poly[0] is the outer ring; holes are ignored in this first-cut.
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    const anchors = ringToAnchors(ring);
    const b = pointsBounds(anchors);
    out.push({
      path: { anchors: anchors.map((a) => ({ x: a.x - b.x, y: a.y - b.y })), closed: true },
      bounds: b,
    });
  }
  return out;
}

function normal(ax: number, ay: number, bx: number, by: number): Pt {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function circleRing(cx: number, cy: number, r: number, seg = 12): Ring {
  const ring: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    ring.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return ring;
}

/**
 * Convert a path's stroke (centered, given width) into a filled outline path.
 * Builds a thick polygon by unioning per-segment quads + round joins. Works for
 * open and closed paths. Returns the outline as closed paths + bounds.
 */
export function strokeToOutline(
  path: VectorPath,
  width: number,
): { path: VectorPath; bounds: Bounds }[] {
  const pts = flattenPath(path);
  if (pts.length < 2 || width <= 0) return [];
  const half = width / 2;
  const pieces: MultiPolygon = [];
  const last = path.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = normal(a.x, a.y, b.x, b.y);
    const quad: Ring = [
      [a.x + n.x * half, a.y + n.y * half],
      [b.x + n.x * half, b.y + n.y * half],
      [b.x - n.x * half, b.y - n.y * half],
      [a.x - n.x * half, a.y - n.y * half],
    ];
    pieces.push([quad]);
    pieces.push([circleRing(a.x, a.y, half)]);
  }
  pieces.push([circleRing(pts[pts.length - 1].x, pts[pts.length - 1].y, half)]);
  if (pieces.length === 0) return [];
  const [first, ...others] = pieces;
  const merged = union(first, ...others.map((p) => p));
  const out: { path: VectorPath; bounds: Bounds }[] = [];
  for (const poly of merged) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    const anchors = ringToAnchors(ring);
    const bnds = pointsBounds(anchors);
    out.push({
      path: { anchors: anchors.map((a) => ({ x: a.x - bnds.x, y: a.y - bnds.y })), closed: true },
      bounds: bnds,
    });
  }
  return out;
}

/** Build a rectangle path (local coords) of the given size. */
export function rectPath(w: number, h: number): VectorPath {
  return {
    anchors: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    closed: true,
  };
}

/** Build an ellipse path (local coords) approximated with 4 cubic beziers. */
export function ellipsePath(w: number, h: number): VectorPath {
  const rx = w / 2;
  const ry = h / 2;
  const k = 0.5522847498; // circle bezier constant
  const ox = rx * k;
  const oy = ry * k;
  return {
    anchors: [
      { x: rx, y: 0, hIn: { x: -ox, y: 0 }, hOut: { x: ox, y: 0 } },
      { x: w, y: ry, hIn: { x: 0, y: -oy }, hOut: { x: 0, y: oy } },
      { x: rx, y: h, hIn: { x: ox, y: 0 }, hOut: { x: -ox, y: 0 } },
      { x: 0, y: ry, hIn: { x: 0, y: oy }, hOut: { x: 0, y: -oy } },
    ],
    closed: true,
  };
}
