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
import { COMMAND_NAMES, EXPRESSION_HOVER } from './language-data.js';

// =============================================================================
// Keyword tables for completion/hover (heuristic assist only)
// =============================================================================

const EVENTS = [
  'click', 'dblclick', 'submit', 'input', 'change', 'focus', 'blur', 'keydown', 'keyup',
  'keypress', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousedown', 'mouseup',
  'scroll', 'load', 'resize', 'intersection', 'mutation', 'every',
];
const EVENT_MODIFIERS = ['once', 'prevent', 'stop', 'capture', 'passive', 'debounce', 'throttle'];
const FEATURES = ['on', 'behavior', 'def', 'init', 'worker', 'eventsource', 'socket', 'js', 'set'];
const REFERENCES = ['me', 'you', 'it', 'result', 'its', 'my', 'your', 'event', 'target', 'detail', 'body', 'window', 'document'];
const POSITIONAL = ['first', 'last', 'next', 'previous', 'closest', 'parent', 'children', 'random'];
const LOGICAL = ['and', 'or', 'not', 'is', 'exists', 'empty', 'matches', 'contains', 'has', 'no'];
const BLOCK_KEYWORDS = ['then', 'end', 'else', 'from', 'to', 'into', 'with', 'as', 'in', 'over'];

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

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const json = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

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
          enum: ['event', 'command', 'expression', 'selector'],
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
      'Extract document symbols (event handlers, behaviors, functions, init/worker blocks) from the real parsed AST, for an outline view.',
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
  switch (name) {
    case 'get_completions':
      return getCompletions(
        args.code as string,
        args.line as number,
        args.character as number,
        args.context as string | undefined
      );
    case 'get_hover_info':
      return getHoverInfo(args.code as string, args.line as number, args.character as number);
    case 'get_document_symbols':
      return await getDocumentSymbols(args.code as string);
    default:
      return { content: [{ type: 'text', text: `Unknown LSP bridge tool: ${name}` }], isError: true };
  }
}

// =============================================================================
// Document Symbols (AST-backed)
// =============================================================================

const FEATURE_KINDS: Record<string, string> = {
  onFeature: 'Event',
  defFeature: 'Function',
  behaviorFeature: 'Class',
  initFeature: 'Constructor',
  workerFeature: 'Module',
  eventsourceFeature: 'Module',
  socketFeature: 'Module',
};

function featureName(node: HyperscriptNode): string {
  const display = node.displayName;
  if (typeof display === 'string' && display) return display;
  const nm = node.name;
  if (typeof nm === 'string' && nm) return nm;
  return (node.type ?? 'feature').replace(/Feature$/, '');
}

async function getDocumentSymbols(code: string): Promise<ToolResult> {
  const { node: root } = await safeParse(code);
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
  const lines = code.split('\n');
  const currentLine = lines[line] || '';
  const prefix = currentLine.slice(0, character).trim().toLowerCase();
  const completions: CompletionItem[] = [];
  const inferredContext = context || inferContext(prefix);

  switch (inferredContext) {
    case 'event':
      for (const event of EVENTS) completions.push({ label: event, kind: 'Event', detail: `DOM event: ${event}` });
      for (const mod of EVENT_MODIFIERS) completions.push({ label: `.${mod}`, kind: 'Modifier', detail: `Event modifier: .${mod}` });
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
        { label: '<', kind: 'Selector', detail: 'Tag selector (<tag/>)' },
        { label: '@', kind: 'Selector', detail: 'Attribute reference (@attrName)' },
        { label: ':', kind: 'Selector', detail: 'Local variable (:varName)' },
        { label: '$', kind: 'Selector', detail: 'Global variable ($varName)' },
        { label: '*', kind: 'Selector', detail: 'Style reference (*propertyName)' }
      );
      break;
    default: {
      const lastWord = prefix.split(/\s+/).pop() || '';
      const all = [...COMMAND_NAMES, ...FEATURES, ...REFERENCES, ...BLOCK_KEYWORDS, ...POSITIONAL, ...LOGICAL];
      for (const kw of all) {
        if (!lastWord || kw.startsWith(lastWord)) completions.push({ label: kw, kind: 'Keyword', detail: kw });
      }
    }
  }

  return json({ completions: completions.slice(0, 40), context: inferredContext, total: completions.length });
}

function inferContext(prefix: string): string {
  if (/\bon\s+\w*$/.test(prefix)) return 'event';
  if (/\bthen\s*$/.test(prefix) || /^\s*$/.test(prefix)) return 'command';
  if (/\b(on|to|from|into)\s+$/.test(prefix)) return 'selector';
  if (/\b(if|while|unless)\s+/.test(prefix)) return 'expression';
  return 'auto';
}

// =============================================================================
// Hover (heuristic)
// =============================================================================

function getHoverInfo(code: string, line: number, character: number): ToolResult {
  const lines = code.split('\n');
  const currentLine = lines[line] || '';
  let start = character;
  let end = character;
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
