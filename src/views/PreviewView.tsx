import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { DesignSystem, Frame, Interaction, Node, PrototypeVariable } from "@/schema/types";
import { nodeFill } from "@/render/resolve";
import {
  TRANSITION_KEYFRAMES,
  VarState,
  applySetVariable,
  conditionMet,
  describeTransition,
  initVars,
  resolveTemplate,
} from "@/prototype/runtime";

interface RuntimeCtx {
  ds: DesignSystem;
  vars: PrototypeVariable[];
  state: VarState;
  fire: (it: Interaction) => void;
  setVar: (variableId: string, value: string) => void;
}

function NodeView({ node, ctx }: { node: Node; ctx: RuntimeCtx }) {
  const { ds, vars, state } = ctx;
  const dragRef = useRef<{ x: number; y: number; fired: boolean } | null>(null);
  if (node.hidden) return null;

  const interactions = node.interactions ?? [];
  const click = interactions.find((i) => i.trigger === "click");
  const hover = interactions.find((i) => i.trigger === "hover");
  const drag = interactions.find((i) => i.trigger === "drag");
  const interactive = click || hover || drag;

  const scroll = node.scroll && node.scroll !== "none";
  const overflowX = scroll && (node.scroll === "horizontal" || node.scroll === "both") ? "auto" : undefined;
  const overflowY = scroll && (node.scroll === "vertical" || node.scroll === "both") ? "auto" : "hidden";

  const style: CSSProperties = {
    position: node.fixed ? "sticky" : "absolute",
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    borderRadius: node.style.radius ?? 0,
    opacity: node.style.opacity ?? 1,
    cursor: interactive ? "pointer" : "default",
    boxShadow: node.style.shadow
      ? `${node.style.shadow.x}px ${node.style.shadow.y}px ${node.style.shadow.blur}px ${node.style.shadow.color}`
      : undefined,
    border: node.style.stroke ? `${node.style.stroke.width}px solid ${node.style.stroke.color}` : undefined,
    background: node.type === "text" ? undefined : nodeFill(node, ds),
    display: "flex",
    alignItems: "center",
    justifyContent:
      node.type === "button"
        ? "center"
        : node.text?.align === "center"
          ? "center"
          : node.text?.align === "right"
            ? "flex-end"
            : "flex-start",
    padding: node.type === "input" ? "0 12px" : 0,
    color: node.text?.color,
    fontSize: node.text?.fontSize,
    fontWeight: node.text?.fontWeight,
    fontFamily: node.text?.fontFamily,
    lineHeight: node.text ? `${node.text.lineHeight}` : undefined,
    textAlign: node.text?.align,
    boxSizing: "border-box",
    overflow: scroll ? undefined : "hidden",
    overflowX,
    overflowY,
    zIndex: node.fixed ? 50 : undefined,
    mixBlendMode: node.style.blendMode && node.style.blendMode !== "normal" ? node.style.blendMode : undefined,
    filter: node.style.blur ? `blur(${node.style.blur}px)` : undefined,
  };

  // Form input: write-bound input renders a real text field.
  if (node.type === "input" && node.binding?.mode === "write") {
    const v = state[node.binding.variableId] ?? "";
    return (
      <input
        id={`pv-node-${node.id}`}
        style={{ ...style, outline: "none" }}
        value={v}
        placeholder={node.text?.content}
        onChange={(e) => ctx.setVar(node.binding!.variableId, e.target.value)}
      />
    );
  }

  // Resolve displayed text: read-binding shows the variable; otherwise template the content.
  let textContent = node.text?.content ?? "";
  if (node.binding?.mode === "read") {
    textContent = state[node.binding.variableId] ?? "";
  } else if (textContent) {
    textContent = resolveTemplate(textContent, state, vars);
  }

  return (
    <div
      id={`pv-node-${node.id}`}
      style={style}
      onClick={(e) => {
        if (click) {
          e.stopPropagation();
          ctx.fire(click);
        }
      }}
      onMouseEnter={() => hover && ctx.fire(hover)}
      onPointerDown={(e) => {
        if (drag) dragRef.current = { x: e.clientX, y: e.clientY, fired: false };
      }}
      onPointerMove={(e) => {
        if (drag && dragRef.current && !dragRef.current.fired) {
          const dx = Math.abs(e.clientX - dragRef.current.x);
          const dy = Math.abs(e.clientY - dragRef.current.y);
          if (dx + dy > 24) {
            dragRef.current.fired = true;
            ctx.fire(drag);
          }
        }
      }}
      onPointerUp={() => (dragRef.current = null)}
    >
      {textContent}
      {node.children?.map((c) => (
        <NodeView key={c.id} node={c} ctx={ctx} />
      ))}
    </div>
  );
}

function FrameSurface({
  frame,
  ctx,
  animClass,
  durationMs,
  easing,
}: {
  frame: Frame;
  ctx: RuntimeCtx;
  animClass?: string;
  durationMs?: number;
  easing?: string;
}) {
  // Frame-level key + delay triggers live on the root node set.
  useEffect(() => {
    const timers: number[] = [];
    const allNodes: Node[] = [];
    const walk = (ns: Node[]) => ns.forEach((n) => { allNodes.push(n); if (n.children) walk(n.children); });
    walk(frame.nodes);
    for (const n of allNodes) {
      for (const it of n.interactions ?? []) {
        if (it.trigger === "delay") {
          const t = window.setTimeout(() => ctx.fire(it), it.delayMs ?? 1000);
          timers.push(t);
        }
      }
    }
    const onKey = (e: KeyboardEvent) => {
      for (const n of allNodes) {
        for (const it of n.interactions ?? []) {
          if (it.trigger === "key" && (it.key ?? "Enter") === e.key) ctx.fire(it);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.id]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: frame.background,
        overflow: "hidden",
        animation: animClass ? `${animClass} ${durationMs ?? 300}ms ${easing ?? "ease-out"} both` : undefined,
      }}
    >
      {frame.nodes.map((n) => (
        <NodeView key={n.id} node={n} ctx={ctx} />
      ))}
    </div>
  );
}

interface OverlayInstance {
  frameId: string;
  overlay: NonNullable<Interaction["overlay"]>;
}

export default function PreviewView() {
  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const frames: Frame[] = doc.pages.flatMap((p) => p.frames);
  const previewFrameId = useStore((s) => s.previewFrameId);
  const setPreviewFrame = useStore((s) => s.setPreviewFrame);

  const protoVars = doc.prototypeVariables ?? [];
  const [state, setState] = useState<VarState>(() => initVars(protoVars));
  const [, setHistory] = useState<string[]>([]);
  const [overlays, setOverlays] = useState<OverlayInstance[]>([]);
  const [anim, setAnim] = useState<{ enter: string; duration: number; easing: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Reset runtime state when the variable definitions change (e.g. doc reload).
  useEffect(() => {
    setState(initVars(protoVars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protoVars.length, doc.meta.id]);

  useEffect(() => {
    if (!previewFrameId && frames.length) setPreviewFrame(frames[0].id);
  }, [previewFrameId, frames, setPreviewFrame]);

  const current = frames.find((f) => f.id === previewFrameId) ?? frames[0];

  const setVar = useCallback((variableId: string, value: string) => {
    setState((s) => ({ ...s, [variableId]: value }));
  }, []);

  const navigate = useCallback(
    (frameId: string, it?: Interaction) => {
      if (current) setHistory((h) => [...h, current.id]);
      const t = describeTransition(it?.animation, it?.durationMs, it?.easing);
      if (t.enter) setAnim({ enter: t.enter, duration: t.durationMs, easing: t.easing });
      else setAnim(null);
      setPreviewFrame(frameId);
    },
    [current, setPreviewFrame],
  );

  const fire = useCallback(
    (it: Interaction) => {
      if (!conditionMet(it, state)) return;
      const action = it.action ?? "navigate";
      switch (action) {
        case "navigate":
          if (it.targetFrameId) navigate(it.targetFrameId, it);
          break;
        case "overlay":
          if (it.targetFrameId)
            setOverlays((o) => [...o, { frameId: it.targetFrameId, overlay: it.overlay ?? { position: "center", backdrop: true } }]);
          break;
        case "close-overlay":
          setOverlays((o) => o.slice(0, -1));
          break;
        case "back":
          setHistory((h) => {
            if (!h.length) return h;
            const prev = h[h.length - 1];
            setPreviewFrame(prev);
            return h.slice(0, -1);
          });
          break;
        case "scroll-to":
          if (it.targetNodeId) {
            const el = rootRef.current?.querySelector(`#pv-node-${it.targetNodeId}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          break;
        case "external":
          if (it.url) window.open(it.url, "_blank", "noopener");
          break;
        case "set-variable":
          setState((s) => applySetVariable(it, s));
          break;
      }
    },
    [state, navigate, setPreviewFrame],
  );

  const ctx: RuntimeCtx = { ds, vars: protoVars, state, fire, setVar };

  if (!current) {
    return (
      <div className="empty" style={{ width: "100%" }}>
        <div style={{ fontSize: 40 }}>▶</div>
        <div>还没有可演示的页面，先生成或绘制一个框架。</div>
      </div>
    );
  }

  const overlayFrame = (o: OverlayInstance) => frames.find((f) => f.id === o.frameId);

  return (
    <>
      <style>{TRANSITION_KEYFRAMES}</style>
      <div className="sidebar">
        <h3>演示页面</h3>
        {frames.map((f) => (
          <div
            key={f.id}
            className={`list-item ${f.id === current.id ? "active" : ""}`}
            onClick={() => {
              setHistory([]);
              setOverlays([]);
              setAnim(null);
              setPreviewFrame(f.id);
            }}
          >
            {f.name}
            <span className="badge">{f.fidelity === "hifi" ? "高保真" : "线框"}</span>
          </div>
        ))}
        {protoVars.length > 0 && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>运行时变量</div>
            {protoVars.map((v) => (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                <span style={{ color: "var(--muted)" }}>{v.name}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{state[v.id] ?? ""}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: 14, fontSize: 12, color: "var(--muted)" }}>
          点击 / 悬停 / 拖拽 / 按键 可交互；浮层、返回、滚动、变量条件均已支持。
        </div>
      </div>
      <div className="preview-wrap">
        <div className="phone" style={{ width: current.width, height: current.height }} ref={rootRef}>
          <FrameSurface frame={current} ctx={ctx} animClass={anim?.enter} durationMs={anim?.duration} easing={anim?.easing} />

          {overlays.map((o, i) => {
            const of = overlayFrame(o);
            if (!of) return null;
            const pos = o.overlay.position;
            const justify = pos === "top" ? "flex-start" : pos === "bottom" ? "flex-end" : "center";
            const align = pos === "left" ? "flex-start" : pos === "right" ? "flex-end" : "center";
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: o.overlay.backdrop ? "rgba(0,0,0,0.45)" : "transparent",
                  display: "flex",
                  alignItems: pos === "top" || pos === "bottom" ? justify : align,
                  justifyContent: pos === "left" || pos === "right" ? align : justify,
                  zIndex: 100 + i,
                }}
                onClick={() => {
                  if (o.overlay.closeOnClickOutside !== false) setOverlays((arr) => arr.slice(0, i));
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: of.width,
                    height: of.height,
                    maxWidth: "100%",
                    maxHeight: "100%",
                    background: of.background,
                    overflow: "hidden",
                    boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
                    animation: `gpo-fade-in 200ms ease-out both`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {of.nodes.map((n) => (
                    <NodeView key={n.id} node={n} ctx={ctx} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
