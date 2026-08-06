import { detect } from '../core/detect.js';
import type { DetectOptions } from '../types.js';

/** Minimal structural types for Winston's format API — avoids a hard
 * dependency on `winston`'s types since it's an optional peer dependency.
 * `WinstonInfo` is used internally for our own implementation; the
 * externally-facing `WinstonFormatFn` is typed loosely (`any`) because
 * winston's real `TransformableInfo` type carries a symbol index
 * signature ours doesn't declare, which breaks structural assignability
 * even though the values themselves are perfectly compatible at runtime. */
export interface WinstonInfo {
  [key: string]: unknown;
  message: unknown;
  level: string;
}

interface WinstonFormatFn {
  (info: any): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Shape of the object Winston's `format(...)()` factory returns - what
 * `winston.format.combine(...)` expects each argument to be. */
export interface WinstonFormat {
  transform: WinstonFormatFn;
  options?: object;
}

interface WinstonFormatWrap {
  (fn: WinstonFormatFn): () => WinstonFormat;
}

/** Only requires `.format` since that's all `piiguardWinstonFormat` calls -
 * a minimal required surface is less likely to structurally mismatch
 * against winston's real (much larger) module type. */
export interface WinstonLike {
  format: WinstonFormatWrap;
}

/**
 * Returns a Winston format that redacts `info` (which includes `message`
 * plus any metadata fields) before it reaches any transport. Winston
 * formats run in the pipeline pre-transport, so this is the correct
 * interception point — nothing is written until every format has run.
 *
 * Usage:
 *   const logger = winston.createLogger({
 *     format: winston.format.combine(
 *       piiguardWinstonFormat(winston, options),
 *       winston.format.json()
 *     ),
 *     transports: [...]
 *   });
 */
export function piiguardWinstonFormat(winston: WinstonLike, options: DetectOptions): WinstonFormat {
  return winston.format((info: WinstonInfo) => {
    return detect(info, options);
  })();
}
