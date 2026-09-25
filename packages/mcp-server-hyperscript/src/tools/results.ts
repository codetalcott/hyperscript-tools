/**
 * Result and argument helpers shared by the tool modules.
 *
 * Bad input is reported as a tool result with `isError: true`, which the calling
 * agent sees and can correct, never as a thrown exception (which the SDK turns
 * into an opaque JSON-RPC internal error).
 */

export type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

export const json = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

export const toolError = (message: string): ToolResult => ({ ...json({ error: message }), isError: true });

export const missing = (param: string): ToolResult => toolError(`Missing required parameter: ${param}`);

export const invalid = (param: string, expected: string): ToolResult =>
  toolError(`Invalid parameter: ${param} must be ${expected}`);

/**
 * Longest `code` the tools accept. Parse time grows faster than the input
 * (roughly 0.1 s at 30 KB, 1.4 s at 115 KB), and parsing blocks the server.
 */
export const MAX_CODE_LENGTH = 100_000;

/** The `code` argument, or the error result to return instead. */
export function readCode(args: Record<string, unknown>): string | ToolResult {
  const code = args.code;
  if (code === undefined || code === null) return missing('code');
  if (typeof code !== 'string') return invalid('code', 'a string');
  if (code.length > MAX_CODE_LENGTH) {
    return toolError(`code is too long: ${code.length} characters (limit ${MAX_CODE_LENGTH})`);
  }
  return code;
}

/** A required zero-based position argument (`line`, `character`), or the error result. */
export function readPosition(args: Record<string, unknown>, param: string): number | ToolResult {
  const value = args[param];
  if (value === undefined || value === null) return missing(param);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return invalid(param, 'a non-negative integer');
  }
  return value;
}
