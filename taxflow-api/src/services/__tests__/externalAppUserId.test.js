/**
 * Tests for externalAppUserId format in onboarding and employee creation.
 *
 * Verifies:
 * - New users get "taxflow:{uuid}" format (no credentials)
 * - Legacy format detection works for backward compatibility
 * - DB user ID is generated and passed through correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingService } from '../onboardingService.js';
import { EmployeeService } from '../employeeService.js';
import { buildExternalId, extractDbUserId, isLegacyExternalId } from '../../utils/authUtils.js';

// Mock boxService
vi.mock('../boxService.js', () => ({
  default: {
    getBoxClient: () => mockBoxClient,
    getTier: () => 'enterprise',
  },
}));

// Mock webhookService
vi.mock('../webhookService.js', () => ({
  default: {
    registerWebhook: vi.fn().mockResolvedValue({ webhookId: 'wh-1', primaryKey: 'pk', secondaryKey: 'sk' }),
  },
}));

let mockBoxClient;
let capturedCreateBody;

beforeEach(() => {
  capturedCreateBody = null;
  mockBoxClient = {
    users: {
      createUser: vi.fn().mockImplementation((body) => {
        capturedCreateBody = body;
        return Promise.resolve({
          id: 'box-user-123',
          login: body.login || 'test@example.com',
          name: body.name || 'Test User',
        });
      }),
      getUsers: vi.fn().mockResolvedValue({ entries: [] }),
    },
    folders: {
      createFolder: vi.fn().mockResolvedValue({ id: 'folder-1', name: 'Test' }),
      getFolderItems: vi.fn().mockResolvedValue({ entries: [] }),
    },
    folderLocks: {
      createFolderLock: vi.fn().mockResolvedValue({ id: 'lock-1' }),
    },
    userCollaborations: {
      createCollaboration: vi.fn().mockResolvedValue({ id: 'collab-1' }),
    },
    webhooks: {
      createWebhook: vi.fn().mockResolvedValue({ id: 'wh-1', primary_signature_key: 'pk', secondary_signature_key: 'sk' }),
    },
  };
});

describe('OnboardingService.createAppUser — externalAppUserId format', () => {
  it('sets externalAppUserId to taxflow:{uuid} format (no credentials)', async () => {
    const service = new OnboardingService();
    const result = await service.createAppUser('John Smith', 'john@example.com', undefined, 'SecurePass123');

    expect(capturedCreateBody).toBeDefined();
    expect(capturedCreateBody.externalAppUserId).toMatch(/^taxflow:[0-9a-f-]{36}$/);
    // Verify no password or email data in the field
    expect(capturedCreateBody.externalAppUserId).not.toContain('pw:');
    expect(capturedCreateBody.externalAppUserId).not.toContain('|em:');
    expect(capturedCreateBody.externalAppUserId).not.toContain('|role:');
    expect(capturedCreateBody.externalAppUserId).not.toContain('SecurePass123');
    expect(capturedCreateBody.externalAppUserId).not.toContain('john@example.com');
  });

  it('returns dbUserId that matches the UUID in externalAppUserId', async () => {
    const service = new OnboardingService();
    const result = await service.createAppUser('Jane Doe', 'jane@example.com', undefined, 'Pass456');

    const extractedId = extractDbUserId(capturedCreateBody.externalAppUserId);
    expect(extractedId).toBe(result.dbUserId);
  });

  it('accepts a pre-generated dbUserId', async () => {
    const service = new OnboardingService();
    const preGeneratedId = 'custom-uuid-1234-5678';
    const result = await service.createAppUser('Bob', 'bob@test.com', undefined, 'Pass', preGeneratedId);

    expect(capturedCreateBody.externalAppUserId).toBe('taxflow:custom-uuid-1234-5678');
    expect(result.dbUserId).toBe(preGeneratedId);
  });

  it('does not include login field as password', async () => {
    const service = new OnboardingService();
    await service.createAppUser('Test', 'test@test.com', undefined, 'MyPassword!');

    // The password should NEVER appear anywhere in the Box API call body
    const bodyStr = JSON.stringify(capturedCreateBody);
    expect(bodyStr).not.toContain('MyPassword!');
  });
});

describe('EmployeeService.createEmployee — externalAppUserId format', () => {
  it('sets externalAppUserId to taxflow:{uuid} format (no credentials)', async () => {
    const service = new EmployeeService();
    const result = await service.createEmployee('Alice Admin', 'alice@firm.com', 'user', 'AdminPass');

    expect(capturedCreateBody).toBeDefined();
    expect(capturedCreateBody.externalAppUserId).toMatch(/^taxflow:[0-9a-f-]{36}$/);
    expect(capturedCreateBody.externalAppUserId).not.toContain('pw:');
    expect(capturedCreateBody.externalAppUserId).not.toContain('AdminPass');
    expect(capturedCreateBody.externalAppUserId).not.toContain('alice@firm.com');
  });

  it('returns dbUserId matching the externalAppUserId UUID', async () => {
    const service = new EmployeeService();
    const result = await service.createEmployee('Bob Builder', 'bob@firm.com', 'user', 'BuilderPass');

    const extractedId = extractDbUserId(capturedCreateBody.externalAppUserId);
    expect(extractedId).toBe(result.dbUserId);
  });
});

describe('buildExternalId — new format', () => {
  it('produces taxflow:{id} format', () => {
    const result = buildExternalId('abc-123');
    expect(result).toBe('taxflow:abc-123');
  });

  it('is NOT detected as legacy format', () => {
    const result = buildExternalId('some-uuid');
    expect(isLegacyExternalId(result)).toBe(false);
  });

  it('extractDbUserId round-trips correctly', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const extId = buildExternalId(uuid);
    expect(extractDbUserId(extId)).toBe(uuid);
  });
});
