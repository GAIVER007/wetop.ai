import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ROOT } from '../tools/git-state';
import {
  JOURNAL_FILE,
  JOURNAL_MD,
  JOURNAL_MD_HEADER,
  SUITES,
  assess,
  parseJournal,
  runId,
  type RunRecord,
} from '../tools/journal';
import { readJournalText, writeRunRecord } from '../tools/journal-files';

/**
 * Две ветки от одного предка, в каждой свой прогон `test:record`: GitHub должен слить их без конфликта в `tests/runs/`.
 * Правило `merge=union` из `.gitattributes` GitHub не применяет (разбор PR #329, 09.10.2026), поэтому во временном
 * репозитории его нет: проверяем то, что увидит GitHub.
 */
function record(suite: string, startedAt: string, suffix: string): RunRecord {
  return {
    v: 1,
    id: runId(new Date(startedAt), suite, suffix),
    suite,
    args: [],
    command: 'npx vitest run --project unit',
    startedAt,
    durationMs: 1000,
    exitCode: 0,
    signal: null,
    status: 'passed',
    counts: { total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0 },
    problems: null,
    failures: [],
    commit: '0000000000000000000000000000000000000000',
    branch: 'test',
    dirty: [],
    fingerprint: `fp-${suffix}`,
    codeChangedDuringRun: false,
    log: `tests/runs/logs/${runId(new Date(startedAt), suite, suffix)}.log`,
    logTruncated: false,
    machine: 'test',
    note: null,
  };
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

describe('журнал прогонов: две ветки сливаются без конфликта', () => {
  it('у каждой ветки свой прогон от одного предка, merge-tree чистый', () => {
    const repo = mkdtempSync(join(tmpdir(), 'journal-merge-'));
    dirs.push(repo);
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.email', 'test@example.invalid');
    git(repo, 'config', 'user.name', 'test');
    mkdirSync(join(repo, 'tests/runs'), { recursive: true });
    // предок: архив прошлых прогонов, как в репозитории сейчас
    writeFileSync(join(repo, JOURNAL_FILE), `${JSON.stringify(record('unit', '2026-10-01T10:00:00.000Z', 'base'))}\n`);
    writeFileSync(join(repo, JOURNAL_MD), JOURNAL_MD_HEADER);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'base');

    for (const [branch, at, suffix] of [
      ['a', '2026-10-09T10:00:00.000Z', 'aaaa'],
      ['b', '2026-10-09T10:00:05.000Z', 'bbbb'],
    ] as const) {
      git(repo, 'switch', '-q', '-c', branch, 'main');
      writeRunRecord(repo, record('unit', at, suffix));
      git(repo, 'add', '-A');
      git(repo, 'commit', '-q', '-m', `run ${branch}`);
    }

    const merged = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', 'a', 'b'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(merged.stdout.split('\n').slice(1).filter(Boolean), 'файлы с конфликтом').toEqual([]);
    expect(merged.status).toBe(0);
  });
});

describe('журнал из записей: test:status видит то же, что видел по общему файлу', () => {
  it('нынешний journal.jsonl, разложенный по записям, даёт те же прогоны и те же вердикты', () => {
    const archive = readFileSync(resolve(ROOT, JOURNAL_FILE), 'utf8');
    const before = parseJournal(archive);
    expect(before.length).toBeGreaterThan(100);
    // копии одного прогона (след `merge=union`) читаются один раз
    expect(new Set(before.map((r) => r.id)).size).toBe(before.length);

    const repo = mkdtempSync(join(tmpdir(), 'journal-entries-'));
    dirs.push(repo);
    for (const r of before) writeRunRecord(repo, r);
    const after = parseJournal(readJournalText(repo));
    expect(after).toEqual(before);

    const now = new Date(before.at(-1)!.startedAt);
    for (const suite of Object.values(SUITES)) {
      const fingerprint = [...before].reverse().find((r) => r.suite === suite.name)?.fingerprint ?? 'none';
      expect(assess(suite, after, { fingerprint, now }), suite.name).toEqual(
        assess(suite, before, { fingerprint, now }),
      );
    }
  });

  it('архив и записи вместе: старое из архива, новое из записи, порядок по времени', () => {
    const repo = mkdtempSync(join(tmpdir(), 'journal-both-'));
    dirs.push(repo);
    mkdirSync(join(repo, 'tests/runs'), { recursive: true });
    writeFileSync(join(repo, JOURNAL_FILE), `${JSON.stringify(record('unit', '2026-10-01T10:00:00.000Z', 'old'))}\n`);
    writeRunRecord(repo, record('unit', '2026-10-09T10:00:00.000Z', 'new'));
    expect(parseJournal(readJournalText(repo)).map((r) => r.fingerprint)).toEqual(['fp-old', 'fp-new']);
  });
});
