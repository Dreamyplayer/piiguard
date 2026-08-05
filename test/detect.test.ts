import { describe, it, expect } from 'vitest';
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
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
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
    expect(result.logs[0].password).toBe('[REDACTED]');
    expect(result.logs[1].note).toBe('clean');
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
