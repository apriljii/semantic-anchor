# SemanticAnchor 设计文档（权威基调）

> **本文档是 SemanticAnchor 项目的唯一权威设计来源。**
> 代码、README、示例、对外叙事，一切以本文为准。任何实现与本文冲突，改实现，不改本文；
> 任何要改本文的设计变更，先改本文、说明理由，再动代码。
>
> 状态：v1 · 叙事结构：公式分解法（Formula Decomposition）
> 适用：Agent Harness 场景下的「模型输出约束」

---

## 叙事地图

| 幕 | 章节 | 回答的问题 |
|----|------|------------|
| 第一幕 · 为什么 | §0–§1 | 为什么要做？核心命题是什么？ |
| 第二幕 · 是什么 | §2（2.1–2.4） | 语义锚由哪几块构成？每块分别是什么？ |
| 第三幕 · 为什么必须这样 | §3–§4 | 开放世界为何需要 Gate？多 Agent 为何需要 bundle？ |
| 第四幕 · 怎么落地 | §5–§6 | 四动词如何映射构成？一次报单如何跑通？ |
| 第五幕 · 证明与边界 | §7–§11 | 7→0 证明了什么？与 Compass/LSP 的边界？ |

> 讲述版见 [`public/architecture.html`](../public/architecture.html)

---

## 0. 一句话 + 边界

> **SemanticAnchor 是一个引用级（reference-level）的约束协议。它让 AI Agent 在开放世界任务中，对「命名实体的引用」的理解与生成变得可控、可验证、可收敛。**

| ✓ 是什么 | ✗ 不是什么 |
|----------|------------|
| Harness 的**语义约束子层** | 字段字典 / 低代码 / Compass 开源版 |
| ConstraintUnit 协议 + MCP 参考实现 | 项目空间级 Harness（不取代 Claude Code 等） |
| 可复现的**工程验证报告** | 完整 coding agent runtime |

它是从 Compass 户口簿里**提炼的方法论 + 参考实现**：用结构化契约，约束模型输出里最不可控的部分——**语义**。

---

## 1. 核心命题

主流叙事说「让模型更强」。但在真实编码 Agent 里，最先崩的不是模型能力，是**可控性**。

```
语法错误   → 编译器会拦，确定性问题，已被解决
语义错误   → 没人拦。sym 代替 ticker、side 写成 long 而非 buy、
            调用根本不存在的 submitOrder()……
            代码能跑、能编译，但引用是错的
```

**核心命题（本项目要证明的结论）：**

> **AI 生成代码时，最不可控的不是语法，是语义。**
> **语义可控的最小化工程手段，是结构化契约，而不是 Prompt。**

Prompt 是概率性软约束；结构化契约是工程性硬约束——可解析、可注入、**被验证**。

---

## 2. 语义锚的构成（总览）

语义锚 = 四块公式，缺一不可：

```
语义锚 = 锚（ID） + 链（Contract） + 抛锚（Inject） + 绷紧（Gate）

  Canonical ID    +   Verifiable Contract   +   resolve / bind    +   verify / feedback
  规范名「钉」          形状/枚举/策略            best-effort 注入        must-have 守门
```

| 构成 | 回答 | 性质 |
|------|------|------|
| **2.1 锚** | 约束**什么** | 核心对象 |
| **2.2 链** | 契约**长什么样** | 数据模型 |
| **2.3 抛锚** | 事前**怎么进 context** | best-effort |
| **2.4 绷紧** | 事后**怎么裁决** | must-have |

> **没有 verify，就没有「锚」，只有「建议」。注入是优化，守门是保证。**

以下四节逐块讲完；读完 §2 应能独立解释 SemanticAnchor 是什么，无需跳到后面章节。

---

### 2.1 锚 · Canonical ID（约束什么）

模型从**意图空间**跨越到**实现空间**，每一步都要把「叫法」绑定到「实现物」：

```
意图空间                    实现空间
"标的代码"           ──绑定──▶   ticker : string, pattern=^[A-Z0-9.]+$
"买卖方向"           ──绑定──▶   order_side : enum[buy|sell]
"限价报单"           ──绑定──▶   submitOrder(ticker, side, qty, ...) -> order_id
                    ↑
              语义幻觉就在这一步发生
        (sym / "long" / 调用不存在的 submitOrder)
```

**SemanticAnchor 只约束这个「绑定」**——引用解析 + 契约。对象是**命名实体的引用**：

| 约束 | 不约束 |
|------|--------|
| 命名物**存不存在** | 命名物**做什么**（业务逻辑） |
| 它**叫什么**（规范名 vs 漂移名） | 控制流、架构决策 |
| **类型/形状/合法值/策略** | 规划、任务编排 |
| 跨上下文的**命名映射** | |

**引用谱系（kind）：**

```
field (ticker)  →  param (quantity)  →  enum (order_side)
  →  symbol (submitOrder)  →  signature / endpoint（复合）
```

> **窄腰原则**：只管「引用」这一薄切面，不管「逻辑」。`submitOrder` 存不存在、签名是什么 → 在范围内；内部撮合逻辑对不对 → 不在范围内。

#### 在 Harness 中的位置

SemanticAnchor 是**项目级 Harness 内的语义约束子层**，不是 Harness 本身：

```
┌──────────────────────────────────────────────────────────────┐
│  项目级 Harness（Claude Code / Cursor Agent / 自研 loop）      │
│  · 用户意图 · 规划/执行 · 文件编辑 · shell · 测试 · 多轮状态    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  SemanticAnchor（语义约束子层）                          │  │
│  │  resolve · get_constraint · bind_constraints · verify   │  │
│  └────────────────────────────────────────────────────────┘  │
│  · 环境裁决仍由 tsc / pytest / eslint 等外部真理承担          │
└──────────────────────────────────────────────────────────────┘
```

| 层 | 职责 | SemanticAnchor 是否覆盖 |
|----|------|-------------------------|
| Harness 外层 | repo 理解、工具编排、权限、会话记忆 | ❌ 不取代 |
| **语义约束子层** | 引用解析、契约注入、行动后守门 | ✅ 本协议 |
| 环境真理 | 编译、类型、测试、lint | 作为 verify 的输入，不替代 |

#### 集成到 Agent 设计：应该怎样接线

把 SemanticAnchor 接进 Agent，**不是**在 system prompt 里多写几条命名规范，而是在 **Agent loop 的两个卡口**挂工具：

```
用户意图
    │
    ▼
┌─ ① 抛锚（best-effort）────────────────────────────────────┐
│  Planner / Orchestrator 从任务提取 aliases                  │
│  → bind_constraints(aliases [, extraConstraints])          │
│  → bundle + injection 指引（declared→system 前缀；derived→JIT）│
└──────────────────────────┬───────────────────────────────┘
                           ▼
              Coder / Executor 生成（代码、调用、字段赋值…）
                           │
                           ▼
┌─ ② 绷紧（must-have）──────────────────────────────────────┐
│  从生成物抽取 usages → verify_usage(usages [, environment]) │
│  → pass：Harness 继续（写文件 / 跑测试 / 提交）              │
│  → fail：结构化 feedback 回注 → Coder 重试（有上限）          │
└────────────────────────────────────────────────────────────┘
```

**三种常见接法：**

| 接法 | 适用 | 做法 |
|------|------|------|
| **MCP 工具** | Cursor / Claude Desktop 等 | 注册 `semantic-anchor` MCP；Agent 在规划与生成后主动调四动词 |
| **Harness 中间件** | 自研 coding agent | 在「执行工具前」调 `bind`，在「工具返回后 / patch 落地前」调 `verify` |
| **进程内库** | Demo / CI 碰撞测试 | `createDispatcher(store)` 直接调，如 [`examples/multi-agent/demo.js`](../examples/multi-agent/demo.js) |

**单 Agent vs 多 Agent：**

```
单 Agent：  同一 loop 内 bind → act → verify → retry

多 Agent：  Planner --bind→ bundle --handoff→ Coder --act→ usages
                                              ↓
                                    Gate(verify) --feedback→ Coder
```

多 Agent 时 **bundle 是标准 handoff 载荷**——Planner 解析到的 `ticker` / `order_side` 契约必须结构化传递；否则 Coder 退回 prompt 软约束，漂移重现（见 §4）。

**集成时 Agent 设计者应遵守：**

1. **守门不可跳过** — 凡产出含命名引用（字段、枚举、符号、签名）的 act，落地前必须 `verify_usage`。
2. **注入不可替代守门** — `bind_constraints` 提高首次正确率，不保证遵守；可靠性压在 verify。
3. **derived 约束要喂进来** — 从 AST / OpenAPI / LSP 派生的 ConstraintUnit 通过 `extraConstraints` 传入 bind，不由协议凭空发明。
4. **环境裁决并列** — tsc / pytest 结果可规整进 verify 的 `environment` 钩子；SemanticAnchor 统一 violation 形状，不取代测试 runner。
5. **miss 诚实处理** — `unresolved` / `unverifiable` 不硬失败、不编造；由 Agent 决定追问用户或带风险继续。

**不应做的事：** 用 SemanticAnchor 取代文件编辑、shell、测试编排；把业务规则塞进 ConstraintUnit；仅靠 system prompt 承载全部语义约束。

---

### 2.2 链 · Verifiable Contract（契约长什么样）

协议的灵魂是 **ConstraintUnit**：把一个命名引用绑到**可验证契约**上。权威结构见 [`spec/constraint-unit.schema.json`](../spec/constraint-unit.schema.json)。

```jsonc
{
  "id": "ticker",
  "kind": "field",
  "aliases": ["symbol", "sym", "标的"],
  "type": "string",
  "provenance": "declared",
  "constraints": { "required": true, "pattern": "^[A-Z0-9.]{1,12}$" },
  "policies": [],
  "mappings": [{ "context": "wind", "name": "s_info_windcode" }]
}
```

**原子 vs 复合：**

- **原子**：field / param / enum / symbol — 单个标量引用。
- **复合**：signature / endpoint — 经 `members` 引用多个原子 unit + 结构元信息。

```jsonc
{
  "id": "submit_order",
  "kind": "signature",
  "aliases": ["placeOrder", "报单", "下单"],
  "provenance": "derived",
  "members": [
    { "role": "param", "ref": "ticker", "position": 0 },
    { "role": "param", "ref": "order_side", "position": 1 },
    { "role": "returns", "ref": "order_id" }
  ]
}
```

**provenance（约束从哪来）** — 来源 ≠ 对象：

| provenance | 含义 | 例子 |
|------------|------|------|
| **declared** | 预注册、人工策展 | 户口簿、OpenAPI、团队命名规范 |
| **derived** | 从项目空间派生 | TS 类型、DTO、LSP 符号表 |
| **emergent** | 会话累积 | 「保持 API 向后兼容」 |

SemanticAnchor **不发明**规范 id，只锚定上下文里已有的标准。无标准 → `unresolved` / `unverifiable`，**不编造**。

**三种 Schema 必须分清：**

| 名称 | 是什么 | 在本项目 |
|------|--------|----------|
| **协议 Schema** | ConstraintUnit 元结构 | `constraint-unit.schema.json` ✅ |
| **约束实例** | 某 ticker/side 的具体标准 | `constraints.json` ✅ |
| **Compass 业务 Schema** | 低代码 page/ui/api | ❌ Non-Goal |

**constraints 负面清单**（禁止退化成规则引擎）：

- ❌ 业务阈值（「金额 ≥ 5 万触发审核」）
- ❌ 跨实体规则 · 时变策略

这些属于 Compass 规则引擎（达层），不在 ConstraintUnit 内。

---

### 2.3 抛锚 · Inject（事前怎么进 context）

**职责：** 检索任务相关约束 → 打包 → 注入模型上下文，提高首次正确率。

**机制：** `resolve` + `get_constraint` + `bind_constraints`

```
任务 aliases → resolve（best-effort）→ bind bundle → 注入
                    │ miss → unresolved + 候选，不编造
```

**选用原则（不是人从全库勾选）：**

| 原则 | 含义 |
|------|------|
| 任务相关才 bind | 不全库灌 context，只 bind 任务提到的实体 |
| resolve 允许 miss | miss 是开放世界常态，不是错误 |
| 检索 + 验证 | 不用脆弱的「意图硬分类」，靠 verify 兜底 |
| provenance 决定注入位 | declared → system 前缀；derived/emergent → JIT |

```
户口簿 miss:     「请补录字段」（封闭飞轮）
SemanticAnchor:  status:'unresolved' → verify 兜底
```

---

### 2.4 绷紧 · Gate（事后怎么裁决）

**职责：** 验证生成物是否违反契约 + 环境裁决 → 结构化 feedback → 重试收敛。

**机制：** `verify_usage`

```
模型 act → verify → 通过 | violation/drift → feedback 回注 → retry → 收敛
```

**三种 severity：**

| severity | 含义 | 处理 |
|----------|------|------|
| `violation` | 违反契约（枚举/格式/敏感未处理） | **必须修** |
| `drift` | 有规范 id 却用非规范名（sym → ticker） | 应修 |
| `unverifiable` | 无约束锚定 | 报告，不硬失败 |

**两个 ground truth：**

1. **契约自身** — type / pattern / enum / policy（确定性）。
2. **运行时环境**（可插拔）— tsc / pytest / eslint，规整为同一 violation 结构。

> LSP / type checker 是环境裁决**来源之一**，不是替代品。SemanticAnchor 统一 declared + derived + emergent 的注入与验证面。

---

## 3. 封闭世界 vs 开放世界

§2 讲清了「构成是什么」。本节讲「**为什么开放世界必须四块齐全**」——尤其为什么仅有 Inject（户口簿那半）不够。

| 维度 | 户口簿（封闭） | SemanticAnchor（开放） |
|------|----------------|------------------------|
| 输入 | 可枚举别名 | 无边界 prompt + 任意代码库 |
| 约束来源 | 策展字典 | 环境派生 + 会话累积 |
| 命中率 | 高；miss 是异常 | 低；miss 是常态 |
| 作用点 | 输入解析（resolve） | **行动守门**（verify） |
| 验证真理 | 协议自洽（查表即对） | **环境裁决** |

**三个根本转移：**

1. **作用点**：输入解析 → 行动守门
2. **来源**：策展字典 → 环境派生
3. **验证真理**：协议自洽 → 环境裁决

> **户口簿是 SemanticAnchor 在封闭世界、declared-only 的退化特例。**
> 封闭世界里 Inject（查表）≈ 保证；开放世界里 Inject 不再可靠，**必须补上 Gate**。

---

## 4. 多 Agent 与 bundle 传递

§2.3 的 bundle 不只是「少占 context」——它是 **Planner → Coder 的标准 handoff 协议**。

```
Planner  bind_constraints(aliases)  →  bundle
Coder    读 bundle 生成 usages
Gate     verify_usage(usages)        →  feedback → Coder retry
```

没有标准 bundle，Planner 解析到的 `ticker` / `order_side` 契约在 handoff 时丢失，Coder 退回 prompt 软约束 → 语义漂移重现。

> 碰撞测试 [`examples/multi-agent/demo.js`](../examples/multi-agent/demo.js) 用纯本地模拟证明：bundle 传递 + gate 闭环可将 shipped 语义错误从 7 收敛到 0。

---

## 5. 四动词 = 构成的 MCP 映射

协议只暴露 **4 个工具** — 它们是 §2 四块的操作化，不是另起一套概念：

| 工具 | 对应构成 | 闭环位置 | 性质 |
|------|----------|----------|------|
| `resolve` | 锚 · 解析面 | 注入前 | best-effort |
| `get_constraint` | 链 · 读契约 | 注入前 | 查询 |
| `bind_constraints` | 抛锚 · Inject | ① 事前 | best-effort |
| `verify_usage` | 绷紧 · Gate | ② 事后 | **must-have** |

户口簿 16 个工具（suggest_field、compile_schema…）是**产品面**，不进开源协议。

---

## 6. 走读：量化限价报单

任务（见 demo）：*Implement a limit buy order submission: ticker symbol, order side, quantity, and trading account id.*

| 步骤 | 动作 | 结果 |
|------|------|------|
| 1 | Planner `bind_constraints` | 4 实体 resolved → bundle |
| 2 | 注入 | Coder 拿到 canonical id，消除 4 处 drift |
| 3 | Coder 首次生成 | 仍错：`aapl`（pattern）、`long`（enum）、account 未 masked |
| 4 | Gate `verify_usage` | 3 violations → 结构化 feedback |
| 5 | Coder retry | `AAPL` / `buy` / `masked:true` |
| 6 | Gate 再次 verify | pass → **0 shipped 错误** |

Naive 基线（无 bind、无 loop）：同样生成物 → **7 错误全部 shipped**。

---

## 7. 碰撞测试报告

开源目的：给出可复现的工程验证，证明 Harness 团队关心的三件事：

1. **结构化契约比 Prompt 更可靠** — 7 vs 0（见 [`docs/vs-prompt.md`](./vs-prompt.md)）
2. **约束应在 Tool 层注入 + 行动后验证**，而非塞满 system prompt
3. **多 Agent 之间必须有标准 bundle 协议**

> README 定调：「这不是产品，是工程验证报告。」

---

## 8. 与 Compass / LSP / 规则引擎

```
Compass（私有 · 生产）                 SemanticAnchor（开源 · 协议）
  field-registry（信）  ──提炼 declared──▶  约束协议 + 参考实现
  rule-engine（达）                         + 量化 demo 碰撞测试
  PRD2Code（雅）
        │ 金融域 implementation              │ 方法论 protocol
        └──────── implements ────────────────┘
```

| 对比 | 关系 |
|------|------|
| **Compass 户口簿** | declared 层的生产实例；约 40% 迁移到协议骨架 |
| **LSP / type checker** | verify 的环境裁决来源之一 |
| **规则引擎（达）** | 业务阈值/跨实体规则 → Non-Goal |
| **Prompt** | 软约束；本报告 7→0 证明不够 |

迁移边界见 [`MIGRATION.md`](../MIGRATION.md)。

---

## 9. 设计原则

1. **结构化契约优先于 Prompt。**
2. **注入是优化，守门是保证。**
3. **miss 是常态，不是错误。**
4. **验证消费外部真理。**
5. **只约束引用，不约束逻辑。**（窄腰）
6. **约束只描述形状，不描述业务。**（负面清单）
7. **协议最小化** — 4 个动词。
8. **示例用量化经典场景**；Compass 生产户口簿数据保持私有。
9. **单一事实来源** — dispatch 统一 server 与 demo。

---

## 10. 非目标（Non-Goals）

- ❌ 不约束逻辑 · 不做项目级 harness · 不做业务字典
- ❌ 不做规则引擎 · 不做低代码 Schema 渲染
- ❌ 不做完整 coding agent runtime
- ❌ 不追求工具数量 · 不假装意图识别可靠

---

## 11. 术语表

| 术语 | 定义 |
|------|------|
| **ConstraintUnit** | 锚定一个命名引用的最小可验证契约单元 |
| **命名实体引用** | field / param / enum / symbol / signature / endpoint |
| **provenance** | declared / derived / emergent |
| **anchor（锚定）** | 模糊理解 → 规范 id + 契约 |
| **inject / gate** | 事前 bind（best-effort）/ 事后 verify（must-have） |
| **drift** | 有规范 id 却用非规范名 |
| **unverifiable** | 无约束锚定；报告但不硬失败 |
| **窄腰** | 只约束引用，不约束逻辑 |
| **环境裁决** | 编译器/测试等外部 ground truth |
| **闭环** | 注入 → act → 守门 → 回注 → 收敛 |

---

*本文档为项目基调。修改需谨慎，先改文档、后改代码。*
