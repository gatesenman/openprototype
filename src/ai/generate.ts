import { DesignSystem, Frame, JourneyMap } from "@/schema/types";
import { applyRules, RuleViolation } from "@/designsystem/rules";
import { generateFrameFromMarkdown } from "./localGenerator";
import { generateFlowFromBrief } from "./flow";
import { coerceJourney, generateJourneyFromBrief } from "@/journey/journey";
import { AiSettings, PROVIDERS } from "./settings";
import { id } from "@/schema/defaults";

export interface GenerateResult {
  frame: Frame;
  violations: RuleViolation[];
  source: "local" | "llm";
  note?: string;
}

export type Fidelity = "wireframe" | "hifi";

function buildSystemPrompt(ds: DesignSystem, fidelity: Fidelity): string {
  return [
    ds.systemPrompt,
    `保真度: ${fidelity === "hifi" ? "高保真（套用设计系统 tokens 与配色）" : "低保真线框（灰阶、占位）"}。`,
    `设计系统 tokens: ${JSON.stringify(ds.tokens)}`,
    `设计规范: ${ds.rules.map((r) => r.description).join("; ")}`,
    "只输出一个 JSON 对象，结构为 Frame：",
    `{"name":string,"width":390,"height":844,"background":string,"fidelity":"${fidelity}","nodes":[{"type":"text|rect|button|input|image","name":string,"x":number,"y":number,"width":number,"height":number,"style":{"fill":{"type":"token","token":"primary"}|{"type":"solid","color":"#fff"},"stroke":{"color":string,"width":number},"radius":number},"text":{"content":string,"fontFamily":string,"fontSize":number,"fontWeight":number,"lineHeight":number,"color":string,"align":"left|center|right"}}]}`,
    "坐标以 390x844 移动画板为基准，纵向从上到下排布，元素不要重叠。不要输出 JSON 以外的任何文字。",
  ].join("\n");
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("模型未返回 JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

/** Normalize a loosely-typed LLM frame object into a valid Frame. */
function coerceFrame(obj: any, fidelity: Fidelity, fallbackName: string): Frame {
  const nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  return {
    id: id("frame"),
    name: typeof obj.name === "string" ? obj.name : fallbackName,
    x: 0,
    y: 0,
    width: Number(obj.width) || 390,
    height: Number(obj.height) || 844,
    background: typeof obj.background === "string" ? obj.background : "#ffffff",
    fidelity,
    nodes: nodes.map((n: any) => ({
      id: id(),
      type: ["text", "rect", "button", "input", "image", "group", "icon"].includes(
        n.type,
      )
        ? n.type
        : "rect",
      name: String(n.name ?? n.type ?? "节点"),
      x: Number(n.x) || 0,
      y: Number(n.y) || 0,
      width: Number(n.width) || 100,
      height: Number(n.height) || 40,
      style: n.style ?? {},
      text: n.text,
      meta: { aiGenerated: true },
    })),
  };
}

async function callOpenAiCompatible(
  endpoint: string,
  settings: AiSettings,
  system: string,
  user: string,
): Promise<string> {
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
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`Provider 错误 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  settings: AiSettings,
  system: string,
  user: string,
): Promise<string> {
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

/** Local heuristic fine-tune: interpret a few common Chinese/English instructions. */
function localFineTune(node: any, instruction: string, ds: DesignSystem): any {
  const t = instruction.toLowerCase();
  const n = { ...node, style: { ...node.style }, text: node.text ? { ...node.text } : node.text };
  if (/(主色|primary|品牌色)/.test(instruction)) {
    n.style.fill = { type: "token", token: "primary" };
    if (n.text) n.text.color = ds.tokens.colors["primary-fg"];
  }
  if (/(危险|删除色|红色|danger)/.test(instruction)) {
    n.style.fill = { type: "token", token: "danger" };
  }
  if (/(放大|变大|更大|bigger|larger)/.test(t)) {
    n.width = Math.round(n.width * 1.2);
    n.height = Math.round(n.height * 1.2);
    if (n.text) n.text.fontSize = Math.round((n.text.fontSize ?? 16) * 1.2);
  }
  if (/(缩小|变小|更小|smaller)/.test(t)) {
    n.width = Math.round(n.width * 0.85);
    n.height = Math.round(n.height * 0.85);
  }
  if (/(居中|center)/.test(t) && n.text) n.text.align = "center";
  if (/(圆角|radius|圆润)/.test(t)) {
    n.style.radius = ds.tokens.radii.lg;
  }
  if (/(加粗|bold|粗体)/.test(t) && n.text) n.text.fontWeight = 700;
  return n;
}

export async function fineTuneNode(
  node: any,
  instruction: string,
  ds: DesignSystem,
  settings: AiSettings,
): Promise<any> {
  if (settings.provider === "local" || !settings.apiKey) {
    return localFineTune(node, instruction, ds);
  }
  const system =
    "你是 UI 编辑助手。给定一个节点 JSON 和一条修改指令，只返回修改后的完整节点 JSON（同样字段结构），不要输出多余文字。" +
    `可用颜色 tokens: ${Object.keys(ds.tokens.colors).join(", ")}。`;
  const user = `节点:\n${JSON.stringify(node)}\n指令: ${instruction}`;
  let content: string;
  if (settings.provider === "anthropic") {
    content = await callAnthropic(settings, system, user);
  } else {
    content = await callOpenAiCompatible(PROVIDERS[settings.provider].endpoint!, settings, system, user);
  }
  const obj = extractJson(content);
  return { ...node, ...obj, id: node.id };
}

export async function generatePage(
  markdown: string,
  ds: DesignSystem,
  settings: AiSettings,
  fidelity: Fidelity,
  frameName?: string,
): Promise<GenerateResult> {
  // Local heuristic path — always available, no key needed.
  if (settings.provider === "local" || !settings.apiKey) {
    const frame = generateFrameFromMarkdown(markdown, ds, fidelity, frameName);
    const { frame: fixed, violations } = applyRules(frame, ds);
    return {
      frame: fixed,
      violations,
      source: "local",
      note:
        settings.provider !== "local"
          ? "未配置 API Key，已使用本地生成器。"
          : undefined,
    };
  }

  const system = buildSystemPrompt(ds, fidelity);
  const user = `需求文档：\n${markdown}`;
  let content: string;
  if (settings.provider === "anthropic") {
    content = await callAnthropic(settings, system, user);
  } else {
    const endpoint = PROVIDERS[settings.provider].endpoint!;
    content = await callOpenAiCompatible(endpoint, settings, system, user);
  }
  const obj = extractJson(content);
  const frame = coerceFrame(obj, fidelity, frameName ?? "页面");
  const { frame: fixed, violations } = applyRules(frame, ds);
  return { frame: fixed, violations, source: "llm" };
}

export interface FlowGenerateResult {
  kind: string;
  /** Linked screens, each already validated/auto-fixed against the rules. */
  frames: Frame[];
  links: number;
  violations: RuleViolation[];
  source: "local";
}

/**
 * Generate a multi-screen, auto-wired prototype flow from a brief.
 *
 * Uses the offline heuristic planner so it always works with no API key; the
 * frames carry forward-navigation interactions that render as arrows in Flows.
 */
export async function generateFlow(
  brief: string,
  ds: DesignSystem,
  fidelity: Fidelity,
): Promise<FlowGenerateResult> {
  const { kind, frames, links } = generateFlowFromBrief(brief, ds, fidelity);
  const violations: RuleViolation[] = [];
  const fixedFrames = frames.map((f) => {
    const { frame, violations: v } = applyRules(f, ds);
    violations.push(...v);
    // applyRules returns a fresh frame; keep the original id so interactions
    // (which target these ids) stay valid.
    return { ...frame, id: f.id };
  });
  return { kind, frames: fixedFrames, links, violations, source: "local" };
}

export interface JourneyGenerateResult {
  journey: JourneyMap;
  source: "local" | "llm";
  note?: string;
}

/**
 * Generate a user-journey map from a free-text brief.
 *
 * With no key configured we use the offline heuristic planner (always works).
 * With a provider key we ask the model for a structured JourneyMap JSON and
 * coerce it into the schema, falling back to the heuristic on any error.
 */
export async function generateJourney(
  brief: string,
  settings: AiSettings,
): Promise<JourneyGenerateResult> {
  if (settings.provider === "local" || !settings.apiKey) {
    return {
      journey: generateJourneyFromBrief(brief),
      source: "local",
      note: settings.provider !== "local" ? "未配置 API Key，已使用本地生成器。" : undefined,
    };
  }

  const system = [
    "你是资深用户体验研究员。基于给定的产品/场景描述，输出一份用户旅程地图。",
    "只输出一个 JSON 对象，结构如下，不要输出 JSON 以外的任何文字：",
    `{"title":string,"persona":{"name":string,"role":string,"goal":string,"avatar":"单个emoji"},"scenario":string,"stages":[{"name":string,"actions":[string],"touchpoints":[string],"thoughts":[string],"emotion":-2到2的整数,"pains":[string],"opportunities":[string]}]}`,
    "阶段数量 4-6 个，按时间顺序；emotion 反映该阶段用户情绪（-2 极差，2 极好）。中文输出。",
  ].join("\n");
  const user = `产品/场景描述：\n${brief}`;
  try {
    let content: string;
    if (settings.provider === "anthropic") {
      content = await callAnthropic(settings, system, user);
    } else {
      content = await callOpenAiCompatible(PROVIDERS[settings.provider].endpoint!, settings, system, user);
    }
    const obj = extractJson(content);
    return { journey: coerceJourney(obj, "AI 旅程地图"), source: "llm" };
  } catch (e) {
    return {
      journey: generateJourneyFromBrief(brief),
      source: "local",
      note: `模型调用失败，已回退本地生成器：${(e as Error).message}`,
    };
  }
}
