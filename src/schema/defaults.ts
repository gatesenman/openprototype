import { nanoid } from "nanoid";
import {
  ComponentDef,
  DesignSystem,
  Frame,
  GPO_SCHEMA_VERSION,
  GpoDocument,
  JourneyMap,
  Page,
} from "./types";

export const id = (prefix = "n") => `${prefix}_${nanoid(8)}`;

/**
 * 内置组件：新文件开箱即带的一小套基础组件（按钮/输入框/卡片/头像），
 * 这样用户无需先去组件市场安装即可在画布「插入组件」。模板与组件市场的基础包
 * 一致，但在此内联定义以避免与市场目录产生模块循环依赖。
 */
function seedComponents(): ComponentDef[] {
  return [
    {
      id: id("comp"),
      name: "主按钮",
      template: {
        id: id("grp"),
        type: "button",
        name: "主按钮",
        x: 0,
        y: 0,
        width: 160,
        height: 44,
        style: { fill: { type: "token", token: "primary" }, radius: 8 },
        text: {
          content: "主操作",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "#ffffff",
          align: "center",
        },
      },
    },
    {
      id: id("comp"),
      name: "输入框",
      template: {
        id: id("grp"),
        type: "input",
        name: "输入框",
        x: 0,
        y: 0,
        width: 280,
        height: 42,
        style: { fill: { type: "solid", color: "#ffffff" }, radius: 8, stroke: { color: "#e2e8f0", width: 1 } },
        text: {
          content: "请输入",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.4,
          color: "#64748b",
          align: "left",
        },
      },
    },
    {
      id: id("comp"),
      name: "卡片",
      template: {
        id: id("grp"),
        type: "group",
        name: "卡片",
        x: 0,
        y: 0,
        width: 320,
        height: 140,
        style: {},
        children: [
          {
            id: id(),
            type: "rect",
            name: "卡片底",
            x: 0,
            y: 0,
            width: 320,
            height: 140,
            style: {
              fill: { type: "solid", color: "#ffffff" },
              radius: 8,
              stroke: { color: "#e2e8f0", width: 1 },
              shadow: { x: 0, y: 6, blur: 18, color: "rgba(15,23,42,0.08)" },
            },
          },
        ],
      },
    },
    {
      id: id("comp"),
      name: "头像",
      template: {
        id: id("grp"),
        type: "ellipse",
        name: "头像",
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        style: { fill: { type: "solid", color: "#c7d2fe" }, radius: 999 },
      },
    },
  ];
}

export function defaultDesignSystem(): DesignSystem {
  return {
    name: "Default System",
    tokens: {
      colors: {
        primary: "#4f46e5",
        "primary-fg": "#ffffff",
        bg: "#ffffff",
        surface: "#f8fafc",
        border: "#e2e8f0",
        text: "#0f172a",
        muted: "#64748b",
        success: "#16a34a",
        danger: "#dc2626",
      },
      fonts: {
        family: "Inter, system-ui, sans-serif",
        sizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, "2xl": 36 },
      },
      radii: { sm: 4, md: 8, lg: 16, full: 999 },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      elevation: {
        sm: { x: 0, y: 1, blur: 2, color: "rgba(15,23,42,0.08)" },
        md: { x: 0, y: 4, blur: 12, color: "rgba(15,23,42,0.12)" },
        lg: { x: 0, y: 12, blur: 32, color: "rgba(15,23,42,0.16)" },
      },
    },
    components: seedComponents(),
    variables: [
      { id: id("var"), name: "brand/primary", type: "color", value: "#4f46e5", collection: "Brand" },
      { id: id("var"), name: "brand/accent", type: "color", value: "#0ea5e9", collection: "Brand" },
      { id: id("var"), name: "brand/danger", type: "color", value: "#dc2626", collection: "Brand" },
      { id: id("var"), name: "space/md", type: "number", value: 16, collection: "Spacing" },
    ],
    rules: [
      {
        id: id("rule"),
        kind: "primary-button-token",
        description: "主按钮填充必须使用 primary 颜色 token。",
      },
      {
        id: id("rule"),
        kind: "card-radius",
        value: 8,
        description: "卡片圆角统一为 8px。",
      },
      {
        id: id("rule"),
        kind: "min-tap-target",
        value: 40,
        description: "可点击元素最小高度 40px（移动端可达性）。",
      },
    ],
    systemPrompt:
      "你是一个资深产品设计师。基于给定的需求文档和设计系统 tokens 生成结构化页面元数据。" +
      "遵守设计规范：主按钮用 primary token、卡片圆角 8px、可点击元素高度≥40px。布局清晰、信息层级明确。",
  };
}

export function emptyFrame(name: string, x = 0, y = 0): Frame {
  return {
    id: id("frame"),
    name,
    x,
    y,
    width: 390,
    height: 844,
    background: "#ffffff",
    fidelity: "wireframe",
    nodes: [],
  };
}

export function emptyPage(name = "Page 1"): Page {
  return { id: id("page"), name, frames: [] };
}

/** A worked example journey so the 旅程 view is usable on first open. */
export function seedJourney(): JourneyMap {
  const now = Date.now();
  return {
    id: id("jny"),
    title: "新用户登录旅程",
    persona: {
      name: "新用户 · 小王",
      role: "首次使用产品的上班族",
      goal: "快速登录并开始使用核心功能",
      avatar: "🙋",
    },
    scenario: "用户第一次打开 App，完成登录并进入首页",
    updatedAt: now,
    stages: [
      {
        id: id("stage"),
        name: "打开 App",
        actions: ["点击图标启动", "查看启动页"],
        touchpoints: ["桌面图标", "启动页"],
        thoughts: ["希望别太麻烦"],
        emotion: 1,
        pains: ["启动加载偏慢"],
        opportunities: ["轻量首屏，先用后登"],
      },
      {
        id: id("stage"),
        name: "输入手机号",
        actions: ["填写手机号", "点击获取验证码"],
        touchpoints: ["登录页", "短信"],
        thoughts: ["怎么又要验证码"],
        emotion: -1,
        pains: ["验证码收不到", "等待时间长"],
        opportunities: ["一键登录", "语音验证码兜底"],
      },
      {
        id: id("stage"),
        name: "验证登录",
        actions: ["输入验证码", "点击登录"],
        touchpoints: ["登录页"],
        thoughts: ["快点通过吧"],
        emotion: 0,
        pains: ["输错需重新发送"],
        opportunities: ["自动读取短信验证码"],
      },
      {
        id: id("stage"),
        name: "进入首页",
        actions: ["浏览首页", "完成首个操作"],
        touchpoints: ["首页", "新手引导"],
        thoughts: ["原来这么好用"],
        emotion: 2,
        pains: ["首次价值不够直观"],
        opportunities: ["首次成功即时反馈"],
      },
    ],
  };
}

export function newDocument(name = "未命名原型"): GpoDocument {
  const now = Date.now();
  return {
    meta: {
      id: id("doc"),
      name,
      schemaVersion: GPO_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      app: "gpo-studio",
    },
    designSystem: defaultDesignSystem(),
    requirements: [
      {
        id: id("req"),
        title: "示例需求：登录页",
        markdown:
          "# 登录页\n\n## 目标\n用户用手机号 + 验证码登录。\n\n## 页面元素\n- 顶部标题「欢迎回来」\n- 手机号输入框\n- 验证码输入框 + 获取验证码按钮\n- 主按钮「登录」\n- 底部「注册新账号」链接\n\n## 交互\n- 点击「登录」跳转到首页。",
        updatedAt: now,
        generatedFrameIds: [],
      },
    ],
    pages: [emptyPage()],
    comments: [],
    journeys: [seedJourney()],
  };
}

/** Backfill fields added in later schema revisions so older docs load cleanly. */
export function normalizeDoc(doc: GpoDocument): GpoDocument {
  return { ...doc, comments: doc.comments ?? [], journeys: doc.journeys ?? [] };
}
