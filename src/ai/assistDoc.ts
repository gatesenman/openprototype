import { AiSettings } from "./settings";
import { chatComplete } from "./chat";

/**
 * AI assistance for requirement markdown documents.
 *
 * Every action has a deterministic local heuristic so it works with no API key,
 * and an LLM path when a provider key is configured. The result is always a full
 * replacement markdown string for the document.
 */
export type AssistAction =
  | "draft"
  | "polish"
  | "expand"
  | "translate"
  | "summarize";

export interface AssistResult {
  markdown: string;
  source: "local" | "llm";
}

const STANDARD_SECTIONS = [
  "背景与问题",
  "目标与成功指标",
  "目标用户与场景",
  "用户故事",
  "功能需求",
  "页面与元素",
  "交互与流程",
  "非功能需求",
  "验收标准",
];

function hasHeading(md: string, title: string): boolean {
  const re = new RegExp(`^#{1,6}\\s*\\d*\\.?\\s*${title}`, "m");
  return re.test(md);
}

/** Build a full PRD scaffold from a short brief (offline). */
function localDraft(brief: string): string {
  const title = brief.trim().split(/[\n。.]/)[0].slice(0, 40) || "新功能";
  return `# 产品需求文档：${title}

## 1. 背景与问题
${brief.trim() || "（描述现状与痛点）"}

## 2. 目标与成功指标
- 目标：让用户能够${title}。
- 关键指标：转化率、完成率、留存。

## 3. 目标用户与场景
- 用户画像：（核心目标用户）
- 核心场景：用户在 <场景> 下需要 ${title}。

## 4. 用户故事
- 作为 用户，我希望 ${title}，以便 更高效地完成任务。

## 5. 功能需求
1. **核心流程**：用户进入 → 操作 → 得到结果。
2. **辅助能力**：搜索 / 筛选 / 历史记录。

## 6. 页面与元素
- 主页面：标题、主输入区、主按钮「${title}」
- 结果页面：列表 / 详情 / 空状态

## 7. 交互与流程
- 点击「${title}」→ 跳转结果页。
- 处理加载态 / 空态 / 错误态。

## 8. 非功能需求
- 性能：首屏 < 2s；可达性：符合 WCAG AA；兼容主流浏览器。

## 9. 验收标准
- [ ] 核心流程可端到端跑通。
- [ ] 异常态有明确反馈。
`;
}

/** Tidy formatting and normalize heading numbering (offline). */
function localPolish(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let prevBlank = false;
  for (let line of lines) {
    line = line.replace(/[ \t]+$/g, "");
    // normalize bullet markers to "- "
    line = line.replace(/^\s*[*•·]\s+/, "- ");
    const blank = line.trim() === "";
    if (blank && prevBlank) continue; // collapse multiple blank lines
    out.push(line);
    prevBlank = blank;
  }
  return out.join("\n").trim() + "\n";
}

/** Build a TL;DR summary from headings + first line of each section (offline). */
function localSummarize(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const points: string[] = [];
  let pendingHeading = "";
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      pendingHeading = h[1].replace(/^\d+\.?\s*/, "");
      continue;
    }
    if (line && pendingHeading) {
      const text = line.replace(/^[-*]\s*\[.\]\s*/, "").replace(/^[-*]\s*/, "");
      points.push(`- **${pendingHeading}**：${text.slice(0, 60)}`);
      pendingHeading = "";
    }
  }
  const body = points.length
    ? points.join("\n")
    : "- （文档内容较少，暂无可提炼要点）";
  return `## 摘要 (TL;DR)\n${body}\n\n---\n\n${md.trim()}\n`;
}

/** Offline translate is not possible; keep content and flag that a key is needed. */
function localTranslate(md: string): string {
  return `> 注：离线模式无法翻译，请在「AI 设置」中配置大模型 Key 后重试。\n\n${md.trim()}\n`;
}

/** Append any standard PRD sections that are missing (offline). */
function localExpand(md: string): string {
  let result = md.trimEnd();
  const missing = STANDARD_SECTIONS.filter((s) => !hasHeading(md, s));
  if (missing.length === 0) {
    result += "\n\n## 风险与依赖\n- 风险：\n- 外部依赖：\n";
    return result + "\n";
  }
  for (const s of missing) {
    result += `\n\n## ${s}\n- （补充 ${s}）`;
  }
  return result + "\n";
}

const SYSTEMS: Record<AssistAction, string> = {
  draft:
    "你是资深产品经理。根据用户给的简短想法，输出一份结构完整、专业的中文产品需求文档（PRD），" +
    "使用 Markdown，包含：背景与问题、目标与成功指标、目标用户与场景、用户故事、功能需求、页面与元素、交互与流程、非功能需求、验收标准。只输出 Markdown 正文。",
  polish:
    "你是资深产品经理兼技术写作。请在不改变原意的前提下，润色并规范化下面的需求文档：" +
    "统一标题层级与编号、修正措辞、让表达更清晰专业。只输出完整的 Markdown，不要解释。",
  expand:
    "你是资深产品经理。请在保留原有内容的基础上，补全这份需求文档缺失的标准章节（如验收标准、指标、边界情况、风险），" +
    "让其更完整可执行。只输出完整的 Markdown，不要解释。",
  translate:
    "You are a senior product manager and professional translator. Translate the following requirement document into fluent, professional English, " +
    "preserving the Markdown structure (headings, lists, tables). Output only the translated Markdown, no explanations.",
  summarize:
    "你是资深产品经理。请为下面的需求文档生成一段简洁的要点摘要（TL;DR），用 Markdown 无序列表列出最关键的 5-8 条，" +
    "并在摘要后保留原文。只输出 Markdown，不要解释。",
};

export async function assistRequirement(
  action: AssistAction,
  markdown: string,
  settings: AiSettings,
): Promise<AssistResult> {
  if (settings.provider === "local" || !settings.apiKey) {
    const local: Record<AssistAction, (md: string) => string> = {
      draft: localDraft,
      polish: localPolish,
      expand: localExpand,
      summarize: localSummarize,
      translate: localTranslate,
    };
    return { markdown: local[action](markdown), source: "local" };
  }

  const user =
    action === "draft"
      ? `想法 / 简述：\n${markdown}`
      : `需求文档：\n${markdown}`;
  let content = await chatComplete(settings, SYSTEMS[action], user);
  // strip a leading/trailing code fence if the model wrapped the answer
  content = content.replace(/^```(?:markdown)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return { markdown: content || markdown, source: "llm" };
}
