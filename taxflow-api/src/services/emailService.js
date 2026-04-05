/**
 * EmailService — SMTP email dispatch with retry logic.
 *
 * Extracted from notificationService to follow Single Responsibility Principle.
 * Handles email composition (subject, HTML body) and delivery via Nodemailer
 * with exponential backoff retry.
 *
 * Public API:
 * - sendEmail(recipientEmail, templateId, context) — send an email with retry
 *
 * Requirements: 4.5, 28.3, 28.5
 */

import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { retryWithBackoff } from '../utils/retryWithBackoff.js';

export class EmailService {
  /**
   * Sends email via Nodemailer SMTP.
   * Falls back to console.log if SMTP is not configured.
   * Retries 3x with exponential backoff. (Reqs 28.3, 28.5)
   *
   * @param {string} recipientEmail - Recipient email address
   * @param {string} templateId - Email template identifier
   * @param {Record<string, string>} context - Template variables
   * @returns {Promise<void>}
   */
  async sendEmail(recipientEmail, templateId, context) {
    if (!config.smtpUser || !config.smtpPass) {
      // No SMTP configured — log to console
      console.log(
        `[Email-NoSMTP] To: ${recipientEmail}, Template: ${templateId}, ` +
        `Message: ${context.message || ''}, DeepLink: ${context.deepLinkUrl || ''}`
      );
      return;
    }

    await retryWithBackoff(
      async () => {
        const transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPass,
          },
        });

        const subject = this._getEmailSubject(templateId, context);
        const html = this._getEmailHtml(templateId, context);

        await transporter.sendMail({
          from: `"TaxFlow Pro" <${config.smtpFrom}>`,
          to: recipientEmail,
          subject,
          html,
        });

        console.log(`[Email] Sent to ${recipientEmail} (template: ${templateId})`);
      },
      { maxRetries: 3, baseDelayMs: 2000 }
    );
  }

  /**
   * Generates email subject based on template type.
   *
   * @param {string} templateId - Email template identifier
   * @param {Record<string, string>} context - Template variables
   * @returns {string} Email subject line
   */
  _getEmailSubject(templateId, context) {
    const subjects = {
      revision_requested: `Action Required: Please re-upload ${context.fileName || 'document'}`,
      request_published: `New Document Request: ${context.fileName || 'document'}`,
      document_uploaded: `Document Uploaded: ${context.fileName || 'document'}`,
      document_approved: `Document Approved: ${context.fileName || 'document'}`,
      password_reset: 'Reset Your TaxFlow Pro Password',
    };
    return subjects[templateId] || `TaxFlow Pro Notification: ${templateId}`;
  }

  /**
   * Generates email HTML body based on template type.
   *
   * @param {string} templateId - Email template identifier
   * @param {Record<string, string>} context - Template variables
   * @returns {string} HTML email body
   */
  _getEmailHtml(templateId, context) {
    const deepLinkButton = context.deepLinkUrl
      ? `<p style="margin:24px 0"><a href="${context.deepLinkUrl}" style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">View in TaxFlow Pro</a></p>`
      : '';

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
        <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;color:#fff;font-size:18px">TaxFlow Pro</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px">${context.message || ''}</p>
          ${deepLinkButton}
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0">This is an automated message from TaxFlow Pro. Do not reply directly.</p>
      </div>
    `;
  }
}

// Singleton instance
const emailService = new EmailService();
export default emailService;
