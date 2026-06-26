/**
 * InAppNotificationStore — Notification storage and retrieval.
 *
 * DB-backed (primary): Uses NotificationRepository for persistence.
 * In-memory fallback: Uses Map when DB is not initialized (tests only).
 *
 * Requirements: 16.5, 16.7, 28.6, 4.5
 */

import crypto from 'crypto';

export class InAppNotificationStore {
  constructor() {
    /** @type {Map<string, Array<object>>} In-memory notification store keyed by recipientId */
    this._notifications = new Map();

    /** @type {import('../db/repositories/NotificationRepository.js').NotificationRepository | null} */
    this._notificationRepo = null;
  }

  /**
   * Injects repository dependencies. Called after DB initialization.
   * @param {{ notificationRepo?: object }} repos
   */
  setRepositories({ notificationRepo } = {}) {
    if (notificationRepo) this._notificationRepo = notificationRepo;
  }

  /**
   * Returns true if DB-backed persistence is active.
   * @returns {boolean}
   */
  isDbBacked() {
    return !!this._notificationRepo;
  }

  /**
   * Generates the next unique notification ID.
   * Uses crypto.randomUUID for DB-backed mode (proper UUIDs).
   * @returns {string} A unique ID string
   */
  nextId() {
    return crypto.randomUUID();
  }

  /**
   * Stores an in-app notification.
   * @param {object} notification
   * @returns {Promise<object>} The stored notification with id
   */
  async storeInAppNotification(notification) {
    if (this._notificationRepo) {
      const record = await this._notificationRepo.create({
        recipient_id: notification.recipientId,
        event_type: notification.eventType,
        message: notification.message,
        document_id: notification.documentId || notification.documentReference?.fileId || null,
        comment_id: notification.commentId || null,
        deep_link_url: notification.deepLinkUrl || null,
        read: notification.read !== undefined ? notification.read : false,
      });
      return record;
    }

    // In-memory fallback
    const recipientId = notification.recipientId;
    if (!this._notifications.has(recipientId)) {
      this._notifications.set(recipientId, []);
    }
    const stored = { ...notification, id: notification.id || this.nextId() };
    this._notifications.get(recipientId).push(stored);
    return stored;
  }

  /**
   * Retrieves in-app notifications for a recipient, ordered by created_at descending.
   * @param {string} recipientId
   * @param {{ limit?: number, offset?: number }} [options]
   * @returns {Promise<Array<object>>}
   */
  async getNotifications(recipientId, options = {}) {
    if (this._notificationRepo) {
      const rows = await this._notificationRepo.findByRecipientId(recipientId);
      const mapped = rows.map((r) => ({
        id: r.id,
        recipientId: r.recipient_id,
        eventType: r.event_type,
        message: r.message,
        documentId: r.document_id,
        commentId: r.comment_id,
        deepLinkUrl: r.deep_link_url,
        read: !!r.read,
        createdAt: r.created_at,
      }));
      // Apply pagination if requested
      if (options.limit) {
        const start = options.offset || 0;
        return mapped.slice(start, start + options.limit);
      }
      return mapped;
    }

    // In-memory fallback
    const all = this._notifications.get(recipientId) || [];
    if (options.limit) {
      const start = options.offset || 0;
      return all.slice(start, start + options.limit);
    }
    return all;
  }

  /**
   * Marks a notification as read.
   * @param {string} notificationId
   * @returns {Promise<void>}
   */
  async markAsRead(notificationId) {
    if (this._notificationRepo) {
      await this._notificationRepo.markAsRead(notificationId);
      return;
    }

    // In-memory fallback
    for (const [, notifications] of this._notifications) {
      const found = notifications.find((n) => n.id === notificationId);
      if (found) {
        found.read = true;
        return;
      }
    }
  }

  /**
   * Returns unread count for a recipient.
   * @param {string} recipientId
   * @returns {Promise<number>}
   */
  async getUnreadCount(recipientId) {
    const all = await this.getNotifications(recipientId);
    return all.filter((n) => !n.read).length;
  }
}

// Singleton instance
const inAppNotificationStore = new InAppNotificationStore();
export default inAppNotificationStore;
