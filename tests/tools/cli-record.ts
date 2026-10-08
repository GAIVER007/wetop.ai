/**
 * Прогон набора тестов с записью в журнал (TESTING.md). Вывод идёт на экран как обычно, а в tests/runs/
 * остаются лог без секретов и строка журнала — чтобы доказанное на том же коде не гонять заново.
 *
 * Запуск: npm run test:record -- <unit|integration|e2e|typecheck|lint> [аргументы раннера] [--note "зачем"]
 * Код выхода — как у раннера.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse as parseDotEnv } from 'dotenv';
import { ROOT, codeFingerprint, currentBranch, dirtyFiles, headCommit } from './git-state';
import { acquireRunLock, lockNameFor } from './run-lock';
import {
  JOURNAL_FILE,
  JOURNAL_MD,
  JOURNAL_MD_HEADER,
  LOG_DIR,
  almatyTime,
  capLog,
  durationText,
  journalRow,
  maskSecrets,
  outcomeText,
  parseEslintOutput,
  parsePlaywrightReport,
  parseRecordArgs,
  parseTscOutput,
  parseVitestReport,
  runId,
  secretValuesFromEnv,
  stripAnsi,
  type Parsed,
  type RunRecord,
  type Runner,
} from './journal';

const MAX_LOG_BYTES = 512 * 1024;
const LOCK_DIR = 'tests/runs/.locks';
const MAX_DIRTY = 50;

const quote = (arg: string): string => `'${arg.replace(/'/g, `'\\''`)}'`;

/** Значения секретов нужны только чтобы вычеркнуть их из лога; наружу они не выводятся */
function secretValues(): string[] {
  const file = resolve(ROOT, '.env');
  const fromFile = existsSync(file) ? parseDotEnv(readFileSync(file)) : {};
  return secretValuesFromEnv({ ...fromFile, ...process.env });
}

function readResults(
  runner: Runner,
  reportFile: string,
  output: string,
  mask: (s: string) => string,
): Parsed {
  if (runner === 'tsc') return parseTscOutput(output, mask);
  if (runner === 'eslint') return parseEslintOutput(output, ROOT, mask);
  if (existsSync(reportFile)) {
    try {
      const json: unknown = JSON.parse(readFileSync(reportFile, 'utf8'));
      return runner === 'vitest'
        ? parseVitestReport(json, ROOT, mask)
        : parsePlaywrightReport(json, ROOT, mask);
    } catch {
      // отчёт не дописан (раннер упал) — итог определит код выхода
    }
  }
  return { counts: null, problems: null, failures: [] };
}

function main(): void {
  let parsed: ReturnType<typeof parseRecordArgs>;
  try {
    parsed = parseRecordArgs(process.argv.slice(2));
  } catch (e) {
    console.error(
      `${(e as Error).message}\nПример: npm run test:record -- unit --note "после правки штрафов"`,
    );
    process.exit(2);
  }
  const { suite, args, note } = parsed;

  /*
   * Наборам, которым нужна общая dev-БД, замок на дерево: два прогона одновременно рвут друг другу
   * test-results/ и занимают койки в чужих окнах дат (tests/tools/run-lock.ts). Чистым наборам он не нужен.
   */
  const lockName = lockNameFor(suite.needs);
  const lock = lockName ? acquireRunLock(LOCK_DIR, lockName, suite.name) : null;
  if (lock && !lock.ok) {
    console.error(
      `✗ прогон «${lock.holder.suite}» уже идёт в этом дереве: pid ${lock.holder.pid}, начат ` +
        `${almatyTime(lock.holder.startedAt)} Алматы. Дождитесь его: два прогона на общей dev-БД ` +
        'рвут друг другу test-results/, занимают койки в чужих окнах дат и вычерпывают пулер.',
    );
    process.exit(4);
  }
  const unlock = () => lock?.ok && lock.release();

  const started = new Date();
  const id = runId(started, suite.name, randomBytes(2).toString('hex'));
  const commit = headCommit();
  const branch = currentBranch();
  const fingerprintAtStart = codeFingerprint(suite.watch);
  const dirty = dirtyFiles(suite.watch);
  const reportFile = join(tmpdir(), `pms-test-${id}.json`);

  let command = suite.command;
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (suite.runner === 'vitest') {
    command += ` --reporter=default --reporter=json --outputFile.json=${quote(reportFile)}`;
  }
  if (suite.runner === 'playwright') {
    command += ' --reporter=list,json';
    env.PLAYWRIGHT_JSON_OUTPUT_FILE = reportFile;
  }
  if (args.length) command += ` ${args.map(quote).join(' ')}`;

  console.log(`▶ ${suite.title} (${suite.name}) — нужно: ${suite.needs}\n  ${command}\n`);

  const chunks: Buffer[] = [];
  const child = spawn(command, { cwd: ROOT, env, shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
  child.stdout.on('data', (b: Buffer) => {
    process.stdout.write(b);
    chunks.push(b);
  });
  child.stderr.on('data', (b: Buffer) => {
    process.stderr.write(b);
    chunks.push(b);
  });

  let interrupted = false;
  const forward = (signal: NodeJS.Signals): void => {
    interrupted = true;
    child.kill(signal);
  };
  // Ctrl+C и `kill` раннера не должны оставить замок: следующий прогон иначе ждал бы мёртвого хозяина
  process.on('exit', () => unlock());
  process.on('SIGINT', forward);
  process.on('SIGTERM', forward);

  child.on('close', (code, signal) => {
    unlock();
    const durationMs = Date.now() - started.getTime();
    const values = secretValues();
    const mask = (text: string): string => maskSecrets(text, values);
    const output = stripAnsi(Buffer.concat(chunks).toString('utf8'));
    const results = readResults(suite.runner, reportFile, output, mask);
    const status: RunRecord['status'] =
      interrupted || signal
        ? 'interrupted'
        : code === 0 && !results.counts?.failed
          ? 'passed'
          : 'failed';
    const codeChangedDuringRun = codeFingerprint(suite.watch) !== fingerprintAtStart;

    const logPath = `${LOG_DIR}/${id}.log`;
    const head = [
      `# ${suite.title} (${suite.name}) · ${almatyTime(started.toISOString())} Алматы · ${hostname()}`,
      `# коммит ${commit.slice(0, 7)} (${branch})${dirty.length ? `, незакоммиченных файлов набора: ${dirty.length}` : ''}`,
      `# ${command}`,
      '',
    ].join('\n');
    const foot = `\n# код выхода ${code ?? '—'}${signal ? `, сигнал ${signal}` : ''} · ${durationText(durationMs)}`;
    const log = capLog(mask(`${head}${output}${foot}\n`), MAX_LOG_BYTES);
    mkdirSync(resolve(ROOT, LOG_DIR), { recursive: true });
    writeFileSync(resolve(ROOT, logPath), log.text);

    const record: RunRecord = {
      v: 1,
      id,
      suite: suite.name,
      args,
      command: mask(command.replace(quote(reportFile), '<отчёт>')),
      startedAt: started.toISOString(),
      durationMs,
      exitCode: code,
      signal,
      status,
      counts: results.counts,
      problems: results.problems,
      failures: results.failures,
      commit,
      branch,
      dirty: dirty.slice(0, MAX_DIRTY),
      fingerprint: fingerprintAtStart,
      codeChangedDuringRun,
      log: logPath,
      logTruncated: log.truncated,
      machine: hostname().replace(/\.local$/, ''),
      note: note === null ? null : mask(note),
    };
    appendFileSync(resolve(ROOT, JOURNAL_FILE), `${JSON.stringify(record)}\n`);
    const md = resolve(ROOT, JOURNAL_MD);
    if (!existsSync(md)) writeFileSync(md, JOURNAL_MD_HEADER);
    appendFileSync(md, `${journalRow(record)}\n`);
    if (process.env.TEST_RECORD_PRESERVE_JSON === '1' && existsSync(reportFile))
      writeFileSync(resolve(ROOT, 'tests/runs', `${id}.json`), mask(readFileSync(reportFile, 'utf8')), { mode: 0o600 });
    rmSync(reportFile, { force: true });

    console.log(`\n■ ${suite.name}: ${outcomeText(record)} · ${durationText(durationMs)}`);
    if (codeChangedDuringRun)
      console.log('  код набора менялся во время прогона — как доказательство не засчитан');
    console.log(`  лог: ${logPath}\n  журнал: ${JOURNAL_MD} · что доказано: npm run test:status`);
    process.exit(code ?? 1);
  });
}

main();
