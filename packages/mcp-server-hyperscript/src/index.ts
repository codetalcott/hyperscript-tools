#!/usr/bin/env node
/**
 * Hyperscript MCP Server
 *
 * Model Context Protocol server for original _hyperscript development.
 * Provides validation, completions, documentation, and code analysis.
 *
 * Zero external dependencies beyond @modelcontextprotocol/sdk.
 * All tools use pattern-based analysis — no parser required.
 */

import { createRequire } from 'node:module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Tool implementations
import { validationTools, handleValidationTool } from './tools/validation.js';
import { lspBridgeTools, handleLspBridgeTool } from './tools/lsp-bridge.js';
import { languageDocsTools, handleLanguageDocsTool } from './tools/language-docs.js';

// Resource implementations
import { listResources, readResource } from './resources/index.js';

// Route each tool name to the module that owns it. Keeping this as a lookup
// (rather than scattered string comparisons) means adding/removing a tool is a
// one-line change and there is a single place to see the whole surface.
type ToolHandler = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

const HANDLERS: Record<string, ToolHandler> = {};
for (const tool of validationTools) HANDLERS[tool.name] = handleValidationTool;
for (const tool of lspBridgeTools) HANDLERS[tool.name] = handleLspBridgeTool;
for (const tool of languageDocsTools) HANDLERS[tool.name] = handleLanguageDocsTool;

// =============================================================================
// Server Setup
// =============================================================================

// Version tracks package.json so MCP clients report the real server version.
// A hardcoded string drifts on release bumps (this sat at '1.0.0' through the
// entire 2.x line); the require resolves the same in dev/dist/installed layouts.
const { version: pkgVersion } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

const server = new Server(
  {
    name: 'hyperscript-mcp',
    version: pkgVersion,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// =============================================================================
// Tool Handlers
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [...validationTools, ...lspBridgeTools, ...languageDocsTools],
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;
  const handler = HANDLERS[name];
  if (!handler) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  return handler(name, (args ?? {}) as Record<string, unknown>);
});

// =============================================================================
// Resource Handlers
// =============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: listResources() };
});

server.setRequestHandler(ReadResourceRequestSchema, async request => {
  const { uri } = request.params;
  return readResource(uri);
});

// =============================================================================
// Server Startup
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Hyperscript MCP server started (original _hyperscript mode)');
}

main().catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
