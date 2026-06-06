import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { nodeFill } from "@/render/resolve";
import { CODE_LANGS, CodeLang, frameToCode, nodeToCode, download } from "@/export/exportCode";
import { frameToSvg, nodeToSvg } from "@/export/exportSvg";
import { downloadFramePdf } from "@/export/exportPdf";
import { downloadFramesZip } from "@/export/batchExport";
import { downloadFramePng } from "@/export/exportPng";
import Icon from "@/components/Icon";

/** A single labelled, copyable spec row. */
function Spec({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="dev-spec" onClick={() => onCopy(value)} title="点击复制">
      <span className="dev-spec-k">{label}</span>
      <span className="dev-spec-v">{value}</span>
      <Icon name="copy" size={12} />
    </div>
  );
}

export default function DevModePanel() {
  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const activePageId = useStore((s) => s.activePageId);
  const activeFrameId = useStore((s) => s.activeFrameId);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const showToast = useUi((s) => s.showToast);
  const toggleDevMode = useUi((s) => s.toggleDevMode);

  const [lang, setLang] = useState<CodeLang>("css");

  const page = doc.pages.find((p) => p.id === activePageId);
  const frame = page?.frames.find((f) => f.id === activeFrameId) ?? page?.frames[0];
  const node =
    frame && selectedNodeIds.length === 1
      ? frame.nodes.find((n) => n.id === selectedNodeIds[0]) ?? null
      : null;

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    showToast("已复制到剪贴板");
  };

  const code = useMemo(() => {
    if (!frame) return "";
    return node ? nodeToCode(node, ds, lang) : frameToCode(frame, ds, lang);
  }, [frame, node, ds, lang]);

  if (!frame) {
    return (
      <div className="sidebar right dev">
        <div className="dev-head">
          <span><Icon name="code" size={14} /> 开发模式</span>
          <button className="icon-btn" title="退出开发模式" onClick={toggleDevMode}><Icon name="close" size={14} /></button>
        </div>
        <div className="prop-empty">打开一个框架以查看标注与代码。</div>
      </div>
    );
  }

  const specs: [string, string][] = [];
  if (node) {
    specs.push(["位置", `${Math.round(node.x)}, ${Math.round(node.y)}`]);
    specs.push(["尺寸", `${Math.round(node.width)} × ${Math.round(node.height)}`]);
    if (node.style.radius) specs.push(["圆角", `${node.style.radius}px`]);
    if (node.type !== "text" && node.type !== "line")
      specs.push(["填充", nodeFill(node, ds)]);
    if (node.style.stroke)
      specs.push(["描边", `${node.style.stroke.width}px ${node.style.stroke.color} (${node.style.stroke.position ?? "center"})`]);
    if (node.style.opacity !== undefined) specs.push(["不透明度", `${Math.round(node.style.opacity * 100)}%`]);
    if (node.style.blur) specs.push(["模糊", `${node.style.blur}px`]);
    if (node.style.blendMode && node.style.blendMode !== "normal") specs.push(["混合", node.style.blendMode]);
    if (node.style.shadow) {
      const sh = node.style.shadow;
      specs.push(["阴影", `${sh.x} ${sh.y} ${sh.blur} ${sh.color}`]);
    }
    if (node.text) {
      specs.push(["字体", `${node.text.fontFamily} ${node.text.fontSize}px / ${node.text.fontWeight}`]);
      specs.push(["行高", `${node.text.lineHeight}`]);
      specs.push(["文字色", node.text.color]);
    }
  } else {
    specs.push(["框架", frame.name]);
    specs.push(["尺寸", `${frame.width} × ${frame.height}`]);
    specs.push(["背景", frame.background]);
    specs.push(["节点数", `${frame.nodes.length}`]);
  }

  const ext = CODE_LANGS.find((l) => l.id === lang)!;
  const baseName = (node?.name || frame.name || "screen").replace(/[^\w\u4e00-\u9fa5-]+/g, "-");

  return (
    <div className="sidebar right dev">
      <div className="dev-head">
        <span><Icon name="code" size={14} /> 开发模式 · {node ? node.name : frame.name}</span>
        <button className="icon-btn" title="退出开发模式" onClick={toggleDevMode}><Icon name="close" size={14} /></button>
      </div>

      <div className="dev-section-title">标注 / 测量（点击复制）</div>
      <div className="dev-specs">
        {specs.map(([k, v]) => (
          <Spec key={k} label={k} value={v} onCopy={copy} />
        ))}
      </div>

      <div className="dev-section-title">代码交付</div>
      <div className="dev-tabs">
        {CODE_LANGS.map((l) => (
          <button
            key={l.id}
            className={`dev-tab ${lang === l.id ? "active" : ""}`}
            onClick={() => setLang(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <pre className="dev-code">{code}</pre>
      <div className="dev-actions">
        <button className="btn slim primary" onClick={() => copy(code)}>
          <Icon name="copy" size={13} /> 复制{ext.label}
        </button>
        <button
          className="btn slim"
          onClick={() => download(code, `${baseName}.${ext.ext}`, ext.mime)}
        >
          <Icon name="download" size={13} /> 下载
        </button>
      </div>

      <div className="dev-section-title">资源切图</div>
      <div className="dev-actions wrap">
        <button
          className="btn slim"
          onClick={() => {
            const svg = node ? nodeToSvg(node, ds) : frameToSvg(frame, ds);
            download(svg, `${baseName}.svg`, "image/svg+xml");
            showToast("已导出 SVG");
          }}
        >
          SVG
        </button>
        <button
          className="btn slim"
          onClick={() => {
            const ok = downloadFramePng(frame, frame.name);
            showToast(ok ? "已导出 PNG" : "请在「设计」页打开该框架", ok ? 3000 : 4000);
          }}
        >
          PNG
        </button>
        <button
          className="btn slim"
          onClick={async () => {
            const ok = await downloadFramePdf(frame, frame.name);
            showToast(ok ? "已导出 PDF" : "请在「设计」页打开该框架", ok ? 3000 : 4000);
          }}
        >
          PDF
        </button>
        <button
          className="btn slim"
          onClick={async () => {
            const frames = page?.frames ?? [];
            const n = await downloadFramesZip(frames, 2, "slices@2x.zip");
            showToast(n ? `已批量导出 ${n} 张切图 (zip)` : "请在「设计」页打开框架", n ? 3200 : 4000);
          }}
        >
          批量切图 @2x
        </button>
      </div>
    </div>
  );
}
