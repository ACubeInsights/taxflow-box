/**
 * InAppNotificationStore — In-memory notification storage and retrieval.
 *
 * Manages ephemeral in-app notifications keyed by recipientId.
 * Notifications are stored in memory and reset on server restart.
 *
 * Exports:
 * - InAppNotificationStore (named): class for fresh instances in tests
 * - default: singleton instance
 *
 * Requirements: 28.6, 4.5
 */

export class InAppNotificationStore {
  constructor() {
    /** @type {Map<string, Array<object>>} In-memory notification store keyed by recipientId */
    this._notifications = new Map();
    this._idCounter = 0;
  }

  /**
   * Generates the next unique notification ID.
   *
   * @returns {string} A unique ID string
   */
  nextId() {
    return String(++this._idCounter);
  }

  /**
   * Stores an in-app notification in memory keyed by recipientId. (Req 28.6)
   * Notifications are ephemeral and reset on server restart.
   *
   * @param {object} notification
   * @returns {Promise<void>}
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
}

// Singleton instance
const inAppNotificationStore = new InAppNotificationStore();
export default inAppNotificationStore;
