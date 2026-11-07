/**
 * RFC 8785 — JSON Canonicalization Scheme (JCS)
 * Standardizes JSON serialization so cryptographic hashes (SHA-256)
 * are completely deterministic across environments, runtimes, and databases (PostgreSQL JSONB).
 */

export function canonicalizeJson(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const elements = value.map((el) => (el === undefined ? 'null' : canonicalizeJson(el)));
    return `[${elements.join(',')}]`;
  }

  // Object: sort keys lexicographically by UTF-16 code units (RFC 8785 Section 3.2.3)
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined && typeof value[k] !== 'symbol' && typeof value[k] !== 'function')
    .sort();

  const entries = keys.map((key) => {
    const valStr = canonicalizeJson(value[key]);
    return `${JSON.stringify(key)}:${valStr}`;
  });

  return `{${entries.join(',')}}`;
}
