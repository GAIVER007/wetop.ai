import { describe, expect, it } from 'vitest';
import { classifyError, failingSuites, latestReportResults, overbookedNights } from './signals';

/** Сигналы, из которых сторож собирает неисправности: текст ошибки, отчёты сверок, журнал тестов, овербукинг. */

describe('classifyError', () => {
  it('сеть, таймаут, 5xx и 429 Channex, обрыв соединения с базой — временная ошибка, повтор имеет смысл', () => {
    for (const t of [
      'Channex /booking_revisions/feed: сеть — fetch failed',
      'Channex GET /booking_revisions/abc: HTTP 503',
      'Channex POST /availability: HTTP 429 too_many_requests',
      'connect ECONNREFUSED 127.0.0.1:5432',
      "P1001: Can't reach database server",
      'The operation was aborted due to timeout',
    ])
      expect(classifyError(t), t).toBe('transient');
  });

  it('правило, валидация, 4xx и неизвестное — постоянная: повторять бессмысленно, будить человека', () => {
    for (const t of [
      'Бронь BDC-1 (Booking.com): перенесённых из Exely броней с таким же составом проживаний несколько — PMS не выбирает сама (ADR-024)',
      'Channex POST /availability: HTTP 422 validation_error',
      'Неизвестная категория в ревизии',
      'бронь 20260912-513903-1263604791 без ячейки',
      null,
    ])
      expect(classifyError(t), String(t)).toBe('permanent');
  });
});

describe('latestReportResults', () => {
  it('берёт последний отчёт каждого вида и его RESULT', () => {
    const files = ['double-entry-2026-09-12.md', 'double-entry-2026-09-13.md', 'rates-2026-09-09.md', 'readme.md'];
    const text: Record<string, string> = {
      'double-entry-2026-09-13.md': 'заезды 23/23\n**RESULT: FAIL** — три проживания без ячейки',
      'rates-2026-09-09.md': 'RESULT: PASS',
    };
    const r = latestReportResults(files, ['double-entry', 'rates', 'balances'], (f) => text[f] ?? '');
    expect(r).toEqual([
      { kind: 'double-entry', file: 'double-entry-2026-09-13.md', result: 'FAIL', line: '**RESULT: FAIL** — три проживания без ячейки' },
      { kind: 'rates', file: 'rates-2026-09-09.md', result: 'PASS', line: 'RESULT: PASS' },
    ]);
  });
});

describe('failingSuites', () => {
  const row = (suite: string, status: string, startedAt: string, args: string[] = []) =>
    JSON.stringify({ suite, status, startedAt, args, failures: status === 'failed' ? [{ name: 't', file: 'a.test.ts', message: 'boom' }] : [] });

  it('набор падает, если его последний ПОЛНЫЙ прогон красный', () => {
    const jsonl = [
      row('unit', 'passed', '2026-09-13T10:00:00Z'),
      row('unit', 'failed', '2026-09-13T11:00:00Z'),
      row('lint', 'failed', '2026-09-13T10:00:00Z'),
      row('lint', 'passed', '2026-09-13T11:00:00Z'),
      row('e2e', 'failed', '2026-09-13T12:00:00Z', ['tests/e2e/finance.spec.ts']),
      row('typecheck', 'interrupted', '2026-09-13T12:00:00Z'),
      'не json',
    ].join('\n');
    expect(failingSuites(jsonl)).toEqual([
      { suite: 'unit', startedAt: '2026-09-13T11:00:00Z', failures: 1, first: 'a.test.ts: boom' },
    ]);
  });
});

describe('overbookedNights', () => {
  it('продано больше, чем свободных ячеек категории на ночь — овербукинг; ровно столько — нет', () => {
    const r = overbookedNights({
      from: '2026-09-12',
      to: '2026-09-13',
      units: [
        { code: 'MALE', active: 2 },
        { code: 'SGL', active: 1 },
      ],
      blocks: [{ accommodationTypeCode: 'SGL', dateFrom: '2026-09-13', dateTo: '2026-09-14' }],
      items: [
        { accommodationTypeCode: 'MALE', arrivalDate: '2026-09-11', departureDate: '2026-09-14' },
        { accommodationTypeCode: 'MALE', arrivalDate: '2026-09-12', departureDate: '2026-09-13' },
        { accommodationTypeCode: 'MALE', arrivalDate: '2026-09-12', departureDate: '2026-09-14' },
        { accommodationTypeCode: 'SGL', arrivalDate: '2026-09-13', departureDate: '2026-09-14' },
      ],
    });
    expect(r).toEqual([
      { code: 'MALE', date: '2026-09-12', capacity: 2, sold: 3 },
      { code: 'SGL', date: '2026-09-13', capacity: 0, sold: 1 },
    ]);
  });
});
