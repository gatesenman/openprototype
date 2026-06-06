import { DesignSystem, Fill, Node } from "@/schema/types";

export function resolveFill(
  fill: Fill | undefined,
  ds: DesignSystem,
  fallback = "transparent",
): string {
  if (!fill) return fallback;
  if (fill.type === "solid") return fill.color;
  if (fill.type === "variable") {
    const v = (ds.variables ?? []).find((x) => x.id === fill.variableId);
    if (v && v.type === "color") return String(v.value);
    return fallback;
  }
  if (fill.type === "token") return ds.tokens.colors[fill.token] ?? fallback;
  // gradient / image fills have no single resolved color.
  return fallback;
}

/** Default fill per node type when none is set (keeps wireframes visible). */
export function nodeFill(node: Node, ds: DesignSystem): string {
  if (node.style.fill) return resolveFill(node.style.fill, ds);
  switch (node.type) {
    case "button":
      return ds.tokens.colors.primary;
    case "input":
      return "#ffffff";
    case "image":
      return "#e5e7eb";
    case "rect":
      return "#f1f5f9";
    default:
      return "transparent";
  }
}
