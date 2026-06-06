import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import Icon from "@/components/Icon";

/** Asset library: the design-system component catalogue, de-duplicated by
 *  name. Clicking an asset instantiates it into the active frame. */
export default function AssetsPanel({ onClose }: { onClose: () => void }) {
  const components = useStore((s) => s.doc.designSystem.components);
  const activeFrameId = useStore((s) => s.activeFrameId);
  const instantiateComponent = useStore((s) => s.instantiateComponent);
  const renameComponent = useStore((s) => s.renameComponent);
  const deleteComponent = useStore((s) => s.deleteComponent);
  const showToast = useUi((s) => s.showToast);
  const [query, setQuery] = useState("");

  // De-duplicate by name: keep the first definition, count the duplicates.
  const assets = useMemo(() => {
    const byName = new Map<string, { id: string; name: string; count: number }>();
    for (const c of components) {
      const ex = byName.get(c.name);
      if (ex) ex.count += 1;
      else byName.set(c.name, { id: c.id, name: c.name, count: 1 });
    }
    return [...byName.values()].filter((a) =>
      query.trim() ? a.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
    );
  }, [components, query]);

  const insert = (id: string, name: string) => {
    if (!activeFrameId) {
      showToast("请先选中一个框架再插入组件", 3000);
      return;
    }
    instantiateComponent(id);
    showToast(`已插入组件「${name}」`);
  };

  return (
    <div className="assets-panel">
      <div className="assets-panel-head">
        <strong><Icon name="assets" size={14} /> 资产 · 组件库</strong>
        <button className="btn" style={{ marginLeft: "auto", padding: "2px 8px" }} onClick={onClose}>
          ✕
        </button>
      </div>
      <input
        className="comments-search"
        placeholder="搜索组件名…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {assets.length === 0 ? (
        <div className="assets-empty">
          还没有组件。选中节点后右键「创建为组件」，或在「市场」安装。
        </div>
      ) : (
        <div className="assets-grid">
          {assets.map((a) => (
            <div key={a.id} className="asset-card" title={`插入「${a.name}」`}>
              <button className="asset-thumb" onClick={() => insert(a.id, a.name)}>
                <Icon name="component" size={22} />
              </button>
              <div className="asset-meta">
                <span className="asset-name">{a.name}</span>
                {a.count > 1 && <span className="asset-count">×{a.count}</span>}
              </div>
              <div className="asset-actions">
                <button
                  title="重命名"
                  onClick={() => {
                    const n = prompt("组件名称：", a.name);
                    if (n && n !== a.name) renameComponent(a.id, n);
                  }}
                >
                  <Icon name="edit" size={12} />
                </button>
                <button
                  title="删除组件"
                  onClick={() => {
                    if (confirm(`删除组件「${a.name}」？已放入画布的实例不受影响。`))
                      deleteComponent(a.id);
                  }}
                >
                  <Icon name="trash" size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
