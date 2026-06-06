import { useStore } from "@/store/useStore";
import { Frame } from "@/schema/types";

const CW = 200;
const CH = 380;
const GAP_X = 120;
const GAP_Y = 90;
const COLS = 4;

export default function FlowsView() {
  const doc = useStore((s) => s.doc);
  const setView = useStore((s) => s.setView);
  const setActiveFrame = useStore((s) => s.setActiveFrame);
  const setActivePage = useStore((s) => s.setActivePage);

  const frames: { frame: Frame; pageId: string }[] = doc.pages.flatMap((p) =>
    p.frames.map((f) => ({ frame: f, pageId: p.id })),
  );
  const posOf = (i: number) => ({
    x: 40 + (i % COLS) * (CW + GAP_X),
    y: 60 + Math.floor(i / COLS) * (CH + GAP_Y),
  });
  const indexOf = (frameId: string) => frames.findIndex((x) => x.frame.id === frameId);

  // Collect edges from node interactions.
  const edges: { from: number; to: number; label: string }[] = [];
  frames.forEach(({ frame }, i) => {
    frame.nodes.forEach((n) => {
      n.interactions?.forEach((it) => {
        const to = indexOf(it.targetFrameId);
        if (to >= 0) edges.push({ from: i, to, label: n.name });
      });
    });
  });

  const rows = Math.ceil(frames.length / COLS);
  const width = 40 + COLS * (CW + GAP_X);
  const height = 80 + rows * (CH + GAP_Y);

  const openFrame = (pageId: string, frameId: string) => {
    setActivePage(pageId);
    setActiveFrame(frameId);
    setView("design");
  };

  return (
    <div className="flows-wrap">
      <div className="flows-head">
        <h3 style={{ margin: 0 }}>流程图 · 原型跳转总览</h3>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          {frames.length} 个框架 · {edges.length} 条跳转。点击框架进入编辑。
        </span>
      </div>
      <div className="flows-scroll">
        <svg width={width} height={Math.max(height, 400)} style={{ display: "block" }}>
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#818cf8" />
            </marker>
          </defs>
          {edges.map((e, idx) => {
            const a = posOf(e.from);
            const b = posOf(e.to);
            const x1 = a.x + CW;
            const y1 = a.y + CH / 2;
            const x2 = b.x;
            const y2 = b.y + CH / 2;
            const mx = (x1 + x2) / 2;
            return (
              <g key={idx}>
                <path
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="none"
                  markerEnd="url(#arrow)"
                  opacity={0.8}
                />
              </g>
            );
          })}
          {frames.map(({ frame, pageId }, i) => {
            const p = posOf(i);
            return (
              <g key={frame.id} style={{ cursor: "pointer" }} onClick={() => openFrame(pageId, frame.id)}>
                <rect
                  x={p.x}
                  y={p.y}
                  width={CW}
                  height={CH}
                  rx={10}
                  fill={frame.background}
                  stroke="#6366f1"
                  strokeWidth={1.5}
                />
                {/* mini node previews */}
                {frame.nodes.slice(0, 30).map((n) => {
                  const sx = CW / frame.width;
                  const sy = CH / frame.height;
                  return (
                    <rect
                      key={n.id}
                      x={p.x + n.x * sx}
                      y={p.y + n.y * sy}
                      width={Math.max(2, n.width * sx)}
                      height={Math.max(2, n.height * sy)}
                      rx={2}
                      fill={n.type === "text" ? "transparent" : "#c7d2fe"}
                      stroke={n.type === "text" ? "#94a3b8" : "transparent"}
                    />
                  );
                })}
                <rect x={p.x} y={p.y - 24} width={CW} height={20} fill="transparent" />
                <text x={p.x + 4} y={p.y - 8} fill="#e2e8f0" fontSize={13}>
                  {frame.name}
                </text>
              </g>
            );
          })}
        </svg>
        {frames.length === 0 && (
          <div className="empty" style={{ width: "100%" }}>
            <div style={{ fontSize: 40 }}>🔀</div>
            <div>还没有框架。先生成或绘制页面，并在属性面板添加跳转。</div>
          </div>
        )}
      </div>
    </div>
  );
}
