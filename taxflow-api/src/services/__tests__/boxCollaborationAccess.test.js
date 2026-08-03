import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ACCESS_LEVELS,
  ACCESS_TO_BOX_ROLE,
  BOX_ROLE_TO_ACCESS,
  boxRoleToAccessLevel,
  accessLevelToBoxRole,
  BoxCollaborationAccessService,
} from '../boxCollaborationAccessService.js';
import cacheLayer from '../cacheLayer.js';

const mockGetResourceCollaborations = vi.fn();
const mockUpsertUserCollaboration = vi.fn();
const mockRemoveUserCollaboration = vi.fn();
const mockGetFileById = vi.fn();
const mockGetFolderById = vi.fn();

vi.mock('../boxService.js', () => ({
  default: {
    getResourceCollaborations: (...args) => mockGetResourceCollaborations(...args),
    upsertUserCollaboration: (...args) => mockUpsertUserCollaboration(...args),
    removeUserCollaboration: (...args) => mockRemoveUserCollaboration(...args),
    getBoxClient: () => ({
      files: { getFileById: (...args) => mockGetFileById(...args) },
      folders: { getFolderById: (...args) => mockGetFolderById(...args) },
    }),
  },
}));

describe('boxCollaborationAccessService role mapping', () => {
  it('maps app access levels to Box roles', () => {
    expect(accessLevelToBoxRole('viewer')).toBe('viewer');
    expect(accessLevelToBoxRole('commenter')).toBe('previewer');
    expect(accessLevelToBoxRole('writer')).toBe('viewer uploader');
    expect(accessLevelToBoxRole('delete')).toBe('editor');
  });

  it('maps Box roles back to app access levels', () => {
    expect(boxRoleToAccessLevel('viewer')).toBe('viewer');
    expect(boxRoleToAccessLevel('previewer')).toBe('commenter');
    expect(boxRoleToAccessLevel('viewer uploader')).toBe('writer');
    expect(boxRoleToAccessLevel('editor')).toBe('delete');
  });

  it('orders access levels for comparison', () => {
    expect(ACCESS_LEVELS.writer).toBeGreaterThan(ACCESS_LEVELS.viewer);
    expect(ACCESS_LEVELS.delete).toBeGreaterThan(ACCESS_LEVELS.writer);
  });

  it('covers every non-no_access level in ACCESS_TO_BOX_ROLE', () => {
    for (const level of ['viewer', 'commenter', 'writer', 'delete']) {
      expect(ACCESS_TO_BOX_ROLE[level]).toBeDefined();
      expect(BOX_ROLE_TO_ACCESS[ACCESS_TO_BOX_ROLE[level]]).toBeDefined();
    }
  });
});

describe('boxCollaborationAccessService access checks', () => {
  /** @type {BoxCollaborationAccessService} */
  let service;

  beforeEach(async () => {
    await cacheLayer.clear();
    mockGetResourceCollaborations.mockReset();
    mockUpsertUserCollaboration.mockReset();
    mockRemoveUserCollaboration.mockReset();
    mockGetFileById.mockReset();
    mockGetFolderById.mockReset();
    service = new BoxCollaborationAccessService();
  });

  it('hasAccess returns true when Box role meets required level', async () => {
    mockGetResourceCollaborations.mockResolvedValue([
      { id: 'collab-1', role: 'viewer uploader', accessibleBy: { id: 'box-user-1' } },
    ]);

    const allowed = await service.hasAccess('box-user-1', 'folder-1', 'folder', 'writer');
    expect(allowed).toBe(true);
  });

  it('hasAccess matches camelCase accessibleBy and string/number ids', async () => {
    mockGetResourceCollaborations.mockResolvedValue([
      { id: 'collab-1', role: 'viewer', accessibleBy: { id: 52204089092 } },
    ]);

    const allowed = await service.hasAccess('52204089092', 'folder-1', 'folder', 'viewer');
    expect(allowed).toBe(true);
  });

  it('hasAccess returns false when Box role is insufficient', async () => {
    mockGetResourceCollaborations.mockResolvedValue([
      { id: 'collab-1', role: 'viewer', accessibleBy: { id: 'box-user-1' } },
    ]);
    mockGetFileById.mockResolvedValue({ parent: { id: 'folder-parent' } });
    mockGetFolderById.mockResolvedValue({ parent: { id: '0' } });

    const allowed = await service.hasAccess('box-user-1', 'file-1', 'file', 'writer');
    expect(allowed).toBe(false);
  });

  it('inherits folder collaboration for files without direct collab', async () => {
    mockGetResourceCollaborations.mockImplementation(async (resourceId, resourceType) => {
      if (resourceType === 'file' && resourceId === 'file-inherit') return [];
      if (resourceType === 'folder' && resourceId === 'folder-inherit-parent') {
        return [{ id: 'collab-2', role: 'previewer', accessibleBy: { id: 'box-user-1' } }];
      }
      return [];
    });

    mockGetFileById.mockResolvedValue({ parent: { id: 'folder-inherit-parent' } });
    mockGetFolderById.mockResolvedValue({ parent: { id: '0' } });

    const level = await service.resolveEffectiveAccessLevel('box-user-1', 'file-inherit', 'file');
    expect(level).toBe('commenter');
  });

  it('setAccess removes collaboration for no_access', async () => {
    await service.setAccess('box-user-1', 'folder-1', 'folder', 'no_access');
    expect(mockRemoveUserCollaboration).toHaveBeenCalledWith('folder-1', 'folder', 'box-user-1');
  });

  it('setAccess upserts collaboration for granted access', async () => {
    await service.setAccess('box-user-1', 'folder-1', 'folder', 'writer');
    expect(mockUpsertUserCollaboration).toHaveBeenCalledWith(
      'folder-1',
      'folder',
      'box-user-1',
      'viewer uploader'
    );
  });
});
