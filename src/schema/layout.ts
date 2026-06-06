import { AutoLayout, Node } from "./types";

/** Sensible default when a container first turns on auto-layout. */
export const DEFAULT_AUTOLAYOUT: AutoLayout = {
  mode: "vertical",
  gap: 12,
  padding: { top: 16, right: 16, bottom: 16, left: 16 },
  align: "start",
};

/**
 * Recompute a container's children positions and its own size from its
 * auto-layout settings (Figma-style stacks). Pure: returns a new node and
 * never mutates the input.
 *
 * Children store frame/parent-relative coordinates, so we lay them out inside
 * the padding box and "hug" the container size to the content. A no-op when the
 * node has no layout, is set to `none`, or has no children — so it is always
 * safe to call.
 */
export function applyAutoLayout(node: Node): Node {
  const layout = node.layout;
  if (!layout || layout.mode === "none" || !node.children || node.children.length === 0) {
    return node;
  }
  const { gap, padding, align, mode } = layout;
  const kids = node.children;
  const vertical = mode === "vertical";

  // Cross-axis extent = the widest (vertical) / tallest (horizontal) child.
  const crossMax = Math.max(
    0,
    ...kids.map((k) => (vertical ? k.width : k.height)),
  );

  let cursor = vertical ? padding.top : padding.left;
  const newChildren = kids.map((k) => {
    let x = k.x;
    let y = k.y;
    let width = k.width;
    let height = k.height;
    if (vertical) {
      y = cursor;
      if (align === "start") x = padding.left;
      else if (align === "center") x = padding.left + (crossMax - k.width) / 2;
      else if (align === "end") x = padding.left + (crossMax - k.width);
      else {
        x = padding.left;
        width = crossMax; // stretch
      }
      cursor += k.height + gap;
    } else {
      x = cursor;
      if (align === "start") y = padding.top;
      else if (align === "center") y = padding.top + (crossMax - k.height) / 2;
      else if (align === "end") y = padding.top + (crossMax - k.height);
      else {
        y = padding.top;
        height = crossMax; // stretch
      }
      cursor += k.width + gap;
    }
    return {
      ...k,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  });

  const contentMain = cursor - gap; // drop the trailing gap after the last child
  const width = vertical
    ? padding.left + crossMax + padding.right
    : contentMain + padding.right;
  const height = vertical
    ? contentMain + padding.bottom
    : padding.top + crossMax + padding.bottom;

  return {
    ...node,
    children: newChildren,
    width: Math.round(width),
    height: Math.round(height),
  };
}
