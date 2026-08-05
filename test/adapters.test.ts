import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import winston from 'winston';
import { wrap } from '../src/index.js';

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { stream, chunks };
}

describe('pino adapter', () => {
  it('redacts fields before the log line is written', () => {
    const { stream, chunks } = captureStream();
    const base = pino(stream);
    const logger = wrap(base, { adapter: 'pino' });

    logger.info({ email: 'jane@example.com' }, 'user signed up');

    const line = chunks.join('');
    expect(line).not.toContain('jane@example.com');
    expect(line).toContain('j***@e***.com');
  });
});

describe('winston adapter', () => {
  it('redacts fields before the log line is written', async () => {
    const { stream, chunks } = captureStream();
    const logger = winston.createLogger({
      format: winston.format.combine(
        wrap(winston, { adapter: 'winston' }),
        winston.format.json()
      ),
      transports: [new winston.transports.Stream({ stream })],
    });

    logger.info('user signed up', { email: 'jane@example.com' });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const line = chunks.join('');
    expect(line).not.toContain('jane@example.com');
    expect(line).toContain('j***@e***.com');
  });
});
