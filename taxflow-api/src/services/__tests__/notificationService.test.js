import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService } from '../notificationService.js';

/**
 * Tests for the NEW notificationService methods:
 * - dispatchRevisionEmail
 * - dispatchMentionNotification
 * - dispatchUploadNotification
 *
 * Does NOT test existing methods (dispatch, generateDeepLinkToken, etc.)
 */

describe('NotificationService — new methods', () => {
  /** @type {NotificationService} */
  let service;

  beforeEach(() => {
    service = new NotificationService();
  });

  // ─── dispatchMentionNotification ──────────────────────────────────

  describe('dispatchMentionNotification', () => {
    it('creates an in-app notification with eventType "mention"', async () => {
      await service.dispatchMentionNotification('emp42', 'Alice', 'doc-1', 'cmt-5');

      const notifications = service.getNotifications('emp42');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].eventType).toBe('mention');
    });

    it('includes mentioner name and document ID in message', async () => {
      await service.dispatchMentionNotification('emp42', 'Alice', 'doc-1', 'cmt-5');

      const notifications = service.getNotifications('emp42');
      expect(notifications[0].message).toBe('Alice mentioned you in a comment on document doc-1');
    });

    it('stores the correct recipientId', async () => {
      await service.dispatchMentionNotification('emp42', 'Bob', 'doc-2', 'cmt-10');

      const notifications = service.getNotifications('emp42');
      expect(notifications[0].recipientId).toBe('emp42');
    });

    it('stores commentId and documentId', async () => {
      await service.dispatchMentionNotification('emp42', 'Alice', 'doc-1', 'cmt-5');

      const notifications = service.getNotifications('emp42');
      expect(notifications[0].documentId).toBe('doc-1');
      expect(notifications[0].commentId).toBe('cmt-5');
    });

    it('marks notification as unread', async () => {
      await service.dispatchMentionNotification('emp42', 'Alice', 'doc-1', 'cmt-5');

      const notifications = service.getNotifications('emp42');
      expect(notifications[0].read).toBe(false);
    });

    it('sets a valid createdAt ISO timestamp', async () => {
      await service.dispatchMentionNotification('emp42', 'Alice', 'doc-1', 'cmt-5');

      const notifications = service.getNotifications('emp42');
      expect(notifications[0].createdAt).toBeDefined();
      expect(new Date(notifications[0].createdAt).toISOString()).toBe(notifications[0].createdAt);
    });
  });

  // ─── dispatchUploadNotification ───────────────────────────────────

  describe('dispatchUploadNotification', () => {
    it('creates an in-app notification with eventType "document_uploaded"', async () => {
      await service.dispatchUploadNotification('emp1', 'Acme Corp', 'W-2 Form');

      const notifications = service.getNotifications('emp1');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].eventType).toBe('document_uploaded');
    });

    it('includes client name and document name in message', async () => {
      await service.dispatchUploadNotification('emp1', 'Acme Corp', 'W-2 Form');

      const notifications = service.getNotifications('emp1');
      expect(notifications[0].message).toBe('Acme Corp uploaded a file for W-2 Form');
    });

    it('stores the correct recipientId', async () => {
      await service.dispatchUploadNotification('emp99', 'Jane Doe', '1099-DIV');

      const notifications = service.getNotifications('emp99');
      expect(notifications[0].recipientId).toBe('emp99');
    });

    it('marks notification as unread', async () => {
      await service.dispatchUploadNotification('emp1', 'Acme Corp', 'W-2 Form');

      const notifications = service.getNotifications('emp1');
      expect(notifications[0].read).toBe(false);
    });
  });

  // ─── dispatchRevisionEmail ────────────────────────────────────────

  describe('dispatchRevisionEmail', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sends email successfully on first attempt', async () => {
      const sendEmailSpy = vi.spyOn(service, 'sendEmail').mockResolvedValueOnce();

      await service.dispatchRevisionEmail('client@example.com', 'doc-1', 'Fix page 2');

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        'client@example.com',
        'revision_requested',
        expect.objectContaining({
          message: 'Revision requested: Fix page 2',
          deepLinkUrl: expect.stringContaining('/api/deep-link?token='),
        })
      );
    });

    it('generates a deep-link token with 7-day (168h) expiry', async () => {
      let capturedUrl;
      vi.spyOn(service, 'sendEmail').mockImplementation(async (_to, _tpl, ctx) => {
        capturedUrl = ctx.deepLinkUrl;
      });

      await service.dispatchRevisionEmail('client@example.com', 'doc-1', 'Fix amounts');

      expect(capturedUrl).toMatch(/\/api\/deep-link\?token=.+\..+\..+/);

      const token = capturedUrl.split('token=')[1];
      const payload = service.verifyDeepLinkToken(token);
      expect(payload.documentId).toBe('doc-1');
      expect(payload.action).toBe('revision');

      // Expiry should be ~7 days from now (168 hours)
      const nowSec = Math.floor(Date.now() / 1000);
      const expectedExpiry = nowSec + 168 * 3600;
      expect(Math.abs(payload.exp - expectedExpiry)).toBeLessThan(5);
    });

    it('retries on email failure and succeeds on second attempt', async () => {
      const sendEmailSpy = vi.spyOn(service, 'sendEmail')
        .mockRejectedValueOnce(new Error('SMTP error'))
        .mockResolvedValueOnce();

      const promise = service.dispatchRevisionEmail('client@example.com', 'doc-1', 'Fix page 2');

      // Advance past the first retry delay (2s)
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      expect(sendEmailSpy).toHaveBeenCalledTimes(2);
      // No in-app notification since email eventually succeeded
      const notifications = service.getNotifications('client@example.com');
      expect(notifications).toHaveLength(0);
    });

    it('retries 3 times and creates in-app notification on total failure', async () => {
      const sendEmailSpy = vi.spyOn(service, 'sendEmail')
        .mockRejectedValue(new Error('SMTP error'));

      const promise = service.dispatchRevisionEmail('client@example.com', 'doc-1', 'Fix page 2');

      // Advance past retry delays: 2s + 4s
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await promise;

      expect(sendEmailSpy).toHaveBeenCalledTimes(3);

      const notifications = service.getNotifications('client@example.com');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].eventType).toBe('email_failed');
      expect(notifications[0].message).toContain('client@example.com');
      expect(notifications[0].message).toContain('doc-1');
    });

    it('does not create in-app notification when email succeeds on third attempt', async () => {
      vi.spyOn(service, 'sendEmail')
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce();

      const promise = service.dispatchRevisionEmail('client@example.com', 'doc-1', 'Fix page 2');

      // Advance past retry delays: 2s + 4s
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await promise;

      const notifications = service.getNotifications('client@example.com');
      expect(notifications).toHaveLength(0);
    });

    it('deep-link URL uses config.frontendUrl', async () => {
      let capturedUrl;
      vi.spyOn(service, 'sendEmail').mockImplementation(async (_to, _tpl, ctx) => {
        capturedUrl = ctx.deepLinkUrl;
      });

      await service.dispatchRevisionEmail('client@example.com', 'doc-1', 'Fix it');

      // Default frontendUrl from config is http://localhost:5173
      expect(capturedUrl).toMatch(/^http:\/\/localhost:5173\/api\/deep-link\?token=/);
    });
  });
});
