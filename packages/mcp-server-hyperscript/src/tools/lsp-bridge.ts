/**
 * Editor-assist tools.
 *
 * `get_document_symbols` walks the REAL parsed AST (via ../hyperscript-loader),
 * so it reports exactly the features the parser recognizes. `get_completions`
 * and `get_hover_info` are heuristic, keyword-table helpers (labeled as such) —
 * position-aware suggestions, not parser output.
 *
 * (The old regex `get_diagnostics` was removed: `validate_hyperscript` is the
 * parser-backed source of truth for errors.)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { safeParse, type HyperscriptNode } from '../hyperscript-loader.js';
import { COMMAND_NAMES, EXPRESSION_HOVER, FEATURE_NAMES } from './language-data.js';
import { invalid, json, readCode, readPosition, type ToolResult } from './results.js';

// =============================================================================
// Keyword tables for completion/hover (heuristic assist only)
// =============================================================================

const EVENTS = [
  'click', 'dblclick', 'submit', 'input', 'change', 'focus', 'blur', 'keydown', 'keyup',
  'keypress', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousedown', 'mouseup',
  'scroll', 'load', 'resize', 'intersection', 'mutation',
];

/**
 * `on` handler modifiers as the parser reads them. There are no `.once`-style
 * dot modifiers: `on click.once` parses, but listens for an event named
 * "click.once". `beforeEvent` modifiers go between `on` and the event name; the
 * rest follow it. Each example is checked by `__tests__/examples.test.ts`.
 */
export const EVENT_MODIFIERS: Array<{ label: string; detail: string; example: string; beforeEvent?: boolean }> = [
  { label: 'every', detail: "Run each event's handler at once instead of queueing", example: 'on every click increment :clicks', beforeEvent: true },
  { label: 'first', detail: 'Handle only the first event', example: 'on first click add .seen to me', beforeEvent: true },
  { label: 'from', detail: 'Listen on another element', example: 'on click from #save add .saving to me' },
  { label: 'elsewhere', detail: 'Events outside this element', example: 'on click from elsewhere hide me' },
  { label: 'in', detail: 'Delegation: only events inside a matching element, which becomes it', example: 'on click in <li/> toggle .selected on it' },
  { label: 'debounced at', detail: 'Wait until the events pause', example: 'on input debounced at 300ms send search to #results' },
  { label: 'throttled at', detail: 'At most one event per interval', example: 'on scroll throttled at 100ms log window.scrollY' },
  { label: 'queue', detail: 'Events arriving while the handler runs: all, first, last (default), none', example: 'on click queue none wait 1s' },
];
const REFERENCES = ['me', 'you', 'it', 'result', 'its', 'my', 'your', 'event', 'target', 'detail', 'body', 'window', 'document'];
const POSITIONAL = ['first', 'last', 'next', 'previous', 'closest', 'parent', 'children', 'random'];
const LOGICAL = ['and', 'or', 'not', 'is', 'exists', 'empty', 'matches', 'contains', 'has', 'no'];
const BLOCK_KEYWORDS = ['then', 'end', 'else', 'from', 'to', 'into', 'with', 'as', 'in', 'over'];

const CONTEXTS = ['event', 'command', 'expression', 'selector'];

// =============================================================================
// Types
// =============================================================================

interface CompletionItem {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
}

interface DocumentSymbol {
  name: string;
  kind: string;
  line: number | null;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const lspBridgeTools: Tool[] = [
  {
    name: 'get_completions',
    description:
      'Heuristic, context-aware keyword completions for _hyperscript at a position. Suggestions, not parser output.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The hyperscript code' },
        line: { type: 'number', description: 'Line number (0-indexed)' },
        character: { type: 'number', description: 'Character position (0-indexed)' },
        context: {
          type: 'string',
          enum: CONTEXTS,
          description: 'Optional context hint for more relevant completions',
        },
      },
      required: ['code', 'line', 'character'],
    },
  },
  {
    name: 'get_hover_info',
    description: 'Heuristic hover documentation for the _hyperscript keyword at a position.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The hyperscript code' },
        line: { type: 'number', description: 'Line number (0-indexed)' },
        character: { type: 'number', description: 'Character position (0-indexed)' },
      },
      required: ['code', 'line', 'character'],
    },
  },
  {
    name: 'get_document_symbols',
    description:
      'Extract document symbols (event handlers, functions, behaviors, init blocks, and set/when/bind/live/install/js features) from the real parsed AST, for an outline view. Symbol lines are 1-based.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The hyperscript code to analyze' },
      },
      required: ['code'],
    },
  },
];

// =============================================================================
// Handler
// =============================================================================

export async function handleLspBridgeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_completions':
      case 'get_hover_info': {
        const code = readCode(args);
        if (typeof code !== 'string') return code;
        const line = readPosition(args, 'line');
        if (typeof line !== 'number') return line;
        const character = readPosition(args, 'character');
        if (typeof character !== 'number') return character;
        if (name === 'get_hover_info') return getHoverInfo(code, line, character);
        const context = args.context;
        if (context !== undefined && context !== null && !CONTEXTS.includes(context as string)) {
          return invalid('context', `one of ${CONTEXTS.join(', ')}`);
        }
        return getCompletions(code, line, character, (context ?? undefined) as string | undefined);
      }
      case 'get_document_symbols': {
        const code = readCode(args);
        if (typeof code !== 'string') return code;
        return await getDocumentSymbols(code);
      }
      default:
        return { content: [{ type: 'text', text: `Unknown LSP bridge tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return {
      content: [
        { type: 'text', text: `Error in ${name}: ${error instanceof Error ? error.message : String(error)}` },
      ],
      isError: true,
    };
  }
}

// =============================================================================
// Document Symbols (AST-backed)
// =============================================================================

/**
 * Symbol kinds (LSP names) for the features the core parser registers. The
 * `worker`, `eventsource` and `socket` features need plugins this server does not
 * load, so the core parser rejects them and they never appear here.
 */
const FEATURE_KINDS: Record<string, string> = {
  onFeature: 'Event',
  defFeature: 'Function',
  behaviorFeature: 'Class',
  initFeature: 'Constructor',
  installFeature: 'Module',
  setFeature: 'Variable',
  bindFeature: 'Variable',
  whenFeature: 'Event',
  liveFeature: 'Event',
  jsFeature: 'Module',
};

/** The source text of a parsed node, via the parser's own `sourceFor()`. */
function sourceOf(value: unknown): string {
  const node = value as { sourceFor?: () => string } | null | undefined;
  try {
    if (typeof node?.sourceFor === 'function') return node.sourceFor();
  } catch {
    // Nodes built without tokens have no source span.
  }
  return '?';
}

function featureName(node: HyperscriptNode): string {
  switch (node.type) {
    case 'setFeature':
      return `set ${sourceOf((node.start as HyperscriptNode | undefined)?.target)}`;
    case 'whenFeature':
      return `when ${(Array.isArray(node.exprs) ? node.exprs : []).map(sourceOf).join(' or ')} changes`;
    case 'bindFeature':
      return `bind ${sourceOf(node.left)}`;
    case 'installFeature':
      return `install ${String(node.behaviorPath)}`;
    case 'jsFeature': {
      const exposed = Array.isArray(node.exposedFunctionNames) ? node.exposedFunctionNames : [];
      return exposed.length > 0 ? `js (${exposed.join(', ')})` : 'js';
    }
  }
  const display = node.displayName;
  if (typeof display === 'string' && display) return display;
  const nm = node.name;
  if (typeof nm === 'string' && nm) return nm;
  return (node.type ?? 'feature').replace(/Feature$/, '');
}

async function getDocumentSymbols(code: string): Promise<ToolResult> {
  // Symbols are features, so read the code as the runtime reads an element script.
  const { node: root } = await safeParse(code, 'program');
  const symbols: DocumentSymbol[] = [];
  const seen = new WeakSet<object>();

  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    const node = value as HyperscriptNode;
    const kind = typeof node.type === 'string' ? FEATURE_KINDS[node.type] : undefined;
    if (kind) {
      const startToken = node.startToken as { line?: number } | undefined;
      symbols.push({ name: featureName(node), kind, line: startToken?.line ?? null });
    }
    for (const key of Object.keys(node)) {
      if (key === 'startToken' || key === 'endToken' || key === 'programSource') continue;
      walk(node[key]);
    }
  };

  walk(root);
  return json({ symbols, count: symbols.length });
}

// =============================================================================
// Completions (heuristic)
// =============================================================================

function getCompletions(code: string, line: number, character: number, context?: string): ToolResult {
  const currentLine = code.split('\n')[line] ?? '';
  // Keep trailing whitespace: it is what tells `on` (a keyword being typed)
  // from `on ` (an event name comes next).
  const prefix = currentLine.slice(0, character).toLowerCase();
  const partial = /[\w:!-]*$/.exec(prefix)?.[0] ?? '';
  const completions: CompletionItem[] = [];
  const inferredContext = context || inferContext(prefix);

  switch (inferredContext) {
    case 'event':
      for (const event of EVENTS) completions.push({ label: event, kind: 'Event', detail: `DOM event: ${event}` });
      for (const mod of EVENT_MODIFIERS) {
        if (!mod.beforeEvent) continue;
        completions.push({ label: mod.label, kind: 'Modifier', detail: mod.detail, documentation: mod.example });
      }
      break;
    case 'command':
      for (const cmd of COMMAND_NAMES) completions.push({ label: cmd, kind: 'Keyword', detail: `Command: ${cmd}` });
      break;
    case 'expression':
      for (const ref of REFERENCES) completions.push({ label: ref, kind: 'Variable', detail: `Reference: ${ref}` });
      for (const pos of POSITIONAL) completions.push({ label: pos, kind: 'Keyword', detail: `Positional: ${pos}` });
      break;
    case 'selector':
      completions.push(
        { label: '#', kind: 'Selector', detail: 'ID selector (#elementId)' },
        { label: '.', kind: 'Selector', detail: 'Class selector (.className)' },
        { label: '<', kind: 'Selector', detail: 'Query literal (<selector/>)' },
        { label: '@', kind: 'Selector', detail: 'Attribute reference (@attrName)' },
        { label: ':', kind: 'Selector', detail: 'Element-scoped variable (:varName)' },
        { label: '$', kind: 'Selector', detail: 'Global variable ($varName)' },
        { label: '*', kind: 'Selector', detail: 'Style reference (*propertyName)' }
      );
      break;
    default: {
      const keywords = new Set([...COMMAND_NAMES, ...FEATURE_NAMES, ...REFERENCES, ...BLOCK_KEYWORDS, ...POSITIONAL, ...LOGICAL]);
      for (const kw of keywords) completions.push({ label: kw, kind: 'Keyword', detail: kw });
      for (const mod of EVENT_MODIFIERS) {
        if (mod.beforeEvent || keywords.has(mod.label)) continue;
        completions.push({ label: mod.label, kind: 'Modifier', detail: mod.detail, documentation: mod.example });
      }
    }
  }

  // Selector sigils are what gets typed next, so there is no word to match.
  const matching =
    inferredContext === 'selector' || !partial ? completions : completions.filter(c => c.label.startsWith(partial));
  return json({ completions: matching.slice(0, 40), context: inferredContext, total: matching.length });
}

/** Guess what comes next from the text before the cursor (lower-cased, untrimmed). */
function inferContext(prefix: string): string {
  // Right after the `on` that starts a handler: an event name.
  if (/^\s*on\s+(?:(?:every|first)\s+)?[\w:-]*$/.test(prefix)) return 'event';
  // After a preposition that takes a target.
  if (/\b(?:on|to|from|into)\s+$/.test(prefix)) return 'selector';
  if (/\bthen\s+[\w!-]*$/.test(prefix) || /^\s*$/.test(prefix)) return 'command';
  if (/\b(?:if|while|unless|until)\s+/.test(prefix)) return 'expression';
  return 'auto';
}

// =============================================================================
// Hover (heuristic)
// =============================================================================

function getHoverInfo(code: string, line: number, character: number): ToolResult {
  const currentLine = code.split('\n')[line] ?? '';
  let start = Math.min(character, currentLine.length);
  let end = start;
  while (start > 0 && /\w/.test(currentLine[start - 1])) start--;
  while (end < currentLine.length && /\w/.test(currentLine[end])) end++;
  const word = currentLine.slice(start, end).toLowerCase();

  if (!word) return json({ hover: null, word: '' });

  const doc = EXPRESSION_HOVER[word];
  if (doc) {
    return json({
      hover: {
        contents: `### ${doc.title}\n\n${doc.description}\n\n**Example:** \`${doc.example}\``,
        word,
      },
    });
  }
  if (EVENTS.includes(word)) {
    return json({
      hover: {
        contents: `### ${word}\n\nDOM event. Use with \`on ${word}\` to handle this event.\n\n**Example:** \`on ${word} toggle .active\``,
        word,
      },
    });
  }
  return json({ hover: null, word });
}
