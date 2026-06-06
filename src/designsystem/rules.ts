import { DesignSystem, Frame, Node } from "@/schema/types";

export interface RuleViolation {
  ruleId: string;
  nodeId: string;
  message: string;
  fixed: boolean;
}

/**
 * Validate (and auto-fix) a generated/edited frame against the design rules.
 * Returns the corrected frame plus a list of what was checked/fixed.
 */
export function applyRules(
  frame: Frame,
  ds: DesignSystem,
): { frame: Frame; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];

  const fixNode = (node: Node): Node => {
    let n = node;
    for (const rule of ds.rules) {
      if (rule.kind === "primary-button-token" && n.type === "button") {
        const isPrimary =
          n.style.fill?.type === "token" && n.style.fill.token === "primary";
        if (!isPrimary) {
          n = { ...n, style: { ...n.style, fill: { type: "token", token: "primary" } } };
          violations.push({
            ruleId: rule.id,
            nodeId: n.id,
            message: `按钮「${n.name}」填充已修正为 primary token`,
            fixed: true,
          });
        }
      }
      if (rule.kind === "card-radius" && typeof rule.value === "number") {
        if (
          (n.type === "rect" || n.type === "image") &&
          n.style.radius !== undefined &&
          n.style.radius !== rule.value &&
          n.style.radius > 0
        ) {
          n = { ...n, style: { ...n.style, radius: rule.value } };
          violations.push({
            ruleId: rule.id,
            nodeId: n.id,
            message: `「${n.name}」圆角已修正为 ${rule.value}px`,
            fixed: true,
          });
        }
      }
      if (rule.kind === "min-tap-target" && typeof rule.value === "number") {
        if ((n.type === "button" || n.type === "input") && n.height < rule.value) {
          n = { ...n, height: rule.value };
          violations.push({
            ruleId: rule.id,
            nodeId: n.id,
            message: `「${n.name}」高度已提升至 ${rule.value}px（可达性）`,
            fixed: true,
          });
        }
      }
    }
    if (n.children) n = { ...n, children: n.children.map(fixNode) };
    return n;
  };

  return { frame: { ...frame, nodes: frame.nodes.map(fixNode) }, violations };
}
