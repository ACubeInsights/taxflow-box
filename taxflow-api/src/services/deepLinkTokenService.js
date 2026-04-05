/**
 * DeepLinkTokenService — JWT token generation and verification (HMAC-SHA256).
 *
 * Extracted from notificationService to follow Single Responsibility Principle.
 * Handles signed deep-link tokens with configurable expiry for secure
 * document access links.
 *
 * Public API:
 * - generateDeepLinkToken(payload) → signed JWT string
 * - verifyDeepLinkToken(token) → decoded payload
 *
 * Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 4.5
 */

import crypto from 'crypto';
import { config } from '../config.js';
import { createHttpError } from '../utils/httpError.js';

export class DeepLinkTokenService {
  /**
   * Base64url encode a string (no padding).
   * @param {string} str
   * @returns {string}
   */
  _base64url(str) {
    return Buffer.from(str, 'utf8').toString('base64url');
  }

  /**
   * Generates a signed JWT deep-link token with configurable expiry.
   * Uses HMAC-SHA256 with DEEP_LINK_SECRET. (Reqs 27.1, 27.2, 27.3)
   *
   * @param {{ fileId?: string, clientId?: string, action?: string, documentId?: string }} payload
   * @param {{ expiryHours?: number }} [options]
   * @returns {string} Signed JWT token
   */
  generateDeepLinkToken(payload, options = {}) {
    const secret = config.deepLinkSecret || 'default-dev-secret';
    const expiryHours = options.expiryHours || config.deepLinkExpiryHours || 72;
    const exp = Math.floor(Date.now() / 1000) + expiryHours * 3600;

    // Build a minimal JWT (RFC 7519) with HMAC-SHA256 signing.
    // Structure: base64url(header) + "." + base64url(payload) + "." + base64url(signature)
    // We use HS256 (HMAC with SHA-256) because the same service both signs and
    // verifies tokens — no asymmetric key distribution is needed. The shared
    // secret (DEEP_LINK_SECRET) must be kept server-side only.
    const header = { alg: 'HS256', typ: 'JWT' };
    const body = { ...payload, exp };

    const encodedHeader = this._base64url(JSON.stringify(header));
    const encodedPayload = this._base64url(JSON.stringify(body));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // HMAC-SHA256: produces a keyed hash that proves the token was issued by
    // this service and has not been tampered with. The digest is base64url-encoded
    // (no padding) per the JWS Compact Serialization spec (RFC 7515 §3.1).
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    return `${signingInput}.${signature}`;
  }

  /**
   * Verifies and decodes a deep-link token.
   * Throws 401 if expired or invalid signature. (Reqs 27.4, 27.5)
   *
   * @param {string} token - JWT token string
   * @returns {{ fileId?: string, clientId?: string, action?: string, exp: number }}
   */
  verifyDeepLinkToken(token) {
    const secret = config.deepLinkSecret || 'default-dev-secret';
    const parts = token.split('.');

    if (parts.length !== 3) {
      throw createHttpError('Invalid deep-link token format', 401);
    }

    const [encodedHeader, encodedPayload, providedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks. A naive === comparison
    // leaks information about how many bytes match, allowing an attacker to
    // brute-force the signature one byte at a time. crypto.timingSafeEqual
    // ensures the comparison takes the same time regardless of where bytes differ.
    // We must check lengths first because timingSafeEqual throws on mismatched lengths.
    const sigBuf = Buffer.from(providedSignature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    let signatureValid = false;
    if (sigBuf.length === expBuf.length) {
      signatureValid = crypto.timingSafeEqual(sigBuf, expBuf);
    }

    if (!signatureValid) {
      throw createHttpError('Invalid deep-link token signature', 401);
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw createHttpError('Invalid deep-link token payload', 401);
    }

    // Check expiry (Req 27.3)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw createHttpError('Deep-link token has expired', 401);
    }

    return payload;
  }
}

// Singleton instance
const deepLinkTokenService = new DeepLinkTokenService();
export default deepLinkTokenService;
