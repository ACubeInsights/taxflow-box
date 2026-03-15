import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import clientRoutes from './routes/clients.js';
import documentRoutes from './routes/documents.js';
import vaultRoutes from './routes/vaults.js';
import boxService from './services/boxService.js';

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
    app.listen(config.port, () => {
      console.log(`TaxFlow API running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
