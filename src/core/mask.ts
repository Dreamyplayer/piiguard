import type { PatternName } from '../types.js';

export const FULL_REDACTION = '[REDACTED]';

/** Standard Luhn checksum, used to gate creditCard regex matches so
 * arbitrary 13-19 digit runs (order numbers, phone numbers) aren't
 * flagged as card numbers. */
export function luhnCheck(digits: string): boolean {
  const clean = digits.replace(/[ -]/g, '');
  if (!/^\d{13,19}$/.test(clean)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = Number(clean[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!local || !domain) return FULL_REDACTION;
  const maskedLocal = local[0] + '***';
  const domainParts = domain.split('.');
  const domainName = domainParts[0] ?? '';
  const tld = domainParts.slice(1).join('.');
  const maskedDomain = domainName[0] ? domainName[0] + '***' : '***';
  return `${maskedLocal}@${maskedDomain}${tld ? '.' + tld : ''}`;
}

function maskLastFour(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length < 4) return FULL_REDACTION;
  const last4 = digitsOnly.slice(-4);
  return `***-***-${last4}`;
}

function maskGeneric(value: string): string {
  if (value.length <= 4) return FULL_REDACTION;
  return `${value.slice(0, 1)}***${value.slice(-1)}`;
}

/**
 * Partially mask a matched string based on which pattern matched it.
 * Secrets (jwt/apiKeyLike) ignore this entirely upstream and go straight
 * to full redaction — this function is only reached for genuine PII.
 */
export function maskByPattern(value: string, pattern: PatternName): string {
  switch (pattern) {
    case 'email':
      return maskEmail(value);
    case 'creditCard':
    case 'ssn':
    case 'phone':
      return maskLastFour(value);
    case 'ipv4':
      return maskGeneric(value);
    default:
      return FULL_REDACTION;
  }
}
