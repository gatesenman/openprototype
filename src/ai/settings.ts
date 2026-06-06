export type ProviderId = "local" | "openai" | "anthropic" | "deepseek";

export interface AiSettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

export const PROVIDERS: Record<
  ProviderId,
  { label: string; defaultModel: string; needsKey: boolean; endpoint?: string }
> = {
  local: {
    label: "本地启发式生成器（无需 Key）",
    defaultModel: "heuristic-v1",
    needsKey: false,
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    needsKey: true,
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    defaultModel: "claude-3-5-sonnet-latest",
    needsKey: true,
    endpoint: "https://api.anthropic.com/v1/messages",
  },
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    needsKey: true,
    endpoint: "https://api.deepseek.com/v1/chat/completions",
  },
};

const STORAGE_KEY = "gpo.ai.settings";

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AiSettings;
  } catch {
    /* ignore */
  }
  return { provider: "local", apiKey: "", model: PROVIDERS.local.defaultModel };
}

export function saveAiSettings(s: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
