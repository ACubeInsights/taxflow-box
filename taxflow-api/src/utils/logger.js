/**
 * Structured logging utility for taxflow-api.
 *
 * Exports a `logger` object with `error`, `warn`, and `info` methods.
 * Each method outputs a JSON object with `level`, `message`, `timestamp`,
 * and any additional context fields spread into the log entry.
 *
 * @module logger
 * @see Requirements 7.4
 */

/**
 * Writes a structured JSON log line to the appropriate console stream.
 * @param {'error'|'warn'|'info'} level
 * @param {string} message
 * @param {Object} [context]
 */
function log(level, message, context = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Structured logger with `error`, `warn`, and `info` methods.
 * Each method accepts a message string and an optional context object.
 *
 * @example
 * logger.error('Request failed', { method: 'POST', path: '/api/docs', statusCode: 500 });
 * // => {"level":"error","message":"Request failed","timestamp":"...","method":"POST","path":"/api/docs","statusCode":500}
 */
export const logger = {
  /**
   * Log an error-level message.
   * @param {string} message
   * @param {Object} [context]
   */
  error(message, context) {
    log('error', message, context);
  },

  /**
   * Log a warn-level message.
   * @param {string} message
   * @param {Object} [context]
   */
  warn(message, context) {
    log('warn', message, context);
  },

  /**
   * Log an info-level message.
   * @param {string} message
   * @param {Object} [context]
   */
  info(message, context) {
    log('info', message, context);
  },
};
