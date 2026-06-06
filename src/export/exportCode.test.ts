import { describe, expect, it } from "vitest";
import { DesignSystem, Frame, Node } from "@/schema/types";
import {
  frameToCss,
  frameToVue,
  frameToTailwind,
  frameToCode,
  nodeToCss,
  nodeToTailwind,
  nodeToCode,
} from "./exportCode";
import { frameToSvg, nodeToSvg } from "./exportSvg";

const ds = {
  name: "DS",
  tokens: { colors: { primary: "#0d99ff" } },
  variables: [],
} as unknown as DesignSystem;

const baseNode = (over: Partial<Node>): Node =>
  ({
    id: "n1",
    type: "rect",
    name: "Box",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    style: {},
    ...over,
  }) as Node;

const frame = (nodes: Node[]): Frame =>
  ({
    id: "f1",
    name: "Login",
    x: 0,
    y: 0,
    width: 390,
    height: 844,
    background: "#ffffff",
    fidelity: "hifi",
    nodes,
  }) as Frame;

describe("frameToCss", () => {
  it("emits a .frame rule with frame dimensions", () => {
    const css = frameToCss(frame([baseNode({})]), ds);
    expect(css).toContain(".frame {");
    expect(css).toContain("width: 390px");
    expect(css).toContain("height: 844px");
  });
  it("emits a class rule per node with position", () => {
    const css = frameToCss(frame([baseNode({ name: "Hero" })]), ds);
    expect(css).toMatch(/\.Hero-1\s*\{/);
    expect(css).toContain("left:10px");
    expect(css).toContain("top:20px");
  });
});

describe("nodeToCss", () => {
  it("includes radius and blur when present", () => {
    const css = nodeToCss(baseNode({ style: { radius: 8, blur: 4 } }), ds);
    expect(css).toContain("border-radius:8px");
    expect(css).toContain("filter:blur(4px)");
  });
});

describe("frameToVue", () => {
  it("produces a <template> + <script setup> SFC", () => {
    const vue = frameToVue(frame([baseNode({})]), ds);
    expect(vue).toContain("<template>");
    expect(vue).toContain("<script setup lang=\"ts\">");
    expect(vue).toContain("width: \"390px\"");
  });
});

describe("frameToTailwind / nodeToTailwind", () => {
  it("emits arbitrary-value utility classes", () => {
    const cls = nodeToTailwind(baseNode({ style: { radius: 6 } }), ds);
    expect(cls).toContain("absolute");
    expect(cls).toContain("left-[10px]");
    expect(cls).toContain("w-[100px]");
    expect(cls).toContain("rounded-[6px]");
  });
  it("frame component wraps nodes", () => {
    const tw = frameToTailwind(frame([baseNode({})]), ds);
    expect(tw).toContain("export default function Login()");
    expect(tw).toContain("className=");
  });
});

describe("frameToCode dispatcher", () => {
  it("routes each language to a distinct generator", () => {
    const f = frame([baseNode({})]);
    expect(frameToCode(f, ds, "css")).toContain(".frame {");
    expect(frameToCode(f, ds, "vue")).toContain("<template>");
    expect(frameToCode(f, ds, "react")).toContain("export default function");
    expect(frameToCode(f, ds, "tailwind")).toContain("className=");
    expect(frameToCode(f, ds, "html")).toContain("<!doctype html>");
  });
});

describe("nodeToCode dispatcher", () => {
  it("returns language-specific snippets", () => {
    const n = baseNode({});
    expect(nodeToCode(n, ds, "css")).toMatch(/\{[\s\S]*\}/);
    expect(nodeToCode(n, ds, "tailwind")).toContain("className=");
    expect(nodeToCode(n, ds, "react")).toContain("<div");
  });
});

describe("frameToSvg", () => {
  it("emits an <svg> with frame size and a background rect", () => {
    const svg = frameToSvg(frame([baseNode({})]), ds);
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="390"');
    expect(svg).toContain('fill="#ffffff"');
  });
  it("emits a linearGradient def for gradient fills", () => {
    const n = baseNode({
      style: { fill: { type: "linear", angle: 90, stops: [{ offset: 0, color: "#000" }, { offset: 1, color: "#fff" }] } },
    });
    const svg = frameToSvg(frame([n]), ds);
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain("url(#grad0)");
  });
  it("renders ellipse nodes as <ellipse>", () => {
    const svg = nodeToSvg(baseNode({ type: "ellipse" }), ds);
    expect(svg).toContain("<ellipse");
  });
});
