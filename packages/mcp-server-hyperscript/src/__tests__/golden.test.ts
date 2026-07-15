/**
 * Golden corpus: real _hyperscript that must parse clean, and broken snippets
 * that must report errors with positions. These are end-to-end checks that the
 * parser-backed validator agrees with the real language.
 */

import { describe, it, expect } from 'vitest';
import { handleValidationTool } from '../tools/validation.js';

async function validate(code: string) {
  const result = await handleValidationTool('validate_hyperscript', { code });
  return JSON.parse(result.content[0].text) as {
    valid: boolean;
    errors: Array<{ message: string; line: number | null; column: number | null }>;
  };
}

// Idiomatic snippets drawn from hyperscript.org usage patterns.
const VALID = [
  'on click toggle .active on me',
  'on click add .highlight to me then wait 500ms then remove .highlight from me',
  "on click send refresh to #list",
  'on click if I match .active hide me else show me end',
  'on click repeat for x in [1, 2, 3] log x end',
  'on click fetch /api/data as json then put it into #output',
  'behavior Removable\n  on click remove me\nend',
  'def greet(name)\n  log name\nend',
  'on click take .active from .tab for me',
  'on mouseenter transition my *opacity to 0.5 over 200ms',
  'on click make a <div.card/> called card then put card at the end of me',
  'init add .ready to me',
];

// Snippets the real parser rejects.
const INVALID = [
  'on click toggle',              // toggle with no operand
  'on click set to 5',           // set with no target
  'on click put "x"',            // put with no destination
];

describe('golden corpus — valid snippets parse clean', () => {
  it.each(VALID)('valid: %s', async code => {
    const { valid, errors } = await validate(code);
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(valid).toBe(true);
  });
});

describe('golden corpus — invalid snippets report errors', () => {
  it.each(INVALID)('invalid: %s', async code => {
    const { valid, errors } = await validate(code);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeTruthy();
  });
});

describe('parser-truth regressions (old regex validator got these wrong)', () => {
  it('accepts `repeat for` (old validator saw an unclosed block)', async () => {
    const { valid } = await validate('on click repeat for x in [1,2,3] log x end');
    expect(valid).toBe(true);
  });

  it('accepts a quote inside a string / possessive-looking text', async () => {
    const { valid } = await validate(`on click put "it's fine" into me`);
    expect(valid).toBe(true);
  });

  it('reports a real error with an accurate line/column position', async () => {
    // The stray `log x` on line 3 is the syntax error; the parser pinpoints it.
    const { errors } = await validate('on click\n  set x to\n  log x');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].line).toBe(3);
    expect(typeof errors[0].column).toBe('number');
  });
});
