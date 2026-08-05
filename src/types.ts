/** Names of the built-in pattern detectors. Used to disable individual ones. */
export type PatternName = 'email' | 'creditCard' | 'ssn' | 'phone' | 'jwt' | 'apiKeyLike' | 'ipv4';

/**
 * How a detected value gets replaced in the output.
 * - 'full'    -> always '[REDACTED]', no matter the field.
 * - 'partial' -> PII values (email/phone/card/ssn) keep a masked shape
 *                (e.g. j***@e***.com) for debuggability; secrets
 *                (password/token/apiKey/etc, and jwt/apiKeyLike matches)
 *                are ALWAYS fully redacted regardless of this setting,
 *                because partially revealing a credential is unsafe.
 */
export type MaskStrategy = 'full' | 'partial';

export interface PiiGuardOptions {
  /** Which logger adapter to use. Required by `wrap()` — no duck-typing,
   * to avoid silently mis-detecting and leaking PII. */
  adapter: 'pino' | 'winston';
  /** 'partial' (default) or 'full'. See {@link MaskStrategy}. */
  maskStrategy?: MaskStrategy;
  /** Extra regex patterns to check against string values, merged with the
   * built-in set. Keys are your own names, used only in error messages. */
  extraPatterns?: Record<string, RegExp>;
  /** Disable specific built-in pattern detectors by name. */
  disablePatterns?: PatternName[];
  /** Extra object key names (case-insensitive) that should always be
   * treated as secrets and fully redacted, merged with the built-in list. */
  extraSensitiveKeys?: string[];
  /** Max object/array recursion depth before piiguard stops walking and
   * returns the remaining value as-is. Guards against pathological input
   * and circular-reference perf cliffs. Default: 6. */
  maxDepth?: number;
}

export interface DetectOptions {
  maskStrategy: MaskStrategy;
  extraPatterns: Record<string, RegExp>;
  disablePatterns: PatternName[];
  extraSensitiveKeys: string[];
  maxDepth: number;
}

export const DEFAULT_OPTIONS: Omit<DetectOptions, 'extraPatterns'> & {
  extraPatterns: Record<string, RegExp>;
} = {
  maskStrategy: 'partial',
  extraPatterns: {},
  disablePatterns: [],
  extraSensitiveKeys: [],
  maxDepth: 6,
};
