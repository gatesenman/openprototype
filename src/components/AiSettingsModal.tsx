import { useState } from "react";
import { useUi } from "@/store/useUi";
import { PROVIDERS, ProviderId } from "@/ai/settings";

export default function AiSettingsModal({ onClose }: { onClose: () => void }) {
  const ai = useUi((s) => s.ai);
  const setAi = useUi((s) => s.setAi);
  const showToast = useUi((s) => s.showToast);

  const [provider, setProvider] = useState<ProviderId>(ai.provider);
  const [apiKey, setApiKey] = useState(ai.apiKey);
  const [model, setModel] = useState(ai.model);

  const onProviderChange = (p: ProviderId) => {
    setProvider(p);
    setModel(PROVIDERS[p].defaultModel);
  };

  const save = () => {
    setAi({ provider, apiKey, model });
    showToast("AI 设置已保存");
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>AI / 大模型设置</h2>
        <div className="field">
          <label>Provider</label>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as ProviderId)}
          >
            {Object.entries(PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>模型</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        {PROVIDERS[provider].needsKey && (
          <div className="field">
            <label>API Key（仅保存在本地浏览器）</label>
            <input
              type="password"
              value={apiKey}
              placeholder="sk-..."
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}
        {provider === "local" && (
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            本地启发式生成器无需联网/Key，直接把需求文档解析为可编辑页面。
            配置真实 Provider 后将由大模型生成更高质量的结构。
          </p>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
