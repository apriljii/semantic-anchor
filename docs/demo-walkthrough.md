# 真实示例 Walkthrough · 限价买入 AAPL

> 用一份**可读的 TypeScript 报单代码**走通 SemanticAnchor 全流程。
> 交互版：`public/walkthrough.html` · 终端版：`npm run demo:walkthrough`

---

## 场景

**PM 任务：**

> Implement a limit buy order submission for AAPL @ 178.50: ticker symbol, order side, quantity, and trading account id.

**Planner** 提取 aliases → `bind_constraints` → **bundle** 传给 **Coder**。

**Coder** 生成 `submitLimitBuy()` — Harness 从代码提取 structured **usages**，交给 `verify_usage` 裁决。

---

## 产物（真实代码文件）

```
examples/quant/limit-buy/
├── scenario.js              # 任务、usages 映射、注释
└── artifacts/
    ├── naive.ts             # 无协议：sym / long / aapl / 明文 log
    ├── draft.ts             # 有 inject：命名对了，值/策略仍错
    └── fixed.ts             # Gate feedback + 1 retry 后收敛
```

| 文件 | 模拟阶段 | shipped 语义错误 |
|------|----------|------------------|
| `naive.ts` | Prompt-only 流水线直接上线 | **7** |
| `draft.ts` | 注入后首次生成（若不经 Gate 上线） | 3 |
| `fixed.ts` | verify 闭环 + 1 次 retry | **0** |

---

## 四步叙事（与 design.md §6 对齐）

| Step | 角色 | 动作 | 读者看到什么 |
|------|------|------|--------------|
| 1 | Planner | `bind_constraints` | bundle JSON + systemPrefix |
| 2 | Naive Coder | 无 bind/verify 循环 | `naive.ts` 全文 + 7 处标注 |
| 3 | Protocol Coder | 读 bundle 生成 | `draft.ts` + Gate feedback |
| 4 | Coder retry | 读 feedback 修正 | `fixed.ts` → pass |

---

## 运行

```bash
# 逐步 narrated walkthrough（推荐首次阅读）
npm run demo:walkthrough

# 仅 metrics 对比（7 vs 0）
npm run demo

# 浏览器交互版
npm run preview
# → http://localhost:4173/walkthrough.html
```

---

## 与抽象 demo 的关系

| 命令 | 用途 |
|------|------|
| `demo:walkthrough` | **理解**：代码 + 分步 + 注释 |
| `demo` | **证明**：可复现 metrics，面试 30 秒版 |

两者共用 `examples/quant/limit-buy/scenario.js`，保证 usages 与代码文件一致。

---

## Harness 视角（诚实说明）

本 walkthrough **不解析 TypeScript AST**。`usages` 是 Harness 从生成物里**应提取的结构化视图**——demo 用预定义映射代替 AST 提取，以便无 API Key、100% 可复现。

生产 Harness 中，同一份 `verify_usage` 输入来自：静态提取、lint 规则、或 Agent 自报的 field manifest。
