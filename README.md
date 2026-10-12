# SemanticAnchor

**同一段需求，AI 写代码：左边瞎编字段和 API，右边对照契约改对了。**

语法错误有编译器；`sym` / `long` / `placeOrder()` 这类语义错误代码还能跑——这才是 Agent 最常见的坑。SemanticAnchor 在写盘前对照契约拦住它们。

它是一个**引用级约束协议**（MCP 参考实现）：事前注入契约、事后校验引用。不是字典、不是低代码；约束可来自手写 JSON、OpenAPI、或 Spec 制品包。

> 交互走读（推荐先看）：[public/walkthrough.html](./public/walkthrough.html) · 落地页：[public/index.html](./public/index.html)  
> 设计：[docs/design.md](./docs/design.md) · Harness：[docs/harness-integration.md](./docs/harness-integration.md) · MCP：[docs/mcp-integration.md](./docs/mcp-integration.md)

---

## 10 秒看懂（Before / After）

**需求（人话）：** 实现限价买入 AAPL @ 178.50——标的代码、买卖方向、数量、资金账号。

| 无守门（Prompt-only） | 有 SemanticAnchor |
|----------------------|-------------------|
| `sym: 'aapl'` | `ticker: 'AAPL'` |
| `side: 'long'` | `order_side: 'buy'` |
| `qty` / `placeOrder()` | `quantity` / `submitOrder()` |
| 能编译，**9 处语义错** | 对照契约后 **0 处** |

完整代码：[`naive.ts`](./examples/quant/limit-buy/artifacts/naive.ts) → [`fixed.ts`](./examples/quant/limit-buy/artifacts/fixed.ts)

```bash
npm install
npm run demo:walkthrough   # 分步讲故事（推荐）
npm run demo               # 摘要：9 → 0
```

本地预览落地页：`npm run preview` → http://localhost:4173

---

## When to use / Skip when

| ✅ 适合 | ❌ 不适合当首屏期待 |
|---------|-------------------|
| Agent 生成代码，字段/API/枚举易瞎编 | 指望它自动发明全公司标准字段名 |
| 已有 OpenAPI / TS / Spec 包可导出契约 | 零契约、全靠 AI 编 constraints |
| 要在写盘前拦「能编译但引用错」 | 替代规则引擎 / 业务逻辑测试 |

**注入是优化，守门是保证。** 没有 verify，约束只是建议。

---

## 核心公式（机制 · 第二层）

```
Canonical ID  +  Verifiable Contract  +  Inject/Gate Loop
```

| 半环 | 工具 | 性质 |
|------|------|------|
| 注入（事前） | `resolve` · `get_constraint` · `bind_constraints` | best-effort |
| 守门（事后） | `verify_usage` | must-have |

更多场景复现（量化 / 券商 / harness）：

```bash
npm run demo:derived
npm run demo:derived:broker
npm run demo:harness
npm run demo:naive
```

详见 [docs/demo-walkthrough.md](./docs/demo-walkthrough.md)

---

## Harness 集成（工程师入口）

**Agent Harness 工程师请从这里读：** [docs/harness-integration.md](./docs/harness-integration.md) · [public/harness.html](./public/harness.html)

涵盖：栈内位置、两个卡口、MCP / Library 嵌入、constraints / usages、检查清单、FAQ。

---

## 快速开始

> SemanticAnchor 不是独立 App，而是挂在你现有 Agent 工作流上的**语义守门员**——事前 `bind_constraints` 注入契约，事后 `verify_usage` 验证引用。

### 一、安装

需要 **Node.js 18+** 与 npm。

```bash
git clone <repo-url> semantic-anchor && cd semantic-anchor
npm install

# 可选：验证环境
npm test
npm run demo:walkthrough   # 先看 before/after 故事
npm run demo               # 应看到 9 → 0
```

### 二、使用方式 A · MCP 接入（IDE / CLI Agent）

把 `src/server.js` 注册为 MCP Server。Agent 通过宿主自动调用四个工具。

**Step 1 — 配置 MCP**

项目已含 [`.cursor/mcp.json`](./.cursor/mcp.json) 与 [`.vscode/mcp.json`](./.vscode/mcp.json)。其他宿主把路径改为**绝对路径**：

```json
{
  "mcpServers": {
    "semantic-anchor": {
      "command": "node",
      "args": ["/absolute/path/to/semantic-anchor/src/server.js"],
      "env": {
        "SA_CONSTRAINTS": "/absolute/path/to/constraints.json"
      }
    }
  }
}
```

`SA_CONSTRAINTS`：单个 JSON 或包含多个 `*.json` 的目录。Demo 可用 `examples/quant/constraints.json`。

**Step 2 — 重启宿主并确认**

保存后重启 MCP 宿主（Cursor：Settings → MCP；Claude Desktop：完全退出后重开）。应看到 `resolve` · `get_constraint` · `bind_constraints` · `verify_usage` 四个工具。

调试：`npm run mcp`，stderr 应输出 `loaded N constraint unit(s)`。

**Step 3 — 准备约束（生产）**

把 `SA_CONSTRAINTS` 指向你项目的契约文件。格式：[spec/constraint-unit.schema.json](./spec/constraint-unit.schema.json)，示例：[examples/quant/constraints.json](./examples/quant/constraints.json)。

**Step 4 — Agent 工作流（两卡口）**

```
① 任务开始   bind_constraints({ aliases: [...] })  → bundle 注入 context
② 生成代码后 verify_usage({ usages })             → 失败则读 feedback 重试
   通过后      才写文件 / commit
```

**Step 5 — 试一句对话**

> 用 semantic-anchor MCP：先 bind_constraints 绑定限价报单相关字段，生成 submit order 函数，抽取 usages 后 verify_usage，有 violation 就改到达标。

| 宿主 | 配置文件 |
|------|----------|
| Cursor | `.cursor/mcp.json` |
| Claude Desktop | `claude_desktop_config.json` |
| VS Code + Copilot | `.vscode/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| 更多 | [docs/mcp-integration.md](./docs/mcp-integration.md) · [config/mcp/examples/](./config/mcp/examples/) |

---

### 三、使用方式 B · 嵌入自研 Harness / CI

```javascript
const { createStore } = require('./src/protocol/constraint-store');
const { createSemanticGate } = require('./examples/harness-hook/semantic-gate');

const store = createStore();
store.load(require('./examples/quant/constraints.json'));
const gate = createSemanticGate(store);

gate.bind({ aliases, extraConstraints });                    // 事前
const outcome = await gate.enforce(usages, { retry: fix }); // 事后 + retry
if (outcome.ok) { /* 写文件 / 跑测试 */ }
```

```bash
npm run demo:harness       # bind → enforce → retry
npm run demo:derived       # TS 派生约束 + gate
```

参考：[examples/harness-hook/semantic-gate.js](./examples/harness-hook/semantic-gate.js) · [docs/design.md](./docs/design.md) §2.1

---

### 四、开发者 / CI

```bash
npm test                   # 单元测试 + 回归
npm run validate:spec      # ConstraintUnit schema
npm run demo:walkthrough   # 终端分步讲解
npm run preview            # 预览落地页 http://localhost:4173
```

---

## 四个 MCP 工具

| 工具 | 职责 |
|------|------|
| `resolve` | 别名 → 规范 id；miss 返回 `unresolved`，不编造 |
| `get_constraint` | 按 id 取完整 ConstraintUnit |
| `bind_constraints` | 打包可注入 bundle + 注入位置指引 |
| `verify_usage` | 契约 + 环境裁决 → 结构化 violation / feedback |

协议 Schema：[spec/constraint-unit.schema.json](./spec/constraint-unit.schema.json)

---

## 项目结构

```
semantic-anchor/
├── docs/
│   ├── design.md               # 权威设计
│   ├── mcp-integration.md      # MCP 多宿主集成（Cursor / Claude / VS Code / …）
│   ├── cursor-mcp.md           # → 重定向至 mcp-integration.md
│   └── demo-walkthrough.md
├── spec/constraint-unit.schema.json
├── src/
│   ├── server.js               # MCP stdio
│   ├── dispatch.js             # 单一事实来源
│   ├── protocol/               # resolve · bind · verify
│   └── adapters/               # tsc 环境裁决 adapter
├── examples/
│   ├── quant/                  # 量化限价报单案例
│   ├── broker/                 # 券商清算案例
│   ├── harness-hook/           # semantic-gate 中间件
│   ├── derived/                # TS → derived ConstraintUnit 扫描
│   └── walkthrough/            # 终端 narrated demo
└── public/
    ├── index.html              # 介绍页
    ├── walkthrough.html        # 交互案例走读
    └── architecture.html
```

---

## 与 Compass 的关系

```
Compass（私有 · 生产）                 SemanticAnchor（开源 · 协议）
  field-registry（信）  ──提炼 declared──▶  约束协议 + 参考实现
  rule-engine（达）                         + 多 Agent 碰撞测试
  PRD2Code（雅）
```

Compass 是这套约束协议在**金融域的生产验证**；SemanticAnchor 是把方法论提炼成**领域无关**的参考实现。迁移边界见 [MIGRATION.md](./MIGRATION.md)。

---

## 许可证

MIT
