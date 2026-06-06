# OpenPrototype

AI 驱动的产品原型工具。**需求文档驱动**：先写/管理需求 Markdown，再由 AI 生成可继续手动编辑的结构化页面（不是图片），在自由画布上微调、连线跳转，并导出可演示的静态原型。

> 文件后缀：`.gpo`（Generative Prototype Object）。

## 已实现（MVP 主干闭环）

```
需求 Markdown  →  AI 生成页面(结构化元数据)  →  画布手动微调  →  Flow 跳转连线  →  导出可演示 HTML
```

- **需求模块**：Markdown 编辑 + 实时预览，作为产品入口（需求 → 原型）。
- **AI 生成**：多 Provider 网关（OpenAI / Anthropic / DeepSeek，用户自带 Key）+ **本地启发式生成器**（无需 Key 即可跑通）。支持页面级生成与节点级微调，原型级/高保真双保真度。
- **画布引擎**（react-konva）：无限画布、缩放/平移、矩形/文本、选择/移动/缩放、图层树、属性面板。
- **设计系统**：颜色/字体/圆角/间距 tokens、系统级提示词、可机检的设计规则（生成后自动校验+修正）。
- **Flow 连线**：节点点击 → 跳转到目标框架（含动效）。
- **演示模式**：内置可交互原型播放器。
- **导出**：单文件可演示 HTML（含跳转运行时）。
- **文件**：`.gpo` zip 容器（`document.json` 开放 Schema + `INTEROP.md` 互通规范），浏览器内打开/保存，桌面端走 Tauri 文件对话框。

## 技术栈

React 18 + TypeScript + Vite + Zustand + react-konva。桌面壳：Tauri 2（见 `src-tauri/`）。

## 开发

```bash
pnpm install
pnpm dev         # http://localhost:5173
pnpm typecheck
pnpm lint
pnpm test
pnpm build       # 产出 dist/（静态站点）
```

## 桌面端（Tauri）

```bash
pnpm tauri dev      # 需本地安装 Rust 与系统 WebView 依赖
pnpm tauri build    # 打包 Win/macOS/Linux 安装包
```

## `.gpo` 文件格式

ZIP 容器：

```
/manifest.json    格式与 schema 版本
/document.json    完整文档树（开放 JSON Schema）
/INTEROP.md       与 Figma/Sketch 的字段映射（互通规范）
/assets/*         图片/字体
```

详见 `src/schema/types.ts`（Schema）与 `src/schema/gpoFile.ts`（容器 + 互通规范）。

## 目录结构

```
src/
  schema/        .gpo 文档 Schema、默认值、zip 序列化
  store/         Zustand 状态（文档/选择/UI/AI 设置）
  ai/            Provider 网关、本地生成器、生成/微调编排
  designsystem/  设计规则引擎
  render/        token→颜色解析
  export/        静态 HTML 导出
  file/          .gpo 打开/保存（Tauri + 浏览器）
  views/         需求 / 设计(画布) / 演示 三大视图
  components/    AI 设置、设计系统弹窗
```

## 路线图（后续阶段）

- 高保真生成增强、Figma/Sketch 真实导入、组件实例/覆盖、自动布局。
- SaaS：多租户、账户/计费、CRDT 实时协作、云端文件。
- 插件市场 + 组件市场。

详见规划文档（随会话附件 `prototype_ai_plan.md`）。
