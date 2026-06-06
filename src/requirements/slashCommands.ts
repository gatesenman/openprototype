import { AssistAction } from "@/ai/assistDoc";
import type { IconName } from "@/components/Icon";

/**
 * 需求编辑器的「/」斜杠命令库。
 *
 * 输入 `/` 即弹出命令面板：`insert` 类命令把标准 Markdown 片段插入光标处
 * （标题 / 列表 / 待办 / 表格 / 用户故事 / 接口 / 数据模型 等）；`ai` 类命令
 * 触发 AI 辅助（草拟 / 润色 / 扩写 / 翻译 / 总结）。
 *
 * 命令按 {@link SlashGroup} 分组，面板内带分组标题、图标与快捷提示，支持模糊搜索。
 */
export type SlashGroup = "basic" | "doc" | "data" | "ai";

export interface SlashCommand {
  key: string;
  title: string;
  hint: string;
  group: SlashGroup;
  kind: "insert" | "ai";
  icon: IconName;
  /** insert 命令插入的 Markdown 片段。 */
  insert?: string;
  /** ai 命令对应的辅助动作。 */
  action?: AssistAction;
}

/** 分组在面板中的显示顺序与标题。 */
export const SLASH_GROUPS: { id: SlashGroup; label: string }[] = [
  { id: "basic", label: "基础块" },
  { id: "doc", label: "产品文档" },
  { id: "data", label: "数据与接口" },
  { id: "ai", label: "AI 辅助" },
];

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── 基础块 ──────────────────────────────────────────────
  {
    key: "text",
    title: "正文段落",
    hint: "插入一段普通文本",
    group: "basic",
    kind: "insert",
    icon: "text",
    insert: "在此输入正文…\n\n",
  },
  {
    key: "h1",
    title: "标题 1",
    hint: "一级标题 #",
    group: "basic",
    kind: "insert",
    icon: "text",
    insert: "# 标题\n\n",
  },
  {
    key: "h2",
    title: "标题 2",
    hint: "二级标题 ##",
    group: "basic",
    kind: "insert",
    icon: "text",
    insert: "## 标题\n\n",
  },
  {
    key: "h3",
    title: "标题 3",
    hint: "三级标题 ###",
    group: "basic",
    kind: "insert",
    icon: "text",
    insert: "### 标题\n\n",
  },
  {
    key: "bullet",
    title: "无序列表",
    hint: "圆点列表项",
    group: "basic",
    kind: "insert",
    icon: "list",
    insert: "- 列表项\n- 列表项\n\n",
  },
  {
    key: "number",
    title: "有序列表",
    hint: "数字编号列表",
    group: "basic",
    kind: "insert",
    icon: "list",
    insert: "1. 第一项\n2. 第二项\n3. 第三项\n\n",
  },
  {
    key: "todo",
    title: "待办清单",
    hint: "可勾选的复选项",
    group: "basic",
    kind: "insert",
    icon: "list",
    insert: "- [ ] 待办项\n- [ ] 待办项\n\n",
  },
  {
    key: "quote",
    title: "引用",
    hint: "插入引用块",
    group: "basic",
    kind: "insert",
    icon: "comment",
    insert: "> 引用内容\n\n",
  },
  {
    key: "callout",
    title: "提示框",
    hint: "重点提示 / 注意事项",
    group: "basic",
    kind: "insert",
    icon: "sparkles",
    insert: "> **💡 提示**：在此填写需要强调的内容。\n\n",
  },
  {
    key: "code",
    title: "代码块",
    hint: "插入围栏代码块",
    group: "basic",
    kind: "insert",
    icon: "more",
    insert: "```\n// 代码\n```\n\n",
  },
  {
    key: "divider",
    title: "分隔线",
    hint: "插入一条水平分隔线",
    group: "basic",
    kind: "insert",
    icon: "minus",
    insert: "\n---\n\n",
  },
  {
    key: "image",
    title: "图片",
    hint: "插入图片占位",
    group: "basic",
    kind: "insert",
    icon: "image",
    insert: "![描述](图片地址)\n\n",
  },

  // ── 产品文档 ────────────────────────────────────────────
  {
    key: "goal",
    title: "目标与背景",
    hint: "问题 / 目标用户 / 价值",
    group: "doc",
    kind: "insert",
    icon: "sparkles",
    insert: "## 目标与背景\n描述要解决的问题、目标用户与价值。\n\n",
  },
  {
    key: "story",
    title: "用户故事",
    hint: "作为…我希望…以便…",
    group: "doc",
    kind: "insert",
    icon: "edit",
    insert: "- 作为 <角色>，我希望 <目标>，以便 <价值>。\n",
  },
  {
    key: "acceptance",
    title: "验收标准",
    hint: "可勾选的验收清单",
    group: "doc",
    kind: "insert",
    icon: "list",
    insert: "## 验收标准\n- [ ] 标准一\n- [ ] 标准二\n- [ ] 标准三\n\n",
  },
  {
    key: "elements",
    title: "页面元素",
    hint: "供 AI 生成的元素清单",
    group: "doc",
    kind: "insert",
    icon: "frame",
    insert: "## 页面元素\n- 顶部标题\n- 主输入框\n- 主操作按钮\n\n",
  },
  {
    key: "flow",
    title: "交互流程",
    hint: "步骤 / 跳转流程",
    group: "doc",
    kind: "insert",
    icon: "flow",
    insert: "## 交互流程\n1. 用户进入页面 → ……\n2. 点击主按钮 → 跳转到 ……\n\n",
  },
  {
    key: "metrics",
    title: "成功指标",
    hint: "可量化的成功指标",
    group: "doc",
    kind: "insert",
    icon: "list",
    insert: "## 成功指标\n- 北极星指标：……\n- 转化率：……\n- 留存：……\n\n",
  },
  {
    key: "risks",
    title: "风险与依赖",
    hint: "风险 / 外部依赖",
    group: "doc",
    kind: "insert",
    icon: "comment",
    insert: "## 风险与依赖\n- 风险：……（缓解措施：……）\n- 依赖：……\n\n",
  },
  {
    key: "milestones",
    title: "里程碑",
    hint: "阶段排期表",
    group: "doc",
    kind: "insert",
    icon: "list",
    insert:
      "## 里程碑\n| 阶段 | 交付物 | 时间 |\n| --- | --- | --- |\n| M1 |  |  |\n| M2 |  |  |\n\n",
  },

  // ── 数据与接口 ──────────────────────────────────────────
  {
    key: "table",
    title: "表格",
    hint: "3 列 Markdown 表格",
    group: "data",
    kind: "insert",
    icon: "grid",
    insert: "| 字段 | 说明 | 备注 |\n| --- | --- | --- |\n|  |  |  |\n\n",
  },
  {
    key: "datamodel",
    title: "数据模型",
    hint: "字段 / 类型 / 约束表",
    group: "data",
    kind: "insert",
    icon: "grid",
    insert:
      "## 数据模型\n| 字段 | 类型 | 必填 | 说明 |\n| --- | --- | --- | --- |\n| id | string | 是 | 主键 |\n| name | string | 是 |  |\n\n",
  },
  {
    key: "api",
    title: "接口定义",
    hint: "REST 接口请求 / 响应",
    group: "data",
    kind: "insert",
    icon: "more",
    insert:
      "## 接口：GET /api/resource\n**请求参数**\n| 参数 | 类型 | 说明 |\n| --- | --- | --- |\n|  |  |  |\n\n**响应**\n```json\n{\n  \"code\": 0,\n  \"data\": {}\n}\n```\n\n",
  },
  {
    key: "states",
    title: "状态枚举",
    hint: "状态 / 含义对照表",
    group: "data",
    kind: "insert",
    icon: "list",
    insert:
      "## 状态枚举\n| 状态 | 值 | 含义 |\n| --- | --- | --- |\n| 待处理 | pending |  |\n| 已完成 | done |  |\n\n",
  },

  // ── AI 辅助 ─────────────────────────────────────────────
  {
    key: "ai-draft",
    title: "AI 草拟 PRD",
    hint: "根据现有内容生成完整 PRD",
    group: "ai",
    kind: "ai",
    icon: "sparkles",
    action: "draft",
  },
  {
    key: "ai-polish",
    title: "AI 润色 / 规范化",
    hint: "优化措辞与结构",
    group: "ai",
    kind: "ai",
    icon: "edit",
    action: "polish",
  },
  {
    key: "ai-expand",
    title: "AI 扩写 / 补全",
    hint: "补全缺失章节",
    group: "ai",
    kind: "ai",
    icon: "plus",
    action: "expand",
  },
  {
    key: "ai-translate",
    title: "AI 翻译为英文",
    hint: "整篇翻译为英文",
    group: "ai",
    kind: "ai",
    icon: "sparkles",
    action: "translate",
  },
  {
    key: "ai-summarize",
    title: "AI 摘要 / TL;DR",
    hint: "生成要点摘要",
    group: "ai",
    kind: "ai",
    icon: "list",
    action: "summarize",
  },
];

/** 根据查询词过滤命令（匹配标题 / key / 提示，大小写不敏感）。 */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.key.toLowerCase().includes(q) ||
      c.hint.toLowerCase().includes(q),
  );
}

/**
 * 过滤后按分组组织，便于面板渲染分组标题。空分组会被剔除，分组顺序遵循
 * {@link SLASH_GROUPS}。
 */
export function groupedSlashCommands(
  query: string,
): { id: SlashGroup; label: string; commands: SlashCommand[] }[] {
  const matched = filterSlashCommands(query);
  return SLASH_GROUPS.map((g) => ({
    ...g,
    commands: matched.filter((c) => c.group === g.id),
  })).filter((g) => g.commands.length > 0);
}

/**
 * 检测 textarea 中光标前是否存在一个待匹配的「/查询」触发串。
 *
 * 规则：从光标位置向前找到最近的 `/`，要求 `/` 与光标之间不含空格/换行，且 `/`
 * 之前是字符串开头或空白/换行（避免把 URL 里的 `/` 误判为命令）。
 *
 * @returns `{ start, query }`，其中 `start` 是 `/` 的下标；无匹配返回 null。
 */
export function detectSlash(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === "\n" || ch === " ") return null;
    if (ch === "/") {
      const before = i === 0 ? "" : value[i - 1];
      if (before === "" || before === "\n" || before === " ") {
        return { start: i, query: value.slice(i + 1, caret) };
      }
      return null;
    }
  }
  return null;
}
