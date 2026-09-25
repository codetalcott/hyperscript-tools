/**
 * MCP Resources for original _hyperscript
 *
 * Static documentation resources.
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import {
  getCommandsReference,
  getExpressionsGuide,
  getEventsReference,
  getCommonPatterns,
} from './content.js';

// =============================================================================
// Resource Listing
// =============================================================================

export function listResources(): Resource[] {
  return [
    {
      uri: 'hyperscript://docs/commands',
      name: '_hyperscript Commands Reference',
      description: 'Quick reference for common _hyperscript commands',
      mimeType: 'text/markdown',
    },
    {
      uri: 'hyperscript://docs/expressions',
      name: '_hyperscript Expressions Guide',
      description: 'Guide to hyperscript expression syntax',
      mimeType: 'text/markdown',
    },
    {
      uri: 'hyperscript://docs/events',
      name: '_hyperscript Events Reference',
      description: 'Event handling and modifiers',
      mimeType: 'text/markdown',
    },
    {
      uri: 'hyperscript://examples/common',
      name: 'Common Patterns',
      description: 'Frequently used _hyperscript patterns with examples',
      mimeType: 'text/markdown',
    },
  ];
}

// =============================================================================
// Resource Reading
// =============================================================================

/** The MCP spec's error code for an unknown resource URI (not in the SDK's ErrorCode enum). */
export const RESOURCE_NOT_FOUND = -32002;

export function readResource(uri: string): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  switch (uri) {
    case 'hyperscript://docs/commands':
      return { contents: [{ uri, mimeType: 'text/markdown', text: getCommandsReference() }] };
    case 'hyperscript://docs/expressions':
      return { contents: [{ uri, mimeType: 'text/markdown', text: getExpressionsGuide() }] };
    case 'hyperscript://docs/events':
      return { contents: [{ uri, mimeType: 'text/markdown', text: getEventsReference() }] };
    case 'hyperscript://examples/common':
      return { contents: [{ uri, mimeType: 'text/markdown', text: getCommonPatterns() }] };
    default:
      // The SDK sends a thrown error's `code`, `message` and `data` as they are.
      // (McpError would work too, but it prefixes its code to the message, so
      // the client would show that prefix twice.)
      throw Object.assign(new Error(`Resource not found: ${uri}`), { code: RESOURCE_NOT_FOUND, data: { uri } });
  }
}
