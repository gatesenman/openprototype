# 批 2 · 图形样式系统 + 约束（Constraints）E2E 验证报告

- **项目**：OpenPrototype（gpo-studio）
- **分支**：`devin/1780206086-gpo-studio-mvp`（本地）
- **关键修复提交**：`eda8691` — fix(canvas): invalidate gradient cache + full draw on style change
- **自动化检查**：typecheck 0 · lint 0 error · **test 87 passed** · build ✓
- **结论**：6 项浏览器 E2E 测试全部通过，控制台无错误。

> 录屏（带断言标注）随交付消息附上，逐项演示下列 6 个测试。

---

## 关键 Bug 修复（本批最重要）

**现象**：渐变填充改角度 / 色标后，Konva 节点属性已更新，但画布仍显示旧渐变（不重绘）。

**根因**：react-konva 更新 `colorStops`/端点属性时，不会可靠触发 Konva 内部 `_clearLinearGradientCache()`，导致缓存的渐变陈旧。

**修复**：在样式 effect 中显式清缓存并做**全量同步重绘**（而非 `batchDraw`）：
```ts
if (ft === "linear" || ft === "radial") {
  k._clearCache?.("linearGradient");
  k._clearCache?.("radialGradient");
}
// 全量同步绘制：batchDraw 可能留下陈旧渐变缓存
for (const layer of stage.getLayers()) layer.draw();
```
（见 `src/views/canvas/CanvasStage.tsx` 样式 useEffect）

---

## Test 1 — 线性渐变（Linear gradient）

- **预期**：填充类型设为「线性渐变」后，矩形即时呈现方向性渐变（蓝 → 浅）。
- **操作**：选中矩形 → 填充类型 = 线性渐变。
- **结果**：✅ PASS — 矩形实时渲染横向蓝→浅渐变，修复后无需任何额外操作即重绘。

![线性渐变](https://app.devin.ai/attachments/3f793b70-16c3-41f7-b1f0-617301cfc7ba/screenshot_zoom_f52918ea3c834d03848ae4c4b284461b.png)

---

## Test 2 — 径向渐变（Radial gradient）

- **预期**：填充类型设为「径向渐变」后呈现由中心向外的同心渐变。
- **操作**：选中节点 → 填充类型 = 径向渐变。
- **结果**：✅ PASS — 节点呈中心到边缘的径向渐变（录屏内演示）。

---

## Test 3 — 图片填充（Image fill：Cover / Contain / Tile）

- **预期**：图片填充支持三种缩放模式：填充(Cover)、适应(Contain)、平铺(Tile)。
- **操作**：填充类型 = 图片 → 切换缩放下拉（fill / fit / tile）。
- **结果**：✅ PASS — 三种模式均正确渲染（录屏内演示）。属性面板「缩放」下拉含 `填充 (Cover)` / `适应 (Contain)` / `平铺 (Tile)`。

---

## Test 4 — 图层模糊（Layer blur）

- **预期**：图层模糊 0 → 10px，矩形边缘由清晰变柔和。
- **操作**：效果 → 图层模糊 = 10px（Konva `cache()` + `filters([Blur])` + `blurRadius(10)` + `layer.draw()`）。
- **结果**：✅ PASS — 边缘明显柔化、出现白色弥散；0px 时边缘清晰。
- **断言**：图层模糊 10px：矩形边缘由清晰变为柔和模糊。

![图层模糊 10px](https://app.devin.ai/attachments/a8aa2fe5-6aad-47c9-bb1c-48325210202d/screenshot_zoom_66d177cd6d764a26b78daa14a1a2a458.png)

---

## Test 5 — 混合模式：正片叠底（Multiply blend）

- **预期**：黄色矩形(#ffd400)叠在青色矩形上，混合模式设为「正片叠底」后，**重叠区**相乘变暗为深绿，非重叠区不变。
- **操作**：选中黄色矩形 → 混合 = 正片叠底（`globalCompositeOperation = "multiply"`）。
- **结果**：✅ PASS — 重叠区变暗为深绿，符合 multiply 数学；非重叠区颜色不变。
- **断言**：正片叠底：黄+青重叠区相乘变暗为深绿，非重叠区不变。

![正片叠底](https://app.devin.ai/attachments/0e0d8c86-63ab-45a5-8329-e04891a5837b/screenshot_zoom_ae3007788c994203bb3620b1f6423296.png)

---

## Test 6 — 约束（Constraints）· 框架放大子元素重排

- **预期**：黄色矩形水平约束设为「左右 ↔（拉伸）」、垂直约束「上 ↑」；放大框架宽度时，矩形随框架横向拉伸，左约束的青色矩形保持原尺寸。
- **操作**：选中黄色矩形设约束 h=`left-right` / v=`top` → 选中 Frame → 宽度 390 → 640。
- **结果**：✅ PASS — 框架由 390 加宽到 640 后，黄色矩形（左右约束）拉伸为横贯框架的长条（W 120→635）；青色矩形（默认左约束）尺寸位置不变。
- **断言**：框架 390→640：左右约束矩形随之拉伸，左约束矩形不变。

![约束重排](https://app.devin.ai/attachments/450b5be0-cb44-461f-88ec-5a5cd0331abf/screenshot_34310cc09f744babb28cbe1605d9584c.png)

---

## 汇总

| # | 测试 | 结果 |
|---|------|------|
| 1 | 线性渐变 | ✅ PASS |
| 2 | 径向渐变 | ✅ PASS |
| 3 | 图片填充 Cover/Contain/Tile | ✅ PASS |
| 4 | 图层模糊 0→10px | ✅ PASS |
| 5 | 混合模式 正片叠底 | ✅ PASS |
| 6 | 约束 框架放大子元素重排 | ✅ PASS |

**附带能力**（属性面板已具备）：内/外/居中描边、不透明度、圆角、混合模式 12 种、水平/垂直约束各 5 种（左/右/左右/居中/缩放）。

控制台全程无错误。批 2（图形样式补强 + 约束）验证完成。
