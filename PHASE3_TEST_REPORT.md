# OpenPrototype — Phase 3 深化测试报告

本轮目标：把已有 Phase 2 功能"做深做全"，补齐三处仍然偏浅的能力，并端到端验证。

## 自动化检查（全绿）

| 检查 | 命令 | 结果 |
|------|------|------|
| 类型检查 | `pnpm typecheck` | ✓ 通过 |
| Lint | `pnpm lint` | ✓ 通过 |
| 单元测试 | `pnpm test` | ✓ 14 passed（10 → 14） |
| 构建 | `pnpm build` | ✓ built |

新增单测：自动布局引擎 ×3（竖向堆叠+hug、居中/拉伸、横向+none 空操作）、图片导出 ×1。

## 本轮新增/深化的三项能力

### 1. 自动布局引擎（Figma 风格 Auto-layout）

之前 schema 里有 `AutoLayout` 字段但从未被使用。本轮实现了纯函数 `applyAutoLayout(node)`、store action `setNodeLayout`、属性面板 UI（方向/间距/内边距/对齐）、画布实时回流、HTML 导出支持。

端到端：把三个按钮编组 → 方向改为「竖向堆叠」→ 子元素按 gap/padding 自动堆叠并 hug 容器尺寸；对齐改为「拉伸」后子元素宽度被统一到容器宽度。

![自动布局 - 拉伸对齐统一子元素宽度](https://app.devin.ai/attachments/95e3532b-447d-4a2a-bb51-a48b2a5f7a9c/screenshot_zoom_2ceae0538ff04d5bae4e3be540dcb536.png)

### 2. 图片节点

schema 里有 `image` 类型与 `src` 字段但无 UI/渲染。本轮补齐：属性面板文件选择器（上传/替换/清除），图片以 data URL 内嵌（文档自包含，写入 `.gpo`），画布通过 Konva fillPattern 渲染，HTML 导出为 `background-image`。

端到端：把节点类型改为 image → 上传 PNG → 画布即时显示该图（青色块为测试图），属性面板出现缩略图 + 「已嵌入」。

![图片节点上传并在画布渲染](https://app.devin.ai/attachments/8bc5140e-ba2b-40fb-ae23-04409241546b/screenshot_2ba5745f4f3b438e834dfc240effa968.png)

### 3. 评论/批注 — 全局面板深化

之前只有画板上的单条线程。本轮新增全局「评论列表」面板：内容/作者/框架搜索、全部/未解决/已解决筛选与计数、点击跳转到对应批注；快捷键 `C` 切换批注模式、`Esc` 退出。

端到端：批注模式点击画板落点 → 生成 pin + 线程，顶部计数「批注 (1)」，全局面板「全部 1 / 未解决 1」。

![新增评论：pin + 线程 + 全局面板计数](https://app.devin.ai/attachments/feb1fd88-a302-482e-9722-e3508c92e290/screenshot_53378fe51c0348d89e145ee450edf187.png)

搜索 "spacing" 命中该评论；在面板内「标记解决」后计数实时变为「未解决 0 / 已解决 1」并显示已解决徽标，按钮变为「重新打开」。

![搜索/筛选/解决联动](https://app.devin.ai/attachments/bb6d1a76-5aab-4a05-8f32-46b5b5c6d116/screenshot_zoom_9232c41aad714366b8b6b3336d30d346.png)

## 改动文件

- 新增：`src/schema/layout.ts`、`src/views/canvas/CommentsPanel.tsx`
- 修改：`src/store/useStore.ts`、`src/views/canvas/PropertiesPanel.tsx`、`src/views/canvas/CanvasStage.tsx`、`src/export/exportHtml.ts`、`src/hooks/useShortcuts.ts`、`src/views/DesignView.tsx`、`src/styles.css`、`src/__tests__/core.test.ts`

## 测试中发现的注意点

- 通过 GUI 自动化向批注输入框输入中文时，xdotool 的 CJK 注入未能进入 React 受控状态，导致首次提交为空（功能本身正常，改用文本验证后评论正确创建）。这是测试工具的输入法限制，非产品缺陷。
