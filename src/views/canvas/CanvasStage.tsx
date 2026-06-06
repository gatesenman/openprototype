import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Ellipse, Line, Circle, Path, Transformer } from "react-konva";
import Konva from "konva";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { Frame, Node, VectorAnchor, VectorPath } from "@/schema/types";
import { pathToSvgData, pathBounds } from "@/vector/geometry";
import { nodeFill } from "@/render/resolve";
import { konvaFillProps } from "@/render/fill";
import { id } from "@/schema/defaults";
import { registerStage } from "@/export/exportPng";
import ContextMenu, { MenuItem } from "./ContextMenu";
import Icon from "@/components/Icon";

interface Guide {
  points: number[];
}

/** A red distance label drawn between the dragged node and its nearest
 *  neighbour (or the frame edge) on one axis. */
interface Measure {
  points: number[];
  label: string;
  lx: number;
  ly: number;
}

const GRID = 8;

/**
 * Konva strokes are always centered on the edge. To emulate Figma's
 * inside/outside stroke alignment for rectangular nodes, inset/expand the drawn
 * rect by half the stroke width so the centered stroke lands inside or outside
 * the node's logical bounds.
 */
export function strokeRectGeometry(
  width: number,
  height: number,
  radius: number,
  stroke?: { width: number; position?: "inside" | "center" | "outside" },
): { x: number; y: number; width: number; height: number; cornerRadius: number } {
  const w = stroke?.width ?? 0;
  const pos = stroke?.position ?? "center";
  if (!w || pos === "center") {
    return { x: 0, y: 0, width, height, cornerRadius: radius };
  }
  const off = pos === "inside" ? w / 2 : -w / 2;
  return {
    x: off,
    y: off,
    width: Math.max(0, width - off * 2),
    height: Math.max(0, height - off * 2),
    cornerRadius: Math.max(0, radius - off),
  };
}

/** Renders an image node's `src` (data URL) as a rounded fill pattern; falls
 *  back to a neutral placeholder while loading or when no source is set. */
function NodeImage({ node }: { node: Node }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!node.src) {
      setImg(null);
      return;
    }
    const im = new window.Image();
    im.onload = () => setImg(im);
    im.src = node.src;
  }, [node.src]);

  const radius = node.style.radius ?? 0;
  if (!img) {
    return <Rect width={node.width} height={node.height} fill="#e5e7eb" cornerRadius={radius} />;
  }
  return (
    <Rect
      width={node.width}
      height={node.height}
      cornerRadius={radius}
      fillPatternImage={img}
      fillPatternScaleX={node.width / img.width}
      fillPatternScaleY={node.height / img.height}
      fillPatternRepeat="no-repeat"
      stroke={node.style.stroke?.color}
      strokeWidth={node.style.stroke?.width ?? 0}
    />
  );
}

export default function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(0.75);
  const [pos, setPos] = useState({ x: 80, y: 60 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const [editing, setEditing] = useState<{ frameId: string; nodeId: string } | null>(null);
  const [spacePan, setSpacePan] = useState(false);
  // Pen tool: in-progress path (anchors are in the target frame's local coords).
  const [pen, setPen] = useState<{
    frameId: string;
    anchors: VectorAnchor[];
    cursor: { x: number; y: number };
  } | null>(null);
  const penDragging = useRef(false);
  // Vector anchor-editing mode for an existing vector node.
  const [vecEdit, setVecEdit] = useState<{ frameId: string; nodeId: string } | null>(null);

  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const activePageId = useStore((s) => s.activePageId);
  const page = doc.pages.find((p) => p.id === activePageId);
  const activeFrameId = useStore((s) => s.activeFrameId);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectNodes = useStore((s) => s.selectNodes);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const setActiveFrame = useStore((s) => s.setActiveFrame);
  const updateNode = useStore((s) => s.updateNode);
  const moveSelection = useStore((s) => s.moveSelection);
  const addNode = useStore((s) => s.addNode);
  const setNodePath = useStore((s) => s.setNodePath);
  const copySelection = useStore((s) => s.copySelection);
  const paste = useStore((s) => s.paste);
  const duplicateSelection = useStore((s) => s.duplicateSelection);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const groupSelection = useStore((s) => s.groupSelection);
  const ungroupSelection = useStore((s) => s.ungroupSelection);
  const reorderSelection = useStore((s) => s.reorderSelection);
  const toggleLock = useStore((s) => s.toggleLock);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const createComponentFromSelection = useStore((s) => s.createComponentFromSelection);
  const selectAll = useStore((s) => s.selectAll);
  const clipboard = useStore((s) => s.clipboard);

  const [menu, setMenu] = useState<{ x: number; y: number; onEmpty: boolean } | null>(null);
  // Loaded HTMLImageElements for image fills, keyed by src.
  const [fillImages, setFillImages] = useState<Record<string, HTMLImageElement>>({});

  const comments = useStore((s) => s.doc.comments);
  const commentMode = useStore((s) => s.commentMode);
  const activeCommentId = useStore((s) => s.activeCommentId);
  const setActiveComment = useStore((s) => s.setActiveComment);
  const addComment = useStore((s) => s.addComment);
  const [composer, setComposer] = useState<{ frameId: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");

  const tool = useUi((s) => s.tool);
  const setTool = useUi((s) => s.setTool);
  const showRulers = useUi((s) => s.showRulers);
  const showGrid = useUi((s) => s.showGrid);
  const snapEnabled = useUi((s) => s.snapEnabled);
  const toggleRulers = useUi((s) => s.toggleRulers);
  const toggleGrid = useUi((s) => s.toggleGrid);
  const toggleSnap = useUi((s) => s.toggleSnap);

  const trRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const shapeRefs = useRef<Record<string, Konva.Node>>({});
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    registerStage(() => (stageRef.current ? { stage: stageRef.current, scale, pos } : null));
  }, [scale, pos]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Zoom keyboard shortcuts (Shift+1 fit, Shift+0 / Ctrl+0 reset to 100%).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.shiftKey && e.key === "1") {
        e.preventDefault();
        fitToScreen();
      } else if ((e.shiftKey || e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, pos, size, page]);

  // Space-to-pan (Figma-style): hold Space to temporarily grab/drag the canvas.
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const tag = (t as HTMLElement)?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isField(e.target)) {
        e.preventDefault();
        setSpacePan(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Pen tool keyboard: Enter finishes an open path, Esc cancels, Backspace pops.
  useEffect(() => {
    if (!pen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishPen(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPen(null);
        setTool("select");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPen((cur) =>
          cur && cur.anchors.length > 1 ? { ...cur, anchors: cur.anchors.slice(0, -1) } : cur,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pen]);

  // Attach transformer only when exactly one (unlocked) node is selected.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selectedNodeIds.length === 1 && !vecEdit) {
      const target = shapeRefs.current[selectedNodeIds[0]];
      tr.nodes(target ? [target] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedNodeIds, doc, scale, vecEdit]);

  // Apply (or clear) the Konva blur filter for nodes that have a layer blur,
  // and invalidate cached gradient/pattern fills so style edits repaint.
  // Konva caches the computed gradient per shape; react-konva updating the
  // colorStops/endpoint attrs does not reliably force the layer to repaint
  // the new gradient, so we clear the cache and issue a full (not batched)
  // draw here after every doc change.
  useEffect(() => {
    for (const fr of page?.frames ?? []) {
      for (const nd of fr.nodes) {
        const k = shapeRefs.current[nd.id] as
          | (Konva.Node & {
              blurRadius?: (v: number) => void;
              _clearCache?: (attr?: string) => void;
            })
          | undefined;
        if (!k) continue;
        const blur = nd.style.blur ?? 0;
        if (blur > 0) {
          k.cache();
          k.filters([Konva.Filters.Blur]);
          k.blurRadius?.(blur);
        } else if (k.filters()?.length) {
          k.clearCache();
          k.filters([]);
        }
        // Drop any stale cached gradient so the new color stops/angle paint.
        const ft = nd.style.fill?.type;
        if (ft === "linear" || ft === "radial") {
          k._clearCache?.("linearGradient");
          k._clearCache?.("radialGradient");
        }
      }
    }
    // Full synchronous draw: batchDraw can leave cached gradients stale.
    const stage = stageRef.current;
    if (stage) for (const layer of stage.getLayers()) layer.draw();
  }, [doc, page, scale]);

  // Preload images referenced by image fills so Konva can paint them.
  useEffect(() => {
    const srcs = new Set<string>();
    for (const fr of page?.frames ?? [])
      for (const nd of fr.nodes)
        if (nd.style.fill?.type === "image") srcs.add(nd.style.fill.src);
    srcs.forEach((src) => {
      if (fillImages[src]) return;
      const im = new window.Image();
      im.onload = () => setFillImages((m) => ({ ...m, [src]: im }));
      im.src = src;
    });
  }, [doc, page, fillImages]);

  const world = (stage: Konva.Stage) => {
    const p = stage.getPointerPosition()!;
    return { x: (p.x - pos.x) / scale, y: (p.y - pos.y) / scale };
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage()!;
    const pointer = stage.getPointerPosition()!;
    const oldScale = scale;
    const by = e.evt.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.min(3, Math.max(0.1, oldScale * by));
    const mp = { x: (pointer.x - pos.x) / oldScale, y: (pointer.y - pos.y) / oldScale };
    setScale(newScale);
    setPos({ x: pointer.x - mp.x * newScale, y: pointer.y - mp.y * newScale });
  };

  // ---- Zoom controls ----
  const zoomToScale = (newScale: number) => {
    const ns = Math.min(3, Math.max(0.1, newScale));
    // keep viewport center fixed
    const cx = size.w / 2;
    const cy = size.h / 2;
    const wx = (cx - pos.x) / scale;
    const wy = (cy - pos.y) / scale;
    setScale(ns);
    setPos({ x: cx - wx * ns, y: cy - wy * ns });
  };
  const zoomIn = () => zoomToScale(scale * 1.2);
  const zoomOut = () => zoomToScale(scale / 1.2);
  const resetZoom = () => zoomToScale(1);
  const fitToScreen = () => {
    if (!page || page.frames.length === 0) return;
    const minX = Math.min(...page.frames.map((f) => f.x));
    const minY = Math.min(...page.frames.map((f) => f.y - 24));
    const maxX = Math.max(...page.frames.map((f) => f.x + f.width));
    const maxY = Math.max(...page.frames.map((f) => f.y + f.height));
    const bw = maxX - minX;
    const bh = maxY - minY;
    const pad = 60;
    const ns = Math.min(3, Math.max(0.1, Math.min((size.w - pad) / bw, (size.h - pad) / bh)));
    setScale(ns);
    setPos({
      x: (size.w - bw * ns) / 2 - minX * ns,
      y: (size.h - bh * ns) / 2 - minY * ns,
    });
  };

  const frameOf = (frameId: string) => page?.frames.find((f) => f.id === frameId);

  // ---- Snapping while dragging ----
  const computeSnap = (frame: Frame, node: Node, x: number, y: number) => {
    if (!snapEnabled) return { snapX: x, snapY: y, guides: [] as Guide[] };
    const others = frame.nodes.filter((n) => n.id !== node.id && !n.hidden);
    const targetsX = [0, frame.width / 2, frame.width];
    const targetsY = [0, frame.height / 2, frame.height];
    others.forEach((o) => {
      targetsX.push(o.x, o.x + o.width / 2, o.x + o.width);
      targetsY.push(o.y, o.y + o.height / 2, o.y + o.height);
    });
    const edgesX = [x, x + node.width / 2, x + node.width];
    const edgesY = [y, y + node.height / 2, y + node.height];
    const g: Guide[] = [];
    let snapX = x;
    let snapY = y;
    let matchedX = false;
    let matchedY = false;
    const TH = 6;
    edgesX.forEach((ex) => {
      for (const t of targetsX) {
        if (Math.abs(ex - t) < TH) {
          snapX = x + (t - ex);
          g.push({ points: [t, -10000, t, 10000] });
          matchedX = true;
          break;
        }
      }
    });
    edgesY.forEach((ey) => {
      for (const t of targetsY) {
        if (Math.abs(ey - t) < TH) {
          snapY = y + (t - ey);
          g.push({ points: [-10000, t, 10000, t] });
          matchedY = true;
          break;
        }
      }
    });
    // Fall back to grid snapping when the grid overlay is on and no edge matched.
    if (showGrid && !matchedX) snapX = Math.round(x / GRID) * GRID;
    if (showGrid && !matchedY) snapY = Math.round(y / GRID) * GRID;
    return { snapX, snapY, guides: g };
  };

  /** Red distance labels: nearest neighbour gap (or frame edge) on each axis. */
  const computeMeasures = (frame: Frame, node: Node, x: number, y: number): Measure[] => {
    const w = node.width;
    const h = node.height;
    const midX = x + w / 2;
    const midY = y + h / 2;
    const others = frame.nodes.filter((n) => n.id !== node.id && !n.hidden);
    const out: Measure[] = [];
    const overlapY = (o: Node) => y < o.y + o.height && y + h > o.y;
    const overlapX = (o: Node) => x < o.x + o.width && x + w > o.x;

    // Horizontal: nearest edge on the smaller of left/right.
    const leftN = others.filter((o) => overlapY(o) && o.x + o.width <= x + 0.5);
    const rightN = others.filter((o) => overlapY(o) && o.x >= x + w - 0.5);
    const leftEdge = leftN.length ? Math.max(...leftN.map((o) => o.x + o.width)) : 0;
    const rightEdge = rightN.length ? Math.min(...rightN.map((o) => o.x)) : frame.width;
    const gapL = x - leftEdge;
    const gapR = rightEdge - (x + w);
    if (gapL <= gapR && gapL >= 0) {
      out.push({ points: [leftEdge, midY, x, midY], label: `${Math.round(gapL)}`, lx: (leftEdge + x) / 2, ly: midY });
    } else if (gapR >= 0) {
      out.push({ points: [x + w, midY, rightEdge, midY], label: `${Math.round(gapR)}`, lx: (x + w + rightEdge) / 2, ly: midY });
    }

    // Vertical: nearest edge on the smaller of top/bottom.
    const topN = others.filter((o) => overlapX(o) && o.y + o.height <= y + 0.5);
    const botN = others.filter((o) => overlapX(o) && o.y >= y + h - 0.5);
    const topEdge = topN.length ? Math.max(...topN.map((o) => o.y + o.height)) : 0;
    const botEdge = botN.length ? Math.min(...botN.map((o) => o.y)) : frame.height;
    const gapT = y - topEdge;
    const gapB = botEdge - (y + h);
    if (gapT <= gapB && gapT >= 0) {
      out.push({ points: [midX, topEdge, midX, y], label: `${Math.round(gapT)}`, lx: midX, ly: (topEdge + y) / 2 });
    } else if (gapB >= 0) {
      out.push({ points: [midX, y + h, midX, botEdge], label: `${Math.round(gapB)}`, lx: midX, ly: (y + h + botEdge) / 2 });
    }
    return out;
  };

  const startEditing = (frameId: string, node: Node) => {
    if (!node.text) return;
    setEditing({ frameId, nodeId: node.id });
  };

  const renderNode = (frame: Frame, node: Node): React.ReactNode => {
    if (node.hidden) return null;
    const isSelected = selectedNodeIds.includes(node.id);
    const draggable = tool === "select" && !node.locked && !spacePan;
    const fillProps = (fallback: string) =>
      konvaFillProps(
        node,
        ds,
        fallback,
        node.style.fill?.type === "image" ? fillImages[node.style.fill.src] : undefined,
      );

    const common = {
      ref: (n: Konva.Node | null) => {
        if (n) shapeRefs.current[node.id] = n;
      },
      x: node.x,
      y: node.y,
      rotation: node.rotation ?? 0,
      draggable,
      onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        setActiveFrame(frame.id);
        if (e.evt.shiftKey) toggleSelect(node.id);
        else if (!selectedNodeIds.includes(node.id)) selectNodes([node.id]);
      },
      onDblClick: () => {
        if (node.type === "vector") setVecEdit({ frameId: frame.id, nodeId: node.id });
        else startEditing(frame.id, node);
      },
      onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        setActiveFrame(frame.id);
        if (!selectedNodeIds.includes(node.id)) selectNodes([node.id]);
        const stage = e.target.getStage()!;
        const p = stage.getPointerPosition()!;
        setMenu({ x: p.x, y: p.y, onEmpty: false });
      },
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
        const t = e.target;
        const { snapX, snapY, guides: g } = computeSnap(frame, node, t.x(), t.y());
        t.position({ x: snapX, y: snapY });
        setGuides(g);
        setMeasures(computeMeasures(frame, node, snapX, snapY));
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        setGuides([]);
        setMeasures([]);
        const nx = Math.round(e.target.x());
        const ny = Math.round(e.target.y());
        if (selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
          moveSelection(nx - node.x, ny - node.y);
        } else {
          updateNode(frame.id, node.id, { x: nx, y: ny });
        }
      },
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
        const n = e.target;
        const sx = n.scaleX();
        const sy = n.scaleY();
        n.scaleX(1);
        n.scaleY(1);
        updateNode(frame.id, node.id, {
          x: Math.round(n.x()),
          y: Math.round(n.y()),
          width: Math.max(4, Math.round(node.width * sx)),
          height: Math.max(4, Math.round(node.height * sy)),
          rotation: Math.round(n.rotation()),
        });
      },
    };

    const selStroke = isSelected ? (
      <Rect
        width={node.width}
        height={node.height}
        stroke="#0d99ff"
        strokeWidth={1.5 / scale}
        listening={false}
      />
    ) : null;

    if (node.type === "vector" && node.path) {
      const data = pathToSvgData(node.path);
      const hasFill = !!node.style.fill;
      const vpath = node.path;
      return (
        <Group
          key={node.id}
          {...common}
          onTransformEnd={(e) => {
            const n = e.target;
            const sx = n.scaleX();
            const sy = n.scaleY();
            n.scaleX(1);
            n.scaleY(1);
            const scaled: VectorPath = {
              closed: vpath.closed,
              anchors: vpath.anchors.map((a) => ({
                x: a.x * sx,
                y: a.y * sy,
                hIn: a.hIn ? { x: a.hIn.x * sx, y: a.hIn.y * sy } : undefined,
                hOut: a.hOut ? { x: a.hOut.x * sx, y: a.hOut.y * sy } : undefined,
              })),
            };
            updateNode(frame.id, node.id, {
              x: Math.round(n.x()),
              y: Math.round(n.y()),
              width: Math.max(1, Math.round(node.width * sx)),
              height: Math.max(1, Math.round(node.height * sy)),
              rotation: Math.round(n.rotation()),
              path: scaled,
            });
          }}
        >
          <Path
            data={data}
            {...(hasFill ? fillProps(nodeFill(node, ds)) : { fill: undefined })}
            stroke={node.style.stroke?.color ?? (hasFill ? undefined : "#1e1e1e")}
            strokeWidth={node.style.stroke?.width ?? (hasFill ? 0 : 1.5)}
            opacity={node.style.opacity ?? 1}
            shadowColor={node.style.shadow?.color}
            shadowBlur={node.style.shadow?.blur ?? 0}
            shadowOffsetX={node.style.shadow?.x ?? 0}
            shadowOffsetY={node.style.shadow?.y ?? 0}
          />
          {selStroke}
        </Group>
      );
    }

    if (node.type === "text") {
      const t = node.text!;
      return (
        <Group key={node.id} {...common}>
          <Text
            width={node.width}
            height={node.height}
            text={t.content}
            fontSize={t.fontSize}
            fontStyle={t.fontWeight >= 600 ? "bold" : "normal"}
            fontFamily={t.fontFamily}
            fill={t.color}
            align={t.align}
            verticalAlign="middle"
            lineHeight={t.lineHeight}
          />
          {selStroke}
        </Group>
      );
    }

    if (node.type === "ellipse") {
      const sw = node.style.stroke?.width ?? 0;
      const pos = node.style.stroke?.position ?? "center";
      const inset = pos === "inside" ? sw / 2 : pos === "outside" ? -sw / 2 : 0;
      return (
        <Group key={node.id} {...common}>
          <Ellipse
            x={node.width / 2}
            y={node.height / 2}
            radiusX={Math.max(0.5, node.width / 2 - inset)}
            radiusY={Math.max(0.5, node.height / 2 - inset)}
            {...fillProps(nodeFill(node, ds))}
            stroke={node.style.stroke?.color}
            strokeWidth={sw}
            opacity={node.style.opacity ?? 1}
            shadowColor={node.style.shadow?.color}
            shadowBlur={node.style.shadow?.blur ?? 0}
            shadowOffsetX={node.style.shadow?.x ?? 0}
            shadowOffsetY={node.style.shadow?.y ?? 0}
          />
          {selStroke}
        </Group>
      );
    }

    if (node.type === "line") {
      return (
        <Group key={node.id} {...common}>
          <Line
            points={[0, node.height / 2, node.width, node.height / 2]}
            stroke={node.style.stroke?.color ?? "#94a3b8"}
            strokeWidth={node.style.stroke?.width ?? 2}
          />
          {selStroke}
        </Group>
      );
    }

    if (node.type === "group" && node.children) {
      return (
        <Group key={node.id} {...common}>
          {node.children.map((c) => (
            <Group key={c.id} x={c.x} y={c.y} listening={false}>
              {renderChildVisual(c)}
            </Group>
          ))}
          {selStroke}
        </Group>
      );
    }

    if (node.type === "image") {
      return (
        <Group key={node.id} {...common}>
          <NodeImage node={node} />
          {selStroke}
        </Group>
      );
    }

    // rect / button / input / icon
    const rg = strokeRectGeometry(
      node.width,
      node.height,
      node.style.radius ?? 0,
      node.style.stroke,
    );
    return (
      <Group key={node.id} {...common}>
        <Rect
          x={rg.x}
          y={rg.y}
          width={rg.width}
          height={rg.height}
          {...fillProps(nodeFill(node, ds))}
          cornerRadius={rg.cornerRadius}
          stroke={node.style.stroke?.color}
          strokeWidth={node.style.stroke?.width ?? 0}
          opacity={node.style.opacity ?? 1}
          shadowColor={node.style.shadow?.color}
          shadowBlur={node.style.shadow?.blur ?? 0}
          shadowOffsetX={node.style.shadow?.x ?? 0}
          shadowOffsetY={node.style.shadow?.y ?? 0}
        />
        {node.text && (
          <Text
            width={node.width}
            height={node.height}
            text={node.text.content}
            fontSize={node.text.fontSize}
            fontStyle={node.text.fontWeight >= 600 ? "bold" : "normal"}
            fontFamily={node.text.fontFamily}
            fill={node.text.color}
            align={node.type === "button" ? "center" : node.text.align}
            verticalAlign="middle"
            padding={node.type === "input" ? 12 : 0}
            listening={false}
          />
        )}
        {selStroke}
      </Group>
    );
  };

  // Non-interactive visual for group children.
  const renderChildVisual = (node: Node): React.ReactNode => {
    if (node.type === "text" && node.text) {
      return (
        <Text
          width={node.width}
          height={node.height}
          text={node.text.content}
          fontSize={node.text.fontSize}
          fontStyle={node.text.fontWeight >= 600 ? "bold" : "normal"}
          fontFamily={node.text.fontFamily}
          fill={node.text.color}
          align={node.text.align}
          verticalAlign="middle"
        />
      );
    }
    if (node.type === "image") {
      return <NodeImage node={node} />;
    }
    if (node.type === "vector" && node.path) {
      return (
        <Path
          data={pathToSvgData(node.path)}
          fill={node.style.fill ? nodeFill(node, ds) : undefined}
          stroke={node.style.stroke?.color ?? (node.style.fill ? undefined : "#1e1e1e")}
          strokeWidth={node.style.stroke?.width ?? (node.style.fill ? 0 : 1.5)}
        />
      );
    }
    return (
      <>
        <Rect
          width={node.width}
          height={node.height}
          fill={nodeFill(node, ds)}
          cornerRadius={node.style.radius ?? 0}
          stroke={node.style.stroke?.color}
          strokeWidth={node.style.stroke?.width ?? 0}
        />
        {node.text && (
          <Text
            width={node.width}
            height={node.height}
            text={node.text.content}
            fontSize={node.text.fontSize}
            fontFamily={node.text.fontFamily}
            fill={node.text.color}
            align={node.type === "button" ? "center" : node.text.align}
            verticalAlign="middle"
            padding={node.type === "input" ? 12 : 0}
          />
        )}
      </>
    );
  };

  const addShapeAt = (frame: Frame, lx: number, ly: number) => {
    const base = { id: id(), name: "", x: lx, y: ly, style: {} as Node["style"] };
    let node: Node;
    if (tool === "text") {
      node = {
        ...base,
        type: "text",
        name: "文本",
        width: 160,
        height: 28,
        style: {},
        text: {
          content: "文本",
          fontFamily: ds.tokens.fonts.family,
          fontSize: ds.tokens.fonts.sizes.md,
          fontWeight: 400,
          lineHeight: 1.4,
          color: ds.tokens.colors.text,
          align: "left",
        },
      };
    } else if (tool === "ellipse") {
      node = { ...base, type: "ellipse", name: "椭圆", width: 100, height: 100, style: { fill: { type: "solid", color: "#cbd5e1" } } };
    } else if (tool === "line") {
      node = { ...base, type: "line", name: "分割线", width: 160, height: 2, style: { stroke: { color: "#94a3b8", width: 2 } } };
    } else if (tool === "button") {
      node = {
        ...base,
        type: "button",
        name: "按钮",
        width: 140,
        height: 44,
        style: { fill: { type: "token", token: "primary" }, radius: ds.tokens.radii.md },
        text: { content: "按钮", fontFamily: ds.tokens.fonts.family, fontSize: 16, fontWeight: 600, lineHeight: 1.4, color: ds.tokens.colors["primary-fg"], align: "center" },
      };
    } else if (tool === "input") {
      node = {
        ...base,
        type: "input",
        name: "输入框",
        width: 220,
        height: 44,
        style: { fill: { type: "solid", color: "#fff" }, stroke: { color: ds.tokens.colors.border, width: 1 }, radius: ds.tokens.radii.md },
        text: { content: "请输入…", fontFamily: ds.tokens.fonts.family, fontSize: 15, fontWeight: 400, lineHeight: 1.4, color: ds.tokens.colors.muted, align: "left" },
      };
    } else {
      node = { ...base, type: "rect", name: "矩形", width: 120, height: 80, style: { fill: { type: "solid", color: "#e2e8f0" }, radius: ds.tokens.radii.md } };
    }
    addNode(frame.id, node);
    setTool("select");
  };

  const renderFrame = (frame: Frame) => {
    const isActive = frame.id === activeFrameId;
    const gridLines: React.ReactNode[] = [];
    if (showGrid && isActive) {
      for (let gx = GRID; gx < frame.width; gx += GRID) {
        gridLines.push(
          <Line key={`gx${gx}`} points={[gx, 0, gx, frame.height]} stroke="#c9ced6" strokeWidth={(gx % (GRID * 8) === 0 ? 0.6 : 0.3) / scale} listening={false} />,
        );
      }
      for (let gy = GRID; gy < frame.height; gy += GRID) {
        gridLines.push(
          <Line key={`gy${gy}`} points={[0, gy, frame.width, gy]} stroke="#c9ced6" strokeWidth={(gy % (GRID * 8) === 0 ? 0.6 : 0.3) / scale} listening={false} />,
        );
      }
    }
    return (
      <Group key={frame.id} x={frame.x} y={frame.y}>
        <Text
          text={`${frame.name}  ·  ${frame.fidelity === "hifi" ? "高保真" : "线框"}`}
          y={-22}
          fontSize={13}
          fill={isActive ? "#0d99ff" : "#cbd5e1"}
          onClick={() => setActiveFrame(frame.id)}
        />
        <Rect
          width={frame.width}
          height={frame.height}
          fill={frame.background}
          stroke={isActive ? "#0d99ff" : "#94a3b8"}
          strokeWidth={isActive ? 2 / scale : 1 / scale}
          cornerRadius={6}
          shadowColor="rgba(0,0,0,0.4)"
          shadowBlur={20}
          onMouseDown={(e) => {
            setActiveFrame(frame.id);
            const stage = e.target.getStage()!;
            const w = world(stage);
            if (commentMode) {
              setComposer({ frameId: frame.id, x: w.x - frame.x, y: w.y - frame.y });
              setDraft("");
            } else if (tool === "select") {
              selectNodes([]);
              marqueeStart.current = w;
              setMarquee({ x: w.x, y: w.y, w: 0, h: 0 });
            } else if (tool !== "pen") {
              addShapeAt(frame, Math.round(w.x - frame.x), Math.round(w.y - frame.y));
            }
          }}
          onDblClick={() => {
            if (tool === "pen") finishPen(false);
          }}
        />
        {frame.clipContent ? (
          <Group clipX={0} clipY={0} clipWidth={frame.width} clipHeight={frame.height}>
            {frame.nodes.map((n) => renderNode(frame, n))}
          </Group>
        ) : (
          frame.nodes.map((n) => renderNode(frame, n))
        )}
        {comments
          .filter((c) => c.frameId === frame.id)
          .map((c) => {
            const active = c.id === activeCommentId;
            return (
              <Group
                key={c.id}
                x={c.x}
                y={c.y}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  setActiveComment(c.id);
                }}
              >
                <Circle
                  radius={11 / scale}
                  fill={c.resolved ? "#16a34a" : active ? "#0d99ff" : "#f59e0b"}
                  stroke="#ffffff"
                  strokeWidth={2 / scale}
                  shadowColor="rgba(0,0,0,0.4)"
                  shadowBlur={6 / scale}
                />
                <Text
                  width={22 / scale}
                  height={22 / scale}
                  offsetX={11 / scale}
                  offsetY={11 / scale}
                  text={c.resolved ? "✓" : "💬"}
                  fontSize={11 / scale}
                  align="center"
                  verticalAlign="middle"
                  listening={false}
                />
              </Group>
            );
          })}
        {gridLines}
        {isActive &&
          guides.map((g, i) => (
            <Line key={i} points={g.points} stroke="#ec4899" strokeWidth={1 / scale} dash={[4, 4]} />
          ))}
        {isActive &&
          measures.map((m, i) => (
            <Group key={`m${i}`} listening={false}>
              <Line points={m.points} stroke="#ef4444" strokeWidth={1 / scale} />
              <Line points={[m.points[0], m.points[1] - 4 / scale, m.points[0], m.points[1] + 4 / scale]} stroke="#ef4444" strokeWidth={1 / scale} />
              <Line points={[m.points[2], m.points[3] - 4 / scale, m.points[2], m.points[3] + 4 / scale]} stroke="#ef4444" strokeWidth={1 / scale} />
              <Rect x={m.lx - 14 / scale} y={m.ly - 9 / scale} width={28 / scale} height={16 / scale} fill="#ef4444" cornerRadius={3 / scale} />
              <Text x={m.lx - 14 / scale} y={m.ly - 7 / scale} width={28 / scale} text={m.label} fontSize={11 / scale} fill="#ffffff" align="center" />
            </Group>
          ))}
      </Group>
    );
  };

  // marquee selection handlers (stage level)
  const onStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!marqueeStart.current) return;
    const w = world(e.target.getStage()!);
    const s = marqueeStart.current;
    setMarquee({
      x: Math.min(s.x, w.x),
      y: Math.min(s.y, w.y),
      w: Math.abs(w.x - s.x),
      h: Math.abs(w.y - s.y),
    });
  };

  const onStageMouseUp = () => {
    if (marqueeStart.current && marquee && activeFrameId) {
      const frame = frameOf(activeFrameId);
      if (frame && (marquee.w > 3 || marquee.h > 3)) {
        const hits = frame.nodes
          .filter((n) => !n.hidden)
          .filter((n) => {
            const nx = frame.x + n.x;
            const ny = frame.y + n.y;
            return (
              nx + n.width >= marquee.x &&
              nx <= marquee.x + marquee.w &&
              ny + n.height >= marquee.y &&
              ny <= marquee.y + marquee.h
            );
          })
          .map((n) => n.id);
        if (hits.length) selectNodes(hits);
      }
    }
    marqueeStart.current = null;
    setMarquee(null);
  };

  // ---- Pen tool ----
  const frameUnder = (w: { x: number; y: number }): Frame | undefined =>
    page?.frames.find(
      (f) => w.x >= f.x && w.x <= f.x + f.width && w.y >= f.y && w.y <= f.y + f.height,
    );

  const finishPen = (closed: boolean) => {
    const cur = pen;
    if (!cur || cur.anchors.length < 2) {
      setPen(null);
      setTool("select");
      return;
    }
    const frame = frameOf(cur.frameId);
    if (!frame) {
      setPen(null);
      setTool("select");
      return;
    }
    const path: VectorPath = { anchors: cur.anchors, closed };
    const b = pathBounds(path);
    const node: Node = {
      id: id("vec"),
      type: "vector",
      name: closed ? "矢量形状" : "路径",
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: Math.max(1, Math.round(b.width)),
      height: Math.max(1, Math.round(b.height)),
      style: closed
        ? { fill: { type: "solid", color: "#d9d9d9" } }
        : { stroke: { color: "#1e1e1e", width: 2 } },
      path: {
        closed,
        anchors: cur.anchors.map((a) => ({ ...a, x: a.x - b.x, y: a.y - b.y })),
      },
    };
    setPen(null);
    addNode(frame.id, node);
    setTool("select");
  };

  const handlePenDown = (w: { x: number; y: number }) => {
    const frame = pen ? frameOf(pen.frameId) : frameUnder(w) ?? frameOf(activeFrameId ?? "");
    if (!frame) return;
    if (!pen) setActiveFrame(frame.id);
    const lp = { x: w.x - frame.x, y: w.y - frame.y };
    const anchors = pen && pen.frameId === frame.id ? pen.anchors : [];
    if (anchors.length >= 2) {
      const first = anchors[0];
      const near = Math.hypot(lp.x - first.x, lp.y - first.y) < 8 / scale;
      if (near) {
        finishPen(true);
        return;
      }
    }
    penDragging.current = true;
    const next = [...anchors, { x: lp.x, y: lp.y } as VectorAnchor];
    setPen({ frameId: frame.id, anchors: next, cursor: lp });
  };

  const handlePenMove = (w: { x: number; y: number }) => {
    if (!pen) return;
    const frame = frameOf(pen.frameId);
    if (!frame) return;
    const lp = { x: w.x - frame.x, y: w.y - frame.y };
    if (penDragging.current && pen.anchors.length > 0) {
      const anchors = pen.anchors.slice();
      const last = anchors[anchors.length - 1];
      const hOut = { x: lp.x - last.x, y: lp.y - last.y };
      anchors[anchors.length - 1] = { ...last, hOut, hIn: { x: -hOut.x, y: -hOut.y } };
      setPen({ ...pen, anchors, cursor: lp });
    } else {
      setPen({ ...pen, cursor: lp });
    }
  };

  const handlePenUp = () => {
    penDragging.current = false;
  };

  const renderPenPreview = () => {
    if (!pen) return null;
    const frame = frameOf(pen.frameId);
    if (!frame) return null;
    const previewAnchors =
      pen.anchors.length > 0 && !penDragging.current
        ? [...pen.anchors, { x: pen.cursor.x, y: pen.cursor.y } as VectorAnchor]
        : pen.anchors;
    const data = pathToSvgData({ anchors: previewAnchors, closed: false });
    return (
      <Group x={frame.x} y={frame.y} listening={false}>
        <Path data={data} stroke="#0d99ff" strokeWidth={1.5 / scale} dash={[5 / scale, 4 / scale]} />
        {pen.anchors.map((a, i) => (
          <Circle
            key={i}
            x={a.x}
            y={a.y}
            radius={4 / scale}
            fill={i === 0 ? "#0d99ff" : "#ffffff"}
            stroke="#0d99ff"
            strokeWidth={1.5 / scale}
          />
        ))}
      </Group>
    );
  };

  const renderVecEdit = () => {
    if (!vecEdit) return null;
    const frame = frameOf(vecEdit.frameId);
    const node = frame?.nodes.find((n) => n.id === vecEdit.nodeId);
    if (!frame || !node || !node.path) return null;
    const ox = frame.x + node.x;
    const oy = frame.y + node.y;
    const vp = node.path;
    return (
      <Group>
        {vp.anchors.map((a, i) => (
          <Circle
            key={i}
            x={ox + a.x}
            y={oy + a.y}
            radius={5 / scale}
            fill={a.hIn || a.hOut ? "#0d99ff" : "#ffffff"}
            stroke="#0d99ff"
            strokeWidth={1.5 / scale}
            draggable
            onDragMove={(e) => {
              const nx = e.target.x() - ox;
              const ny = e.target.y() - oy;
              const anchors = vp.anchors.slice();
              anchors[i] = { ...anchors[i], x: nx, y: ny };
              updateNode(frame.id, node.id, { path: { ...vp, anchors } });
            }}
            onDragEnd={() => {
              const fresh = frameOf(vecEdit.frameId)?.nodes.find((n) => n.id === vecEdit.nodeId);
              if (fresh?.path) setNodePath(frame.id, node.id, fresh.path);
            }}
            onClick={(e) => {
              if (e.evt.altKey && vp.anchors.length > 2) {
                e.cancelBubble = true;
                setNodePath(frame.id, node.id, {
                  ...vp,
                  anchors: vp.anchors.filter((_, idx) => idx !== i),
                });
              }
            }}
            onDblClick={(e) => {
              e.cancelBubble = true;
              const anchors = vp.anchors.slice();
              const cur = anchors[i];
              if (cur.hIn || cur.hOut) {
                anchors[i] = { x: cur.x, y: cur.y };
              } else {
                const prev = anchors[(i - 1 + anchors.length) % anchors.length];
                const next = anchors[(i + 1) % anchors.length];
                const dx = (next.x - prev.x) / 4;
                const dy = (next.y - prev.y) / 4;
                anchors[i] = { ...cur, hOut: { x: dx, y: dy }, hIn: { x: -dx, y: -dy } };
              }
              setNodePath(frame.id, node.id, { ...vp, anchors });
            }}
          />
        ))}
      </Group>
    );
  };

  if (!page) return null;

  // Inline text editor overlay position
  const editNode = editing
    ? frameOf(editing.frameId)?.nodes.find((n) => n.id === editing.nodeId)
    : null;
  const editFrame = editing ? frameOf(editing.frameId) : null;

  return (
    <div className={`canvas-wrap${spacePan ? " panning" : ""}`} ref={wrapRef}>
      <div className="canvas-tools">
        <button className={`ctool ${showRulers ? "on" : ""}`} title="标尺" onClick={toggleRulers}>
          <Icon name="ruler" size={15} />
        </button>
        <button className={`ctool ${showGrid ? "on" : ""}`} title="网格 (8px)" onClick={toggleGrid}>
          <Icon name="grid" size={15} />
        </button>
        <button className={`ctool ${snapEnabled ? "on" : ""}`} title="吸附对齐" onClick={toggleSnap}>
          <Icon name="magnet" size={15} />
        </button>
      </div>

      {showRulers && <Rulers size={size} scale={scale} pos={pos} />}

      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable={spacePan || (tool === "select" && !marqueeStart.current)}
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (spacePan) return;
          if (tool === "pen") {
            handlePenDown(world(e.target.getStage()!));
            return;
          }
          if (e.target === e.target.getStage()) {
            selectNodes([]);
            if (vecEdit) setVecEdit(null);
          }
        }}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          if (e.target === e.target.getStage()) {
            const stage = e.target.getStage()!;
            const p = stage.getPointerPosition()!;
            setMenu({ x: p.x, y: p.y, onEmpty: true });
          }
        }}
        onMouseMove={(e) => {
          if (tool === "pen") handlePenMove(world(e.target.getStage()!));
          onStageMouseMove(e);
        }}
        onMouseUp={() => {
          if (tool === "pen") handlePenUp();
          onStageMouseUp();
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() });
        }}
      >
        <Layer>
          {page.frames.map(renderFrame)}
          {marquee && (
            <Rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
              fill="rgba(13,153,255,0.12)"
              stroke="#0d99ff"
              strokeWidth={1 / scale}
            />
          )}
          {renderPenPreview()}
          {renderVecEdit()}
          <Transformer ref={trRef} rotateEnabled ignoreStroke boundBoxFunc={(_o, n) => n} />
        </Layer>
      </Stage>

      {editNode && editFrame && editNode.text && (
        <textarea
          autoFocus
          defaultValue={editNode.text.content}
          onBlur={(e) => {
            updateNode(editFrame.id, editNode.id, {
              text: { ...editNode.text!, content: e.target.value },
            });
            setEditing(null);
          }}
          style={{
            position: "absolute",
            left: pos.x + (editFrame.x + editNode.x) * scale,
            top: pos.y + (editFrame.y + editNode.y) * scale,
            width: editNode.width * scale,
            height: Math.max(editNode.height * scale, 24),
            fontSize: (editNode.text.fontSize || 16) * scale,
            fontFamily: editNode.text.fontFamily,
            color: editNode.text.color,
            border: "2px solid #0d99ff",
            borderRadius: 4,
            padding: editNode.type === "input" ? 6 : 2,
            outline: "none",
            resize: "none",
            background: "#fff",
            zIndex: 20,
            textAlign: editNode.text.align,
          }}
        />
      )}

      {composer &&
        (() => {
          const cf = frameOf(composer.frameId);
          if (!cf) return null;
          const left = pos.x + (cf.x + composer.x) * scale;
          const top = pos.y + (cf.y + composer.y) * scale;
          const submit = () => {
            const text = draft.trim();
            if (text) addComment(composer.frameId, composer.x, composer.y, text);
            setComposer(null);
            setDraft("");
          };
          return (
            <div className="comment-composer" style={{ left, top }}>
              <textarea
                autoFocus
                placeholder="写下批注…（Enter 提交 / Esc 取消）"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  } else if (e.key === "Escape") {
                    setComposer(null);
                    setDraft("");
                  }
                }}
              />
              <div className="comment-composer-actions">
                <button className="btn" onClick={() => setComposer(null)}>取消</button>
                <button className="btn primary" onClick={submit} disabled={!draft.trim()}>
                  评论
                </button>
              </div>
            </div>
          );
        })()}

      <CommentThread />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={buildMenuItems({
            onEmpty: menu.onEmpty,
            selCount: selectedNodeIds.length,
            hasClipboard: clipboard.length > 0,
            actions: {
              copySelection,
              paste,
              duplicateSelection,
              deleteSelection,
              groupSelection,
              ungroupSelection,
              reorderSelection,
              toggleLock,
              toggleHidden,
              selectAll,
              createComponent: () => {
                const name = prompt("组件名称：", "新组件");
                if (name) createComponentFromSelection(name);
              },
            },
            selectedLocked: (() => {
              const f = frameOf(activeFrameId ?? "");
              const sel = f?.nodes.filter((n) => selectedNodeIds.includes(n.id)) ?? [];
              return sel.length > 0 && sel.every((n) => n.locked);
            })(),
            selectedHidden: (() => {
              const f = frameOf(activeFrameId ?? "");
              const sel = f?.nodes.filter((n) => selectedNodeIds.includes(n.id)) ?? [];
              return sel.length > 0 && sel.every((n) => n.hidden);
            })(),
          })}
        />
      )}

      <div className="zoom-bar">
        <button className="zoom-btn" title="缩小" onClick={zoomOut}>
          <Icon name="minus" size={14} />
        </button>
        <button className="zoom-pct" title="重置为 100%" onClick={resetZoom}>
          {Math.round(scale * 100)}%
        </button>
        <button className="zoom-btn" title="放大" onClick={zoomIn}>
          <Icon name="plus" size={14} />
        </button>
        <span className="zoom-sep" />
        <button className="zoom-btn" title="适配屏幕 (Shift+1)" onClick={fitToScreen}>
          <Icon name="fit" size={14} />
        </button>
      </div>
    </div>
  );
}

/** Fixed horizontal + vertical rulers showing world coordinates, with a
 *  shaded origin corner. Tick spacing adapts to the current zoom. */
function Rulers({
  size,
  scale,
  pos,
}: {
  size: { w: number; h: number };
  scale: number;
  pos: { x: number; y: number };
}) {
  // Choose a "nice" world-space step so labels stay ~80px apart on screen.
  const targetPx = 80;
  const raw = targetPx / scale;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 5, 10];
  const step = (steps.find((s) => s * pow >= raw) ?? 10) * pow;

  const hTicks: React.ReactNode[] = [];
  const startWorldX = Math.floor(-pos.x / scale / step) * step;
  for (let wx = startWorldX; ; wx += step) {
    const sx = pos.x + wx * scale;
    if (sx > size.w) break;
    if (sx < 24) continue;
    hTicks.push(
      <div key={`h${wx}`} className="ruler-tick-h" style={{ left: sx }}>
        <span>{Math.round(wx)}</span>
      </div>,
    );
  }
  const vTicks: React.ReactNode[] = [];
  const startWorldY = Math.floor(-pos.y / scale / step) * step;
  for (let wy = startWorldY; ; wy += step) {
    const sy = pos.y + wy * scale;
    if (sy > size.h) break;
    if (sy < 24) continue;
    vTicks.push(
      <div key={`v${wy}`} className="ruler-tick-v" style={{ top: sy }}>
        <span>{Math.round(wy)}</span>
      </div>,
    );
  }
  return (
    <>
      <div className="ruler ruler-h">{hTicks}</div>
      <div className="ruler ruler-v">{vTicks}</div>
      <div className="ruler-corner" />
    </>
  );
}

function buildMenuItems(opts: {
  onEmpty: boolean;
  selCount: number;
  hasClipboard: boolean;
  selectedLocked: boolean;
  selectedHidden: boolean;
  actions: {
    copySelection: () => void;
    paste: () => void;
    duplicateSelection: () => void;
    deleteSelection: () => void;
    groupSelection: () => void;
    ungroupSelection: () => void;
    reorderSelection: (dir: string) => void;
    toggleLock: (id: string) => void;
    toggleHidden: (id: string) => void;
    selectAll: () => void;
    createComponent: () => void;
  };
}): MenuItem[] {
  const { onEmpty, selCount, hasClipboard, actions, selectedLocked, selectedHidden } = opts;
  const single = selCount === 1;
  if (onEmpty) {
    return [
      { label: "粘贴", icon: "paste", shortcut: "Ctrl+V", disabled: !hasClipboard, onClick: actions.paste },
      { label: "全选", icon: "cursor", shortcut: "Ctrl+A", onClick: actions.selectAll },
    ];
  }
  // Note: layer-tree exposes per-node lock/hide; here we toggle for selection's first node.
  const toggleLockSel = () => useStore.getState().selectedNodeIds.forEach((id) => actions.toggleLock(id));
  const toggleHideSel = () => useStore.getState().selectedNodeIds.forEach((id) => actions.toggleHidden(id));
  return [
    { label: "复制", icon: "copy", shortcut: "Ctrl+C", onClick: actions.copySelection },
    { label: "粘贴", icon: "paste", shortcut: "Ctrl+V", disabled: !hasClipboard, onClick: actions.paste },
    { label: "再制", icon: "duplicate", shortcut: "Ctrl+D", onClick: actions.duplicateSelection },
    { divider: true },
    { label: "编组", icon: "group", shortcut: "Ctrl+G", disabled: selCount < 2, onClick: actions.groupSelection },
    { label: "取消编组", icon: "ungroup", shortcut: "Ctrl+Shift+G", disabled: !single, onClick: actions.ungroupSelection },
    { label: "创建为组件", icon: "component", disabled: selCount < 1, onClick: actions.createComponent },
    { divider: true },
    { label: "置于顶层", icon: "bringFront", shortcut: "Ctrl+Shift+]", disabled: !single, onClick: () => actions.reorderSelection("front") },
    { label: "上移一层", icon: "bringFront", shortcut: "Ctrl+]", disabled: !single, onClick: () => actions.reorderSelection("forward") },
    { label: "下移一层", icon: "sendBack", shortcut: "Ctrl+[", disabled: !single, onClick: () => actions.reorderSelection("backward") },
    { label: "置于底层", icon: "sendBack", shortcut: "Ctrl+Shift+[", disabled: !single, onClick: () => actions.reorderSelection("back") },
    { divider: true },
    { label: selectedLocked ? "解锁" : "锁定", icon: selectedLocked ? "unlock" : "lock", onClick: toggleLockSel },
    { label: selectedHidden ? "显示" : "隐藏", icon: selectedHidden ? "eye" : "eyeOff", onClick: toggleHideSel },
    { divider: true },
    { label: "删除", icon: "trash", shortcut: "Del", danger: true, onClick: actions.deleteSelection },
  ];
}

function CommentThread() {
  const activeCommentId = useStore((s) => s.activeCommentId);
  const comment = useStore((s) => s.doc.comments.find((c) => c.id === s.activeCommentId));
  const setActiveComment = useStore((s) => s.setActiveComment);
  const replyComment = useStore((s) => s.replyComment);
  const resolveComment = useStore((s) => s.resolveComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const [reply, setReply] = useState("");

  if (!activeCommentId || !comment) return null;

  const sendReply = () => {
    const t = reply.trim();
    if (!t) return;
    replyComment(comment.id, t);
    setReply("");
  };

  return (
    <div className="comment-thread">
      <div className="comment-thread-head">
        <span>批注 {comment.resolved ? "· 已解决" : ""}</span>
        <button className="tool-btn" title="关闭" onClick={() => setActiveComment(null)}>✕</button>
      </div>
      <div className="comment-thread-body">
        {comment.thread.map((m) => (
          <div key={m.id} className="comment-msg">
            <div className="comment-msg-meta">
              <strong>{m.author}</strong>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <div className="comment-msg-text">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="comment-thread-foot">
        <input
          placeholder="回复…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendReply()}
        />
        <button className="btn" onClick={sendReply} disabled={!reply.trim()}>回复</button>
        <button className="btn" onClick={() => resolveComment(comment.id, !comment.resolved)}>
          {comment.resolved ? "重新打开" : "标记解决"}
        </button>
        <button className="btn danger" onClick={() => deleteComment(comment.id)}>删除</button>
      </div>
    </div>
  );
}
