/**
 * InAppNotificationStore — Notification storage and retrieval.
 *
 * Supports two modes:
 *   1. DB-backed: Uses NotificationRepository
 *   2. In-memory fallback: Uses Map (for tests or when DB is not initialized)
 *
 * Requirements: 16.5, 16.7, 28.6, 4.5
 */

export class InAppNotificationStore {
  constructor() {
    /** @type {Map<string, Array<object>>} In-memory notification store keyed by recipientId */
    this._notifications = new Map();
    this._idCounter = 0;

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
   * Generates the next unique notification ID.
   * @returns {string} A unique ID string
   */
  nextId() {
    return String(++this._idCounter);
  }

  /**
   * Stores an in-app notification.
   * @param {object} notification
   * @returns {Promise<void>}
   */
  async storeInAppNotification(notification) {
    if (this._notificationRepo) {
      await this._notificationRepo.create({
        recipient_id: notification.recipientId,
        event_type: notification.eventType,
        message: notification.message,
        document_id: notification.documentId || notification.documentReference?.fileId || null,
        comment_id: notification.commentId || null,
        deep_link_url: notification.deepLinkUrl || null,
        read: notification.read !== undefined ? notification.read : false,
      });
      return;
    }

    // In-memory fallback
    const recipientId = notification.recipientId;
    if (!this._notifications.has(recipientId)) {
      this._notifications.set(recipientId, []);
    }
    this._notifications.get(recipientId).push(notification);
  }

  /**
   * Retrieves in-app notifications for a recipient.
   * @param {string} recipientId
   * @returns {Promise<Array<object>>}
   */
  async getNotifications(recipientId) {
    if (this._notificationRepo) {
      const rows = await this._notificationRepo.findByRecipientId(recipientId);
      return rows.map((r) => ({
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
    }

    return this._notifications.get(recipientId) || [];
  }
}

// Singleton instance
const inAppNotificationStore = new InAppNotificationStore();
export default inAppNotificationStore;
