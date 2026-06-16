/**
 * InviteService — Orchestrates client invite creation and resend.
 */

import deepLinkTokenService from './deepLinkTokenService.js';
import emailService from './emailService.js';
import { config } from '../config.js';
import { createHttpError } from '../utils/httpError.js';

const INVITE_EXPIRY_HOURS = 72;
const MAX_RESENDS_PER_DAY = 5;

class InviteService {
  constructor() {
    this._inviteRepo = null;
  }

  setRepositories({ inviteRepo }) {
    this._inviteRepo = inviteRepo;
  }

  get inviteRepo() {
    if (!this._inviteRepo) throw new Error('InviteService: repositories not injected');
    return this._inviteRepo;
  }

  /**
   * Create a new client invite. Sends invitation email.
   */
  async createInvite({ clientName, email, externalId, employeeEmail, financialYear }) {
    // Check for existing pending/accepted invite
    const existing = await this.inviteRepo.findByEmail(email);
    if (existing) {
      // If the invite's token has expired, mark it expired and allow re-invite
      if (existing.token_expires_at && new Date(existing.token_expires_at) < new Date()) {
        await this.inviteRepo.updateStatus(existing.id, 'expired');
      } else if (existing.status === 'accepted') {
        // Accepted and token still valid — block
        throw createHttpError('This email already has an accepted invitation. The client can log in directly.', 409);
      } else {
        // Pending and token still valid — block
        throw createHttpError('This email already has a pending invitation that has not expired yet', 409);
      }
    }

    const tokenExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    const record = await this.inviteRepo.create({
      clientName: clientName || '',
      email,
      externalId: externalId || '',
      employeeEmail: employeeEmail || '',
      financialYear: financialYear || new Date().getFullYear().toString(),
      tokenExpiresAt,
    });

    // Generate invite token
    const token = deepLinkTokenService.generateDeepLinkToken(
      { inviteId: record.id, email: email.toLowerCase() },
      { expiryHours: INVITE_EXPIRY_HOURS }
    );

    // Send email (fire-and-forget — don't block response)
    const frontendUrl = config.frontendUrl || 'http://localhost:5173';
    const signupUrl = `${frontendUrl}/signup?token=${encodeURIComponent(token)}`;

    this._sendInviteEmail(record.id, email, clientName, signupUrl).catch(() => {});

    return { id: record.id, status: 'pending_invite', email };
  }

  /**
   * Resend invitation email with fresh token.
   */
  async resendInvite(inviteId) {
    const record = await this.inviteRepo.findById(inviteId);
    if (!record) throw createHttpError('Invite not found', 404);
    if (record.status === 'accepted') throw createHttpError('Cannot resend — invite already accepted', 400);

    // Rate limit check
    const resendCount = await this.inviteRepo.getResendCountInWindow(inviteId);
    if (resendCount >= MAX_RESENDS_PER_DAY) {
      throw createHttpError('Resend limit reached (max 5 per 24 hours). Try again later.', 429);
    }

    const tokenExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    await this.inviteRepo.updateTokenExpiry(inviteId, tokenExpiresAt);
    await this.inviteRepo.incrementResendCount(inviteId);

    const token = deepLinkTokenService.generateDeepLinkToken(
      { inviteId: record.id, email: record.email },
      { expiryHours: INVITE_EXPIRY_HOURS }
    );

    const frontendUrl = config.frontendUrl || 'http://localhost:5173';
    const signupUrl = `${frontendUrl}/signup?token=${encodeURIComponent(token)}`;

    this._sendInviteEmail(record.id, record.email, record.client_name, signupUrl).catch(() => {});

    return { id: record.id, status: 'pending_invite', email: record.email, tokenExpiresAt };
  }

  /**
   * List invites for an employee.
   */
  async listInvites(employeeEmail, statusFilter) {
    let records = await this.inviteRepo.findByEmployeeEmail(employeeEmail);
    if (statusFilter) {
      records = records.filter((r) => r.status === statusFilter);
    }
    return records.map((r) => ({
      id: r.id,
      clientName: r.client_name,
      email: r.email,
      externalId: r.external_id,
      status: r.status,
      deliveryFailed: r.delivery_failure_flag === 1,
      tokenExpiresAt: r.token_expires_at,
      createdAt: r.created_at,
    }));
  }

  /** @private */
  async _sendInviteEmail(inviteId, email, clientName, signupUrl) {
    try {
      await emailService.sendEmail(email, 'client_invite', {
        clientName,
        message: `Hi ${clientName},\n\nYou've been invited to TaxFlow Pro — your secure tax document portal. Click the button below to set up your account and get started.`,
        deepLinkUrl: signupUrl,
      });
    } catch (err) {
      console.error(`[InviteService] Email dispatch failed for invite ${inviteId}:`, err.message);
      try {
        await this.inviteRepo.setDeliveryFailure(inviteId, true);
      } catch { /* ignore */ }
    }
  }
}

const inviteService = new InviteService();
export default inviteService;
