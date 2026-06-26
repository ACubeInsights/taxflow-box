/**
 * Tests for InAppNotificationStore — DB-backed notification persistence.
 *
 * Verifies:
 * - Store notification persists via repository
 * - Get notifications returns ordered results
 * - Mark as read updates state
 * - Pagination works
 * - Unread count accurate
 * - In-memory fallback works when no repo injected
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InAppNotificationStore } from '../inAppNotificationStore.js';

describe('InAppNotificationStore — DB-backed mode', () => {
  let store;
  let mockRepo;
  let dbRows;

  beforeEach(() => {
    dbRows = [];
    mockRepo = {
      create: vi.fn().mockImplementation(async (data) => {
        const record = { id: `notif-${dbRows.length + 1}`, ...data, created_at: new Date().toISOString() };
        dbRows.push(record);
        return record;
      }),
      findByRecipientId: vi.fn().mockImplementation(async (recipientId) => {
        return dbRows
          .filter((r) => r.recipient_id === recipientId)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }),
      markAsRead: vi.fn().mockImplementation(async (id) => {
        const row = dbRows.find((r) => r.id === id);
        if (row) row.read = true;
      }),
    };

    store = new InAppNotificationStore();
    store.setRepositories({ notificationRepo: mockRepo });
  });

  it('isDbBacked returns true when repo is injected', () => {
    expect(store.isDbBacked()).toBe(true);
  });

  it('stores notification via repository', async () => {
    await store.storeInAppNotification({
      recipientId: 'user-1',
      eventType: 'document_uploaded',
      message: 'File uploaded: tax.pdf',
    });

    expect(mockRepo.create).toHaveBeenCalledOnce();
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      recipient_id: 'user-1',
      event_type: 'document_uploaded',
      message: 'File uploaded: tax.pdf',
      read: false,
    }));
  });

  it('retrieves notifications ordered by created_at descending', async () => {
    // Insert with explicit timestamps to guarantee ordering
    dbRows.push({ id: 'n-1', recipient_id: 'user-1', event_type: 'a', message: 'First', read: false, created_at: '2026-06-26T10:00:00.000Z' });
    dbRows.push({ id: 'n-2', recipient_id: 'user-1', event_type: 'b', message: 'Second', read: false, created_at: '2026-06-26T10:01:00.000Z' });
    dbRows.push({ id: 'n-3', recipient_id: 'user-2', event_type: 'c', message: 'Other user', read: false, created_at: '2026-06-26T10:02:00.000Z' });

    const result = await store.getNotifications('user-1');
    expect(result).toHaveLength(2);
    expect(result[0].eventType).toBe('b'); // newer first
    expect(result[1].eventType).toBe('a');
  });

  it('marks notification as read', async () => {
    await store.storeInAppNotification({ recipientId: 'user-1', eventType: 'test', message: 'Hello' });
    const notifications = await store.getNotifications('user-1');
    expect(notifications[0].read).toBe(false);

    await store.markAsRead(notifications[0].id);
    expect(mockRepo.markAsRead).toHaveBeenCalledWith(notifications[0].id);
  });

  it('supports pagination via limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await store.storeInAppNotification({ recipientId: 'user-1', eventType: `event-${i}`, message: `Msg ${i}` });
    }

    const page1 = await store.getNotifications('user-1', { limit: 2, offset: 0 });
    expect(page1).toHaveLength(2);

    const page2 = await store.getNotifications('user-1', { limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);

    const page3 = await store.getNotifications('user-1', { limit: 2, offset: 4 });
    expect(page3).toHaveLength(1);
  });

  it('returns accurate unread count', async () => {
    await store.storeInAppNotification({ recipientId: 'user-1', eventType: 'a', message: 'One' });
    await store.storeInAppNotification({ recipientId: 'user-1', eventType: 'b', message: 'Two' });
    await store.storeInAppNotification({ recipientId: 'user-1', eventType: 'c', message: 'Three' });

    expect(await store.getUnreadCount('user-1')).toBe(3);

    const notifs = await store.getNotifications('user-1');
    await store.markAsRead(notifs[0].id);

    expect(await store.getUnreadCount('user-1')).toBe(2);
  });

  it('returns empty array for unknown recipient', async () => {
    const result = await store.getNotifications('nonexistent');
    expect(result).toEqual([]);
  });
});

describe('InAppNotificationStore — in-memory fallback', () => {
  let store;

  beforeEach(() => {
    store = new InAppNotificationStore();
    // No setRepositories call — in-memory mode
  });

  it('isDbBacked returns false', () => {
    expect(store.isDbBacked()).toBe(false);
  });

  it('stores and retrieves notifications in memory', async () => {
    await store.storeInAppNotification({
      recipientId: 'test-user',
      eventType: 'test_event',
      message: 'Test message',
    });

    const result = await store.getNotifications('test-user');
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Test message');
    expect(result[0].id).toBeDefined();
  });

  it('marks notification as read in memory', async () => {
    const stored = await store.storeInAppNotification({
      recipientId: 'test-user',
      eventType: 'x',
      message: 'Y',
      read: false,
    });

    await store.markAsRead(stored.id);
    const result = await store.getNotifications('test-user');
    expect(result[0].read).toBe(true);
  });

  it('generates unique UUIDs for IDs', async () => {
    const id1 = store.nextId();
    const id2 = store.nextId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
  });
});
