/**
 * WebhookService — Registers, verifies, and routes Box webhook events.
 *
 * - registerWebhook: POST /webhooks on a folder with FILE.UPLOADED, FILE.DELETED, FILE.MOVED triggers
 * - verifySignature: HMAC-SHA256 with constant-time comparison (primary then secondary)
 * - processEvent: Routes verified events to appropriate handlers
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import crypto from 'crypto';
import boxService from './boxService.js';
import { config } from '../config.js';
import rateLimiter from './rateLimiter.js';

const DEFAULT_TRIGGERS = ['FILE.UPLOADED', 'FILE.DELETED', 'FILE.MOVED'];

export class WebhookService {
  constructor() {
    /** @type {Map<string, { webhookId: string, primaryKey: string, secondaryKey: string }>} */
    this._webhookStore = new Map();

    /** @type {Map<string, (event: object) => Promise<void>>} */
    this._eventHandlers = new Map();
  }

  /**
   * Registers a webhook on a folder for file events.
   * Handles 409 conflict by treating it as success.
   *
   * @param {string} folderId - Box folder ID to watch
   * @param {string[]} [triggers] - Event triggers (defaults to FILE.UPLOADED, FILE.DELETED, FILE.MOVED)
   * @returns {Promise<{ webhookId: string, primaryKey: string, secondaryKey: string, address: string, triggers: string[] }>}
   */
  async registerWebhook(folderId, triggers = DEFAULT_TRIGGERS) {
    const client = boxService.getBoxClient();
    const address = config.webhookEndpointUrl;

    try {
      const webhook = await client.webhooks.createWebhook({
        target: { id: folderId, type: 'folder' },
        triggers,
        address,
      });

      const registration = {
        webhookId: webhook.id,
        primaryKey: webhook.primary_signature_key || '',
        secondaryKey: webhook.secondary_signature_key || '',
        address,
        triggers,
      };

      // Store keys for signature verification (Req 7.2)
      this._webhookStore.set(folderId, {
        webhookId: registration.webhookId,
        primaryKey: registration.primaryKey,
        secondaryKey: registration.secondaryKey,
      });

      return registration;
    } catch (error) {
      // Handle 409 conflict — webhook already exists (Req 7.4)
      if (error.statusCode === 409 || error.status === 409) {
        const existing = await this._getExistingWebhook(folderId);
        if (existing) {
          return existing;
        }
      }

      // Non-409 error — permanent client errors throw immediately,
      // transient server errors get one retry via rateLimiter (Req 7.5)
      const statusCode = error.statusCode || error.status;
      console.error(`Webhook registration failed for folder ${folderId}: ${statusCode || 'unknown'} — ${error.message}`);

      // Only retry on 5xx server errors or 429 rate limits
      if (statusCode >= 500 || statusCode === 429) {
        try {
          return await rateLimiter.enqueue(
            () => this._registerWebhookOnce(folderId, triggers),
            'normal'
          );
        } catch (retryErr) {
          console.error('Webhook retry also failed:', retryErr.message);
        }
      }

      throw error;
    }
  }

  /**
   * Single-attempt webhook registration (no retry). Used by the retry path.
   * @private
   */
  async _registerWebhookOnce(folderId, triggers = DEFAULT_TRIGGERS) {
    const client = boxService.getBoxClient();
    const address = config.webhookEndpointUrl;
    const webhook = await client.webhooks.createWebhook({
      target: { id: folderId, type: 'folder' },
      triggers,
      address,
    });
    const registration = {
      webhookId: webhook.id,
      primaryKey: webhook.primary_signature_key || '',
      secondaryKey: webhook.secondary_signature_key || '',
      address,
      triggers,
    };
    this._webhookStore.set(folderId, {
      webhookId: registration.webhookId,
      primaryKey: registration.primaryKey,
      secondaryKey: registration.secondaryKey,
    });
    return registration;
  }

  /**
   * Retrieves an existing webhook for a folder.
   * @param {string} folderId
   * @returns {Promise<{ webhookId: string, primaryKey: string, secondaryKey: string, address: string, triggers: string[] } | null>}
   */
  async _getExistingWebhook(folderId) {
    try {
      const client = boxService.getBoxClient();
      const webhooks = await client.webhooks.getWebhooks();
      const entries = webhooks.entries || [];

      const match = entries.find(
        (wh) => wh.target?.id === folderId && wh.target?.type === 'folder'
      );

      if (match) {
        const registration = {
          webhookId: match.id,
          primaryKey: match.primary_signature_key || '',
          secondaryKey: match.secondary_signature_key || '',
          address: match.address || '',
          triggers: match.triggers || [],
        };

        this._webhookStore.set(folderId, {
          webhookId: registration.webhookId,
          primaryKey: registration.primaryKey,
          secondaryKey: registration.secondaryKey,
        });

        return registration;
      }
    } catch (err) {
      console.error('Failed to retrieve existing webhook:', err.message);
    }
    return null;
  }

  /**
   * Verifies webhook payload using HMAC-SHA256 with constant-time comparison.
   * Checks primary key first, falls back to secondary. (Reqs 8.2, 8.3, 8.4, 8.6)
   *
   * @param {Buffer} body - Raw request body
   * @param {string} primarySignature - BOX-SIGNATURE-PRIMARY header value
   * @param {string} secondarySignature - BOX-SIGNATURE-SECONDARY header value
   * @param {string} primaryKey - Stored primary signature key
   * @param {string} secondaryKey - Stored secondary signature key
   * @returns {boolean} true if signature is valid
   */
  verifySignature(body, primarySignature, secondarySignature, primaryKey, secondaryKey) {
    // Check primary key first (Req 8.3)
    if (primaryKey && primarySignature) {
      const computedPrimary = crypto
        .createHmac('sha256', primaryKey)
        .update(body)
        .digest('base64');

      if (this._timingSafeCompare(computedPrimary, primarySignature)) {
        return true;
      }
    }

    // Fall back to secondary key (Req 8.4)
    if (secondaryKey && secondarySignature) {
      const computedSecondary = crypto
        .createHmac('sha256', secondaryKey)
        .update(body)
        .digest('base64');

      if (this._timingSafeCompare(computedSecondary, secondarySignature)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Constant-time string comparison to prevent timing attacks. (Req 8.6)
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  _timingSafeCompare(a, b) {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    if (bufA.length !== bufB.length) {
      // Still do a comparison to avoid leaking length info via timing
      const dummy = Buffer.alloc(bufA.length);
      crypto.timingSafeEqual(bufA, dummy);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Registers an event handler for a specific event type.
   * @param {string} eventType - e.g. 'FILE.UPLOADED', 'SIGN_REQUEST.COMPLETED'
   * @param {(event: object) => Promise<void>} handler
   */
  registerHandler(eventType, handler) {
    this._eventHandlers.set(eventType, handler);
  }

  /**
   * Routes verified webhook events to appropriate handlers.
   * FILE.UPLOADED → postUploadPipeline
   * SIGN_REQUEST.* → signService (when available)
   *
   * @param {object} event - Parsed webhook event payload
   */
  async processEvent(event) {
    const eventType = event.trigger || event.type;

    if (!eventType) {
      console.warn('Webhook event missing trigger/type field:', JSON.stringify(event));
      return;
    }

    // Check for exact match first
    const handler = this._eventHandlers.get(eventType);
    if (handler) {
      await handler(event);
      return;
    }

    // Check for wildcard prefix match (e.g. SIGN_REQUEST.* matches SIGN_REQUEST.COMPLETED)
    for (const [pattern, wildcardHandler] of this._eventHandlers) {
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        if (eventType.startsWith(prefix)) {
          await wildcardHandler(event);
          return;
        }
      }
    }

    console.log(`No handler registered for event type: ${eventType}`);
  }

  /**
   * Retrieves stored webhook keys for a folder.
   * @param {string} folderId
   * @returns {{ webhookId: string, primaryKey: string, secondaryKey: string } | undefined}
   */
  getWebhookKeys(folderId) {
    return this._webhookStore.get(folderId);
  }

  /**
   * Retrieves all stored webhook keys (for signature verification when folder ID is unknown).
   * @returns {Array<{ folderId: string, webhookId: string, primaryKey: string, secondaryKey: string }>}
   */
  getAllWebhookKeys() {
    const keys = [];
    for (const [folderId, data] of this._webhookStore) {
      keys.push({ folderId, ...data });
    }
    return keys;
  }

  /**
   * Stores webhook keys directly (e.g. loaded from config or onboarding result).
   * @param {string} folderId
   * @param {{ webhookId: string, primaryKey: string, secondaryKey: string }} keys
   */
  storeWebhookKeys(folderId, keys) {
    this._webhookStore.set(folderId, keys);
  }
}

// Singleton instance
const webhookService = new WebhookService();
export default webhookService;
