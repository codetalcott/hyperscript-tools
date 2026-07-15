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
 * does not throw and does not touch the DOM. We only ever call `parse`/`tokenize`,
 * which never execute hyperscript, so no DOM is required.
 */

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

interface CanonicalParser {
  commandStart: (token: { value: string; type: string }) => unknown;
  featureStart: (token: { value: string; type: string }) => unknown;
}

interface HyperscriptApi {
  version: string;
  parse: (src: string) => HyperscriptNode;
  internals: {
    tokenizer: {
      tokenize: (src: string) => { list?: HyperscriptToken[] } & Iterable<HyperscriptToken>;
    };
    createParser: (tokens: unknown) => CanonicalParser;
  };
}

// =============================================================================
// Lazy, cached load
// =============================================================================

let cached: Promise<HyperscriptApi> | undefined;

/** Load (once) and return the canonical `_hyperscript` API. */
export function getHyperscript(): Promise<HyperscriptApi> {
  if (!cached) {
    cached = (async () => {
      const require = createRequire(import.meta.url);
      // Resolves to `.../hyperscript.org/dist/_hyperscript.js` (the IIFE build).
      const iifePath = require.resolve('hyperscript.org');
      const esmPath = path.join(path.dirname(iifePath), '_hyperscript.esm.js');
      const mod = (await import(pathToFileURL(esmPath).href)) as {
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
 * Parse a hyperscript source string to its AST. Does not execute hyperscript.
 *
 * Note: `_hyperscript.parse` mostly *collects* syntax errors on the returned
 * node rather than throwing — but it can still throw for a few cases (notably
 * the `js` command, whose body is compiled with `new Function` at parse time,
 * which raises on invalid JavaScript). Prefer {@link safeParse}, which turns
 * such throws into ordinary parse errors.
 */
export async function parse(code: string): Promise<HyperscriptNode> {
  const hs = await getHyperscript();
  return hs.parse(code);
}

/**
 * Parse without ever throwing. Returns the AST node (or null if parsing threw)
 * together with a flat list of errors — whether _hyperscript collected them or
 * threw them.
 */
export async function safeParse(
  code: string
): Promise<{ node: HyperscriptNode | null; errors: FlatError[] }> {
  const hs = await getHyperscript();
  try {
    const node = hs.parse(code);
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
  return {
    isCommand: (keyword: string) => {
      try {
        return !!parser.commandStart(asToken(keyword));
      } catch {
        return false;
      }
    },
    isFeature: (keyword: string) => {
      try {
        return !!parser.featureStart(asToken(keyword));
      } catch {
        return false;
      }
    },
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
  // Errors live on the top node for `parse`; that is sufficient for validation.
  visit(node);
  return out;
}
