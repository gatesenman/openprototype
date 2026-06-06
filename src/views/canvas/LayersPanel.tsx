import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import Icon, { nodeTypeIcon } from "@/components/Icon";

export default function LayersPanel() {
  const doc = useStore((s) => s.doc);
  const activePageId = useStore((s) => s.activePageId);
  const setActivePage = useStore((s) => s.setActivePage);
  const addPage = useStore((s) => s.addPage);
  const addFrame = useStore((s) => s.addFrame);
  const activeFrameId = useStore((s) => s.activeFrameId);
  const setActiveFrame = useStore((s) => s.setActiveFrame);
  const deleteFrame = useStore((s) => s.deleteFrame);
  const updateFrame = useStore((s) => s.updateFrame);
  const updateNode = useStore((s) => s.updateNode);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectNodes = useStore((s) => s.selectNodes);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const toggleLock = useStore((s) => s.toggleLock);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const reorderNodeTo = useStore((s) => s.reorderNodeTo);

  const page = doc.pages.find((p) => p.id === activePageId);

  // expand/collapse state per frame; active frame defaults open.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const isOpen = (frameId: string) =>
    collapsed[frameId] === undefined ? frameId === activeFrameId : !collapsed[frameId];
  const toggleOpen = (frameId: string) =>
    setCollapsed((c) => ({ ...c, [frameId]: isOpen(frameId) }));

  return (
    <div className="sidebar">
      <div className="layers-pages">
        <div className="layers-pages-head">
          <span>页面</span>
          <button className="icon-btn" title="新建页面" onClick={addPage}>
            <Icon name="plus" size={14} />
          </button>
        </div>
        <select
          className="page-select"
          value={activePageId}
          onChange={(e) => setActivePage(e.target.value)}
        >
          {doc.pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{p.frames.length} 框架）
            </option>
          ))}
        </select>
      </div>

      <div className="layers-head">
        <h3 style={{ padding: 0, margin: 0 }}>图层</h3>
        <button className="icon-btn" title="新建框架" onClick={() => addFrame()}>
          <Icon name="plus" size={14} />
        </button>
      </div>

      <div className="layer-tree">
        {page?.frames.length === 0 && (
          <div className="layer-empty">还没有框架，点上方 + 新建。</div>
        )}
        {page?.frames.map((f) => {
          const open = isOpen(f.id);
          const rendered = [...f.nodes].reverse(); // top-most first
          return (
            <div key={f.id}>
              <div
                className={`layer-row frame ${f.id === activeFrameId ? "active" : ""}`}
                onClick={() => setActiveFrame(f.id)}
              >
                <button
                  className="twisty"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOpen(f.id);
                  }}
                  title={open ? "折叠" : "展开"}
                >
                  <Icon name={open ? "chevronDown" : "chevronRight"} size={12} />
                </button>
                <span className="layer-ic">
                  <Icon name="frame" size={14} />
                </span>
                {renaming === f.id ? (
                  <RenameInput
                    value={f.name}
                    onCommit={(v) => {
                      if (v.trim()) updateFrame(f.id, { name: v.trim() });
                      setRenaming(null);
                    }}
                  />
                ) : (
                  <span
                    className="layer-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenaming(f.id);
                    }}
                  >
                    {f.name}
                  </span>
                )}
                <span className="badge">{f.nodes.length}</span>
                <button
                  className="icon-btn danger-hover"
                  title="删除框架"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`删除框架「${f.name}」？`)) deleteFrame(f.id);
                  }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>

              {open &&
                rendered.map((n, di) => {
                  // displayed reversed: render-order index = len-1-di
                  const renderIdx = f.nodes.length - 1 - di;
                  const selected = selectedNodeIds.includes(n.id);
                  return (
                    <div
                      key={n.id}
                      className={`layer-row child ${selected ? "active" : ""} ${
                        dropIdx === di && dragId ? "drop-before" : ""
                      }`}
                      style={{ opacity: n.hidden ? 0.45 : 1 }}
                      draggable={f.id === activeFrameId}
                      onDragStart={() => {
                        setActiveFrame(f.id);
                        setDragId(n.id);
                      }}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        setDropIdx(di);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId) {
                          // dropping before display-index di => render index renderIdx+ (drop above)
                          reorderNodeTo(dragId, renderIdx + 1);
                        }
                        setDragId(null);
                        setDropIdx(null);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropIdx(null);
                      }}
                      onClick={(e) =>
                        e.shiftKey ? toggleSelect(n.id) : selectNodes([n.id])
                      }
                    >
                      <span className="twisty" />
                      <span className="layer-ic muted">
                        <Icon name={nodeTypeIcon(n.type)} size={13} />
                      </span>
                      {renaming === n.id ? (
                        <RenameInput
                          value={n.name}
                          onCommit={(v) => {
                            if (v.trim()) updateNode(f.id, n.id, { name: v.trim() });
                            setRenaming(null);
                          }}
                        />
                      ) : (
                        <span
                          className="layer-name"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setRenaming(n.id);
                          }}
                        >
                          {n.name || n.type}
                          {n.componentRef && <span className="chip-mini">实例</span>}
                        </span>
                      )}
                      <button
                        className="icon-btn"
                        title={n.hidden ? "显示" : "隐藏"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHidden(n.id);
                        }}
                      >
                        <Icon name={n.hidden ? "eyeOff" : "eye"} size={13} />
                      </button>
                      <button
                        className="icon-btn"
                        title={n.locked ? "解锁" : "锁定"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLock(n.id);
                        }}
                      >
                        <Icon name={n.locked ? "lock" : "unlock"} size={13} />
                      </button>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RenameInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [v, setV] = useState(value);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="layer-rename"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(v);
        if (e.key === "Escape") onCommit(value);
      }}
    />
  );
}
