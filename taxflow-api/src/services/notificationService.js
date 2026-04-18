/**
 * NotificationService — Event-driven notifications with deep-link tokens.
 *
 * Orchestrates notification dispatch across email and in-app channels.
 * Deep-link token operations are delegated to deepLinkTokenService.
 * Email operations are delegated to emailService.
 *
 * - dispatch: Translate event to notification, send email + store in-app
 * - generateDeepLinkToken: Delegates to deepLinkTokenService
 * - verifyDeepLinkToken: Delegates to deepLinkTokenService
 * - sendEmail: Delegates to emailService
 * - storeInAppNotification: Delegates to inAppNotificationStore
 * - getNotifications: Delegates to inAppNotificationStore
 *
 * Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 28.1, 28.2, 28.3, 28.4, 28.5, 28.6
 */

import { config } from '../config.js';
import { retryWithBackoff } from '../utils/retryWithBackoff.js';
import deepLinkTokenService from './deepLinkTokenService.js';
import emailService from './emailService.js';
import inAppNotificationStore from './inAppNotificationStore.js';

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

export class NotificationService {
  constructor(store = inAppNotificationStore) {
    /** @type {import('./inAppNotificationStore.js').InAppNotificationStore} */
    this._store = store;
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
      id: this._store.nextId(),
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
   * Delegates to deepLinkTokenService. (Reqs 27.1, 27.2, 27.3)
   *
   * @param {{ fileId: string, clientId: string, action: string }} payload
   * @param {{ expiryHours?: number }} [options]
   * @returns {string} Signed JWT token
   */
  generateDeepLinkToken(payload, options) {
    return deepLinkTokenService.generateDeepLinkToken(payload, options);
  }

  /**
   * Verifies and decodes a deep-link token.
   * Delegates to deepLinkTokenService. (Reqs 27.4, 27.5)
   *
   * @param {string} token - JWT token string
   * @returns {{ fileId: string, clientId: string, action: string, exp: number }}
   */
  verifyDeepLinkToken(token) {
    return deepLinkTokenService.verifyDeepLinkToken(token);
  }

  /**
   * Sends email via emailService.
   * Delegates to emailService for SMTP dispatch with retry logic. (Reqs 28.3, 28.5)
   *
   * @param {string} recipientEmail - Recipient email address
   * @param {string} templateId - Email template identifier
   * @param {Record<string, string>} context - Template variables
   */
  async sendEmail(recipientEmail, templateId, context) {
    return emailService.sendEmail(recipientEmail, templateId, context);
  }

  /**
   * Stores in-app notification. Delegates to inAppNotificationStore. (Req 28.6)
   *
   * @param {object} notification
   */
  async storeInAppNotification(notification) {
    return this._store.storeInAppNotification(notification);
  }

  /**
   * Retrieves in-app notifications for a recipient.
   * Delegates to inAppNotificationStore.
   *
   * @param {string} recipientId
   * @returns {Promise<Array<object>>}
   */
  async getNotifications(recipientId) {
    return this._store.getNotifications(recipientId);
  }

  /**
   * Dispatches a revision email to the client with a 7-day signed deep-link token.
   * Retries 3x with exponential backoff (2s, 4s, 8s). If all retries fail,
   * creates an in-app notification for the employee. Fire-and-forget (non-blocking).
   * (Reqs 11.1, 11.2, 11.4, 11.5)
   *
   * @param {string} clientEmail - Client email address
   * @param {string} documentId - Document ID for the deep-link
   * @param {string} revisionComment - Revision comment text
   */
  async dispatchRevisionEmail(clientEmail, documentId, revisionComment) {
    // Generate a 7-day (168 hour) signed token via deepLinkTokenService
    const token = deepLinkTokenService.generateDeepLinkToken(
      { documentId, action: 'revision' },
      { expiryHours: 168 }
    );
    const deepLinkUrl = `${config.frontendUrl}/api/deep-link?token=${token}`;

    try {
      await retryWithBackoff(
        () => this.sendEmail(clientEmail, 'revision_requested', {
          message: `Revision requested: ${revisionComment}`,
          deepLinkUrl,
        }),
        { maxRetries: 3, baseDelayMs: 2000 }
      );
      return; // Success — exit
    } catch (_err) {
      // All retries failed — create in-app notification for the employee
      console.error(`All revision email retries failed for document ${documentId}`);
      await this.storeInAppNotification({
        id: this._store.nextId(),
        recipientId: clientEmail, // use clientEmail as fallback recipientId
        eventType: 'email_failed',
        message: `Email to ${clientEmail} could not be sent for document ${documentId}. Please follow up manually.`,
        documentId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Creates an in-app notification for an @mentioned employee.
   * (Reqs 12.2)
   *
   * @param {string} mentionedEmployeeId - The employee who was mentioned
   * @param {string} mentionerName - Name of the person who mentioned them
   * @param {string} documentId - Document where the mention occurred
   * @param {string} commentId - Comment containing the mention
   */
  async dispatchMentionNotification(mentionedEmployeeId, mentionerName, documentId, commentId) {
    await this.storeInAppNotification({
      id: this._store.nextId(),
      recipientId: mentionedEmployeeId,
      eventType: 'mention',
      message: `${mentionerName} mentioned you in a comment on document ${documentId}`,
      documentId,
      commentId,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Creates an in-app notification for an employee when a client uploads a document.
   * (Reqs 12.1)
   *
   * @param {string} employeeId - The assigned employee
   * @param {string} clientName - Name of the client who uploaded
   * @param {string} documentName - Name of the uploaded document
   */
  async dispatchUploadNotification(employeeId, clientName, documentName) {
    await this.storeInAppNotification({
      id: this._store.nextId(),
      recipientId: employeeId,
      eventType: 'document_uploaded',
      message: `${clientName} uploaded a file for ${documentName}`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Base64url encode a string (no padding).
   * Delegates to deepLinkTokenService.
   * @param {string} str
   * @returns {string}
   */
  _base64url(str) {
    return deepLinkTokenService._base64url(str);
  }
}

// Singleton instance
const notificationService = new NotificationService();
export default notificationService;
