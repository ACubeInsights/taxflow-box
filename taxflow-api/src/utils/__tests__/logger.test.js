import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger.js';

describe('logger', () => {
  let errorSpy, warnSpy, logSpy;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function parseOutput(spy) {
    return JSON.parse(spy.mock.calls[0][0]);
  }

  it('logger.error outputs JSON with level "error"', () => {
    logger.error('something broke');
    expect(errorSpy).toHaveBeenCalledOnce();
    const entry = parseOutput(errorSpy);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('something broke');
    expect(entry.timestamp).toBeDefined();
  });

  it('logger.warn outputs JSON with level "warn"', () => {
    logger.warn('heads up');
    expect(warnSpy).toHaveBeenCalledOnce();
    const entry = parseOutput(warnSpy);
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('heads up');
    expect(entry.timestamp).toBeDefined();
  });

  it('logger.info outputs JSON with level "info"', () => {
    logger.info('all good');
    expect(logSpy).toHaveBeenCalledOnce();
    const entry = parseOutput(logSpy);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('all good');
    expect(entry.timestamp).toBeDefined();
  });

  it('spreads additional context into the log entry', () => {
    logger.error('request failed', { method: 'POST', path: '/api/docs', statusCode: 500 });
    const entry = parseOutput(errorSpy);
    expect(entry.method).toBe('POST');
    expect(entry.path).toBe('/api/docs');
    expect(entry.statusCode).toBe(500);
  });

  it('timestamp is a valid ISO 8601 string', () => {
    logger.info('check timestamp');
    const entry = parseOutput(logSpy);
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('works without context argument', () => {
    logger.info('no context');
    const entry = parseOutput(logSpy);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('no context');
    expect(entry.timestamp).toBeDefined();
    // Only level, message, timestamp keys
    expect(Object.keys(entry)).toEqual(['level', 'message', 'timestamp']);
  });
});
