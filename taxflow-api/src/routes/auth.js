/**
 * Auth routes — Login (no signup), session validation, logout.
 */

import express from 'express';
import authService from '../services/authService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/me', async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const session = await authService.validateSession(token);
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

router.post('/logout', async (req, res) => {
  const token = extractToken(req);
  if (token) {
    await authService.logout(token);
  }
  res.json({ success: true });
});

router.post('/refresh', async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const result = await authService.refreshSession(token);
  if (!result) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  res.json(result);
});

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

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export default router;
