/**
 * NotificationService — Event-driven notifications with deep-link tokens.
 *
 * - dispatch: Translate event to notification, send email + store in-app
 * - generateDeepLinkToken: Signed JWT (HMAC-SHA256) with 72-hour expiry
 * - verifyDeepLinkToken: Verify signature and expiry
 * - sendEmail: Placeholder with retry 3x exponential backoff
 * - storeInAppNotification: In-memory Map keyed by recipientId
 * - getNotifications: Retrieve in-app notifications for a recipient
 *
 * Uses Node.js crypto for JWT (HMAC-SHA256 + base64url) — no jsonwebtoken dependency.
 *
 * Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 28.1, 28.2, 28.3, 28.4, 28.5, 28.6
 */

import crypto from 'crypto';
import { config } from '../config.js';

/** Event type to human-readable message templates */
const EVENT_TEMPLATES = {
  document_uploaded: (ctx) => `New document uploaded: ${ctx.fileName || 'unknown'}`,
  document_approved: (ctx) => `Document approved: ${ctx.fileName || 'unknown'}`,
  revision_requested: (ctx) => `Revision requested for: ${ctx.fileName || 'unknown'}${ctx.message ? ` — ${ctx.message}` : ''}`,
  document_waived: (ctx) => `Document requirement waived: ${ctx.fileName || 'unknown'}`,
  signature_requested: (ctx) => `Signature requested for: ${ctx.fileName || 'unknown'}`,
  signature_completed: (ctx) => `Signature completed for: ${ctx.fileName || 'unknown'}`,
  signature_declined: (ctx) => `Signature declined for: ${ctx.fileName || 'unknown'}`,
  signature_expired: (ctx) => `Signature expired for: ${ctx.fileName || 'unknown'}`,
  document_reuploaded: (ctx) => `Document re-uploaded: ${ctx.fileName || 'unknown'}`,
};

class NotificationService {
  constructor() {
    /** @type {Map<string, Array<object>>} In-memory notification store keyed by recipientId */
    this._notifications = new Map();
    this._idCounter = 0;
  }

  /**
   * Translates a Box event into a business notification and dispatches
   * via email and in-app channels. (Reqs 28.1, 28.2)
   *
   * @param {string} eventType - Notification event type
   * @param {string} recipientId - Recipient identifier
   * @param {{ fileId: string, fileName: string, clientId: string, message?: string }} context
   */
  async dispatch(eventType, recipientId, context) {
    const templateFn = EVENT_TEMPLATES[eventType];
    const message = templateFn ? templateFn(context) : `Notification: ${eventType}`;

    // Generate deep-link token (Req 27.1)
    const deepLinkToken = this.generateDeepLinkToken({
      fileId: context.fileId || '',
      clientId: context.clientId || '',
      action: 'view',
    });

    const deepLinkUrl = `${config.frontendUrl}/api/deep-link?token=${deepLinkToken}`;

    const notification = {
      id: String(++this._idCounter),
      recipientId,
      eventType,
      message,
      documentReference: {
        fileId: context.fileId || '',
        fileName: context.fileName || '',
      },
      deepLinkUrl,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Store in-app notification (Req 28.6)
    await this.storeInAppNotification(notification);

    // Send email (Req 28.2, 28.3)
    try {
      await this.sendEmail(recipientId, eventType, {
        message,
        deepLinkUrl,
        fileName: context.fileName || '',
      });
    } catch (err) {
      console.error(`Email dispatch failed for ${recipientId}:`, err.message);
    }
  }

  /**
   * Generates a signed JWT deep-link token (72-hour expiry).
   * Uses HMAC-SHA256 with DEEP_LINK_SECRET. (Reqs 27.1, 27.2, 27.3)
   *
   * @param {{ fileId: string, clientId: string, action: string }} payload
   * @returns {string} Signed JWT token
   */
  generateDeepLinkToken(payload) {
    const secret = config.deepLinkSecret || 'default-dev-secret';
    const expiryHours = config.deepLinkExpiryHours || 72;
    const exp = Math.floor(Date.now() / 1000) + expiryHours * 3600;

    const header = { alg: 'HS256', typ: 'JWT' };
    const body = { ...payload, exp };

    const encodedHeader = this._base64url(JSON.stringify(header));
    const encodedPayload = this._base64url(JSON.stringify(body));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

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
   * @returns {{ fileId: string, clientId: string, action: string, exp: number }}
   */
  verifyDeepLinkToken(token) {
    const secret = config.deepLinkSecret || 'default-dev-secret';
    const parts = token.split('.');

    if (parts.length !== 3) {
      const err = new Error('Invalid deep-link token format');
      err.statusCode = 401;
      throw err;
    }

    const [encodedHeader, encodedPayload, providedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    // Constant-time comparison
    const sigBuf = Buffer.from(providedSignature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    let signatureValid = false;
    if (sigBuf.length === expBuf.length) {
      signatureValid = crypto.timingSafeEqual(sigBuf, expBuf);
    }

    if (!signatureValid) {
      const err = new Error('Invalid deep-link token signature');
      err.statusCode = 401;
      throw err;
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      const err = new Error('Invalid deep-link token payload');
      err.statusCode = 401;
      throw err;
    }

    // Check expiry (Req 27.3)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      const err = new Error('Deep-link token has expired');
      err.statusCode = 401;
      throw err;
    }

    return payload;
  }

  /**
   * Sends email via SendGrid/SES with deep-link URL.
   * Retries 3x with exponential backoff. (Reqs 28.3, 28.5)
   *
   * @param {string} recipientEmail - Recipient email address
   * @param {string} templateId - Email template identifier
   * @param {Record<string, string>} context - Template variables
   */
  async sendEmail(recipientEmail, templateId, context) {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Placeholder — integrate SendGrid/SES here
        console.log(
          `[Email] To: ${recipientEmail}, Template: ${templateId}, ` +
          `Message: ${context.message || ''}, DeepLink: ${context.deepLinkUrl || ''}`
        );
        return; // Success
      } catch (err) {
        console.error(`Email attempt ${attempt}/${maxRetries} failed:`, err.message);
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Stores in-app notification in memory keyed by recipientId. (Req 28.6)
   * Notifications are ephemeral and reset on server restart.
   *
   * @param {object} notification
   */
  async storeInAppNotification(notification) {
    const recipientId = notification.recipientId;
    if (!this._notifications.has(recipientId)) {
      this._notifications.set(recipientId, []);
    }
    this._notifications.get(recipientId).push(notification);
  }

  /**
   * Retrieves in-app notifications for a recipient.
   *
   * @param {string} recipientId
   * @returns {Array<object>}
   */
  getNotifications(recipientId) {
    return this._notifications.get(recipientId) || [];
  }

  /**
   * Base64url encode a string (no padding).
   * @param {string} str
   * @returns {string}
   */
  _base64url(str) {
    return Buffer.from(str, 'utf8').toString('base64url');
  }
}

// Singleton instance
const notificationService = new NotificationService();
export { NotificationService };
export default notificationService;
