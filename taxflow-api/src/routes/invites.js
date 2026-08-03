/**
 * Invite routes — Client invitation and self-signup endpoints.
 */

import express from 'express';
import inviteService from '../services/inviteService.js';
import signupService from '../services/signupService.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { rateLimit } from '../middleware/httpRateLimit.js';
import { assertPasswordPolicy } from '../utils/authUtils.js';

const router = express.Router();

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many signup attempts. Please try again later.',
  keyFn: (req) => `signup:${req.ip || req.socket?.remoteAddress || 'unknown'}`,
});

/**
 * POST /api/invites
 * Create a new client invitation (sends email).
 * Auth: employee or superadmin
 */
router.post('/', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { clientName, email, externalId, financialYear } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }

    // Attribution always from authenticated user — never trust body.employeeEmail
    const result = await inviteService.createInvite({
      clientName: (clientName || '').trim() || null,
      email: email.trim(),
      externalId: (externalId || '').trim() || null,
      employeeEmail: req.user.email,
      financialYear: (financialYear || new Date().getFullYear().toString()).trim(),
    });

    res.status(201).json({ ...result, message: `Invitation sent to ${result.email}` });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/invites/validate
 * Validate an invite token (public — no auth required).
 */
router.get('/validate', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ valid: false, error: 'TOKEN_MISSING', message: 'Token is required' });
    }

    const result = await signupService.validateToken(token);
    res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    const errorCode = status === 410 ? 'TOKEN_EXPIRED' : status === 409 ? 'ALREADY_ACCEPTED' : 'TOKEN_INVALID';
    res.status(status).json({ valid: false, error: errorCode, message: error.message });
  }
});

/**
 * POST /api/invites/signup
 * Complete client signup (public — token authenticates).
 */
router.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const { token, password, clientName, externalId, email } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    try {
      assertPasswordPolicy(password);
    } catch (policyErr) {
      return res.status(400).json({ error: policyErr.message });
    }

    const result = await signupService.completeSignup(token, password, clientName, externalId, email);
    res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/invites/:id/resend
 * Resend invitation email (employee/superadmin).
 * Employees may only resend their own invites; superadmin may resend any.
 */
router.post('/:id/resend', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await inviteService.resendInvite(id, {
      requesterEmail: req.user.email,
      requesterRole: req.user.role,
    });
    res.json({ ...result, message: `Invitation resent to ${result.email}` });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/invites
 * List invites for authenticated employee (superadmin may pass ?employeeEmail= to filter).
 */
router.get('/', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    let employeeEmail = req.user.email;
    if (req.user.role === 'superadmin' && req.query.employeeEmail) {
      employeeEmail = String(req.query.employeeEmail);
    }
    if (!employeeEmail) {
      return res.status(400).json({ error: 'Employee email required' });
    }
    const { status } = req.query;
    const invites = await inviteService.listInvites(employeeEmail, status);
    res.json({ invites });
  } catch (error) {
    next(error);
  }
});

export default router;
