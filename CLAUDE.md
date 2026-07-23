# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tooling for **original `_hyperscript`** (hyperscript.org, from Big Sky Software). An npm-workspaces monorepo; the only package today is `@hyperscript-tools/mcp-server` — an MCP server that gives AI agents a *parser-backed* understanding of `_hyperscript` (validation, parsing, docs, editor assist).

The governing invariant: **verdicts come from `_hyperscript`'s own parser, not from regex approximations.** Depend only on the canonical `hyperscript.org` npm package — never a fork.

## Commands

Run from the repo root (npm workspaces fan out to each package):

```bash
npm install        # install all workspaces
npm run build      # build all packages
npm run test       # run all test suites (vitest run)
npm run typecheck  # tsc --noEmit across packages
```

Inside `packages/mcp-server-hyperscript/`:

```bash
npm run dev        # run the server from source via tsx (stdio transport)
npm run build      # bundle with tsup (ESM + .d.ts) to dist/
npm test           # vitest in watch mode
npm run test:run   # vitest single run
npm run typecheck  # tsc --noEmit
```

Run a single test file or by name (from the package dir):

```bash
npx vitest run src/__tests__/golden.test.ts
npx vitest run -t "validates correct hyperscript"
```

Node 20+ required (CI runs on Node 24). There is no lint step.

## Architecture

Everything hangs off one seam and one invariant.

### The loader is the only door to `_hyperscript`

[src/hyperscript-loader.ts](packages/mcp-server-hyperscript/src/hyperscript-loader.ts) is the *single* place that touches the canonical library. All language knowledge flows through it; there is deliberately no second, hand-rolled grammar to drift from upstream. It exposes `parse`/`safeParse`/`tokenize`/`registryProbe`/`hyperscriptVersion`.

Two non-obvious things it handles:
- **Awkward import.** `hyperscript.org`'s `exports` map points the package root at the IIFE build, which exports nothing to an ESM importer in Node. The loader resolves the package, then imports the sibling `_hyperscript.esm.js` by absolute file URL.
- **Headless safety.** It only ever calls `parse`/`tokenize` (which never *execute* hyperscript), and the library's DOM bootstrap is `typeof document` -guarded, so importing in bare Node touches no DOM.

`safeParse` is the one to use: `_hyperscript.parse` usually *collects* errors onto the returned node, but can still throw (e.g. the `js` command compiles its body with `new Function` at parse time). `safeParse` normalizes both into a flat `{ node, errors }`.

### Two classes of tools — keep them labeled

The server exposes 10 tools across three modules. Every tool is one of:
- **Parser-backed** (ground truth): `validate_hyperscript`, `parse_hyperscript`, `get_document_symbols`, `get_language_info`.
- **Heuristic** (keyword tables / pattern matching — convenience, *not* authoritative): `suggest_command`, `get_completions`, `get_hover_info`.

Preserve this distinction in tool descriptions. Heuristic tools must say so; do not present them as authoritative.

### Tool wiring

Each tool module in [src/tools/](packages/mcp-server-hyperscript/src/tools/) exports a `Tool[]` definitions array plus a `handle*Tool(name, args)` handler:
- `validation.ts` — parse/validate (parser-backed) + `suggest_command` (heuristic)
- `lsp-bridge.ts` — `get_document_symbols` (walks the real AST) + completions/hover (heuristic)
- `language-docs.ts` — docs/search/language-info, sourced from `language-data.ts`

[src/index.ts](packages/mcp-server-hyperscript/src/index.ts) builds a `HANDLERS` map (tool name → owning handler) by iterating each module's definitions array, and serves over stdio. **To add a tool:** add it to a module's definitions array and handler switch — the routing in `index.ts` picks it up automatically. The server version is read from `package.json` at runtime (do not hardcode it).

### The drift-test invariant (most important thing to know)

[src/tools/language-data.ts](packages/mcp-server-hyperscript/src/tools/language-data.ts) holds the authoritative language inventory (`COMMAND_NAMES`, `FEATURE_NAMES`, `NON_COMMANDS`) and curated prose (`COMMAND_DOCS`, `EXPRESSION_DOCS`, `SPECIAL_SYMBOLS`).

[src/__tests__/inventory.test.ts](packages/mcp-server-hyperscript/src/__tests__/inventory.test.ts) pins that inventory to the parser's **own** command/feature registry via `registryProbe()`. It asserts: every listed command/feature is really registered, known non-commands stay unregistered, and every curated doc entry is a real command (no phantom docs). Curated `COMMAND_DOCS` is intentionally a *subset* of `COMMAND_NAMES`.

**When bumping the `hyperscript.org` dependency:** run the tests. If the drift test fails, the grammar changed — update `COMMAND_NAMES`/`FEATURE_NAMES` (and ideally `COMMAND_DOCS`) to match the parser. This is the mechanism that stops the docs from silently falling out of sync on a version bump.

### Supporting pieces

- [src/ast-view.ts](packages/mcp-server-hyperscript/src/ast-view.ts) — the real parse tree is cyclic, function-laden, and not JSON-safe. `astView` prunes it to a compact serializable skeleton (node types + scalar fields + AST children) with depth/node/array budgets, and collects the flat `commandTypes` sequence. Backs `parse_hyperscript`.
- [src/resources/](packages/mcp-server-hyperscript/src/resources/) — static markdown docs exposed as MCP resources (`hyperscript://docs/*`, `hyperscript://examples/common`). `content.ts` holds the markdown; `index.ts` lists/reads by URI.

### Tests

- `golden.test.ts` — end-to-end corpus: idiomatic snippets that must parse clean, broken snippets that must report errors with accurate line/column. Guards against regex-era false verdicts.
- `inventory.test.ts` — the drift test above.
- `tools.test.ts` — tool surface (exact names, 10 total) and handler behavior.
