# 结构化契约 vs Prompt

> 本文是 [design.md §11](./design.md) 的展开：用同一任务、同一模拟 Agent，对比「只靠 Prompt」与「SemanticAnchor 协议闭环」的差异。

---

## 实验设定

| 项 | 值 |
|----|-----|
| 任务 | 实现限价买入报单：采集 ticker、order side、quantity、trading account |
| Agent 模拟 | `examples/multi-agent/demo.js` 中的 Coder Agent（无 API key，结果可复现） |
| 约束数据 | `examples/quant/constraints.json`（量化 OMS 经典场景） |
| 度量 | **shipped semantic errors** — 若流水线不拦截，最终会交付给用户的语义错误数 |

复现：

```bash
npm run demo          # 完整对比（协议 + 基线）
npm run demo:naive    # 仅基线
```

---

## 基线：Prompt-only

没有 `resolve` / `bind_constraints` / 守门循环。Coder Agent 按典型 LLM 在量化代码里的行为输出：

| 用法 | 问题 | severity |
|------|------|----------|
| `sym` = `aapl` | 非规范名，应为 `ticker`；且 ticker 须大写 | drift + violation |
| `side` = `long` | 非规范名；`long` 不在 `[buy, sell]` | drift + violation |
| `qty` = `100` | 非规范名，应为 `quantity` | drift |
| `account` 明文 | 非规范名；资金账号 sensitive 未标记 masked | drift + violation |

**结果：7 个语义错误全部 shipped。** 基线流水线本身不做 verify-in-the-loop；我们在最后用 `verify_usage` 仅作**事后计量**。

---

## 实验组：SemanticAnchor 闭环

```
Planner  bind_constraints(aliases)
    → bundle 传给 Coder
Coder    生成 usages（注入后命名收敛到 ticker / order_side / quantity / account_id）
Gate     verify_usage(usages)
    → 仍有 violation → 结构化 feedback 回注
Coder    retry（AAPL、buy、masked:true）
Gate     verify_usage → pass
```

| 阶段 | 作用 |
|------|------|
| 注入 | 4 个 drift 在首次生成前被消除 |
| 守门 | 剩余 3 个 violation（ticker 大小写、side 枚举、账号脱敏）被 gate 捕获 |
| 回注 | 结构化 feedback 驱动 1 轮 retry，收敛到 0 |

**结果：0 个语义错误 shipped。**

---

## 对照摘要

| 指标 | Prompt-only | SemanticAnchor |
|------|-------------|----------------|
| shipped 语义错误 | **7** | **0** |
| 命名 drift 拦截 | 无 | 注入阶段消除 |
| 契约 violation 拦截 | 无 | 守门 + retry |
| 可复现 | ✅ 纯本地模拟 | ✅ 同 |

---

## 为什么 Prompt 不够

1. **概率性。** 「side 只能是 buy/sell」「ticker 用大写」写在 prompt 里，模型仍可能输出 `long`、`aapl`。
2. **不可验证。** Prompt 无法产出结构化 violation 列表驱动 retry。
3. **不可传递。** 多 Agent 之间，Planner 解析到的 OMS 实体无法作为标准 bundle 传给 Coder。

---

## 三个 Harness 结论（design.md §11）

1. **结构化契约比 Prompt 更可靠** — 上表 7 vs 0。
2. **约束应在 Tool 层注入 + 行动后验证**，而非塞满 system prompt。
3. **多 Agent 需要标准传递协议** — `bind_constraints` bundle 是 Planner → Coder 的契约载体。

---

## 诚实边界

- 本实验是**模拟 Agent**，不是 live LLM API 调用。
- `unverifiable` 在开放世界中仍会出现；协议不假装全知。
- Type checker / LSP 是 `verify` 的环境裁决来源之一，不是替代品。
