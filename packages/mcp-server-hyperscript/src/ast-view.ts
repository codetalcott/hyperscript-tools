/**
 * A compact, serializable view of a canonical _hyperscript AST.
 *
 * The real parse tree is a rich object graph: linked command lists (`start` ->
 * `next`), embedded tokens, back-references, and closures. It is neither
 * JSON-safe (cycles, functions) nor useful to dump wholesale. This module prunes
 * it to the structural skeleton an agent actually wants — node `type`s, their
 * meaningful scalar fields, and their AST children — while staying bounded and
 * cycle-safe.
 */

import type { HyperscriptNode } from './hyperscript-loader.js';

/**
 * Keys that carry noise (tokens, source text, back-refs, runtime state). Keys
 * starting with `_` are the library's internals and are skipped too. Not `root`:
 * on property access and method calls it holds the receiver (`#code` in
 * `#code.textContent`), and a back-reference is already dropped as a repeat.
 */
const SKIP_KEYS = new Set([
  'errors',
  'programSource',
  'startToken',
  'endToken',
  'parent',
  'sourceFor',
  'symbolTable',
  'context',
  'runtime',
  'parser',
  'kernel',
  'isFeature', // always-true marker on feature nodes; redundant with `type`
]);

/**
 * Internal plumbing node types with no author-facing meaning: the empty
 * terminator of a command list and the implicit return synthesized at the end
 * of every handler/function. Dropping them removes the trailing
 * `next: { emptyCommandListCommand … }` chains from the view and keeps them out
 * of the reported command sequence.
 */
const INTERNAL_NODE_TYPES = new Set(['emptyCommandListCommand', 'implicitReturn']);

const MAX_DEPTH = 24;
const MAX_NODES = 2000;
const MAX_ARRAY = 100;

/** Token `type`s are UPPER_SNAKE; AST node `type`s are camelCase (toggleCommand). */
function isTokenLike(v: Record<string, unknown>): boolean {
  return (
    typeof v.value === 'string' &&
    typeof v.type === 'string' &&
    /^[A-Z][A-Z0-9_]*$/.test(v.type) &&
    ('start' in v || 'column' in v)
  );
}

/**
 * Prune a parsed AST node to a compact, JSON-safe tree.
 *
 * Returns `{ view, commandTypes, truncated }`:
 *  - `view`: the pruned tree (node types + scalar fields + AST children).
 *  - `commandTypes`: a flat, in-encounter-order list of every `*Command` node
 *    type — a quick "what does this do" scan for an agent.
 *  - `truncated`: true if the node budget was hit (very large programs).
 */
export function astView(node: HyperscriptNode | undefined): {
  view: unknown;
  commandTypes: string[];
  truncated: boolean;
} {
  const commandTypes: string[] = [];
  const seen = new WeakSet<object>();
  let budget = MAX_NODES;
  let truncated = false;

  const prune = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return value;
    if (t === 'function') return undefined;
    if (t !== 'object') return undefined;

    if (budget <= 0) {
      truncated = true;
      return '[budget-exceeded]';
    }
    if (depth > MAX_DEPTH) {
      truncated = true;
      return '[max-depth]';
    }

    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return '[circular]';

    if (Array.isArray(value)) {
      const arr = value.slice(0, MAX_ARRAY).map(v => prune(v, depth + 1)).filter(v => v !== undefined);
      if (value.length > MAX_ARRAY) {
        truncated = true;
        arr.push(`[+${value.length - MAX_ARRAY} more]`);
      }
      return arr;
    }

    // Inline token -> just its surface value.
    if (isTokenLike(obj)) return { token: obj.value };

    const type = typeof obj.type === 'string' ? obj.type : undefined;
    // Drop internal plumbing nodes entirely; the parent simply loses the ref.
    if (type && INTERNAL_NODE_TYPES.has(type)) return undefined;

    seen.add(obj);
    budget--;

    if (type && type.endsWith('Command')) commandTypes.push(type);

    const out: Record<string, unknown> = {};
    if (type) out.type = type;
    for (const key of Object.keys(obj)) {
      if (key === 'type' || key === 'args' || SKIP_KEYS.has(key) || key.startsWith('_') || key.endsWith('Token')) continue;
      const pruned = prune(obj[key], depth + 1);
      // Drop keys that resolve to nothing, or to a bare back-reference to a node
      // already shown elsewhere in the tree (e.g. `targetExpr`, `rootExpr`).
      if (pruned === undefined || pruned === '[circular]') continue;
      out[key] = pruned;
    }
    // `args` is the real parameter list on def/on features (an array). On other
    // nodes it is a binding map that mostly repeats the named fields above, but
    // some values live only there (a `set` value, template string parts, the
    // condition of `unless`), so keep whatever it adds.
    const args = Array.isArray(obj.args) ? prune(obj.args, depth + 1) : pruneArgs(obj, depth);
    if (args !== undefined) out.args = args;
    return out;
  };

  /** The entries of a node's `args` binding map that are not already shown. */
  const pruneArgs = (obj: Record<string, unknown>, depth: number): Record<string, unknown> | undefined => {
    const args = obj.args;
    if (!args || typeof args !== 'object') return undefined;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value === null || value === undefined || obj[key] === value) continue;
      let pruned = prune(value, depth + 1);
      if (Array.isArray(pruned)) pruned = pruned.filter(v => v !== '[circular]');
      if (pruned === undefined || pruned === '[circular]' || (Array.isArray(pruned) && pruned.length === 0)) continue;
      out[key] = pruned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  const view = prune(node, 0);
  return { view, commandTypes, truncated };
}
