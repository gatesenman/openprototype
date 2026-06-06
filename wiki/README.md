# OpenPrototype Wiki (DeepWiki, 静态化)

本目录是用**内部 DeepWiki 知识库**对本仓库自动生成、并静态化的项目文档站点。

## 查看方式
- 直接打开 [`index.html`](./index.html)（会跳转到首页 `pages/page-1.html`）。
- 无需联网：Mermaid 图渲染脚本已本地化在 `assets/mermaid.min.js`。
- 也可用任意静态服务器：`python3 -m http.server -d wiki 8080` 后访问 `http://localhost:8080/`。

## 目录结构
- `pages/` — 40 个页面的静态 HTML（带左侧分组导航 + 页面筛选 + Mermaid 架构图）。
- `markdown/` — 每个页面对应的 Markdown 源（便于检索/二次编辑）。
- `assets/` — 样式 `wiki.css` + 本地 `mermaid.min.js`。
- `DEEPWIKI_RAW.md` — DeepWiki 原始导出全文。
- `structure.json` — 页面层级结构。
- `build_wiki.py` — 静态化生成脚本：`python3 wiki/build_wiki.py` 可由原始导出重新生成站点。

## 内容覆盖
概览、数据模型与 Schema、状态管理、画布与设计编辑器、AI 生成系统、设计系统、需求与旅程地图、导出与预览、组件市场与插件系统、设计互通与导入、云后端与协作、桌面端 (Tauri)、术语表。
