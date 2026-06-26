/**
 * Webhook routes — Receives and verifies Box webhook events.
 *
 * POST /api/webhooks/box — verify HMAC signatures, process event.
 *
 * Requirements: 8.1, 8.3, 8.5
 */

import express from 'express';
import webhookRawBody from '../middleware/webhookRawBody.js';
import webhookService from '../services/webhookService.js';

const router = express.Router();

/**
 * POST /api/webhooks/box
 * Receives Box webhook payloads, verifies HMAC-SHA256 signatures,
 * and routes verified events to the appropriate handler.
 *
 * Headers: BOX-SIGNATURE-PRIMARY, BOX-SIGNATURE-SECONDARY
 * Body: Raw webhook event payload (captured by webhookRawBody middleware)
 * Response: 200 OK | 403 Forbidden
 */
router.post('/box', webhookRawBody, async (req, res) => {
  // Extract signature and timestamp headers (Req 8.1)
  const primarySignature = req.headers['box-signature-primary'] || '';
  const secondarySignature = req.headers['box-signature-secondary'] || '';
  const deliveryTimestamp = req.headers['box-delivery-timestamp'] || '';
  const rawBody = req.rawBody;

  if (!rawBody) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  if (!deliveryTimestamp) {
    return res.status(400).json({ error: 'Missing BOX-DELIVERY-TIMESTAMP header' });
  }

  // Try to verify against all stored webhook keys
  const allKeys = webhookService.getAllWebhookKeys();
  let verified = false;

  for (const keys of allKeys) {
    if (
      webhookService.verifySignature(
        rawBody,
        deliveryTimestamp,
        primarySignature,
        secondarySignature,
        keys.primaryKey,
        keys.secondaryKey
      )
    ) {
      verified = true;
      break;
    }
  }

  // Reject if no signature matches (Req 8.5)
  if (!verified) {
    console.warn('Webhook signature verification failed', {
      ip: req.ip,
      headers: {
        'box-signature-primary': primarySignature ? '[present]' : '[missing]',
        'box-signature-secondary': secondarySignature ? '[present]' : '[missing]',
        'box-delivery-timestamp': deliveryTimestamp ? '[present]' : '[missing]',
      },
    });
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }

  // Process the verified event
  try {
    await webhookService.processEvent(req.body);
  } catch (err) {
    // Log but still return 200 to prevent Box from retrying
    console.error('Webhook event processing error:', err.message);
  }

  res.status(200).json({ received: true });
});

export default router;
