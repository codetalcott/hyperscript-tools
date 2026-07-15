# hyperscript-tools

Tooling for **original [\_hyperscript](https://hyperscript.org)** (from Big Sky Software) — built on the canonical `hyperscript.org` engine, with zero dependency on any fork.

## Packages

| Package | Description |
| ------- | ----------- |
| [`@hyperscript-tools/mcp-server`](packages/mcp-server-hyperscript) | MCP server: parser-backed validation, parsing, docs, and editor assist for AI agents |

More to come (multilingual authoring, language tooling).

## Design principles

- **Parser-backed, not approximated.** Validation and parsing run \_hyperscript's own parser, so verdicts match the language exactly.
- **Pinned to the grammar.** Documented inventory is verified against the parser's own registry in CI, so docs can't silently drift on a version bump.
- **Fork-free.** Depends only on the canonical `hyperscript.org` package — nothing from any \_hyperscript fork.

## Development

```bash
npm install     # install workspaces
npm run build   # build all packages
npm run test    # run all package test suites
npm run typecheck
```

Node 20+.

## License

MIT.
