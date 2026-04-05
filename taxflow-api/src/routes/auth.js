/**
 * Auth routes — Login (no signup), session validation, logout.
 *
 * POST /api/auth/login          — Authenticate client or staff
 * POST /api/auth/logout         — Destroy session
 * GET  /api/auth/me             — Validate session & return user
 * POST /api/auth/refresh        — Extend session
 */

import express from 'express';
import authService from '../services/authService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { email, password?, loginType: 'client' | 'staff' }
 *
 * Clients log in with email only (their identity is the Box App User).
 * Staff log in with email + password.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, loginType } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let result;

    if (loginType === 'client') {
      // Client login — email + password
      result = await authService.loginClient(email, password);
    } else {
      // Staff login — email + password
      if (!password) {
        return res.status(400).json({ error: 'Password is required for staff login' });
      }
      result = await authService.loginStaff(email, password);
    }

    res.json(result);
  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <sessionToken>
 * Returns current user info if session is valid.
 */
router.get('/me', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const session = authService.validateSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  res.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
    },
    expiresAt: session.expiresAt,
  });
});

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <sessionToken>
 */
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    authService.logout(token);
  }
  res.json({ success: true });
});

/**
 * POST /api/auth/refresh
 * Header: Authorization: Bearer <sessionToken>
 * Extends the session expiry.
 */
router.post('/refresh', (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const result = authService.refreshSession(token);
  if (!result) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  res.json(result);
});

/**
 * POST /api/auth/change-password
 * Header: Authorization: Bearer <sessionToken>
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    const result = await authService.changePassword(req.user.userId, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 400) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always returns 200 to prevent email enumeration.
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await authService.requestPasswordReset(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'token and newPassword are required' });
    }
    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * Extracts Bearer token from Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export default router;
