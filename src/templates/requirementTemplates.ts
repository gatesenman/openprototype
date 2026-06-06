/**
 * Built-in standard requirement-document templates.
 *
 * These are inserted into the requirement markdown editor so a doc starts from an
 * industry-standard structure (PRD, feature spec, user story, etc.) instead of a
 * blank page. The AI-assist actions in `assistDoc.ts` build on the same sections.
 */
export interface RequirementTemplate {
  key: string;
  name: string;
  description: string;
  markdown: string;
}

export const REQUIREMENT_TEMPLATES: RequirementTemplate[] = [
  {
    key: "prd",
    name: "产品需求文档 (PRD)",
    description: "完整 PRD：背景、目标、用户故事、功能、交互、指标。",
    markdown: `# 产品需求文档：{功能名称}

## 1. 背景与问题
- 现状 / 痛点：
- 机会 / 为什么现在做：

## 2. 目标与成功指标
- 目标：
- 关键指标 (北极星 / 转化 / 留存)：

## 3. 目标用户与场景
- 用户画像：
- 核心使用场景：

## 4. 用户故事
- 作为 <角色>，我希望 <能力>，以便 <价值>。

## 5. 功能需求
1. **{模块一}**：描述…
2. **{模块二}**：描述…

## 6. 页面与元素
- 页面 A：标题、主输入、主按钮「{主操作}」
- 页面 B：…

## 7. 交互与流程
- 点击「{主操作}」→ 跳转「{目标页面}」
- 异常 / 空 / 加载态：

## 8. 非功能需求
- 性能 / 可达性 / 兼容性 / 安全：

## 9. 验收标准
- [ ] 标准一
- [ ] 标准二

## 10. 里程碑与排期
- M1：
- M2：`,
  },
  {
    key: "feature",
    name: "功能规格 (Feature Spec)",
    description: "单功能聚焦：问题、方案、边界、验收。",
    markdown: `# 功能规格：{功能名称}

## 问题陈述
要解决什么、为谁解决。

## 方案概述
一句话方案 + 关键设计点。

## 详细行为
- 正常流程：
- 边界 / 异常：
- 空状态 / 加载 / 错误：

## 涉及页面与元素
- …

## 埋点与指标
- 事件：
- 指标：

## 验收标准
- [ ] …`,
  },
  {
    key: "story",
    name: "用户故事集 (User Stories)",
    description: "敏捷用户故事 + 验收条件 (Given/When/Then)。",
    markdown: `# 用户故事：{主题}

## Epic
作为 <角色>，我希望 <宏观目标>，以便 <价值>。

## Story 1
作为 <角色>，我希望 <能力>，以便 <价值>。
**验收条件**
- Given <前置>，When <操作>，Then <结果>。

## Story 2
作为 <角色>，我希望 <能力>，以便 <价值>。
**验收条件**
- Given …，When …，Then …。`,
  },
  {
    key: "competitive",
    name: "竞品分析 (Competitive Analysis)",
    description: "对比竞品、找差异化机会。",
    markdown: `# 竞品分析：{品类}

## 分析目标
我们想验证 / 学习什么。

## 竞品对比
| 维度 | 竞品 A | 竞品 B | 我们 |
| --- | --- | --- | --- |
| 核心定位 | | | |
| 关键功能 | | | |
| 定价 | | | |
| 体验亮点 | | | |
| 短板 | | | |

## 机会与差异化
- 机会点：
- 我们的差异化策略：`,
  },
];
