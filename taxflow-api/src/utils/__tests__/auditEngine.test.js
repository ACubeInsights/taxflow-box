import { describe, it, expect } from 'vitest';
import { createAuditFinding } from '../auditEngine.js';

describe('createAuditFinding', () => {
  const validArgs = [
    'src/services/projectService.js',
    { start: 10, end: 25 },
    'major',
    'definite',
    'dead-code',
    'Unused export found',
  ];

  it('returns a well-formed finding for valid inputs', () => {
    const finding = createAuditFinding(...validArgs);
    expect(finding).toEqual({
      filePath: 'src/services/projectService.js',
      lineRange: { start: 10, end: 25 },
      severity: 'major',
      confidence: 'definite',
      category: 'dead-code',
      description: 'Unused export found',
    });
  });

  it('accepts all valid severity values', () => {
    for (const sev of ['critical', 'major', 'minor']) {
      const finding = createAuditFinding(validArgs[0], validArgs[1], sev, validArgs[3], validArgs[4], validArgs[5]);
      expect(finding.severity).toBe(sev);
    }
  });

  it('accepts all valid confidence values', () => {
    for (const conf of ['definite', 'probable', 'needs-review']) {
      const finding = createAuditFinding(validArgs[0], validArgs[1], validArgs[2], conf, validArgs[4], validArgs[5]);
      expect(finding.confidence).toBe(conf);
    }
  });

  it('throws when filePath is empty', () => {
    expect(() => createAuditFinding('', validArgs[1], validArgs[2], validArgs[3], validArgs[4], validArgs[5]))
      .toThrow('filePath must be a non-empty string');
  });

  it('throws when filePath is not a string', () => {
    expect(() => createAuditFinding(123, validArgs[1], validArgs[2], validArgs[3], validArgs[4], validArgs[5]))
      .toThrow('filePath must be a non-empty string');
  });

  it('throws when lineRange is missing start or end', () => {
    expect(() => createAuditFinding(validArgs[0], { start: 1 }, validArgs[2], validArgs[3], validArgs[4], validArgs[5]))
      .toThrow('lineRange must have numeric start and end properties');
    expect(() => createAuditFinding(validArgs[0], { end: 5 }, validArgs[2], validArgs[3], validArgs[4], validArgs[5]))
      .toThrow('lineRange must have numeric start and end properties');
  });

  it('throws when lineRange is null', () => {
    expect(() => createAuditFinding(validArgs[0], null, validArgs[2], validArgs[3], validArgs[4], validArgs[5]))
      .toThrow('lineRange must have numeric start and end properties');
  });

  it('throws for invalid severity', () => {
    expect(() => createAuditFinding(validArgs[0], validArgs[1], 'high', validArgs[3], validArgs[4], validArgs[5]))
      .toThrow('severity must be one of');
  });

  it('throws for invalid confidence', () => {
    expect(() => createAuditFinding(validArgs[0], validArgs[1], validArgs[2], 'maybe', validArgs[4], validArgs[5]))
      .toThrow('confidence must be one of');
  });

  it('throws when category is empty', () => {
    expect(() => createAuditFinding(validArgs[0], validArgs[1], validArgs[2], validArgs[3], '', validArgs[5]))
      .toThrow('category must be a non-empty string');
  });

  it('throws when description is empty', () => {
    expect(() => createAuditFinding(validArgs[0], validArgs[1], validArgs[2], validArgs[3], validArgs[4], ''))
      .toThrow('description must be a non-empty string');
  });
});
