import { describe, expect, it } from 'vitest';
import { redact } from '../src/index.js';

describe('email redaction', () => {
  it('partially masks emails by default', () => {
    const result = redact({ email: 'jane.doe@example.com' });
    expect(result.email).toBe('j***@e***.com');
  });

  it('fully redacts when maskStrategy is "full"', () => {
    const result = redact({ email: 'jane.doe@example.com' }, { maskStrategy: 'full' });
    expect(result.email).toBe('[REDACTED]');
  });

  it('redacts emails embedded in free text', () => {
    const result = redact({ message: 'login failed for jane@example.com' });
    expect(result.message).not.toContain('jane@example.com');
    expect(result.message).toContain('j***@e***.com');
  });
});

describe('credit card redaction', () => {
  it('redacts a valid (Luhn-passing) card number', () => {
    const result = redact({ card: '4111 1111 1111 1111' }); // test Visa number, passes Luhn
    expect(result.card).toBe('***-***-1111');
  });

  it('does NOT flag an arbitrary 16-digit number that fails Luhn', () => {
    const result = redact({ orderId: '1234567890123456' });
    expect(result.orderId).toBe('1234567890123456');
  });
});

describe('SSN redaction', () => {
  it('redacts SSN-shaped strings', () => {
    const result = redact({ ssn: '123-45-6789' });
    expect(result.ssn).toBe('***-***-6789');
  });
});

describe('key-name based secret redaction', () => {
  it('fully redacts password field regardless of content', () => {
    const result = redact({ password: 'hunter2' });
    expect(result.password).toBe('[REDACTED]');
  });

  it('fully redacts apiKey field', () => {
    const result = redact({ apiKey: 'not-a-standard-shape-at-all' });
    expect(result.apiKey).toBe('[REDACTED]');
  });

  it('matches key names case-insensitively and across separators', () => {
    const result = redact({ API_KEY: 'abc', Api_Key: 'def' });
    expect(result.API_KEY).toBe('[REDACTED]');
    expect(result.Api_Key).toBe('[REDACTED]');
  });

  it('extraSensitiveKeys extends the default list', () => {
    const result = redact({ internalUserId: '9001' }, { extraSensitiveKeys: ['internalUserId'] });
    expect(result.internalUserId).toBe('[REDACTED]');
  });
});

describe('secret patterns (jwt, apiKeyLike)', () => {
  it('always fully redacts JWTs even with maskStrategy "partial"', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = redact({ token: `Bearer ${jwt}` });
    expect(result.token).not.toContain(jwt);
  });
});

describe('nested structures', () => {
  it('walks nested objects and arrays', () => {
    const result = redact({
      user: { email: 'a@b.com', profile: { phone: '415-555-0100' } },
      logs: [{ password: 'x' }, { note: 'clean' }],
    });
    expect(result.user.email).toContain('***');
    expect(result.user.profile.phone).toContain('***');
    expect(result.logs[0]?.password).toBe('[REDACTED]');
    expect(result.logs[1]?.note).toBe('clean');
  });

  it('respects maxDepth', () => {
    const deep = { a: { b: { c: { d: { e: { f: { email: 'x@y.com' } } } } } } };
    const result = redact(deep, { maxDepth: 2 });
    // beyond depth 2 the original (unredacted) subtree is returned as-is
    expect(result.a.b.c.d.e.f.email).toBe('x@y.com');
  });

  it('leaves non-sensitive fields untouched', () => {
    const result = redact({ status: 'ok', count: 42 });
    expect(result).toEqual({ status: 'ok', count: 42 });
  });
});

describe('disablePatterns', () => {
  it('skips a disabled pattern', () => {
    const result = redact({ ip: '192.168.1.1' }, { disablePatterns: ['ipv4'] });
    expect(result.ip).toBe('192.168.1.1');
  });
});

describe('Error objects', () => {
  it('redacts PII embedded in the error message', () => {
    const err = new Error('login failed for jane@example.com');
    const result = redact({ err });
    expect(result.err).toBeInstanceOf(Error);
    expect(result.err.message).not.toContain('jane@example.com');
    expect(result.err.message).toContain('j***@e***.com');
  });

  it('redacts PII embedded in the stack trace', () => {
    const err = new Error('token sk_live_abcdef1234567890 rejected');
    const result = redact({ err });
    expect(result.err.stack).not.toContain('sk_live_abcdef1234567890');
  });

  it('preserves the error name and custom enumerable properties', () => {
    class ApiError extends Error {
      statusCode: number;
      constructor(message: string, statusCode: number) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
      }
    }
    const err = new ApiError('not found', 404);
    const result = redact({ err });
    expect(result.err.name).toBe('ApiError');
    expect((result.err as unknown as { statusCode: number }).statusCode).toBe(404);
  });

  it('fully redacts a custom property whose key name is a secret', () => {
    class AuthError extends Error {
      token: string;
      constructor(message: string, token: string) {
        super(message);
        this.token = token;
      }
    }
    const err = new AuthError('unauthorized', 'raw-secret-value');
    const result = redact({ err });
    expect((result.err as unknown as { token: string }).token).toBe('[REDACTED]');
  });
});

describe('binary and collection types', () => {
  it('passes Buffer through unchanged rather than exploding it into byte keys', () => {
    const buf = Buffer.from('hello world');
    const result = redact({ payload: buf });
    expect(Buffer.isBuffer(result.payload)).toBe(true);
    expect(result.payload.toString()).toBe('hello world');
  });

  it('passes Uint8Array through unchanged', () => {
    const arr = new Uint8Array([1, 2, 3]);
    const result = redact({ data: arr });
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.data as Uint8Array)).toEqual([1, 2, 3]);
  });

  it('passes Map and Set through unchanged instead of turning them into {}', () => {
    const m = new Map([['a', 1]]);
    const s = new Set([1, 2]);
    const result = redact({ m, s });
    expect(result.m).toBeInstanceOf(Map);
    expect(result.m.get('a')).toBe(1);
    expect(result.s).toBeInstanceOf(Set);
    expect(result.s.has(2)).toBe(true);
  });
});
