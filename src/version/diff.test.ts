import { describe, expect, it } from "vitest";
import { diffDocuments, summarizeDiff } from "./diff";
import { newDocument, emptyFrame, emptyPage } from "@/schema/defaults";
import { GpoDocument, Node } from "@/schema/types";

function clone(d: GpoDocument): GpoDocument {
  return JSON.parse(JSON.stringify(d)) as GpoDocument;
}

function textNode(id: string, name = "t"): Node {
  return {
    id,
    type: "text",
    name,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    style: {},
    text: {
      content: name,
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.4,
      color: "#000",
      align: "left",
    },
  } as Node;
}

describe("diffDocuments", () => {
  it("reports no changes for identical docs", () => {
    const a = newDocument("Doc");
    const b = clone(a);
    const d = diffDocuments(a, b);
    expect(d.total).toBe(0);
    expect(summarizeDiff(d)).toBe("无变化");
  });

  it("detects document rename", () => {
    const a = newDocument("Doc");
    const b = clone(a);
    b.meta.name = "Renamed";
    const d = diffDocuments(a, b);
    expect(d.nameChanged).toBe(true);
    expect(d.total).toBe(1);
  });

  it("detects added and removed frames", () => {
    const a = newDocument("Doc");
    a.pages = [emptyPage("Page 1")];
    const b = clone(a);
    const f = emptyFrame("New Frame");
    b.pages[0].frames.push(f);
    const d = diffDocuments(a, b);
    expect(d.framesAdded).toContain("New Frame");
    // reverse direction → removed
    const d2 = diffDocuments(b, a);
    expect(d2.framesRemoved).toContain("New Frame");
  });

  it("counts node add / change / remove within a frame", () => {
    const a = newDocument("Doc");
    const f = emptyFrame("F");
    f.nodes = [textNode("n1", "hello")];
    a.pages = [{ ...emptyPage("P"), frames: [f] }];

    const b = clone(a);
    // change n1, add n2
    b.pages[0].frames[0].nodes[0].name = "changed";
    b.pages[0].frames[0].nodes.push(textNode("n2", "second"));

    const d = diffDocuments(a, b);
    expect(d.nodesChanged).toBe(1);
    expect(d.nodesAdded).toBe(1);
    expect(d.framesChanged).toContain("F");

    const d2 = diffDocuments(b, a);
    expect(d2.nodesRemoved).toBe(1);
  });

  it("flattens nested group children when diffing", () => {
    const a = newDocument("Doc");
    const f = emptyFrame("F");
    const group: Node = {
      id: "g1",
      type: "group",
      name: "grp",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      style: {},
      children: [textNode("c1"), textNode("c2")],
    } as Node;
    f.nodes = [group];
    a.pages = [{ ...emptyPage("P"), frames: [f] }];

    const b = clone(a);
    b.pages[0].frames[0].nodes[0].children![0].name = "edited";
    const d = diffDocuments(a, b);
    expect(d.nodesChanged).toBe(1);
  });
});
