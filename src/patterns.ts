import type { PatternName } from './types.js';

/**
 * Built-in shape/pattern detectors, checked against string values.
 * Card numbers are additionally validated with a Luhn check at match time
 * (see core/detect.ts) to cut down false positives on arbitrary 13-19
 * digit sequences (order IDs, phone numbers, etc).
 */
export const PATTERNS: Record<PatternName, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  jwt: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  apiKeyLike: /\b(?:sk|pk|api|access|refresh|secret|token|key)(?:[-_][a-zA-Z]+)*[-_][A-Za-z0-9]{16,}\b/gi,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Patterns whose matches are always fully redacted (never partially masked)
 * because the match itself is a live credential, not identity data.
 */
export const SECRET_PATTERNS: ReadonlySet<PatternName> = new Set(['jwt', 'apiKeyLike']);

/**
 * Object key names (normalized: lowercased, separators stripped) that mark
 * a field as a live credential/secret. Matching keys are ALWAYS fully
 * redacted regardless of value shape or maskStrategy — this catches
 * hashed passwords, opaque session ids, etc. that wouldn't match any
 * content pattern, and partial masking of a credential is never safe.
 */
export const SECRET_KEY_NAMES: readonly string[] = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'secrets',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'authorization',
  'auth',
  'privatekey',
  'clientsecret',
  'sessionid',
  'cvv',
  'cvc',
  'pin',
];

/**
 * Object key names that identify a PII field by name (as opposed to
 * relying on the value matching a content pattern). Unlike
 * {@link SECRET_KEY_NAMES}, these still respect `maskStrategy` — e.g. a
 * field literally named `ssn` gets the same partial mask as an SSN found
 * inside free text, not an unconditional full redaction.
 */
export const PII_KEY_NAMES: Record<string, PatternName> = {
  ssn: 'ssn',
  creditcard: 'creditCard',
  cardnumber: 'creditCard',
  phone: 'phone',
  phonenumber: 'phone',
  email: 'email',
};

/** Combined list, used only for documentation/back-compat exports. */
export const SENSITIVE_KEY_NAMES: readonly string[] = [...SECRET_KEY_NAMES, ...Object.keys(PII_KEY_NAMES)];
