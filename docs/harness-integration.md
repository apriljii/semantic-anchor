# Harness 集成指南

> **读者：Agent Harness / Coding Agent 工程师**  
> HTML 版：[public/harness.html](../public/harness.html) · MCP 配置：[mcp-integration.md](./mcp-integration.md) · 设计权威：[design.md](./design.md) §2.1

---

## 0. 30 秒摘要

SemanticAnchor 是 **Agent Harness 内的语义约束子层**，不是完整 Coding Agent，也不是字段字典。

| 项 | 说明 |
|----|------|
| **解决什么** | 代码能编译，但 **命名引用错了**（字段漂移、枚举编造、幻觉 API、敏感未脱敏） |
| **怎么解决** | Agent loop 里两个卡口：`bind_constraints`（事前）+ `verify_usage`（事后 + retry） |
| **怎么接** | MCP stdio **或** 嵌入 `semantic-gate` 中间件 |
| **证据** | 同一任务 prompt-only ship **9** 语义错，加 gate 后 **0**（`npm run demo`） |

**注入是优化，守门是保证。** 没有 verify，约束只是「建议」。

---

## 1. 在 Harness 栈里的位置

```
┌──────────────────────────────────────────────────────────┐
│  项目级 Harness（你们的主系统）                            │
│  orchestration · repo · shell · sandbox · test · loop    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SemanticAnchor（语义约束子层）                      │  │
│  │  resolve · bind · verify · feedback                │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────┘
                             ↓
              环境裁决：tsc / LSP / pytest / E2E
```

### ✓ 是什么 / ✗ 不是什么

| ✓ | ✗ |
|---|---|
| Harness 内的 **semantic gate** | 完整 Agent runtime |
| 4 动词协议 + ~200 行 MCP 参考实现 | 字段字典 / 低代码 UI |
| 可复现碰撞测试（工程验证报告） | Compass / OpenSpec 替代品 |
| 只约束 **引用面**（名、形、值、策略） | 业务逻辑、规则引擎、跨实体阈值 |

---

## 2. 要拦的 failure mode

语法错误有编译器；**语义错误是 silent failure**：

| 类型 | 例子 | 编译器 | SemanticAnchor |
|------|------|--------|----------------|
| 命名漂移 | `sym` → 应为 `ticker` | 不管 | `DRIFT` |
| 枚举编造 | `long` → 应为 `buy` | 不管 | `ENUM` violation |
| 格式错 | `aapl` → 应为 `AAPL` | 不管 | `PATTERN` |
| 幻觉 API | `placeOrder()` 不存在 | 可能 tsc 才拦 | `SYMBOL_NOT_FOUND` |
| 敏感泄露 | account 明文 log | 不管 | `SENSITIVE_NOT_HANDLED` |

真实产物见 `examples/quant/limit-buy/artifacts/naive.ts → fixed.ts`。

---

## 3. Agent loop：两个卡口

```
用户任务（自然语言）
    │
    ▼
┌─ 卡口 ① 事前 · bind（best-effort）──────────────────┐
│  从任务提取 aliases → bind_constraints               │
│  → bundle 注入 context（declared → system prefix）   │
└──────────────────────────┬───────────────────────────┘
                           ▼
              模型生成代码 / tool calls
                           │
                           ▼
┌─ 卡口 ② 事后 · verify（must-have）──────────────────┐
│  从生成物抽取 usages → verify_usage                  │
│  → ok：放行写盘 / commit                             │
│  → !ok：structured feedback → 模型修改 → 再 verify   │
└──────────────────────────┬───────────────────────────┘
                           ▼
              环境裁决（tsc / test / sandbox）
```

**不可跳过卡口 ②。** 长 prompt 不能替代行动后验证。

### 多 Agent handoff

Planner 的 `bind_constraints` bundle 是传给 Coder 的**标准契约载体**。没有 bundle，ticker / order_side 约束在 handoff 时丢失，漂移重现。

---

## 4. 两种集成方式

### 方式 A · MCP（IDE / 外部 Agent 宿主）

启动 `src/server.js`（stdio），宿主在 Agent 对话中调用四工具。

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

| 工具 | 卡口 | 职责 |
|------|------|------|
| `resolve` | ① | 别名 → 规范 id；miss → unresolved |
| `get_constraint` | ① | 读单个 ConstraintUnit |
| `bind_constraints` | ① | 打包 bundle + 注入位指引 |
| `verify_usage` | ② | 契约裁决 + feedback |

详见 [mcp-integration.md](./mcp-integration.md)（Cursor / Claude Desktop / VS Code / Windsurf / …）。

**适用：** 已有 MCP 宿主、希望 Agent 自主调工具、快速试验。

---

### 方式 B · Library 嵌入（自研 Harness / CI）

在 loop 代码里直接调 `dispatch` 或 `semantic-gate`，不经过 MCP。

```javascript
const { createStore } = require('./src/protocol/constraint-store');
const { createSemanticGate } = require('./examples/harness-hook/semantic-gate');

const store = createStore();
store.load(require('./examples/quant/constraints.json'));
const gate = createSemanticGate(store, { maxRetries: 3 });

// 卡口 ①
const { bundle, injection } = gate.bind({
  aliases: ['ticker symbol', 'order side', 'quantity', 'account'],
  extraConstraints: [], // 可选：derived 单元
});

// ... 模型生成，抽取 usages ...

// 卡口 ②
const outcome = await gate.enforce(usages, {
  retry: async (feedback, attempt) => {
    // 调模型读 feedback，返回新 usages
    return fixedUsages;
  },
  environment: tscAdjudicator, // 可选
});

if (!outcome.ok) throw new Error('semantic gate failed');
// 才允许 write_file / git commit
```

演示：`npm run demo:harness`

**适用：** 自研 Harness、CI gate、要强控 retry 策略、不想依赖 Agent 记得调 MCP。

---

### 方式 C · 混合（生产常见）

| 阶段 | 做法 |
|------|------|
| Planner | Harness 内 `gate.bind()`，bundle 写入 session / handoff |
| Coder | context 注入 bundle；生成后 Harness 强制 `gate.enforce()` |
| IDE 联调 | 同时暴露 MCP 供人工 Agent 调试 |

---

## 5. 约束数据从哪来（`SA_CONSTRAINTS`）

`constraints.json` = `{ "units": [ ConstraintUnit, ... ] }`，格式见 [spec/constraint-unit.schema.json](../spec/constraint-unit.schema.json)。

### provenance 三分法

| provenance | 来源 | 放哪 |
|------------|------|------|
| **declared** | 户口簿、OpenAPI、schema 编译、手写 | `SA_CONSTRAINTS` 主文件 |
| **derived** | TS 签名、LSP、OpenAPI 运行时扫描 | `bind({ extraConstraints })` |
| **emergent** | 会话中用户追加约束 | `register()` / 会话 store |

### 推荐流水线（有 Spec 体系时）

```
pm.md / spec.md  →  编译链  →  schema.json (+ api.json)
                              ↓ transform（切片）
                         constraints.json  →  SA_CONSTRAINTS
Apply 时 TS/OpenAPI 扫描  →  extraConstraints（derived）
```

本 repo **未包含** Compass 编译链；可手写 `constraints.json` 或自建 transform。示例：[examples/quant/constraints.json](../examples/quant/constraints.json)。

校验：`npm run validate:spec`

---

## 6. usages：verify 的输入

`verify_usage` 消费结构化 **usages**，不是 raw 源码：

```json
{
  "usages": [
    { "name": "ticker", "value": "AAPL" },
    { "name": "order_side", "value": "buy" },
    { "name": "account_id", "value": "ACC12345678", "masked": true },
    {
      "name": "submit_order",
      "kind": "call",
      "args": [
        { "name": "ticker" },
        { "name": "order_side" },
        { "name": "quantity" }
      ]
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `name` | 字段名或 symbol 规范 id |
| `value` | 字面值（field 时） |
| `kind: "call"` | API / 函数调用；缺则 symbol 校验不触发 |
| `masked: true` | 敏感字段在输出路径已脱敏 |
| `args` | signature 参数是否齐全 |

### 生产抽取（本 repo demo 用预定义映射）

| 方式 | 说明 |
|------|------|
| **AST / LSP** | 从 TS/JS 生成物解析字段赋值、call expression |
| **Agent manifest** | 模型输出结构化 field manifest（需 schema 约束输出） |
| **Hybrid** | 模型 draft + AST 校正 |

见 `design.md` §6 诚实说明。

---

## 7. derived 约束（开放世界 API）

静态 `constraints.json` 通常只有 declared 字段/枚举。项目内 API 签名应运行时派生：

```javascript
const { deriveFromTypescript } = require('./examples/derived/scan-typescript');

const derived = deriveFromTypescript('./artifacts/oms-api.ts');
gate.bind({
  aliases: [...mentioned, 'submit order'],
  extraConstraints: derived,
});
```

演示：`npm run demo:derived`

---

## 8. 环境裁决（与 tsc 分工）

| 层 | 验证什么 |
|----|----------|
| **verify_usage** | 引用是否符合契约（drift / enum / pattern / sensitive / symbol） |
| **environment** | 编译器、测试、lint 的 ground truth |

```javascript
const { createTscAdjudicator } = require('./src/adapters/tsc-environment');

call('verify_usage', {
  usages,
  environment: createTscAdjudicator({ diagnostics }),
});
```

演示：`npm run demo:env`

**互补，不替代。** tsc 不管 `sym` vs `ticker` 的语义契约。

---

## 9. 接入检查清单

### 最小可行（MVP）

- [ ] `constraints.json` 覆盖任务相关 field / enum
- [ ] loop 在写文件前调用 `verify_usage`
- [ ] violation 时 structured feedback 回注模型
- [ ] retry 上限（如 3 次）
- [ ] `npm run demo:harness` 本地跑通

### 生产加强

- [ ] usages 从 AST/LSP 抽取，非手写
- [ ] derived 扫描 TS/OpenAPI 补 signature
- [ ] Planner→Coder bundle handoff 标准化
- [ ] tsc/test 接入 environment
- [ ] 约束变更走 schema/transform SSOT
- [ ] metrics：shipped semantic errors、retry 次数、violation 分布

---

## 10. 5 分钟验证

```bash
git clone <repo> semantic-anchor && cd semantic-anchor
npm install

npm run demo:harness    # Library 嵌入：bind → enforce → retry
npm run demo            # 碰撞测试 9 → 0
npm run demo:derived    # declared + derived + gate
npm test                # 协议单测 + 回归
```

交互走读：[walkthrough.html](../public/walkthrough.html)

---

## 11. FAQ

### 和 LSP / type checker 什么关系？

LSP 是 verify 的 **environment 来源之一**。SemanticAnchor 额外覆盖 **契约级语义**（枚举、pattern、敏感策略、symbol 存在性），编译器不覆盖。

### 和 OpenSpec / Spec-Driven 什么关系？

OpenSpec 管 **变更怎么流、测什么**；SemanticAnchor 管 **Apply 时生成物引用别漂**。应串联，不重复。详见 [ecosystem.html](../public/ecosystem.html)。

### 规则引擎要不要写进 ConstraintUnit？

**不要。** 业务阈值、跨实体规则属于规则引擎（Non-Goal）。ConstraintUnit 只描述引用形状。

### MCP 和 Library 选哪个？

| 选 MCP | 选 Library |
|--------|------------|
| 已有 MCP 宿主 | 自研 Harness |
| 快速试验 | 要强控 gate 时机 |
| Agent 自主调工具 | CI / 无 IDE |

### verify 全 unverifiable？

- usages 的 `name` 是否对齐 constraints 的 `id` / `aliases`
- symbol 调用是否带 `kind: "call"`
- store 是否加载了对应 signature 单元

### 约束为空？

检查 `SA_CONSTRAINTS` 路径；`npm run mcp` 时 stderr 应输出 `loaded N constraint unit(s)`。

---

## 12. 相关文件

| 路径 | 说明 |
|------|------|
| `src/dispatch.js` | server 与 demo 单一事实来源 |
| `examples/harness-hook/semantic-gate.js` | 推荐中间件 |
| `src/protocol/bind.js` · `verify.js` | 卡口实现 |
| `examples/quant/constraints.json` | declared 示例 |
| `docs/design.md` | 权威设计 |

---

*本文档面向 Harness 集成；协议细节以 design.md 为准。*
