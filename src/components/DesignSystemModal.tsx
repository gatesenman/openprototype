import { useState } from "react";
import { useStore } from "@/store/useStore";
import { DesignRule, Variable } from "@/schema/types";
import { id } from "@/schema/defaults";
import { auditDesignSystem } from "@/designsystem/audit";
import { DESIGN_SYSTEM_PRESETS, findPreset } from "@/designsystem/presets";

const RULE_KINDS: { kind: DesignRule["kind"]; label: string; hasValue: boolean }[] = [
  { kind: "primary-button-token", label: "主按钮用 primary token", hasValue: false },
  { kind: "card-radius", label: "卡片圆角统一", hasValue: true },
  { kind: "min-tap-target", label: "最小点击高度", hasValue: true },
  { kind: "custom", label: "自定义（仅说明）", hasValue: false },
];

export default function DesignSystemModal({ onClose }: { onClose: () => void }) {
  const ds = useStore((s) => s.doc.designSystem);
  const update = useStore((s) => s.updateDesignSystem);
  const addRule = useStore((s) => s.addRule);
  const updateRule = useStore((s) => s.updateRule);
  const deleteRule = useStore((s) => s.deleteRule);
  const renameComponent = useStore((s) => s.renameComponent);
  const deleteComponent = useStore((s) => s.deleteComponent);

  const [name, setName] = useState(ds.name);
  const [systemPrompt, setSystemPrompt] = useState(ds.systemPrompt);
  const [colors, setColors] = useState(ds.tokens.colors);
  const [radii, setRadii] = useState(ds.tokens.radii);
  const [spacing, setSpacing] = useState(ds.tokens.spacing);
  const [sizes, setSizes] = useState(ds.tokens.fonts.sizes);
  const [family, setFamily] = useState(ds.tokens.fonts.family);
  const [variables, setVariables] = useState<Variable[]>(ds.variables ?? []);

  const applyPreset = (presetId: string) => {
    const preset = findPreset(presetId);
    if (!preset) return;
    if (!confirm(`套用预置设计系统「${preset.name}」？会替换当前的颜色/圆角/间距/字体 tokens。`)) return;
    setName(preset.name);
    setColors(preset.tokens.colors);
    setRadii(preset.tokens.radii);
    setSpacing(preset.tokens.spacing);
    setSizes(preset.tokens.fonts.sizes);
    setFamily(preset.tokens.fonts.family);
    setVariables(preset.variables());
  };

  const save = () => {
    update({
      name,
      systemPrompt,
      variables,
      tokens: { ...ds.tokens, colors, radii, spacing, fonts: { family, sizes } },
    });
    onClose();
  };

  const patchVar = (vid: string, patch: Partial<Variable>) =>
    setVariables((vs) => vs.map((v) => (v.id === vid ? { ...v, ...patch } : v)));
  const addVar = (type: Variable["type"]) =>
    setVariables((vs) => [
      ...vs,
      {
        id: id("var"),
        name: type === "color" ? "color/new" : "number/new",
        type,
        value: type === "color" ? "#4f46e5" : 8,
        collection: "Custom",
      },
    ]);

  const numberMap = (
    label: string,
    map: Record<string, number>,
    setMap: (m: Record<string, number>) => void,
  ) => (
    <div className="field">
      <label>{label}</label>
      <div className="token-grid">
        {Object.entries(map).map(([k, v]) => (
          <div className="token-num" key={k}>
            <span>{k}</span>
            <input
              type="number"
              value={v}
              onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <h2>设计系统</h2>
        <div className="ds-scroll">
          <div className="field">
            <label>预置设计系统（一键套用标准 tokens）</label>
            <div className="preset-grid">
              {DESIGN_SYSTEM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="preset-card"
                  onClick={() => applyPreset(p.id)}
                  title={p.description}
                >
                  <span className="preset-swatch" style={{ background: p.tokens.colors.primary }} />
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-desc">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>体检（资深 PM / 设计师审核）</label>
            <div className="audit-list">
              {auditDesignSystem(ds).map((f, i) => (
                <div className={`audit-item ${f.level}`} key={i}>
                  <span className="audit-dot" />
                  {f.message}
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label>颜色 Tokens</label>
            {Object.entries(colors).map(([k, v]) => (
              <div className="prop-row" key={k}>
                <label>{k}</label>
                <input
                  type="color"
                  value={v}
                  onChange={(e) => setColors({ ...colors, [k]: e.target.value })}
                />
                <input
                  value={v}
                  onChange={(e) => setColors({ ...colors, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>

          {numberMap("圆角 Tokens (px)", radii, setRadii)}
          {numberMap("间距 Tokens (px)", spacing, setSpacing)}
          {numberMap("字号 Tokens (px)", sizes, setSizes)}

          <div className="field">
            <label>字体</label>
            <input value={family} onChange={(e) => setFamily(e.target.value)} />
          </div>

          <div className="field">
            <label>系统级提示词（注入每次 AI 生成 · 规则约束）</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="field-head">
              <label>设计规则（生成后自动校验/修正）</label>
              <button className="link" onClick={() => addRule()}>+ 新增规则</button>
            </div>
            {ds.rules.length === 0 && (
              <div className="muted-note">暂无规则</div>
            )}
            {ds.rules.map((r) => {
              const def = RULE_KINDS.find((k) => k.kind === r.kind);
              return (
                <div className="rule-row" key={r.id}>
                  <select
                    value={r.kind}
                    onChange={(e) =>
                      updateRule(r.id, { kind: e.target.value as DesignRule["kind"] })
                    }
                  >
                    {RULE_KINDS.map((k) => (
                      <option key={k.kind} value={k.kind}>{k.label}</option>
                    ))}
                  </select>
                  {def?.hasValue && (
                    <input
                      type="number"
                      className="rule-val"
                      value={typeof r.value === "number" ? r.value : 0}
                      onChange={(e) =>
                        updateRule(r.id, { value: Number(e.target.value) })
                      }
                    />
                  )}
                  <input
                    className="rule-desc"
                    value={r.description}
                    onChange={(e) => updateRule(r.id, { description: e.target.value })}
                  />
                  <button className="link danger" onClick={() => deleteRule(r.id)}>删除</button>
                </div>
              );
            })}
          </div>

          <div className="field">
            <div className="field-head">
              <label>变量 Variables（{variables.length}） · 可绑定到填充</label>
              <span>
                <button className="link" onClick={() => addVar("color")}>+ 颜色变量</button>
                <button className="link" onClick={() => addVar("number")}>+ 数值变量</button>
              </span>
            </div>
            {variables.length === 0 && (
              <div className="muted-note">还没有变量。颜色变量可在属性面板「填充」里绑定到任意元素。</div>
            )}
            {variables.map((v) => (
              <div className="rule-row" key={v.id}>
                <input
                  className="rule-desc"
                  value={v.name}
                  title="变量名（建议用 collection/name 形式）"
                  onChange={(e) => patchVar(v.id, { name: e.target.value })}
                />
                {v.type === "color" ? (
                  <>
                    <input
                      type="color"
                      value={String(v.value)}
                      onChange={(e) => patchVar(v.id, { value: e.target.value })}
                    />
                    <input
                      className="rule-val"
                      value={String(v.value)}
                      onChange={(e) => patchVar(v.id, { value: e.target.value })}
                    />
                  </>
                ) : (
                  <input
                    type="number"
                    className="rule-val"
                    value={Number(v.value)}
                    onChange={(e) => patchVar(v.id, { value: Number(e.target.value) })}
                  />
                )}
                <button
                  className="link danger"
                  onClick={() => setVariables((vs) => vs.filter((x) => x.id !== v.id))}
                >
                  删除
                </button>
              </div>
            ))}
          </div>

          <div className="field">
            <label>组件（{ds.components.length}）</label>
            {ds.components.length === 0 && (
              <div className="muted-note">还没有组件。在画布上选中元素「存为组件」、从组件市场安装，或「导入 Figma / Sketch」带入第三方组件。</div>
            )}
            {ds.components.map((c) => (
              <div className="rule-row" key={c.id}>
                <input
                  className="rule-desc"
                  value={c.name}
                  onChange={(e) => renameComponent(c.id, e.target.value)}
                />
                <button
                  className="link danger"
                  onClick={() => {
                    if (confirm(`删除组件「${c.name}」？已实例化的节点不受影响。`)) deleteComponent(c.id);
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
