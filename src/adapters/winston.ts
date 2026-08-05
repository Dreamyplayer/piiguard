import { detect } from '../core/detect.js';
import type { DetectOptions } from '../types.js';

/** Minimal structural types for Winston's format API — avoids a hard
 * dependency on `winston`'s types since it's an optional peer dependency. */
interface WinstonInfo {
  [key: string]: unknown;
  message: unknown;
  level: string;
}

interface WinstonFormatFn {
  (info: WinstonInfo): WinstonInfo | false;
}

interface WinstonFormatWrap {
  (fn: WinstonFormatFn): () => { transform: WinstonFormatFn };
}

interface WinstonLike {
  format: WinstonFormatWrap;
  configure(options: Record<string, unknown>): void;
  format2?: never;
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
export function piiguardWinstonFormat(winston: WinstonLike, options: DetectOptions) {
  return winston.format((info: WinstonInfo) => {
    return detect(info, options);
  })();
}
