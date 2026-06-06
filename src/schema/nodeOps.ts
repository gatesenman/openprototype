import { Frame, Node } from "./types";
import { id } from "./defaults";

/** Bounding box of a set of nodes (top-level coords within a frame). */
export function bbox(nodes: Node[]): { x: number; y: number; w: number; h: number } {
  if (!nodes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Deep clone a node subtree, assigning fresh ids. */
export function cloneNode(node: Node): Node {
  return {
    ...node,
    id: id(),
    children: node.children?.map(cloneNode),
    interactions: node.interactions?.map((i) => ({ ...i, id: id("act") })),
  };
}

/** Group the given top-level nodes into a single group node. */
export function makeGroup(frame: Frame, nodeIds: string[]): Frame {
  const selected = frame.nodes.filter((n) => nodeIds.includes(n.id));
  if (selected.length < 2) return frame;
  const box = bbox(selected);
  const group: Node = {
    id: id("grp"),
    type: "group",
    name: "编组",
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    style: {},
    children: selected.map((n) => ({ ...n, x: n.x - box.x, y: n.y - box.y })),
  };
  const rest = frame.nodes.filter((n) => !nodeIds.includes(n.id));
  return { ...frame, nodes: [...rest, group] };
}

/** Ungroup a group node back into top-level nodes. */
export function ungroup(frame: Frame, groupId: string): { frame: Frame; childIds: string[] } {
  const group = frame.nodes.find((n) => n.id === groupId);
  if (!group || group.type !== "group" || !group.children) {
    return { frame, childIds: [] };
  }
  const children = group.children.map((c) => ({
    ...c,
    x: c.x + group.x,
    y: c.y + group.y,
  }));
  const idx = frame.nodes.findIndex((n) => n.id === groupId);
  const nodes = [...frame.nodes];
  nodes.splice(idx, 1, ...children);
  return { frame: { ...frame, nodes }, childIds: children.map((c) => c.id) };
}

/**
 * Strip instance-local identity (id/position/name/ref) so an instance can be
 * structurally compared against its component master template.
 */
function normalizeForCompare(node: Node): unknown {
  const strip = (n: Node): unknown => {
    const { id: _id, x: _x, y: _y, name: _name, componentRef: _ref, children, ...rest } =
      n;
    return {
      ...rest,
      children: children?.map(strip),
    };
  };
  return strip(node);
}

/**
 * True when a component instance has local overrides that diverge from its
 * master template (ignoring position/id/name). Used to surface an override
 * badge in the properties panel.
 */
export function isInstanceModified(instance: Node, template: Node): boolean {
  return (
    JSON.stringify(normalizeForCompare(instance)) !==
    JSON.stringify(normalizeForCompare(template))
  );
}

/** Move a node's z-order. dir: 'front' | 'back' | 'forward' | 'backward'. */
export function reorder(frame: Frame, nodeId: string, dir: string): Frame {
  const idx = frame.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return frame;
  const nodes = [...frame.nodes];
  const [node] = nodes.splice(idx, 1);
  if (dir === "front") nodes.push(node);
  else if (dir === "back") nodes.unshift(node);
  else if (dir === "forward") nodes.splice(Math.min(nodes.length, idx + 1), 0, node);
  else if (dir === "backward") nodes.splice(Math.max(0, idx - 1), 0, node);
  return { ...frame, nodes };
}
