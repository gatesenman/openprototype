import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import Icon from "@/components/Icon";
import { JourneyMap, JourneyStage } from "@/schema/types";
import {
  EMOTION_EMOJI,
  EMOTION_LABELS,
  JourneyListRow,
  ROW_META,
  averageEmotion,
  clampEmotion,
  countOpportunities,
  countPains,
  emotionCurvePath,
  emotionPoints,
  journeyToCsv,
  journeyToMarkdown,
} from "@/journey/journey";
import { download } from "@/export/exportCode";
import { loadAiSettings } from "@/ai/settings";
import { generateJourney } from "@/ai/generate";

/** A stage cell that edits one list field (actions / touchpoints / pains …). */
function CellList({
  items,
  placeholder,
  accent,
  onChange,
}: {
  items: string[];
  placeholder: string;
  accent?: string;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="jm-cell-list">
      {items.map((it, i) => (
        <div className="jm-chip" key={i} style={accent ? { borderLeftColor: accent } : undefined}>
          <input
            className="jm-chip-input"
            value={it}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            className="jm-chip-x"
            title="删除"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      ))}
      <input
        className="jm-add-input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

/** Vertical emotion control for one stage. */
function EmotionControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const v = clampEmotion(value);
  return (
    <div className="jm-emotion-ctl">
      <button
        className="jm-emo-step"
        title="情绪上调"
        disabled={v >= 2}
        onClick={() => onChange(clampEmotion(v + 1))}
      >
        <Icon name="chevronDown" size={12} className="flip" />
      </button>
      <button
        className="jm-emo-face"
        title={`点击切换情绪（当前：${EMOTION_LABELS[v]}）`}
        onClick={() => onChange(clampEmotion(v >= 2 ? -2 : v + 1))}
      >
        <span className="jm-emo-emoji">{EMOTION_EMOJI[v]}</span>
        <span className="jm-emo-label">{EMOTION_LABELS[v]}</span>
      </button>
      <button
        className="jm-emo-step"
        title="情绪下调"
        disabled={v <= -2}
        onClick={() => onChange(clampEmotion(v - 1))}
      >
        <Icon name="chevronDown" size={12} />
      </button>
    </div>
  );
}

const LIST_ROWS: { row: JourneyListRow; accent: string }[] = [
  { row: "actions", accent: "#0d99ff" },
  { row: "touchpoints", accent: "#a78bfa" },
  { row: "thoughts", accent: "#fbbf24" },
  { row: "pains", accent: "#f24822" },
  { row: "opportunities", accent: "#16a34a" },
];

/** The interactive emotion-curve band drawn across all stage columns. */
function EmotionCurve({ stages }: { stages: JourneyStage[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const H = 96;
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const emotions = stages.map((s) => s.emotion);
  const path = w ? emotionCurvePath(emotions, w, H) : "";
  const pts = w ? emotionPoints(emotions, w, H) : [];
  return (
    <div className="jm-curve" ref={ref} style={{ height: H }}>
      <svg width={w} height={H} className="jm-curve-svg">
        {[2, 1, 0, -1, -2].map((lvl) => {
          const y = 14 + ((2 - lvl) / 4) * (H - 28);
          return (
            <line
              key={lvl}
              x1={0}
              x2={w}
              y1={y}
              y2={y}
              stroke={lvl === 0 ? "#4a4a4a" : "#333"}
              strokeDasharray={lvl === 0 ? "none" : "3 4"}
              strokeWidth={1}
            />
          );
        })}
        {path && <path d={path} fill="none" stroke="#0d99ff" strokeWidth={2.5} />}
        {pts.map((p, i) => {
          const e = clampEmotion(emotions[i]);
          const color = e > 0 ? "#16a34a" : e < 0 ? "#f24822" : "#b3b3b3";
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={6} fill={color} stroke="#1e1e1e" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function JourneyView() {
  const doc = useStore((s) => s.doc);
  const activeJourneyId = useStore((s) => s.activeJourneyId);
  const setActiveJourney = useStore((s) => s.setActiveJourney);
  const addJourney = useStore((s) => s.addJourney);
  const updateJourney = useStore((s) => s.updateJourney);
  const deleteJourney = useStore((s) => s.deleteJourney);
  const addStage = useStore((s) => s.addStage);
  const updateStage = useStore((s) => s.updateStage);
  const deleteStage = useStore((s) => s.deleteStage);
  const moveStage = useStore((s) => s.moveStage);
  const setView = useStore((s) => s.setView);
  const setActivePage = useStore((s) => s.setActivePage);
  const setActiveFrame = useStore((s) => s.setActiveFrame);
  const showToast = useUi((s) => s.showToast);

  const journeys = doc.journeys;
  const journey: JourneyMap | undefined =
    journeys.find((j) => j.id === activeJourneyId) ?? journeys[0];

  const [aiOpen, setAiOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const allFrames = useMemo(
    () => doc.pages.flatMap((p) => p.frames.map((f) => ({ ...f, pageId: p.id }))),
    [doc.pages],
  );

  if (!journey) {
    return (
      <div className="journey-wrap">
        <div className="journey-empty">
          <div style={{ fontSize: 44 }}>🗺️</div>
          <div style={{ marginBottom: 12 }}>还没有用户旅程地图。</div>
          <button className="btn primary" onClick={() => addJourney()}>
            <Icon name="plus" size={15} /> 新建旅程地图
          </button>
        </div>
      </div>
    );
  }

  const runAi = async () => {
    const brief = aiBrief.trim() || doc.requirements[0]?.markdown || doc.meta.name;
    setAiBusy(true);
    try {
      const settings = loadAiSettings();
      const res = await generateJourney(brief, settings);
      addJourney(res.journey);
      setAiOpen(false);
      setAiBrief("");
      showToast(
        res.source === "llm"
          ? `已用大模型生成旅程「${res.journey.title}」`
          : `已生成旅程「${res.journey.title}」${res.note ? `（${res.note}）` : "（本地生成器）"}`,
        4200,
      );
    } catch (e) {
      showToast((e as Error).message, 5000);
    } finally {
      setAiBusy(false);
    }
  };

  const openFrame = (frameId: string) => {
    const owner = doc.pages.find((p) => p.frames.some((f) => f.id === frameId));
    if (!owner) return;
    setActivePage(owner.id);
    setActiveFrame(frameId);
    setView("design");
  };

  const avg = averageEmotion(journey.stages);
  const persona = journey.persona;

  return (
    <div className="journey-wrap">
      {/* toolbar */}
      <div className="journey-head">
        <div className="journey-head-left">
          <Icon name="flow" size={16} />
          <select
            className="jm-select"
            value={journey.id}
            onChange={(e) => setActiveJourney(e.target.value)}
            title="切换旅程地图"
          >
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <input
            className="jm-title-input"
            value={journey.title}
            onChange={(e) => updateJourney(journey.id, { title: e.target.value })}
            title="旅程标题"
          />
        </div>
        <div className="journey-head-right">
          <button className="btn" onClick={() => setAiOpen((v) => !v)}>
            <Icon name="sparkles" size={15} /> AI 生成
          </button>
          <button className="btn" onClick={() => addJourney()} title="新建空白旅程">
            <Icon name="plus" size={15} /> 新建
          </button>
          <div className="export-menu">
            <button className="btn" onClick={() => setExportOpen((v) => !v)}>
              <Icon name="download" size={15} /> 导出
            </button>
            {exportOpen && (
              <div className="menu right" onMouseLeave={() => setExportOpen(false)}>
                <button
                  className="menu-item"
                  onClick={() => {
                    download(journeyToMarkdown(journey), `${journey.title}.md`, "text/markdown");
                    showToast("已导出旅程 Markdown");
                    setExportOpen(false);
                  }}
                >
                  导出 Markdown
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    download(journeyToCsv(journey), `${journey.title}.csv`, "text/csv");
                    showToast("已导出旅程 CSV");
                    setExportOpen(false);
                  }}
                >
                  导出 CSV（表格）
                </button>
              </div>
            )}
          </div>
          <button
            className="btn danger-ghost"
            title="删除当前旅程"
            onClick={() => {
              if (journeys.length <= 1) return showToast("至少保留一个旅程地图", 3500);
              deleteJourney(journey.id);
              showToast("已删除旅程");
            }}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>

      {aiOpen && (
        <div className="jm-ai-bar">
          <textarea
            className="jm-ai-input"
            placeholder="描述产品或场景（如：电商购物 / 新用户注册引导 / 在线问诊…），AI 将生成一份用户旅程地图。留空则使用当前需求文档。"
            value={aiBrief}
            onChange={(e) => setAiBrief(e.target.value)}
          />
          <button className="btn primary" disabled={aiBusy} onClick={runAi}>
            {aiBusy ? "生成中…" : "生成旅程"}
          </button>
        </div>
      )}

      <div className="journey-body">
        {/* persona + stats */}
        <div className="jm-persona">
          <input
            className="jm-avatar"
            value={persona.avatar ?? ""}
            maxLength={2}
            onChange={(e) => updateJourney(journey.id, { persona: { ...persona, avatar: e.target.value } })}
            title="头像（emoji）"
          />
          <div className="jm-persona-fields">
            <input
              className="jm-persona-name"
              value={persona.name}
              placeholder="角色名称"
              onChange={(e) => updateJourney(journey.id, { persona: { ...persona, name: e.target.value } })}
            />
            <input
              className="jm-persona-role"
              value={persona.role ?? ""}
              placeholder="角色描述（如：首次购物的上班族）"
              onChange={(e) => updateJourney(journey.id, { persona: { ...persona, role: e.target.value } })}
            />
            <div className="jm-persona-meta">
              <label>目标</label>
              <input
                value={persona.goal ?? ""}
                placeholder="该角色的整体目标"
                onChange={(e) => updateJourney(journey.id, { persona: { ...persona, goal: e.target.value } })}
              />
            </div>
            <div className="jm-persona-meta">
              <label>场景</label>
              <input
                value={journey.scenario ?? ""}
                placeholder="旅程发生的场景"
                onChange={(e) => updateJourney(journey.id, { scenario: e.target.value })}
              />
            </div>
          </div>
          <div className="jm-stats">
            <div className="jm-stat">
              <b>{journey.stages.length}</b>
              <span>阶段</span>
            </div>
            <div className="jm-stat">
              <b style={{ color: avg > 0 ? "#16a34a" : avg < 0 ? "#f24822" : "#b3b3b3" }}>
                {avg > 0 ? `+${avg}` : avg}
              </b>
              <span>平均情绪</span>
            </div>
            <div className="jm-stat">
              <b style={{ color: "#f24822" }}>{countPains(journey)}</b>
              <span>痛点</span>
            </div>
            <div className="jm-stat">
              <b style={{ color: "#16a34a" }}>{countOpportunities(journey)}</b>
              <span>机会点</span>
            </div>
          </div>
        </div>

        {/* matrix */}
        <div className="jm-matrix-scroll">
          <div
            className="jm-matrix"
            style={{ gridTemplateColumns: `140px repeat(${journey.stages.length}, minmax(190px, 1fr)) 48px` }}
          >
            {/* header row */}
            <div className="jm-row-label jm-corner">阶段</div>
            {journey.stages.map((st, i) => (
              <div className="jm-stage-head" key={st.id}>
                <input
                  className="jm-stage-name"
                  value={st.name}
                  onChange={(e) => updateStage(journey.id, st.id, { name: e.target.value })}
                />
                <div className="jm-stage-actions">
                  <button
                    title="左移"
                    disabled={i === 0}
                    onClick={() => moveStage(journey.id, st.id, "left")}
                  >
                    <Icon name="chevronRight" size={12} className="flip" />
                  </button>
                  <button
                    title="右移"
                    disabled={i === journey.stages.length - 1}
                    onClick={() => moveStage(journey.id, st.id, "right")}
                  >
                    <Icon name="chevronRight" size={12} />
                  </button>
                  <button
                    title="删除阶段"
                    disabled={journey.stages.length <= 1}
                    onClick={() => deleteStage(journey.id, st.id)}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            ))}
            <button className="jm-add-stage" title="新增阶段" onClick={() => addStage(journey.id)}>
              <Icon name="plus" size={16} />
            </button>

            {/* emotion curve row (rendered first for visual prominence under header) */}
            <div className="jm-row-label">{ROW_META.emotion.label}</div>
            <div
              className="jm-emotion-band"
              style={{ gridColumn: `2 / span ${journey.stages.length}` }}
            >
              <EmotionCurve stages={journey.stages} />
              <div
                className="jm-emotion-controls"
                style={{ gridTemplateColumns: `repeat(${journey.stages.length}, minmax(190px, 1fr))` }}
              >
                {journey.stages.map((st) => (
                  <EmotionControl
                    key={st.id}
                    value={st.emotion}
                    onChange={(v) => updateStage(journey.id, st.id, { emotion: clampEmotion(v) })}
                  />
                ))}
              </div>
            </div>
            <div />

            {/* list rows */}
            {LIST_ROWS.map(({ row, accent }) => (
              <Row key={row} row={row} accent={accent} journey={journey} updateStage={updateStage} />
            ))}

            {/* frame link row */}
            <div className="jm-row-label">关联页面</div>
            {journey.stages.map((st) => (
              <div className="jm-cell jm-link-cell" key={st.id}>
                <select
                  className="jm-frame-select"
                  value={st.frameId ?? ""}
                  onChange={(e) =>
                    updateStage(journey.id, st.id, { frameId: e.target.value || undefined })
                  }
                >
                  <option value="">（未关联）</option>
                  {allFrames.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {st.frameId && allFrames.some((f) => f.id === st.frameId) && (
                  <button className="jm-open-frame" onClick={() => openFrame(st.frameId!)}>
                    打开页面 →
                  </button>
                )}
              </div>
            ))}
            <div />
          </div>
        </div>
      </div>
    </div>
  );
}

/** One full list-row of the matrix (label + one cell per stage). */
function Row({
  row,
  accent,
  journey,
  updateStage,
}: {
  row: JourneyListRow;
  accent: string;
  journey: JourneyMap;
  updateStage: (
    journeyId: string,
    stageId: string,
    patch: Partial<Omit<JourneyStage, "id">>,
  ) => void;
}) {
  return (
    <>
      <div className="jm-row-label" title={ROW_META[row].hint}>
        <span className="jm-row-dot" style={{ background: accent }} />
        {ROW_META[row].label}
      </div>
      {journey.stages.map((st) => (
        <div className="jm-cell" key={st.id}>
          <CellList
            items={st[row]}
            accent={accent}
            placeholder="+ 添加…"
            onChange={(items) =>
              updateStage(journey.id, st.id, { [row]: items } as Partial<JourneyStage>)
            }
          />
        </div>
      ))}
      <div />
    </>
  );
}
