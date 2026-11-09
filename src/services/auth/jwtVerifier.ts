import * as crypto from 'node:crypto';

export interface AuthJwtClaims {
  sub: string;       // userId
  tenantId: string;  // tenantId
  email?: string;
  role?: string;
  exp: number;       // epoch seconds
  iat: number;       // epoch seconds
}

/**
 * Resolves the JWT signing and verification secret.
 * In production (NODE_ENV === 'production'), process.env.JWT_SECRET is strictly mandatory.
 * The system refuses to boot or operate with hardcoded fallbacks in production.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL SECURITY MISCONFIGURATION: process.env.JWT_SECRET is strictly required in production mode. Refusing to operate with insecure fallback.'
      );
    }
    return 'aether_secure_jwt_secret_cop31_residential_saas_2026';
  }
  if (secret.length < 32) {
    throw new Error('SECURITY ERROR: JWT_SECRET must be at least 32 characters long for cryptographic security.');
  }
  return secret;
}

export const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'aether_secure_jwt_secret_cop31_residential_saas_2026');

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a cryptographic HMAC-SHA256 JWT token for authentication
 */
export function signJwtToken(
  claims: { sub: string; tenantId: string; email?: string; role?: string; expiresInSeconds?: number },
  secret?: string
): string {
  const signingSecret = secret || getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (claims.expiresInSeconds || 3600); // 1 hour default

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: AuthJwtClaims = {
    sub: claims.sub,
    tenantId: claims.tenantId,
    email: claims.email,
    role: claims.role || 'RESIDENT_VIEWER',
    iat: now,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', signingSecret).update(message).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * Cryptographically verifies an incoming JWT token with constant-time equality check,
 * algorithm pinning (HS256), and expiration enforcement.
 */
export function verifyJwtToken(
  token: string,
  secret?: string
): { valid: boolean; claims?: AuthJwtClaims; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or empty' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid JWT format: expected 3 dot-separated segments' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // 1. Validate Header & Algorithm Pinning
  try {
    const headerJson = base64UrlDecode(encodedHeader);
    const header = JSON.parse(headerJson);
    if (header.alg !== 'HS256') {
      return { valid: false, error: `Insecure or unsupported JWT algorithm: expected 'HS256', got '${header.alg}'` };
    }
    if (header.typ !== 'JWT') {
      return { valid: false, error: `Invalid JWT type: expected 'JWT', got '${header.typ}'` };
    }
  } catch (err: any) {
    return { valid: false, error: `Malformed header JSON: ${err.message}` };
  }

  // 2. Resolve verification secret safely
  let verificationSecret: string;
  try {
    verificationSecret = secret || getJwtSecret();
  } catch (err: any) {
    return { valid: false, error: err.message };
  }

  // 3. Verify Signature
  const message = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto.createHmac('sha256', verificationSecret).update(message).digest();
  const expectedEncoded = base64UrlEncode(expectedSignature);

  if (encodedSignature.length !== expectedEncoded.length) {
    return { valid: false, error: 'Signature length mismatch or forgery detected' };
  }

  const sigValid = crypto.timingSafeEqual(
    Buffer.from(encodedSignature, 'utf8'),
    Buffer.from(expectedEncoded, 'utf8')
  );

  if (!sigValid) {
    return { valid: false, error: 'Cryptographic signature verification failed: token has been tampered with' };
  }

  // 4. Parse & Validate Payload
  try {
    const payloadJson = base64UrlDecode(encodedPayload);
    const claims = JSON.parse(payloadJson) as AuthJwtClaims;

    if (!claims.sub || !claims.tenantId) {
      return { valid: false, error: 'Missing mandatory claims: sub (userId) and tenantId are required' };
    }

    // 5. Expiration Check
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      return { valid: false, error: `Token has expired at timestamp ${claims.exp} (current time: ${now})` };
    }

    return { valid: true, claims };
  } catch (err: any) {
    return { valid: false, error: `Malformed payload JSON: ${err.message}` };
  }
}
