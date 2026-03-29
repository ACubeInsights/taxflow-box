import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
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
import complianceService from './services/complianceService.js';
import aiExtractionService from './services/aiExtractionService.js';
import webhookService from './services/webhookService.js';
import signService from './services/signService.js';
import postUploadPipeline from './services/postUploadPipeline.js';
import { syncTaxflowDocumentTemplate } from './services/metadataTemplateDefinition.js';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    await boxService.initialize();

    // Sync taxflow_document metadata template (non-fatal)
    try {
      const client = boxService.getBoxClient();
      await syncTaxflowDocumentTemplate(client);
    } catch (err) {
      console.warn('Metadata template sync skipped:', err.message);
    }

    // Ensure retention policy exists (non-fatal)
    try {
      await complianceService.ensureRetentionPolicy();
    } catch (err) {
      console.warn('Retention policy setup skipped:', err.message);
    }

    // Ensure AI agent exists (non-fatal)
    try {
      await aiExtractionService.ensureAIAgent();
    } catch (err) {
      console.warn('AI agent setup skipped:', err.message);
    }

    // Wire webhook event handlers
    webhookService.registerHandler('FILE.UPLOADED', (event) => postUploadPipeline.processUpload(event));
    webhookService.registerHandler('SIGN_REQUEST.*', (event) => signService.handleSignEvent(event));

    app.listen(config.port, () => {
      console.log(`TaxFlow API running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
