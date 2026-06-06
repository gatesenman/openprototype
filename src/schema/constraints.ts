import { Constraints, HConstraint, Node, VConstraint } from "./types";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_CONSTRAINTS: Constraints = { h: "left", v: "top" };

/** Resolve one axis (start coord + size) under a constraint when the parent grows from `prev` to `next`. */
function resolveAxis(
  mode: HConstraint | VConstraint,
  start: number,
  size: number,
  prev: number,
  next: number,
): { start: number; size: number } {
  const end = prev - (start + size); // distance from the far edge
  switch (mode) {
    case "right":
    case "bottom":
      return { start: next - end - size, size };
    case "left-right":
    case "top-bottom":
      return { start, size: Math.max(1, next - start - end) };
    case "center": {
      const offset = start + size / 2 - prev / 2;
      return { start: next / 2 + offset - size / 2, size };
    }
    case "scale": {
      const ratio = prev === 0 ? 1 : next / prev;
      return { start: start * ratio, size: Math.max(1, size * ratio) };
    }
    // "left" / "top": pin to near edge, keep size.
    default:
      return { start, size };
  }
}

/**
 * Apply a node's resize constraints when its parent frame changes size.
 * Pure: returns the new box (rounded). Nodes without constraints default to
 * left/top pinning (no movement), matching Figma's default.
 */
export function applyConstraints(
  node: Pick<Node, "x" | "y" | "width" | "height" | "constraints">,
  prev: { width: number; height: number },
  next: { width: number; height: number },
): Box {
  const c = node.constraints ?? DEFAULT_CONSTRAINTS;
  const h = resolveAxis(c.h, node.x, node.width, prev.width, next.width);
  const v = resolveAxis(c.v, node.y, node.height, prev.height, next.height);
  return {
    x: Math.round(h.start),
    y: Math.round(v.start),
    width: Math.round(h.size),
    height: Math.round(v.size),
  };
}
