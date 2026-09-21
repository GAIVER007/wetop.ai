import { describe, expect, it } from 'vitest';
import {
  channelOversold,
  classifyError,
  failingSuites,
  latestReportResults,
  narrowsTestSelection,
  overbookedNights,
  reportIsFresh,
  suiteRunIsFresh,
} from './signals';

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
    const files = [
      'double-entry-2026-09-12.md',
      'double-entry-2026-09-13.md',
      'rates-2026-09-09.md',
      'readme.md',
    ];
    const text: Record<string, string> = {
      'double-entry-2026-09-13.md': 'заезды 23/23\n**RESULT: FAIL** — три проживания без ячейки',
      'rates-2026-09-09.md': 'RESULT: PASS',
    };
    const r = latestReportResults(
      files,
      ['double-entry', 'rates', 'balances'],
      (f) => text[f] ?? '',
    );
    expect(r).toEqual([
      {
        kind: 'double-entry',
        file: 'double-entry-2026-09-13.md',
        result: 'FAIL',
        line: '**RESULT: FAIL** — три проживания без ячейки',
      },
      { kind: 'rates', file: 'rates-2026-09-09.md', result: 'PASS', line: 'RESULT: PASS' },
    ]);
  });
});

/**
 * 15.09.2026: полный зелёный прогон e2e не засчитывался. На этой машине сквозные идут только
 * `--workers=1` (в два воркера при свопе не укладываются в ожидания), а журнал считал любой аргумент
 * признаком частичного прогона. Из-за этого неисправность «падает набор e2e» висела с 13.09,
 * показывая чужой красный прогон, и `test:status` вечно требовал гнать заново.
 * Частичным прогон делает только сужение набора тестов, а не то, КАК он запущен.
 */
/**
 * В контейнере /app — слепок на момент сборки образа: отчёт и журнал тестов там не меняются, и без
 * возрастного порога «сверка дала FAIL» повторяла бы день сборки вечно (разбор 21.09.2026).
 */
describe('reportIsFresh / suiteRunIsFresh', () => {
  const now = new Date('2026-09-21T12:00:00Z');
  it('вчерашний отчёт годен, позавчерашний — уже слепок; без даты в имени — не годен', () => {
    expect(reportIsFresh('double-entry-2026-09-21.md', now)).toBe(true);
    expect(reportIsFresh('double-entry-2026-09-20.md', now)).toBe(true);
    expect(reportIsFresh('double-entry-2026-09-19.md', now)).toBe(false);
    expect(reportIsFresh('double-entry.md', now)).toBe(false);
    expect(reportIsFresh('double-entry-2026-02-30.md', now)).toBe(false);
  });
  it('прогон тестов: не старше двух суток — годен, старше или без времени — нет', () => {
    expect(suiteRunIsFresh('2026-09-20T10:00:00.000Z', now)).toBe(true);
    expect(suiteRunIsFresh('2026-09-19T11:00:00.000Z', now)).toBe(false);
    expect(suiteRunIsFresh('вчера', now)).toBe(false);
  });
});

describe('narrowsTestSelection', () => {
  it('число воркеров, отчёт, повторы и таймаут набор не сужают', () => {
    for (const args of [
      [],
      ['--workers=1'],
      ['--workers', '1'],
      ['--reporter=list'],
      ['--retries=2'],
      ['--timeout=180000'],
      ['--headed'],
      ['--workers=1', '--retries=0'],
    ])
      expect(narrowsTestSelection(args), args.join(' ')).toBe(false);
  });

  it('файл, grep, проект и другой конфиг — сужают: такой прогон набор не доказывает', () => {
    for (const args of [
      ['tests/e2e/finance.spec.ts'],
      ['-g', 'бронь'],
      ['--grep=бронь'],
      ['--project', 'integration'],
      ['--config', 'tests/ui/playwright.config.ts'],
      ['--workers=1', 'tests/e2e/finance.spec.ts'],
      ['-t', 'счёт'],
    ])
      expect(narrowsTestSelection(args), args.join(' ')).toBe(true);
  });
});

describe('failingSuites', () => {
  const row = (suite: string, status: string, startedAt: string, args: string[] = []) =>
    JSON.stringify({
      suite,
      status,
      startedAt,
      args,
      failures: status === 'failed' ? [{ name: 't', file: 'a.test.ts', message: 'boom' }] : [],
    });

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

  it('зелёный прогон с --workers=1 — полный: он доказывает набор и снимает неисправность', () => {
    const jsonl = [
      row('e2e', 'failed', '2026-09-13T18:48:00.000Z'),
      row('e2e', 'passed', '2026-09-15T15:30:00.000Z', ['--workers=1']),
    ].join('\n');
    expect(failingSuites(jsonl)).toEqual([]);
  });

  it('прогон одного файла набор не доказывает: красный остаётся красным', () => {
    const jsonl = [
      row('e2e', 'failed', '2026-09-13T18:48:00.000Z'),
      row('e2e', 'passed', '2026-09-15T15:30:00.000Z', ['tests/e2e/finance.spec.ts']),
    ].join('\n');
    expect(failingSuites(jsonl).map((s) => s.suite)).toEqual(['e2e']);
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

describe('channelOversold', () => {
  const m = (o: Record<string, Record<string, number>>) =>
    new Map(Object.entries(o).map(([k, v]) => [k, new Map(Object.entries(v))]));
  it('опасно только там, где у канала мест больше, чем у PMS; меньше — недопродажа, не неисправность', () => {
    const r = channelOversold({
      pms: m({ MALE: { '2026-09-14': 0, '2026-09-15': 3 }, SGL: { '2026-09-14': 1 } }),
      channel: m({ MALE: { '2026-09-14': 2, '2026-09-15': 1 }, SGL: { '2026-09-14': 1 } }),
    });
    expect(r).toEqual([{ code: 'MALE', date: '2026-09-14', pms: 0, channel: 2 }]);
  });
  it('даты, которых канал не вернул, не считаются расхождением (не видно — не значит продаёт)', () => {
    expect(
      channelOversold({ pms: m({ MALE: { '2026-09-14': 0 } }), channel: m({ MALE: {} }) }),
    ).toEqual([]);
  });
});
