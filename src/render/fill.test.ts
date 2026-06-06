import { describe, expect, it } from "vitest";
import { blendModeToComposite, gradientColorStops, konvaFillProps, linearGradientEndpoints } from "./fill";
import { DesignSystem, Node } from "@/schema/types";

const ds = { tokens: { colors: { primary: "#0d99ff" } }, variables: [] } as unknown as DesignSystem;
const baseNode = (over: Partial<Node>): Node =>
  ({ id: "n", type: "rect", name: "r", x: 0, y: 0, width: 100, height: 50, style: {}, ...over }) as Node;

describe("linearGradientEndpoints", () => {
  it("0° spans left→right", () => {
    const { start, end } = linearGradientEndpoints(0, 100, 50);
    expect(start).toEqual({ x: 0, y: 25 });
    expect(end).toEqual({ x: 100, y: 25 });
  });
  it("90° spans top→bottom", () => {
    const { start, end } = linearGradientEndpoints(90, 100, 50);
    expect(start.x).toBeCloseTo(50);
    expect(start.y).toBeCloseTo(0);
    expect(end.y).toBeCloseTo(50);
  });
});

describe("gradientColorStops", () => {
  it("sorts by offset and flattens", () => {
    const out = gradientColorStops([
      { offset: 1, color: "#fff" },
      { offset: 0, color: "#000" },
    ]);
    expect(out).toEqual([0, "#000", 1, "#fff"]);
  });
});

describe("blendModeToComposite", () => {
  it("maps normal/undefined to source-over", () => {
    expect(blendModeToComposite("normal")).toBe("source-over");
    expect(blendModeToComposite(undefined)).toBe("source-over");
  });
  it("passes through real blend modes", () => {
    expect(blendModeToComposite("multiply")).toBe("multiply");
  });
});

describe("konvaFillProps", () => {
  it("returns a solid fill + composite for solid fills", () => {
    const p = konvaFillProps(baseNode({ style: { fill: { type: "solid", color: "#abc" } } }), ds, "#000");
    expect(p.fill).toBe("#abc");
    expect(p.globalCompositeOperation).toBe("source-over");
  });
  it("emits linear-gradient props", () => {
    const p = konvaFillProps(
      baseNode({ style: { fill: { type: "linear", angle: 0, stops: [{ offset: 0, color: "#000" }, { offset: 1, color: "#fff" }] } } }),
      ds,
      "#000",
    );
    expect(p.fillPriority).toBe("linear-gradient");
    expect(p.fillLinearGradientColorStops).toEqual([0, "#000", 1, "#fff"]);
  });
  it("carries blend mode through", () => {
    const p = konvaFillProps(baseNode({ style: { fill: { type: "solid", color: "#abc" }, blendMode: "multiply" } }), ds, "#000");
    expect(p.globalCompositeOperation).toBe("multiply");
  });
});
