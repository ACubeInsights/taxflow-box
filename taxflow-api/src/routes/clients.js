import express from 'express';
import boxService from '../services/boxService.js';
import vaultDiscoveryService, { mapVaultManifest } from '../services/vaultDiscoveryService.js';
import { config } from '../config.js';
import { requireAuth, requireRole, requireClientAccess } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const vaultCache = new Map();

async function ensureAdminCollaborator(folderId) {
  if (!config.boxAdminEmail) return;
  try {
    await boxService.addCollaborator(folderId, config.boxAdminEmail, 'co-owner');
  } catch (err) {
    logger.warn('Collaborator add skipped:', err.message);
  }
}

router.post('/', requireAuth, requireRole('employee', 'superadmin'), async (req, res, next) => {
  try {
    const { name, externalId, email } = req.body;

    if (!name || !externalId || !email) {
      return res.status(400).json({ error: 'Missing required fields: name, externalId, email' });
    }

    if (vaultCache.has(externalId)) {
      const cached = vaultCache.get(externalId);
      await ensureAdminCollaborator(cached.id);
      return res.json({ vault: cached });
    }

    const existingVault = await boxService.findVaultByExternalId(externalId);
    if (existingVault) {
      vaultCache.set(externalId, existingVault);
      await ensureAdminCollaborator(existingVault.id);
      return res.json({ vault: existingVault });
    }

    const result = await boxService.createClientVault(name, externalId, email);
    await ensureAdminCollaborator(result.folder.id);
    vaultCache.set(externalId, result.folder);

    res.status(201).json({
      vault: result.folder,
      cascadePolicyId: result.metadataCascadePolicyId,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:clientId/vault', requireAuth, requireClientAccess, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const vault = await vaultDiscoveryService.getVaultForClient(clientId);

    if (!vault) {
      return res.status(404).json({ error: 'Client vault not found' });
    }

    await ensureAdminCollaborator(vault.root);
    const payload =
      req.user.role === 'client'
        ? vaultDiscoveryService.sanitizeVaultForClient(mapVaultManifest(vault))
        : mapVaultManifest(vault);
    res.json({ vault: payload });
  } catch (error) {
    next(error);
  }
});

export default router;
