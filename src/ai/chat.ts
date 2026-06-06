import { AiSettings, PROVIDERS } from "./settings";

/**
 * Provider-agnostic plain-text chat completion.
 *
 * Returns the assistant message text. Throws if the provider needs a key but none
 * is configured (callers should guard with a local fallback first).
 */
export async function chatComplete(
  settings: AiSettings,
  system: string,
  user: string,
): Promise<string> {
  if (settings.provider === "anthropic") {
    const res = await fetch(PROVIDERS.anthropic.endpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic 错误 ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }

  const endpoint = PROVIDERS[settings.provider].endpoint;
  if (!endpoint) throw new Error("当前 Provider 不支持文本生成");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
    }),
  });
  if (!res.ok) throw new Error(`Provider 错误 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
