/**
 * @module httpError
 * HTTP error factory utility for taxflow-api.
 *
 * Provides a single helper to create Error objects with an attached HTTP
 * status code and optional machine-readable error code. Used across all
 * backend services to replace ad-hoc `new Error()` + `err.statusCode = N`
 * patterns.
 *
 * Public API:
 * - createHttpError(message, statusCode, code?) → Error
 *
 * Requirements: 5.1, 7.1
 */

/**
 * Creates an Error with HTTP status code and optional error code.
 * @param {string} message
 * @param {number} statusCode
 * @param {string} [code]
 * @returns {Error & { statusCode: number, code?: string }}
 */
export function createHttpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}
