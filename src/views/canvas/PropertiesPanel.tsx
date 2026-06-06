import { useState } from "react";
import { useStore } from "@/store/useStore";
import { BlendMode, Constraints, Fill, GradientStop, HConstraint, Interaction, Node, VConstraint } from "@/schema/types";
import { id } from "@/schema/defaults";
import { resolveFill } from "@/render/resolve";
import { isInstanceModified } from "@/schema/nodeOps";
import { downloadNodePng } from "@/export/exportPng";
import Icon, { IconName } from "@/components/Icon";
import { useUi } from "@/store/useUi";

/** Collapsible section with a Figma-style header (chevron + title + optional action). */
function Section({
  title,
  icon,
  action,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: IconName;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="prop-section">
      <div className="prop-section-head">
        <button className="prop-section-toggle" onClick={() => setOpen((o) => !o)} title={open ? "折叠" : "展开"}>
          <Icon name={open ? "chevronDown" : "chevronRight"} size={11} />
          {icon && <Icon name={icon} size={13} />}
          <span>{title}</span>
        </button>
        {action && <div className="prop-section-action">{action}</div>}
      </div>
      {open && <div className="prop-section-body">{children}</div>}
    </div>
  );
}

/** A compact labelled number field (icon/letter prefix + numeric input). */
function NumField({
  label,
  value,
  onChange,
  suffix,
  min,
}: {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
}) {
  return (
    <div className="numfield" title={typeof label === "string" ? label : undefined}>
      <span className="numfield-label">{label}</span>
      <input
        type="number"
        min={min}
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix && <span className="numfield-suffix">{suffix}</span>}
    </div>
  );
}

export default function PropertiesPanel() {
  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const activePageId = useStore((s) => s.activePageId);
  const activeFrameId = useStore((s) => s.activeFrameId);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const updateNode = useStore((s) => s.updateNode);
  const deleteSelection = useStore((s) => s.deleteSelection);
  const updateFrame = useStore((s) => s.updateFrame);
  const align = useStore((s) => s.align);
  const reorderSelection = useStore((s) => s.reorderSelection);
  const createComponent = useStore((s) => s.createComponentFromSelection);
  const detachInstance = useStore((s) => s.detachInstance);
  const resetInstance = useStore((s) => s.resetInstance);
  const pushInstanceToComponent = useStore((s) => s.pushInstanceToComponent);
  const setNodeLayout = useStore((s) => s.setNodeLayout);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const toggleLock = useStore((s) => s.toggleLock);
  const outlineStroke = useStore((s) => s.outlineStroke);
  const showToast = useUi((s) => s.showToast);

  const [exportScale, setExportScale] = useState(1);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");

  const page = doc.pages.find((p) => p.id === activePageId);
  const frame = page?.frames.find((f) => f.id === activeFrameId);
  const node =
    frame && selectedNodeIds.length === 1
      ? frame.nodes.find((n) => n.id === selectedNodeIds[0]) ?? null
      : null;

  const instanceMaster = node?.componentRef
    ? ds.components.find((c) => c.id === node.componentRef)?.template ?? null
    : null;
  const instanceModified =
    node && instanceMaster ? isInstanceModified(node, instanceMaster) : false;

  if (!frame) {
    return (
      <div className="sidebar right">
        <div className="prop-title">属性</div>
        <div className="prop-empty">选择一个框架或节点以编辑属性。</div>
      </div>
    );
  }

  // Multi-selection: alignment / distribution + grouping tools.
  if (selectedNodeIds.length > 1) {
    const alignBtns: [string, string, IconName][] = [
      ["left", "左对齐", "alignLeft"],
      ["hcenter", "水平居中", "alignHCenter"],
      ["right", "右对齐", "alignRight"],
      ["top", "顶对齐", "alignTop"],
      ["vcenter", "垂直居中", "alignVCenter"],
      ["bottom", "底对齐", "alignBottom"],
    ];
    return (
      <div className="sidebar right">
        <div className="prop-title">已选 {selectedNodeIds.length} 个节点</div>
        <Section title="对齐与分布" icon="alignLeft">
          <div className="align-bar">
            {alignBtns.map(([k, label, ic]) => (
              <button key={k} className="icon-btn" title={label} onClick={() => align(k as never)}>
                <Icon name={ic} size={16} />
              </button>
            ))}
          </div>
          <div className="align-bar" style={{ marginTop: 6 }}>
            <button className="btn slim" onClick={() => align("hdist" as never)}>水平分布</button>
            <button className="btn slim" onClick={() => align("vdist" as never)}>垂直分布</button>
          </div>
        </Section>
        <div className="prop-footer">
          <button
            className="btn"
            onClick={() => {
              const name = prompt("组件名称", "新组件");
              if (name) createComponent(name);
            }}
          >
            <Icon name="component" size={15} /> 创建为组件
          </button>
          <button className="btn danger" onClick={deleteSelection}>
            <Icon name="trash" size={15} /> 删除所选
          </button>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="sidebar right">
        <div className="prop-title">框架</div>
        <Section title="框架" icon="frame">
          <div className="prop-row">
            <label>名称</label>
            <input value={frame.name} onChange={(e) => updateFrame(frame.id, { name: e.target.value })} />
          </div>
          <div className="field-pair">
            <NumField label="W" value={frame.width} onChange={(v) => updateFrame(frame.id, { width: v })} />
            <NumField label="H" value={frame.height} onChange={(v) => updateFrame(frame.id, { height: v })} />
          </div>
          <label className="prop-check">
            <input
              type="checkbox"
              checked={frame.clipContent ?? false}
              onChange={(e) => updateFrame(frame.id, { clipContent: e.target.checked })}
            />
            裁剪内容（Clip content）
          </label>
        </Section>
        <Section title="外观" icon="palette">
          <div className="prop-row">
            <label>背景</label>
            <div className="swatch-row">
              <input
                className="color-swatch"
                type="color"
                value={frame.background}
                onChange={(e) => updateFrame(frame.id, { background: e.target.value })}
              />
              <input
                className="hex-input"
                value={frame.background}
                onChange={(e) => updateFrame(frame.id, { background: e.target.value })}
              />
            </div>
          </div>
          <div className="prop-row">
            <label>保真度</label>
            <select
              value={frame.fidelity}
              onChange={(e) => updateFrame(frame.id, { fidelity: e.target.value as "wireframe" | "hifi" })}
            >
              <option value="wireframe">线框</option>
              <option value="hifi">高保真</option>
            </select>
          </div>
        </Section>
        <div className="prop-hint">提示：框选或按住 Shift 多选可对齐/分布；选中后可创建为组件。</div>
      </div>
    );
  }

  const patch = (p: Partial<Node>) => updateNode(frame.id, node.id, p);
  const otherFrames = page!.frames.filter((f) => f.id !== frame.id);
  const fillColor = resolveFill(node.style.fill, ds, "#e2e8f0");
  const stroke = node.style.stroke;
  const hasFill = node.type !== "text" && node.type !== "line";

  const alignInFrame = (kind: string) => {
    if (kind === "left") patch({ x: 0 });
    if (kind === "hcenter") patch({ x: Math.round(frame.width / 2 - node.width / 2) });
    if (kind === "right") patch({ x: frame.width - node.width });
    if (kind === "top") patch({ y: 0 });
    if (kind === "vcenter") patch({ y: Math.round(frame.height / 2 - node.height / 2) });
    if (kind === "bottom") patch({ y: frame.height - node.height });
  };

  const uploadImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => patch({ src: String(reader.result) });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const uploadFillImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () =>
        patch({ style: { ...node.style, fill: { type: "image", src: String(reader.result), mode: "fill" } } });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const addInteraction = (targetFrameId: string) => {
    const it: Interaction = { id: id("act"), trigger: "click", targetFrameId, animation: "fade" };
    patch({ interactions: [...(node.interactions ?? []), it] });
  };

  const alignBtns: [string, string, IconName][] = [
    ["left", "左对齐", "alignLeft"],
    ["hcenter", "水平居中", "alignHCenter"],
    ["right", "右对齐", "alignRight"],
    ["top", "顶对齐", "alignTop"],
    ["vcenter", "垂直居中", "alignVCenter"],
    ["bottom", "底对齐", "alignBottom"],
  ];

  return (
    <div className="sidebar right">
      <div className="prop-title">
        <Icon name="square" size={14} />
        <input
          className="prop-name-input"
          value={node.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="节点名称"
        />
        {node.componentRef && <span className="badge">实例</span>}
        <div className="prop-title-actions">
          <button
            className="icon-btn"
            title={node.hidden ? "显示" : "隐藏"}
            onClick={() => toggleHidden(node.id)}
          >
            <Icon name={node.hidden ? "eyeOff" : "eye"} size={15} />
          </button>
          <button
            className="icon-btn"
            title={node.locked ? "解锁" : "锁定"}
            onClick={() => toggleLock(node.id)}
          >
            <Icon name={node.locked ? "lock" : "unlock"} size={15} />
          </button>
        </div>
      </div>

      <Section
        title="位置"
        icon="alignLeft"
        action={
          <div className="zbtns">
            <button className="icon-btn" title="置顶" onClick={() => reorderSelection("front")}>
              <Icon name="bringFront" size={14} />
            </button>
            <button className="icon-btn" title="置底" onClick={() => reorderSelection("back")}>
              <Icon name="sendBack" size={14} />
            </button>
          </div>
        }
      >
        <div className="align-bar">
          {alignBtns.map(([k, label, ic]) => (
            <button key={k} className="icon-btn" title={`${label}（相对框架）`} onClick={() => alignInFrame(k)}>
              <Icon name={ic} size={16} />
            </button>
          ))}
        </div>
        <div className="field-pair">
          <NumField label="X" value={node.x} onChange={(v) => patch({ x: v })} />
          <NumField label="Y" value={node.y} onChange={(v) => patch({ y: v })} />
        </div>
        <div className="field-pair">
          <NumField label={<Icon name="rotate" size={13} />} value={node.rotation ?? 0} onChange={(v) => patch({ rotation: v })} suffix="°" />
          <div className="numfield-spacer" />
        </div>
      </Section>

      <Section title="布局" icon="frame">
        <div className="field-pair">
          <NumField label="W" value={node.width} onChange={(v) => patch({ width: Math.max(1, v) })} min={1} />
          <NumField label="H" value={node.height} onChange={(v) => patch({ height: Math.max(1, v) })} min={1} />
        </div>
      </Section>

      <Section title="外观" icon="opacity">
        <div className="field-pair">
          <NumField
            label={<Icon name="opacity" size={13} />}
            value={Math.round((node.style.opacity ?? 1) * 100)}
            onChange={(v) => patch({ style: { ...node.style, opacity: Math.min(100, Math.max(0, v)) / 100 } })}
            suffix="%"
          />
          <NumField
            label={<Icon name="corner" size={13} />}
            value={node.style.radius ?? 0}
            onChange={(v) => patch({ style: { ...node.style, radius: Math.max(0, v) } })}
            min={0}
          />
        </div>
        <input
          className="opacity-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={node.style.opacity ?? 1}
          onChange={(e) => patch({ style: { ...node.style, opacity: Number(e.target.value) } })}
        />
        <div className="prop-row">
          <label>混合</label>
          <select
            title="混合模式（Blend mode）"
            value={node.style.blendMode ?? "normal"}
            onChange={(e) => patch({ style: { ...node.style, blendMode: e.target.value as BlendMode } })}
          >
            {([
              ["normal", "正常"],
              ["multiply", "正片叠底"],
              ["screen", "滤色"],
              ["overlay", "叠加"],
              ["darken", "变暗"],
              ["lighten", "变亮"],
              ["color-dodge", "颜色减淡"],
              ["color-burn", "颜色加深"],
              ["hard-light", "强光"],
              ["soft-light", "柔光"],
              ["difference", "差值"],
              ["exclusion", "排除"],
            ] as [BlendMode, string][]).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
      </Section>

      {hasFill && (() => {
        const fill = node.style.fill;
        const ftype: "solid" | "linear" | "radial" | "image" =
          fill?.type === "linear" || fill?.type === "radial" || fill?.type === "image"
            ? fill.type
            : "solid";
        const setFill = (f: Fill | undefined) => patch({ style: { ...node.style, fill: f } });
        const stops: GradientStop[] =
          fill?.type === "linear" || fill?.type === "radial"
            ? fill.stops
            : [
                { offset: 0, color: fillColor },
                { offset: 1, color: "#ffffff" },
              ];
        const setStops = (next: GradientStop[]) =>
          setFill(
            ftype === "radial"
              ? { type: "radial", stops: next }
              : { type: "linear", angle: fill?.type === "linear" ? fill.angle : 90, stops: next },
          );
        const onType = (t: string) => {
          if (t === "solid") setFill({ type: "solid", color: fillColor });
          else if (t === "linear") setFill({ type: "linear", angle: 90, stops });
          else if (t === "radial") setFill({ type: "radial", stops });
          else uploadFillImage();
        };
        return (
          <Section title="填充" icon="palette">
            <div className="prop-row">
              <label>类型</label>
              <select value={ftype} onChange={(e) => onType(e.target.value)}>
                <option value="solid">纯色</option>
                <option value="linear">线性渐变</option>
                <option value="radial">径向渐变</option>
                <option value="image">图片</option>
              </select>
            </div>

            {ftype === "solid" && (
              <>
                <div className="swatch-row">
                  <input
                    className="color-swatch"
                    type="color"
                    value={fillColor}
                    title="自定义颜色"
                    onChange={(e) => setFill({ type: "solid", color: e.target.value })}
                  />
                  <input
                    className="hex-input"
                    value={fillColor}
                    onChange={(e) => setFill({ type: "solid", color: e.target.value })}
                  />
                </div>
                <div className="prop-row">
                  <label>色板</label>
                  <select
                    value={fill?.type === "token" ? fill.token : ""}
                    onChange={(e) =>
                      setFill(e.target.value ? { type: "token", token: e.target.value } : { type: "solid", color: fillColor })
                    }
                  >
                    <option value="">自定义色</option>
                    {Object.keys(ds.tokens.colors).map((t) => (
                      <option key={t} value={t}>色板 · {t}</option>
                    ))}
                  </select>
                </div>
                {(ds.variables ?? []).some((v) => v.type === "color") && (
                  <div className="prop-row">
                    <label>变量</label>
                    <select
                      title="绑定到设计系统颜色变量（Figma Variables）"
                      value={fill?.type === "variable" ? fill.variableId : ""}
                      onChange={(e) =>
                        setFill(e.target.value ? { type: "variable", variableId: e.target.value } : { type: "solid", color: fillColor })
                      }
                    >
                      <option value="">未绑定</option>
                      {(ds.variables ?? [])
                        .filter((v) => v.type === "color")
                        .map((v) => (
                          <option key={v.id} value={v.id}>◇ {v.name}</option>
                        ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {(ftype === "linear" || ftype === "radial") && (
              <>
                {ftype === "linear" && (
                  <div className="field-pair">
                    <NumField
                      label="角度"
                      value={fill?.type === "linear" ? fill.angle : 90}
                      onChange={(v) => setFill({ type: "linear", angle: v, stops })}
                      suffix="°"
                    />
                    <div className="numfield-spacer" />
                  </div>
                )}
                {stops.map((st, i) => (
                  <div className="swatch-row" key={i}>
                    <input
                      className="color-swatch"
                      type="color"
                      value={st.color}
                      onChange={(e) => setStops(stops.map((s, j) => (j === i ? { ...s, color: e.target.value } : s)))}
                    />
                    <input
                      className="hex-input"
                      value={st.color}
                      onChange={(e) => setStops(stops.map((s, j) => (j === i ? { ...s, color: e.target.value } : s)))}
                    />
                    <input
                      type="number"
                      className="stop-offset"
                      min={0}
                      max={100}
                      value={Math.round(st.offset * 100)}
                      title="色标位置 %"
                      onChange={(e) => setStops(stops.map((s, j) => (j === i ? { ...s, offset: Number(e.target.value) / 100 } : s)))}
                    />
                    {stops.length > 2 && (
                      <button className="icon-btn" title="删除色标" onClick={() => setStops(stops.filter((_, j) => j !== i))}>
                        <Icon name="minus" size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button className="btn slim" onClick={() => setStops([...stops, { offset: 1, color: "#000000" }])}>
                  + 色标
                </button>
              </>
            )}

            {ftype === "image" && (
              <>
                <button className="btn slim" onClick={uploadFillImage}>更换图片…</button>
                <div className="prop-row">
                  <label>缩放</label>
                  <select
                    value={fill?.type === "image" ? fill.mode ?? "fill" : "fill"}
                    onChange={(e) =>
                      fill?.type === "image" && setFill({ ...fill, mode: e.target.value as "fill" | "fit" | "tile" })
                    }
                  >
                    <option value="fill">填充 (Cover)</option>
                    <option value="fit">适应 (Contain)</option>
                    <option value="tile">平铺 (Tile)</option>
                  </select>
                </div>
              </>
            )}
          </Section>
        );
      })()}

      <Section
        title="描边"
        icon="square"
        action={
          <button
            className="icon-btn"
            title={stroke ? "移除描边" : "添加描边"}
            onClick={() =>
              patch({
                style: {
                  ...node.style,
                  stroke: stroke ? undefined : { color: "#1e293b", width: 1, position: "inside" },
                },
              })
            }
          >
            <Icon name={stroke ? "minus" : "plus"} size={14} />
          </button>
        }
      >
        {stroke ? (
          <>
            <div className="swatch-row">
              <input
                className="color-swatch"
                type="color"
                value={stroke.color}
                onChange={(e) => patch({ style: { ...node.style, stroke: { ...stroke, color: e.target.value } } })}
              />
              <input
                className="hex-input"
                value={stroke.color}
                onChange={(e) => patch({ style: { ...node.style, stroke: { ...stroke, color: e.target.value } } })}
              />
            </div>
            <div className="field-pair">
              <div className="prop-row inline">
                <select
                  value={stroke.position ?? "center"}
                  onChange={(e) =>
                    patch({
                      style: {
                        ...node.style,
                        stroke: { ...stroke, position: e.target.value as "inside" | "center" | "outside" },
                      },
                    })
                  }
                >
                  <option value="inside">内侧</option>
                  <option value="center">居中</option>
                  <option value="outside">外侧</option>
                </select>
              </div>
              <NumField
                label="粗"
                value={stroke.width}
                onChange={(v) => patch({ style: { ...node.style, stroke: { ...stroke, width: Math.max(0, v) } } })}
                min={0}
              />
            </div>
          </>
        ) : (
          <div className="prop-hint compact">无描边</div>
        )}
      </Section>

      <Section
        title="效果"
        icon="sparkles"
        action={
          <button
            className="icon-btn"
            title={node.style.shadow ? "移除阴影" : "添加投影"}
            onClick={() =>
              patch({
                style: {
                  ...node.style,
                  shadow: node.style.shadow ? undefined : { x: 0, y: 4, blur: 16, color: "rgba(0,0,0,0.15)" },
                },
              })
            }
          >
            <Icon name={node.style.shadow ? "minus" : "plus"} size={14} />
          </button>
        }
      >
        {node.style.shadow ? (
          <>
            <div className="prop-row"><label>投影 (Drop shadow)</label></div>
            <div className="field-pair">
              <NumField label="X" value={node.style.shadow.x} onChange={(v) => patch({ style: { ...node.style, shadow: { ...node.style.shadow!, x: v } } })} />
              <NumField label="Y" value={node.style.shadow.y} onChange={(v) => patch({ style: { ...node.style, shadow: { ...node.style.shadow!, y: v } } })} />
            </div>
            <div className="field-pair">
              <NumField label="模糊" value={node.style.shadow.blur} onChange={(v) => patch({ style: { ...node.style, shadow: { ...node.style.shadow!, blur: Math.max(0, v) } } })} min={0} />
              <div className="numfield-spacer" />
            </div>
          </>
        ) : (
          <div className="prop-hint compact">无投影</div>
        )}
        <div className="field-pair" style={{ marginTop: 6 }}>
          <NumField
            label="图层模糊"
            value={node.style.blur ?? 0}
            onChange={(v) => patch({ style: { ...node.style, blur: Math.max(0, v) } })}
            min={0}
            suffix="px"
          />
          <div className="numfield-spacer" />
        </div>
      </Section>

      <Section title="约束" icon="frame">
        <div className="field-pair">
          <div className="prop-row inline">
            <select
              title="水平约束"
              value={node.constraints?.h ?? "left"}
              onChange={(e) => {
                const c: Constraints = { h: e.target.value as HConstraint, v: node.constraints?.v ?? "top" };
                patch({ constraints: c });
              }}
            >
              <option value="left">左 ←</option>
              <option value="right">右 →</option>
              <option value="left-right">左右 ↔</option>
              <option value="center">水平居中</option>
              <option value="scale">缩放</option>
            </select>
          </div>
          <div className="prop-row inline">
            <select
              title="垂直约束"
              value={node.constraints?.v ?? "top"}
              onChange={(e) => {
                const c: Constraints = { h: node.constraints?.h ?? "left", v: e.target.value as VConstraint };
                patch({ constraints: c });
              }}
            >
              <option value="top">上 ↑</option>
              <option value="bottom">下 ↓</option>
              <option value="top-bottom">上下 ↕</option>
              <option value="center">垂直居中</option>
              <option value="scale">缩放</option>
            </select>
          </div>
        </div>
        <div className="prop-hint compact">调整框架尺寸时，子元素按此约束重排。</div>
      </Section>

      {node.text && (
        <Section title="文字" icon="text">
          <div className="prop-row">
            <label>内容</label>
            <input value={node.text.content} onChange={(e) => patch({ text: { ...node.text!, content: e.target.value } })} />
          </div>
          <div className="field-pair">
            <NumField label="字号" value={node.text.fontSize} onChange={(v) => patch({ text: { ...node.text!, fontSize: v } })} />
            <div className="prop-row inline">
              <select value={node.text.fontWeight} onChange={(e) => patch({ text: { ...node.text!, fontWeight: Number(e.target.value) } })}>
                <option value={400}>常规</option>
                <option value={600}>中粗</option>
                <option value={700}>粗体</option>
              </select>
            </div>
          </div>
          <div className="prop-row">
            <label>颜色</label>
            <div className="swatch-row">
              <input className="color-swatch" type="color" value={node.text.color} onChange={(e) => patch({ text: { ...node.text!, color: e.target.value } })} />
              <input className="hex-input" value={node.text.color} onChange={(e) => patch({ text: { ...node.text!, color: e.target.value } })} />
            </div>
          </div>
          <div className="prop-row">
            <label>对齐</label>
            <select value={node.text.align} onChange={(e) => patch({ text: { ...node.text!, align: e.target.value as "left" | "center" | "right" } })}>
              <option value="left">左</option>
              <option value="center">中</option>
              <option value="right">右</option>
            </select>
          </div>
        </Section>
      )}

      {node.type === "image" && (
        <Section title="图片" icon="image">
          {node.src ? (
            <div className="prop-row">
              <img src={node.src} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
              <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>已嵌入</span>
            </div>
          ) : (
            <div className="prop-hint compact">未设置图片</div>
          )}
          <div className="field-pair">
            <button className="btn slim" onClick={uploadImage}>{node.src ? "替换" : "上传"}</button>
            {node.src && <button className="btn slim danger" onClick={() => patch({ src: undefined })}>清除</button>}
          </div>
        </Section>
      )}

      {node.type === "vector" && node.path && (
        <Section title="矢量路径" icon="pen">
          <div className="prop-row">
            <label>锚点</label>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{node.path.anchors.length} 个</span>
          </div>
          <label className="prop-check">
            <input
              type="checkbox"
              checked={node.path.closed}
              onChange={(e) => patch({ path: { ...node.path!, closed: e.target.checked } })}
            />
            闭合路径
          </label>
          <div className="prop-hint compact">双击路径进入锚点编辑：拖拽移动 · 双击切换平滑/尖角 · Alt+点击删除</div>
          {(node.style.stroke?.width ?? 0) > 0 && (
            <button className="btn slim" onClick={() => outlineStroke(node.id)}>描边转轮廓</button>
          )}
        </Section>
      )}

      {node.type === "group" && (
        <Section title="自动布局" icon="group">
          <div className="prop-row">
            <label>方向</label>
            <select
              value={node.layout?.mode ?? "none"}
              onChange={(e) => {
                const mode = e.target.value as "none" | "vertical" | "horizontal";
                setNodeLayout(frame.id, node.id, mode === "none" ? null : { mode });
              }}
            >
              <option value="none">无（自由摆放）</option>
              <option value="vertical">竖向堆叠</option>
              <option value="horizontal">横向堆叠</option>
            </select>
          </div>
          {node.layout && node.layout.mode !== "none" && (
            <>
              <div className="field-pair">
                <NumField label="间距" value={node.layout.gap} onChange={(v) => setNodeLayout(frame.id, node.id, { gap: Math.max(0, v) })} min={0} />
                <NumField
                  label="内边距"
                  value={node.layout.padding.top}
                  onChange={(v) => {
                    const p = Math.max(0, v);
                    setNodeLayout(frame.id, node.id, { padding: { top: p, right: p, bottom: p, left: p } });
                  }}
                  min={0}
                />
              </div>
              <div className="prop-row">
                <label>对齐</label>
                <select
                  value={node.layout.align}
                  onChange={(e) => setNodeLayout(frame.id, node.id, { align: e.target.value as "start" | "center" | "end" | "stretch" })}
                >
                  <option value="start">起始</option>
                  <option value="center">居中</option>
                  <option value="end">末尾</option>
                  <option value="stretch">拉伸</option>
                </select>
              </div>
            </>
          )}
        </Section>
      )}

      <Section title="交互 / 原型跳转" icon="flow">
        {(node.interactions ?? []).map((it) => {
          const target = page!.frames.find((f) => f.id === it.targetFrameId);
          return (
            <div className="prop-row" key={it.id}>
              <span style={{ fontSize: 12 }}>点击 → {target?.name ?? "?"}</span>
              <select
                value={it.animation}
                style={{ width: 84, marginLeft: "auto" }}
                onChange={(e) =>
                  patch({
                    interactions: (node.interactions ?? []).map((x) =>
                      x.id === it.id ? { ...x, animation: e.target.value as Interaction["animation"] } : x,
                    ),
                  })
                }
              >
                <option value="none">无</option>
                <option value="fade">淡入</option>
                <option value="slide-left">左滑</option>
                <option value="slide-right">右滑</option>
              </select>
              <button
                className="icon-btn"
                title="移除跳转"
                onClick={() => patch({ interactions: (node.interactions ?? []).filter((x) => x.id !== it.id) })}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          );
        })}
        {otherFrames.length > 0 ? (
          <select className="btn slim" style={{ width: "100%" }} value="" onChange={(e) => e.target.value && addInteraction(e.target.value)}>
            <option value="">+ 添加跳转到…</option>
            {otherFrames.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        ) : (
          <div className="prop-hint compact">再创建一个框架即可连线跳转。</div>
        )}
      </Section>

      <Section title="导出" icon="download">
        <div className="field-pair">
          <div className="prop-row inline">
            <select value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))}>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
            </select>
          </div>
          <div className="prop-row inline">
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "png" | "jpg")}>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </div>
        </div>
        <button
          className="btn slim"
          style={{ width: "100%", marginTop: 6 }}
          onClick={() => {
            const ok = downloadNodePng(frame, node, exportScale, exportFormat);
            showToast(ok ? `已导出 ${node.name || "节点"}@${exportScale}x.${exportFormat}` : "导出失败：画布未就绪", ok ? 2500 : 4000);
          }}
        >
          <Icon name="download" size={15} /> 导出 {exportScale}x {exportFormat.toUpperCase()}
        </button>
      </Section>

      <div className="prop-footer">
        <button
          className="btn"
          onClick={() => {
            const name = prompt("组件名称", node.name);
            if (name) createComponent(name);
          }}
        >
          <Icon name="component" size={15} /> 创建为组件
        </button>
        {node.componentRef && (
          <>
            <div
              className="instance-status"
              style={{ color: instanceModified ? "#f59e0b" : "var(--muted)" }}
            >
              {instanceModified ? "◆ 实例已覆盖主体" : "◇ 实例与主体一致"}
            </div>
            <button className="btn slim" title="放弃本实例的修改，重新同步组件主体" disabled={!instanceModified} onClick={() => resetInstance(node.id)}>
              ↺ 重置实例
            </button>
            <button
              className="btn slim"
              title="把本实例的当前内容发布为组件主体，并同步到其它实例"
              disabled={!instanceModified}
              onClick={() => {
                if (confirm("将本实例的修改推送为组件主体？其它实例会同步更新。")) pushInstanceToComponent(node.id);
              }}
            >
              ⇪ 推送修改到组件
            </button>
            <button className="btn slim" onClick={() => detachInstance(node.id)}>脱离实例</button>
          </>
        )}
        <button className="btn danger" onClick={deleteSelection}>
          <Icon name="trash" size={15} /> 删除节点
        </button>
      </div>
    </div>
  );
}
