import { useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { clearHistory } from "@/store/history";
import { GpoDocument } from "@/schema/types";
import { STARTER_TEMPLATES } from "@/templates/starters";
import {
  LibrarySummary,
  deleteFromLibrary,
  listLibrary,
  loadFromLibrary,
  renameInLibrary,
  saveToLibrary,
} from "@/file/library";
import { openGpo } from "@/file/fileIo";
import Icon from "@/components/Icon";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "刚刚";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

export default function HomeView({
  onOpenAi,
  onOpenCloud,
}: {
  onOpenAi: () => void;
  onOpenCloud: () => void;
}) {
  const replaceDocument = useStore((s) => s.replaceDocument);
  const setView = useStore((s) => s.setView);
  const showToast = useUi((s) => s.showToast);
  const [files, setFiles] = useState<LibrarySummary[]>(() => listLibrary());

  const refresh = () => setFiles(listLibrary());

  const openDoc = (doc: GpoDocument, view: "requirements" | "design") => {
    saveToLibrary(doc);
    replaceDocument(doc);
    clearHistory();
    refresh();
    setView(view);
  };

  const openLibrary = (sum: LibrarySummary) => {
    const doc = loadFromLibrary(sum.id);
    if (!doc) return showToast("文件已不存在", 3500);
    openDoc(doc, "design");
    showToast(`已打开「${doc.meta.name}」`);
  };

  const handleOpenGpo = async () => {
    const d = await openGpo();
    if (d) {
      openDoc(d, "design");
      showToast(`已打开「${d.meta.name}」`);
    }
  };

  const handleRename = (sum: LibrarySummary) => {
    const name = prompt("重命名文件", sum.name);
    if (name && name.trim()) {
      renameInLibrary(sum.id, name.trim());
      refresh();
    }
  };

  const handleDelete = (sum: LibrarySummary) => {
    if (confirm(`删除「${sum.name}」？此操作不可撤销。`)) {
      deleteFromLibrary(sum.id);
      refresh();
      showToast("已删除文件");
    }
  };

  return (
    <div className="home">
      <header className="home-top">
        <div className="home-brand">
          Open<span>Prototype</span>
        </div>
        <div className="home-top-actions">
          <button className="btn ghost" onClick={onOpenCloud}>
            <Icon name="cloud" size={15} /> 云端
          </button>
          <button className="btn ghost" onClick={onOpenAi}>
            <Icon name="settings" size={15} /> AI 设置
          </button>
        </div>
      </header>

      <div className="home-scroll">
        <section className="home-hero">
          <h1>开始创作</h1>
          <p>选择一个模板新建文件，或打开你最近的设计。</p>
        </section>

        <section className="home-section">
          <h2 className="home-section-title">新建</h2>
          <div className="starter-grid">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.key}
                className="starter-card"
                onClick={() => {
                  const doc = t.build();
                  openDoc(doc, t.key === "blank" ? "design" : "requirements");
                  showToast(`已从「${t.name}」模板新建`);
                }}
              >
                <span className="starter-glyph">{t.glyph}</span>
                <span className="starter-name">{t.name}</span>
                <span className="starter-desc">{t.description}</span>
              </button>
            ))}
            <button className="starter-card open" onClick={handleOpenGpo}>
              <span className="starter-glyph">
                <Icon name="folder" size={26} />
              </span>
              <span className="starter-name">打开 .gpo 文件</span>
              <span className="starter-desc">从本地磁盘导入已有文件。</span>
            </button>
          </div>
        </section>

        <section className="home-section">
          <h2 className="home-section-title">
            我的文件 <span className="home-count">{files.length}</span>
          </h2>
          {files.length === 0 ? (
            <div className="home-empty">还没有文件。用上面的模板新建一个吧。</div>
          ) : (
            <div className="files-grid">
              {files.map((f) => (
                <div key={f.id} className="file-card" onClick={() => openLibrary(f)}>
                  <div className="file-thumb">
                    <Icon name="frame" size={30} />
                  </div>
                  <div className="file-meta">
                    <div className="file-name" title={f.name}>
                      {f.name}
                    </div>
                    <div className="file-sub">
                      {f.frameCount} 个框架 · {timeAgo(f.updatedAt)}
                    </div>
                  </div>
                  <div className="file-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" title="重命名" onClick={() => handleRename(f)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="icon-btn danger" title="删除" onClick={() => handleDelete(f)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
