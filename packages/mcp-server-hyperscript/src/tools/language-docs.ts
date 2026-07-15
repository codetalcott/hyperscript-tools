/**
 * Documentation tools for original _hyperscript.
 *
 * All inventory comes from ./language-data (which is pinned to the canonical
 * parser by the drift test), so `get_command_docs` cannot advertise a command
 * the parser doesn't have, nor miss one it does.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  COMMAND_DOCS,
  COMMAND_NAMES,
  EXPRESSION_DOCS,
  FEATURE_NAMES,
  SPECIAL_SYMBOLS,
} from './language-data.js';
import { hyperscriptVersion } from '../hyperscript-loader.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const languageDocsTools: Tool[] = [
  {
    name: 'get_command_docs',
    description:
      'Get documentation for a specific _hyperscript command (syntax, description, examples).',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command name (e.g., "toggle", "make", "fetch")' },
      },
      required: ['command'],
    },
  },
  {
    name: 'get_expression_docs',
    description:
      'Get documentation for a _hyperscript expression type (e.g., "me", "closest", "possessive", "as").',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'The expression name (e.g., "me", "closest", "as")' },
      },
      required: ['expression'],
    },
  },
  {
    name: 'search_language_elements',
    description:
      'Search across _hyperscript language elements (commands, expressions, special symbols).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to find matching language elements' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10)', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_language_info',
    description:
      'Report the canonical _hyperscript grammar version this server targets, plus the full list of commands and features it recognizes.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// =============================================================================
// Handler
// =============================================================================

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

const json = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

/** Normalize a user-supplied command name (`beep` -> `beep!`, trims/lowercases). */
function normalizeCommand(input: string): string {
  const c = input.trim().toLowerCase();
  if (c === 'beep') return 'beep!';
  return c;
}

export async function handleLanguageDocsTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_command_docs': {
        const raw = args.command;
        if (typeof raw !== 'string' || !raw) {
          return { ...json({ error: 'Missing required parameter: command' }), isError: true };
        }
        const command = normalizeCommand(raw);
        const doc = COMMAND_DOCS[command];
        if (doc) return json(doc);
        // Registered by the parser but not curated here — still a real command.
        if (COMMAND_NAMES.includes(command)) {
          return json({
            name: command,
            registered: true,
            note: `"${command}" is a valid _hyperscript command; detailed docs are not curated here. See https://hyperscript.org/commands/`,
          });
        }
        return json({ error: `Unknown command: ${command}`, availableCommands: [...COMMAND_NAMES].sort() });
      }

      case 'get_expression_docs': {
        const raw = args.expression;
        if (typeof raw !== 'string' || !raw) {
          return { ...json({ error: 'Missing required parameter: expression' }), isError: true };
        }
        const expression = raw.trim().toLowerCase();
        const doc = EXPRESSION_DOCS[expression];
        if (doc) return json(doc);
        return json({ error: `Unknown expression: ${expression}`, availableExpressions: Object.keys(EXPRESSION_DOCS).sort() });
      }

      case 'search_language_elements': {
        const raw = args.query;
        if (typeof raw !== 'string' || !raw) {
          return { ...json({ error: 'Missing required parameter: query' }), isError: true };
        }
        const query = raw.trim().toLowerCase();
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const results: Array<{ type: string; name: string; description: string; match: string }> = [];

        for (const doc of Object.values(COMMAND_DOCS)) {
          if (doc.name.toLowerCase().includes(query) || doc.description.toLowerCase().includes(query) || doc.category.toLowerCase().includes(query)) {
            results.push({ type: 'command', name: doc.name, description: doc.description, match: doc.category });
          }
        }
        for (const doc of Object.values(EXPRESSION_DOCS)) {
          if (doc.name.toLowerCase().includes(query) || doc.description.toLowerCase().includes(query) || doc.category.includes(query)) {
            results.push({ type: 'expression', name: doc.name, description: doc.description, match: doc.category });
          }
        }
        for (const sym of SPECIAL_SYMBOLS) {
          if (sym.name.includes(query) || sym.description.toLowerCase().includes(query) || sym.symbol.includes(query)) {
            results.push({ type: 'special_symbol', name: sym.name, description: `${sym.symbol} — ${sym.description}`, match: sym.symbol });
          }
        }

        return json({ query, results: results.slice(0, limit), total: results.length });
      }

      case 'get_language_info': {
        return json({
          hyperscriptVersion: await hyperscriptVersion(),
          commandCount: COMMAND_NAMES.length,
          commands: [...COMMAND_NAMES].sort(),
          featureCount: FEATURE_NAMES.length,
          features: [...FEATURE_NAMES].sort(),
          documentedCommands: Object.keys(COMMAND_DOCS).sort(),
        });
      }

      default:
        return { content: [{ type: 'text', text: `Unknown language docs tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error in ${name}: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}
