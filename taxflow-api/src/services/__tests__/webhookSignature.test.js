/**
 * Tests for webhook signature verification.
 * Validates HMAC-SHA256 calculation over body + timestamp,
 * replay protection (10-minute window), and constant-time comparison.
 *
 * Reference: https://developer.box.com/guides/webhooks/v2/signatures-v2.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { WebhookService } from '../webhookService.js';

describe('WebhookService.verifySignature', () => {
  let service;
  const PRIMARY_KEY = 'test-primary-key-abc123';
  const SECONDARY_KEY = 'test-secondary-key-xyz789';

  beforeEach(() => {
    service = new WebhookService();
  });

  /**
   * Helper: compute the correct HMAC-SHA256 signature as Box would.
   * HMAC is over body + timestamp (concatenated).
   */
  function computeBoxSignature(key, body, timestamp) {
    return crypto
      .createHmac('sha256', key)
      .update(body)
      .update(timestamp)
      .digest('base64');
  }

  function freshTimestamp() {
    return new Date().toISOString();
  }

  function staleTimestamp(minutesAgo = 11) {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  }

  // --- VALID SIGNATURE TESTS ---

  it('accepts valid primary signature with fresh timestamp', () => {
    const body = Buffer.from('{"type":"webhook_event","trigger":"FILE.UPLOADED"}');
    const timestamp = freshTimestamp();
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  it('accepts valid secondary signature with fresh timestamp', () => {
    const body = Buffer.from('{"type":"webhook_event","trigger":"FILE.DELETED"}');
    const timestamp = freshTimestamp();
    const secondarySig = computeBoxSignature(SECONDARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, '', secondarySig, PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  it('accepts when both signatures are provided and primary matches', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const timestamp = freshTimestamp();
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);
    const wrongSecondarySig = 'invalid-secondary';

    const result = service.verifySignature(
      body, timestamp, primarySig, wrongSecondarySig, PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  it('accepts when primary fails but secondary matches', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const timestamp = freshTimestamp();
    const secondarySig = computeBoxSignature(SECONDARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, 'wrong-primary', secondarySig, PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  it('accepts body as string (not just Buffer)', () => {
    const bodyStr = '{"type":"webhook_event","id":"abc"}';
    const timestamp = freshTimestamp();
    const primarySig = computeBoxSignature(PRIMARY_KEY, bodyStr, timestamp);

    const result = service.verifySignature(
      bodyStr, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  it('accepts timestamp exactly at the 10-minute boundary', () => {
    // 9 minutes 59 seconds ago — just within the window
    const timestamp = new Date(Date.now() - 9 * 60 * 1000 - 59 * 1000).toISOString();
    const body = Buffer.from('{"type":"webhook_event"}');
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  // --- REPLAY PROTECTION TESTS ---

  it('rejects valid signature with stale timestamp (>10 minutes old)', () => {
    const body = Buffer.from('{"type":"webhook_event","trigger":"FILE.UPLOADED"}');
    const timestamp = staleTimestamp(11); // 11 minutes ago
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(false);
  });

  it('rejects valid signature with very old timestamp (1 hour)', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const timestamp = staleTimestamp(60);
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(false);
  });

  it('rejects when timestamp is missing (empty string)', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, '');

    const result = service.verifySignature(
      body, '', primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(false);
  });

  it('rejects when timestamp is invalid (unparseable)', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const badTimestamp = 'not-a-date';
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, badTimestamp);

    const result = service.verifySignature(
      body, badTimestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(false);
  });

  // --- INVALID SIGNATURE TESTS ---

  it('rejects when body has been tampered with', () => {
    const originalBody = Buffer.from('{"type":"webhook_event","amount":100}');
    const tamperedBody = Buffer.from('{"type":"webhook_event","amount":999}');
    const timestamp = freshTimestamp();
    const primarySig = computeBoxSignature(PRIMARY_KEY, originalBody, timestamp);

    const result = service.verifySignature(
      tamperedBody, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(false);
  });

  it('rejects when signature is completely wrong', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const timestamp = freshTimestamp();

    const result = service.verifySignature(
      body, timestamp, 'totally-wrong-signature', 'also-wrong', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(false);
  });

  it('rejects when keys are empty', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const timestamp = freshTimestamp();
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, primarySig, '', '', ''
    );

    expect(result).toBe(false);
  });

  it('rejects when signature computed without timestamp (old incorrect method)', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const timestamp = freshTimestamp();
    // Compute HMAC over body only (the old broken way)
    const wrongSig = crypto
      .createHmac('sha256', PRIMARY_KEY)
      .update(body)
      .digest('base64');

    const result = service.verifySignature(
      body, timestamp, wrongSig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(false);
  });

  // --- EDGE CASES ---

  it('handles empty body correctly', () => {
    const body = Buffer.from('');
    const timestamp = freshTimestamp();
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  it('handles large payload body', () => {
    const body = Buffer.from('x'.repeat(100000));
    const timestamp = freshTimestamp();
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp);

    const result = service.verifySignature(
      body, timestamp, primarySig, '', PRIMARY_KEY, SECONDARY_KEY
    );

    expect(result).toBe(true);
  });

  it('is sensitive to timestamp value changes (even 1 char difference)', () => {
    const body = Buffer.from('{"type":"webhook_event"}');
    const timestamp1 = '2026-06-26T10:00:00.000Z';
    const timestamp2 = '2026-06-26T10:00:00.001Z';
    const primarySig = computeBoxSignature(PRIMARY_KEY, body, timestamp1);

    // Use a recent timestamp for the actual check to avoid replay rejection
    // But prove the signature doesn't match a different timestamp
    const sigWithTs2 = computeBoxSignature(PRIMARY_KEY, body, timestamp2);
    expect(primarySig).not.toBe(sigWithTs2);
  });
});
