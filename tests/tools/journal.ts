import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { narrowsTestSelection } from '@pms/domain';

/**
 * Журнал прогонов тестов — чистая логика без запуска процессов (TESTING.md).
 *
 * Доказательство «тесты зелёные» хранится вместе с отпечатком кода, на котором они прошли. Отпечаток
 * совпал с текущим — прогон повторять не нужно; не совпал — видно, что изменилось. Лог и строка журнала
 * уезжают в репозиторий, поэтому всё, что туда пишется, проходит maskSecrets.
 */

export const JOURNAL_FILE = 'tests/runs/journal.jsonl';
export const JOURNAL_MD = 'tests/runs/JOURNAL.md';
export const LOG_DIR = 'tests/runs/logs';
/** Журнал и логи в отпечаток кода не входят: иначе каждая запись делала бы код «изменённым» */
export const NOT_CODE = 'tests/runs';

/**
 * Pathspec git для файлов набора. Исключены журнал с логами и README — правка документации тесты не
 * обесценивает. Остальной Markdown остаётся: тесты импорта читают фикстуры `__fixtures__/*.md`.
 * `next-env.d.ts` генерирует сам `next dev` (под `.next` или `.next-ui`), поэтому UI-прогон менял отпечаток
 * набора во время прогона и не засчитывался как доказательство (16.09.2026).
 */
export function watchPathspec(watch: readonly string[]): string[] {
  return [
    '--',
    ...watch,
    `:(exclude)${NOT_CODE}`,
    ':(exclude,glob)**/README.md',
    ':(exclude,glob)**/next-env.d.ts',
  ];
}

export type SuiteName = 'unit' | 'integration' | 'e2e' | 'typecheck' | 'lint';
export type Runner = 'vitest' | 'playwright' | 'tsc' | 'eslint';
export type RunStatus = 'passed' | 'failed' | 'interrupted';

export interface Counts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
}

export interface Failure {
  name: string;
  file: string | null;
  message: string;
}

export interface Parsed {
  counts: Counts | null;
  /** Ошибки tsc и eslint — у них нет «тестов», есть число ошибок */
  problems: number | null;
  failures: Failure[];
}

export interface RunRecord {
  v: 1;
  id: string;
  suite: string;
  /** Аргументы раннера (один спек, --grep…). Непустые — прогон частичный и весь набор не доказывает */
  args: string[];
  command: string;
  startedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal: string | null;
  status: RunStatus;
  counts: Counts | null;
  problems: number | null;
  failures: Failure[];
  commit: string;
  branch: string;
  /** Файлы набора, отличавшиеся от коммита в момент запуска */
  dirty: string[];
  fingerprint: string;
  /** Код набора изменился, пока шёл прогон (параллельная сессия) — такой прогон не доказательство */
  codeChangedDuringRun: boolean;
  log: string;
  logTruncated: boolean;
  machine: string;
  note: string | null;
}

export interface SuiteDef {
  name: SuiteName;
  title: string;
  command: string;
  runner: Runner;
  /** Пути, от содержимого которых зависит результат */
  watch: string[];
  /** Сколько часов зелёный прогон годен при неизменном коде; null — пока не изменится код */
  maxAgeHours: number | null;
  acceptsArgs: boolean;
  needs: string;
}

const DEPS = ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.base.json'];

export const SUITES: Record<SuiteName, SuiteDef> = {
  unit: {
    name: 'unit',
    title: 'Модульные',
    command: 'npx vitest run --project unit',
    runner: 'vitest',
    watch: [
      'apps',
      'packages',
      'scripts',
      'tests/unit',
      'tests/tools',
      'vitest.config.ts',
      ...DEPS,
    ],
    maxAgeHours: null,
    acceptsArgs: true,
    needs: 'ничего внешнего',
  },
  integration: {
    name: 'integration',
    title: 'Интеграционные',
    command: 'npx vitest run --project integration',
    runner: 'vitest',
    watch: ['apps/api', 'packages', 'scripts', 'tests/integration', 'vitest.config.ts', ...DEPS],
    maxAgeHours: 24,
    acceptsArgs: true,
    needs: 'dev-БД через пулер Supabase (DATABASE_URL в .env)',
  },
  e2e: {
    name: 'e2e',
    title: 'Сквозные',
    command: 'npx playwright test --workers=2',
    runner: 'playwright',
    watch: [
      'apps',
      'packages',
      'scripts',
      'tests/e2e',
      'tests/ui',
      'tests/e2e-teardown.ts',
      'playwright.config.ts',
      ...DEPS,
    ],
    maxAgeHours: 24,
    acceptsArgs: true,
    needs: 'dev-БД, API :3001 и стойка :3000 (Playwright поднимает сам или берёт уже запущенные)',
  },
  typecheck: {
    name: 'typecheck',
    title: 'Типы',
    // все три проверки идут до конца, даже если первая упала: в журнал попадают ошибки всех трёх
    command:
      'npm run typecheck; a=$?; npm run typecheck:api; b=$?; npm run typecheck:web; c=$?; [ $a -eq 0 ] && [ $b -eq 0 ] && [ $c -eq 0 ]',
    runner: 'tsc',
    watch: [
      'apps',
      'packages',
      'scripts',
      'tests',
      'vitest.config.ts',
      'playwright.config.ts',
      ...DEPS,
    ],
    maxAgeHours: null,
    acceptsArgs: false,
    needs: 'ничего внешнего',
  },
  lint: {
    name: 'lint',
    title: 'Линтер',
    command: 'npx eslint .',
    runner: 'eslint',
    watch: [
      'apps',
      'packages',
      'scripts',
      'tests',
      'eslint.config.js',
      'vitest.config.ts',
      'playwright.config.ts',
      ...DEPS,
    ],
    maxAgeHours: null,
    acceptsArgs: true,
    needs: 'ничего внешнего',
  },
};

const MAX_FAILURES = 20;
const MAX_MESSAGE_LINES = 25;
const MAX_MESSAGE_CHARS = 2_000;

// ---------------------------------------------------------------------------------------------------
// Текст: цвета терминала, секреты, ПД

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^${BEL}]*${BEL}`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '').replace(/\r\n/g, '\n');
}

// SALT — соль обезличивания гостей (ADR-018), COOKIE — живая сессия стойки (scripts/lib/desk-page.ts)
const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|SALT|COOKIE|DATABASE_URL|DIRECT_URL/i;

/** Значения переменных-секретов: они маскируются в логе дословно, где бы ни встретились */
export function secretValuesFromEnv(env: Readonly<Record<string, string | undefined>>): string[] {
  const out = new Set<string>();
  for (const [name, value] of Object.entries(env)) {
    if (!value || !SECRET_NAME.test(name)) continue;
    if (value.length >= 8) out.add(value);
    const pass = /^[a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:([^@\s]+)@/i.exec(value)?.[1];
    if (pass && pass.length >= 6) out.add(pass);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

const MASK_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    '<закрытый ключ скрыт>',
  ],
  [/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '<JWT скрыт>'],
  [
    /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16})/g,
    '<ключ скрыт>',
  ],
  // пароль в адресе: хост и база остаются, по ним видно, куда ходил тест
  [/\b([a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:)[^@\s]+@/gi, '$1***@'],
  [/\b(authorization["']?\s*[:=]\s*["']?(?:bearer|basic|token)?\s*)[^\s"',;}]+/gi, '$1<скрыто>'],
  [
    /\b((?:[a-z]+[-_])?(?:api[-_]?key|secret|token|password|passwd)["']?\s*[:=]\s*["']?)[^\s"',;}]{6,}/gi,
    '$1<скрыто>',
  ],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>'],
  [/(?<![\w-])\+?[78][\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\w-])/g, '<телефон>'],
];

export function maskSecrets(text: string, secretValues: readonly string[] = []): string {
  let out = text;
  for (const value of secretValues) out = out.split(value).join('<скрыто>');
  for (const [rule, replacement] of MASK_RULES) out = out.replace(rule, replacement);
  return out;
}

/** Preserve the runner JSON structure while removing secrets. */
export function maskJsonReport(text: string, secretValues: readonly string[] = []): string {
  return JSON.stringify(JSON.parse(text), (key: string, value: unknown) => {
    if (
      (SECRET_NAME.test(key) || key.toLowerCase() === 'authorization') &&
      value !== null &&
      value !== ''
    )
      return '<скрыто>';
    return typeof value === 'string' ? maskSecrets(value, secretValues) : value;
  });
}

type Mask = (text: string) => string;
const patternsOnly: Mask = (text) => maskSecrets(text);

function cleanMessage(message: string, mask: Mask): string {
  const lines = mask(stripAnsi(message)).trim().split('\n').slice(0, MAX_MESSAGE_LINES);
  return lines.join('\n').slice(0, MAX_MESSAGE_CHARS);
}

function relPath(root: string, path: string): string {
  return relative(root, path).split('\\').join('/');
}

const num = (v: number | undefined): number => (typeof v === 'number' ? v : 0);

// ---------------------------------------------------------------------------------------------------
// Итоги из отчётов раннеров

interface VitestAssertion {
  fullName?: string;
  title?: string;
  status?: string;
  failureMessages?: string[];
}
interface VitestFile {
  name?: string;
  status?: string;
  message?: string;
  assertionResults?: VitestAssertion[];
}
interface VitestReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  testResults?: VitestFile[];
}

/** JSON-отчёт vitest (`--reporter=json`): счётчики и упавшие тесты, включая файлы, которые не выполнились */
export function parseVitestReport(json: unknown, root: string, mask: Mask = patternsOnly): Parsed {
  const report = (json ?? {}) as VitestReport;
  const failures: Failure[] = [];
  for (const file of report.testResults ?? []) {
    const path = file.name ? relPath(root, file.name) : null;
    const failed = (file.assertionResults ?? []).filter((a) => a.status === 'failed');
    for (const a of failed) {
      failures.push({
        name: a.fullName ?? a.title ?? '(без имени)',
        file: path,
        message: cleanMessage(a.failureMessages?.[0] ?? '', mask),
      });
    }
    if (file.status === 'failed' && failed.length === 0) {
      failures.push({
        name: '(файл не выполнился)',
        file: path,
        message: cleanMessage(file.message ?? '', mask),
      });
    }
  }
  return {
    counts: {
      total: num(report.numTotalTests),
      passed: num(report.numPassedTests),
      failed: num(report.numFailedTests),
      skipped: num(report.numPendingTests) + num(report.numTodoTests),
      flaky: 0,
    },
    problems: null,
    failures: failures.slice(0, MAX_FAILURES),
  };
}

interface PlaywrightError {
  message?: string;
}
interface PlaywrightResult {
  status?: string;
  error?: PlaywrightError;
  errors?: PlaywrightError[];
}
interface PlaywrightTest {
  status?: string;
  results?: PlaywrightResult[];
}
interface PlaywrightSpec {
  title?: string;
  file?: string;
  tests?: PlaywrightTest[];
}
interface PlaywrightSuite {
  title?: string;
  file?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}
interface PlaywrightReport {
  config?: { rootDir?: string };
  stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number };
  errors?: PlaywrightError[];
  suites?: PlaywrightSuite[];
}

/** JSON-отчёт Playwright: stats и упавшие/нестабильные тесты; ошибки вне тестов (webServer, teardown) тоже */
export function parsePlaywrightReport(
  json: unknown,
  root: string,
  mask: Mask = patternsOnly,
): Parsed {
  const report = (json ?? {}) as PlaywrightReport;
  const rootDir = report.config?.rootDir ?? root;
  const failures: Failure[] = [];

  for (const e of report.errors ?? []) {
    failures.push({
      name: '(ошибка вне тестов)',
      file: null,
      message: cleanMessage(e.message ?? '', mask),
    });
  }

  const walk = (suite: PlaywrightSuite, titles: string[]): void => {
    // верхний «suite» — сам файл, его заголовок в имени теста лишний
    const own = suite.title && suite.title !== suite.file ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status !== 'unexpected' && test.status !== 'flaky') continue;
        const withError = (test.results ?? []).find((r) => r.error?.message || r.errors?.length);
        failures.push({
          name:
            [...own, spec.title ?? '(без имени)'].join(' › ') +
            (test.status === 'flaky' ? ' (нестабильный)' : ''),
          file: spec.file ? relPath(root, resolve(rootDir, spec.file)) : null,
          message: cleanMessage(
            withError?.error?.message ?? withError?.errors?.[0]?.message ?? '',
            mask,
          ),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, own);
  };
  for (const suite of report.suites ?? []) walk(suite, []);

  const s = report.stats ?? {};
  return {
    counts: {
      total: num(s.expected) + num(s.unexpected) + num(s.flaky) + num(s.skipped),
      passed: num(s.expected),
      failed: num(s.unexpected),
      skipped: num(s.skipped),
      flaky: num(s.flaky),
    },
    problems: null,
    failures: failures.slice(0, MAX_FAILURES),
  };
}

const TSC_PLAIN = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/;
const TSC_PRETTY = /^(.+?):(\d+):\d+ - error (TS\d+): (.*)$/;

export function parseTscOutput(text: string, mask: Mask = patternsOnly): Parsed {
  const failures: Failure[] = [];
  let problems = 0;
  for (const line of stripAnsi(text).split('\n')) {
    const m = TSC_PLAIN.exec(line.trim()) ?? TSC_PRETTY.exec(line.trim());
    if (!m) continue;
    problems += 1;
    if (failures.length < MAX_FAILURES) {
      failures.push({
        name: m[3] ?? 'TS',
        file: `${m[1] ?? ''}:${m[2] ?? ''}`,
        message: mask(m[4] ?? ''),
      });
    }
  }
  return { counts: null, problems, failures };
}

const ESLINT_WITH_RULE = /^\s+(\d+):\d+\s+(error|warning)\s+(.+?)\s{2,}(\S+)$/;
const ESLINT_NO_RULE = /^\s+(\d+):\d+\s+(error|warning)\s+(.+)$/;

/** Вывод eslint в формате stylish: ошибки валят прогон, предупреждения — нет */
export function parseEslintOutput(text: string, root: string, mask: Mask = patternsOnly): Parsed {
  const failures: Failure[] = [];
  let file: string | null = null;
  let errors = 0;
  const clean = stripAnsi(text);
  for (const raw of clean.split('\n')) {
    const line = raw.trimEnd();
    if (/^\S/.test(line) && !line.startsWith('✖')) {
      file = line.startsWith('/') ? relPath(root, line) : line;
      continue;
    }
    const m = ESLINT_WITH_RULE.exec(line) ?? ESLINT_NO_RULE.exec(line);
    if (!m || m[2] !== 'error') continue;
    errors += 1;
    if (failures.length < MAX_FAILURES) {
      failures.push({
        name: m[4] ?? 'eslint',
        file: file ? `${file}:${m[1] ?? ''}` : null,
        message: mask(m[3] ?? ''),
      });
    }
  }
  const summary = /✖ \d+ problems? \((\d+) errors?, \d+ warnings?\)/.exec(clean);
  return { counts: null, problems: summary ? Number(summary[1]) : errors, failures };
}

// ---------------------------------------------------------------------------------------------------
// Лог, отпечаток кода, журнал

/** Длинный лог режется по середине: начало (запуск, окружение) и конец (падения, итоги) сохраняются */
export function capLog(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text) <= maxBytes) return { text, truncated: false };
  const lines = text.split('\n');
  const marker = (skipped: number): string =>
    `\n… пропущено ${skipped} строк: лог длиннее ${Math.round(maxBytes / 1024)} КБ, начало и конец сохранены …\n`;
  const budget = maxBytes - Buffer.byteLength(marker(lines.length));
  const headBudget = Math.floor(budget * 0.25);

  const head: string[] = [];
  let used = 0;
  for (const line of lines) {
    const bytes = Buffer.byteLength(line) + 1;
    if (used + bytes > headBudget) break;
    head.push(line);
    used += bytes;
  }
  const tail: string[] = [];
  for (let i = lines.length - 1; i >= head.length; i -= 1) {
    const line = lines[i] ?? '';
    const bytes = Buffer.byteLength(line) + 1;
    if (used + bytes > budget) break;
    tail.unshift(line);
    used += bytes;
  }
  return {
    text: head.join('\n') + marker(lines.length - head.length - tail.length) + tail.join('\n'),
    truncated: true,
  };
}

/** Отпечаток кода: пары «путь → хэш содержимого», порядок не важен */
export function fingerprint(entries: ReadonlyArray<readonly [string, string]>): string {
  const hash = createHash('sha256');
  const sorted = [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [path, blob] of sorted) hash.update(`${path}\0${blob}\n`);
  return hash.digest('hex');
}

export function runId(startedAt: Date, suite: string, suffix: string): string {
  return `${startedAt.toISOString().slice(0, 19).replace(/:/g, '-')}Z-${suite}-${suffix}`;
}

/** Журнал — список, куда только дописывают; после слияния двух машин в нём может быть мусор — пропускаем */
export function parseJournal(text: string): RunRecord[] {
  const out: RunRecord[] = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    try {
      const r = JSON.parse(s) as Partial<RunRecord>;
      const valid =
        r.v === 1 &&
        typeof r.suite === 'string' &&
        typeof r.startedAt === 'string' &&
        typeof r.fingerprint === 'string' &&
        Array.isArray(r.args) &&
        (r.status === 'passed' || r.status === 'failed' || r.status === 'interrupted');
      if (valid) out.push(r as RunRecord);
    } catch {
      // строка испорчена (прерванная запись или слияние) — не повод терять остальной журнал
    }
  }
  return out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

const ALMATY = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Время для людей — по часовому поясу объекта, как во всех отчётах проекта */
export function almatyTime(iso: string): string {
  const p = Object.fromEntries(ALMATY.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export function durationText(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} мин ${s % 60} с` : `${m} мин`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} ч ${m % 60} мин` : `${h} ч`;
}

export function outcomeText(
  r: Pick<RunRecord, 'status' | 'counts' | 'problems' | 'exitCode'>,
): string {
  if (r.status === 'interrupted') return '⏹ прерван';
  const c = r.counts;
  const extra = c
    ? [c.skipped ? `пропущено ${c.skipped}` : '', c.flaky ? `нестабильных ${c.flaky}` : '']
        .filter(Boolean)
        .map((x) => `, ${x}`)
        .join('')
    : '';
  if (r.status === 'passed') {
    if (!c) return '✅ без ошибок';
    return c.total ? `✅ ${c.passed} из ${c.total}${extra}` : '⚠️ тестов не найдено';
  }
  if (c && c.failed) return `❌ упало ${c.failed} из ${c.total}${extra}`;
  if (r.problems) return `❌ ошибок: ${r.problems}`;
  return `❌ код выхода ${r.exitCode ?? '—'}`;
}

function cell(text: string): string {
  return text
    .replace(/\s*\r?\n\s*/g, ' ')
    .slice(0, 160)
    .replace(/\|/g, '\\|');
}

/** Строка JOURNAL.md: одна строка на прогон, чтобы слияние двух машин складывало строки, а не ломало таблицу */
export function journalRow(r: RunRecord): string {
  const suite = narrowsTestSelection(r.args)
    ? `${r.suite} (частично: ${r.args.join(' ')})`
    : r.suite;
  const commit = r.commit.slice(0, 7) + (r.dirty.length ? ` +${r.dirty.length}` : '');
  const logName = r.log.split('/').pop() ?? r.log;
  const tail = r.note ?? (r.status === 'failed' ? (r.failures[0]?.name ?? '') : '');
  const cells = [
    almatyTime(r.startedAt),
    suite,
    outcomeText(r),
    durationText(r.durationMs),
    commit,
    `[лог](logs/${logName})`,
    tail,
  ];
  return `| ${cells.map(cell).join(' | ')} |`;
}

export const JOURNAL_MD_HEADER = `# Журнал прогонов тестов

Строки дописывает \`npm run test:record\` — по одной на прогон, старые не правятся. Что здесь доказано и когда
прогон можно не повторять — [TESTING.md](../../TESTING.md). Время — Алматы. «+N» у коммита — столько файлов
набора было изменено и не закоммичено в момент запуска.

| Когда | Набор | Итог | Длительность | Коммит | Лог | Заметка или первое падение |
|---|---|---|---|---|---|---|
`;

// ---------------------------------------------------------------------------------------------------
// Разбор запуска и решение «повторять ли»

export function parseRecordArgs(argv: readonly string[]): {
  suite: SuiteDef;
  args: string[];
  note: string | null;
} {
  const names = Object.keys(SUITES).join(', ');
  const [name, ...rest] = argv;
  if (!name || !Object.hasOwn(SUITES, name)) {
    throw new Error(`Укажите набор: ${names}${name ? ` (получено «${name}»)` : ''}`);
  }
  const suite = SUITES[name as SuiteName];
  const args: string[] = [];
  let note: string | null = null;
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i] ?? '';
    if (a === '--note') {
      note = rest[i + 1] ?? null;
      i += 1;
    } else if (a.startsWith('--note=')) {
      note = a.slice('--note='.length);
    } else {
      args.push(a);
    }
  }
  if (args.length && !suite.acceptsArgs) {
    throw new Error(`Набор ${suite.name} не принимает аргументы раннера: ${args.join(' ')}`);
  }
  return { suite, args, note };
}

export type AssessState =
  'never' | 'proven' | 'changed' | 'expired' | 'failing' | 'changed-after-failure';

export interface Assessment {
  state: AssessState;
  /** Последний полный завершённый прогон набора */
  run: RunRecord | null;
  ageHours: number | null;
  /** Частичные прогоны после него — подсказка, что уже проверяли точечно */
  partialsAfter: RunRecord[];
}

export function assess(
  suite: SuiteDef,
  runs: readonly RunRecord[],
  current: { fingerprint: string; now: Date },
): Assessment {
  const mine = runs.filter((r) => r.suite === suite.name);
  // Частичным прогон делает сужение набора (файл, -g, --project), а не то, КАК он запущен:
  // на машине с 8 ГБ сквозные идут только `--workers=1`, и такой прогон — полноценное доказательство
  const full = mine.filter(
    (r) =>
      !narrowsTestSelection(r.args) &&
      r.status !== 'interrupted' &&
      !(r.counts && r.counts.total === 0),
  );
  const last = full.at(-1) ?? null;
  const partialsAfter = mine.filter(
    (r) => narrowsTestSelection(r.args) && (!last || r.startedAt > last.startedAt),
  );
  if (!last) return { state: 'never', run: null, ageHours: null, partialsAfter };

  const ageHours = (current.now.getTime() - Date.parse(last.startedAt)) / 3_600_000;
  const sameCode = last.fingerprint === current.fingerprint && !last.codeChangedDuringRun;
  let state: AssessState;
  if (last.status === 'failed') state = sameCode ? 'failing' : 'changed-after-failure';
  else if (!sameCode) state = 'changed';
  else if (suite.maxAgeHours !== null && ageHours > suite.maxAgeHours) state = 'expired';
  else state = 'proven';
  return { state, run: last, ageHours, partialsAfter };
}
