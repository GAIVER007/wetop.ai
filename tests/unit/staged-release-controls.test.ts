import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = '4a7c86b20114d8bc497baaca37f9ae200340bd3e';
const BASE = '29fd2fda0889d06aafceca055a7b0d1742869799';
const MAIN = '2a8f7aab9c8405e03999c005d99b61ffbe8efacf';
const image = readFileSync(resolve('.github/workflows/verified-release-image.yml'), 'utf8');
const promotion = readFileSync(resolve('.github/workflows/auto-release.yml'), 'utf8');
const block = image.match(/python3 - <<'PY'\n([\s\S]*?)\n {10}PY/);
if (!block) throw new Error('Actual pre-build Python verifier missing');
const guardCode = block[1]!.split('\n').map(line => line.slice(10)).join('\n');
const harness = `
import contextlib, io, json, os
from unittest.mock import patch
case = json.loads(os.environ['CASE_INPUT'])
code = os.environ['GUARD_CODE']
calls = []
def fake(args, **kwargs):
    path = args[-1]
    calls.append(path)
    for suffix, response in case['responses'].items():
        if path.endswith(suffix):
            return json.dumps(response)
    raise AssertionError('Unexpected API request: ' + path)
accepted = False
with patch.dict(os.environ, {'SOURCE_SHA': case['source'], 'SOURCE_GATE_RUN': case['gate']}, clear=True), patch('subprocess.check_output', side_effect=fake), contextlib.redirect_stdout(io.StringIO()):
    try:
        exec(code, {'__name__': '__main__'})
        accepted = True
    except SystemExit:
        pass
print(json.dumps({'accepted': accepted, 'calls': len(calls)}))
`;
function fixture() {
  return {
    source: SOURCE,
    gate: '123',
    responses: {
      'git/ref/heads/main': { object: { sha: MAIN } },
      'git/ref/heads/release': { object: { sha: BASE } },
      [`compare/${SOURCE}...${MAIN}`]: { status: 'ahead', merge_base_commit: { sha: SOURCE }, files: [] },
      [`compare/${BASE}...${SOURCE}`]: {
        status: 'ahead', merge_base_commit: { sha: BASE },
        files: [{ filename: 'apps/web/src/app/finance/finance-board.tsx', status: 'modified' }],
      },
      'actions/runs/123': {
        head_sha: SOURCE, head_branch: 'fix/staged-finance-release-20261019',
        head_repository: { full_name: 'GAIVER007/wetop.ai' },
        path: '.github/workflows/release-checks.yml', status: 'completed', conclusion: 'success',
      },
      'actions/runs/123/jobs?per_page=100': {
        total_count: 16, jobs: Array.from({ length: 16 }, () => ({ conclusion: 'success' })),
      },
    } as Record<string, unknown>,
  };
}
type Case = ReturnType<typeof fixture>;
function verify(input: Case) {
  const result = spawnSync('python3', ['-c', harness], {
    encoding: 'utf8', timeout: 10_000,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', GUARD_CODE: guardCode, CASE_INPUT: JSON.stringify(input) },
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { accepted: boolean; calls: number };
}
const run = (c: Case) => c.responses['actions/runs/123'] as Record<string, unknown>;
const jobs = (c: Case) => c.responses['actions/runs/123/jobs?per_page=100'] as { total_count: number; jobs: Array<{ conclusion: string | null }> };
const ancestry = (c: Case) => c.responses[`compare/${BASE}...${SOURCE}`] as { status: string; merge_base_commit: { sha: string }; files: Array<{ filename: string; status: string }> };

describe('stage1 image preparation before production promotion', () => {
  it('builds the exact fully-green FIN stage while release still points at its approved base', () => {
    expect(verify(fixture()).accepted).toBe(true);
  });
  it.each([
    ['unapproved source', (c: Case) => { c.source = 'a'.repeat(40); }],
    ['moved release', (c: Case) => { c.responses['git/ref/heads/release'] = { object: { sha: SOURCE } }; }],
    ['diverged source', (c: Case) => { ancestry(c).status = 'diverged'; }],
    ['reverse ancestry', (c: Case) => { ancestry(c).status = 'behind'; }],
    ['wrong merge base', (c: Case) => { ancestry(c).merge_base_commit.sha = MAIN; }],
    ['SQL delta', (c: Case) => { ancestry(c).files.push({ filename: 'packages/database/prisma/migrations/unsafe/migration.sql', status: 'added' }); }],
    ['API delta', (c: Case) => { ancestry(c).files.push({ filename: 'apps/api/src/auth/auth.service.ts', status: 'modified' }); }],
    ['dependency delta', (c: Case) => { ancestry(c).files.push({ filename: 'package-lock.json', status: 'modified' }); }],
    ['incomplete file inventory', (c: Case) => { ancestry(c).files = Array.from({ length: 300 }, () => ({ filename: 'DECISIONS.md', status: 'modified' })); }],
    ['wrong source gate', (c: Case) => { run(c).head_sha = MAIN; }],
    ['wrong workflow', (c: Case) => { run(c).path = '.github/workflows/finance-presentation-regression.yml'; }],
    ['foreign repository', (c: Case) => { run(c).head_repository = { full_name: 'untrusted/fork' }; }],
    ['unfinished run', (c: Case) => { run(c).status = 'in_progress'; }],
    ['failed run', (c: Case) => { run(c).conclusion = 'failure'; }],
    ['missing job', (c: Case) => { jobs(c).jobs.pop(); jobs(c).total_count = 15; }],
    ['hidden extra jobs', (c: Case) => { jobs(c).total_count = 17; }],
    ['skipped job', (c: Case) => { jobs(c).jobs[0]!.conclusion = 'skipped'; }],
    ['failed job', (c: Case) => { jobs(c).jobs[0]!.conclusion = 'failure'; }],
    ['unfinished job', (c: Case) => { jobs(c).jobs[0]!.conclusion = null; }],
  ] as const)('refuses %s', (_name, mutate) => {
    const input = fixture(); mutate(input);
    expect(verify(input).accepted).toBe(false);
  });
  it.each(['$(touch /tmp/not-executed)', `${SOURCE}\n`, SOURCE.toUpperCase()])('rejects malformed SHA before API calls: %s', (value) => {
    const input = fixture(); input.source = value;
    expect(verify(input)).toEqual({ accepted: false, calls: 0 });
  });
  it.each(['1;true', '123\n', '../123'])('rejects malformed gate before API calls: %s', (value) => {
    const input = fixture(); input.gate = value;
    expect(verify(input)).toEqual({ accepted: false, calls: 0 });
  });
});

describe('ordinary release promotion (staged window retired 19.10.2026)', () => {
  // The FIN-only window pinned 4a7c86b2, which is not a descendant of the published release d54ae3b1,
  // so the fast-forward guard rejected it and every other green main was held: nothing could deploy.
  // Owner instruction 19.10.2026 «давай продолжай» chose to retire the stale hold. The ordinary
  // green-gate, main-ancestry, fast-forward and migration-refusal guards stay mandatory.
  it('does not pin a single source or hold other green main results', () => {
    expect(promotion).not.toContain('STAGED_RELEASE_SOURCE_SHA');
    expect(promotion).not.toContain('STAGED-WINDOW');
    expect(promotion).not.toContain(SOURCE);
  });
  it('keeps every ordinary promotion guard, ahead of the release push', () => {
    const push = promotion.indexOf('git push origin "${target}:refs/heads/release"');
    expect(push).toBeGreaterThan(0);
    for (const guard of [
      'select(.conclusion == "success")',
      'git merge-base --is-ancestor "$target" origin/main',
      'git merge-base --is-ancestor "$release" "$target"',
      'packages/database/prisma/migrations',
    ]) {
      const at = promotion.indexOf(guard);
      expect(at, guard).toBeGreaterThan(0);
      expect(at, guard).toBeLessThan(push);
    }
    expect(promotion).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(promotion).toContain("github.event.workflow_run.head_branch == 'main'");
    const pushes = promotion.split('\n').filter(line => /^\s*git push\b/.test(line));
    expect(pushes).toEqual(['          git push origin "${target}:refs/heads/release"']);
  });
});
