import { describe, expect, it } from 'vitest';
import { parseRecordArgs, parseVitestReport } from '../tools/journal';

describe('mobile test evidence', () => {
  it('runs the native component suite without a database', () => {
    const { suite } = parseRecordArgs(['mobile']);
    expect(suite.runner).toBe('jest');
    expect(suite.command).toBe('npm --prefix apps/mobile run test --');
    expect(suite.needs).toBe('ничего внешнего');
    expect(suite.watch).toContain('apps/mobile');
  });

  it('preserves failed Jest assertions in the compatible JSON report', () => {
    const result = parseVitestReport({
      numTotalTests: 1, numPassedTests: 0, numFailedTests: 1,
      numPendingTests: 0, numTodoTests: 0,
      testResults: [{ name: '/repo/apps/mobile/tests/button.test.tsx', status: 'failed',
        assertionResults: [{ fullName: 'disabled action', status: 'failed', failureMessages: ['unexpected press'] }] }],
    }, '/repo');
    expect(result.counts?.failed).toBe(1);
    expect(result.failures[0]?.file).toBe('apps/mobile/tests/button.test.tsx');
    expect(result.failures[0]?.message).toBe('unexpected press');
  });
});
