/**
 * Inventory drift test.
 *
 * Pins our documented language inventory (src/tools/language-data.ts) to the
 * canonical _hyperscript parser's OWN command/feature registry. If a
 * `hyperscript.org` bump adds, removes, or renames a command, this fails — which
 * is the whole point: the docs can no longer silently drift from the grammar.
 */

import { describe, it, expect } from 'vitest';
import { registryProbe } from '../hyperscript-loader.js';
import { COMMAND_NAMES, FEATURE_NAMES, NON_COMMANDS, COMMAND_DOCS } from '../tools/language-data.js';

describe('inventory drift vs canonical parser', () => {
  it('every documented command is registered in the real parser', async () => {
    const { isCommand } = await registryProbe();
    const missing = COMMAND_NAMES.filter(c => !isCommand(c));
    expect(missing, `commands we list but the parser does not register: ${missing.join(', ')}`).toEqual([]);
  });

  it('every documented feature is registered in the real parser', async () => {
    const { isFeature } = await registryProbe();
    const missing = FEATURE_NAMES.filter(f => !isFeature(f));
    expect(missing, `features we list but the parser does not register: ${missing.join(', ')}`).toEqual([]);
  });

  it('known non-commands are NOT registered as commands', async () => {
    const { isCommand } = await registryProbe();
    const leaked = NON_COMMANDS.filter(c => isCommand(c));
    expect(leaked, `keywords we treat as non-commands but the parser registers: ${leaked.join(', ')}`).toEqual([]);
  });

  it('every curated command doc is a real command (no phantom docs)', () => {
    const phantom = Object.keys(COMMAND_DOCS).filter(k => !COMMAND_NAMES.includes(k));
    expect(phantom, `curated docs for non-existent commands: ${phantom.join(', ')}`).toEqual([]);
  });

  it('includes the commands the old server was missing', () => {
    for (const cmd of ['make', 'measure', 'pick', 'render', 'settle', 'beep!']) {
      expect(COMMAND_NAMES).toContain(cmd);
    }
  });
});
