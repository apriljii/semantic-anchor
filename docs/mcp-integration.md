# MCP 集成指南

> SemanticAnchor 通过 **MCP stdio** 暴露 4 个协议工具。`src/server.js` 是标准 MCP Server——**同一套配置可接入任意兼容 MCP 的 Agent 宿主**，不限于某一 IDE。

---

## 1. 通用 Server 块

无论宿主是 Cursor 还是 Claude Desktop，核心都是启动 `node src/server.js` 并传入约束路径：

```json
{
  "command": "node",
  "args": ["/absolute/path/to/semantic-anchor/src/server.js"],
  "env": {
    "SA_CONSTRAINTS": "/absolute/path/to/your/constraints.json"
  }
}
```

- `SA_CONSTRAINTS`：单个 `constraints.json`，或包含多个 `*.json` 的目录
- 启动自检：`npm run mcp`（stdio，无 UI）；stderr 应输出 `loaded N constraint unit(s)`
- 项目内 canonical 片段：[config/mcp/semantic-anchor.server.json](../config/mcp/semantic-anchor.server.json)

---

## 2. 支持的 MCP 宿主

SemanticAnchor 只实现 **Tools**（四动词），走 **stdio** transport——与下列宿主兼容（2026 常见列表）：

| 宿主 | 类型 | 配置文件 / 入口 | 备注 |
|------|------|-----------------|------|
| **Cursor** | IDE | 项目 `.cursor/mcp.json` 或 `~/.cursor/mcp.json` | 项目已含 [`.cursor/mcp.json`](../.cursor/mcp.json) |
| **Claude Desktop** | 桌面 Chat | macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`<br>Windows: `%APPDATA%\Claude\claude_desktop_config.json` | 顶层 `mcpServers` |
| **Claude Code** | CLI Agent | `claude mcp add …` 或项目 `.mcp.json` | 与 Desktop 同协议 |
| **VS Code + GitHub Copilot** | IDE | 项目 [`.vscode/mcp.json`](../.vscode/mcp.json) | Agent 模式下调用 MCP tools |
| **Windsurf** | IDE | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` 结构 |
| **Cline** | VS Code 扩展 | 扩展设置 → MCP Servers | 开源 Agent，任意 LLM |
| **Continue.dev** | VS Code / JetBrains | `~/.continue/config.json` → `mcpServers` | 数组形式，字段名略异 |
| **Zed** | 编辑器 | Settings → Assistant → MCP | 实验性支持，stdio |
| **Gemini CLI** | CLI | 项目 / 用户 MCP 配置 | Google 生态 |
| **JetBrains AI** | IDE | IDE MCP 设置（经 ACP） | 依 JetBrains 版本而定 |

**不在上表？** 只要宿主支持 MCP **stdio + Tools**，把上面的 Server 块按该宿主 schema 包一层即可。官方索引：[modelcontextprotocol.io](https://modelcontextprotocol.io)。

### 自研 / 服务端 Agent

| 方式 | 适用 |
|------|------|
| **MCP stdio**（本 repo） | 任意 MCP 宿主、本地 IDE、CLI Agent |
| **Library 嵌入** | 自研 Harness、CI gate、无 MCP 的运行时 → [`examples/harness-hook/semantic-gate.js`](../examples/harness-hook/semantic-gate.js) |
| **HTTP/SSE MCP** | 本 repo **未实现**；远程部署需自建 MCP 网关或使用 `mcp-remote` 等桥接 |

---

## 3. 各宿主配置示例

路径请改为本机 **绝对路径**（Claude Desktop 等不支持 `${workspaceFolder}`）。

### Cursor

```json
{
  "mcpServers": {
    "semantic-anchor": {
      "command": "node",
      "args": ["/path/to/semantic-anchor/src/server.js"],
      "env": {
        "SA_CONSTRAINTS": "/path/to/constraints.json"
      }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "semantic-anchor": {
      "command": "node",
      "args": ["/path/to/semantic-anchor/src/server.js"],
      "env": {
        "SA_CONSTRAINTS": "/path/to/constraints.json"
      }
    }
  }
}
```

保存后 **完全退出并重启** Claude Desktop。

### VS Code + GitHub Copilot

`.vscode/mcp.json`（仓库已含模板）：

```json
{
  "servers": {
    "semantic-anchor": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/semantic-anchor/src/server.js"],
      "env": {
        "SA_CONSTRAINTS": "/path/to/constraints.json"
      }
    }
  }
}
```

在 Copilot **Agent 模式**下使用；需 VS Code 1.101+ 且启用 MCP。

### Windsurf

`~/.codeium/windsurf/mcp_config.json`：

```json
{
  "mcpServers": {
    "semantic-anchor": {
      "command": "node",
      "args": ["/path/to/semantic-anchor/src/server.js"],
      "env": {
        "SA_CONSTRAINTS": "/path/to/constraints.json"
      }
    }
  }
}
```

### Cline（VS Code 扩展）

Settings → **MCP Servers** → Add：

- **Command:** `node`
- **Args:** `/path/to/semantic-anchor/src/server.js`
- **Env:** `SA_CONSTRAINTS=/path/to/constraints.json`

### Continue.dev

`~/.continue/config.json` 片段：

```json
{
  "mcpServers": [
    {
      "name": "semantic-anchor",
      "command": "node",
      "args": ["/path/to/semantic-anchor/src/server.js"],
      "env": {
        "SA_CONSTRAINTS": "/path/to/constraints.json"
      }
    }
  ]
}
```

更多示例见 [config/mcp/examples/](../config/mcp/examples/)。

---

## 4. 四个工具怎么用

| 时机 | 工具 | Agent 应做什么 |
|------|------|----------------|
| 任务开始 / 规划后 | `bind_constraints` | 从用户任务提取实体别名，打包 bundle |
| 需要单个契约细节 | `get_constraint` | 按规范 id 读取 ConstraintUnit |
| 单个别名不确定 | `resolve` | best-effort 锚定，miss 不编造 |
| **每次生成后、写文件前** | `verify_usage` | 抽取 usages，守门；失败则读 feedback 重试 |

### 推荐工作流

```
1. 理解任务
2. bind_constraints({ aliases: [...] })
3. declared → system 前缀；derived → JIT 注入
4. 生成代码 / 调用 / 字段赋值
5. 从生成物抽取 usages
6. verify_usage({ usages })
7. 若 !ok → feedback → 修改 → 回到 6
8. 通过后 → 写文件 / 跑测试 / commit
```

**关键：** 第 6 步不可跳过。注入是优化，守门是保证。

---

## 5. usages 示例

```json
{
  "usages": [
    { "name": "ticker", "value": "AAPL" },
    { "name": "order_side", "value": "buy" },
    { "name": "account_id", "value": "ACC12345678", "masked": true },
    { "name": "submit_order", "kind": "call", "args": [
      { "name": "ticker" },
      { "name": "order_side" }
    ]}
  ]
}
```

符号调用需 `"kind": "call"`，否则会触发 `SYMBOL_NOT_FOUND`。

---

## 6. derived 与环境裁决

- **derived：** `bind_constraints({ extraConstraints: [...] })` — 扫描器见 [`examples/derived/scan-typescript.js`](../examples/derived/scan-typescript.js)，演示 `npm run demo:derived`
- **环境裁决：** tsc 等见 [`src/adapters/tsc-environment.js`](../src/adapters/tsc-environment.js)，演示 `npm run demo:env`

---

## 7. 不用 MCP？嵌入 Harness

[`examples/harness-hook/semantic-gate.js`](../examples/harness-hook/semantic-gate.js) — `npm run demo:harness`

---

## 8. 故障排查

| 现象 | 处理 |
|------|------|
| 工具未出现 | `node src/server.js` 能否启动；查宿主 MCP 日志 |
| 约束为空 | 检查 `SA_CONSTRAINTS`；stderr 应打印 `loaded N units` |
| verify 全 unverifiable | usages 的 `name` 应对齐 constraints 的 id/aliases |
| symbol 不报错 | 调用需 `kind: "call"`；store 中需有 signature 单元 |
| 路径错误 | Claude Desktop 等需 **绝对路径**，勿用相对路径 |

---

## 9. 相关文档

- **Harness 集成（推荐）：** [harness-integration.md](./harness-integration.md) · [harness.html](../public/harness.html)
- 设计权威：[design.md](./design.md) §2.1 Harness 集成
- 架构讲述：[architecture.html](../public/architecture.html)
- 碰撞测试：`npm run demo` · [walkthrough.html](../public/walkthrough.html)
