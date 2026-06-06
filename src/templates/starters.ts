import { GpoDocument, RequirementDoc } from "@/schema/types";
import { newDocument, emptyFrame, id } from "@/schema/defaults";

/**
 * Built-in starter templates surfaced on the Home screen.
 *
 * Each template seeds a fresh document with a standard requirement markdown and a
 * canvas frame at the right size, so a new file starts from a real structure
 * instead of a blank page.
 */
export interface StarterTemplate {
  key: string;
  name: string;
  description: string;
  /** Emoji/icon glyph shown on the card. */
  glyph: string;
  build: () => GpoDocument;
}

function reqDoc(title: string, markdown: string): RequirementDoc {
  return {
    id: id("req"),
    title,
    markdown: markdown.trim() + "\n",
    updatedAt: Date.now(),
    generatedFrameIds: [],
  };
}

function docWith(name: string, req: RequirementDoc, frame: ReturnType<typeof emptyFrame>): GpoDocument {
  const base = newDocument(name);
  base.requirements = [req];
  base.pages[0].frames = [frame];
  return base;
}

const PRD_TEMPLATE = `
# {功能名称}

## 背景与目标
简述要解决的问题、目标用户与预期收益。

## 用户故事
- 作为 <角色>，我希望 <能力>，以便 <价值>。

## 功能需求
1. 核心流程第一步…
2. 第二步…

## 页面与元素
- 顶部标题「{标题}」
- 主输入区
- 主按钮「{主操作}」

## 交互
- 点击「{主操作}」跳转到 {目标页面}。

## 非功能需求
- 性能 / 可达性 / 兼容性要求。
`;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "blank",
    name: "空白文件",
    description: "从零开始，自由发挥。",
    glyph: "✚",
    build: () => newDocument("未命名原型"),
  },
  {
    key: "mobile",
    name: "移动 App",
    description: "390×844 手机画框 + PRD 模板。",
    glyph: "📱",
    build: () =>
      docWith(
        "移动 App 原型",
        reqDoc("移动 App 需求", PRD_TEMPLATE),
        emptyFrame("首页", 0, 0),
      ),
  },
  {
    key: "web",
    name: "Web 后台",
    description: "1440×1024 桌面画框 + PRD 模板。",
    glyph: "🖥️",
    build: () => {
      const f = emptyFrame("控制台", 0, 0);
      f.width = 1440;
      f.height = 1024;
      return docWith("Web 后台原型", reqDoc("Web 后台需求", PRD_TEMPLATE), f);
    },
  },
  {
    key: "landing",
    name: "落地页",
    description: "1280×1600 长页 + 营销页结构。",
    glyph: "🚀",
    build: () => {
      const f = emptyFrame("落地页", 0, 0);
      f.width = 1280;
      f.height = 1600;
      return docWith(
        "落地页原型",
        reqDoc(
          "落地页需求",
          `# 产品落地页\n\n## 目标\n传达价值主张，引导注册/试用。\n\n## 区块\n- Hero：主标题 + 副标题 + 主 CTA\n- 功能亮点（3 列）\n- 社会证明 / 客户 logo\n- 价格方案\n- 底部 CTA + 页脚\n`,
        ),
        f,
      );
    },
  },
];
