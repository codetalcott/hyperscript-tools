import { describe, it, expect } from 'vitest';

import { validationTools, handleValidationTool } from '../tools/validation.js';
import { lspBridgeTools, handleLspBridgeTool } from '../tools/lsp-bridge.js';
import { languageDocsTools, handleLanguageDocsTool } from '../tools/language-docs.js';
import { listResources, readResource, RESOURCE_NOT_FOUND } from '../resources/index.js';
import { MAX_CODE_LENGTH } from '../tools/results.js';

const parse = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0].text);

describe('Tool Definitions', () => {
  it('exports validation tools', () => {
    expect(validationTools.map(t => t.name)).toEqual([
      'validate_hyperscript',
      'parse_hyperscript',
      'suggest_command',
    ]);
  });

  it('exports LSP bridge tools', () => {
    expect(lspBridgeTools.map(t => t.name)).toEqual([
      'get_completions',
      'get_hover_info',
      'get_document_symbols',
    ]);
  });

  it('exports language docs tools', () => {
    expect(languageDocsTools.map(t => t.name)).toEqual([
      'get_command_docs',
      'get_expression_docs',
      'search_language_elements',
      'get_language_info',
    ]);
  });

  it('provides 10 total tools', () => {
    const total = validationTools.length + lspBridgeTools.length + languageDocsTools.length;
    expect(total).toBe(10);
  });
});

describe('validate_hyperscript (parser-backed)', () => {
  it('validates correct hyperscript', async () => {
    const data = parse(await handleValidationTool('validate_hyperscript', { code: 'on click toggle .active on me' }));
    expect(data.valid).toBe(true);
    expect(data.errors).toHaveLength(0);
    expect(data.version).toBeTruthy();
  });

  it('reports real errors with positions for invalid code', async () => {
    const data = parse(await handleValidationTool('validate_hyperscript', { code: 'on click toggle' }));
    expect(data.valid).toBe(false);
    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.errors[0]).toHaveProperty('message');
    expect(data.errors[0]).toHaveProperty('line');
  });

  it('does not throw on a js command with invalid JS body', async () => {
    const data = parse(await handleValidationTool('validate_hyperscript', { code: 'js return ??? end' }));
    expect(data).toHaveProperty('valid');
  });

  it('returns the parser verdict for an empty string, not a missing-param error', async () => {
    // An empty program is *provided*; report what the parser says (it rejects it)
    // rather than pretending the caller forgot the argument.
    const result = await handleValidationTool('validate_hyperscript', { code: '' });
    expect(result.isError).toBeFalsy();
    const data = parse(result);
    expect(data).toHaveProperty('valid');
    expect(data.error).toBeUndefined();
  });

  it('still rejects a genuinely missing code argument', async () => {
    const result = await handleValidationTool('validate_hyperscript', {});
    expect(result.isError).toBe(true);
    expect(parse(result).error).toContain('Missing required parameter');
  });

  it('defaults to program mode and echoes the mode used', async () => {
    const data = parse(await handleValidationTool('validate_hyperscript', { code: 'on click log 1' }));
    expect(data.mode).toBe('program');
    const snippet = parse(
      await handleValidationTool('validate_hyperscript', { code: 'log 1', mode: 'snippet' })
    );
    expect(snippet.mode).toBe('snippet');
    expect(snippet.valid).toBe(true);
  });

  it('rejects an unknown mode', async () => {
    const result = await handleValidationTool('validate_hyperscript', { code: 'log 1', mode: 'element' });
    expect(result.isError).toBe(true);
    expect(parse(result).error).toContain('mode');
  });

  it('rejects code over the size limit instead of parsing it', async () => {
    const result = await handleValidationTool('validate_hyperscript', { code: 'x'.repeat(MAX_CODE_LENGTH + 1) });
    expect(result.isError).toBe(true);
    expect(parse(result).error).toContain('too long');
  });
});

describe('parse_hyperscript', () => {
  it('returns AST view and command sequence', async () => {
    const data = parse(
      await handleValidationTool('parse_hyperscript', { code: 'on click toggle .active then wait 200ms' })
    );
    expect(data.valid).toBe(true);
    expect(data.rootType).toBeTruthy();
    expect(data.commandSequence).toContain('toggleCommand');
    expect(data.ast).toBeTruthy();
  });

  it('includes tokens when asked', async () => {
    const data = parse(
      await handleValidationTool('parse_hyperscript', { code: 'toggle .active', includeTokens: true })
    );
    expect(Array.isArray(data.tokens)).toBe(true);
    expect(data.tokens.length).toBeGreaterThan(0);
  });

  it('omits internal plumbing and circular-ref noise from the AST view', async () => {
    const data = parse(
      await handleValidationTool('parse_hyperscript', {
        code: 'on click if I match .active hide me else show me end',
      })
    );
    // The command sequence is real commands only, not the empty-list terminators.
    expect(data.commandSequence).toContain('ifCommand');
    expect(data.commandSequence).not.toContain('emptyCommandListCommand');
    // The compact view drops the internal binding maps and their back-references.
    const astText = JSON.stringify(data.ast);
    expect(astText).not.toContain('[circular]');
    expect(astText).not.toContain('isFeature');
    expect(astText).not.toContain('implicitReturn');
  });

  it('keeps real parameter lists (def args stay an array)', async () => {
    const data = parse(
      await handleValidationTool('parse_hyperscript', { code: 'def greet(name, age) log name end' })
    );
    const feature = (data.ast.features as Array<{ args?: unknown }>)[0];
    expect(Array.isArray(feature.args)).toBe(true);
    expect(feature.args).toHaveLength(2);
  });

  it('parses a leading `set` as a feature in program mode', async () => {
    const data = parse(
      await handleValidationTool('parse_hyperscript', { code: 'set $count to 0\non click increment $count' })
    );
    expect(data.valid).toBe(true);
    expect(data.rootType).toBe('hyperscript');
    expect(data.ast.features.map((f: { type: string }) => f.type)).toEqual(['setFeature', 'onFeature']);
  });

  it('shows the object a property or method belongs to', async () => {
    const data = parse(
      await handleValidationTool('parse_hyperscript', { code: 'log #code.textContent', mode: 'snippet' })
    );
    expect(data.ast.exprs[0]).toMatchObject({ type: 'propertyAccess', root: { type: 'idRef', css: '#code' } });
  });

  it('shows values held only in a binding map, without repeats', async () => {
    const set = parse(await handleValidationTool('parse_hyperscript', { code: 'set :count to 5', mode: 'snippet' }));
    expect(set.ast.args).toEqual({ value: { type: 'number', value: 5 } });
    const unless = parse(await handleValidationTool('parse_hyperscript', { code: 'log x unless y', mode: 'snippet' }));
    expect(unless.ast).toMatchObject({ root: { type: 'logCommand' }, args: { conditional: { name: 'y' } } });
    expect(unless.ast.root.args).toBeUndefined(); // log's own binding map only repeats `exprs`
    expect(JSON.stringify(unless.ast)).not.toContain('[circular]');
  });

  it('keeps the parse result when the tokens cannot be produced', async () => {
    const result = await handleValidationTool('parse_hyperscript', { code: 'on click log §', includeTokens: true });
    expect(result.isError).toBeFalsy();
    const data = parse(result);
    expect(data.valid).toBe(false);
    expect(data.tokens).toBeNull();
    expect(data.errors[0]).toMatchObject({ line: 1, column: 13 });
  });

  it('parses a bare command in snippet mode', async () => {
    const data = parse(
      await handleValidationTool('parse_hyperscript', { code: 'toggle .active', mode: 'snippet' })
    );
    expect(data.valid).toBe(true);
    expect(data.rootType).toBe('toggleCommand');
  });
});

describe('suggest_command (heuristic)', () => {
  it('suggests commands for tasks', async () => {
    const data = parse(await handleValidationTool('suggest_command', { task: 'show a modal dialog' }));
    expect(data.suggestions.some((s: { command: string }) => s.command === 'show')).toBe(true);
  });
});

describe('LSP Bridge Tools', () => {
  it('provides completions in event context', async () => {
    const data = parse(await handleLspBridgeTool('get_completions', { code: 'on ', line: 0, character: 3, context: 'event' }));
    expect(data.completions.some((c: { label: string }) => c.label === 'click')).toBe(true);
  });

  it('provides hover for known keywords', async () => {
    const data = parse(await handleLspBridgeTool('get_hover_info', { code: 'toggle .active', line: 0, character: 3 }));
    expect(data.hover).not.toBeNull();
    expect(data.hover.contents).toContain('toggle');
  });

  it('extracts document symbols from the AST', async () => {
    const code = 'behavior MyBehavior\n  on load show me\nend\ndef greet(name)\n  log name\nend';
    const data = parse(await handleLspBridgeTool('get_document_symbols', { code }));
    const kinds = data.symbols.map((s: { kind: string }) => s.kind);
    expect(kinds).toContain('Class'); // behavior
    expect(kinds).toContain('Function'); // def
    expect(data.count).toBeGreaterThanOrEqual(2);
  });

  it('finds symbols in a script that starts with the `set` feature', async () => {
    const code = 'set $count to 0\non click increment $count';
    const data = parse(await handleLspBridgeTool('get_document_symbols', { code }));
    expect(data.symbols.map((s: { name: string }) => s.name)).toContain('on click');
  });

  it('reports every core feature as a symbol', async () => {
    const code = [
      'set $count to 0',
      'when $count changes log it',
      'bind $name to #input.value',
      'live set $total to $count end',
      'install Removable',
      'js',
      '  function greet() { return 1 }',
      'end',
    ].join('\n');
    const data = parse(await handleLspBridgeTool('get_document_symbols', { code }));
    expect(data.symbols).toEqual([
      { name: 'set $count', kind: 'Variable', line: 1 },
      { name: 'when $count changes', kind: 'Event', line: 2 },
      { name: 'bind $name', kind: 'Variable', line: 3 },
      { name: 'live', kind: 'Event', line: 4 },
      { name: 'install Removable', kind: 'Module', line: 5 },
      { name: 'js (greet)', kind: 'Module', line: 6 },
    ]);
  });

  it.each([
    ['on ', 'event', 'click'],
    ['toggle .active on ', 'selector', '#'],
    ['on click then ', 'command', 'add'],
    ['on click if ', 'expression', 'me'],
  ])('infers the completion context after %j', async (code, context, first) => {
    const data = parse(
      await handleLspBridgeTool('get_completions', { code, line: 0, character: code.length })
    );
    expect(data.context).toBe(context);
    expect(data.completions[0].label).toBe(first);
  });

  it('narrows completions to the word being typed', async () => {
    for (const [code, labels] of [['on cl', ['click']], ['on click then tog', ['toggle']]] as const) {
      const data = parse(
        await handleLspBridgeTool('get_completions', { code, line: 0, character: code.length })
      );
      expect(data.completions.map((c: { label: string }) => c.label)).toEqual(labels);
    }
  });

  it('offers only the modifiers that can follow `on` right after it', async () => {
    const data = parse(await handleLspBridgeTool('get_completions', { code: 'on ', line: 0, character: 3 }));
    const labels = data.completions.map((c: { label: string }) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['every', 'first']));
    expect(labels).not.toContain('debounced at');
  });

  it.each([
    ['get_completions', {}, 'Missing required parameter: code'],
    ['get_hover_info', { code: 1, line: 0, character: 0 }, 'code must be a string'],
    ['get_completions', { code: 'x', line: -1, character: 0 }, 'line must be a non-negative integer'],
    ['get_hover_info', { code: 'x', line: 0, character: 1.5 }, 'character must be a non-negative integer'],
    ['get_completions', { code: 'x', line: 0, character: 0, context: 'bogus' }, 'context must be one of'],
    ['get_document_symbols', {}, 'Missing required parameter: code'],
  ])('%s rejects bad input %j', async (tool, args, message) => {
    const result = await handleLspBridgeTool(tool, args);
    expect(result.isError).toBe(true);
    expect(parse(result).error).toContain(message);
  });
});

describe('Language Docs Tools', () => {
  it('returns command docs', async () => {
    const data = parse(await handleLanguageDocsTool('get_command_docs', { command: 'toggle' }));
    expect(data.name).toBe('toggle');
    expect(data.examples.length).toBeGreaterThan(0);
  });

  it('documents commands the old server was missing', async () => {
    for (const cmd of ['make', 'measure', 'settle', 'render']) {
      const data = parse(await handleLanguageDocsTool('get_command_docs', { command: cmd }));
      expect(data.error, `expected docs for ${cmd}`).toBeUndefined();
    }
  });

  it('normalizes beep -> beep!', async () => {
    const data = parse(await handleLanguageDocsTool('get_command_docs', { command: 'beep' }));
    expect(data.name).toBe('beep!');
  });

  it('rejects a non-command with the real command list', async () => {
    const data = parse(await handleLanguageDocsTool('get_command_docs', { command: 'frobnicate' }));
    expect(data.error).toBeTruthy();
    expect(data.availableCommands).toContain('toggle');
  });

  it('returns expression docs', async () => {
    const data = parse(await handleLanguageDocsTool('get_expression_docs', { expression: 'me' }));
    expect(data.name).toBe('me');
    expect(data.category).toBe('references');
  });

  it('searches language elements', async () => {
    const data = parse(await handleLanguageDocsTool('search_language_elements', { query: 'class' }));
    expect(data.results.length).toBeGreaterThan(0);
  });

  it('treats the search limit as a whole, non-negative count', async () => {
    const search = async (limit: number) =>
      parse(await handleLanguageDocsTool('search_language_elements', { query: 'class', limit })).results.length;
    expect(await search(-1)).toBe(0);
    expect(await search(2.7)).toBe(2);
  });

  it('reports language info with the canonical version', async () => {
    const data = parse(await handleLanguageDocsTool('get_language_info', {}));
    expect(data.hyperscriptVersion).toBeTruthy();
    expect(data.commands).toContain('make');
    expect(data.commandCount).toBeGreaterThan(40);
  });
});

describe('Resources', () => {
  it('lists 4 resources', () => {
    expect(listResources().map(r => r.uri)).toEqual([
      'hyperscript://docs/commands',
      'hyperscript://docs/expressions',
      'hyperscript://docs/events',
      'hyperscript://examples/common',
    ]);
  });

  it('reads commands reference', () => {
    const result = readResource('hyperscript://docs/commands');
    expect(result.contents[0].text).toContain('toggle');
  });

  it('throws the MCP resource-not-found error on unknown resource', () => {
    let thrown: unknown;
    try {
      readResource('hyperscript://unknown');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toMatchObject({ code: RESOURCE_NOT_FOUND });
  });
});
