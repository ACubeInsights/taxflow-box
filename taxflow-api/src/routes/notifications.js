/**
 * Notification routes — In-app notifications and deep-link verification.
 */

import express from 'express';
import notificationService from '../services/notificationService.js';
import deepLinkTokenService from '../services/deepLinkTokenService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/notifications/:recipientId
 */
router.get('/:recipientId', requireAuth, async (req, res, next) => {
  try {
    const { recipientId } = req.params;
    if (recipientId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { limit, offset } = req.query;
    const options = {};
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);

    const notifications = await notificationService.getNotifications(recipientId, options);
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:notificationId/read
 */
router.patch('/:notificationId/read', requireAuth, async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const owned = await notificationService.markAsReadForRecipient(notificationId, req.user.userId);
    if (!owned) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const deepLinkRouter = express.Router();

/**
 * GET /api/deep-link
 */
deepLinkRouter.get('/deep-link', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'Missing token parameter' });
  }

  try {
    const payload = deepLinkTokenService.verifyDeepLinkToken(token);

    const { fileId, clientId, action } = payload;
    const baseUrl = req.app?.locals?.frontendUrl || 'http://localhost:5173';
    const redirectUrl = new URL(baseUrl);
    redirectUrl.pathname = `/${action || 'view'}`;
    if (fileId) redirectUrl.searchParams.set('fileId', fileId);
    if (clientId) redirectUrl.searchParams.set('clientId', clientId);

    return res.redirect(302, redirectUrl.toString());
  } catch (error) {
    return res.status(error.statusCode || 401).json({ error: error.message });
  }
});

export { deepLinkRouter };
export default router;
