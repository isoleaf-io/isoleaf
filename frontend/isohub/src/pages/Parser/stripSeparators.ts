/**
 * Heuristically strips common hex-byte separators (space, hyphen, colon, dot)
 * from pasted input — e.g. "30 31 30 30" or "30-31-30-30" → "30313030".
 *
 * Conservative on purpose:
 *  - Only fires when the input "looks like" a separator-delimited hex sequence
 *    (≥5 tokens, every token is 1-2 hex chars). This avoids mangling ASCII-wire
 *    captures that contain legitimate spaces (e.g. inside Card Acceptor Name).
 *  - Returns the original string unchanged when the heuristic doesn't match,
 *    so the backend's normal auto-detection still wins.
 */
const SEPARATOR_RE = /[\s\-:.]+/;

export interface StripResult {
  cleaned: string;
  removed: boolean;
}

export function stripCommonSeparators(input: string): StripResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { cleaned: trimmed, removed: false };

  // No separators at all? Nothing to do — pass-through.
  if (!/[\s\-:.]/.test(trimmed)) return { cleaned: trimmed, removed: false };

  const tokens = trimmed.split(SEPARATOR_RE).filter((t) => t.length > 0);

  // Need at least 5 tokens to be confident we're dealing with byte-separated
  // hex rather than free-form text with a few spaces.
  if (tokens.length < 5) return { cleaned: trimmed, removed: false };

  // Every token must be 1-2 chars of pure hex (handles "5" as "05" as well
  // as standard "30" / "AB" pairs).
  const HEX_TOKEN = /^[0-9a-fA-F]{1,2}$/;
  if (!tokens.every((t) => HEX_TOKEN.test(t))) {
    return { cleaned: trimmed, removed: false };
  }

  return { cleaned: tokens.join(""), removed: true };
}
