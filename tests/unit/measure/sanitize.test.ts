import { describe, expect, it } from 'vitest';
import { reportKey, sanitizeMessage } from '../../../src/lib/measure/sanitize';
import type { FailureReport } from '../../../src/lib/measure/wire';

describe('sanitizeMessage', () => {
  it('masks absolute URLs', () => {
    expect(sanitizeMessage('failed https://x.y/a?b')).toBe('failed <url>');
  });
  it('masks app paths with a query or hash', () => {
    expect(sanitizeMessage('/triads?rt=c')).toBe('<url>');
    expect(sanitizeMessage('at /caged#x here')).toBe('at<url> here');
  });
  it('leaves plain text alone', () => {
    expect(sanitizeMessage('Cannot read properties of undefined')).toBe(
      'Cannot read properties of undefined'
    );
  });
  it('truncates to exactly 200 chars', () => {
    expect(sanitizeMessage('a'.repeat(500))).toHaveLength(200);
  });
});

describe('reportKey', () => {
  const base = { r: 'r', tool: 'triads' } as unknown as FailureReport;
  it('error kinds use kind|tool|name|msg', () => {
    const r = { ...base, kind: 'drawing', name: 'TypeError', msg: 'boom' } as FailureReport;
    expect(reportKey(r)).toBe('drawing|triads|TypeError|boom');
  });
  it('missing-text uses kind|tool|key', () => {
    const r = { ...base, kind: 'missing-text', key: 'about_title' } as FailureReport;
    expect(reportKey(r)).toBe('missing-text|triads|about_title');
  });
});
