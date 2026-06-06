import { useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { fineTuneNode } from "@/ai/generate";
import { redo, undo } from "@/store/history";
import { Node } from "@/schema/types";
import { type BooleanOp } from "@/vector/geometry";
import LayersPanel from "./canvas/LayersPanel";
import PropertiesPanel from "./canvas/PropertiesPanel";
import CanvasStage from "./canvas/CanvasStage";
import AiAssistant from "./canvas/AiAssistant";
import CommentsPanel from "./canvas/CommentsPanel";
import AssetsPanel from "./canvas/AssetsPanel";
import DevModePanel from "./canvas/DevModePanel";
import Icon, { IconName } from "@/components/Icon";

const TOOLS: [string, IconName, string][] = [
  ["select", "cursor", "选择/移动 (V)"],
  ["rect", "square", "矩形 (R)"],
  ["ellipse", "circle", "椭圆 (O)"],
  ["line", "line", "线 (L)"],
  ["pen", "pen", "钢笔/矢量 (P)"],
  ["text", "text", "文本 (T)"],
  ["button", "button", "按钮 (B)"],
  ["input", "input", "输入框 (I)"],
];

const BOOL_OPS: [string, IconName, string][] = [
  ["union", "boolUnion", "联合 (Ctrl+Alt+U)"],
  ["subtract", "boolSubtract", "减去顶层"],
  ["intersect", "boolIntersect", "相交"],
  ["exclude", "boolExclude", "排除重叠"],
];

export default function DesignView() {
  const tool = useUi((s) => s.tool);
  const setTool = useUi((s) => s.setTool);
  const ai = useUi((s) => s.ai);
  const showToast = useUi((s) => s.showToast);
  const devMode = useUi((s) => s.devMode);
  const toggleDevMode = useUi((s) => s.toggleDevMode);
  const commentMode = useStore((s) => s.commentMode);
  const setCommentMode = useStore((s) => s.setCommentMode);
  const setActiveComment = useStore((s) => s.setActiveComment);
  const commentCount = useStore((s) => s.doc.comments.length);

  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const activePageId = useStore((s) => s.activePageId);
  const activeFrameId = useStore((s) => s.activeFrameId);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const updateNode = useStore((s) => s.updateNode);
  const addFrame = useStore((s) => s.addFrame);
  const duplicateSelection = useStore((s) => s.duplicateSelection);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const groupSelection = useStore((s) => s.groupSelection);
  const ungroupSelection = useStore((s) => s.ungroupSelection);
  const instantiateComponent = useStore((s) => s.instantiateComponent);
  const booleanSelection = useStore((s) => s.booleanSelection);
  const outlineStroke = useStore((s) => s.outlineStroke);

  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [commentList, setCommentList] = useState(false);
  const [assets, setAssets] = useState(false);

  const page = doc.pages.find((p) => p.id === activePageId);
  const frame = page?.frames.find((f) => f.id === activeFrameId);
  const node =
    frame && selectedNodeIds.length === 1
      ? frame.nodes.find((n) => n.id === selectedNodeIds[0]) ?? null
      : null;

  const runFineTune = async () => {
    if (!node || !frame || !instruction.trim()) return;
    setBusy(true);
    try {
      const updated = (await fineTuneNode(node, instruction, ds, ai)) as Node;
      const { id: _id, ...patch } = updated;
      void _id;
      updateNode(frame.id, node.id, patch);
      showToast(`已微调「${node.name}」`);
      setInstruction("");
    } catch (e) {
      showToast(`微调失败：${(e as Error).message}`, 5000);
    } finally {
      setBusy(false);
    }
  };

  const hasFrames = (page?.frames.length ?? 0) > 0;
  const hasSel = selectedNodeIds.length > 0;

  return (
    <>
      <LayersPanel />
      <div className="main">
        <div className="editor-toolbar">
          <div className="tool-cluster">
            {TOOLS.map(([k, icon, title]) => (
              <button
                key={k}
                className={`tool-btn ${tool === k ? "active" : ""}`}
                title={title}
                onClick={() => setTool(k)}
              >
                <Icon name={icon} size={17} />
              </button>
            ))}
          </div>
          <span className="divider" />
          <button className="tool-btn" title="撤销 (Ctrl+Z)" onClick={() => undo()}><Icon name="undo" size={17} /></button>
          <button className="tool-btn" title="重做 (Ctrl+Shift+Z)" onClick={() => redo()}><Icon name="redo" size={17} /></button>
          <span className="divider" />
          <button className="tool-btn" title="再制 (Ctrl+D)" disabled={!hasSel} onClick={duplicateSelection}><Icon name="duplicate" size={17} /></button>
          <button className="tool-btn" title="编组 (Ctrl+G)" disabled={selectedNodeIds.length < 2} onClick={groupSelection}><Icon name="group" size={17} /></button>
          <button className="tool-btn" title="取消编组 (Ctrl+Shift+G)" disabled={selectedNodeIds.length !== 1} onClick={ungroupSelection}><Icon name="ungroup" size={17} /></button>
          <button className="tool-btn" title="删除 (Del)" disabled={!hasSel} onClick={deleteSelection}><Icon name="trash" size={17} /></button>
          <span className="divider" />
          {BOOL_OPS.map(([op, icon, title]) => (
            <button
              key={op}
              className="tool-btn"
              title={`布尔运算：${title}`}
              disabled={selectedNodeIds.length < 2}
              onClick={() => booleanSelection(op as BooleanOp)}
            >
              <Icon name={icon} size={17} />
            </button>
          ))}
          <button
            className="tool-btn"
            title="描边转轮廓"
            disabled={!(node && (node.style.stroke?.width ?? 0) > 0)}
            onClick={() => node && outlineStroke(node.id)}
          >
            <Icon name="outline" size={17} />
          </button>
          <span className="divider" />
          <select
            className="btn"
            value=""
            onChange={(e) => {
              if (e.target.value) instantiateComponent(e.target.value);
              e.currentTarget.value = "";
            }}
            title="插入组件"
            disabled={!activeFrameId}
          >
            <option value="">⬡ 插入组件…</option>
            {ds.components.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="tool-btn" title="新建框架" onClick={() => addFrame()}><Icon name="frame" size={17} /></button>
          <div className="spacer" />
          <button
            className={`btn ${commentMode ? "primary" : ""}`}
            title="批注模式：点击画板上任意位置添加评论"
            onClick={() => {
              const next = !commentMode;
              setCommentMode(next);
              if (!next) setActiveComment(null);
            }}
          >
            <Icon name="comment" size={15} /> 批注{commentCount ? ` (${commentCount})` : ""}
          </button>
          <button
            className={`btn ${commentList ? "primary" : ""}`}
            title="查看 / 搜索所有评论"
            onClick={() => setCommentList((v) => !v)}
          >
            <Icon name="list" size={15} /> 评论列表
          </button>
          <button className={`btn ${assets ? "primary" : ""}`} title="资产 / 组件库" onClick={() => setAssets((v) => !v)}>
            <Icon name="assets" size={15} /> 资产
          </button>
          <button className={`btn ${assistant ? "primary" : ""}`} onClick={() => setAssistant((v) => !v)}>
            <Icon name="sparkles" size={15} /> AI 助手
          </button>
          <button
            className={`btn ${devMode ? "primary" : ""}`}
            title="开发模式：标注 / 测量 / 代码交付"
            onClick={toggleDevMode}
          >
            <Icon name="code" size={15} /> 开发
          </button>
        </div>

        <div className="ai-bar">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {node ? `微调「${node.name}」:` : "选中单个节点后可 AI 微调："}
          </span>
          <input
            style={{ flex: 1 }}
            placeholder="例如：改成主色 / 放大 / 文字居中 / 加圆角"
            value={instruction}
            disabled={!node}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runFineTune()}
          />
          <button className="btn primary" onClick={runFineTune} disabled={!node || busy}>
            {busy ? "…" : "✦ 微调"}
          </button>
        </div>

        {hasFrames ? (
          <div style={{ flex: 1, position: "relative", display: "flex", minHeight: 0 }}>
            <CanvasStage />
            {assistant && <AiAssistant onClose={() => setAssistant(false)} />}
            {commentList && <CommentsPanel onClose={() => setCommentList(false)} />}
            {assets && <AssetsPanel onClose={() => setAssets(false)} />}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-card">
              <div className="empty-icon"><Icon name="frame" size={40} /></div>
              <h2>开始你的第一个原型</h2>
              <p className="empty-sub">三种方式，任选其一上手 OpenPrototype：</p>
              <ul className="empty-steps">
                <li><span className="step-no">1</span><div><b>用 AI 从需求生成</b><br/>去顶栏「需求」页粘贴 Markdown，点「AI 生成页面」。</div></li>
                <li><span className="step-no">2</span><div><b>手动画</b><br/>新建空框架，用左侧工具栏画矩形 / 文本 / 按钮 / 输入框。</div></li>
                <li><span className="step-no">3</span><div><b>用组件</b><br/>顶栏「资产」面板插入设计系统组件，或去「市场」安装。</div></li>
              </ul>
              <button className="btn primary" onClick={() => addFrame()}>
                <Icon name="frame" size={14} /> 新建空框架
              </button>
            </div>
          </div>
        )}
      </div>
      {devMode ? <DevModePanel /> : <PropertiesPanel />}
    </>
  );
}
