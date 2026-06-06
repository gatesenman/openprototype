import { CSSProperties, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { DesignSystem, Frame, Node } from "@/schema/types";
import { nodeFill } from "@/render/resolve";

function NodeView({
  node,
  ds,
  onNavigate,
}: {
  node: Node;
  ds: DesignSystem;
  onNavigate: (frameId: string) => void;
}) {
  const click = node.interactions?.find((i) => i.trigger === "click");
  const style: CSSProperties = {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    borderRadius: node.style.radius ?? 0,
    opacity: node.style.opacity ?? 1,
    cursor: click ? "pointer" : "default",
    boxShadow: node.style.shadow
      ? `${node.style.shadow.x}px ${node.style.shadow.y}px ${node.style.shadow.blur}px ${node.style.shadow.color}`
      : undefined,
    border: node.style.stroke
      ? `${node.style.stroke.width}px solid ${node.style.stroke.color}`
      : undefined,
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
  };
  return (
    <div
      style={style}
      onClick={() => click && onNavigate(click.targetFrameId)}
    >
      {node.text?.content}
      {node.children?.map((c) => (
        <NodeView key={c.id} node={c} ds={ds} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export default function PreviewView() {
  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const frames: Frame[] = doc.pages.flatMap((p) => p.frames);
  const previewFrameId = useStore((s) => s.previewFrameId);
  const setPreviewFrame = useStore((s) => s.setPreviewFrame);

  useEffect(() => {
    if (!previewFrameId && frames.length) setPreviewFrame(frames[0].id);
  }, [previewFrameId, frames, setPreviewFrame]);

  const current = frames.find((f) => f.id === previewFrameId) ?? frames[0];

  if (!current) {
    return (
      <div className="empty" style={{ width: "100%" }}>
        <div style={{ fontSize: 40 }}>▶️</div>
        <div>还没有可演示的页面，先生成或绘制一个框架。</div>
      </div>
    );
  }

  return (
    <>
      <div className="sidebar">
        <h3>演示页面</h3>
        {frames.map((f) => (
          <div
            key={f.id}
            className={`list-item ${f.id === current.id ? "active" : ""}`}
            onClick={() => setPreviewFrame(f.id)}
          >
            {f.name}
            <span className="badge">{f.fidelity === "hifi" ? "高保真" : "线框"}</span>
          </div>
        ))}
        <div style={{ padding: 14, fontSize: 12, color: "var(--muted)" }}>
          点击页面里的可交互元素体验原型跳转。
        </div>
      </div>
      <div className="preview-wrap">
        <div
          className="phone"
          style={{ width: current.width, height: current.height }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: current.background,
              overflow: "hidden",
            }}
          >
            {current.nodes.map((n) => (
              <NodeView
                key={n.id}
                node={n}
                ds={ds}
                onNavigate={(fid) => setPreviewFrame(fid)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
