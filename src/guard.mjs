// Two guards for exposing the server beyond localhost: a shared password
// (HTTP basic auth) and a daily question cap. Both are pure enough to test
// without a server. Neither is a substitute for a spend limit in the
// Anthropic console — set that too.
import { timingSafeEqual } from 'node:crypto';

// Authorization: Basic base64(anything:password). Any username; the password
// must match. Constant-time compare so timing doesn't leak length or prefix.
export function checkBasicAuth(header, password) {
  if (!password) return true;                       // no password configured: open (localhost use)
  if (!header?.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const i = decoded.indexOf(':');
  const given = Buffer.from(i >= 0 ? decoded.slice(i + 1) : decoded);
  const want = Buffer.from(password);
  return given.length === want.length && timingSafeEqual(given, want);
}

// N questions per UTC day, then refuse until the date changes.
export class DailyCap {
  constructor(limit, now = () => new Date()) { this.limit = limit; this.now = now; this.day = null; this.used = 0; }
  #roll() { const d = this.now().toISOString().slice(0, 10); if (d !== this.day) { this.day = d; this.used = 0; } }
  remaining() { this.#roll(); return Math.max(0, this.limit - this.used); }
  take() { this.#roll(); if (this.used >= this.limit) return false; this.used++; return true; }
}
