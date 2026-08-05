import { PATTERNS, PII_KEY_NAMES, SECRET_KEY_NAMES, SECRET_PATTERNS } from '../patterns.js';
import type { DetectOptions, PatternName } from '../types.js';
import { FULL_REDACTION, luhnCheck, maskByPattern } from './mask.js';

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

function isSecretKey(key: string, extraKeys: readonly string[]): boolean {
  const normalized = normalizeKey(key);
  return (
    SECRET_KEY_NAMES.some(k => normalizeKey(k) === normalized) || extraKeys.some(k => normalizeKey(k) === normalized)
  );
}

function piiKeyPattern(key: string): PatternName | undefined {
  return PII_KEY_NAMES[normalizeKey(key)];
}

function isSensitiveKey(key: string, extraKeys: readonly string[]): boolean {
  return isSecretKey(key, extraKeys) || piiKeyPattern(key) !== undefined;
}

/** Redact a value whose *key name* (not necessarily its content) marked it
 * as sensitive. Secret keys are always fully redacted; PII-named keys
 * (ssn, creditCard, ...) go through the same pattern-aware masking as
 * content matches, so `maskStrategy: 'partial'` is honored consistently. */
function redactSensitiveValue(value: unknown, key: string, options: DetectOptions, depth: number): unknown {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return detect(value, options, depth + 1); // nested object under a sensitive key name - walk it
  }

  const stringValue = String(value);

  if (isSecretKey(key, options.extraSensitiveKeys)) {
    return FULL_REDACTION;
  }

  const pattern = piiKeyPattern(key);
  if (pattern) {
    if (pattern === 'creditCard' && !luhnCheck(stringValue)) {
      return value; // key says "card number" but value doesn't check out - leave it
    }
    return options.maskStrategy === 'full' ? FULL_REDACTION : maskByPattern(stringValue, pattern);
  }

  return value;
}

/** Redact PII substrings found inside a free-text string (e.g. a log
 * message like "user jane@x.com failed login"), leaving the rest intact. */
function redactString(value: string, opts: DetectOptions): string {
  let result = value;
  const activePatterns = (Object.keys(PATTERNS) as PatternName[]).filter(name => !opts.disablePatterns.includes(name));

  for (const name of activePatterns) {
    const regex = PATTERNS[name];
    result = result.replace(regex, match => {
      if (name === 'creditCard' && !luhnCheck(match)) {
        return match; // not a valid card number, leave alone
      }
      const isSecret = SECRET_PATTERNS.has(name);
      if (opts.maskStrategy === 'full' || isSecret) return FULL_REDACTION;
      return maskByPattern(match, name);
    });
  }

  for (const [, regex] of Object.entries(opts.extraPatterns)) {
    result = result.replace(regex, FULL_REDACTION);
  }

  return result;
}

/**
 * Recursively walk a value, redacting:
 *  - any field whose key name is a known secret name (always fully redacted)
 *  - any string content matching a built-in or extra PII/secret pattern
 * Returns a new value; the input is never mutated.
 */
export function detect<T>(input: T, options: DetectOptions, depth = 0): T {
  if (depth > options.maxDepth) return input;

  if (typeof input === 'string') {
    return redactString(input, options) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map(item => detect(item, options, depth + 1)) as unknown as T;
  }

  if (input instanceof Date || input instanceof RegExp) {
    return input;
  }

  // Binary/collection types: don't walk these as plain objects.
  // Object.entries() on a Buffer/TypedArray iterates every byte as an
  // enumerable numeric key, exploding a binary payload into a huge
  // index-keyed object. Map/Set have no enumerable own keys at all, so
  // the generic object branch silently turns them into `{}`, losing the
  // data entirely. None of these are places PII patterns meaningfully
  // apply, so pass them through unchanged rather than corrupting them.
  if (input instanceof Map || input instanceof Set || input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    return input;
  }

  // Error objects: `message` and `stack` are non-enumerable own
  // properties on a plain `new Error(...)`, so Object.entries() below
  // would silently skip them, letting PII embedded in an error message
  // (e.g. "login failed for jane@example.com") pass through unredacted
  // while also losing the error's identity for downstream serializers.
  // Redact message/stack explicitly and return a real Error instance
  // (not a plain object) so `instanceof Error` still holds for anything
  // downstream (e.g. Winston's own `format.errors()`).
  if (input instanceof Error) {
    const redactedError = new Error(redactString(input.message, options));
    redactedError.name = input.name;
    if (input.stack) redactedError.stack = redactString(input.stack, options);

    for (const [key, value] of Object.entries(input)) {
      (redactedError as unknown as Record<string, unknown>)[key] = isSensitiveKey(key, options.extraSensitiveKeys)
        ? redactSensitiveValue(value, key, options, depth)
        : detect(value, options, depth + 1);
    }

    return redactedError as unknown as T;
  }

  if (input && typeof input === 'object') {
    const out: Record<string | symbol, unknown> = {};

    // Preserve symbol-keyed properties untouched. Loggers (Winston in
    // particular) attach internal symbols like LEVEL/MESSAGE to the info
    // object for use later in the format pipeline; silently dropping them
    // when we rebuild the object breaks downstream formats/transports.
    for (const sym of Object.getOwnPropertySymbols(input)) {
      out[sym] = (input as Record<symbol, unknown>)[sym];
    }

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(key, options.extraSensitiveKeys)) {
        out[key] = redactSensitiveValue(value, key, options, depth);
      } else {
        out[key] = detect(value, options, depth + 1);
      }
    }
    return out as unknown as T;
  }

  return input;
}
