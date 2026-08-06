# Changelog

## 0.1.1

Fixes found by testing the actual published tarball as a real consumer
(installing it into a separate project via `npm install`), not just
running the in-repo test suite:

- **`wrap()` types were wrong for the Winston branch, causing a real
  TS error** (`Argument of type 'typeof winston' is not assignable to
  parameter of type 'Format'` / `Property 'transform' is missing`).
  `wrap<T>()` used a single generic signature that returned the same
  type as its input — correct for Pino (wrapped logger back), wrong for
  Winston (returns a `Format` object, not the winston module). Fixed
  with proper overloads: one for `adapter: 'pino'` returning `T`, one
  for `adapter: 'winston'` returning `WinstonFormat`. Also had to relax
  the internal `PinoLike`/`WinstonLike` duck types away from
  index-signature-based types (`Record<string, unknown>`), which fail as
  *generic constraints* against real Pino/Winston class instances even
  though they succeed for plain variable assignment — a easy-to-miss TS
  quirk.
- **Error objects were silently redacted to `{}`.** `message` and `stack`
  are non-enumerable own properties on a plain `Error`, so the object
  walker skipped them entirely — PII embedded in an error message (e.g.
  `"login failed for jane@example.com"`) passed through completely
  unredacted, and the error's identity/stack was lost downstream. Fixed:
  `Error` instances are now redacted explicitly (message + stack content
  scanned, custom enumerable properties preserved/redacted) and a real
  `Error` is returned so `instanceof Error` still holds for anything
  downstream (e.g. Winston's `format.errors()`).
- **`Buffer` / `Uint8Array` were exploded into byte-indexed objects.**
  `Object.entries()` on a `Buffer` iterates every byte as an enumerable
  numeric key, turning a binary payload into a huge `{ '0': 104, '1': 101,
  ... }` object. Fixed: `Buffer`, any `TypedArray`, and `ArrayBuffer` now
  pass through unchanged.
- **`Map` / `Set` were silently turned into `{}`.** Neither has enumerable
  own string keys, so the generic object branch produced an empty object
  — silent data loss, not redaction. Fixed: both pass through unchanged.
- **`apiKeyLike` pattern didn't match realistic key shapes.** The regex
  required the random suffix to sit immediately after the prefix
  (`sk_xxxxxxxxxxxxxxxx`), so real-shaped keys like `sk_live_xxxx...`
  (with a word segment in between) never matched. Fixed: the pattern now
  allows optional `[-_]word` segments between the prefix and the
  random suffix.

## 0.1.0

Initial release.

