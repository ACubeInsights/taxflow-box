/**
 * CommentService — Threaded comment system with type labeling, edit windows, and @mention support.
 *
 * - getComments: Returns comments for a document sorted by createdAt ascending
 * - addComment: Adds a review or internal comment with optional @mentions
 * - addSystemComment: Auto-generates system comments on status transitions
 * - editComment: Edits a comment within 5-minute window (author-only)
 * - searchEmployees: Returns employee names matching a prefix for @mention autocomplete
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9
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
  }

  /**
   * Returns comments for a document sorted by createdAt ascending.
   * (Req 10.1)
   *
   * @param {string} documentId
   * @returns {object[]} Comment[]
   */
  getComments(documentId) {
    const comments = this._comments.get(documentId) || [];
    return comments
      .map((c) => ({ ...c, isEditable: this._isEditable(c) }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  /**
   * Adds a review or internal comment to a document.
   * Dispatches mention notifications for each @mention. (Reqs 10.2, 10.3, 10.6)
   *
   * @param {string} documentId
   * @param {{ type: string, authorId: string, authorName: string, text: string, mentions?: string[] }} data
   * @returns {object} Created Comment
   */
  addComment(documentId, { type, authorId, authorName, text, mentions = [] }) {
    if (type !== 'review' && type !== 'internal') {
      throw createHttpError('Comment type must be "review" or "internal"', 400);
    }

    if (!text || !text.trim()) {
      throw createHttpError('Comment text cannot be empty', 400);
    }

    const now = new Date().toISOString();
    const id = `cmt-${++this._idCounter}`;

    const comment = {
      id,
      documentId,
      type,
      authorId,
      authorName: authorName || '',
      text: text.trim(),
      mentions: Array.isArray(mentions) ? mentions : [],
      createdAt: now,
      editedAt: null,
    };

    if (!this._comments.has(documentId)) {
      this._comments.set(documentId, []);
    }
    this._comments.get(documentId).push(comment);

    // Dispatch mention notifications (Req 10.6)
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
   * Auto-generates a system comment on status transition. (Req 10.4)
   *
   * @param {string} documentId
   * @param {{ action: string, actorId: string, actorName: string, fromStatus: string, toStatus: string }} data
   * @returns {object} Created system Comment
   */
  addSystemComment(documentId, { action, actorId, actorName, fromStatus, toStatus }) {
    const now = new Date().toISOString();
    const id = `cmt-${++this._idCounter}`;

    const text = `Status changed from ${fromStatus} to ${toStatus} by ${actorName}`;

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
   * (Reqs 10.7, 10.8)
   *
   * @param {string} commentId
   * @param {{ text: string, requesterId: string }} data
   * @returns {object} Updated Comment
   */
  editComment(commentId, { text, requesterId }) {
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
   * Used for @mention autocomplete. (Req 10.5)
   *
   * @param {string} prefix
   * @returns {object[]} Array of { id, name }
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

  // ─── Internal helpers ─────────────────────────────────────────────────

  /**
   * Finds a comment by ID across all documents.
   * @param {string} commentId
   * @returns {object | null}
   */
  _findCommentById(commentId) {
    for (const comments of this._comments.values()) {
      const found = comments.find((c) => c.id === commentId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Checks if a comment is within the 5-minute edit window.
   * @param {object} comment
   * @returns {boolean}
   */
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
