#!/usr/bin/env node
/**
 * SemanticAnchor — MCP stdio server (the ~200-line reference implementation).
 *
 * Migrated from field-registry/src/mcp-stdio-server.js. Exposes the 4 protocol
 * tools over the Model Context Protocol so any agent/IDE (Cursor, Claude Code, ...)
 * can call them.
 *
 * Configure (Cursor .cursor/mcp.json or Claude desktop config):
 *   {
 *     "mcpServers": {
 *       "semantic-anchor": {
 *         "command": "node",
 *         "args": ["/path/to/semantic-anchor/src/server.js"],
 *         "env": { "SA_CONSTRAINTS": "/path/to/your/constraints.json" }
 *       }
 *     }
 *   }
 *
 * By default it loads examples/quant/constraints.json so the server is useful
 * out of the box. Point SA_CONSTRAINTS at your own units (or a directory) to use it
 * for real. The financial Compass registry is one such population — kept private.
 */

const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const { createStore } = require('./protocol/constraint-store');
const { createDispatcher } = require('./dispatch');
const { tools } = require('./tools');

// --- Load constraints (env override, else bundled quant example) ---
const store = createStore();
const src = process.env.SA_CONSTRAINTS || path.join(__dirname, '..', 'examples', 'quant', 'constraints.json');
try {
  const fs = require('fs');
  if (fs.statSync(src).isDirectory()) store.loadDir(src);
  else store.load(JSON.parse(fs.readFileSync(src, 'utf8')));
} catch (e) {
  process.stderr.write(`[semantic-anchor] failed to load constraints from ${src}: ${e.message}\n`);
}
process.stderr.write(`[semantic-anchor] loaded ${store.size()} constraint unit(s) from ${src}\n`);

const callTool = createDispatcher(store);

// --- MCP wiring ---
const server = new Server(
  { name: 'semantic-anchor', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(tools).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = callTool(name, args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error in ${name}: ${e.message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[semantic-anchor] MCP server ready on stdio\n');
}

main().catch((e) => {
  process.stderr.write(`[semantic-anchor] fatal: ${e.message}\n`);
  process.exit(1);
});
