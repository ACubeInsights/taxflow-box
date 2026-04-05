/**
 * @module auditEngine
 * Audit finding data structure and factory for the codebase deep cleanup.
 *
 * Provides a standardized shape for audit findings produced during
 * architectural inconsistency detection and dead code analysis. Each
 * finding carries file location, severity, confidence, category, and a
 * human-readable description.
 *
 * Public API:
 * - createAuditFinding(filePath, lineRange, severity, confidence, category, description) → AuditFinding
 *
 * Requirements: 1.4, 2.5
 */

/**
 * @typedef {'critical' | 'major' | 'minor'} Severity
 */

/**
 * @typedef {'definite' | 'probable' | 'needs-review'} Confidence
 */

/**
 * @typedef {Object} LineRange
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} AuditFinding
 * @property {string} filePath
 * @property {LineRange} lineRange
 * @property {Severity} severity
 * @property {Confidence} confidence
 * @property {string} category
 * @property {string} description
 */

const VALID_SEVERITIES = ['critical', 'major', 'minor'];
const VALID_CONFIDENCES = ['definite', 'probable', 'needs-review'];

/**
 * Creates a validated audit finding object.
 *
 * @param {string} filePath - Non-empty path to the file containing the issue.
 * @param {LineRange} lineRange - Object with numeric `start` and `end` line numbers.
 * @param {Severity} severity - One of 'critical', 'major', 'minor'.
 * @param {Confidence} confidence - One of 'definite', 'probable', 'needs-review'.
 * @param {string} category - Non-empty category label (e.g. 'dead-code', 'naming').
 * @param {string} description - Non-empty human-readable description of the finding.
 * @returns {AuditFinding}
 * @throws {Error} If any input fails validation.
 */
export function createAuditFinding(filePath, lineRange, severity, confidence, category, description) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('filePath must be a non-empty string');
  }

  if (
    !lineRange ||
    typeof lineRange.start !== 'number' ||
    typeof lineRange.end !== 'number'
  ) {
    throw new Error('lineRange must have numeric start and end properties');
  }

  if (!VALID_SEVERITIES.includes(severity)) {
    throw new Error(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (!VALID_CONFIDENCES.includes(confidence)) {
    throw new Error(`confidence must be one of: ${VALID_CONFIDENCES.join(', ')}`);
  }

  if (typeof category !== 'string' || category.length === 0) {
    throw new Error('category must be a non-empty string');
  }

  if (typeof description !== 'string' || description.length === 0) {
    throw new Error('description must be a non-empty string');
  }

  return { filePath, lineRange, severity, confidence, category, description };
}
