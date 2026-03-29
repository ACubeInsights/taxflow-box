/**
 * Webhook Raw Body Middleware — Captures raw request body as Buffer for HMAC verification.
 *
 * Express parses JSON bodies by default, but HMAC-SHA256 verification requires
 * the exact raw bytes. This middleware uses express.raw() to capture the body
 * as a Buffer on req.rawBody before JSON parsing occurs.
 *
 * Requirements: 8.2
 */

import express from 'express';

/**
 * Middleware that captures the raw request body as a Buffer and stores it on req.rawBody.
 * Uses express.raw() with application/json content type so the raw bytes are preserved
 * for HMAC signature verification, then parses the body as JSON for downstream handlers.
 */
const webhookRawBody = [
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      try {
        req.body = JSON.parse(req.rawBody.toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    } else {
      // If body was already parsed (e.g. by a global json parser), rawBody won't be available
      req.rawBody = Buffer.from(JSON.stringify(req.body), 'utf8');
    }
    next();
  },
];

export default webhookRawBody;
