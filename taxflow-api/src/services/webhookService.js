/**
 * WebhookService — Registers, verifies, and routes Box webhook events.
 *
 * Supports two modes:
 *   1. DB-backed: Uses WebhookKeyRepository for persistence, in-memory Map as cache
 *   2. In-memory only: Uses Map (for tests or when DB is not initialized)
 *
 * Requirements: 13.2, 13.3, 16.7, 7.1-7.5, 8.1-8.6
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

    /** @type {import('../db/repositories/WebhookKeyRepository.js').WebhookKeyRepository | null} */
    this._webhookKeyRepo = null;
  }

  /**
   * Injects repository dependencies. Called after DB initialization.
   * @param {{ webhookKeyRepo?: object }} repos
   */
  setRepositories({ webhookKeyRepo } = {}) {
    if (webhookKeyRepo) this._webhookKeyRepo = webhookKeyRepo;
  }

  /**
   * Loads all webhook keys from DB into the in-memory cache.
   * Called during server startup after DB initialization.
   */
  async loadFromDb() {
    if (!this._webhookKeyRepo) return;

    const rows = await this._webhookKeyRepo.findAll();
    for (const row of rows) {
      this._webhookStore.set(row.folder_id, {
        webhookId: row.webhook_id,
        primaryKey: row.primary_key,
        secondaryKey: row.secondary_key,
      });
    }
  }

  /**
   * Registers a webhook on a folder for file events.
   * Handles 409 conflict by treating it as success.
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

      // Store keys in cache and DB
      this._webhookStore.set(folderId, {
        webhookId: registration.webhookId,
        primaryKey: registration.primaryKey,
        secondaryKey: registration.secondaryKey,
      });

      if (this._webhookKeyRepo) {
        await this._webhookKeyRepo.upsert(folderId, {
          webhookId: registration.webhookId,
          primaryKey: registration.primaryKey,
          secondaryKey: registration.secondaryKey,
        }).catch((err) => {
          console.error(`Failed to persist webhook keys for folder ${folderId}:`, err.message);
        });
      }

      return registration;
    } catch (error) {
      if (error.statusCode === 409 || error.status === 409) {
        const existing = await this._getExistingWebhook(folderId);
        if (existing) {
          return existing;
        }
      }

      const statusCode = error.statusCode || error.status;
      console.error(`Webhook registration failed for folder ${folderId}: ${statusCode || 'unknown'} — ${error.message}`);

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

  /** @private */
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

    if (this._webhookKeyRepo) {
      await this._webhookKeyRepo.upsert(folderId, {
        webhookId: registration.webhookId,
        primaryKey: registration.primaryKey,
        secondaryKey: registration.secondaryKey,
      }).catch((err) => {
        console.error(`Failed to persist webhook keys for folder ${folderId}:`, err.message);
      });
    }

    return registration;
  }

  /** @private */
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

        if (this._webhookKeyRepo) {
          await this._webhookKeyRepo.upsert(folderId, {
            webhookId: registration.webhookId,
            primaryKey: registration.primaryKey,
            secondaryKey: registration.secondaryKey,
          }).catch((err) => {
            console.error(`Failed to persist webhook keys for folder ${folderId}:`, err.message);
          });
        }

        return registration;
      }
    } catch (err) {
      console.error('Failed to retrieve existing webhook:', err.message);
    }
    return null;
  }

  /**
   * Maximum age (in milliseconds) for a webhook delivery timestamp.
   * Payloads older than this are rejected to prevent replay attacks.
   * Per Box documentation: 10 minutes.
   */
  static MAX_TIMESTAMP_AGE_MS = 10 * 60 * 1000;

  /**
   * Verifies webhook payload using HMAC-SHA256 with constant-time comparison.
   * Per Box documentation, the HMAC is computed over body + timestamp bytes.
   * Additionally validates that the delivery timestamp is not stale (replay protection).
   *
   * @param {Buffer|string} body - Raw request body bytes
   * @param {string} timestamp - Value of BOX-DELIVERY-TIMESTAMP header (RFC-3339)
   * @param {string} primarySignature - Value of BOX-SIGNATURE-PRIMARY header
   * @param {string} secondarySignature - Value of BOX-SIGNATURE-SECONDARY header
   * @param {string} primaryKey - Stored primary signature key
   * @param {string} secondaryKey - Stored secondary signature key
   * @returns {boolean} True if signature is valid and timestamp is fresh
   */
  verifySignature(body, timestamp, primarySignature, secondarySignature, primaryKey, secondaryKey) {
    // Step 1: Replay protection — reject stale timestamps
    if (!timestamp) {
      return false;
    }

    const deliveryTime = Date.parse(timestamp);
    if (isNaN(deliveryTime)) {
      return false;
    }

    if (Date.now() - deliveryTime > WebhookService.MAX_TIMESTAMP_AGE_MS) {
      return false;
    }

    // Step 2: Compute HMAC-SHA256 over body + timestamp (per Box docs)
    // Reference: https://developer.box.com/guides/webhooks/v2/signatures-v2.md
    if (primaryKey && primarySignature) {
      const computedPrimary = crypto
        .createHmac('sha256', primaryKey)
        .update(body)
        .update(timestamp)
        .digest('base64');

      if (this._timingSafeCompare(computedPrimary, primarySignature)) {
        return true;
      }
    }

    if (secondaryKey && secondarySignature) {
      const computedSecondary = crypto
        .createHmac('sha256', secondaryKey)
        .update(body)
        .update(timestamp)
        .digest('base64');

      if (this._timingSafeCompare(computedSecondary, secondarySignature)) {
        return true;
      }
    }

    return false;
  }

  /** @private */
  _timingSafeCompare(a, b) {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    if (bufA.length !== bufB.length) {
      const dummy = Buffer.alloc(bufA.length);
      crypto.timingSafeEqual(bufA, dummy);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Registers an event handler for a specific event type.
   */
  registerHandler(eventType, handler) {
    this._eventHandlers.set(eventType, handler);
  }

  /**
   * Routes verified webhook events to appropriate handlers.
   */
  async processEvent(event) {
    const eventType = event.trigger || event.type;

    if (!eventType) {
      console.warn('Webhook event missing trigger/type field:', JSON.stringify(event));
      return;
    }

    const handler = this._eventHandlers.get(eventType);
    if (handler) {
      await handler(event);
      return;
    }

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
   */
  getWebhookKeys(folderId) {
    return this._webhookStore.get(folderId);
  }

  /**
   * Retrieves all stored webhook keys.
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
   */
  async storeWebhookKeys(folderId, keys) {
    this._webhookStore.set(folderId, keys);

    if (this._webhookKeyRepo) {
      await this._webhookKeyRepo.upsert(folderId, {
        webhookId: keys.webhookId,
        primaryKey: keys.primaryKey,
        secondaryKey: keys.secondaryKey,
      }).catch((err) => {
        console.error(`Failed to persist webhook keys for folder ${folderId}:`, err.message);
      });
    }
  }

  /**
   * Verifies all registered webhooks still exist in Box.
   * Detects missing webhooks (deleted by Box due to inactivity or admin action)
   * and optionally re-registers them.
   *
   * @param {{ reregister?: boolean }} [options] - Whether to re-register missing webhooks
   * @returns {Promise<{ total: number, healthy: number, missing: number, reregistered: number, errors: Array<{ folderId: string, error: string }> }>}
   */
  async verifyWebhooksHealthy({ reregister = true } = {}) {
    const result = { total: 0, healthy: 0, missing: 0, reregistered: 0, errors: [] };

    // Get all locally registered webhook folder IDs
    const localFolderIds = Array.from(this._webhookStore.keys());
    result.total = localFolderIds.length;

    if (localFolderIds.length === 0) {
      return result;
    }

    // Fetch all webhooks from Box
    let boxWebhooks = [];
    try {
      const client = this._getBoxClient ? this._getBoxClient() : boxService.getBoxClient();
      const response = await client.webhooks.getWebhooks();
      boxWebhooks = response.entries || [];
    } catch (err) {
      console.error('[WebhookHealth] Failed to list webhooks from Box:', err.message);
      result.errors.push({ folderId: '*', error: `List webhooks failed: ${err.message}` });
      return result;
    }

    // Build set of Box-side webhook target folder IDs
    const boxFolderIds = new Set(
      boxWebhooks
        .filter((wh) => wh.target?.type === 'folder')
        .map((wh) => wh.target.id)
    );

    // Check each local registration against Box
    for (const folderId of localFolderIds) {
      if (boxFolderIds.has(folderId)) {
        result.healthy++;
      } else {
        result.missing++;
        console.warn(`[WebhookHealth] Webhook missing for folder ${folderId}`);

        if (reregister) {
          try {
            await this.registerWebhook(folderId);
            result.reregistered++;
            console.info(`[WebhookHealth] Re-registered webhook for folder ${folderId}`);
          } catch (err) {
            result.errors.push({ folderId, error: err.message });
            console.error(`[WebhookHealth] Re-registration failed for folder ${folderId}:`, err.message);
          }
        }
      }
    }

    return result;
  }
}

// Singleton instance
const webhookService = new WebhookService();
export default webhookService;
