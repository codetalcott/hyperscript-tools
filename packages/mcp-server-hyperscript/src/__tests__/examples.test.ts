/**
 * Shipped examples.
 *
 * Every hyperscript example the server hands to an agent — curated command and
 * expression docs, suggest_command examples, completion modifiers, and the code
 * in the MCP resources — must parse clean with the real parser, read the way a
 * user would use it: `_="…"` attributes and handler examples as element scripts,
 * standalone examples as snippets.
 *
 * Parsing alone is not enough: `on click.once` parses clean but listens for an
 * event literally named "click.once", so no example may use a dotted event name.
 */

import { describe, it, expect } from 'vitest';
import { safeParse, type ParseMode } from '../hyperscript-loader.js';
import { COMMAND_DOCS, EXPRESSION_DOCS } from '../tools/language-data.js';
import { COMMAND_SUGGESTIONS } from '../tools/validation.js';
import { EVENT_MODIFIERS } from '../tools/lsp-bridge.js';
import { listResources, readResource } from '../resources/index.js';

interface Example {
  source: string;
  code: string;
  mode: ParseMode;
}

/** `_="…"` attributes (element scripts) and "Example" table cells (snippets) in a markdown resource. */
function resourceExamples(uri: string, markdown: string): Example[] {
  const out: Example[] = [];
  for (const m of markdown.matchAll(/\s_="([^"]*)"/g)) out.push({ source: uri, code: m[1], mode: 'program' });
  let exampleColumn = -1;
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) {
      exampleColumn = -1;
      continue;
    }
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.includes('Example')) {
      exampleColumn = cells.indexOf('Example');
      continue;
    }
    if (exampleColumn === -1 || /^:?-+:?$/.test(cells[0] ?? '')) continue;
    for (const m of (cells[exampleColumn] ?? '').matchAll(/`([^`]+)`/g)) {
      out.push({ source: uri, code: m[1], mode: 'snippet' });
    }
  }
  return out;
}

const EXAMPLES: Example[] = [
  ...Object.values(COMMAND_DOCS).flatMap(d =>
    d.examples.map(code => ({ source: `get_command_docs ${d.name}`, code, mode: 'snippet' as const }))
  ),
  ...Object.values(EXPRESSION_DOCS).flatMap(d =>
    d.examples.map(code => ({ source: `get_expression_docs ${d.name}`, code, mode: 'snippet' as const }))
  ),
  ...Object.values(COMMAND_SUGGESTIONS).map(s => ({
    source: `suggest_command ${s.command}`,
    code: s.example,
    mode: 'snippet' as const,
  })),
  ...EVENT_MODIFIERS.map(m => ({ source: `get_completions ${m.label}`, code: m.example, mode: 'program' as const })),
  ...listResources().flatMap(({ uri }) => resourceExamples(uri, readResource(uri).contents[0].text)),
];

/** Event names of every `on` handler in a parsed tree. */
function eventNames(node: unknown, seen = new Set<object>()): string[] {
  if (!node || typeof node !== 'object' || seen.has(node)) return [];
  seen.add(node);
  const n = node as { type?: unknown; events?: Array<{ on?: unknown }> };
  const own = n.type === 'onFeature' && Array.isArray(n.events) ? n.events.map(e => String(e.on)) : [];
  return [...own, ...Object.values(node).flatMap(child => eventNames(child, seen))];
}

describe('example extraction', () => {
  it('finds examples in every resource', () => {
    for (const { uri } of listResources()) {
      expect(EXAMPLES.some(e => e.source === uri), uri).toBe(true);
    }
  });

  it('detects dotted event names', async () => {
    const { node } = await safeParse('on click.once log 1');
    expect(eventNames(node)).toEqual(['click.once']);
  });
});

describe('shipped examples', () => {
  it.each(EXAMPLES.map(e => [`${e.source}: ${e.code.replace(/\s+/g, ' ')}`, e] as const))(
    '%s',
    async (_label, { code, mode }) => {
      const { node, errors } = await safeParse(code, mode);
      expect(errors, JSON.stringify(errors)).toEqual([]);
      expect(eventNames(node).filter(name => name.includes('.'))).toEqual([]);
    }
  );
});
