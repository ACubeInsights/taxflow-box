import { describe, it, expect } from 'vitest';
import {
  getCollaborationUserId,
  findCollaborationForUser,
  isBoxNotFoundError,
} from '../../utils/boxCollabUtils.js';

describe('box collaboration helpers', () => {
  it('reads accessibleBy (camelCase) from Box Gen SDK objects', () => {
    expect(getCollaborationUserId({ accessibleBy: { id: '99' } })).toBe('99');
  });

  it('reads accessible_by (snake_case) from raw JSON', () => {
    expect(getCollaborationUserId({ accessible_by: { id: '99' } })).toBe('99');
  });

  it('finds collab with string/number id normalization', () => {
    const collabs = [{ id: 'c1', accessibleBy: { id: 52204089092 }, role: 'viewer' }];
    expect(findCollaborationForUser(collabs, '52204089092')?.id).toBe('c1');
    expect(findCollaborationForUser(collabs, 52204089092)?.id).toBe('c1');
    expect(findCollaborationForUser(collabs, 'other')).toBeNull();
  });

  it('detects Box not_found from status and message', () => {
    expect(isBoxNotFoundError({ statusCode: 404 })).toBe(true);
    expect(isBoxNotFoundError({
      message: '404 "not_found" "Not Found"; Request ID: "abc"',
    })).toBe(true);
    expect(isBoxNotFoundError({ statusCode: 400, message: 'bad' })).toBe(false);
  });
});
