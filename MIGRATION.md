# 从 field-registry 到 SemanticAnchor

> 本文说明迁移边界：**什么从 Compass 户口簿来、什么是开放世界新建、什么 deliberately 不迁。**
> 权威设计见 [docs/design.md](./docs/design.md)。

---

## 一句话

**约 40% 站在户口簿肩膀上，约 60% 是开放世界新工程。**

户口簿是 SemanticAnchor 在**封闭世界（declared-only）的退化特例**——不是它的天花板。

---

## 迁移对照表

| field-registry（Compass · 私有） | SemanticAnchor（开源） | 变化 |
|----------------------------------|------------------------|------|
| `inherentRules` | `constraints` | 抽象为领域无关形状契约；负面清单禁止业务阈值 |
| `synonyms` + `systems` 别名索引 | `aliases` + `resolve()` | miss → `unresolved`（常态），不再「请补录字段」 |
| `resolve_field` | `resolve` | best-effort；不报错、不编造 |
| `get_field_info` | `get_constraint` | 返回 ConstraintUnit，kind 扩展到 symbol/signature/endpoint |
| `get_scene_bundle` / scene match | `bind_constraints` | 场景 bundle → 任务实体 bundle；去掉金融 scene 概念 |
| — | `verify_usage` | **新建**：环境裁决 + 结构化 feedback（户口簿无对应物） |
| MCP stdio server 骨架 | `src/server.js` | 保留薄 server；工具从 16 减到 4 |
| `fieldService` 单一事实来源 | `dispatch.js` | REST 去掉；server 与 demo 共用 dispatch |
| 金融域 fields JSON | `examples/quant/constraints.json` | 公开量化契约示例；Compass 生产户口簿数据保持私有 |
| — | `provenance: derived \| emergent` | **新建**：开放世界约束来源 |
| — | `examples/multi-agent/demo.js` | **新建**：碰撞测试报告 |

---

##  deliberately 不迁移

以下属于 Compass **产品面**，不是协议面：

| 能力 | 原因 |
|------|------|
| `search_fields` / `list_domains` | 字典浏览 UI，非协议动词 |
| `standardize_fields` / `generate_mapping` | 代码生成产品功能 |
| `check_sensitive` / `translate_enum` | 并入 `get_constraint` + `verify_usage` |
| `suggest_field` / 数据飞轮 | 封闭世界补录闭环，开放世界 miss 是常态 |
| `match_scene` / `compile_schema` / `get_schema` | 低代码 Schema 驱动，Non-Goal |
| REST API server | 开源库只暴露 MCP stdio |
| 16 个 MCP 工具 | 协议最小化：4 个动词足够 |

---

## 概念映射

```
field-registry                          SemanticAnchor
─────────────────────────────────────────────────────────────
Field                                   ConstraintUnit (kind=field)
Field.type                              ConstraintUnit.type
Field.inherentRules                     ConstraintUnit.constraints
Field.sensitive / pii                   ConstraintUnit.policies
Field.synonyms + systems mappings       ConstraintUnit.aliases + mappings
resolve_field miss → suggest            resolve miss → unresolved → verify 兜底
（无）                                   verify_usage → violation/drift/unverifiable
declared only                           declared + derived + emergent
输入解析（理解）                         注入 + 行动守门（理解 + 生成）
协议自洽（查表即对）                     环境裁决（编译器/测试说了算）
```

---

## 代码层对应（便于面试叙述）

| field-registry 路径 | SemanticAnchor 路径 |
|---------------------|---------------------|
| `src/services/field-service.js` → `resolveAlias` | `src/protocol/resolve.js` |
| `src/data-loader` + fields JSON | `src/protocol/constraint-store.js` |
| `src/mcp/server.js`（16 tools） | `src/server.js`（4 tools） |
| scene bundle 逻辑（分散在 REST/MCP） | `src/protocol/bind.js` |
| （不存在） | `src/protocol/verify.js` |

---

## 数据迁移注意

1. **不要**把 Compass 金融 fields JSON 复制进开源 repo。
2. 若从 declared 约束迁移，映射规则：
   - `fieldId` → `id`
   - `displayName` → `label`
   - `synonyms[]` → `aliases[]`
   - `inherentRules` → `constraints`（剔除业务阈值类规则）
   - 新增 `"provenance": "declared"`, `"kind": "field"`
3. 复合 API（签名/接口）在 SemanticAnchor 用 `kind: signature` + `members[]` 表达，不是单个 fat field。

---

## 验证迁移结果

```bash
npm run validate:spec    # 校验 examples 下的 ConstraintUnit
npm run demo             # 碰撞测试 7 → 0
npm run mcp              # MCP server 启动（stdio）
```

---

## 对外叙事（面试用）

> 「Compass field-registry 是 SemanticAnchor 在封闭世界、金融域的生产实现；SemanticAnchor 是把『命名实体引用 + 可验证契约 + 注入守门闭环』提炼成领域无关的参考协议。户口簿解决的是『别名能不能对上』；SemanticAnchor 解决的是『Agent 生成物有没有越界』——后者需要 verify 和环境裁决，这是迁移里 60% 的新工程。」
