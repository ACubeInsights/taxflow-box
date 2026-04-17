import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const boxConfigPath = process.env.BOX_CONFIG_PATH || './box_config.json';

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  boxConfigPath: resolve(__dirname, '../', boxConfigPath),
  boxRootFolderId: process.env.BOX_ROOT_FOLDER_ID || '0',
  boxEnterpriseId: process.env.BOX_ENTERPRISE_ID || '',
  boxAdminEmail: process.env.BOX_ADMIN_EMAIL || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Webhooks
  webhookEndpointUrl: process.env.WEBHOOK_ENDPOINT_URL || 'https://localhost:3001/api/webhooks/box',

  // Deep Links
  deepLinkSecret: process.env.DEEP_LINK_SECRET || '',
  deepLinkExpiryHours: parseInt(process.env.DEEP_LINK_EXPIRY_HOURS || '72'),

  // Notifications
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@taxflowpro.com',

  // Rate Limiting
  maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
  maxQueueDepth: parseInt(process.env.MAX_QUEUE_DEPTH || '1000'),

  // Circuit Breaker
  circuitBreakerWindowMs: parseInt(process.env.CB_WINDOW_MS || '60000'),
  circuitBreakerThreshold: parseFloat(process.env.CB_THRESHOLD || '0.5'),
  circuitBreakerCooldownMs: parseInt(process.env.CB_COOLDOWN_MS || '30000'),

  // Inactive Detection
  inactiveThresholdDays: parseInt(process.env.INACTIVE_THRESHOLD_DAYS || '30'),

  // Upload
  chunkSizeMb: parseInt(process.env.CHUNK_SIZE_MB || '8'),
  chunkedUploadThresholdMb: parseInt(process.env.CHUNKED_UPLOAD_THRESHOLD_MB || '50'),

  // Box Sign
  signRedirectUrl: process.env.SIGN_REDIRECT_URL || 'http://localhost:5173/sign/complete',
  signDeclinedRedirectUrl: process.env.SIGN_DECLINED_REDIRECT_URL || 'http://localhost:5173/sign/declined',

  // File Request
  fileRequestTemplateId: process.env.FILE_REQUEST_TEMPLATE_ID || '',

  // AI
  aiConfidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.6'),

  // SMTP (Nodemailer)
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'noreply@taxflowpro.com',
};
