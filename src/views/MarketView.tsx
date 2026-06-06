import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { COMPONENT_PACKAGES, PLUGINS } from "@/market/catalog";
import { id } from "@/schema/defaults";

export default function MarketView() {
  const [tab, setTab] = useState<"components" | "plugins">("components");
  const [category, setCategory] = useState<string>("全部");
  const doc = useStore((s) => s.doc);
  const ds = doc.designSystem;
  const activeFrameId = useStore((s) => s.activeFrameId);
  const addComponent = useStore((s) => s.addComponent);
  const updateDesignSystem = useStore((s) => s.updateDesignSystem);
  const updateNode = useStore((s) => s.updateNode);
  const setDoc = useStore((s) => s.setDoc);
  const showToast = useUi((s) => s.showToast);

  const installed = new Set(ds.components.map((c) => c.name));

  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(COMPONENT_PACKAGES.map((p) => p.category)))],
    [],
  );
  const visiblePackages = COMPONENT_PACKAGES.filter(
    (p) => category === "全部" || p.category === category,
  );

  return (
    <div className="market">
      <div className="market-tabs">
        <button className={`tab ${tab === "components" ? "active" : ""}`} onClick={() => setTab("components")}>
          组件市场
        </button>
        <button className={`tab ${tab === "plugins" ? "active" : ""}`} onClick={() => setTab("plugins")}>
          插件市场
        </button>
        <div className="spacer" />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          已安装组件 {ds.components.length} 个
        </span>
      </div>

      {tab === "components" ? (
        <>
          <div className="market-filters">
            {categories.map((c) => (
              <button
                key={c}
                className={`chip ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="market-grid">
          {visiblePackages.map((pkg) => (
            <div className="market-card" key={pkg.id}>
              <div className="market-card-head">
                <strong>{pkg.name}</strong>
                <span className="badge">{pkg.category}</span>
              </div>
              <p>{pkg.description}</p>
              <button
                className="btn primary"
                disabled={installed.has(pkg.name)}
                onClick={() => {
                  addComponent({ id: id("comp"), name: pkg.name, template: pkg.build(ds) });
                  showToast(`已安装组件「${pkg.name}」，可在设计页「插入组件」使用`);
                }}
              >
                {installed.has(pkg.name) ? "已安装" : "安装到设计系统"}
              </button>
            </div>
          ))}
          </div>
        </>
      ) : (
        <div className="market-grid">
          {PLUGINS.map((p) => (
            <div className="market-card" key={p.id}>
              <div className="market-card-head">
                <strong>{p.name}</strong>
                <span className="badge">{p.category ?? p.author}</span>
              </div>
              <p>{p.description}</p>
              <div className="plugin-meta">
                <span className="badge ghost">v{p.version} · API {p.apiVersion}</span>
                <span className="badge ghost">{p.author}</span>
                {(p.permissions ?? []).map((perm) => (
                  <span className="badge perm" key={perm} title="插件声明的能力（权限）">
                    {perm}
                  </span>
                ))}
              </div>
              <button
                className="btn primary"
                onClick={() => {
                  const msg = p.run({
                    doc: useStore.getState().doc,
                    activeFrameId,
                    updateDesignSystem,
                    updateNode,
                    addComponent,
                    setDoc,
                  });
                  showToast(`插件「${p.name}」：${msg}`);
                }}
              >
                运行插件
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
