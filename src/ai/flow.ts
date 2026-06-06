import { DesignSystem, Frame, Interaction, Node } from "@/schema/types";
import { id } from "@/schema/defaults";
import { generateFrameFromMarkdown } from "./localGenerator";

/**
 * Multi-screen flow generator (offline heuristic).
 *
 * Turns a single product brief into a small set of linked screens and
 * auto-wires prototype navigation (interactions) between them, so the
 * "describe an app -> get a clickable multi-page flow" loop works with
 * no API key. Real LLM providers can emit the same Frame[] shape.
 */

interface ScreenSpec {
  /** Screen title (becomes the markdown H1 / frame name). */
  title: string;
  /** Bullet items describing the screen's elements. */
  items: string[];
  /** Label hint used to pick the node that navigates to the next screen. */
  forwardHint?: string;
}

interface FlowPlan {
  kind: string;
  screens: ScreenSpec[];
}

/** Pick a small, sensible screen plan from keywords in the brief. */
function planScreens(brief: string): FlowPlan {
  const b = brief.toLowerCase();
  const has = (re: RegExp) => re.test(brief) || re.test(b);

  if (has(/(电商|商城|购物|商品|下单|店铺|shop|commerce|store|cart)/)) {
    return {
      kind: "电商购物流程",
      screens: [
        {
          title: "商品列表",
          items: ["搜索框", "分类筛选", "商品卡片：图片", "商品卡片：标题与价格", "查看详情按钮"],
          forwardHint: "查看详情",
        },
        {
          title: "商品详情",
          items: ["商品图片", "商品标题", "价格", "规格选择", "加入购物车按钮"],
          forwardHint: "加入购物车",
        },
        {
          title: "购物车",
          items: ["已选商品列表", "数量调整", "合计金额", "去结算按钮"],
          forwardHint: "去结算",
        },
        {
          title: "结算",
          items: ["收货地址", "支付方式", "订单金额", "提交订单按钮"],
        },
      ],
    };
  }

  if (has(/(登录|注册|signin|signup|login|register|账号|认证)/)) {
    return {
      kind: "登录注册流程",
      screens: [
        {
          title: "登录",
          items: ["顶部标题「欢迎回来」", "手机号输入框", "密码输入框", "登录按钮", "注册新账号链接"],
          forwardHint: "登录",
        },
        {
          title: "首页",
          items: ["顶部欢迎语", "功能入口卡片", "最近动态列表", "进入设置按钮"],
          forwardHint: "进入设置",
        },
        {
          title: "设置",
          items: ["个人资料", "通知开关", "隐私设置", "退出登录按钮"],
        },
      ],
    };
  }

  if (has(/(社交|聊天|动态|feed|社区|消息|im)/)) {
    return {
      kind: "社交动态流程",
      screens: [
        {
          title: "动态流",
          items: ["顶部标题", "发布动态按钮", "动态卡片：头像与昵称", "动态卡片：图片", "查看详情按钮"],
          forwardHint: "查看详情",
        },
        {
          title: "动态详情",
          items: ["作者信息", "正文内容", "配图", "评论列表", "发表评论输入框"],
        },
      ],
    };
  }

  // Generic 3-screen app flow.
  const subject = brief.replace(/\s+/g, "").slice(0, 12) || "应用";
  return {
    kind: "通用应用流程",
    screens: [
      {
        title: `${subject}首页`,
        items: ["顶部标题", "搜索框", "内容列表项", "查看详情按钮"],
        forwardHint: "查看详情",
      },
      {
        title: "详情页",
        items: ["标题", "封面图片", "正文内容", "下一步按钮"],
        forwardHint: "下一步",
      },
      {
        title: "完成页",
        items: ["成功图标", "完成提示文案", "返回首页按钮"],
      },
    ],
  };
}

function specToMarkdown(spec: ScreenSpec): string {
  return [`# ${spec.title}`, "", ...spec.items.map((i) => `- ${i}`)].join("\n");
}

/** Choose the node within a frame that should navigate forward. */
function pickForwardNode(frame: Frame, hint?: string): Node | undefined {
  const buttons = frame.nodes.filter((n) => n.type === "button");
  if (buttons.length === 0) return undefined;
  if (hint) {
    const matched = buttons.find((n) => n.name.includes(hint) || n.text?.content.includes(hint));
    if (matched) return matched;
  }
  // Otherwise the last button (typically the primary CTA at the bottom).
  return buttons[buttons.length - 1];
}

export interface FlowResult {
  kind: string;
  frames: Frame[];
  /** Number of auto-created navigation links. */
  links: number;
}

/**
 * Generate a linked multi-screen flow from a brief.
 *
 * Each screen (except the last) gets a forward navigation interaction on its
 * primary CTA pointing at the next screen, producing arrows in the Flows view.
 */
export function generateFlowFromBrief(
  brief: string,
  ds: DesignSystem,
  fidelity: "wireframe" | "hifi" = "hifi",
): FlowResult {
  const plan = planScreens(brief);
  const frames: Frame[] = plan.screens.map((spec) =>
    generateFrameFromMarkdown(specToMarkdown(spec), ds, fidelity, spec.title),
  );

  let links = 0;
  for (let i = 0; i < frames.length - 1; i++) {
    const fwd = pickForwardNode(frames[i], plan.screens[i].forwardHint);
    if (!fwd) continue;
    const interaction: Interaction = {
      id: id("act"),
      trigger: "click",
      targetFrameId: frames[i + 1].id,
      animation: "slide-left",
    };
    fwd.interactions = [...(fwd.interactions ?? []), interaction];
    links++;
  }

  return { kind: plan.kind, frames, links };
}
