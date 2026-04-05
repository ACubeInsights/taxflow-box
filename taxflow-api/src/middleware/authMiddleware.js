/**
 * Auth middleware — validates session tokens on protected routes.
 * Attaches req.user with { userId, email, name, role }.
 */

import authService from '../services/authService.js';

/**
 * Requires a valid session. Rejects with 401 if missing/expired.
 */
export function requireAuth(req, res, next) {
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

  const session = authService.validateSession(token);

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
