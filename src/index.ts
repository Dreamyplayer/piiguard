import { wrapPino } from './adapters/pino.js';
import { piiguardWinstonFormat } from './adapters/winston.js';
import { detect } from './core/detect.js';
import type { DetectOptions, PiiGuardOptions } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

export { detect } from './core/detect.js';
export { PATTERNS, SENSITIVE_KEY_NAMES } from './patterns.js';
export type { DetectOptions, MaskStrategy, PatternName, PiiGuardOptions } from './types.js';

function normalizeOptions(options: PiiGuardOptions): DetectOptions {
  return {
    maskStrategy: options.maskStrategy ?? DEFAULT_OPTIONS.maskStrategy,
    extraPatterns: options.extraPatterns ?? DEFAULT_OPTIONS.extraPatterns,
    disablePatterns: options.disablePatterns ?? DEFAULT_OPTIONS.disablePatterns,
    extraSensitiveKeys: options.extraSensitiveKeys ?? DEFAULT_OPTIONS.extraSensitiveKeys,
    maxDepth: options.maxDepth ?? DEFAULT_OPTIONS.maxDepth,
  };
}

/**
 * Wrap a Winston or Pino logger so every log call is auto-redacted for PII
 * and secrets before it's written. `adapter` is required (not
 * auto-detected) — mis-identifying the logger type is a silent-failure
 * risk that could let PII through uncaught.
 *
 * @example
 * // Pino
 * import pino from 'pino';
 * import { wrap } from 'piiguard';
 * const logger = wrap(pino(), { adapter: 'pino' });
 * logger.info({ email: 'jane@example.com' }, 'user signed up');
 *
 * @example
 * // Winston — wrap() returns a format to plug into your pipeline,
 * // since Winston logger instances aren't re-wrappable the way Pino's are.
 * import winston from 'winston';
 * import { wrap } from 'piiguard';
 * const logger = winston.createLogger({
 *   format: winston.format.combine(
 *     wrap(winston, { adapter: 'winston' }),
 *     winston.format.json()
 *   ),
 *   transports: [new winston.transports.Console()],
 * });
 */
export function wrap<T>(loggerOrWinston: T, options: PiiGuardOptions): T {
  const detectOptions = normalizeOptions(options);

  if (options.adapter === 'pino') {
    return wrapPino(loggerOrWinston as never, detectOptions) as T;
  }

  if (options.adapter === 'winston') {
    return piiguardWinstonFormat(loggerOrWinston as never, detectOptions) as T;
  }

  throw new Error(
    `piiguard: unknown adapter "${String((options as PiiGuardOptions).adapter)}". Expected "pino" or "winston".`,
  );
}

/**
 * Redact PII/secrets from an arbitrary value directly, without going
 * through a logger. Useful for redacting objects before sending them
 * anywhere else (error trackers, analytics, etc).
 */
export function redact<T>(value: T, options: Partial<PiiGuardOptions> = {}): T {
  const detectOptions = normalizeOptions({ adapter: 'pino', ...options });
  return detect(value, detectOptions);
}
