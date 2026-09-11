/**
 * Утренний отчёт — делается каждое утро до начала работы. Запуск из корня:
 *   npx tsx scripts/reconciliation/src/cli-morning-report.ts [YYYY-MM-DD]
 * Пишет reports/morning/<дата>.md: «Сделано вчера» (git log за предыдущие сутки по Алматы),
 * «Сверки» (последние отчёты по имени файла и их RESULT), «Тесты» (итог npx vitest run, не дольше
 * 5 минут), «Вопросы владельцу» (QUESTIONS.md: OPEN + ВЛАДЕЛЕЦ) и два раздела для заполнения руками.
 * Ничего не читает из .env и не трогает базу: только git, файлы отчётов и запуск тестов.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  almatyDate,
  groupSubjects,
  latestReport,
  ownerOpenQuestions,
  parseVitestSummary,
  renderMorningReport,
  resultLine,
  shiftDate,
} from './morning-report';

const ROOT = resolve(import.meta.dirname, '../../..');
const REPORT_KINDS = ['inventory', 'double-entry', 'rates', 'balances', 'channex-ari'];
const TESTS_TIMEOUT_MS = 5 * 60_000;

const arg = process.argv[2];
if (arg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  console.error('Дата — в виде YYYY-MM-DD, например 2026-09-11');
  process.exit(2);
}
const date = arg ?? almatyDate(new Date());
const yesterday = shiftDate(date, -1);

// «Сделано вчера»: только subject коммитов за предыдущие сутки по часам объекта (+05:00)
const subjects = execFileSync(
  'git',
  ['log', `--since=${yesterday}T00:00:00+05:00`, `--until=${date}T00:00:00+05:00`, '--format=%s'],
  { cwd: ROOT, encoding: 'utf-8' },
)
  .split('\n')
  .filter((s) => s.trim() !== '');

// «Сверки»: последний файл каждого вида по имени и его строка RESULT
const reportFiles = readdirSync(resolve(ROOT, 'reports'));
const reconciliations = REPORT_KINDS.map((kind) => {
  const file = latestReport(reportFiles, kind);
  const result = file ? resultLine(readFileSync(resolve(ROOT, 'reports', file), 'utf-8')) : null;
  return { kind, file, result };
});

// «Тесты»: полный прогон vitest с потолком 5 минут; при таймауте — пометка вместо чисел
const started = Date.now();
const run = spawnSync('npx', ['vitest', 'run'], {
  cwd: ROOT,
  encoding: 'utf-8',
  timeout: TESTS_TIMEOUT_MS,
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, CI: '1', NO_COLOR: '1' },
});
const timedOut =
  (run.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT' ||
  run.signal === 'SIGTERM';
const tests = {
  ...parseVitestSummary(`${run.stdout ?? ''}\n${run.stderr ?? ''}`),
  timedOut,
  durationMs: Date.now() - started,
};

// «Вопросы владельцу»
const questions = ownerOpenQuestions(readFileSync(resolve(ROOT, 'QUESTIONS.md'), 'utf-8'));

const md = renderMorningReport({
  date,
  yesterday,
  commits: groupSubjects(subjects),
  reconciliations,
  tests,
  questions,
});
mkdirSync(resolve(ROOT, 'reports/morning'), { recursive: true });
const out = resolve(ROOT, `reports/morning/${date}.md`);
writeFileSync(out, `${md}\n`);
console.log(md);
console.log(`→ ${out}`);
