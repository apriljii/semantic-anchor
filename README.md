# SemanticAnchor

**这不是一个产品，是一份工程验证报告。** 它验证了一个结论：AI 生成代码时，最不可控的不是语法，是语义。这套协议，是让语义变得可控的最小化工程实现。

SemanticAnchor 是一个**引用级（reference-level）约束协议**：让 Agent 在开放世界任务中，对命名实体引用（字段、参数、枚举、符号、签名、接口）的理解与生成变得**可控、可验证、可收敛**。它不是字典，不是低代码，不是 Compass 的开源版——而是从生产级 field-registry 中提炼出的**方法论 + MCP 参考实现**。

> 权威设计：[docs/design.md](./docs/design.md)（公式分解法五幕结构）· 架构叙事：[public/architecture.html](./public/architecture.html)

---

## 核心公式

```
Canonical ID  +  Verifiable Contract  +  Inject/Gate Loop
```

| 半环 | 工具 | 性质 |
|------|------|------|
| 注入（事前） | `resolve` · `get_constraint` · `bind_constraints` | best-effort，提高首次正确率 |
| 守门（事后） | `verify_usage` | must-have，环境裁决，结构化回注 |

**注入是优化，守门是保证。** 封闭世界的户口簿只有注入；开放世界必须补上守门。

---

## 碰撞测试（可复现）

同一**量化限价买入报单**任务，模拟 Coder Agent 的典型语义幻觉（`sym`/`long` 命名漂移、小写 ticker、资金账号未脱敏）：

```bash
npm run demo          # 协议闭环：7 → 0 个 shipped 语义错误
npm run demo:naive    # 仅 prompt 基线：7 个错误无人拦截
```

详见 [docs/vs-prompt.md](./docs/vs-prompt.md) 与 [examples/multi-agent/demo.js](./examples/multi-agent/demo.js)。

---

## 快速开始

```bash
git clone <repo-url> semantic-anchor && cd semantic-anchor
npm install

# 跑碰撞测试
npm run demo

# 启动落地页 + 架构文档预览
npm run preview
# → http://localhost:4173
# → http://localhost:4173/architecture.html

# MCP stdio 服务（Cursor / Claude Desktop 等）
npm run mcp
```

### Cursor MCP 配置示例

```json
{
  "mcpServers": {
    "semantic-anchor": {
      "command": "node",
      "args": ["/absolute/path/to/semantic-anchor/src/server.js"],
      "env": {
        "SA_CONSTRAINTS": "/absolute/path/to/semantic-anchor/examples/quant/constraints.json"
      }
    }
  }
}
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
├── docs/design.md              # 权威设计（改代码前先改它）
├── docs/vs-prompt.md           # 结构化契约 vs Prompt 对照
├── MIGRATION.md                # 从 field-registry 的迁移边界
├── spec/constraint-unit.schema.json
├── src/
│   ├── server.js               # MCP stdio
│   ├── dispatch.js             # 单一事实来源
│   └── protocol/               # resolve · bind · verify
├── examples/
│   ├── quant/constraints.json
│   └── multi-agent/demo.js
└── public/
    ├── index.html              # 落地页
    └── architecture.html       # 架构文档
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
