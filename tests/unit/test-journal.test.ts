import { describe, expect, it } from 'vitest';
import {
  SUITES,
  assess,
  capLog,
  fingerprint,
  journalRow,
  maskSecrets,
  parseEslintOutput,
  parseJournal,
  parsePlaywrightReport,
  parseRecordArgs,
  parseTscOutput,
  parseVitestReport,
  secretValuesFromEnv,
  stripAnsi,
  watchPathspec,
  type RunRecord,
} from '../tools/journal';

/**
 * Журнал прогонов тестов (TESTING.md). Проверяется то, на что опирается решение «повторять ли прогон»,
 * и то, что уходит в репозиторий: лог без секретов, итоги из отчёта раннера, а не из текста экрана.
 */

const ROOT = '/repo';
// Собираются при запуске: в исходниках не должно быть строк, похожих на настоящий ключ или пароль
const FAKE_JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ0ZXN0In0', 'ZmFrZS1zaWduYXR1cmU'].join('.');
const FAKE_PASS = ['not', 'a', 'real', 'pass'].join('-');
const FAKE_DB_URL = `postgresql://app:${FAKE_PASS}@db.example.com:5432/pms`;
const FAKE_KEY = ['fake', 'legacy', 'key', '0123456789'].join('-');

function run(over: Partial<RunRecord> = {}): RunRecord {
  return {
    v: 1,
    id: 'x',
    suite: 'unit',
    args: [],
    command: 'npx vitest run --project unit',
    startedAt: '2026-09-13T11:40:12.000Z',
    durationMs: 42_000,
    exitCode: 0,
    signal: null,
    status: 'passed',
    counts: { total: 3, passed: 3, failed: 0, skipped: 0, flaky: 0 },
    problems: null,
    failures: [],
    commit: 'abc1234def5678',
    branch: 'main',
    dirty: [],
    fingerprint: 'fp-1',
    codeChangedDuringRun: false,
    log: 'tests/runs/logs/x.log',
    logTruncated: false,
    machine: 'mac',
    note: null,
    ...over,
  };
}

describe('лог уходит в репозиторий без секретов и ПД', () => {
  it('JWT, пароль в адресе базы, ключ в заголовке и значения секретов из .env скрыты', () => {
    const values = secretValuesFromEnv({
      LEGACY_API_KEY: FAKE_KEY,
      PII_STORAGE: 'anonymized',
      PORT: '3001',
      CHANNEX_WEBHOOK_SECRET: 'short',
    });
    // не секрет по имени и слишком короткое значение не маскируются — иначе лог станет нечитаемым
    expect(values).toEqual([FAKE_KEY]);

    const out = maskSecrets(
      [
        `token ${FAKE_JWT}`,
        `url ${FAKE_DB_URL}`,
        'user-api-key: fake-channex-header-0123456789',
        `Authorization: Bearer ${FAKE_KEY}`,
        `ответ Legacy: ключ ${FAKE_KEY} отклонён`,
      ].join('\n'),
      values,
    );

    for (const secret of [FAKE_JWT, FAKE_PASS, 'fake-channex-header-0123456789', FAKE_KEY]) {
      expect(out).not.toContain(secret);
    }
    // адрес базы без пароля остаётся — по нему видно, куда ходил тест
    expect(out).toContain('db.example.com:5432/pms');
  });

  it('соль обезличивания и кука сессии из окружения тоже скрываются дословно', () => {
    // ANONYMIZE_SALT открывает псевдонимы гостей (ADR-018), WEB_SESSION_COOKIE — живую сессию стойки (проверка 24.09.2026)
    const salt = ['fake', 'salt', 'value', '0123'].join('-');
    const cookie = ['fake', 'session', 'cookie', '4567'].join('-');
    const values = secretValuesFromEnv({ ANONYMIZE_SALT: salt, WEB_SESSION_COOKIE: cookie });
    expect(values).toEqual(expect.arrayContaining([salt, cookie]));
    const out = maskSecrets(`seed ${salt}; cookie=${cookie}`, values);
    expect(out).not.toContain(salt);
    expect(out).not.toContain(cookie);
  });

  it('email и телефон скрыты, номер брони и итоги прогона остаются', () => {
    const out = maskSecrets(
      'Гость test.guest@example.com, +7 700 000 00 00, бронь 20260912-ABC123, 31 passed (13.0m)',
    );
    expect(out).not.toContain('test.guest@example.com');
    expect(out).not.toContain('700 000 00 00');
    expect(out).toContain('бронь 20260912-ABC123');
    expect(out).toContain('31 passed (13.0m)');
  });

  it('цвета терминала убраны', () => {
    expect(stripAnsi('[32m✓[39m 3 passed')).toBe('✓ 3 passed');
  });
});

describe('итоги берутся из отчёта раннера', () => {
  it('vitest: упавший тест и файл, который не выполнился, попадают в падения', () => {
    const report = {
      numTotalTests: 3,
      numPassedTests: 1,
      numFailedTests: 1,
      numPendingTests: 1,
      numTodoTests: 0,
      success: false,
      testResults: [
        {
          name: '/repo/packages/domain/src/money.test.ts',
          status: 'failed',
          message: '',
          assertionResults: [
            { fullName: 'тиыны складываются', status: 'passed', failureMessages: [] },
            {
              fullName: 'тиыны округляются',
              status: 'failed',
              failureMessages: [
                '[31mAssertionError: expected 1 to be 2[39m\n    at money.test.ts:10:5',
              ],
            },
            { fullName: 'отложен', status: 'skipped', failureMessages: [] },
          ],
        },
        {
          name: '/repo/tests/integration/broken.test.ts',
          status: 'failed',
          message: `Error: Can't reach database ${FAKE_DB_URL}`,
          assertionResults: [],
        },
      ],
    };

    const r = parseVitestReport(report, ROOT);

    expect(r.counts).toEqual({ total: 3, passed: 1, failed: 1, skipped: 1, flaky: 0 });
    expect(r.failures.map((f) => [f.name, f.file])).toEqual([
      ['тиыны округляются', 'packages/domain/src/money.test.ts'],
      ['(файл не выполнился)', 'tests/integration/broken.test.ts'],
    ]);
    expect(r.failures[0]!.message).toBe(
      'AssertionError: expected 1 to be 2\n    at money.test.ts:10:5',
    );
    expect(r.failures[1]!.message).not.toContain(FAKE_PASS);
  });

  it('playwright: имя из заголовков без файла, нестабильный тест помечен, счётчики из stats', () => {
    const report = {
      config: { rootDir: '/repo/tests/e2e' },
      stats: { expected: 29, unexpected: 1, flaky: 1, skipped: 0, duration: 780_000 },
      errors: [],
      suites: [
        {
          title: 'finance.spec.ts',
          file: 'finance.spec.ts',
          specs: [],
          suites: [
            {
              title: 'Счета',
              file: 'finance.spec.ts',
              specs: [
                {
                  title: 'частичная оплата и возврат',
                  file: 'finance.spec.ts',
                  ok: false,
                  tests: [
                    {
                      status: 'unexpected',
                      results: [
                        {
                          status: 'failed',
                          error: {
                            message:
                              '[31mTimeoutError: locator.click: Timeout 30000ms exceeded[39m',
                          },
                          errors: [],
                        },
                      ],
                    },
                  ],
                },
                {
                  title: 'сторно',
                  file: 'finance.spec.ts',
                  ok: true,
                  tests: [
                    {
                      status: 'flaky',
                      results: [
                        { status: 'failed', error: { message: 'first try failed' }, errors: [] },
                        { status: 'passed', errors: [] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const r = parsePlaywrightReport(report, ROOT);

    expect(r.counts).toEqual({ total: 31, passed: 29, failed: 1, skipped: 0, flaky: 1 });
    expect(r.failures).toEqual([
      {
        name: 'Счета › частичная оплата и возврат',
        file: 'tests/e2e/finance.spec.ts',
        message: 'TimeoutError: locator.click: Timeout 30000ms exceeded',
      },
      {
        name: 'Счета › сторно (нестабильный)',
        file: 'tests/e2e/finance.spec.ts',
        message: 'first try failed',
      },
    ]);
  });

  it('playwright: ошибка вне тестов (сервер не поднялся) видна, хотя тестов ноль', () => {
    const r = parsePlaywrightReport(
      {
        config: { rootDir: '/repo/tests/e2e' },
        stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
        errors: [{ message: 'Error: Timed out waiting 120000ms from config.webServer.' }],
        suites: [],
      },
      ROOT,
    );
    expect(r.counts).toEqual({ total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 });
    expect(r.failures).toEqual([
      {
        name: '(ошибка вне тестов)',
        file: null,
        message: 'Error: Timed out waiting 120000ms from config.webServer.',
      },
    ]);
  });

  it('tsc: каждая ошибка — файл со строкой и код', () => {
    const r = parseTscOutput(
      [
        '> pms@0.0.0 typecheck',
        '> tsc -p tsconfig.json --noEmit',
        '',
        "packages/domain/src/money.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.",
        "apps/web/src/app/page.tsx(3,1): error TS2307: Cannot find module 'x'.",
      ].join('\n'),
    );
    expect(r.problems).toBe(2);
    expect(r.counts).toBeNull();
    expect(r.failures[0]).toEqual({
      name: 'TS2322',
      file: 'packages/domain/src/money.ts:12',
      message: "Type 'string' is not assignable to type 'number'.",
    });
  });

  it('eslint: ошибки считаются, предупреждения прогон не валят', () => {
    const r = parseEslintOutput(
      [
        '',
        '/repo/tests/tools/journal.ts',
        "  12:5  error    'x' is assigned a value but never used  @typescript-eslint/no-unused-vars",
        '  20:1  warning  Unexpected console statement            no-console',
        '',
        '✖ 2 problems (1 error, 1 warning)',
      ].join('\n'),
      ROOT,
    );
    expect(r.problems).toBe(1);
    expect(r.failures).toEqual([
      {
        name: '@typescript-eslint/no-unused-vars',
        file: 'tests/tools/journal.ts:12',
        message: "'x' is assigned a value but never used",
      },
    ]);
    expect(parseEslintOutput('', ROOT)).toEqual({ counts: null, problems: 0, failures: [] });
  });
});

describe('журнал', () => {
  it('переживает слияние двух машин: мусор пропущен, записи по времени', () => {
    const text = [
      JSON.stringify(run({ id: 'b', startedAt: '2026-09-13T12:00:00.000Z' })),
      '<<<<<<< HEAD',
      '{"v":1,"broken"',
      '',
      '>>>>>>> cac6995',
      JSON.stringify(run({ id: 'a', startedAt: '2026-09-13T10:00:00.000Z' })),
    ].join('\n');
    expect(parseJournal(text).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('строка для людей: время Алматы, итог словами, заметка без поломки таблицы', () => {
    expect(journalRow(run({ note: 'после правки | штрафа\nвторая строка' }))).toBe(
      '| 13.09.2026 16:40 | unit | ✅ 3 из 3 | 42 с | abc1234 | [лог](logs/x.log) | после правки \\| штрафа вторая строка |',
    );
    expect(
      journalRow(
        run({
          suite: 'e2e',
          args: ['tests/e2e/finance.spec.ts'],
          status: 'failed',
          exitCode: 1,
          counts: { total: 2, passed: 1, failed: 1, skipped: 0, flaky: 0 },
          failures: [{ name: 'Счета › возврат', file: 'tests/e2e/finance.spec.ts', message: 'x' }],
          dirty: ['apps/api/src/a.ts', 'apps/api/src/b.ts'],
          durationMs: 785_000,
        }),
      ),
    ).toBe(
      '| 13.09.2026 16:40 | e2e (частично: tests/e2e/finance.spec.ts) | ❌ упало 1 из 2 | 13 мин 5 с | abc1234 +2 | [лог](logs/x.log) | Счета › возврат |',
    );
    expect(journalRow(run({ suite: 'lint', counts: null, problems: 0 }))).toContain(
      '| ✅ без ошибок |',
    );
  });

  it('длинный лог обрезается по середине: начало и конец на месте', () => {
    const long = Array.from({ length: 1000 }, (_, i) => `строка ${i}`).join('\n');
    const r = capLog(long, 2_000);
    expect(r.truncated).toBe(true);
    expect(Buffer.byteLength(r.text)).toBeLessThanOrEqual(2_000);
    expect(r.text).toContain('строка 0\n');
    expect(r.text).toContain('строка 999');
    expect(r.text).toMatch(/пропущено \d+ строк/);
    expect(capLog('коротко', 2_000)).toEqual({ text: 'коротко', truncated: false });
  });

  it('отпечаток кода не зависит от порядка файлов и меняется от содержимого', () => {
    const a = fingerprint([
      ['b.ts', 'h2'],
      ['a.ts', 'h1'],
    ]);
    expect(a).toBe(
      fingerprint([
        ['a.ts', 'h1'],
        ['b.ts', 'h2'],
      ]),
    );
    expect(a).not.toBe(
      fingerprint([
        ['a.ts', 'h1'],
        ['b.ts', 'h3'],
      ]),
    );
  });
});

describe('что входит в отпечаток кода', () => {
  it('журнал с логами и README исключены, а Markdown-фикстуры тестов — нет', () => {
    const spec = watchPathspec(['tests', 'scripts']);
    expect(spec.slice(0, 3)).toEqual(['--', 'tests', 'scripts']);
    // иначе каждая запись в журнал делала бы код «изменённым»
    expect(spec).toContain(':(exclude)tests/runs');
    // правка документации тесты не обесценивает
    expect(spec).toContain(':(exclude,glob)**/README.md');
    // тесты импорта читают scripts/imports/src/legacy/__fixtures__/*.md — Markdown целиком исключать нельзя
    expect(spec.some((p) => p.includes('*.md'))).toBe(false);
    // next dev переписывает apps/web/next-env.d.ts под свою папку сборки (.next или .next-ui): это не код,
    // иначе каждый UI-прогон помечал бы себя «код менялся во время прогона»
    expect(spec).toContain(':(exclude,glob)**/next-env.d.ts');
  });
});

describe('повторять ли прогон', () => {
  const unit = SUITES.unit;
  const e2e = SUITES.e2e;
  const now = new Date('2026-09-13T20:00:00.000Z');
  const on = (fp: string) => ({ fingerprint: fp, now });

  it('нет полного прогона — гонять', () => {
    expect(assess(unit, [], on('fp-1')).state).toBe('never');
    // частичный прогон одного спека не доказывает весь набор
    expect(
      assess(e2e, [run({ suite: 'e2e', args: ['tests/e2e/finance.spec.ts'] })], on('fp-1')).state,
    ).toBe('never');
    // «зелёный» прогон, который не нашёл ни одного теста, — это поломка настройки, а не доказательство
    const empty = run({ counts: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 } });
    expect(assess(unit, [empty], on('fp-1')).state).toBe('never');
  });

  it('зелёный на том же коде — доказано, повторять не нужно', () => {
    expect(assess(unit, [run()], on('fp-1')).state).toBe('proven');
    // прерванный прогон на другом коде не отменяет доказанное
    const interrupted = run({
      status: 'interrupted',
      fingerprint: 'fp-2',
      startedAt: '2026-09-13T12:00:00.000Z',
    });
    expect(assess(unit, [run(), interrupted], on('fp-1')).state).toBe('proven');
    // модульные не устаревают со временем, только от кода
    expect(assess(unit, [run({ startedAt: '2026-09-01T10:00:00.000Z' })], on('fp-1')).state).toBe(
      'proven',
    );
  });

  it('код набора изменился — доказательство не годится', () => {
    expect(assess(unit, [run()], on('fp-2')).state).toBe('changed');
    // код менялся прямо во время прогона (параллельная сессия) — тоже не доказательство
    expect(assess(unit, [run({ codeChangedDuringRun: true })], on('fp-1')).state).toBe('changed');
  });

  it('красный на том же коде — сначала чинить; после правки — гонять', () => {
    const failed = run({ status: 'failed', exitCode: 1 });
    expect(assess(unit, [failed], on('fp-1')).state).toBe('failing');
    expect(assess(unit, [failed], on('fp-2')).state).toBe('changed-after-failure');
  });

  it('сквозные зависят от живой базы и даты: доказательство живёт сутки', () => {
    const e2eRun = (startedAt: string) => run({ suite: 'e2e', startedAt });
    expect(assess(e2e, [e2eRun('2026-09-13T18:00:00.000Z')], on('fp-1')).state).toBe('proven');
    expect(assess(e2e, [e2eRun('2026-09-12T14:00:00.000Z')], on('fp-1')).state).toBe('expired');
  });
});

describe('запуск записи', () => {
  it('набор, аргументы раннера и заметка разбираются', () => {
    expect(parseRecordArgs(['e2e', 'tests/e2e/finance.spec.ts', '--note', 'после правки'])).toEqual(
      {
        suite: SUITES.e2e,
        args: ['tests/e2e/finance.spec.ts'],
        note: 'после правки',
      },
    );
    expect(parseRecordArgs(['unit', '--note=быстро'])).toEqual({
      suite: SUITES.unit,
      args: [],
      note: 'быстро',
    });
  });

  it('неизвестный набор и аргументы там, где их некуда передать, — ошибка со списком', () => {
    expect(() => parseRecordArgs(['smoke'])).toThrow(/unit.*integration.*e2e.*typecheck.*lint/);
    expect(() => parseRecordArgs([])).toThrow(/unit/);
    expect(() => parseRecordArgs(['typecheck', '--pretty'])).toThrow(/аргумент/);
  });

  it('каждый набор следит за своими тестами и настройками', () => {
    expect(SUITES.unit.watch).toEqual(expect.arrayContaining(['tests/unit', 'vitest.config.ts']));
    expect(SUITES.integration.watch).toEqual(
      expect.arrayContaining(['tests/integration', 'vitest.config.ts']),
    );
    expect(SUITES.e2e.watch).toEqual(
      expect.arrayContaining(['tests/e2e', 'tests/e2e-teardown.ts', 'playwright.config.ts']),
    );
    for (const s of Object.values(SUITES)) {
      expect(
        s.watch.some((p) => p.startsWith('tests/runs')),
        s.name,
      ).toBe(false);
    }
  });
});
