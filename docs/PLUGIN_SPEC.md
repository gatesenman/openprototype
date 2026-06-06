# OpenPrototype 插件规范（Plugin Spec）

当前 **Plugin API 版本：`1.0.0`**（见 `src/market/catalog.ts` 的 `PLUGIN_API_VERSION`）。

插件用来对设计文档做可复用、可撤销的批量变换（例如统一圆角、切换暗色主题、
界面文案英文化）。一个插件 = **清单（manifest）** + 一个纯函数 **`run(ctx)`**。

## 1. 清单（Manifest）

```ts
interface Plugin {
  id: string;            // 全局唯一，建议前缀 plg_
  name: string;          // 展示名
  author: string;        // 作者 / 来源
  description: string;   // 一句话说明插件会做什么
  version?: string;      // 插件自身版本（语义化版本），默认 "1.0.0"
  apiVersion?: string;   // 面向的插件 API 版本，默认 = PLUGIN_API_VERSION
  category?: string;     // 展示分类，如「主题 / 组件 / 规范 / 视觉」
  permissions?: PluginPermission[]; // 声明会触碰的能力
  run: (ctx: PluginContext) => string; // 入口，返回结果消息
}
```

未显式提供的 manifest 字段会由宿主用默认值补全（`definePlugins`）。

### 兼容性

宿主按 **主版本号** 判断兼容：`apiVersion` 与 `PLUGIN_API_VERSION` 主版本一致即可加载。

## 2. 权限（Permissions）

插件须如实声明它会触碰的能力，宿主据此向用户展示：

| 权限 | 含义 |
| --- | --- |
| `tokens` | 读写设计系统 tokens（颜色 / 圆角 / 间距 / 字阶 / 阴影） |
| `components` | 向设计系统添加组件 |
| `nodes` | 修改单个节点 |
| `document` | 对整篇文档做批量变换（单步可撤销） |

## 3. 运行上下文（PluginContext）

`run` 只能通过受限的 `ctx` 读写文档，所有变更都经由 store，从而保证**单步可撤销**
与**可测试**：

```ts
interface PluginContext {
  doc: GpoDocument;                 // 只读快照
  activeFrameId: string | null;
  updateDesignSystem: (patch: Partial<DesignSystem>) => void; // tokens
  updateNode: (frameId, nodeId, patch) => void;               // nodes
  addComponent: (comp: ComponentDef) => void;                 // components
  setDoc: (doc: GpoDocument) => void;                          // document
}
```

工具函数：
- `mapAllNodes(doc, fn)`：对所有页 / 框架 / 嵌套子节点逐个应用 `fn`，返回新文档。
- `countNodes(doc, pred)`：统计满足条件的节点数。

### 约束

- `run` 必须是**纯函数式变换**：不得发起网络请求或其它 IO 副作用。
- 文档变更只能通过 `ctx` 提供的方法完成（便于撤销 / 重做与回归测试）。
- `run` 返回一条面向用户的结果消息（如「已对齐 42 个节点到 8px 网格」）。

## 4. 一个最小示例

```ts
const myPlugin: Plugin = {
  id: "plg_uppercase_titles",
  name: "标题大写",
  author: "示例",
  description: "把所有文本节点内容转为大写。",
  category: "视觉",
  permissions: ["document"],
  run: (ctx) => {
    let n = 0;
    const after = mapAllNodes(ctx.doc, (node) => {
      if (node.text?.content) {
        n++;
        return { ...node, text: { ...node.text, content: node.text.content.toUpperCase() } };
      }
      return node;
    });
    ctx.setDoc(after);
    return `已处理 ${n} 个文本节点。`;
  },
};
```

把它加入 `src/market/catalog.ts` 的 `PLUGINS` 数组（经 `definePlugins` 包裹），
即出现在「插件市场」中，点击「运行插件」即可执行；执行结果作为单步进入撤销栈。
