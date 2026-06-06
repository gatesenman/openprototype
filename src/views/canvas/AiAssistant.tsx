import { useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { fineTuneNode, generateFlow, generatePage } from "@/ai/generate";
import { Node } from "@/schema/types";

interface Msg {
  role: "user" | "ai";
  text: string;
}

export default function AiAssistant({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const activeFrameId = useStore((s) => s.activeFrameId);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const updateNode = useStore((s) => s.updateNode);
  const addFrameWithNodes = useStore((s) => s.addFrameWithNodes);
  const addFramesWithNodes = useStore((s) => s.addFramesWithNodes);
  const ai = useUi((s) => s.ai);

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text:
        "我是 AI 设计助手。选中一个节点可让我微调（例如「改成主色 / 放大 / 居中」）；" +
        "未选中节点时，描述一个页面点「发送」直接生成单页；" +
        "点「✦ 多页流程」可一次生成多页面并自动连线（例如「电商购物 App」「登录注册系统」）。",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const page = doc.pages.find((p) => p.frames.some((f) => f.id === activeFrameId));
      const frame = page?.frames.find((f) => f.id === activeFrameId);
      const node =
        frame && selectedNodeIds.length === 1
          ? frame.nodes.find((n) => n.id === selectedNodeIds[0])
          : null;

      if (node && frame) {
        const updated = (await fineTuneNode(node, text, ds, ai)) as Node;
        const { id: _id, ...patch } = updated;
        void _id;
        updateNode(frame.id, node.id, patch);
        setMsgs((m) => [...m, { role: "ai", text: `已微调「${node.name}」。` }]);
      } else {
        const result = await generatePage(`# ${text}\n\n${text}`, ds, ai, "hifi");
        addFrameWithNodes(result.frame);
        setMsgs((m) => [
          ...m,
          {
            role: "ai",
            text: `已生成页面「${result.frame.name}」（${result.source === "llm" ? ai.model : "本地生成器"}），含 ${result.frame.nodes.length} 个元素，已添加到画布。`,
          },
        ]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "ai", text: `出错了：${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const sendFlow = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: "user", text: `生成多页面流程：${text}` }]);
    setInput("");
    setBusy(true);
    try {
      const result = await generateFlow(text, ds, "hifi");
      addFramesWithNodes(result.frames);
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text:
            `已生成「${result.kind}」，共 ${result.frames.length} 个页面（${result.frames
              .map((f) => f.name)
              .join(" → ")}），并自动连线 ${result.links} 条跳转。可在「流程」页查看跳转总览。`,
        },
      ]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "ai", text: `出错了：${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="assistant">
      <div className="assistant-head">
        <span>✦ AI 助手</span>
        <button className="btn" onClick={onClose}>收起</button>
      </div>
      <div className="assistant-body">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="bubble ai">思考中…</div>}
      </div>
      <div className="assistant-input">
        <textarea
          placeholder="描述需求或修改指令，回车发送"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="assistant-actions">
          <button className="btn" onClick={sendFlow} disabled={busy} title="生成多页面 + 自动连线流程">
            ✦ 多页流程
          </button>
          <button className="btn primary" onClick={send} disabled={busy}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
