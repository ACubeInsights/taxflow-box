import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Mock onboardingService before importing the router
vi.mock('../../services/onboardingService.js', () => {
  return {
    default: {
      onboardClient: vi.fn(),
    },
  };
});

import onboardingService from '../../services/onboardingService.js';
import onboardingRouter from '../onboarding.js';

/**
 * Helper: creates a minimal Express app with the onboarding router mounted.
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', onboardingRouter);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });
  return app;
}

/**
 * Lightweight request helper using native fetch against an ephemeral server.
 */
async function request(app, method, path, body) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}

const validBody = {
  clientName: 'Acme Corp',
  externalId: 'ext-001',
  email: 'client@acme.com',
  employeeEmail: 'preparer@firm.com',
  financialYear: '2025',
};

const mockResult = {
  appUser: { userId: 'u-1', login: 'client@acme.com', name: 'Acme Corp', isNew: true },
  folders: { root: 'f-1', year: 'f-2', tax: 'f-3', uploads: 'f-4', supportingDocs: 'f-5', signedDocuments: 'f-6', internalNotes: 'f-7' },
  locks: [{ folderId: 'f-1', lockId: 'l-1', success: true }],
  collaborations: [{ folderId: 'f-4', role: 'viewer_uploader', success: true }],
  webhookId: 'wh-1',
  fileRequestUrl: null,
};

describe('POST /api/onboarding', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 201 with OnboardingResult on success', async () => {
    onboardingService.onboardClient.mockResolvedValue(mockResult);

    const res = await request(app, 'POST', '/api/onboarding', validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockResult);
    expect(onboardingService.onboardClient).toHaveBeenCalledWith(
      'Acme Corp', 'ext-001', 'client@acme.com', 'preparer@firm.com', '2025'
    );
  });

  it('passes undefined financialYear when not provided', async () => {
    onboardingService.onboardClient.mockResolvedValue(mockResult);
    const { financialYear, ...bodyWithoutYear } = validBody;

    const res = await request(app, 'POST', '/api/onboarding', bodyWithoutYear);

    expect(res.status).toBe(201);
    expect(onboardingService.onboardClient).toHaveBeenCalledWith(
      'Acme Corp', 'ext-001', 'client@acme.com', 'preparer@firm.com', undefined
    );
  });

  it('returns 400 when clientName is missing', async () => {
    const { clientName, ...body } = validBody;
    const res = await request(app, 'POST', '/api/onboarding', body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/clientName/);
    expect(onboardingService.onboardClient).not.toHaveBeenCalled();
  });

  it('returns 400 when externalId is missing', async () => {
    const { externalId, ...body } = validBody;
    const res = await request(app, 'POST', '/api/onboarding', body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/externalId/);
    expect(onboardingService.onboardClient).not.toHaveBeenCalled();
  });

  it('returns 400 when email is missing', async () => {
    const { email, ...body } = validBody;
    const res = await request(app, 'POST', '/api/onboarding', body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/);
    expect(onboardingService.onboardClient).not.toHaveBeenCalled();
  });

  it('returns 400 when employeeEmail is missing', async () => {
    const { employeeEmail, ...body } = validBody;
    const res = await request(app, 'POST', '/api/onboarding', body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/employeeEmail/);
    expect(onboardingService.onboardClient).not.toHaveBeenCalled();
  });

  it('returns 400 listing all missing fields when body is empty', async () => {
    const res = await request(app, 'POST', '/api/onboarding', {});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/clientName/);
    expect(res.body.error).toMatch(/externalId/);
    expect(res.body.error).toMatch(/email/);
    expect(res.body.error).toMatch(/employeeEmail/);
    expect(onboardingService.onboardClient).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected service errors', async () => {
    onboardingService.onboardClient.mockRejectedValue(new Error('Box SDK failure'));

    const res = await request(app, 'POST', '/api/onboarding', validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
