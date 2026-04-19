/**
 * Auth middleware — validates session tokens on protected routes.
 * Attaches req.user with { userId, email, name, role }.
 */

import authService from '../services/authService.js';
import { getRepositories } from '../db/repositories/index.js';

/**
 * Requires a valid session. Rejects with 401 if missing/expired.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);

  // Support demo/mock tokens (format: mock-token-{role}-{timestamp})
  const mockMatch = token.match(/^mock-token-(superadmin|cxo|employee|client)-/);
  if (mockMatch) {
    req.user = {
      userId: `demo-${mockMatch[1]}`,
      email: `${mockMatch[1]}@demo.taxflow`,
      name: `Demo ${mockMatch[1]}`,
      role: mockMatch[1],
    };
    return next();
  }

  const session = await authService.validateSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  req.user = {
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
  };

  next();
}

/**
 * Requires one of the specified roles. Must be used after requireAuth.
 * @param  {...string} roles - Allowed roles (e.g., 'superadmin', 'employee')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Validates that the requested folderId belongs to the authenticated client's vault.
 * Only allows access to uploads_folder_id, tax_folder_id, and signed_documents_folder_id.
 * Must be used after requireAuth.
 */
export async function validateFolderOwnership(req, res, next) {
  try {
    let repos;
    try {
      repos = getRepositories();
    } catch {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    const { clientRepo, clientVaultRepo } = repos;
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Look up the client record — try by ID, then by Box user ID, then by email
    let client = await clientRepo.findById(userId);
    if (!client) {
      client = await clientRepo.findByBoxUserId(userId);
    }
    if (!client && userEmail) {
      client = await clientRepo.findByEmail(userEmail);
    }

    if (!client) {
      return res.status(404).json({ error: 'Client vault not found' });
    }

    // Look up the vault record using the client's ID
    const vault = await clientVaultRepo.findByClientId(client.id);
    if (!vault) {
      return res.status(404).json({ error: 'Client vault not found' });
    }

    // Check if the requested folder ID matches one of the three allowed folders
    const folderId = req.params.folderId;
    const allowedFolderIds = [
      vault.uploads_folder_id,
      vault.tax_folder_id,
      vault.signed_documents_folder_id,
    ].filter(Boolean);

    if (!allowedFolderIds.includes(folderId)) {
      return res.status(403).json({ error: 'Access denied: folder does not belong to your vault' });
    }

    // Attach vault to request for downstream use
    req.clientVault = vault;
    next();
  } catch (err) {
    next(err);
  }
}
