import { detect } from '../core/detect.js';
import type { DetectOptions } from '../types.js';

const LOG_METHODS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

/** Minimal structural type for a Pino instance — avoids a hard dependency
 * on the `pino` package's types so this file compiles even if the caller
 * doesn't have pino installed (it's an optional peer dependency). */
type PinoLike = Record<string, unknown>;

/**
 * Wraps a Pino logger's log methods (`info`, `error`, etc.) so every call
 * is redacted before it reaches Pino's own serialization step.
 *
 * Note: Pino's native `hooks.logMethod` option can only be set at logger
 * *construction* time (`pino({ hooks: {...} })`) — it isn't accepted by
 * `.child()`, so it can't be added retroactively to an existing instance.
 * Wrapping the methods directly works regardless of how the logger was
 * built, at the cost of one extra function call per log line.
 *
 * Caveat: if you call `.child()` on the *returned* wrapped logger, the
 * child inherits Pino's real methods, not the wrapped ones — call `wrap()`
 * again on any child logger you create.
 */
export function wrapPino<T extends PinoLike>(logger: T, options: DetectOptions): T {
  const wrapped = Object.create(logger) as PinoLike;

  for (const method of LOG_METHODS) {
    const original = logger[method];
    if (typeof original !== 'function') continue;

    wrapped[method] = (...args: unknown[]) => {
      const redactedArgs = args.map((arg) => detect(arg, options));
      return (original as (...a: unknown[]) => unknown).apply(logger, redactedArgs);
    };
  }

  return wrapped as T;
}
