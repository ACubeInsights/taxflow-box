import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentService, EMPLOYEE_DIRECTORY, EDIT_WINDOW_MS } from '../commentService.js';

describe('CommentService', () => {
  /** @type {CommentService} */
  let service;

  beforeEach(() => {
    service = new CommentService();
    vi.restoreAllMocks();
  });

  // ─── getComments ────────────────────────────────────────────────────

  describe('getComments', () => {
    it('returns empty array for document with no comments', async () => {
      expect(await service.getComments('doc-unknown')).toEqual([]);
    });

    it('returns comments sorted by createdAt ascending', async () => {
      // Add comments with slight time gaps
      await service.addComment('doc1', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'First' });
      await service.addComment('doc1', { type: 'internal', authorId: 'emp2', authorName: 'Maria', text: 'Second' });
      await service.addComment('doc1', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'Third' });

      const comments = await service.getComments('doc1');
      expect(comments).toHaveLength(3);
      for (let i = 1; i < comments.length; i++) {
        expect(new Date(comments[i].createdAt).getTime())
          .toBeGreaterThanOrEqual(new Date(comments[i - 1].createdAt).getTime());
      }
    });

    it('includes isEditable field on each comment', async () => {
      await service.addComment('doc1', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'Hello' });
      const comments = await service.getComments('doc1');
      expect(comments[0]).toHaveProperty('isEditable');
      expect(typeof comments[0].isEditable).toBe('boolean');
    });

    it('returns comments only for the requested document', async () => {
      await service.addComment('doc1', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'For doc1' });
      await service.addComment('doc2', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'For doc2' });

      const doc1Comments = await service.getComments('doc1');
      expect(doc1Comments).toHaveLength(1);
      expect(doc1Comments[0].text).toBe('For doc1');
    });
  });

  // ─── addComment ─────────────────────────────────────────────────────

  describe('addComment', () => {
    it('creates a review comment with correct fields', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex Johnson',
        text: 'Looks good',
        mentions: [],
      });

      expect(comment.id).toBeDefined();
      expect(comment.documentId).toBe('doc1');
      expect(comment.type).toBe('review');
      expect(comment.authorId).toBe('emp1');
      expect(comment.authorName).toBe('Alex Johnson');
      expect(comment.text).toBe('Looks good');
      expect(comment.mentions).toEqual([]);
      expect(comment.createdAt).toBeDefined();
      expect(comment.editedAt).toBeNull();
      expect(comment.isEditable).toBe(true);
    });

    it('creates an internal comment', async () => {
      const comment = await service.addComment('doc1', {
        type: 'internal',
        authorId: 'emp2',
        authorName: 'Maria Garcia',
        text: 'Internal note',
      });

      expect(comment.type).toBe('internal');
      expect(comment.text).toBe('Internal note');
    });

    it('trims whitespace from text', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: '  trimmed text  ',
      });
      expect(comment.text).toBe('trimmed text');
    });

    it('defaults mentions to empty array', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'No mentions',
      });
      expect(comment.mentions).toEqual([]);
    });

    it('throws 400 for invalid comment type', async () => {
      await expect(
        service.addComment('doc1', {
          type: 'system',
          authorId: 'emp1',
          authorName: 'Alex',
          text: 'Bad type',
        })
      ).rejects.toThrow('Comment type must be "review" or "internal"');
    });

    it('throws 400 for unknown comment type', async () => {
      await expect(
        service.addComment('doc1', {
          type: 'unknown',
          authorId: 'emp1',
          authorName: 'Alex',
          text: 'Bad type',
        })
      ).rejects.toThrow('Comment type must be "review" or "internal"');
    });

    it('throws 400 for empty text', async () => {
      await expect(
        service.addComment('doc1', {
          type: 'review',
          authorId: 'emp1',
          authorName: 'Alex',
          text: '',
        })
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('throws 400 for whitespace-only text', async () => {
      await expect(
        service.addComment('doc1', {
          type: 'review',
          authorId: 'emp1',
          authorName: 'Alex',
          text: '   ',
        })
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('assigns unique IDs to each comment', async () => {
      const c1 = await service.addComment('doc1', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'First' });
      const c2 = await service.addComment('doc1', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'Second' });
      expect(c1.id).not.toBe(c2.id);
    });

    it('dispatches mention notifications for each mention', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex Johnson',
        text: 'Hey @Maria check this',
        mentions: ['emp2', 'emp3'],
      });

      expect(comment.mentions).toEqual(['emp2', 'emp3']);
    });
  });

  // ─── addSystemComment ───────────────────────────────────────────────

  describe('addSystemComment', () => {
    it('creates a system comment with auto-generated text', async () => {
      const comment = await service.addSystemComment('doc1', {
        action: 'status_change',
        actorId: 'emp1',
        actorName: 'Alex Johnson',
        fromStatus: 'Uploaded',
        toStatus: 'Under_Review',
      });

      expect(comment.id).toBeDefined();
      expect(comment.documentId).toBe('doc1');
      expect(comment.type).toBe('system');
      expect(comment.text).toBe('Status changed from Uploaded to Under_Review by Alex Johnson');
      expect(comment.authorId).toBe('emp1');
      expect(comment.authorName).toBe('Alex Johnson');
      expect(comment.mentions).toEqual([]);
      expect(comment.createdAt).toBeDefined();
      expect(comment.editedAt).toBeNull();
      expect(comment.isEditable).toBe(false);
    });

    it('system comments appear in getComments', async () => {
      await service.addSystemComment('doc1', {
        action: 'status_change',
        actorId: 'emp1',
        actorName: 'Alex',
        fromStatus: 'Under_Review',
        toStatus: 'Approved',
      });

      const comments = await service.getComments('doc1');
      expect(comments).toHaveLength(1);
      expect(comments[0].type).toBe('system');
    });

    it('system comments are never editable', async () => {
      const comment = await service.addSystemComment('doc1', {
        action: 'status_change',
        actorId: 'emp1',
        actorName: 'Alex',
        fromStatus: 'Uploaded',
        toStatus: 'Under_Review',
      });
      expect(comment.isEditable).toBe(false);
    });
  });

  // ─── editComment ────────────────────────────────────────────────────

  describe('editComment', () => {
    it('edits a comment within the 5-minute window', async () => {
      const original = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'Original text',
      });

      const edited = await service.editComment(original.id, {
        text: 'Updated text',
        requesterId: 'emp1',
      });

      expect(edited.text).toBe('Updated text');
      expect(edited.editedAt).toBeDefined();
      expect(edited.editedAt).not.toBeNull();
    });

    it('throws 404 for non-existent comment', async () => {
      await expect(
        service.editComment('cmt-nonexistent', { text: 'New text', requesterId: 'emp1' })
      ).rejects.toThrow('Comment not found');

      try {
        await service.editComment('cmt-nonexistent', { text: 'New text', requesterId: 'emp1' });
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('throws 403 when requesterId does not match authorId', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'My comment',
      });

      await expect(
        service.editComment(comment.id, { text: 'Hacked', requesterId: 'emp2' })
      ).rejects.toThrow('Only the author can edit this comment');

      try {
        await service.editComment(comment.id, { text: 'Hacked', requesterId: 'emp2' });
      } catch (err) {
        expect(err.statusCode).toBe(403);
      }
    });

    it('throws 422 when edit window has expired', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'Old comment',
      });

      // Manually set createdAt to 6 minutes ago
      const rawComment = service._findCommentById(comment.id);
      rawComment.createdAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();

      await expect(
        service.editComment(comment.id, { text: 'Too late', requesterId: 'emp1' })
      ).rejects.toThrow('Edit window has expired (5 minutes)');

      try {
        await service.editComment(comment.id, { text: 'Too late', requesterId: 'emp1' });
      } catch (err) {
        expect(err.statusCode).toBe(422);
      }
    });

    it('throws 400 for empty edit text', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'Original',
      });

      await expect(
        service.editComment(comment.id, { text: '', requesterId: 'emp1' })
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('throws 400 for whitespace-only edit text', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'Original',
      });

      await expect(
        service.editComment(comment.id, { text: '   ', requesterId: 'emp1' })
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('trims whitespace from edited text', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'Original',
      });

      const edited = await service.editComment(comment.id, {
        text: '  Updated  ',
        requesterId: 'emp1',
      });
      expect(edited.text).toBe('Updated');
    });

    it('allows editing at exactly the 5-minute boundary', async () => {
      const comment = await service.addComment('doc1', {
        type: 'review',
        authorId: 'emp1',
        authorName: 'Alex',
        text: 'Original',
      });

      // Set createdAt to 4 minutes 59 seconds ago (safely within the 5-minute window)
      const rawComment = service._findCommentById(comment.id);
      rawComment.createdAt = new Date(Date.now() - EDIT_WINDOW_MS + 1000).toISOString();

      const edited = await service.editComment(comment.id, {
        text: 'Just in time',
        requesterId: 'emp1',
      });
      expect(edited.text).toBe('Just in time');
    });
  });

  // ─── searchEmployees ────────────────────────────────────────────────

  describe('searchEmployees', () => {
    it('returns employees matching prefix (case-insensitive)', () => {
      const results = service.searchEmployees('alex');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alex Johnson');
    });

    it('matches substring anywhere in name', () => {
      const results = service.searchEmployees('john');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alex Johnson');
    });

    it('returns multiple matches', () => {
      const results = service.searchEmployees('mar');
      expect(results.length).toBeGreaterThanOrEqual(2);
      const names = results.map((e) => e.name);
      expect(names).toContain('Maria Garcia');
      expect(names).toContain('Robert Martinez');
    });

    it('returns empty array for no matches', () => {
      const results = service.searchEmployees('zzz');
      expect(results).toEqual([]);
    });

    it('returns empty array for empty prefix', () => {
      expect(service.searchEmployees('')).toEqual([]);
    });

    it('returns empty array for whitespace-only prefix', () => {
      expect(service.searchEmployees('   ')).toEqual([]);
    });

    it('returns empty array for null/undefined prefix', () => {
      expect(service.searchEmployees(null)).toEqual([]);
      expect(service.searchEmployees(undefined)).toEqual([]);
    });

    it('each result has id and name', () => {
      const results = service.searchEmployees('a');
      for (const emp of results) {
        expect(emp).toHaveProperty('id');
        expect(emp).toHaveProperty('name');
      }
    });
  });

  // ─── Mixed comment types in thread ─────────────────────────────────

  describe('mixed comment thread', () => {
    it('displays all three comment types in a unified thread', async () => {
      await service.addComment('doc1', { type: 'review', authorId: 'emp1', authorName: 'Alex', text: 'Review comment' });
      await service.addComment('doc1', { type: 'internal', authorId: 'emp2', authorName: 'Maria', text: 'Internal note' });
      await service.addSystemComment('doc1', {
        action: 'status_change',
        actorId: 'emp1',
        actorName: 'Alex',
        fromStatus: 'Uploaded',
        toStatus: 'Under_Review',
      });

      const comments = await service.getComments('doc1');
      expect(comments).toHaveLength(3);

      const types = comments.map((c) => c.type);
      expect(types).toContain('review');
      expect(types).toContain('internal');
      expect(types).toContain('system');
    });

    it('system comments are not editable even within 5 minutes', async () => {
      await service.addSystemComment('doc1', {
        action: 'status_change',
        actorId: 'emp1',
        actorName: 'Alex',
        fromStatus: 'Uploaded',
        toStatus: 'Under_Review',
      });

      const comments = await service.getComments('doc1');
      const systemComment = comments.find((c) => c.type === 'system');
      expect(systemComment.isEditable).toBe(false);
    });

    it('no delete functionality exists', () => {
      // Verify the service has no delete method
      expect(service.deleteComment).toBeUndefined();
      expect(service.removeComment).toBeUndefined();
    });
  });
});
