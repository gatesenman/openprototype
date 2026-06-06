import { describe, expect, it } from "vitest";
import { defaultDesignSystem, newDocument, seedJourney } from "@/schema/defaults";
import {
  averageEmotion,
  clampEmotion,
  coerceJourney,
  countOpportunities,
  countPains,
  emotionCurvePath,
  emotionPoints,
  generateJourneyFromBrief,
  journeyToCsv,
  journeyToMarkdown,
} from "@/journey/journey";
import { generateFrameFromMarkdown } from "@/ai/localGenerator";
import { applyRules } from "@/designsystem/rules";
import { exportToHtml } from "@/export/exportHtml";
import { frameToReact } from "@/export/exportCode";
import { serializeGpo, deserializeGpo } from "@/schema/gpoFile";
import {
  importDesignJson,
  parseTokens,
  parseFigmaComponents,
  parseSketchSymbols,
} from "@/interop/importDesign";
import { auditDesignSystem, contrastRatio } from "@/designsystem/audit";
import { applyAutoLayout } from "@/schema/layout";
import { generateFlowFromBrief } from "@/ai/flow";
import {
  PLUGINS,
  mapAllNodes,
  countNodes,
  PluginContext,
  COMPONENT_PACKAGES,
  PLUGIN_API_VERSION,
} from "@/market/catalog";
import { buildElementPlus } from "@/market/elementPlus";
import { DESIGN_SYSTEM_PRESETS, findPreset } from "@/designsystem/presets";
import {
  SLASH_COMMANDS,
  SLASH_GROUPS,
  filterSlashCommands,
  groupedSlashCommands,
  detectSlash,
} from "@/requirements/slashCommands";
import { useStore } from "@/store/useStore";
import { isInstanceModified, reorder } from "@/schema/nodeOps";
import { frameNameFromRequirement } from "@/ai/frameName";
import { assistRequirement } from "@/ai/assistDoc";
import { resolveFill } from "@/render/resolve";
import { Frame, GpoDocument, Node } from "@/schema/types";

const md = `# 登录页
- 手机号输入框
- 验证码输入框
- 登录按钮
- 注册链接`;

describe("local generator", () => {
  it("parses markdown into a titled frame with classified nodes", () => {
    const ds = defaultDesignSystem();
    const frame = generateFrameFromMarkdown(md, ds, "wireframe");
    expect(frame.name).toBe("登录页");
    const types = frame.nodes.map((n) => n.type);
    expect(types).toContain("input");
    expect(types).toContain("button");
    const btn = frame.nodes.find((n) => n.type === "button")!;
    expect(btn.style.fill).toEqual({ type: "token", token: "primary" });
  });
});

describe("rules engine", () => {
  it("auto-fixes a non-primary button fill and small tap targets", () => {
    const ds = defaultDesignSystem();
    const frame: Frame = {
      id: "f1",
      name: "t",
      x: 0,
      y: 0,
      width: 390,
      height: 844,
      background: "#fff",
      fidelity: "wireframe",
      nodes: [
        {
          id: "b1",
          type: "button",
          name: "提交",
          x: 0,
          y: 0,
          width: 100,
          height: 20,
          style: { fill: { type: "solid", color: "#000000" } },
        },
      ],
    };
    const { frame: fixed, violations } = applyRules(frame, ds);
    expect(fixed.nodes[0].style.fill).toEqual({ type: "token", token: "primary" });
    expect(fixed.nodes[0].height).toBe(40);
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("rules engine (custom values)", () => {
  it("respects an edited card-radius rule value", () => {
    const ds = defaultDesignSystem();
    const radiusRule = ds.rules.find((r) => r.kind === "card-radius")!;
    radiusRule.value = 12; // simulate updateRule editing the value
    const frame: Frame = {
      id: "f2",
      name: "t",
      x: 0,
      y: 0,
      width: 390,
      height: 844,
      background: "#fff",
      fidelity: "wireframe",
      nodes: [
        { id: "r1", type: "rect", name: "卡片", x: 0, y: 0, width: 100, height: 60, style: { radius: 8 } },
      ],
    };
    const { frame: fixed } = applyRules(frame, ds);
    expect(fixed.nodes[0].style.radius).toBe(12);
  });
});

describe("html export", () => {
  it("emits frames and a navigation runtime", () => {
    const doc = newDocument();
    const ds = doc.designSystem;
    doc.pages[0].frames.push(generateFrameFromMarkdown(md, ds, "hifi"));
    const html = exportToHtml(doc);
    expect(html).toContain("function gotoFrame");
    expect(html).toContain("frame-");
  });
});

describe("react export", () => {
  it("emits a PascalCase component with valid double-brace JSX styles", () => {
    const ds = defaultDesignSystem();
    const frame = generateFrameFromMarkdown(md, ds, "hifi");
    const code = frameToReact(frame, ds);
    expect(code).toMatch(/export default function [A-Z]\w*\(\)/);
    expect(code).not.toContain("{{{");
    expect(code).toContain("style={{");
  });
});

describe(".gpo container", () => {
  it("round-trips a document through serialize/deserialize", async () => {
    const doc = newDocument("RoundTrip");
    doc.comments.push({
      id: "c1",
      frameId: "f1",
      x: 10,
      y: 20,
      resolved: false,
      thread: [{ id: "m1", author: "我", text: "改一下", createdAt: 1 }],
    });
    const blob = await serializeGpo(doc);
    const back = await deserializeGpo(blob);
    expect(back.meta.name).toBe("RoundTrip");
    expect(back.meta.app).toBe("gpo-studio");
    expect(back.requirements.length).toBe(doc.requirements.length);
    expect(back.comments.length).toBe(1);
    expect(back.comments[0].thread[0].text).toBe("改一下");
  });

  it("backfills comments on legacy documents missing the field", async () => {
    const doc = newDocument("Legacy") as unknown as Record<string, unknown>;
    delete doc.comments;
    const blob = await serializeGpo(doc as never);
    const back = await deserializeGpo(blob);
    expect(Array.isArray(back.comments)).toBe(true);
    expect(back.comments.length).toBe(0);
  });
});

describe("interop import", () => {
  it("parses W3C design tokens with $value/$type", () => {
    const tokens = parseTokens({
      color: {
        primary: { $value: "#6366f1", $type: "color" },
        bg: { $value: "#0f172a", $type: "color" },
      },
      radius: { md: { $value: "8px", $type: "borderRadius" } },
      spacing: { lg: { $value: "1.5rem", $type: "spacing" } },
    });
    expect(tokens).not.toBeNull();
    expect(tokens!.colors.primary).toBe("#6366f1");
    expect(tokens!.radii.md).toBe(8);
    expect(tokens!.spacing.lg).toBe(24);
  });

  it("parses Tokens Studio value/type and infers color from value", () => {
    const tokens = parseTokens({
      brand: {
        accent: { value: "#ff0000", type: "color" },
        ghost: { value: "rgba(0,0,0,0.5)" },
      },
      typography: { base: { value: 14, type: "fontSizes" } },
    });
    expect(tokens!.colors.accent).toBe("#ff0000");
    expect(tokens!.colors.ghost).toBe("rgba(0,0,0,0.5)");
    expect(tokens!.fontSizes.base).toBe(14);
  });

  it("maps a Figma file document into GPO frames", () => {
    const figma = JSON.stringify({
      document: {
        children: [
          {
            type: "CANVAS",
            name: "Page 1",
            children: [
              {
                type: "FRAME",
                name: "Home",
                absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
                backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
                children: [
                  {
                    type: "TEXT",
                    name: "Title",
                    characters: "你好",
                    absoluteBoundingBox: { x: 16, y: 40, width: 200, height: 32 },
                    style: { fontSize: 24, fontFamily: "Inter" },
                    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const result = importDesignJson(figma);
    expect(result.frames.length).toBe(1);
    const f = result.frames[0];
    expect(f.name).toBe("Home");
    expect(f.width).toBe(375);
    expect(f.nodes[0].type).toBe("text");
    expect(f.nodes[0].text?.content).toBe("你好");
  });

  it("rejects unrecognized JSON", () => {
    expect(() => importDesignJson("{\"foo\":1}")).toThrow();
  });
});

function child(id: string, w: number, h: number): Node {
  return { id, type: "rect", name: id, x: 99, y: 99, width: w, height: h, style: {} };
}

describe("auto-layout engine", () => {
  const container = (): Node => ({
    id: "g",
    type: "group",
    name: "g",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    style: {},
    children: [child("a", 100, 40), child("b", 60, 20)],
  });

  it("stacks children vertically with gap + padding and hugs the size", () => {
    const out = applyAutoLayout({
      ...container(),
      layout: { mode: "vertical", gap: 10, padding: { top: 8, right: 8, bottom: 8, left: 8 }, align: "start" },
    });
    const [a, b] = out.children!;
    expect([a.x, a.y]).toEqual([8, 8]);
    expect([b.x, b.y]).toEqual([8, 58]); // 8 + 40 + 10
    expect(out.width).toBe(116); // 8 + max(100,60) + 8
    expect(out.height).toBe(86); // 8(top) + 40 + 10 + 20 + 8(bottom)
  });

  it("centers and stretches on the cross axis", () => {
    const centered = applyAutoLayout({
      ...container(),
      layout: { mode: "vertical", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, align: "center" },
    });
    expect(centered.children![1].x).toBe(20); // (100 - 60) / 2

    const stretched = applyAutoLayout({
      ...container(),
      layout: { mode: "vertical", gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, align: "stretch" },
    });
    expect(stretched.children!.every((c) => c.width === 100)).toBe(true);
  });

  it("lays out horizontally and is a no-op when mode is none", () => {
    const h = applyAutoLayout({
      ...container(),
      layout: { mode: "horizontal", gap: 12, padding: { top: 4, right: 4, bottom: 4, left: 4 }, align: "start" },
    });
    expect(h.children![1].x).toBe(116); // 4 + 100 + 12
    expect(h.width).toBe(180); // 4 + 100 + 12 + 60 + 4

    const noop = applyAutoLayout(container());
    expect(noop.children![0].x).toBe(99);
  });
});

describe("image export", () => {
  it("embeds an image node's src as a background image", () => {
    const doc = newDocument();
    const dataUrl = "data:image/png;base64,iVBORw0KG";
    doc.pages[0].frames.push({
      id: "imgf",
      name: "ImgFrame",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      background: "#fff",
      fidelity: "hifi",
      nodes: [
        { id: "im", type: "image", name: "pic", x: 0, y: 0, width: 100, height: 100, style: {}, src: dataUrl },
      ],
    });
    const html = exportToHtml(doc);
    expect(html).toContain(`background-image:url('${dataUrl}')`);
  });
});

describe("multi-screen flow generator", () => {
  const ds = defaultDesignSystem();

  it("plans an e-commerce flow and wires forward navigation between screens", () => {
    const { kind, frames, links } = generateFlowFromBrief("做一个电商购物 App", ds);
    expect(kind).toBe("电商购物流程");
    expect(frames.length).toBe(4);
    // Every link target must resolve to a real generated frame.
    const ids = new Set(frames.map((f) => f.id));
    let found = 0;
    frames.forEach((f) =>
      f.nodes.forEach((n) =>
        n.interactions?.forEach((it) => {
          expect(ids.has(it.targetFrameId)).toBe(true);
          found++;
        }),
      ),
    );
    expect(found).toBe(links);
    expect(links).toBe(frames.length - 1); // linear chain
  });

  it("links each screen to the immediate next one (no dangling/self links)", () => {
    const { frames } = generateFlowFromBrief("登录注册系统", ds);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((f, i) => {
      f.nodes.forEach((n) =>
        n.interactions?.forEach((it) => {
          // forward link points at the next frame, never itself
          expect(it.targetFrameId).not.toBe(f.id);
          expect(it.targetFrameId).toBe(frames[i + 1]?.id);
        }),
      );
    });
  });

  it("falls back to a generic multi-screen flow for unknown briefs", () => {
    const { kind, frames, links } = generateFlowFromBrief("随便一个东西", ds);
    expect(kind).toBe("通用应用流程");
    expect(frames.length).toBe(3);
    expect(links).toBe(2);
  });
});

describe("plugin runtime (doc transforms)", () => {
  function docWith(nodes: Node[]): GpoDocument {
    const d = newDocument();
    d.pages[0].frames.push({
      id: "pf",
      name: "PF",
      x: 0,
      y: 0,
      width: 390,
      height: 844,
      background: "#fff",
      fidelity: "hifi",
      nodes,
    });
    return d;
  }

  function runPlugin(pluginId: string, doc: GpoDocument): GpoDocument {
    let captured = doc;
    const ctx: PluginContext = {
      doc,
      activeFrameId: null,
      updateDesignSystem: () => {},
      updateNode: () => {},
      addComponent: () => {},
      setDoc: (d) => (captured = d),
    };
    PLUGINS.find((p) => p.id === pluginId)!.run(ctx);
    return captured;
  }

  it("mapAllNodes visits nested children and countNodes counts them", () => {
    const doc = docWith([
      { id: "g", type: "group", name: "g", x: 0, y: 0, width: 10, height: 10, style: {}, children: [
        { id: "c1", type: "rect", name: "c1", x: 0, y: 0, width: 5, height: 5, style: {} },
      ] },
    ]);
    expect(countNodes(doc, () => true)).toBe(2); // group + child
    const upper = mapAllNodes(doc, (n) => ({ ...n, name: n.name.toUpperCase() }));
    expect(upper.pages[0].frames.find((f) => f.id === "pf")!.nodes[0].children![0].name).toBe("C1");
  });

  it("snaps all node geometry to an 8px grid", () => {
    const doc = docWith([
      { id: "a", type: "rect", name: "a", x: 13, y: 21, width: 99, height: 5, style: {} },
    ]);
    const out = runPlugin("plg_snap_grid", doc);
    const n = out.pages[0].frames.find((f) => f.id === "pf")!.nodes[0];
    expect([n.x, n.y, n.width, n.height]).toEqual([16, 24, 96, 8]);
  });

  it("unifies radius to design-system radii.md", () => {
    const doc = docWith([
      { id: "b", type: "button", name: "b", x: 0, y: 0, width: 80, height: 40, style: { radius: 3 } },
    ]);
    const mdRadius = doc.designSystem.tokens.radii.md;
    const out = runPlugin("plg_unify_radius", doc);
    expect(out.pages[0].frames.find((f) => f.id === "pf")!.nodes[0].style.radius).toBe(mdRadius);
  });

  it("localizes common Chinese UI text to English", () => {
    const doc = docWith([
      { id: "t", type: "button", name: "登录", x: 0, y: 0, width: 80, height: 40, style: {}, text: {
        content: "登录", fontFamily: "Inter", fontSize: 16, fontWeight: 600, lineHeight: 1.4, color: "#fff", align: "center",
      } },
    ]);
    const out = runPlugin("plg_localize_en", doc);
    expect(out.pages[0].frames.find((f) => f.id === "pf")!.nodes[0].text!.content).toBe("Sign in");
  });
});

describe("z-order reorder", () => {
  const mk = (id: string): Node => ({
    id,
    type: "rect",
    name: id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    style: {},
  });
  const frame = (): Frame => ({
    id: "f",
    name: "f",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    background: "#fff",
    fidelity: "hifi",
    nodes: [mk("a"), mk("b"), mk("c")],
  });
  const order = (f: Frame) => f.nodes.map((n) => n.id).join("");

  it("moves a node forward/backward by one and to front/back", () => {
    expect(order(reorder(frame(), "a", "forward"))).toBe("bac");
    expect(order(reorder(frame(), "c", "backward"))).toBe("acb");
    expect(order(reorder(frame(), "a", "front"))).toBe("bca");
    expect(order(reorder(frame(), "c", "back"))).toBe("cab");
    expect(order(reorder(frame(), "nope", "front"))).toBe("abc");
  });
});

describe("component instances (reset / push to master)", () => {
  function buildDoc(): GpoDocument {
    const d = newDocument();
    const src: Node = {
      id: "src",
      type: "button",
      name: "按钮",
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      style: { fill: { type: "solid", color: "#6366f1" }, radius: 8 },
      text: {
        content: "A",
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1.4,
        color: "#fff",
        align: "center",
      },
    };
    d.pages[0].frames.push({
      id: "pf",
      name: "PF",
      x: 0,
      y: 0,
      width: 390,
      height: 844,
      background: "#fff",
      fidelity: "hifi",
      nodes: [src],
    });
    return d;
  }

  function setup() {
    const doc = buildDoc();
    const s = useStore.getState();
    s.setDoc(doc);
    s.setActivePage(doc.pages[0].id);
    s.setActiveFrame("pf");
    // Create a component from the source node, then make two instances.
    s.selectNodes(["src"]);
    useStore.getState().createComponentFromSelection("Btn");
    const comps = useStore.getState().doc.designSystem.components;
    const compId = comps[comps.length - 1].id;
    useStore.getState().instantiateComponent(compId);
    useStore.getState().instantiateComponent(compId);
    const frame = () =>
      useStore.getState().doc.pages[0].frames.find((f) => f.id === "pf")!;
    const instances = () => frame().nodes.filter((n) => n.componentRef === compId);
    return { compId, frame, instances };
  }

  it("pushInstanceToComponent publishes edits to the master and syncs siblings", () => {
    const { compId, instances } = setup();
    const [a, b] = instances();
    expect(instances().length).toBe(2);
    // Edit instance A's radius + text, then push to master.
    useStore.getState().updateNode("pf", a.id, {
      style: { ...a.style, radius: 24 },
      text: { ...a.text!, content: "PUSHED" },
    });
    useStore.getState().pushInstanceToComponent(a.id);
    // Master template now reflects the edit.
    const master = useStore.getState().doc.designSystem.components.find((c) => c.id === compId)!;
    expect(master.template.text!.content).toBe("PUSHED");
    expect(master.template.style.radius).toBe(24);
    expect(master.template.componentRef).toBeUndefined();
    // Sibling instance B is re-synced to the new master but keeps id + position.
    const newB = instances().find((n) => n.id === b.id)!;
    expect(newB.text!.content).toBe("PUSHED");
    expect(newB.style.radius).toBe(24);
    expect(newB.x).toBe(b.x);
    expect(newB.y).toBe(b.y);
    expect(newB.componentRef).toBe(compId);
  });

  it("isInstanceModified detects overrides but ignores id/position/name", () => {
    const { compId, instances } = setup();
    const master = useStore.getState().doc.designSystem.components.find((c) => c.id === compId)!.template;
    const [a] = instances();
    // Fresh instance differs only by id/x/y/name → considered unmodified.
    expect(isInstanceModified(a, master)).toBe(false);
    useStore.getState().updateNode("pf", a.id, {
      text: { ...a.text!, content: "CHANGED" },
    });
    const edited = instances().find((n) => n.id === a.id)!;
    expect(isInstanceModified(edited, master)).toBe(true);
  });

  it("resetInstance discards local edits and restores the master, keeping id/position", () => {
    const { instances } = setup();
    const [a] = instances();
    useStore.getState().updateNode("pf", a.id, {
      text: { ...a.text!, content: "EDITED" },
    });
    expect(instances().find((n) => n.id === a.id)!.text!.content).toBe("EDITED");
    useStore.getState().resetInstance(a.id);
    const reset = instances().find((n) => n.id === a.id)!;
    expect(reset.text!.content).toBe("A"); // back to master content
    expect(reset.id).toBe(a.id);
    expect(reset.x).toBe(a.x);
    expect(reset.y).toBe(a.y);
    expect(reset.componentRef).toBe(a.componentRef);
  });
});

describe("Sketch document import", () => {
  const sketchDoc = {
    pages: [
      {
        _class: "page",
        name: "Page 1",
        layers: [
          {
            _class: "artboard",
            name: "首页",
            frame: { x: 0, y: 0, width: 375, height: 812 },
            hasBackgroundColor: true,
            backgroundColor: { red: 1, green: 1, blue: 1, alpha: 1 },
            layers: [
              {
                _class: "text",
                name: "标题",
                frame: { x: 20, y: 40, width: 200, height: 30 },
                attributedString: { string: "欢迎" },
                style: {
                  fills: [{ isEnabled: true, color: { red: 0, green: 0, blue: 0, alpha: 1 } }],
                  textStyle: {
                    encodedAttributes: {
                      MSAttributedStringFontAttribute: { attributes: { size: 24, name: "Helvetica" } },
                    },
                  },
                },
              },
              {
                _class: "rectangle",
                name: "主按钮",
                frame: { x: 20, y: 700, width: 335, height: 48 },
                fixedRadius: 8,
                style: { fills: [{ isEnabled: true, color: { red: 0.39, green: 0.4, blue: 0.95, alpha: 1 } }] },
              },
              { _class: "oval", name: "头像", frame: { x: 20, y: 100, width: 48, height: 48 } },
              { _class: "bitmap", name: "图片", frame: { x: 0, y: 160, width: 375, height: 200 } },
            ],
          },
        ],
      },
    ],
  };

  it("maps Sketch artboards/layers to editable GPO frames", () => {
    const res = importDesignJson(JSON.stringify(sketchDoc));
    expect(res.frames.length).toBe(1);
    const f = res.frames[0];
    expect(f.name).toBe("首页");
    expect([f.width, f.height]).toEqual([375, 812]);
    expect(f.background.toLowerCase()).toBe("#ffffff");
    const byName = (n: string) => f.nodes.find((x) => x.name === n)!;
    expect(byName("标题").type).toBe("text");
    expect(byName("标题").text!.content).toBe("欢迎");
    expect(byName("标题").text!.fontSize).toBe(24);
    expect(byName("主按钮").type).toBe("rect");
    expect(byName("主按钮").style.radius).toBe(8);
    expect(byName("头像").type).toBe("ellipse");
    expect(byName("图片").type).toBe("image");
  });

  it("accepts a bare Sketch page object too", () => {
    const res = importDesignJson(JSON.stringify(sketchDoc.pages[0]));
    expect(res.frames.length).toBe(1);
    expect(res.frames[0].nodes.length).toBe(4);
  });
});

describe("selection, align/distribute & cross-frame clipboard", () => {
  const mkNode = (id: string, x: number, y: number, w = 20, h = 20): Node => ({
    id, type: "rect", name: id, x, y, width: w, height: h, style: {},
  });
  const mkFrame = (id: string, nodes: Node[]): Frame => ({
    id, name: id, x: 0, y: 0, width: 400, height: 800, background: "#fff", fidelity: "hifi", nodes,
  });

  function setup(frames: Frame[]) {
    const d = newDocument();
    d.pages[0].frames.push(...frames);
    const s = useStore.getState();
    s.setDoc(d);
    s.setActivePage(d.pages[0].id);
    s.setActiveFrame(frames[0].id);
    const frame = (fid: string) =>
      useStore.getState().doc.pages[0].frames.find((f) => f.id === fid)!;
    return { frame };
  }

  it("selectAll picks every visible/unlocked node in the active frame", () => {
    setup([mkFrame("f1", [mkNode("a", 0, 0), { ...mkNode("b", 30, 0), locked: true }, { ...mkNode("c", 60, 0), hidden: true }, mkNode("d", 90, 0)])]);
    useStore.getState().selectAll();
    expect(useStore.getState().selectedNodeIds.sort()).toEqual(["a", "d"]);
  });

  it("aligns selected nodes left and centers them horizontally", () => {
    const { frame } = setup([mkFrame("f1", [mkNode("a", 0, 0, 20, 20), mkNode("b", 100, 50, 40, 20)])]);
    useStore.getState().selectNodes(["a", "b"]);
    useStore.getState().align("left");
    const xs = frame("f1").nodes.map((n) => n.x);
    expect(xs).toEqual([0, 0]);
    useStore.getState().align("hcenter");
    const center = (n: Node) => n.x + n.width / 2;
    const nodes = frame("f1").nodes;
    expect(center(nodes[0])).toBeCloseTo(center(nodes[1]));
  });

  it("distributes three nodes with equal gaps horizontally", () => {
    const { frame } = setup([mkFrame("f1", [mkNode("a", 0, 0, 20, 20), mkNode("b", 30, 0, 20, 20), mkNode("c", 200, 0, 20, 20)])]);
    useStore.getState().selectNodes(["a", "b", "c"]);
    useStore.getState().align("hdist");
    const ns = [...frame("f1").nodes].sort((p, q) => p.x - q.x);
    const gap1 = ns[1].x - (ns[0].x + ns[0].width);
    const gap2 = ns[2].x - (ns[1].x + ns[1].width);
    expect(gap1).toBeCloseTo(gap2);
  });

  it("copies from one frame and pastes a deep clone into another frame", () => {
    const { frame } = setup([mkFrame("f1", [mkNode("a", 10, 10)]), mkFrame("f2", [])]);
    useStore.getState().selectNodes(["a"]);
    useStore.getState().copySelection();
    useStore.getState().setActiveFrame("f2");
    useStore.getState().paste();
    expect(frame("f1").nodes.length).toBe(1); // source untouched
    expect(frame("f2").nodes.length).toBe(1); // pasted into f2
    expect(frame("f2").nodes[0].id).not.toBe("a"); // fresh id (deep clone)
    expect(frame("f2").nodes[0].name).toBe("a");
  });

  it("reorderNodeTo moves a node to an absolute z-index in the active frame", () => {
    const { frame } = setup([mkFrame("f1", [mkNode("a", 0, 0), mkNode("b", 0, 0), mkNode("c", 0, 0)])]);
    // move "a" (bottom) to the top of the z-order
    useStore.getState().reorderNodeTo("a", 2);
    expect(frame("f1").nodes.map((n) => n.id)).toEqual(["b", "c", "a"]);
    // move "c" to the very bottom
    useStore.getState().reorderNodeTo("c", 0);
    expect(frame("f1").nodes.map((n) => n.id)).toEqual(["c", "b", "a"]);
  });
});

describe("frame naming from requirements", () => {
  it("prefers the markdown H1 heading", () => {
    expect(frameNameFromRequirement("示例需求：登录页", "# 登录页\n- 手机号")).toBe("登录页");
  });
  it("strips boilerplate prefixes when no heading exists", () => {
    expect(frameNameFromRequirement("示例需求：设置页", "随便写点")).toBe("设置页");
    expect(frameNameFromRequirement("需求：首页", "")).toBe("首页");
  });
  it("falls back to the raw title when nothing to strip", () => {
    expect(frameNameFromRequirement("结算", "")).toBe("结算");
  });
});

describe("flatten + auto-name plugins", () => {
  function docWith(nodes: Node[]): GpoDocument {
    const d = newDocument();
    d.pages[0].frames.push({
      id: "pf", name: "PF", x: 0, y: 0, width: 390, height: 844, background: "#fff", fidelity: "hifi", nodes,
    });
    return d;
  }
  function runPlugin(pluginId: string, doc: GpoDocument): GpoDocument {
    let captured = doc;
    const ctx: PluginContext = {
      doc, activeFrameId: null,
      updateDesignSystem: () => {}, updateNode: () => {}, addComponent: () => {},
      setDoc: (d) => (captured = d),
    };
    PLUGINS.find((p) => p.id === pluginId)!.run(ctx);
    return captured;
  }

  it("removes shadows from all nodes (flatten)", () => {
    const doc = docWith([
      { id: "a", type: "rect", name: "a", x: 0, y: 0, width: 10, height: 10, style: { shadow: { x: 0, y: 2, blur: 8, color: "#000" } } },
    ]);
    const out = runPlugin("plg_flatten_shadows", doc);
    expect(out.pages[0].frames.find((f) => f.id === "pf")!.nodes[0].style.shadow).toBeUndefined();
  });

  it("renames layers by type with incrementing index", () => {
    const doc = docWith([
      { id: "x", type: "button", name: "随便", x: 0, y: 0, width: 10, height: 10, style: {} },
      { id: "y", type: "button", name: "另一个", x: 0, y: 0, width: 10, height: 10, style: {} },
    ]);
    const out = runPlugin("plg_auto_name", doc);
    const names = out.pages[0].frames.find((f) => f.id === "pf")!.nodes.map((n) => n.name);
    expect(names).toEqual(["按钮 1", "按钮 2"]);
  });
});

describe("requirement AI assist (local heuristics)", () => {
  const local = { provider: "local" as const, apiKey: "", model: "heuristic-v1" };

  it("drafts a full PRD scaffold from a brief", async () => {
    const { markdown, source } = await assistRequirement("draft", "做一个团队待办协作工具", local);
    expect(source).toBe("local");
    expect(markdown).toMatch(/^# 产品需求文档/);
    expect(markdown).toMatch(/验收标准/);
    expect(markdown).toMatch(/功能需求/);
  });

  it("polish collapses blank lines and normalizes bullets", async () => {
    const messy = "# 标题\n\n\n\n* 第一\n• 第二  \n";
    const { markdown } = await assistRequirement("polish", messy, local);
    expect(markdown).not.toMatch(/\n\n\n/);
    expect(markdown).toMatch(/- 第一/);
    expect(markdown).toMatch(/- 第二/);
  });

  it("expand appends missing standard sections", async () => {
    const { markdown } = await assistRequirement("expand", "# 我的需求\n只有一个标题", local);
    expect(markdown).toMatch(/验收标准/);
    expect(markdown).toMatch(/非功能需求/);
  });
});

describe("design variables", () => {
  it("resolves a fill bound to a color variable to its value", () => {
    const ds = defaultDesignSystem();
    const v = (ds.variables ?? []).find((x) => x.name === "brand/primary")!;
    expect(v).toBeTruthy();
    expect(resolveFill({ type: "variable", variableId: v.id }, ds)).toBe("#4f46e5");
  });

  it("follows variable value changes (single source of truth)", () => {
    const ds = defaultDesignSystem();
    const v = (ds.variables ?? []).find((x) => x.name === "brand/accent")!;
    v.value = "#ff0000";
    expect(resolveFill({ type: "variable", variableId: v.id }, ds)).toBe("#ff0000");
  });

  it("falls back when the variable id is missing", () => {
    const ds = defaultDesignSystem();
    expect(resolveFill({ type: "variable", variableId: "nope" }, ds, "#abc")).toBe("#abc");
  });
});

describe("third-party component import", () => {
  const figma = JSON.stringify({
    document: {
      type: "DOCUMENT",
      children: [
        {
          type: "CANVAS",
          name: "Page 1",
          children: [
            {
              type: "COMPONENT",
              name: "Primary Button",
              absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 40 },
              children: [
                {
                  type: "TEXT",
                  name: "Label",
                  characters: "Click me",
                  absoluteBoundingBox: { x: 8, y: 10, width: 100, height: 20 },
                  style: { fontSize: 14 },
                },
              ],
            },
            {
              type: "FRAME",
              name: "Home",
              absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 844 },
              children: [],
            },
          ],
        },
      ],
    },
  });

  it("extracts Figma COMPONENT nodes as reusable component definitions", () => {
    const defs = parseFigmaComponents(JSON.parse(figma));
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("Primary Button");
    expect(defs[0].template.type).toBe("group");
    expect(defs[0].template.children?.[0].type).toBe("text");
  });

  it("imports components alongside frames, without double-counting the component as a frame", () => {
    const result = importDesignJson(figma);
    expect(result.components).toHaveLength(1);
    expect(result.frames).toHaveLength(1); // only the FRAME, not the COMPONENT
    expect(result.summary).toContain("组件");
  });

  it("extracts Sketch symbolMaster layers as components", () => {
    const sketch = JSON.stringify({
      pages: [
        {
          _class: "page",
          layers: [
            {
              _class: "symbolMaster",
              name: "Card",
              frame: { x: 0, y: 0, width: 200, height: 120 },
              layers: [
                { _class: "rectangle", name: "bg", frame: { x: 0, y: 0, width: 200, height: 120 } },
              ],
            },
          ],
        },
      ],
    });
    const defs = parseSketchSymbols(JSON.parse(sketch));
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("Card");
    expect(defs[0].template.children).toHaveLength(1);
  });
});

describe("design-system audit", () => {
  it("passes the default standard system (semantic colors, scales, elevation)", () => {
    const findings = auditDesignSystem(defaultDesignSystem());
    expect(findings.some((f) => f.level === "error")).toBe(false);
    expect(findings.some((f) => f.message.includes("阴影"))).toBe(true);
  });

  it("flags a system missing required semantic colors as an error", () => {
    const ds = defaultDesignSystem();
    ds.tokens.colors = { primary: "#000000" };
    const findings = auditDesignSystem(ds);
    expect(findings.some((f) => f.level === "error")).toBe(true);
  });

  it("computes WCAG contrast (white on indigo passes AA)", () => {
    const ratio = contrastRatio("#4f46e5", "#ffffff");
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(4.5);
  });
});

describe("built-in components + Element Plus packages", () => {
  it("ships seed components in a new document (button/input/card/avatar)", () => {
    const doc = newDocument();
    const names = doc.designSystem.components.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["主按钮", "输入框", "卡片", "头像"]));
    const btn = doc.designSystem.components.find((c) => c.name === "主按钮")!;
    expect(btn.template.style.fill).toEqual({ type: "token", token: "primary" });
  });

  it("exposes an Element Plus category and buildable nodes", () => {
    const ep = COMPONENT_PACKAGES.filter((p) => p.category === "Element Plus");
    expect(ep.length).toBeGreaterThanOrEqual(8);
    const ds = defaultDesignSystem();
    for (const pkg of ep) {
      const node = pkg.build(ds);
      expect(node.id).toBeTruthy();
      expect(node.width).toBeGreaterThan(0);
    }
    const table = buildElementPlus("ep_table", ds)!;
    expect(table.children!.length).toBeGreaterThan(3);
  });
});

describe("design-system presets", () => {
  it("provides standard presets with complete token scales", () => {
    expect(DESIGN_SYSTEM_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const p of DESIGN_SYSTEM_PRESETS) {
      expect(p.tokens.colors.primary).toMatch(/^#|rgb|^#?\w/);
      expect(Object.keys(p.tokens.radii).length).toBeGreaterThan(0);
      expect(p.tokens.elevation).toBeTruthy();
      expect(p.variables().length).toBeGreaterThan(0);
    }
  });

  it("findPreset resolves Material and Element Plus by id", () => {
    expect(findPreset("preset_material")!.tokens.colors.primary).toBe("#6750a4");
    expect(findPreset("preset_element_plus")!.tokens.colors.primary).toBe("#409eff");
    expect(findPreset("nope")).toBeUndefined();
  });
});

describe("plugin manifest spec", () => {
  it("every plugin reports version/apiVersion/category/permissions", () => {
    for (const p of PLUGINS) {
      expect(p.version).toBeTruthy();
      expect(p.apiVersion).toBe(PLUGIN_API_VERSION);
      expect(p.category).toBeTruthy();
      expect(Array.isArray(p.permissions) && p.permissions!.length).toBeTruthy();
    }
  });
});

describe("requirements slash commands", () => {
  it("filters commands by query (title/key/hint, case-insensitive)", () => {
    expect(filterSlashCommands("")).toHaveLength(SLASH_COMMANDS.length);
    expect(filterSlashCommands("story").some((c) => c.key === "story")).toBe(true);
    expect(filterSlashCommands("ai-").every((c) => c.kind === "ai")).toBe(true);
    expect(filterSlashCommands("ai-").length).toBe(
      SLASH_COMMANDS.filter((c) => c.kind === "ai").length,
    );
    expect(filterSlashCommands("表格")[0].key).toBe("table");
  });

  it("offers a rich, grouped command library (20+ commands across groups)", () => {
    expect(SLASH_COMMANDS.length).toBeGreaterThanOrEqual(20);
    // every command declares a known group + an icon
    const groupIds = new Set(SLASH_GROUPS.map((g) => g.id));
    expect(SLASH_COMMANDS.every((c) => groupIds.has(c.group) && !!c.icon)).toBe(true);
    // keys are unique
    expect(new Set(SLASH_COMMANDS.map((c) => c.key)).size).toBe(SLASH_COMMANDS.length);
  });

  it("groups filtered commands and drops empty groups", () => {
    const all = groupedSlashCommands("");
    expect(all.length).toBe(SLASH_GROUPS.length);
    expect(all.flatMap((g) => g.commands)).toHaveLength(SLASH_COMMANDS.length);
    // a basic-only query yields a single group
    const basic = groupedSlashCommands("标题");
    expect(basic.every((g) => g.id === "basic")).toBe(true);
    expect(groupedSlashCommands("zzz-no-match")).toHaveLength(0);
  });

  it("detects a slash trigger at line start / after whitespace but not inside a URL", () => {
    expect(detectSlash("/sto", 4)).toEqual({ start: 0, query: "sto" });
    expect(detectSlash("hello /tab", 10)).toEqual({ start: 6, query: "tab" });
    expect(detectSlash("https://x", 9)).toBeNull(); // '/' preceded by ':'
    expect(detectSlash("foo /bar baz", 12)).toBeNull(); // space after query ends it
  });
});

describe("user-journey map: domain logic", () => {
  it("clamps emotion into the -2..2 integer range", () => {
    expect(clampEmotion(5)).toBe(2);
    expect(clampEmotion(-9)).toBe(-2);
    expect(clampEmotion(0.7)).toBe(1);
  });

  it("maps emotion scores to column-centered points (2=top, -2=bottom)", () => {
    const pts = emotionPoints([2, 0, -2], 300, 100, 10);
    expect(pts.map((p) => Math.round(p.x))).toEqual([50, 150, 250]); // 3 equal slots
    expect(pts[0].y).toBeCloseTo(10); // emotion 2 -> top padding
    expect(pts[2].y).toBeCloseTo(90); // emotion -2 -> bottom (height-pad)
    expect(pts[1].y).toBeCloseTo(50); // neutral -> middle
  });

  it("builds a non-empty smooth curve path for multiple stages", () => {
    expect(emotionCurvePath([1, -1, 2], 300, 100)).toMatch(/^M .* C /);
    expect(emotionCurvePath([], 300, 100)).toBe("");
  });

  it("averages emotion and counts pains / opportunities", () => {
    const j = seedJourney();
    expect(averageEmotion(j.stages)).toBeCloseTo(0.5); // 1,-1,0,2 -> 0.5
    expect(countPains(j)).toBeGreaterThan(0);
    expect(countOpportunities(j)).toBeGreaterThan(0);
  });

  it("exports a journey to markdown and CSV with one column per stage", () => {
    const j = seedJourney();
    const md = journeyToMarkdown(j);
    expect(md).toContain("# 用户旅程地图：新用户登录旅程");
    expect(md).toContain("## 阶段 1：打开 App");
    const csv = journeyToCsv(j);
    const header = csv.split("\n")[0].split(",");
    expect(header).toHaveLength(j.stages.length + 1); // 维度 + each stage
  });

  it("heuristic generator picks a domain template and emits ordered stages", () => {
    const shop = generateJourneyFromBrief("做一个电商购物 App");
    expect(shop.title).toContain("网购");
    expect(shop.stages.length).toBeGreaterThanOrEqual(4);
    expect(shop.stages.every((s) => typeof s.name === "string")).toBe(true);

    const onboard = generateJourneyFromBrief("新用户注册引导流程");
    expect(onboard.stages.some((s) => s.name.includes("注册"))).toBe(true);
  });

  it("coerces a loose LLM object into a valid JourneyMap", () => {
    const j = coerceJourney({
      title: "X",
      persona: { name: "P" },
      stages: [{ name: "s1", emotion: 9, actions: ["a"], pains: "bad" }],
    });
    expect(j.stages[0].emotion).toBe(2); // clamped
    expect(j.stages[0].actions).toEqual(["a"]);
    expect(j.stages[0].pains).toEqual([]); // non-array dropped
    expect(j.persona.avatar).toBe("🙂"); // defaulted
  });
});

describe("user-journey map: store actions", () => {
  it("adds / updates / reorders / deletes stages and journeys", () => {
    useStore.getState().setDoc(newDocument());
    const before = useStore.getState().doc.journeys.length; // seeded with 1
    const j = useStore.getState().addJourney();
    expect(useStore.getState().doc.journeys.length).toBe(before + 1);
    expect(useStore.getState().activeJourneyId).toBe(j.id);

    const stage0 = j.stages[0].id;
    useStore.getState().updateStage(j.id, stage0, { name: "认知", emotion: -2 });
    useStore.getState().addStage(j.id);
    let jr = useStore.getState().doc.journeys.find((x) => x.id === j.id)!;
    expect(jr.stages).toHaveLength(2);
    expect(jr.stages[0].name).toBe("认知");

    const second = jr.stages[1].id;
    useStore.getState().moveStage(j.id, second, "left");
    jr = useStore.getState().doc.journeys.find((x) => x.id === j.id)!;
    expect(jr.stages[0].id).toBe(second); // moved to front

    useStore.getState().deleteStage(j.id, second);
    jr = useStore.getState().doc.journeys.find((x) => x.id === j.id)!;
    expect(jr.stages).toHaveLength(1);

    useStore.getState().updateJourney(j.id, { title: "新标题" });
    expect(useStore.getState().doc.journeys.find((x) => x.id === j.id)!.title).toBe("新标题");

    useStore.getState().deleteJourney(j.id);
    expect(useStore.getState().doc.journeys.find((x) => x.id === j.id)).toBeUndefined();
  });

  it("round-trips journeys through the .gpo container", async () => {
    const doc = newDocument();
    const blob = await serializeGpo(doc);
    const restored = await deserializeGpo(blob);
    expect(restored.journeys).toHaveLength(doc.journeys.length);
    expect(restored.journeys[0].stages[0].emotion).toBe(doc.journeys[0].stages[0].emotion);
  });
});
