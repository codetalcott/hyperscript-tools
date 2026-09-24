/**
 * Parsing + validation tools, backed by the canonical _hyperscript parser.
 *
 * `validate_hyperscript` and `parse_hyperscript` run the REAL grammar (via
 * ../hyperscript-loader) — no regex heuristics — so their verdicts match what
 * _hyperscript itself accepts. By default they read code the way the runtime
 * reads an element script; `mode: "snippet"` reads a standalone command or
 * expression instead. `suggest_command` is an intentionally heuristic
 * task -> command helper and is labeled as such.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  PARSE_MODES,
  safeParse,
  tokenize,
  hyperscriptVersion,
  type FlatError,
  type ParseMode,
} from '../hyperscript-loader.js';
import { astView } from '../ast-view.js';

// =============================================================================
// Tool Definitions
// =============================================================================

const MODE_PROPERTY = {
  type: 'string',
  enum: [...PARSE_MODES],
  default: 'program',
  description:
    '"program" (default): an element script, i.e. the value of an _="…" attribute or the body of an inline <script type="text/hyperscript">, parsed exactly as the runtime parses it, so it must consist of features (on, init, def, behavior, set, js, …). "snippet": a standalone command list or expression, as accepted by _hyperscript("…") and _hyperscript.parse().',
};

export const validationTools: Tool[] = [
  {
    name: 'validate_hyperscript',
    description:
      'Validate _hyperscript with the real parser. By default the code is checked as an element script, the way the runtime parses _="…" attributes and <script type="text/hyperscript"> blocks; use mode "snippet" for a standalone command or expression. Returns { valid, mode, errors } where each error has the actual message, line, and column from _hyperscript.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The hyperscript code to validate' },
        mode: MODE_PROPERTY,
      },
      required: ['code'],
    },
  },
  {
    name: 'parse_hyperscript',
    description:
      'Parse _hyperscript with the real parser and return a compact AST view plus the command sequence and token stream. Ground truth for understanding what a snippet does. Uses the same modes as validate_hyperscript.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The hyperscript code to parse' },
        mode: MODE_PROPERTY,
        includeTokens: {
          type: 'boolean',
          description: 'Include the token stream in the result (default: false)',
          default: false,
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'suggest_command',
    description:
      'Heuristic helper: suggest the best _hyperscript command(s) for a described task. Not a parser — a keyword-matched starting point.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description:
            'Description of what you want to do (e.g., "show a modal", "toggle a class")',
        },
      },
      required: ['task'],
    },
  },
];

// =============================================================================
// Tool Handler
// =============================================================================

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const json = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

const missing = (param: string): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify({ error: `Missing required parameter: ${param}` }, null, 2) }],
  isError: true,
});

const invalidMode = (): ToolResult => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify({ error: `Invalid parameter: mode must be one of ${PARSE_MODES.join(', ')}` }, null, 2),
    },
  ],
  isError: true,
});

/** The requested parse mode; `program` when omitted, undefined when unrecognized. */
function readMode(value: unknown): ParseMode | undefined {
  if (value === undefined || value === null) return 'program';
  return PARSE_MODES.find(m => m === value);
}

export async function handleValidationTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'validate_hyperscript': {
        const code = args.code;
        if (typeof code !== 'string') return missing('code');
        const mode = readMode(args.mode);
        if (!mode) return invalidMode();
        return await validateHyperscript(code, mode);
      }

      case 'parse_hyperscript': {
        const code = args.code;
        if (typeof code !== 'string') return missing('code');
        const mode = readMode(args.mode);
        if (!mode) return invalidMode();
        return await parseHyperscript(code, mode, args.includeTokens === true);
      }

      case 'suggest_command': {
        const task = args.task;
        if (typeof task !== 'string' || !task) return missing('task');
        return suggestCommand(task);
      }

      default:
        return { content: [{ type: 'text', text: `Unknown validation tool: ${name}` }], isError: true };
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
// Program vs. snippet hint
// =============================================================================

const SNIPPET_HINT =
  'Not valid as an element script, but it parses as a standalone command or expression (mode "snippet"). ' +
  'Element scripts are made of features: put commands inside a handler such as `on click …` or `init …`.';

/**
 * A command or expression on its own is not an element script, which reads as
 * a surprising rejection when the caller meant a fragment. Say so explicitly.
 */
async function snippetHint(code: string, mode: ParseMode, errors: FlatError[]): Promise<string | undefined> {
  if (mode !== 'program' || errors.length === 0) return undefined;
  const snippet = await safeParse(code, 'snippet');
  return snippet.errors.length === 0 ? SNIPPET_HINT : undefined;
}

// =============================================================================
// validate_hyperscript
// =============================================================================

async function validateHyperscript(code: string, mode: ParseMode): Promise<ToolResult> {
  const { errors } = await safeParse(code, mode);
  const result: Record<string, unknown> = {
    valid: errors.length === 0,
    mode,
    version: await hyperscriptVersion(),
    errors,
    counts: { errors: errors.length },
  };
  const hint = await snippetHint(code, mode, errors);
  if (hint) result.hint = hint;
  return json(result);
}

// =============================================================================
// parse_hyperscript
// =============================================================================

async function parseHyperscript(code: string, mode: ParseMode, includeTokens: boolean): Promise<ToolResult> {
  const { node, errors } = await safeParse(code, mode);
  const { view, commandTypes, truncated } = astView(node ?? undefined);

  const result: Record<string, unknown> = {
    valid: errors.length === 0,
    mode,
    version: await hyperscriptVersion(),
    rootType: node?.type ?? null,
    commandSequence: commandTypes,
    ast: view,
    truncated,
    errors,
  };
  const hint = await snippetHint(code, mode, errors);
  if (hint) result.hint = hint;
  if (includeTokens) {
    result.tokens = (await tokenize(code)).map(t => ({
      type: t.type,
      value: t.value,
      line: t.line,
      column: t.column,
    }));
  }
  return json(result);
}

// =============================================================================
// suggest_command (heuristic)
// =============================================================================

interface CommandSuggestion {
  command: string;
  syntax: string;
  example: string;
  description: string;
}

export const COMMAND_SUGGESTIONS: Record<string, CommandSuggestion> = {
  toggle: { command: 'toggle', syntax: 'toggle <class|attr> [on <target>]', example: 'toggle .active on #menu', description: 'Toggle a class or attribute on/off' },
  show: { command: 'show', syntax: 'show <target> [with <transition>]', example: 'show #modal with *opacity', description: 'Show a hidden element' },
  hide: { command: 'hide', syntax: 'hide <target> [with <transition>]', example: 'hide #modal with *opacity', description: 'Hide an element' },
  add: { command: 'add', syntax: 'add <class|attr> [to <target>]', example: 'add .highlight to me', description: 'Add a class or attribute to an element' },
  remove: { command: 'remove', syntax: 'remove <class|attr> [from <target>]', example: 'remove .error from #form', description: 'Remove a class, attribute, or element' },
  set: { command: 'set', syntax: 'set <property> to <value>', example: 'set :count to 0', description: 'Set a variable or property value' },
  put: { command: 'put', syntax: 'put <value> into <target>', example: 'put "Hello" into #greeting', description: 'Set element content' },
  fetch: { command: 'fetch', syntax: 'fetch <url> [as <type>]', example: 'fetch /api/data as json', description: 'Make an HTTP request' },
  wait: { command: 'wait', syntax: 'wait <duration>', example: 'wait 500ms', description: 'Pause execution for a duration' },
  send: { command: 'send', syntax: 'send <event> [to <target>]', example: 'send refresh to #list', description: 'Dispatch a custom event' },
  trigger: { command: 'trigger', syntax: 'trigger <event> [on <target>]', example: 'trigger submit on #form', description: 'Trigger an event on an element' },
  call: { command: 'call', syntax: 'call <function>(args)', example: 'call alert("Hello")', description: 'Call a JavaScript function' },
  log: { command: 'log', syntax: 'log <expression>', example: 'log me', description: 'Log a value to the console' },
  increment: { command: 'increment', syntax: 'increment <variable>', example: 'increment :count', description: 'Add 1 to a variable' },
  decrement: { command: 'decrement', syntax: 'decrement <variable>', example: 'decrement :count', description: 'Subtract 1 from a variable' },
  go: { command: 'go', syntax: 'go to <url>', example: 'go to url /dashboard', description: 'Navigate to a URL' },
  append: { command: 'append', syntax: 'append <content> to <target>', example: 'append "<li>New</li>" to #list', description: 'Append content to an element' },
  take: { command: 'take', syntax: 'take <class> from <group>', example: 'take .active from .tabs', description: 'Move a class from siblings to current element' },
  transition: { command: 'transition', syntax: 'transition <property> to <value> over <duration>', example: 'transition *opacity to 0 over 500ms', description: 'Animate a CSS property' },
  make: { command: 'make', syntax: 'make a <tag> [called <name>]', example: 'make a <div.card/> called card', description: 'Create a new element' },
  measure: { command: 'measure', syntax: 'measure <target>', example: 'measure #box then log its width', description: 'Measure an element’s box metrics' },
  settle: { command: 'settle', syntax: 'settle', example: 'add .fade then settle then remove .fade', description: 'Wait for CSS transitions to settle' },
};

const TASK_PATTERNS: Array<{ pattern: RegExp; commands: string[] }> = [
  { pattern: /toggle|switch|on.off|flip/i, commands: ['toggle'] },
  { pattern: /show|display|visible|appear|reveal/i, commands: ['show'] },
  { pattern: /hide|invisible|disappear|conceal/i, commands: ['hide'] },
  { pattern: /add|attach|apply|include/i, commands: ['add'] },
  { pattern: /remove|delete|detach|strip/i, commands: ['remove'] },
  { pattern: /set|assign|update|change/i, commands: ['set'] },
  { pattern: /content|html|text|put|insert/i, commands: ['put'] },
  { pattern: /fetch|request|api|ajax|http|load.data/i, commands: ['fetch'] },
  { pattern: /wait|delay|pause|sleep|timeout/i, commands: ['wait'] },
  { pattern: /send|dispatch|emit|fire/i, commands: ['send', 'trigger'] },
  { pattern: /call|invoke|run|execute/i, commands: ['call'] },
  { pattern: /log|debug|print|console/i, commands: ['log'] },
  { pattern: /count|increment|add.1|increase/i, commands: ['increment'] },
  { pattern: /decrement|subtract|decrease/i, commands: ['decrement'] },
  { pattern: /navigate|redirect|go|url|page/i, commands: ['go'] },
  { pattern: /append|add.to.list|push/i, commands: ['append'] },
  { pattern: /tab|exclusive|active.class|take/i, commands: ['take'] },
  { pattern: /animate|transition|fade|slide/i, commands: ['transition'] },
  { pattern: /create|new element|build.dom/i, commands: ['make'] },
  { pattern: /measure|dimensions|size|width|height|bounding/i, commands: ['measure'] },
  { pattern: /modal|dialog|popup|overlay/i, commands: ['show', 'toggle'] },
  { pattern: /form|submit|validate/i, commands: ['fetch', 'send'] },
  { pattern: /class|css|style/i, commands: ['toggle', 'add', 'remove'] },
];

function suggestCommand(task: string): ToolResult {
  const seen = new Set<string>();
  const suggestions: CommandSuggestion[] = [];
  for (const { pattern, commands } of TASK_PATTERNS) {
    if (!pattern.test(task)) continue;
    for (const cmd of commands) {
      const s = COMMAND_SUGGESTIONS[cmd];
      if (s && !seen.has(cmd)) {
        seen.add(cmd);
        suggestions.push(s);
      }
    }
  }

  if (suggestions.length === 0) {
    return json({
      suggestions: [],
      message: 'No specific command matched. Try describing your task more specifically.',
      availableCommands: Object.keys(COMMAND_SUGGESTIONS),
    });
  }
  return json({ suggestions, task });
}
