import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const records = [];
for (const root of ['.', 'ui-fix-01-baseline', 'ui-fix-01-new-draft-red']) {
  let paths;
  try {
    paths = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', 'tests/runs/entries'],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    continue;
  }
  for (const path of paths) {
    const r = JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
    records.push({
      source:
        root === '.'
          ? 'candidate'
          : root === 'ui-fix-01-baseline'
            ? 'baseline'
            : 'prior-candidate-new-draft-red',
      id: r.id,
      suite: r.suite,
      args: r.args,
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      exitCode: r.exitCode,
      signal: r.signal,
      status: r.status,
      counts: r.counts,
      commit: r.commit,
      fingerprint: r.fingerprint,
      codeChangedDuringRun: r.codeChangedDuringRun,
    });
  }
}
mkdirSync('reports/ui-fix-01-2026-10-12', { recursive: true });
writeFileSync(
  'reports/ui-fix-01-2026-10-12/remote-checks.json',
  JSON.stringify(
    {
      candidate: process.env.GITHUB_SHA,
      outcomes: Object.fromEntries(
        ['ADDRESSED', 'RUNTIME', 'REGRESSION', 'BEFORE', 'AFTER', 'STALE_RED', 'NEW_DRAFT_RED'].map(
          (name) => [name, process.env[`PROOF_${name}`] ?? 'unknown'],
        ),
      ),
      records,
    },
    null,
    2,
  ) + '\n',
);
