/**
 * Centralized Express error handler middleware.
 *
 * Catches all unhandled errors from route handlers and services,
 * logs them with structured context, and returns a standard JSON
 * error response: { error, code, statusCode, details? }.
 *
 * @module errorHandler
 * @see Requirements 7.1, 7.2, 7.3, 7.4
 */

import { logger } from '../utils/logger.js';

/**
 * Express error handler middleware.
 * Returns a standard error response format and logs with structured context.
 *
 * @param {Error & { statusCode?: number, code?: string, details?: object }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const response = {
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    statusCode,
  };
  if (err.details) response.details = err.details;

  logger.error('Request error', {
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
  });

  res.status(statusCode).json(response);
}
