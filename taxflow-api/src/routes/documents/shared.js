/**
 * Shared helpers and multer config for document routes.
 */

import multer from 'multer';
import boxService, { BoxService } from '../../services/boxService.js';
import { getDb } from '../../db/db.js';
import { requireAuth, requireRole, permissionCheck, validateFolderOwnership, validateUploadFolder } from '../../middleware/authMiddleware.js';
import { config } from '../../config.js';
import cacheLayer from '../../services/cacheLayer.js';
import projectService from '../../services/projectService.js';
import boxDocumentStatusService from '../../services/boxDocumentStatusService.js';
import boxDocumentRequestService from '../../services/boxDocumentRequestService.js';
import { isBoxFirstSchema } from '../../db/schemaMode.js';
import vaultResourceGuard from '../../services/vaultResourceGuard.js';
import notificationService from '../../services/notificationService.js';
import { getRepositories } from '../../db/repositories/index.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { Readable } from 'stream';

/**
 * Resolve staff user IDs who should be notified of a client upload.
 */
export async function resolveStaffUploadRecipients(clientId, createdBy) {
  const ids = new Set();
  let repos;
  try {
    repos = getRepositories();
  } catch {
    if (createdBy) ids.add(createdBy);
    return [...ids];
  }

  if (createdBy) {
    if (String(createdBy).includes('@') && repos.userRepo?.findByEmail) {
      const user = await repos.userRepo.findByEmail(createdBy);
      if (user?.id) ids.add(user.id);
    } else {
      ids.add(createdBy);
    }
  }

  if (clientId && repos.clientRepo && repos.inviteRepo && repos.userRepo) {
    try {
      const client = await repos.clientRepo.findById(clientId);
      if (client?.email) {
        const invite = await repos.inviteRepo.findByEmail(client.email);
        const empEmail = invite?.employee_email;
        if (empEmail) {
          const emp = await repos.userRepo.findByEmail(empEmail);
          if (emp?.id) ids.add(emp.id);
        }
      }
    } catch (err) {
      logger.warn('Could not resolve invite employee for upload notify', { error: err.message });
    }
  }

  if (ids.size === 0 && repos.userRepo?.findByRole) {
    try {
      const employees = await repos.userRepo.findByRole('employee');
      for (const u of employees || []) {
        if (u.id) ids.add(u.id);
      }
    } catch {
      /* ignore */
    }
  }

  return [...ids];
}
/** Staff must only touch files inside known client vaults */
export async function assertStaffVaultFile(req, res, next) {
  try {
    if (['employee', 'superadmin'].includes(req.user?.role)) {
      await vaultResourceGuard.assertKnownVaultFile(req.params.fileId);
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Upload temp directory
export const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'taxflow-uploads');
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

/**
 * Safe disk filename: UUID + optional sanitized extension from original name.
 * Never uses path segments from client-supplied originalname.
 */
export function safeUploadFilename(originalname) {
  const ext = path.extname(originalname || '').replace(/[^\w.]/g, '').slice(0, 16);
  const base = crypto.randomUUID();
  return ext ? `${base}${ext}` : base;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_TEMP_DIR),
  filename: (req, file, cb) => {
    const safeName = safeUploadFilename(file.originalname);
    cb(null, safeName);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB (Box Enterprise limit)
  },
});

export {
  boxService,
  BoxService,
  getDb,
  requireAuth,
  requireRole,
  permissionCheck,
  validateFolderOwnership,
  validateUploadFolder,
  config,
  cacheLayer,
  projectService,
  boxDocumentStatusService,
  boxDocumentRequestService,
  isBoxFirstSchema,
  vaultResourceGuard,
  notificationService,
  getRepositories,
  logger,
  fs,
  path,
  os,
  crypto,
  Readable,
};
