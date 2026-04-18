/**
 * CommentService — Threaded comment system with type labeling, edit windows, and @mention support.
 *
 * Supports two modes:
 *   1. DB-backed: Uses CommentRepository
 *   2. In-memory fallback: Uses Map (for tests or when DB is not initialized)
 *
 * Requirements: 16.4, 16.7, 10.1-10.9
 */

import notificationService from './notificationService.js';
import { createHttpError } from '../utils/httpError.js';

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Static employee directory for @mention autocomplete */
const EMPLOYEE_DIRECTORY = [
  { id: 'emp1', name: 'Alex Johnson' },
  { id: 'emp2', name: 'Maria Garcia' },
  { id: 'emp3', name: 'James Wilson' },
  { id: 'emp4', name: 'Sarah Chen' },
  { id: 'emp5', name: 'Michael Brown' },
  { id: 'emp6', name: 'Emily Davis' },
  { id: 'emp7', name: 'Robert Martinez' },
  { id: 'emp8', name: 'Jennifer Lee' },
];

export class CommentService {
  constructor() {
    /** @type {Map<string, object[]>} documentId → Comment[] */
    this._comments = new Map();
    this._idCounter = 0;

    /** @type {import('../db/repositories/CommentRepository.js').CommentRepository | null} */
    this._commentRepo = null;
  }

  /**
   * Injects repository dependencies. Called after DB initialization.
   * @param {{ commentRepo?: object }} repos
   */
  setRepositories({ commentRepo } = {}) {
    if (commentRepo) this._commentRepo = commentRepo;
  }

  /**
   * Returns comments for a document sorted by createdAt ascending.
   */
  async getComments(documentId) {
    if (this._commentRepo) {
      const comments = await this._commentRepo.findByDocumentId(documentId);
      return comments.map((c) => ({
        ...this._mapCommentFromDb(c),
        isEditable: this._isEditableDb(c),
      }));
    }

    const comments = this._comments.get(documentId) || [];
    return comments
      .map((c) => ({ ...c, isEditable: this._isEditable(c) }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  /**
   * Adds a review or internal comment to a document.
   */
  async addComment(documentId, { type, authorId, authorName, text, mentions = [] }) {
    if (type !== 'review' && type !== 'internal') {
      throw createHttpError('Comment type must be "review" or "internal"', 400);
    }

    if (!text || !text.trim()) {
      throw createHttpError('Comment text cannot be empty', 400);
    }

    const now = new Date().toISOString();
    const mentionsArr = Array.isArray(mentions) ? mentions : [];

    if (this._commentRepo) {
      const comment = await this._commentRepo.create({
        document_id: documentId,
        type,
        author_id: authorId,
        author_name: authorName || '',
        text: text.trim(),
        mentions: mentionsArr,
      });

      // Dispatch mention notifications
      for (const mentionedId of mentionsArr) {
        try {
          notificationService.dispatch('mention', mentionedId, {
            fileId: documentId,
            fileName: `Comment by ${authorName}`,
            clientId: '',
            message: `${authorName} mentioned you in a comment`,
          });
        } catch (err) {
          console.error(`Failed to dispatch mention notification for ${mentionedId}:`, err.message);
        }
      }

      return {
        ...this._mapCommentFromDb(comment),
        isEditable: this._isEditableDb(comment),
      };
    }

    // In-memory fallback
    const id = `cmt-${++this._idCounter}`;

    const comment = {
      id,
      documentId,
      type,
      authorId,
      authorName: authorName || '',
      text: text.trim(),
      mentions: mentionsArr,
      createdAt: now,
      editedAt: null,
    };

    if (!this._comments.has(documentId)) {
      this._comments.set(documentId, []);
    }
    this._comments.get(documentId).push(comment);

    // Dispatch mention notifications
    for (const mentionedId of comment.mentions) {
      try {
        notificationService.dispatch('mention', mentionedId, {
          fileId: documentId,
          fileName: `Comment by ${authorName}`,
          clientId: '',
          message: `${authorName} mentioned you in a comment`,
        });
      } catch (err) {
        console.error(`Failed to dispatch mention notification for ${mentionedId}:`, err.message);
      }
    }

    return { ...comment, isEditable: this._isEditable(comment) };
  }

  /**
   * Auto-generates a system comment on status transition.
   */
  async addSystemComment(documentId, { action, actorId, actorName, fromStatus, toStatus }) {
    const text = `Status changed from ${fromStatus} to ${toStatus} by ${actorName}`;

    if (this._commentRepo) {
      const comment = await this._commentRepo.create({
        document_id: documentId,
        type: 'system',
        author_id: actorId,
        author_name: actorName,
        text,
        mentions: [],
      });

      return { ...this._mapCommentFromDb(comment), isEditable: false };
    }

    // In-memory fallback
    const now = new Date().toISOString();
    const id = `cmt-${++this._idCounter}`;

    const comment = {
      id,
      documentId,
      type: 'system',
      authorId: actorId,
      authorName: actorName,
      text,
      mentions: [],
      createdAt: now,
      editedAt: null,
    };

    if (!this._comments.has(documentId)) {
      this._comments.set(documentId, []);
    }
    this._comments.get(documentId).push(comment);

    return { ...comment, isEditable: false };
  }

  /**
   * Edits a comment within the 5-minute edit window (author-only).
   */
  async editComment(commentId, { text, requesterId }) {
    if (this._commentRepo) {
      const comment = await this._commentRepo.findById(commentId);
      if (!comment) {
        throw createHttpError('Comment not found', 404);
      }

      if (comment.author_id !== requesterId) {
        throw createHttpError('Only the author can edit this comment', 403);
      }

      const elapsed = Date.now() - new Date(comment.created_at).getTime();
      if (elapsed > EDIT_WINDOW_MS) {
        throw createHttpError('Edit window has expired (5 minutes)', 422);
      }

      if (!text || !text.trim()) {
        throw createHttpError('Comment text cannot be empty', 400);
      }

      await this._commentRepo.updateText(commentId, text.trim());
      const updated = await this._commentRepo.findById(commentId);

      return {
        ...this._mapCommentFromDb(updated),
        isEditable: this._isEditableDb(updated),
      };
    }

    // In-memory fallback
    const comment = this._findCommentById(commentId);

    if (!comment) {
      throw createHttpError('Comment not found', 404);
    }

    if (comment.authorId !== requesterId) {
      throw createHttpError('Only the author can edit this comment', 403);
    }

    const elapsed = Date.now() - new Date(comment.createdAt).getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      throw createHttpError('Edit window has expired (5 minutes)', 422);
    }

    if (!text || !text.trim()) {
      throw createHttpError('Comment text cannot be empty', 400);
    }

    comment.text = text.trim();
    comment.editedAt = new Date().toISOString();

    return { ...comment, isEditable: this._isEditable(comment) };
  }

  /**
   * Returns employee names matching a prefix (case-insensitive substring match).
   */
  searchEmployees(prefix) {
    if (!prefix || !prefix.trim()) {
      return [];
    }
    const query = prefix.toLowerCase();
    return EMPLOYEE_DIRECTORY.filter((emp) =>
      emp.name.toLowerCase().includes(query)
    );
  }

  // ─── DB → App mapping helpers ─────────────────────────────────────

  _mapCommentFromDb(c) {
    return {
      id: c.id,
      documentId: c.document_id,
      type: c.type,
      authorId: c.author_id,
      authorName: c.author_name,
      text: c.text,
      mentions: c.mentions || [],
      createdAt: c.created_at,
      editedAt: c.edited_at,
    };
  }

  _isEditableDb(comment) {
    if (comment.type === 'system') return false;
    const elapsed = Date.now() - new Date(comment.created_at).getTime();
    return elapsed <= EDIT_WINDOW_MS;
  }

  // ─── Internal helpers (in-memory fallback) ────────────────────────

  _findCommentById(commentId) {
    for (const comments of this._comments.values()) {
      const found = comments.find((c) => c.id === commentId);
      if (found) return found;
    }
    return null;
  }

  _isEditable(comment) {
    if (comment.type === 'system') return false;
    const elapsed = Date.now() - new Date(comment.createdAt).getTime();
    return elapsed <= EDIT_WINDOW_MS;
  }
}

// Singleton instance
const commentService = new CommentService();
export { EMPLOYEE_DIRECTORY, EDIT_WINDOW_MS };
export default commentService;
