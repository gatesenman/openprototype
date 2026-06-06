import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { generateFlow, generatePage, Fidelity } from "@/ai/generate";
import { frameNameFromRequirement } from "@/ai/frameName";
import { assistRequirement, AssistAction } from "@/ai/assistDoc";
import { REQUIREMENT_TEMPLATES } from "@/templates/requirementTemplates";
import {
  detectSlash,
  groupedSlashCommands,
  SlashCommand,
} from "@/requirements/slashCommands";
import Icon from "@/components/Icon";

/** Lightweight popover dropdown for toolbar menus. */
function Dropdown({
  label,
  className,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="export-menu" ref={ref}>
      <button className={className ?? "btn"} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && <div className="menu right">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export default function RequirementsView() {
  const requirements = useStore((s) => s.doc.requirements);
  const ds = useStore((s) => s.doc.designSystem);
  const activeId = useStore((s) => s.activeRequirementId);
  const setActive = useStore((s) => s.setActiveRequirement);
  const addReq = useStore((s) => s.addRequirement);
  const updateReq = useStore((s) => s.updateRequirement);
  const deleteReq = useStore((s) => s.deleteRequirement);
  const addFrameWithNodes = useStore((s) => s.addFrameWithNodes);
  const addFramesWithNodes = useStore((s) => s.addFramesWithNodes);
  const setView = useStore((s) => s.setView);

  const ai = useUi((s) => s.ai);
  const showToast = useUi((s) => s.showToast);

  const [fidelity, setFidelity] = useState<Fidelity>("wireframe");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  const slashGroups = slash ? groupedSlashCommands(slash.query) : [];
  const slashFlat = slashGroups.flatMap((g) => g.commands);

  // Reset the highlighted slash command whenever the query changes / menu reopens.
  const slashQuery = slash?.query ?? null;
  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery]);

  const active = requirements.find((r) => r.id === activeId) ?? null;

  const generate = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const result = await generatePage(
        active.markdown,
        ds,
        ai,
        fidelity,
        frameNameFromRequirement(active.title, active.markdown),
      );
      addFrameWithNodes(result.frame, active.id);
      setView("design");
      const fixed = result.violations.filter((v) => v.fixed).length;
      showToast(
        `已生成页面「${result.frame.name}」（${result.source === "llm" ? ai.model : "本地生成器"}）` +
          (fixed ? ` · 规则自动修正 ${fixed} 处` : "") +
          (result.note ? ` · ${result.note}` : ""),
      );
    } catch (e) {
      showToast(`生成失败：${(e as Error).message}`, 5000);
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = (markdown: string) => {
    if (!active) return;
    const cur = active.markdown.trim();
    if (cur && cur !== "#" && !confirm("用模板替换当前内容？（当前内容会被覆盖）")) return;
    updateReq(active.id, { markdown });
    showToast("已应用模板");
  };

  const runAssist = async (action: AssistAction) => {
    if (!active) return;
    setBusy(true);
    try {
      const { markdown, source } = await assistRequirement(action, active.markdown, ai);
      updateReq(active.id, { markdown });
      const labels: Record<AssistAction, string> = {
        draft: "草拟",
        polish: "润色",
        expand: "扩写补全",
        translate: "翻译",
        summarize: "摘要",
      };
      const label = labels[action];
      showToast(`AI 已${label}文档（${source === "llm" ? ai.model : "本地助手"}）`);
    } catch (e) {
      showToast(`AI 处理失败：${(e as Error).message}`, 5000);
    } finally {
      setBusy(false);
    }
  };

  const syncSlash = () => {
    const ta = taRef.current;
    if (!ta) return;
    setSlash(detectSlash(ta.value, ta.selectionStart ?? ta.value.length));
  };

  const applySlash = (cmd: SlashCommand) => {
    if (!active || !slash) return;
    const ta = taRef.current;
    const v = active.markdown;
    const caret = ta?.selectionStart ?? v.length;
    const removed = v.slice(0, slash.start) + v.slice(caret);
    if (cmd.kind === "insert") {
      const next = removed.slice(0, slash.start) + (cmd.insert ?? "") + removed.slice(slash.start);
      updateReq(active.id, { markdown: next });
    } else {
      updateReq(active.id, { markdown: removed });
      runAssist(cmd.action!);
    }
    setSlash(null);
  };

  const generateFlowAction = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const brief = `${active.title} ${active.markdown}`;
      const result = await generateFlow(brief, ds, fidelity);
      addFramesWithNodes(result.frames, active.id);
      setView("flows");
      showToast(
        `已生成「${result.kind}」${result.frames.length} 个页面，自动连线 ${result.links} 条跳转。`,
      );
    } catch (e) {
      showToast(`生成失败：${(e as Error).message}`, 5000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sidebar">
        <h3>需求文档</h3>
        {requirements.map((r) => (
          <div
            key={r.id}
            className={`list-item ${r.id === activeId ? "active" : ""}`}
            onClick={() => setActive(r.id)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.title}
              </div>
              <div className="sub">
                已生成 {r.generatedFrameIds.length} 页
              </div>
            </div>
          </div>
        ))}
        <div style={{ padding: 12 }}>
          <button className="btn" style={{ width: "100%" }} onClick={() => addReq()}>
            + 新建需求
          </button>
        </div>
      </div>

      <div className="main">
        {active ? (
          <>
            <div className="req-toolbar">
              <input
                className="title"
                value={active.title}
                onChange={(e) => updateReq(active.id, { title: e.target.value })}
              />
              <div className="spacer" />
              <Dropdown label={<><Icon name="list" size={15} /> 模板</>}>
                {(close) =>
                  REQUIREMENT_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      className="menu-item"
                      onClick={() => {
                        applyTemplate(t.markdown);
                        close();
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div className="sub" style={{ marginTop: 2 }}>{t.description}</div>
                    </button>
                  ))
                }
              </Dropdown>
              <Dropdown
                label={<><Icon name="sparkles" size={15} /> {busy ? "处理中…" : "AI 助手"}</>}
              >
                {(close) => (
                  <>
                    <button className="menu-item icon" onClick={() => { runAssist("draft"); close(); }}>
                      <Icon name="sparkles" size={15} /> 草拟 PRD（从想法生成）
                    </button>
                    <button className="menu-item icon" onClick={() => { runAssist("polish"); close(); }}>
                      <Icon name="edit" size={15} /> 润色 / 规范化
                    </button>
                    <button className="menu-item icon" onClick={() => { runAssist("expand"); close(); }}>
                      <Icon name="plus" size={15} /> 扩写 / 补全章节
                    </button>
                  </>
                )}
              </Dropdown>
              <select
                value={fidelity}
                onChange={(e) => setFidelity(e.target.value as Fidelity)}
                className="btn"
              >
                <option value="wireframe">原型级（线框）</option>
                <option value="hifi">高保真</option>
              </select>
              <button className="btn primary" onClick={generate} disabled={busy}>
                {busy ? "生成中…" : "✦ 生成页面"}
              </button>
              <button className="btn" onClick={generateFlowAction} disabled={busy} title="一次生成多页面并自动连线">
                {busy ? "生成中…" : "✦ 多页流程"}
              </button>
              <button
                className="btn danger icon-only"
                title="删除该需求文档"
                onClick={() => {
                  if (confirm("删除该需求文档？")) deleteReq(active.id);
                }}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
            <div className="req-editor">
              <div className="req-textarea-wrap">
                <textarea
                  ref={taRef}
                  value={active.markdown}
                  placeholder="输入 / 唤起命令菜单（插入章节模板 / 用户故事 / 表格 / AI 辅助）"
                  onChange={(e) => {
                    updateReq(active.id, { markdown: e.target.value });
                    setSlash(detectSlash(e.target.value, e.target.selectionStart ?? e.target.value.length));
                  }}
                  onKeyUp={syncSlash}
                  onClick={syncSlash}
                  onKeyDown={(e) => {
                    if (!slash) return;
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setSlash(null);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSlashIndex((i) => (slashFlat.length ? (i + 1) % slashFlat.length : 0));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSlashIndex((i) =>
                        slashFlat.length ? (i - 1 + slashFlat.length) % slashFlat.length : 0,
                      );
                    } else if (e.key === "Enter" && slashFlat.length) {
                      e.preventDefault();
                      applySlash(slashFlat[Math.min(slashIndex, slashFlat.length - 1)]);
                    }
                  }}
                  onBlur={() => setTimeout(() => setSlash(null), 150)}
                  spellCheck={false}
                />
                {slash && (
                  <div className="slash-menu" role="listbox">
                    <div className="slash-menu-head">
                      <Icon name="search" size={12} />
                      <span>
                        命令{slash.query ? `：${slash.query}` : ""}
                      </span>
                      <span className="slash-count">{slashFlat.length}</span>
                    </div>
                    {slashFlat.length === 0 && (
                      <div className="slash-empty">无匹配命令</div>
                    )}
                    {slashGroups.map((g) => (
                      <div key={g.id} className="slash-group">
                        <div className="slash-group-label">{g.label}</div>
                        {g.commands.map((c) => {
                          const flatIdx = slashFlat.indexOf(c);
                          return (
                            <button
                              key={c.key}
                              className={`slash-item ${flatIdx === slashIndex ? "active" : ""}`}
                              role="option"
                              aria-selected={flatIdx === slashIndex}
                              onMouseEnter={() => setSlashIndex(flatIdx)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                applySlash(c);
                              }}
                            >
                              <span className={`slash-icon ${c.kind}`}>
                                <Icon name={c.icon} size={15} />
                              </span>
                              <span className="slash-text">
                                <span className="slash-title">{c.title}</span>
                                <span className="slash-hint">{c.hint}</span>
                              </span>
                              {c.kind === "ai" && <span className="slash-tag">AI</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="req-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {active.markdown}
                </ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div className="empty">
            <div style={{ fontSize: 40 }}>📝</div>
            <div>选择或新建一个需求文档开始</div>
            <button className="btn primary" onClick={() => addReq()}>
              + 新建需求
            </button>
          </div>
        )}
      </div>
    </>
  );
}
