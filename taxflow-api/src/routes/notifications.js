/**
 * Notification routes — In-app notifications and deep-link verification.
 *
 * Exports:
 * - default: notifications router (mount at /api/notifications)
 * - deepLinkRouter: deep-link router (mount at /api)
 *
 * Requirements: 27.4, 27.5, 28.6
 */

import express from 'express';
import notificationService from '../services/notificationService.js';

// Notifications router — mount at /api/notifications
const router = express.Router();

/**
 * GET /api/notifications/:recipientId
 * Retrieve in-app notifications for a recipient.
 */
router.get('/:recipientId', (req, res, next) => {
  try {
    const { recipientId } = req.params;
    const notifications = notificationService.getNotifications(recipientId);
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// Deep-link router — mount at /api
const deepLinkRouter = express.Router();

/**
 * GET /api/deep-link
 * Verify deep-link token query param and redirect or return 401.
 */
deepLinkRouter.get('/deep-link', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'Missing token parameter' });
  }

  try {
    const payload = notificationService.verifyDeepLinkToken(token);

    // Build redirect URL with context parameters
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
