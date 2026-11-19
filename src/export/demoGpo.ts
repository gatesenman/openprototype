import { newDocument } from "@/schema/defaults";
import type { Frame, GpoDocument, Node } from "@/schema/types";

export function demoGpo(): GpoDocument {
  const doc = newDocument("Starter checkout");
  const home: Frame = {
    id: "home",
    name: "Home",
    x: 0,
    y: 0,
    width: 390,
    height: 844,
    background: "#ffffff",
    fidelity: "hifi",
    nodes: [
      {
        id: "btn-go",
        type: "button",
        name: "Checkout",
        x: 24,
        y: 400,
        width: 342,
        height: 48,
        style: {},
        text: {
          content: "Go to checkout",
          fontFamily: "Inter",
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "#fff",
          align: "center",
        },
        interactions: [
          {
            id: "act-go",
            trigger: "click",
            targetFrameId: "checkout",
            animation: "fade",
          },
        ],
      } satisfies Node,
    ],
  };
  const checkout: Frame = {
    id: "checkout",
    name: "Checkout",
    x: 420,
    y: 0,
    width: 390,
    height: 844,
    background: "#f8fafc",
    fidelity: "hifi",
    nodes: [
      {
        id: "btn-back",
        type: "button",
        name: "Back",
        x: 24,
        y: 24,
        width: 80,
        height: 36,
        style: {},
        text: {
          content: "Back",
          fontFamily: "Inter",
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.4,
          color: "#0f172a",
          align: "center",
        },
        interactions: [
          {
            id: "act-back",
            trigger: "click",
            targetFrameId: "home",
            animation: "slide-right",
          },
        ],
      } satisfies Node,
    ],
  };
  doc.pages[0].name = "Checkout flow";
  doc.pages[0].frames = [home, checkout];
  return doc;
}
