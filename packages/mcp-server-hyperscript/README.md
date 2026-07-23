# @hyperscript-tools/mcp-server

**Write [\_hyperscript](https://hyperscript.org) with an AI assistant that actually gets the language right.**

This is an MCP (Model Context Protocol) server for **original \_hyperscript**. If you use Claude, Cursor, or any other MCP-capable assistant to write hyperscript, it plugs in so the assistant can **validate, parse, and look up** hyperscript against the language itself. Validation and parsing run **the real \_hyperscript parser** (the `hyperscript.org` package) — so error messages, line/column positions, and the command inventory match what the browser will actually run, instead of a regex approximation that quietly gets edge cases wrong.

For LLM-assisted authoring specifically, that means fewer confidently-wrong snippets: the assistant can check its work with `validate_hyperscript` and get the parser's real verdict before handing you code.

## Quick Start

Both editors use the same config shape — run the published package with `npx`, no install step.

### Claude Code / Claude Desktop

Add to your MCP configuration (`.mcp.json`, or Claude Desktop settings):

```json
{
  "mcpServers": {
    "hyperscript": {
      "command": "npx",
      "args": ["@hyperscript-tools/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "hyperscript": {
      "command": "npx",
      "args": ["@hyperscript-tools/mcp-server"]
    }
  }
}
```

## Tools (10)

### Parsing & validation (real parser)

| Tool                   | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `validate_hyperscript` | Validate with the real parser; returns `{ valid, errors }` with the actual message, line, and column |
| `parse_hyperscript`    | Parse to a compact AST view + command sequence (and optional token stream) |
| `suggest_command`      | Heuristic: suggest the best command(s) for a described task              |

### Editor assist

| Tool                   | Description                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| `get_completions`      | Context-aware keyword completions (heuristic)                    |
| `get_hover_info`       | Hover documentation for a keyword (heuristic)                    |
| `get_document_symbols` | Event handlers, behaviors, functions, and init/worker blocks, extracted from the parsed AST |

### Documentation

| Tool                       | Description                                                    |
| -------------------------- | ------------------------------------------------------------- |
| `get_command_docs`         | Syntax, description, and examples for a command               |
| `get_expression_docs`      | Docs for expressions (`me`, `closest`, `as`, …)               |
| `search_language_elements` | Search commands, expressions, and special symbols             |
| `get_language_info`        | The canonical grammar version and the full command/feature list |

Tools are labeled by kind: **parser-backed** tools return ground truth from \_hyperscript itself; **heuristic** tools (`suggest_command`, `get_completions`, `get_hover_info`) are convenience helpers, not authoritative.

## Resources

Documentation is also exposed as MCP resources:

- `hyperscript://docs/commands` — Command reference
- `hyperscript://docs/expressions` — Expression guide
- `hyperscript://docs/events` — Events reference
- `hyperscript://examples/common` — Common patterns

## How it stays correct

The documented command/feature inventory is **pinned to the parser's own registry** by a drift test (`src/__tests__/inventory.test.ts`). If a `hyperscript.org` version bump adds, removes, or renames a command, that test fails — so the docs cannot silently fall out of sync with the grammar. `get_language_info` reports the exact `hyperscript.org` version in use.

## Dependencies

- [`hyperscript.org`](https://www.npmjs.com/package/hyperscript.org) — the canonical \_hyperscript library (used headlessly for parsing/tokenizing; no browser or DOM required).
- `@modelcontextprotocol/sdk` — the MCP server framework.

## Scope

This server targets **original \_hyperscript** only. It has no multilingual/i18n features and no dependency on any \_hyperscript fork.

## License

MIT.
