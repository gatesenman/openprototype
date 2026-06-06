import { useEffect, useRef, useState } from "react";
import { useStore, ViewMode } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { openGpo, saveGpo } from "@/file/fileIo";
import { downloadHtml } from "@/export/exportHtml";
import { downloadFramePng } from "@/export/exportPng";
import {
  frameToHtml,
  frameToReact,
  frameToVue,
  frameToCss,
  frameToTailwind,
  download,
} from "@/export/exportCode";
import { frameToSvg } from "@/export/exportSvg";
import { downloadFramePdf } from "@/export/exportPdf";
import { downloadFramesZip } from "@/export/batchExport";
import { tokensToCss, tokensToJson } from "@/export/exportTokens";
import { clearHistory } from "@/store/history";
import { loadAuto, saveAuto } from "@/file/persist";
import { saveToLibrary } from "@/file/library";
import { useShortcuts } from "@/hooks/useShortcuts";
import { importDesignJson } from "@/interop/importDesign";
import Icon, { IconName } from "@/components/Icon";
import HomeView from "@/views/HomeView";
import RequirementsView from "@/views/RequirementsView";
import DesignView from "@/views/DesignView";
import FlowsView from "@/views/FlowsView";
import JourneyView from "@/views/JourneyView";
import PreviewView from "@/views/PreviewView";
import MarketView from "@/views/MarketView";
import AiSettingsModal from "@/components/AiSettingsModal";
import DesignSystemModal from "@/components/DesignSystemModal";
import CloudModal from "@/components/CloudModal";

/** Close a popover when clicking outside of it. */
function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return ref;
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const doc = useStore((s) => s.doc);
  const activePageId = useStore((s) => s.activePageId);
  const activeFrameId = useStore((s) => s.activeFrameId);
  const showToast = useUi((s) => s.showToast);
  const ref = useClickOutside(() => setOpen(false));

  const page = doc.pages.find((p) => p.id === activePageId);
  const frame = page?.frames.find((f) => f.id === activeFrameId) ?? page?.frames[0];
  const ds = doc.designSystem;
  const close = () => setOpen(false);

  const item = (label: string, fn: () => void | Promise<void>) => (
    <button
      className="menu-item"
      onClick={() => {
        void fn();
        close();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn primary" onClick={() => setOpen((v) => !v)}>
        <Icon name="download" size={15} /> 导出
      </button>
      {open && (
        <div className="menu">
          {item("可演示 HTML 原型", () => {
            downloadHtml(doc);
            showToast("已导出可演示 HTML 原型");
          })}
          {item("当前框架 PNG 图片", () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            const ok = downloadFramePng(frame, frame.name);
            showToast(ok ? "已导出 PNG" : "请先在「设计」页打开该框架", ok ? 3200 : 4000);
          })}
          {item("当前框架 SVG 矢量", () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            download(frameToSvg(frame, ds), `${frame.name || "screen"}.svg`, "image/svg+xml");
            showToast("已导出 SVG");
          })}
          {item("当前框架 PDF", async () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            const ok = await downloadFramePdf(frame, frame.name);
            showToast(ok ? "已导出 PDF" : "请先在「设计」页打开该框架", ok ? 3200 : 4000);
          })}
          {item("批量切图 @2x (zip)", async () => {
            const frames = page?.frames ?? [];
            const n = await downloadFramesZip(frames, 2, "slices@2x.zip");
            showToast(n ? `已批量导出 ${n} 张切图 (zip)` : "请先在「设计」页打开框架", n ? 3200 : 4000);
          })}
          <div className="menu-sep" />
          {item("设计 Token (CSS)", () => {
            download(tokensToCss(ds), `${ds.name || "tokens"}.css`, "text/css");
            showToast("已导出设计 Token CSS");
          })}
          {item("设计 Token (JSON)", () => {
            download(tokensToJson(ds), `${ds.name || "tokens"}.json`, "application/json");
            showToast("已导出设计 Token JSON");
          })}
          <div className="menu-sep" />
          {item("当前框架 React 代码", () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            download(frameToReact(frame, ds), `${frame.name || "Screen"}.tsx`, "text/plain");
            showToast("已导出 React 组件");
          })}
          {item("当前框架 Vue 组件", () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            download(frameToVue(frame, ds), `${frame.name || "Screen"}.vue`, "text/plain");
            showToast("已导出 Vue 组件");
          })}
          {item("当前框架 Tailwind", () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            download(frameToTailwind(frame, ds), `${frame.name || "Screen"}.tsx`, "text/plain");
            showToast("已导出 Tailwind 组件");
          })}
          {item("当前框架 HTML/CSS", () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            download(frameToHtml(frame, ds), `${frame.name || "screen"}.html`, "text/html");
            showToast("已导出 HTML/CSS");
          })}
          {item("当前框架 CSS 样式表", () => {
            if (!frame) return showToast("没有可导出的框架", 4000);
            download(frameToCss(frame, ds), `${frame.name || "screen"}.css`, "text/css");
            showToast("已导出 CSS 样式表");
          })}
        </div>
      )}
    </div>
  );
}

function MoreMenu({
  onDs,
  onAi,
  onCloud,
  onImport,
}: {
  onDs: () => void;
  onAi: () => void;
  onCloud: () => void;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const setView = useStore((s) => s.setView);
  const ref = useClickOutside(() => setOpen(false));
  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };
  const item = (icon: IconName, label: string, fn: () => void) => (
    <button className="menu-item icon" onClick={run(fn)}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );
  return (
    <div className="export-menu" ref={ref}>
      <button className="btn icon-only" title="更多" onClick={() => setOpen((v) => !v)}>
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="menu right">
          {item("palette", "设计系统", onDs)}
          {item("cloud", "云端协作", onCloud)}
          {item("import", "导入 Figma / Sketch（组件 / 画板 / Token）", onImport)}
          {item("component", "组件 / 插件市场", () => setView("market"))}
          <div className="menu-sep" />
          {item("settings", "AI 设置", onAi)}
        </div>
      )}
    </div>
  );
}

const TABS: [ViewMode, string, IconName][] = [
  ["requirements", "需求", "list"],
  ["design", "设计", "frame"],
  ["flows", "流程", "flow"],
  ["journey", "旅程", "grid"],
  ["preview", "演示", "play"],
];

export default function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const doc = useStore((s) => s.doc);
  const replaceDocument = useStore((s) => s.replaceDocument);
  const updateDesignSystem = useStore((s) => s.updateDesignSystem);
  const addFramesWithNodes = useStore((s) => s.addFramesWithNodes);
  const addComponent = useStore((s) => s.addComponent);
  const setDocName = useStore((s) => s.setDocName);
  const toast = useUi((s) => s.toast);
  const showToast = useUi((s) => s.showToast);

  const [showAi, setShowAi] = useState(false);
  const [showDs, setShowDs] = useState(false);
  const [showCloud, setShowCloud] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useShortcuts(view === "design");

  // Restore autosaved document on first load (kept in memory; Home is the entry).
  useEffect(() => {
    const saved = loadAuto();
    if (saved && saved.pages) {
      replaceDocument(saved);
      saveToLibrary(saved);
      clearHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave + library upsert whenever the document changes.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((s, prev) => {
      if (s.doc === prev.doc) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const d = useStore.getState().doc;
        saveAuto(d);
        saveToLibrary(d);
      }, 600);
    });
    return () => {
      if (t) clearTimeout(t);
      unsub();
    };
  }, []);

  const handleOpen = async () => {
    const d = await openGpo();
    if (d) {
      replaceDocument(d);
      saveToLibrary(d);
      clearHistory();
      setView("design");
      showToast(`已打开「${d.meta.name}」`);
    }
  };
  const handleSave = async () => {
    await saveGpo(doc);
    showToast("已保存 .gpo 文件");
  };
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const result = importDesignJson(text);
      if (result.tokens) {
        const t = result.tokens;
        const cur = doc.designSystem.tokens;
        updateDesignSystem({
          tokens: {
            colors: { ...cur.colors, ...t.colors },
            fonts: {
              family: t.fontFamily || cur.fonts.family,
              sizes: { ...cur.fonts.sizes, ...t.fontSizes },
            },
            radii: { ...cur.radii, ...t.radii },
            spacing: { ...cur.spacing, ...t.spacing },
          },
        });
      }
      if (result.components.length) {
        for (const comp of result.components) addComponent(comp);
      }
      if (result.frames.length) {
        addFramesWithNodes(result.frames);
        setView("design");
      } else if (result.components.length) {
        setView("design");
      }
      showToast(result.summary);
    } catch (e) {
      showToast((e as Error).message, 5000);
    }
  };

  if (view === "home") {
    return (
      <div className="app">
        <HomeView onOpenAi={() => setShowAi(true)} onOpenCloud={() => setShowCloud(true)} />
        {showAi && <AiSettingsModal onClose={() => setShowAi(false)} />}
        {showCloud && <CloudModal onClose={() => setShowCloud(false)} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-left">
          <button className="home-btn" title="返回首页" onClick={() => setView("home")}>
            <Icon name="home" size={17} />
          </button>
          <div className="brand sm">
            Open<span>Prototype</span>
          </div>
          <span className="doc-sep">/</span>
          <input
            className="doc-name"
            value={doc.meta.name}
            spellCheck={false}
            onChange={(e) => setDocName(e.target.value)}
            title="文件名"
          />
        </div>

        <div className="tabs">
          {TABS.map(([k, label, icon]) => (
            <button
              key={k}
              className={`tab ${view === k ? "active" : ""}`}
              onClick={() => setView(k)}
            >
              <Icon name={icon} size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="topbar-right">
          <button className="btn" onClick={handleOpen} title="打开 .gpo">
            <Icon name="folder" size={15} /> 打开
          </button>
          <button className="btn" onClick={handleSave} title="保存为 .gpo">
            <Icon name="download" size={15} /> 保存
          </button>
          <ExportMenu />
          <MoreMenu
            onDs={() => setShowDs(true)}
            onAi={() => setShowAi(true)}
            onCloud={() => setShowCloud(true)}
            onImport={() => importRef.current?.click()}
          />
        </div>

        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <div className="body">
        {view === "requirements" && <RequirementsView />}
        {view === "design" && <DesignView />}
        {view === "flows" && <FlowsView />}
        {view === "journey" && <JourneyView />}
        {view === "preview" && <PreviewView />}
        {view === "market" && <MarketView />}
      </div>

      {showAi && <AiSettingsModal onClose={() => setShowAi(false)} />}
      {showDs && <DesignSystemModal onClose={() => setShowDs(false)} />}
      {showCloud && <CloudModal onClose={() => setShowCloud(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
