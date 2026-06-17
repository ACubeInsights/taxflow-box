/**
 * EmailService — Email dispatch via Brevo (formerly Sendinblue) HTTP API.
 *
 * Uses Brevo's HTTPS API (no SMTP ports needed).
 * Works on any hosting platform including Render free tier.
 * Free tier: 300 emails/day.
 */

import { config } from '../config.js';
import { retryWithBackoff } from '../utils/retryWithBackoff.js';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = config.smtpFrom || 'agarwalayush1412@gmail.com';
const FROM_NAME = 'TaxFlow Pro';

export class EmailService {
  async sendEmail(recipientEmail, templateId, context) {
    if (!BREVO_API_KEY) {
      console.log(
        `[Email-NoKey] To: ${recipientEmail}, Template: ${templateId}, ` +
        `Message: ${context.message || ''}, DeepLink: ${context.deepLinkUrl || ''}`
      );
      return;
    }

    const subject = this._getEmailSubject(templateId, context);
    const html = this._getEmailHtml(templateId, context);

    await retryWithBackoff(
      async () => {
        const body = JSON.stringify({
          sender: { name: FROM_NAME, email: FROM_EMAIL },
          to: [{ email: recipientEmail }],
          subject,
          htmlContent: html,
        });

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY,
          },
          body,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(`Brevo error: ${response.status} ${JSON.stringify(data)}`);
        }

        console.log(`[Email] Sent to ${recipientEmail} (template: ${templateId}, messageId: ${data.messageId})`);
      },
      { maxRetries: 3, baseDelayMs: 2000 }
    );
  }

  _getEmailSubject(templateId, context) {
    const subjects = {
      revision_requested: `Action Required: Please re-upload ${context.fileName || 'document'}`,
      request_published: `New Document Request: ${context.fileName || 'document'}`,
      document_uploaded: `Document Uploaded: ${context.fileName || 'document'}`,
      document_approved: `Document Approved: ${context.fileName || 'document'}`,
      password_reset: 'Reset Your TaxFlow Pro Password',
      client_invite: `You're Invited to TaxFlow Pro`,
      permission_updated: `Access Updated: ${context.resourceName || 'resource'}`,
    };
    return subjects[templateId] || `TaxFlow Pro Notification: ${templateId}`;
  }

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

const emailService = new EmailService();
export default emailService;
