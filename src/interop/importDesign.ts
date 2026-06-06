import { ComponentDef, DesignTokens, Frame, Node } from "@/schema/types";
import { emptyFrame, id } from "@/schema/defaults";

/**
 * Interop import layer for the `.gpo` format.
 *
 * Parses design files exported from common tools into the open GPO model:
 *  - Design tokens: W3C Design Tokens (`$value`/`$type`), Tokens Studio / Figma
 *    Tokens (`value`/`type`), Style Dictionary, and our own flat token shape.
 *  - Artboards/Frames: Figma REST `document` trees and Sketch `pages`.
 *
 * See src/schema/gpoFile.ts (INTEROP.md) for the field mapping table.
 */

export interface ImportedTokens {
  colors: Record<string, string>;
  fontSizes: Record<string, number>;
  radii: Record<string, number>;
  spacing: Record<string, number>;
  fontFamily?: string;
}

export interface ImportResult {
  tokens?: ImportedTokens;
  frames: Frame[];
  /** Reusable components extracted from the source file (Figma COMPONENT / Sketch symbolMaster). */
  components: ComponentDef[];
  summary: string;
}

type TokenCategory = "color" | "fontSize" | "fontFamily" | "radius" | "spacing";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function isColorString(v: string): boolean {
  const s = v.trim().toLowerCase();
  return HEX.test(s) || s.startsWith("rgb") || s.startsWith("hsl");
}

/** Convert a Figma-style color object {r,g,b,a} in 0..1 to a hex string. */
function figmaColorToHex(c: { r: number; g: number; b: number; a?: number }): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n * 255)))
      .toString(16)
      .padStart(2, "0");
  const base = `#${to(c.r)}${to(c.g)}${to(c.b)}`;
  return c.a !== undefined && c.a < 1 ? `${base}${to(c.a)}` : base;
}

/** Parse a dimension-ish value ("16px", "1rem", 16) into a pixel number. */
function toPx(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.trim().match(/^(-?[\d.]+)\s*(px|rem|em|pt)?$/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    const unit = (m[2] || "px").toLowerCase();
    return unit === "rem" || unit === "em" ? n * 16 : n;
  }
  return null;
}

function categoryFromType(type: string): TokenCategory | null {
  const t = type.toLowerCase();
  if (t === "color") return "color";
  if (t === "fontfamily" || t === "fontfamilies") return "fontFamily";
  if (t === "fontsize" || t === "fontsizes") return "fontSize";
  if (t === "borderradius" || t === "radius") return "radius";
  if (t === "spacing" || t === "space" || t === "size" || t === "sizing") return "spacing";
  return null;
}

function categoryFromPath(path: string[]): TokenCategory | null {
  const p = path.join(".").toLowerCase();
  if (/colou?r/.test(p)) return "color";
  if (/(radius|radii|corner)/.test(p)) return "radius";
  if (/font.?famil/.test(p)) return "fontFamily";
  if (/(font.?size|text.?size)/.test(p)) return "fontSize";
  if (/(spacing|space|gap|padding|margin)/.test(p)) return "spacing";
  return null;
}

function uniqueKey(used: Record<string, unknown>, path: string[]): string {
  const last = path[path.length - 1] || "token";
  const norm = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-");
  let key = norm(last);
  if (!(key in used)) return key;
  // disambiguate using parent segment(s)
  for (let i = path.length - 2; i >= 0; i--) {
    key = norm(`${path[i]}-${key}`);
    if (!(key in used)) return key;
  }
  let n = 2;
  let candidate = `${norm(last)}-${n}`;
  while (candidate in used) candidate = `${norm(last)}-${++n}`;
  return candidate;
}

/** Recursively walk a token tree and bucket leaves by category. */
export function parseTokens(root: unknown): ImportedTokens | null {
  const out: ImportedTokens = { colors: {}, fontSizes: {}, radii: {}, spacing: {} };
  let found = 0;

  // Fast path: our own flat DesignTokens shape.
  const flat = root as Partial<DesignTokens>;
  if (flat && typeof flat === "object" && flat.colors && typeof flat.colors === "object") {
    for (const [k, v] of Object.entries(flat.colors)) {
      if (typeof v === "string") {
        out.colors[k] = v;
        found++;
      }
    }
    if (flat.fonts?.sizes) {
      for (const [k, v] of Object.entries(flat.fonts.sizes)) {
        const px = toPx(v);
        if (px !== null) {
          out.fontSizes[k] = px;
          found++;
        }
      }
    }
    if (flat.fonts?.family) out.fontFamily = flat.fonts.family;
    for (const [k, v] of Object.entries(flat.radii ?? {})) {
      const px = toPx(v);
      if (px !== null) {
        out.radii[k] = px;
        found++;
      }
    }
    for (const [k, v] of Object.entries(flat.spacing ?? {})) {
      const px = toPx(v);
      if (px !== null) {
        out.spacing[k] = px;
        found++;
      }
    }
    if (found > 0) return out;
  }

  const walk = (node: unknown, path: string[], inheritedType?: string) => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const rawValue = obj.$value ?? obj.value;
    const declaredType = (obj.$type ?? obj.type ?? inheritedType) as string | undefined;

    const isLeaf =
      rawValue !== undefined &&
      (typeof rawValue === "string" ||
        typeof rawValue === "number" ||
        (typeof rawValue === "object" && rawValue !== null && "r" in (rawValue as object)));

    if (isLeaf) {
      let category: TokenCategory | null = declaredType ? categoryFromType(declaredType) : null;
      if (!category) category = categoryFromPath(path);
      if (!category && typeof rawValue === "string" && isColorString(rawValue)) category = "color";
      if (!category && typeof rawValue === "object") category = "color"; // figma color obj
      if (!category) return;

      if (category === "color") {
        const hex =
          typeof rawValue === "object"
            ? figmaColorToHex(rawValue as { r: number; g: number; b: number; a?: number })
            : String(rawValue);
        out.colors[uniqueKey(out.colors, path)] = hex;
        found++;
      } else if (category === "fontFamily") {
        const fam = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue);
        out.fontFamily = fam;
        found++;
      } else {
        const px = toPx(rawValue);
        if (px === null) return;
        const bucket =
          category === "fontSize" ? out.fontSizes : category === "radius" ? out.radii : out.spacing;
        bucket[uniqueKey(bucket, path)] = px;
        found++;
      }
      return;
    }

    // group node — recurse into children, propagating any group-level type
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("$") || k === "value" || k === "type" || k === "description") continue;
      walk(v, [...path, k], declaredType);
    }
  };

  walk(root, []);
  return found > 0 ? out : null;
}

// ---- Figma / Sketch artboard import ----

interface FigmaNode {
  name?: string;
  type?: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  backgroundColor?: { r: number; g: number; b: number; a?: number };
  fills?: { type?: string; color?: { r: number; g: number; b: number; a?: number } }[];
  characters?: string;
  cornerRadius?: number;
  style?: { fontSize?: number; fontFamily?: string };
}

function fillHex(n: FigmaNode): string | undefined {
  const f = n.fills?.find((x) => x.type === "SOLID" && x.color);
  return f?.color ? figmaColorToHex(f.color) : undefined;
}

function figmaNodeToNode(child: FigmaNode, frameBox: { x: number; y: number }): Node | null {
  const box = child.absoluteBoundingBox;
  if (!box) return null;
  const base = {
    id: id(),
    name: child.name || child.type || "node",
    x: Math.round(box.x - frameBox.x),
    y: Math.round(box.y - frameBox.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
  if (child.type === "TEXT") {
    return {
      ...base,
      type: "text",
      style: {},
      text: {
        content: child.characters || child.name || "文本",
        fontFamily: child.style?.fontFamily || "Inter, system-ui, sans-serif",
        fontSize: child.style?.fontSize || 16,
        fontWeight: 400,
        lineHeight: 1.4,
        color: fillHex(child) || "#0f172a",
        align: "left",
      },
    };
  }
  return {
    ...base,
    type: "rect",
    style: {
      fill: { type: "solid", color: fillHex(child) || "#e2e8f0" },
      radius: child.cornerRadius ?? 0,
    },
  };
}

/** Map Figma FRAME/Sketch artboard nodes to GPO Frames. */
export function parseFigmaArtboards(root: unknown): Frame[] {
  const doc = (root as { document?: FigmaNode }).document;
  if (!doc?.children) return [];
  const frames: Frame[] = [];
  // CANVAS pages -> their FRAME children become GPO frames
  const canvases = doc.children;
  for (const canvas of canvases) {
    // COMPONENT nodes are imported separately as reusable components.
    const artboards = (canvas.children ?? []).filter((n) => n.type === "FRAME");
    for (const ab of artboards) {
      const box = ab.absoluteBoundingBox;
      const frame = emptyFrame(ab.name || "Imported Frame");
      if (box) {
        frame.width = Math.round(box.width) || frame.width;
        frame.height = Math.round(box.height) || frame.height;
      }
      const bg = ab.backgroundColor ? figmaColorToHex(ab.backgroundColor) : fillHex(ab);
      if (bg) frame.background = bg;
      frame.fidelity = "hifi";
      frame.nodes = (ab.children ?? [])
        .map((c) => figmaNodeToNode(c, box ?? { x: 0, y: 0 }))
        .filter((n): n is Node => n !== null);
      frames.push(frame);
    }
  }
  return frames;
}

/** Turn a Figma COMPONENT node (and its children) into a reusable component template. */
function figmaComponentToDef(comp: FigmaNode): ComponentDef | null {
  const box = comp.absoluteBoundingBox;
  const children = (comp.children ?? [])
    .map((c) => figmaNodeToNode(c, box ?? { x: 0, y: 0 }))
    .filter((n): n is Node => n !== null);
  const template: Node = {
    id: id("grp"),
    type: "group",
    name: comp.name || "Component",
    x: 0,
    y: 0,
    width: Math.round(box?.width ?? 0) || 120,
    height: Math.round(box?.height ?? 0) || 40,
    style: {},
    children,
  };
  return { id: id("comp"), name: comp.name || "Component", template };
}

/**
 * Extract reusable components from a Figma file JSON: every COMPONENT /
 * COMPONENT_SET node anywhere in the document tree (component-set children are
 * flattened into individual variants). Nested components are not double-counted.
 */
export function parseFigmaComponents(root: unknown): ComponentDef[] {
  const doc = (root as { document?: FigmaNode }).document;
  if (!doc) return [];
  const defs: ComponentDef[] = [];
  const seen = new Set<string>();
  const walk = (n: FigmaNode) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "COMPONENT") {
      const def = figmaComponentToDef(n);
      if (def && !seen.has(def.name)) {
        seen.add(def.name);
        defs.push(def);
      }
      return; // don't recurse into a component's own subtree
    }
    for (const c of n.children ?? []) walk(c);
  };
  walk(doc);
  return defs;
}

// ---- Sketch artboard import (real `.sketch` document JSON) ----

interface SketchColor {
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
}
interface SketchRect {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
interface SketchLayer {
  _class?: string;
  name?: string;
  frame?: SketchRect;
  layers?: SketchLayer[];
  hasBackgroundColor?: boolean;
  backgroundColor?: SketchColor;
  fixedRadius?: number;
  cornerRadius?: number;
  attributedString?: { string?: string };
  style?: {
    fills?: { isEnabled?: boolean; color?: SketchColor }[];
    textStyle?: {
      encodedAttributes?: {
        MSAttributedStringFontAttribute?: { attributes?: { size?: number; name?: string } };
      };
    };
  };
}

/** Sketch stores colors as 0..1 floats under red/green/blue/alpha. */
function sketchColorToHex(c?: SketchColor): string | undefined {
  if (!c) return undefined;
  return figmaColorToHex({ r: c.red ?? 0, g: c.green ?? 0, b: c.blue ?? 0, a: c.alpha ?? 1 });
}

function sketchFillHex(layer: SketchLayer): string | undefined {
  const f = layer.style?.fills?.find((x) => x.isEnabled !== false && x.color);
  return sketchColorToHex(f?.color);
}

function sketchLayerToNode(layer: SketchLayer): Node | null {
  const box = layer.frame;
  if (!box) return null;
  const base = {
    id: id(),
    name: layer.name || layer._class || "node",
    x: Math.round(box.x ?? 0),
    y: Math.round(box.y ?? 0),
    width: Math.round(box.width ?? 0),
    height: Math.round(box.height ?? 0),
  };
  if (layer._class === "text") {
    const font =
      layer.style?.textStyle?.encodedAttributes?.MSAttributedStringFontAttribute?.attributes;
    return {
      ...base,
      type: "text",
      style: {},
      text: {
        content: layer.attributedString?.string || layer.name || "文本",
        fontFamily: font?.name || "Inter, system-ui, sans-serif",
        fontSize: font?.size || 16,
        fontWeight: 400,
        lineHeight: 1.4,
        color: sketchFillHex(layer) || "#0f172a",
        align: "left",
      },
    };
  }
  if (layer._class === "bitmap") {
    return { ...base, type: "image", style: { radius: layer.fixedRadius ?? 0 } };
  }
  return {
    ...base,
    type: layer._class === "oval" ? "ellipse" : "rect",
    style: {
      fill: { type: "solid", color: sketchFillHex(layer) || "#e2e8f0" },
      radius: layer.fixedRadius ?? layer.cornerRadius ?? 0,
    },
  };
}

function sketchPages(root: unknown): SketchLayer[] {
  const r = root as { pages?: SketchLayer[]; _class?: string; layers?: SketchLayer[] };
  // Accept either { pages: [page,...] } or a single page object { _class:"page", layers }.
  return Array.isArray(r.pages) ? r.pages : r._class === "page" ? [r] : [];
}

/** Map a real Sketch document JSON (`pages[].layers[]` artboards) to GPO Frames. */
export function parseSketchArtboards(root: unknown): Frame[] {
  const pages = sketchPages(root);
  if (!pages.length) return [];
  const frames: Frame[] = [];
  for (const page of pages) {
    // symbolMaster layers are imported separately as reusable components.
    const artboards = (page.layers ?? []).filter((l) => l._class === "artboard");
    for (const ab of artboards) {
      const frame = emptyFrame(ab.name || "Sketch Artboard");
      if (ab.frame) {
        frame.width = Math.round(ab.frame.width ?? 0) || frame.width;
        frame.height = Math.round(ab.frame.height ?? 0) || frame.height;
      }
      const bg = ab.hasBackgroundColor ? sketchColorToHex(ab.backgroundColor) : undefined;
      if (bg) frame.background = bg;
      frame.fidelity = "hifi";
      frame.nodes = (ab.layers ?? [])
        .map((c) => sketchLayerToNode(c))
        .filter((n): n is Node => n !== null);
      frames.push(frame);
    }
  }
  return frames;
}

/** Extract reusable components from a Sketch document JSON (`symbolMaster` layers). */
export function parseSketchSymbols(root: unknown): ComponentDef[] {
  const pages = sketchPages(root);
  if (!pages.length) return [];
  const defs: ComponentDef[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const masters = (page.layers ?? []).filter((l) => l._class === "symbolMaster");
    for (const m of masters) {
      const name = m.name || "Symbol";
      if (seen.has(name)) continue;
      seen.add(name);
      const children = (m.layers ?? [])
        .map((c) => sketchLayerToNode(c))
        .filter((n): n is Node => n !== null);
      const template: Node = {
        id: id("grp"),
        type: "group",
        name,
        x: 0,
        y: 0,
        width: Math.round(m.frame?.width ?? 0) || 120,
        height: Math.round(m.frame?.height ?? 0) || 40,
        style: {},
        children,
      };
      defs.push({ id: id("comp"), name, template });
    }
  }
  return defs;
}

/** Parse an arbitrary design-tool JSON export into tokens, frames and/or components. */
export function importDesignJson(text: string): ImportResult {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Error("无法解析 JSON 文件");
  }

  const tokens = parseTokens(root) ?? undefined;
  const frames = [...parseFigmaArtboards(root), ...parseSketchArtboards(root)];
  const components = [...parseFigmaComponents(root), ...parseSketchSymbols(root)];

  if (!tokens && frames.length === 0 && components.length === 0) {
    throw new Error(
      "未识别到设计 Token、画板或组件（支持 W3C/Tokens Studio Token、Figma 文件 JSON 或 Sketch 文档 JSON）",
    );
  }

  const parts: string[] = [];
  if (tokens) {
    const n =
      Object.keys(tokens.colors).length +
      Object.keys(tokens.fontSizes).length +
      Object.keys(tokens.radii).length +
      Object.keys(tokens.spacing).length +
      (tokens.fontFamily ? 1 : 0);
    parts.push(`${n} 个 Token`);
  }
  if (frames.length) parts.push(`${frames.length} 个画板`);
  if (components.length) parts.push(`${components.length} 个组件`);

  return { tokens, frames, components, summary: `已导入 ${parts.join(" + ")}` };
}
