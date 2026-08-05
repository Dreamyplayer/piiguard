# piiguard

Zero-config PII redaction middleware for **Winston** and **Pino**.

Wraps your existing logger and auto-detects & redacts emails, credit card
numbers, SSNs, phone numbers, JWTs, and common secret fields (`password`,
`token`, `apiKey`, ...) — **before** anything hits your log transport. No
manual field lists required.

`piiguard` is not a logger. It's a thin layer that plugs into the logger
you already use.

## Why

Existing redaction tools (`fast-redact`, Pino's built-in `redact` option,
`mask-json`, etc.) all require you to manually list which keys to redact
up front. That works until someone adds a new field with an email in it
and nobody updates the list. `piiguard` detects PII by **pattern and
shape** — it doesn't need to know your field names in advance.

## Install

```bash
yarn add piiguard
```

`pino` and `winston` are optional peer dependencies — install whichever
one(s) you use.

## Quick start

### Pino

```typescript
import pino from 'pino';
import { wrap } from 'piiguard';

const logger = wrap(pino(), { adapter: 'pino' });

logger.info({ email: 'jane@example.com', password: 'hunter2' }, 'user signed up');
// -> { "email": "j***@e***.com", "password": "[REDACTED]", "msg": "user signed up" }
```

### Winston

```typescript
import winston from 'winston';
import { wrap } from 'piiguard';

const logger = winston.createLogger({
  format: winston.format.combine(
    wrap(winston, { adapter: 'winston' }), // must run before json()/etc
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

logger.info('user signed up', { email: 'jane@example.com' });
```

### Without a logger

```typescript
import { redact } from 'piiguard';

const clean = redact({ email: 'jane@example.com', ssn: '123-45-6789' });
// { email: 'j***@e***.com', ssn: '***-***-6789' }
```

## What gets detected

**By content pattern** (regex over string values):

| Pattern      | Example               | Notes                                                                    |
| ------------ | --------------------- | ------------------------------------------------------------------------ |
| `email`      | `jane@example.com`    |                                                                          |
| `creditCard` | `4111 1111 1111 1111` | Validated with a Luhn checksum to avoid flagging arbitrary digit strings |
| `ssn`        | `123-45-6789`         | US format                                                                |
| `phone`      | `(415) 555-0100`      |                                                                          |
| `jwt`        | `eyJhbGciOi...`       | Always fully redacted (see below)                                        |
| `apiKeyLike` | `sk_live_51H8x...`    | Always fully redacted                                                    |
| `ipv4`       | `192.168.1.1`         |                                                                          |

**By key name** (checked against object keys, case- and separator-insensitive
— `apiKey`, `API_KEY`, and `api-key` all match): `password`, `secret`,
`token`, `apiKey`, `authorization`, `privateKey`, `sessionId`, `ssn`,
`creditCard`, `cvv`, `pin`, and more. Full list in
[`src/patterns.ts`](./src/patterns.ts).

## Masking strategy

Default is `'partial'`: PII keeps a masked but recognizable shape for
debugging (`j***@e***.com`, `***-***-1111`). **Secrets are always fully
redacted** (`[REDACTED]`) regardless of this setting — partially revealing
a password or API key is never safe, so key-name matches and
`jwt`/`apiKeyLike` pattern matches ignore `maskStrategy` entirely.

Set `maskStrategy: 'full'` to fully redact everything instead:

```typescript
wrap(pino(), { adapter: 'pino', maskStrategy: 'full' });
```

## Options

```typescript
interface PiiGuardOptions {
  adapter: 'pino' | 'winston'; // required — no auto-detection
  maskStrategy?: 'full' | 'partial'; // default: 'partial'
  extraPatterns?: Record<string, RegExp>;
  disablePatterns?: PatternName[]; // e.g. ['ipv4'] if IPs are expected/fine
  extraSensitiveKeys?: string[]; // add your own always-redact key names
  maxDepth?: number; // default: 6
}
```

## Caveats

- **Pino `.child()`**: Pino only accepts `hooks.logMethod` at construction
  time, so `piiguard` wraps the log methods (`info`, `error`, ...) on the
  instance you pass in instead. If you call `.child()` on the _wrapped_
  logger, the child gets Pino's real methods back — call `wrap()` again on
  any child logger you create.
- **Winston format order**: the piiguard format must come _before_
  `winston.format.json()` (or any other serializing format) in
  `format.combine(...)`, since it needs to see the real object shape, not
  an already-stringified line.

## Why `adapter` is required, not auto-detected

Duck-typing a Pino vs Winston instance is fragile, and a misdetection
here means logs get written **unredacted** with no error. That's a
silent-failure mode worth avoiding, so `piiguard` asks you to say which
one you're wrapping.

## Development

```bash
yarn install
yarn build       # dual ESM/CJS build via tsup, emits dist/
yarn test        # vitest
yarn typecheck
```

## License

MIT
