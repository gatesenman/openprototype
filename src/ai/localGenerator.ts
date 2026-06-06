import { emptyFrame, id } from "@/schema/defaults";
import {
  DesignSystem,
  Frame,
  Node,
  NodeType,
} from "@/schema/types";

/**
 * Heuristic, offline page generator.
 *
 * Parses a requirement markdown doc into a structured Frame so the full
 * product loop (requirement -> generated editable page) works with no API key.
 * Real LLM providers produce the same schema; see ai/generate.ts.
 */

function classify(line: string): NodeType {
  const t = line.toLowerCase();
  if (/(按钮|button|提交|登录|确认|保存|获取验证码|下一步|继续)/.test(line)) return "button";
  if (/(输入框|输入|手机号|密码|验证码|搜索框|文本框|input|邮箱)/.test(line)) return "input";
  if (/(图片|图像|头像|banner|封面|logo|图标|icon)/.test(line)) return "image";
  if (/(链接|link)/.test(t)) return "text";
  return "text";
}

function cleanBullet(line: string): string {
  return line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

export function generateFrameFromMarkdown(
  markdown: string,
  ds: DesignSystem,
  fidelity: "wireframe" | "hifi" = "wireframe",
  frameName?: string,
): Frame {
  const lines = markdown.split("\n").map((l) => l.trim());
  const title =
    lines.find((l) => l.startsWith("# "))?.replace(/^#\s+/, "") ?? "页面";
  const bullets = lines
    .filter((l) => /^[-*+]\s+/.test(l) || /^\d+\.\s+/.test(l))
    .map(cleanBullet)
    .filter(Boolean);

  const frame = emptyFrame(frameName ?? title);
  frame.fidelity = fidelity;
  frame.background = fidelity === "hifi" ? ds.tokens.colors.bg : "#ffffff";

  const c = ds.tokens.colors;
  const pad = ds.tokens.spacing.lg;
  const innerW = frame.width - pad * 2;
  let y = ds.tokens.spacing.xl + 12;

  const nodes: Node[] = [];

  // Title
  nodes.push({
    id: id(),
    type: "text",
    name: "标题",
    x: pad,
    y,
    width: innerW,
    height: 40,
    style: {},
    text: {
      content: title,
      fontFamily: ds.tokens.fonts.family,
      fontSize: ds.tokens.fonts.sizes.xl,
      fontWeight: 700,
      lineHeight: 1.3,
      color: fidelity === "hifi" ? c.text : "#111111",
      align: "left",
    },
    meta: { aiGenerated: true },
  });
  y += 64;

  const items = bullets.length
    ? bullets
    : ["内容区域", "次要信息", "操作按钮"];

  for (const item of items) {
    const kind = classify(item);
    if (kind === "input") {
      nodes.push({
        id: id(),
        type: "input",
        name: item,
        x: pad,
        y,
        width: innerW,
        height: 48,
        style: {
          fill:
            fidelity === "hifi"
              ? { type: "token", token: "surface" }
              : { type: "solid", color: "#ffffff" },
          stroke: { color: c.border, width: 1 },
          radius: ds.tokens.radii.md,
        },
        text: {
          content: item,
          fontFamily: ds.tokens.fonts.family,
          fontSize: ds.tokens.fonts.sizes.md,
          fontWeight: 400,
          lineHeight: 1.4,
          color: c.muted,
          align: "left",
        },
        meta: { aiGenerated: true },
      });
      y += 64;
    } else if (kind === "button") {
      nodes.push({
        id: id(),
        type: "button",
        name: item,
        x: pad,
        y,
        width: innerW,
        height: 48,
        style: {
          // Rule: primary buttons must use the primary token.
          fill: { type: "token", token: "primary" },
          radius: ds.tokens.radii.md,
        },
        text: {
          content: item,
          fontFamily: ds.tokens.fonts.family,
          fontSize: ds.tokens.fonts.sizes.md,
          fontWeight: 600,
          lineHeight: 1.4,
          color: c["primary-fg"],
          align: "center",
        },
        meta: { aiGenerated: true },
      });
      y += 64;
    } else if (kind === "image") {
      nodes.push({
        id: id(),
        type: "image",
        name: item,
        x: pad,
        y,
        width: innerW,
        height: 160,
        style: {
          fill: { type: "solid", color: "#e5e7eb" },
          radius: ds.tokens.radii.md,
        },
        text: {
          content: item,
          fontFamily: ds.tokens.fonts.family,
          fontSize: ds.tokens.fonts.sizes.sm,
          fontWeight: 400,
          lineHeight: 1.4,
          color: c.muted,
          align: "center",
        },
        meta: { aiGenerated: true },
      });
      y += 176;
    } else {
      nodes.push({
        id: id(),
        type: "text",
        name: item,
        x: pad,
        y,
        width: innerW,
        height: 24,
        style: {},
        text: {
          content: item,
          fontFamily: ds.tokens.fonts.family,
          fontSize: ds.tokens.fonts.sizes.md,
          fontWeight: 400,
          lineHeight: 1.5,
          color: fidelity === "hifi" ? c.text : "#333333",
          align: "left",
        },
        meta: { aiGenerated: true },
      });
      y += 40;
    }
  }

  frame.nodes = nodes;
  return frame;
}
