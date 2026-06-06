import { JourneyEmotion, JourneyMap, JourneyStage } from "@/schema/types";
import { id } from "@/schema/defaults";

/**
 * User-journey map domain logic (framework-free, fully unit-tested).
 *
 * A journey map is a persona + an ordered list of stages. Each stage carries
 * the user's actions, touchpoints, thoughts, an emotion score (-2..2) and the
 * pains / opportunities at that step. The emotion scores form a curve that is
 * the heart of the artifact — `emotionCurvePath` turns them into an SVG path.
 */

/** The seven rows rendered in the journey matrix, in display order. */
export const JOURNEY_ROWS = [
  "actions",
  "touchpoints",
  "thoughts",
  "emotion",
  "pains",
  "opportunities",
] as const;
export type JourneyRow = (typeof JOURNEY_ROWS)[number];

/** List-valued rows (everything except the emotion curve). */
export type JourneyListRow = Exclude<JourneyRow, "emotion">;

export const ROW_META: Record<JourneyRow, { label: string; hint: string }> = {
  actions: { label: "用户行为", hint: "用户在这一阶段做了什么" },
  touchpoints: { label: "触点 / 渠道", hint: "用户接触产品的方式（App / 客服 / 邮件…）" },
  thoughts: { label: "想法 / 心声", hint: "用户此刻在想什么" },
  emotion: { label: "情绪曲线", hint: "用户的情绪起伏（点击节点调整）" },
  pains: { label: "痛点", hint: "遇到的障碍与负面体验" },
  opportunities: { label: "机会点", hint: "可改进 / 创新的机会" },
};

export const EMOTION_LABELS: Record<JourneyEmotion, string> = {
  [-2]: "非常沮丧",
  [-1]: "略有不满",
  0: "中性",
  1: "比较满意",
  2: "非常满意",
};

export const EMOTION_EMOJI: Record<JourneyEmotion, string> = {
  [-2]: "😣",
  [-1]: "🙁",
  0: "😐",
  1: "🙂",
  2: "😄",
};

export function clampEmotion(v: number): JourneyEmotion {
  const r = Math.max(-2, Math.min(2, Math.round(v)));
  return r as JourneyEmotion;
}

export function emptyStage(name = "新阶段"): JourneyStage {
  return {
    id: id("stage"),
    name,
    actions: [],
    touchpoints: [],
    thoughts: [],
    emotion: 0,
    pains: [],
    opportunities: [],
  };
}

/** A blank journey with a single starter stage. */
export function emptyJourney(title = "新建旅程地图"): JourneyMap {
  return {
    id: id("jny"),
    title,
    persona: { name: "目标用户", role: "", goal: "", avatar: "🙂" },
    scenario: "",
    stages: [emptyStage("阶段 1")],
    updatedAt: Date.now(),
  };
}

/**
 * Build an SVG polyline/curve path string for the emotion scores.
 *
 * Columns are centered in equal-width slots across `width`; the score range
 * (-2..2) maps to vertical positions inside [padY, height-padY]. Uses smooth
 * Catmull-Rom→bezier so the curve reads like a real emotion graph.
 */
export function emotionCurvePath(
  emotions: number[],
  width: number,
  height: number,
  padY = 14,
): string {
  const pts = emotionPoints(emotions, width, height, padY);
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** The pixel position of each emotion node (column-centered). */
export function emotionPoints(
  emotions: number[],
  width: number,
  height: number,
  padY = 14,
): { x: number; y: number }[] {
  const n = emotions.length;
  if (n === 0) return [];
  const slot = width / n;
  const usable = height - padY * 2;
  return emotions.map((e, i) => {
    const x = slot * i + slot / 2;
    // emotion 2 -> top (padY), -2 -> bottom (height-padY)
    const t = (2 - clampEmotion(e)) / 4; // 0..1
    const y = padY + t * usable;
    return { x, y };
  });
}

/** Average emotion across stages, rounded to one decimal. */
export function averageEmotion(stages: JourneyStage[]): number {
  if (stages.length === 0) return 0;
  const sum = stages.reduce((a, s) => a + clampEmotion(s.emotion), 0);
  return Math.round((sum / stages.length) * 10) / 10;
}

/** Total counted pain points across all stages. */
export function countPains(journey: JourneyMap): number {
  return journey.stages.reduce((a, s) => a + s.pains.length, 0);
}

/** Total opportunities across all stages. */
export function countOpportunities(journey: JourneyMap): number {
  return journey.stages.reduce((a, s) => a + s.opportunities.length, 0);
}

function listRows(stage: JourneyStage): [JourneyListRow, string[]][] {
  return [
    ["actions", stage.actions],
    ["touchpoints", stage.touchpoints],
    ["thoughts", stage.thoughts],
    ["pains", stage.pains],
    ["opportunities", stage.opportunities],
  ];
}

/** Export a journey to a readable Markdown document. */
export function journeyToMarkdown(j: JourneyMap): string {
  const lines: string[] = [];
  lines.push(`# 用户旅程地图：${j.title}`, "");
  lines.push(`- **角色**：${j.persona.name}${j.persona.role ? `（${j.persona.role}）` : ""}`);
  if (j.persona.goal) lines.push(`- **目标**：${j.persona.goal}`);
  if (j.scenario) lines.push(`- **场景**：${j.scenario}`);
  lines.push(`- **平均情绪**：${averageEmotion(j.stages)} / 2`, "");

  for (const [i, s] of j.stages.entries()) {
    lines.push(`## 阶段 ${i + 1}：${s.name}  ${EMOTION_EMOJI[clampEmotion(s.emotion)]} ${EMOTION_LABELS[clampEmotion(s.emotion)]}`);
    for (const [row, items] of listRows(s)) {
      if (items.length === 0) continue;
      lines.push("", `**${ROW_META[row].label}**`);
      for (const it of items) lines.push(`- ${it}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Export a journey to CSV (rows = fields, columns = stages). */
export function journeyToCsv(j: JourneyMap): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["维度", ...j.stages.map((s) => s.name)].map(esc).join(",");
  const rows: string[] = [header];
  const cell = (items: string[]) => esc(items.join("；"));
  rows.push(["用户行为", ...j.stages.map((s) => cell(s.actions))].map((v, i) => (i === 0 ? esc(v) : v)).join(","));
  rows.push(["触点", ...j.stages.map((s) => cell(s.touchpoints))].map((v, i) => (i === 0 ? esc(v) : v)).join(","));
  rows.push(["想法", ...j.stages.map((s) => cell(s.thoughts))].map((v, i) => (i === 0 ? esc(v) : v)).join(","));
  rows.push(
    ["情绪", ...j.stages.map((s) => `${clampEmotion(s.emotion)} ${EMOTION_LABELS[clampEmotion(s.emotion)]}`)]
      .map((v, i) => (i === 0 ? esc(v) : esc(v)))
      .join(","),
  );
  rows.push(["痛点", ...j.stages.map((s) => cell(s.pains))].map((v, i) => (i === 0 ? esc(v) : v)).join(","));
  rows.push(["机会点", ...j.stages.map((s) => cell(s.opportunities))].map((v, i) => (i === 0 ? esc(v) : v)).join(","));
  return rows.join("\n");
}

interface StageSeed {
  name: string;
  actions: string[];
  touchpoints: string[];
  thoughts: string[];
  emotion: JourneyEmotion;
  pains: string[];
  opportunities: string[];
}

function seedToStages(seeds: StageSeed[]): JourneyStage[] {
  return seeds.map((s) => ({ id: id("stage"), ...s }));
}

/**
 * Offline heuristic journey generator.
 *
 * Picks a domain template from keywords in the brief so "describe a product →
 * get a usable journey map" works with no API key. Real LLM providers can emit
 * the same JourneyMap shape via `coerceJourney`.
 */
export function generateJourneyFromBrief(brief: string): JourneyMap {
  const b = brief.toLowerCase();
  const has = (re: RegExp) => re.test(brief) || re.test(b);

  if (has(/(电商|商城|购物|商品|下单|店铺|shop|commerce|store|cart)/)) {
    return {
      id: id("jny"),
      title: "网购用户旅程",
      persona: { name: "网购用户 · 小李", role: "价格敏感的上班族", goal: "买到合适且划算的商品", avatar: "🛒" },
      scenario: "在手机电商 App 上挑选并购买一件商品",
      updatedAt: Date.now(),
      stages: seedToStages([
        {
          name: "认知",
          actions: ["看到广告/推荐", "搜索关键词"],
          touchpoints: ["信息流广告", "搜索"],
          thoughts: ["这个东西看起来不错"],
          emotion: 1,
          pains: ["广告太多，分不清真假"],
          opportunities: ["精准推荐降低发现成本"],
        },
        {
          name: "考虑",
          actions: ["浏览商品详情", "对比价格", "看评价"],
          touchpoints: ["商品详情页", "评价区"],
          thoughts: ["靠谱吗？有没有更便宜的？"],
          emotion: 0,
          pains: ["评价真假难辨", "参数看不懂"],
          opportunities: ["AI 导购答疑", "同类一键对比"],
        },
        {
          name: "购买",
          actions: ["加入购物车", "下单支付"],
          touchpoints: ["购物车", "收银台"],
          thoughts: ["希望快点付完"],
          emotion: -1,
          pains: ["优惠券规则复杂", "支付步骤多"],
          opportunities: ["自动选最优优惠", "一键支付"],
        },
        {
          name: "收货",
          actions: ["等待物流", "查看进度"],
          touchpoints: ["物流通知", "App 消息"],
          thoughts: ["什么时候到？"],
          emotion: 0,
          pains: ["物流更新不及时"],
          opportunities: ["精确到小时的送达预测"],
        },
        {
          name: "复购",
          actions: ["评价", "再次购买"],
          touchpoints: ["评价页", "会员中心"],
          thoughts: ["体验不错，下次还来"],
          emotion: 2,
          pains: ["想复购时找不到入口"],
          opportunities: ["复购提醒与专属优惠"],
        },
      ]),
    };
  }

  if (has(/(注册|登录|onboard|新手|引导|开通|账号)/)) {
    return {
      id: id("jny"),
      title: "新用户注册引导旅程",
      persona: { name: "新用户 · 小王", role: "首次使用产品的尝鲜者", goal: "顺利注册并完成首次核心操作", avatar: "🙋" },
      scenario: "第一次下载并使用产品",
      updatedAt: Date.now(),
      stages: seedToStages([
        {
          name: "下载",
          actions: ["应用商店下载", "首次打开"],
          touchpoints: ["应用商店", "启动页"],
          thoughts: ["希望别太麻烦"],
          emotion: 1,
          pains: ["包体过大下载慢"],
          opportunities: ["轻量首屏，先体验后注册"],
        },
        {
          name: "注册",
          actions: ["填写手机号", "接收验证码", "设置密码"],
          touchpoints: ["注册页", "短信"],
          thoughts: ["怎么又要验证码"],
          emotion: -1,
          pains: ["验证码收不到", "表单字段太多"],
          opportunities: ["一键登录", "渐进式资料完善"],
        },
        {
          name: "引导",
          actions: ["浏览新手引导", "完成首个任务"],
          touchpoints: ["新手引导", "空状态页"],
          thoughts: ["这功能怎么用？"],
          emotion: 0,
          pains: ["引导冗长想跳过"],
          opportunities: ["按需上下文提示"],
        },
        {
          name: "激活",
          actions: ["完成核心操作", "获得正反馈"],
          touchpoints: ["核心功能页"],
          thoughts: ["原来这么好用"],
          emotion: 2,
          pains: ["首次成功路径不清晰"],
          opportunities: ["首次成功即时奖励"],
        },
      ]),
    };
  }

  // Generic 4-stage service journey.
  const subject = brief.replace(/\s+/g, "").slice(0, 10) || "产品";
  return {
    id: id("jny"),
    title: `${subject}使用旅程`,
    persona: { name: "目标用户", role: "核心使用人群", goal: `高效地用${subject}解决问题`, avatar: "🙂" },
    scenario: `用户使用${subject}完成一次完整任务`,
    updatedAt: Date.now(),
    stages: seedToStages([
      {
        name: "发现",
        actions: ["了解到产品", "产生兴趣"],
        touchpoints: ["口碑/推荐", "官网"],
        thoughts: ["能解决我的问题吗"],
        emotion: 1,
        pains: ["价值主张不清晰"],
        opportunities: ["更清晰的价值表达"],
      },
      {
        name: "上手",
        actions: ["尝试核心功能"],
        touchpoints: ["核心页面"],
        thoughts: ["上手快不快"],
        emotion: 0,
        pains: ["学习成本偏高"],
        opportunities: ["模板/示例加速上手"],
      },
      {
        name: "使用",
        actions: ["完成主要任务"],
        touchpoints: ["主要工作区"],
        thoughts: ["希望稳定高效"],
        emotion: 1,
        pains: ["偶发卡顿/报错"],
        opportunities: ["性能与可靠性提升"],
      },
      {
        name: "留存",
        actions: ["持续使用", "推荐他人"],
        touchpoints: ["通知", "社区"],
        thoughts: ["值得长期用"],
        emotion: 2,
        pains: ["缺少回访激励"],
        opportunities: ["成长体系与召回"],
      },
    ]),
  };
}

/** Normalize a loosely-typed (LLM) object into a valid JourneyMap. */
export function coerceJourney(obj: unknown, fallbackTitle = "AI 旅程地图"): JourneyMap {
  const o = (obj ?? {}) as Record<string, unknown>;
  const persona = (o.persona ?? {}) as Record<string, unknown>;
  const rawStages = Array.isArray(o.stages) ? o.stages : [];
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const stages: JourneyStage[] = rawStages.map((rs) => {
    const s = (rs ?? {}) as Record<string, unknown>;
    return {
      id: id("stage"),
      name: String(s.name ?? "阶段"),
      actions: strArr(s.actions),
      touchpoints: strArr(s.touchpoints),
      thoughts: strArr(s.thoughts),
      emotion: clampEmotion(Number(s.emotion) || 0),
      pains: strArr(s.pains),
      opportunities: strArr(s.opportunities),
    };
  });
  return {
    id: id("jny"),
    title: String(o.title ?? fallbackTitle),
    persona: {
      name: String(persona.name ?? "目标用户"),
      role: persona.role ? String(persona.role) : "",
      goal: persona.goal ? String(persona.goal) : "",
      avatar: persona.avatar ? String(persona.avatar) : "🙂",
    },
    scenario: o.scenario ? String(o.scenario) : "",
    stages: stages.length ? stages : emptyJourney().stages,
    updatedAt: Date.now(),
  };
}
