/**
 * Canonical _hyperscript loader.
 *
 * Loads the REAL _hyperscript library (`hyperscript.org`, from Big Sky Software)
 * and exposes a small, headless-safe parsing surface. Everything the MCP tools
 * know about the language comes through here — there is no second, hand-rolled
 * grammar to drift from upstream.
 *
 * Why the awkward import: `hyperscript.org`'s `exports` map points the package
 * root at the IIFE build (`dist/_hyperscript.js`), which publishes nothing to an
 * ES-module importer in Node (its only global assignment is `self`-guarded). The
 * ESM build sits next to it as `dist/_hyperscript.esm.js` but is not exported, so
 * we resolve the package root and import that sibling by absolute file URL.
 *
 * Headless safety: the library's DOM bootstrap is wrapped in
 * `if (typeof document !== 'undefined')`, so importing it in bare Node (no jsdom)
 * does not throw and does not touch the DOM. We only ever parse and tokenize,
 * which never execute hyperscript, so no DOM is required.
 *
 * Two parse modes, because the library itself has two entry points:
 *  - `program`: what the runtime does with element scripts (`_`, `script` and
 *    `data-script` attributes, inline `<script type="text/hyperscript">`). It
 *    parses a sequence of features (`on`, `init`, `def`, `set`, `js`, ...).
 *  - `snippet`: `_hyperscript.parse()`, the entry point of `_hyperscript("…")`.
 *    It dispatches on the first token (command list, then feature list, then
 *    expression), so `toggle .active` is accepted but a script that begins
 *    with the `set` or `js` feature is misread as a command list.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// =============================================================================
// Types (the canonical library ships no type declarations)
// =============================================================================

/** A parse error as attached to `result.errors` by `_hyperscript.parse`. */
export interface HyperscriptParseError {
  message: string;
  line?: number;
  column?: number;
  token?: { type?: string; value?: string; line?: number; column?: number; start?: number; end?: number };
  expected?: unknown;
}

/** A parsed AST node. Untyped by the library; we only rely on `type`/`errors`. */
export interface HyperscriptNode {
  type?: string;
  errors?: HyperscriptParseError[];
  [key: string]: unknown;
}

/** A token from the tokenizer. */
export interface HyperscriptToken {
  type: string;
  value: string;
  line?: number;
  column?: number;
  start?: number;
  end?: number;
}

/** How to read the source: as an element script, or as a standalone snippet. */
export type ParseMode = 'program' | 'snippet';

export const PARSE_MODES: readonly ParseMode[] = ['program', 'snippet'];

type TokenStream = { list?: HyperscriptToken[]; hasMore: () => boolean } & Iterable<HyperscriptToken>;

interface CanonicalParser {
  commandStart: (token: { value: string; type: string }) => unknown;
  featureStart: (token: { value: string; type: string }) => unknown;
  parseElement: (type: string) => (HyperscriptNode & { collectErrors?: () => HyperscriptParseError[] }) | undefined;
  raiseError: () => never;
}

interface HyperscriptApi {
  version: string;
  parse: (src: string) => HyperscriptNode;
  internals: {
    tokenizer: {
      tokenize: (src: string) => TokenStream;
    };
    createParser: (tokens: TokenStream) => CanonicalParser;
  };
}

// =============================================================================
// Lazy, cached load
// =============================================================================

let cached: Promise<HyperscriptApi> | undefined;

/** Absolute path of the canonical ESM build (see the note at the top of this file). */
function esmBuildPath(): string {
  const require = createRequire(import.meta.url);
  // Resolves to `.../hyperscript.org/dist/_hyperscript.js` (the IIFE build).
  const iifePath = require.resolve('hyperscript.org');
  return path.join(path.dirname(iifePath), '_hyperscript.esm.js');
}

/** Load (once) and return the canonical `_hyperscript` API. */
export function getHyperscript(): Promise<HyperscriptApi> {
  if (!cached) {
    cached = (async () => {
      const mod = (await import(pathToFileURL(esmBuildPath()).href)) as {
        default?: HyperscriptApi;
      } & HyperscriptApi;
      const hs = mod.default ?? mod;
      if (typeof hs?.parse !== 'function') {
        throw new Error(
          'Loaded hyperscript.org but it did not expose parse(); the package layout may have changed.'
        );
      }
      return hs;
    })();
  }
  return cached;
}

/** The canonical grammar version the server is targeting (e.g. "0.9.93"). */
export async function hyperscriptVersion(): Promise<string> {
  return (await getHyperscript()).version;
}

// =============================================================================
// Parse + tokenize
// =============================================================================

/** A flat, serializable parse error with real positions. */
export interface FlatError {
  message: string;
  line: number | null;
  column: number | null;
  token?: string;
  expected?: unknown;
}

/**
 * Parse an element script exactly as the runtime does. The runtime's entry
 * point (`LanguageKernel.parseHyperScript`) is not exported, so this repeats its
 * few steps through the public `internals`: parse the `hyperscript` program
 * grammar (which recovers per feature, leaving `failedFeature` nodes), reject
 * trailing tokens, and gather the errors onto the program node.
 */
function parseProgram(hs: HyperscriptApi, code: string): HyperscriptNode {
  const tokens = hs.internals.tokenizer.tokenize(code);
  const parser = hs.internals.createParser(tokens);
  let program: ReturnType<CanonicalParser['parseElement']>;
  let fatal: HyperscriptParseError | undefined;
  try {
    program = parser.parseElement('hyperscript');
    if (tokens.hasMore()) parser.raiseError();
  } catch (err) {
    // The parser signals an unrecoverable syntax error by throwing a sentinel
    // that carries it as `parseError`; anything else is a real exception.
    const parseError = (err as { parseError?: HyperscriptParseError } | null)?.parseError;
    if (!parseError) throw err;
    fatal = parseError;
  }
  const node: HyperscriptNode = program ?? { type: 'hyperscript', features: [] };
  const errors = program?.collectErrors?.() ?? [];
  if (fatal) errors.push(fatal);
  node.errors = errors;
  return node;
}

function parseWith(hs: HyperscriptApi, code: string, mode: ParseMode): HyperscriptNode {
  return mode === 'program' ? parseProgram(hs, code) : hs.parse(code);
}

/**
 * Parse a hyperscript source string to its AST. Does not execute hyperscript.
 *
 * Note: parsing mostly *collects* syntax errors on the returned node rather
 * than throwing — but it can still throw for a few cases (notably `js` blocks,
 * whose body is compiled with `new Function` at parse time, which raises on
 * invalid JavaScript). Prefer {@link safeParse}, which turns such throws into
 * ordinary parse errors.
 */
export async function parse(code: string, mode: ParseMode = 'program'): Promise<HyperscriptNode> {
  return parseWith(await getHyperscript(), code, mode);
}

/**
 * Parse without ever throwing. Returns the AST node (or null if parsing threw)
 * together with a flat list of errors — whether _hyperscript collected them or
 * threw them. Defaults to `program` mode, the way the runtime reads scripts.
 */
export async function safeParse(
  code: string,
  mode: ParseMode = 'program'
): Promise<{ node: HyperscriptNode | null; errors: FlatError[] }> {
  const hs = await getHyperscript();
  try {
    const node = parseWith(hs, code, mode);
    return { node, errors: collectErrors(node) };
  } catch (err) {
    return {
      node: null,
      errors: [
        {
          message: err instanceof Error ? err.message.split('\n')[0] : String(err),
          line: null,
          column: null,
        },
      ],
    };
  }
}

/**
 * Return predicates that ask the canonical parser's own registry whether a
 * keyword is a registered command / feature. This is the authoritative oracle
 * used by the inventory drift test to keep our docs pinned to the real grammar.
 */
export async function registryProbe(): Promise<{
  isCommand: (keyword: string) => boolean;
  isFeature: (keyword: string) => boolean;
}> {
  const hs = await getHyperscript();
  const parser = hs.internals.createParser(hs.internals.tokenizer.tokenize(''));
  const asToken = (value: string) => ({ value, type: 'IDENTIFIER' });
  // The registry is a plain object, so inherited keys (`constructor`,
  // `toString`, ...) would otherwise read as registered keywords.
  const lookup = (start: (token: { value: string; type: string }) => unknown, keyword: string) => {
    if (keyword in Object.prototype) return false;
    try {
      return !!start(asToken(keyword));
    } catch {
      return false;
    }
  };
  return {
    isCommand: (keyword: string) => lookup(t => parser.commandStart(t), keyword),
    isFeature: (keyword: string) => lookup(t => parser.featureStart(t), keyword),
  };
}

/**
 * Every command and feature keyword the canonical parser registers.
 *
 * The registry itself is private, so candidates come from the string literals
 * in the loaded build (keywords are declared as literals, e.g.
 * `static keyword = "toggle"`) and the registry decides which ones are real.
 * Used by the drift test to catch keywords a version bump adds.
 */
export async function registeredKeywords(): Promise<{ commands: string[]; features: string[] }> {
  const { isCommand, isFeature } = await registryProbe();
  const source = await readFile(esmBuildPath(), 'utf8');
  const candidates = new Set<string>();
  // A lookahead tries every quote position, so a literal right after another
  // one (`"a"+"b"`) is not swallowed by the pairing of the first.
  for (const m of source.matchAll(/(?=(["'`])([^"'`\s\\]{1,40})\1)/g)) candidates.add(m[2]);
  return {
    commands: [...candidates].filter(isCommand).sort(),
    features: [...candidates].filter(isFeature).sort(),
  };
}

/** Tokenize a hyperscript source string. */
export async function tokenize(code: string): Promise<HyperscriptToken[]> {
  const hs = await getHyperscript();
  const result = hs.internals.tokenizer.tokenize(code);
  if (Array.isArray(result.list)) return result.list;
  return Array.from(result);
}

/**
 * Collect parse errors from a parsed node into a flat, serializable shape with
 * real line/column positions. `_hyperscript.parse` attaches errors to the
 * top-level node (and, for nested failures, to child nodes) rather than throwing.
 */
export function collectErrors(node: HyperscriptNode | undefined): FlatError[] {
  const out: FlatError[] = [];
  const seen = new WeakSet<object>();
  const visit = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    if (seen.has(n as object)) return;
    seen.add(n as object);
    const errs = (n as HyperscriptNode).errors;
    if (Array.isArray(errs)) {
      for (const e of errs) {
        out.push({
          message: e.message,
          line: e.line ?? e.token?.line ?? null,
          column: e.column ?? e.token?.column ?? null,
          token: e.token?.value,
          expected: e.expected ?? undefined,
        });
      }
    }
  };
  // Both parse modes gather every error onto the top node; that is sufficient.
  visit(node);
  return out;
}
