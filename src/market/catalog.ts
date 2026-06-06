import { ComponentDef, DesignSystem, GpoDocument, Node } from "@/schema/types";
import { id } from "@/schema/defaults";
import { ELEMENT_PLUS_PACKAGES } from "./elementPlus";

/** A marketplace component package. `build` produces a fresh template node. */
export interface ComponentPackage {
  id: string;
  name: string;
  category: string;
  description: string;
  build: (ds: DesignSystem) => Node;
}

const text = (content: string, opts: Partial<Node["text"]> = {}, over: Partial<Node> = {}, ds?: DesignSystem): Node => ({
  id: id(),
  type: "text",
  name: content.slice(0, 10) || "文本",
  x: 0,
  y: 0,
  width: 200,
  height: 24,
  style: {},
  text: {
    content,
    fontFamily: ds?.tokens.fonts.family ?? "Inter, sans-serif",
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1.4,
    color: ds?.tokens.colors.text ?? "#0f172a",
    align: "left",
    ...opts,
  } as Node["text"],
  ...over,
});

const BASIC_PACKAGES: ComponentPackage[] = [
  {
    id: "pkg_primary_button",
    name: "主按钮",
    category: "基础",
    description: "符合设计系统规范的主操作按钮。",
    build: (ds) => ({
      id: id("grp"),
      type: "button",
      name: "主按钮",
      x: 0,
      y: 0,
      width: 160,
      height: 44,
      style: { fill: { type: "token", token: "primary" }, radius: ds.tokens.radii.md },
      text: {
        content: "主操作",
        fontFamily: ds.tokens.fonts.family,
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1.4,
        color: ds.tokens.colors["primary-fg"],
        align: "center",
      },
    }),
  },
  {
    id: "pkg_card",
    name: "卡片",
    category: "容器",
    description: "带标题/描述的内容卡片，圆角与阴影符合规范。",
    build: (ds) => ({
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
            stroke: { color: ds.tokens.colors.border, width: 1 },
            shadow: { x: 0, y: 6, blur: 18, color: "rgba(15,23,42,0.08)" },
          },
        },
        text("卡片标题", { fontSize: 18, fontWeight: 700 }, { x: 16, y: 16, width: 288 }, ds),
        text("这里是卡片的描述文案，用于补充说明信息。", { fontSize: 14, color: ds.tokens.colors.muted }, { x: 16, y: 48, width: 288, height: 60 }, ds),
      ],
    }),
  },
  {
    id: "pkg_navbar",
    name: "顶部导航栏",
    category: "导航",
    description: "移动端顶部栏：返回 + 标题 + 操作。",
    build: (ds) => ({
      id: id("grp"),
      type: "group",
      name: "导航栏",
      x: 0,
      y: 0,
      width: 390,
      height: 56,
      style: {},
      children: [
        { id: id(), type: "rect", name: "底", x: 0, y: 0, width: 390, height: 56, style: { fill: { type: "token", token: "primary" } } },
        text("‹", { fontSize: 26, color: ds.tokens.colors["primary-fg"] }, { x: 12, y: 14, width: 30 }, ds),
        text("页面标题", { fontSize: 17, fontWeight: 600, color: ds.tokens.colors["primary-fg"], align: "center" }, { x: 95, y: 18, width: 200 }, ds),
      ],
    }),
  },
  {
    id: "pkg_list_item",
    name: "列表项",
    category: "列表",
    description: "头像 + 主副标题 + 右箭头的列表行。",
    build: (ds) => ({
      id: id("grp"),
      type: "group",
      name: "列表项",
      x: 0,
      y: 0,
      width: 390,
      height: 64,
      style: {},
      children: [
        { id: id(), type: "rect", name: "底", x: 0, y: 0, width: 390, height: 64, style: { fill: { type: "solid", color: "#ffffff" }, stroke: { color: ds.tokens.colors.border, width: 1 } } },
        { id: id(), type: "ellipse", name: "头像", x: 16, y: 12, width: 40, height: 40, style: { fill: { type: "solid", color: "#c7d2fe" } } },
        text("主标题", { fontSize: 15, fontWeight: 600 }, { x: 68, y: 14, width: 240 }, ds),
        text("副标题说明", { fontSize: 13, color: ds.tokens.colors.muted }, { x: 68, y: 36, width: 240 }, ds),
        text("›", { fontSize: 22, color: ds.tokens.colors.muted, align: "right" }, { x: 340, y: 18, width: 30 }, ds),
      ],
    }),
  },
  {
    id: "pkg_tag",
    name: "标签 Chip",
    category: "基础",
    description: "小圆角标签。",
    build: (ds) => ({
      id: id("grp"),
      type: "group",
      name: "标签",
      x: 0,
      y: 0,
      width: 72,
      height: 28,
      style: {},
      children: [
        { id: id(), type: "rect", name: "底", x: 0, y: 0, width: 72, height: 28, style: { fill: { type: "solid", color: ds.tokens.colors.surface }, radius: 999 } },
        text("标签", { fontSize: 13, color: ds.tokens.colors.text, align: "center" }, { x: 0, y: 4, width: 72 }, ds),
      ],
    }),
  },
  {
    id: "pkg_input",
    name: "输入框",
    category: "基础",
    description: "带标签与占位符的表单输入框。",
    build: (ds) => ({
      id: id("grp"),
      type: "group",
      name: "输入框",
      x: 0,
      y: 0,
      width: 280,
      height: 64,
      style: {},
      children: [
        text("标签", { fontSize: 13, fontWeight: 600, color: ds.tokens.colors.muted }, { x: 0, y: 0, width: 280, height: 18 }, ds),
        { id: id(), type: "input", name: "输入", x: 0, y: 22, width: 280, height: 42, style: { fill: { type: "solid", color: "#ffffff" }, radius: ds.tokens.radii.md, stroke: { color: ds.tokens.colors.border, width: 1 } }, text: { content: "请输入", fontFamily: ds.tokens.fonts.family, fontSize: 14, fontWeight: 400, lineHeight: 1.4, color: ds.tokens.colors.muted, align: "left" } },
      ],
    }),
  },
  {
    id: "pkg_avatar",
    name: "头像",
    category: "基础",
    description: "圆形头像占位。",
    build: (ds) => ({
      id: id("grp"),
      type: "ellipse",
      name: "头像",
      x: 0,
      y: 0,
      width: 48,
      height: 48,
      style: { fill: { type: "solid", color: "#c7d2fe" }, radius: 999, stroke: { color: ds.tokens.colors.border, width: 1 } },
    }),
  },
  {
    id: "pkg_badge",
    name: "徽标 Badge",
    category: "基础",
    description: "数字 / 状态徽标。",
    build: (ds) => ({
      id: id("grp"),
      type: "group",
      name: "徽标",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      style: {},
      children: [
        { id: id(), type: "ellipse", name: "底", x: 0, y: 0, width: 24, height: 24, style: { fill: { type: "token", token: "danger" }, radius: 999 } },
        text("9", { fontSize: 13, fontWeight: 700, color: "#ffffff", align: "center" }, { x: 0, y: 3, width: 24 }, ds),
      ],
    }),
  },
  {
    id: "pkg_search",
    name: "搜索框",
    category: "基础",
    description: "带放大镜图标的搜索输入。",
    build: (ds) => ({
      id: id("grp"),
      type: "group",
      name: "搜索框",
      x: 0,
      y: 0,
      width: 320,
      height: 40,
      style: {},
      children: [
        { id: id(), type: "rect", name: "底", x: 0, y: 0, width: 320, height: 40, style: { fill: { type: "solid", color: ds.tokens.colors.surface }, radius: 999 } },
        text("⌕", { fontSize: 16, color: ds.tokens.colors.muted }, { x: 14, y: 9, width: 20 }, ds),
        text("搜索", { fontSize: 14, color: ds.tokens.colors.muted }, { x: 40, y: 10, width: 240 }, ds),
      ],
    }),
  },
];

/** 全部组件包：基础（Figma 风格）+ Element Plus 页面组件。 */
export const COMPONENT_PACKAGES: ComponentPackage[] = [
  ...BASIC_PACKAGES,
  ...ELEMENT_PLUS_PACKAGES,
];

// ---------------- Plugins ----------------

export interface PluginContext {
  doc: GpoDocument;
  activeFrameId: string | null;
  updateDesignSystem: (patch: Partial<DesignSystem>) => void;
  updateNode: (frameId: string, nodeId: string, patch: Partial<Node>) => void;
  addComponent: (comp: ComponentDef) => void;
  /** Apply a whole-document transform (single undoable step). */
  setDoc: (doc: GpoDocument) => void;
}

/** Apply fn to every node (including nested children) across all frames. */
export function mapAllNodes(doc: GpoDocument, fn: (n: Node) => Node): GpoDocument {
  const walk = (n: Node): Node => {
    const mapped = fn(n);
    return mapped.children
      ? { ...mapped, children: mapped.children.map(walk) }
      : mapped;
  };
  return {
    ...doc,
    pages: doc.pages.map((p) => ({
      ...p,
      frames: p.frames.map((f) => ({ ...f, nodes: f.nodes.map(walk) })),
    })),
  };
}

/** Count nodes (incl. children) across all frames matching a predicate. */
export function countNodes(doc: GpoDocument, pred: (n: Node) => boolean): number {
  let count = 0;
  mapAllNodes(doc, (n) => {
    if (pred(n)) count++;
    return n;
  });
  return count;
}

const snap8 = (v: number) => Math.round(v / 8) * 8;

/** Dictionary used by the localization plugin (common CN UI strings -> EN). */
const CN_EN: Record<string, string> = {
  登录: "Sign in",
  注册: "Sign up",
  注册新账号: "Create account",
  首页: "Home",
  设置: "Settings",
  搜索框: "Search",
  搜索: "Search",
  提交: "Submit",
  保存: "Save",
  确认: "Confirm",
  取消: "Cancel",
  下一步: "Next",
  返回: "Back",
  完成: "Done",
  加入购物车: "Add to cart",
  去结算: "Checkout",
  提交订单: "Place order",
  查看详情: "View details",
  购物车: "Cart",
  商品列表: "Products",
  商品详情: "Product",
  结算: "Checkout",
  价格: "Price",
  标题: "Title",
  密码: "Password",
  手机号: "Phone number",
  验证码: "Code",
  获取验证码: "Get code",
};

function localize(s: string): string {
  if (CN_EN[s]) return CN_EN[s];
  let out = s;
  for (const [cn, en] of Object.entries(CN_EN)) {
    if (out.includes(cn)) out = out.split(cn).join(en);
  }
  return out;
}

/**
 * 当前插件 API 版本。插件 manifest 的 `apiVersion` 必须与之兼容（主版本号一致），
 * 否则宿主可拒绝加载。遵循语义化版本。
 */
export const PLUGIN_API_VERSION = "1.0.0";

/**
 * 插件能力声明（权限）。宿主据此向用户展示插件会触碰哪些数据：
 * - `tokens`：读写设计系统 tokens（颜色/圆角/间距等）
 * - `components`：向设计系统添加组件
 * - `nodes`：修改单个节点
 * - `document`：对整篇文档做批量变换（单步可撤销）
 */
export type PluginPermission = "tokens" | "components" | "nodes" | "document";

/**
 * 插件清单（manifest）+ 运行入口，构成正式的插件规范。
 *
 * 一个插件 = 元信息（id/name/author/version/apiVersion/category/permissions）
 * + 一个纯函数 `run(ctx)`：通过受限的 {@link PluginContext} 读写文档，返回一条
 * 结果消息。`run` 不应产生网络/IO 副作用，所有文档变更都通过 ctx 暴露的方法完成，
 * 以保证可撤销与可测试。
 */
export interface Plugin {
  id: string;
  name: string;
  author: string;
  description: string;
  /** 插件自身版本（语义化版本）。 */
  version?: string;
  /** 该插件面向的插件 API 版本。 */
  apiVersion?: string;
  /** 展示用分类。 */
  category?: string;
  /** 声明该插件会触碰的能力，便于宿主/用户审阅。 */
  permissions?: PluginPermission[];
  run: (ctx: PluginContext) => string; // returns a result message
}

/** 用默认 manifest 字段补全插件，确保每个插件都有完整规范元信息。 */
function definePlugins(list: Plugin[]): Plugin[] {
  return list.map((p) => ({
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    category: "其他",
    permissions: ["document"] as PluginPermission[],
    ...p,
  }));
}

export const PLUGINS: Plugin[] = definePlugins([
  {
    id: "plg_dark",
    name: "暗色主题",
    author: "OpenPrototype 官方",
    category: "主题",
    permissions: ["tokens"],
    description: "把当前设计系统的颜色 tokens 切换为暗色方案。",
    run: (ctx) => {
      ctx.updateDesignSystem({
        tokens: {
          ...ctx.doc.designSystem.tokens,
          colors: {
            ...ctx.doc.designSystem.tokens.colors,
            bg: "#0b1220",
            surface: "#111827",
            border: "#1f2937",
            text: "#e5e7eb",
            muted: "#9ca3af",
          },
        },
      });
      return "已应用暗色主题 tokens。";
    },
  },
  {
    id: "plg_install_kit",
    name: "安装基础组件包",
    author: "OpenPrototype 官方",
    category: "组件",
    permissions: ["components"],
    description: "一键把按钮/卡片/导航栏/列表项加入你的设计系统。",
    run: (ctx) => {
      ["pkg_primary_button", "pkg_card", "pkg_navbar", "pkg_list_item"].forEach((pid) => {
        const pkg = COMPONENT_PACKAGES.find((p) => p.id === pid)!;
        ctx.addComponent({ id: id("comp"), name: pkg.name, template: pkg.build(ctx.doc.designSystem) });
      });
      return "已安装 4 个基础组件到设计系统。";
    },
  },
  {
    id: "plg_brand",
    name: "品牌主色生成",
    author: "社区",
    category: "品牌",
    permissions: ["tokens"],
    description: "随机生成一个品牌主色并写入 primary token。",
    run: (ctx) => {
      const hues = ["#4f46e5", "#0ea5e9", "#16a34a", "#db2777", "#ea580c", "#7c3aed"];
      const c = hues[Math.floor(Math.random() * hues.length)];
      ctx.updateDesignSystem({
        tokens: { ...ctx.doc.designSystem.tokens, colors: { ...ctx.doc.designSystem.tokens.colors, primary: c } },
      });
      return `品牌主色已更新为 ${c}。`;
    },
  },
  {
    id: "plg_snap_grid",
    name: "对齐到 8px 网格",
    author: "OpenPrototype 官方",
    category: "规范",
    permissions: ["document"],
    description: "把所有页面里全部节点的位置与尺寸吸附到 8px 网格，统一视觉节奏。",
    run: (ctx) => {
      const before = ctx.doc;
      const after = mapAllNodes(before, (n) => ({
        ...n,
        x: snap8(n.x),
        y: snap8(n.y),
        width: Math.max(8, snap8(n.width)),
        height: Math.max(8, snap8(n.height)),
      }));
      ctx.setDoc(after);
      const total = countNodes(after, () => true);
      return `已对齐 ${total} 个节点到 8px 网格。`;
    },
  },
  {
    id: "plg_unify_radius",
    name: "统一圆角",
    author: "OpenPrototype 官方",
    category: "规范",
    permissions: ["document"],
    description: "把所有矩形/按钮/输入框/图片的圆角统一为设计系统 radii.md。",
    run: (ctx) => {
      const r = ctx.doc.designSystem.tokens.radii.md;
      const kinds = new Set(["rect", "button", "input", "image"]);
      let changed = 0;
      const after = mapAllNodes(ctx.doc, (n) => {
        if (kinds.has(n.type) && n.style.radius !== r) {
          changed++;
          return { ...n, style: { ...n.style, radius: r } };
        }
        return n;
      });
      ctx.setDoc(after);
      return `已将 ${changed} 个元素的圆角统一为 ${r}px。`;
    },
  },
  {
    id: "plg_localize_en",
    name: "界面文案英文化",
    author: "社区",
    category: "国际化",
    permissions: ["document"],
    description: "把常见中文界面文案（按钮/标题/标签）替换为英文，便于国际化预览。",
    run: (ctx) => {
      let changed = 0;
      const after = mapAllNodes(ctx.doc, (n) => {
        if (n.text?.content) {
          const next = localize(n.text.content);
          if (next !== n.text.content) {
            changed++;
            return { ...n, name: n.name, text: { ...n.text, content: next } };
          }
        }
        return n;
      });
      ctx.setDoc(after);
      return `已英文化 ${changed} 处界面文案。`;
    },
  },
  {
    id: "plg_flatten_shadows",
    name: "扁平化（移除阴影）",
    author: "OpenPrototype 官方",
    category: "视觉",
    permissions: ["document"],
    description: "移除所有节点的投影，得到扁平化（Flat Design）外观。可一步撤销。",
    run: (ctx) => {
      let changed = 0;
      const after = mapAllNodes(ctx.doc, (n) => {
        if (n.style.shadow) {
          changed++;
          const { shadow: _shadow, ...rest } = n.style;
          return { ...n, style: rest };
        }
        return n;
      });
      ctx.setDoc(after);
      return `已移除 ${changed} 个节点的阴影。`;
    },
  },
  {
    id: "plg_auto_name",
    name: "图层智能命名",
    author: "社区",
    category: "协作",
    permissions: ["document"],
    description: "按类型为图层重新编号命名（如 按钮 1 / 文本 2），便于团队协作时阅读图层树。",
    run: (ctx) => {
      const label: Record<string, string> = {
        text: "文本",
        rect: "矩形",
        ellipse: "椭圆",
        line: "线",
        button: "按钮",
        input: "输入框",
        image: "图片",
        icon: "图标",
        group: "编组",
      };
      const counters: Record<string, number> = {};
      let changed = 0;
      const after = mapAllNodes(ctx.doc, (n) => {
        const base = label[n.type] ?? n.type;
        counters[n.type] = (counters[n.type] ?? 0) + 1;
        const name = `${base} ${counters[n.type]}`;
        if (name !== n.name) changed++;
        return { ...n, name };
      });
      ctx.setDoc(after);
      return `已重命名 ${changed} 个图层。`;
    },
  },
]);
