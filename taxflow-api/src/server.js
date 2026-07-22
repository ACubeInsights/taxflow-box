import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { initDatabase, shutdownDatabase } from './db/db.js';
import { initRepositories, injectRepositories } from './db/repositories/index.js';
import clientRoutes from './routes/clients.js';
import documentRoutes from './routes/documents.js';
import vaultRoutes from './routes/vaults.js';
import boxService from './services/boxService.js';
import onboardingRoutes from './routes/onboarding.js';
import webhookRoutes from './routes/webhooks.js';
import reviewRoutes from './routes/reviews.js';
import portalRoutes from './routes/portal.js';
import signRoutes from './routes/sign.js';
import tokenRoutes from './routes/tokens.js';
import notificationRoutes, { deepLinkRouter } from './routes/notifications.js';
import complianceRoutes from './routes/compliance.js';
import projectRoutes from './routes/projects.js';
import commentRoutes from './routes/comments.js';
import documentTypeRoutes from './routes/documentTypes.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import inviteRoutes from './routes/invites.js';
import permissionRoutes from './routes/permissions.js';
import collaborationRoutes from './routes/collaborations.js';
import complianceService from './services/complianceService.js';
import aiExtractionService from './services/aiExtractionService.js';
import webhookService from './services/webhookService.js';
import signService from './services/signService.js';
import postUploadPipeline from './services/postUploadPipeline.js';
import { syncTaxflowDocumentTemplate } from './services/metadataTemplateDefinition.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
  let boxHealth;
  try {
    boxHealth = await boxService.healthCheck();
  } catch (err) {
    boxHealth = { connected: false, tier: 'unknown', error: err.message };
  }

  res.json({
    status: boxHealth.connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    box: boxHealth,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api', collaborationRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/vaults', vaultRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/sign', signRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', deepLinkRouter);
app.use('/api/compliance', complianceRoutes);
app.use('/api', projectRoutes);
app.use('/api', commentRoutes);
app.use('/api', documentTypeRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await shutdownDatabase();
  process.exit(0);
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  await shutdownDatabase();
  process.exit(0);
});

async function startServer() {
  try {
    if (config.nodeEnv === 'production' && !config.deepLinkSecret) {
      logger.error('DEEP_LINK_SECRET must be set in production');
      process.exit(1);
    }

    const db = await initDatabase();
    const repos = initRepositories(db);
    injectRepositories(repos);

    await boxService.initialize();

    // Sync taxflow_document metadata template (non-fatal)
    try {
      const client = boxService.getBoxClient();
      await syncTaxflowDocumentTemplate(client);
    } catch (err) {
      logger.warn('Metadata template sync skipped', { error: err.message });
    }

    // Ensure retention policy exists (non-fatal)
    try {
      await complianceService.ensureRetentionPolicy();
    } catch (err) {
      logger.warn('Retention policy setup skipped', { error: err.message });
    }

    // Ensure AI agent exists (non-fatal)
    try {
      await aiExtractionService.ensureAIAgent();
    } catch (err) {
      logger.warn('AI agent setup skipped', { error: err.message });
    }

    // Wire webhook event handlers
    webhookService.registerHandler('FILE.UPLOADED', (event) => postUploadPipeline.processUpload(event));
    webhookService.registerHandler('SIGN_REQUEST.*', (event) => signService.handleSignEvent(event));

    // Verify webhook health on startup (non-fatal)
    try {
      await webhookService.loadFromDb();
      const health = await webhookService.verifyWebhooksHealthy();
      if (health.missing > 0) {
        logger.warn('Webhook health check found missing webhooks', { missing: health.missing, reregistered: health.reregistered });
      } else if (health.total > 0) {
        logger.info('Webhook health check passed', { healthy: health.healthy, total: health.total });
      }
    } catch (err) {
      logger.warn('Webhook health check skipped', { error: err.message });
    }

    app.listen(config.port, () => {
      logger.info('TaxFlow API running', { port: config.port });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer();
