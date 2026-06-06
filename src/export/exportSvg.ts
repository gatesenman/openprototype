import { DesignSystem, Fill, Frame, Node } from "@/schema/types";
import { nodeFill } from "@/render/resolve";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let gradSeq = 0;

/** Emit a gradient <def> for linear/radial fills and return the url(#id) reference. */
function gradientDef(fill: Fill, defs: string[]): string | null {
  if (fill.type === "linear") {
    const id = `grad${gradSeq++}`;
    const rad = ((fill.angle ?? 0) * Math.PI) / 180;
    const x2 = (Math.cos(rad) * 0.5 + 0.5).toFixed(4);
    const y2 = (Math.sin(rad) * 0.5 + 0.5).toFixed(4);
    const x1 = (0.5 - Math.cos(rad) * 0.5).toFixed(4);
    const y1 = (0.5 - Math.sin(rad) * 0.5).toFixed(4);
    const stops = fill.stops
      .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
      .join("");
    defs.push(
      `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`,
    );
    return `url(#${id})`;
  }
  if (fill.type === "radial") {
    const id = `grad${gradSeq++}`;
    const stops = fill.stops
      .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
      .join("");
    defs.push(
      `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient>`,
    );
    return `url(#${id})`;
  }
  return null;
}

function fillAttr(node: Node, ds: DesignSystem, defs: string[]): string {
  const fill = node.style.fill;
  if (fill && (fill.type === "linear" || fill.type === "radial")) {
    const ref = gradientDef(fill, defs);
    if (ref) return ref;
  }
  if (node.type === "text" || node.type === "line") return "none";
  return nodeFill(node, ds);
}

function strokeAttrs(node: Node): string {
  const st = node.style.stroke;
  if (!st) return "";
  return ` stroke="${st.color}" stroke-width="${st.width}"`;
}

function nodeSvg(node: Node, ds: DesignSystem, defs: string[]): string {
  if (node.hidden) return "";
  const op = node.style.opacity !== undefined ? ` opacity="${node.style.opacity}"` : "";
  const inner = svgShape(node, ds, defs);
  const kids = (node.children ?? []).map((c) => nodeSvg(c, ds, defs)).join("");
  const body = inner + kids;
  // Children are positioned relative to their parent node.
  return `<g transform="translate(${node.x}, ${node.y})"${op}>${body}</g>`;
}

function svgShape(node: Node, ds: DesignSystem, defs: string[]): string {
  const w = node.width;
  const h = node.height;
  const stroke = strokeAttrs(node);
  switch (node.type) {
    case "ellipse":
      return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fillAttr(node, ds, defs)}"${stroke}/>`;
    case "line": {
      const c = node.style.stroke?.color ?? "#94a3b8";
      const sw = node.style.stroke?.width ?? 1;
      return `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${c}" stroke-width="${sw}"/>`;
    }
    case "image":
      return node.src
        ? `<image href="${esc(node.src)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`
        : `<rect width="${w}" height="${h}" fill="#e5e7eb"/>`;
    case "vector": {
      const d = pathData(node);
      return `<path d="${d}" fill="${fillAttr(node, ds, defs)}"${stroke}/>`;
    }
    case "text": {
      const t = node.text;
      if (!t) return "";
      const anchor = t.align === "center" ? "middle" : t.align === "right" ? "end" : "start";
      const tx = t.align === "center" ? w / 2 : t.align === "right" ? w : 0;
      return `<text x="${tx}" y="${t.fontSize}" fill="${t.color}" font-family="${esc(t.fontFamily)}" font-size="${t.fontSize}" font-weight="${t.fontWeight}" text-anchor="${anchor}">${esc(t.content)}</text>`;
    }
    default: {
      // rect / button / input / frame / group container
      const r = node.style.radius ? ` rx="${node.style.radius}" ry="${node.style.radius}"` : "";
      const rect = `<rect width="${w}" height="${h}" fill="${fillAttr(node, ds, defs)}"${r}${stroke}/>`;
      if (node.text) {
        const t = node.text;
        const label = `<text x="${w / 2}" y="${h / 2}" dominant-baseline="central" text-anchor="middle" fill="${t.color}" font-family="${esc(t.fontFamily)}" font-size="${t.fontSize}" font-weight="${t.fontWeight}">${esc(t.content)}</text>`;
        return rect + label;
      }
      return rect;
    }
  }
}

function pathData(node: Node): string {
  const p = node.path;
  if (!p || p.anchors.length === 0) return "";
  const a = p.anchors;
  let d = `M ${a[0].x} ${a[0].y}`;
  for (let i = 1; i < a.length; i++) d += ` L ${a[i].x} ${a[i].y}`;
  if (p.closed) d += " Z";
  return d;
}

/** Serialize a whole frame to a standalone SVG document string. */
export function frameToSvg(frame: Frame, ds: DesignSystem): string {
  gradSeq = 0;
  const defs: string[] = [];
  const body = frame.nodes.map((n) => nodeSvg(n, ds, defs)).join("\n  ");
  const defsBlock = defs.length ? `\n  <defs>${defs.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">${defsBlock}
  <rect width="${frame.width}" height="${frame.height}" fill="${frame.background || "#ffffff"}"/>
  ${body}
</svg>
`;
}

/** Serialize a single node (node-local origin) to a standalone SVG document. */
export function nodeToSvg(node: Node, ds: DesignSystem): string {
  gradSeq = 0;
  const defs: string[] = [];
  const inner = svgShape(node, ds, defs);
  const kids = (node.children ?? []).map((c) => nodeSvg(c, ds, defs)).join("");
  const defsBlock = defs.length ? `<defs>${defs.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${node.width}" height="${node.height}" viewBox="0 0 ${node.width} ${node.height}">${defsBlock}${inner}${kids}</svg>
`;
}
