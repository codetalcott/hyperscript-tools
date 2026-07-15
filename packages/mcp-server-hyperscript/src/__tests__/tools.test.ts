import { describe, it, expect } from 'vitest';

import { validationTools, handleValidationTool } from '../tools/validation.js';
import { lspBridgeTools, handleLspBridgeTool } from '../tools/lsp-bridge.js';
import { languageDocsTools, handleLanguageDocsTool } from '../tools/language-docs.js';
import { listResources, readResource } from '../resources/index.js';

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

  it('throws on unknown resource', () => {
    expect(() => readResource('hyperscript://unknown')).toThrow();
  });
});
