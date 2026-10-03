import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * scripts/ops/guard/run.sh, дежурный агент на сервере: чем он платит и сколько (ADR-137, замечание ментора 02.10.2026).
 *
 * До 02.10 скрипт принимал токен подписки владельца наравне с ключом API, и ночной разбор делил лимиты с дневной
 * работой владельца. Теперь по умолчанию только ключ API; подписка включается явным GUARD_ALLOW_SUBSCRIPTION=1.
 * Сверху дневной потолок: не больше GUARD_RUNS_PER_DAY запусков за сутки UTC, каждый не дороже
 * GUARD_RUN_BUDGET_USD (`claude -p --max-budget-usd`).
 *
 * Настоящий здесь только скрипт и node. git, curl, timeout и claude подменены; подменённый `sleep` завершает
 * бесконечный цикл после первого круга (код 99).
 */
const SCRIPT = resolve('scripts/ops/guard/run.sh');
const WORK_INCIDENTS = '[{"class":"B","kind":"outbox_stuck"}]';
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const today = () => new Date().toISOString().slice(0, 10);

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'wetop-guard-run-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  const state = join(dir, 'state');
  mkdirSync(bin);
  mkdirSync(state);
  const stub = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  stub(
    'git',
    [
      'echo "git $*" >> "$AUDIT/calls"',
      // git clone --quiet <repo> <work>: клон появляется
      '[ "$1" = clone ] && mkdir -p "$4/.git"',
      'exit 0',
    ].join('\n'),
  );
  stub(
    'curl',
    [
      'echo "curl $*" >> "$AUDIT/calls"',
      'out=""',
      'while [ $# -gt 0 ]; do [ "$1" = -o ] && { out="$2"; shift; }; shift; done',
      '[ -n "$out" ] && [ "$out" != /dev/null ] && printf "%s" "$INCIDENTS" > "$out"',
      'exit 0',
    ].join('\n'),
  );
  stub('timeout', 'shift\nexec "$@"');
  stub(
    'claude',
    [
      '{ echo "args: $*"; echo "api_key=${ANTHROPIC_API_KEY:+set}"; echo "oauth=${CLAUDE_CODE_OAUTH_TOKEN:+set}"; } >> "$AUDIT/claude"',
      'exit 0',
    ].join('\n'),
  );
  stub('sleep', 'exit 99');
  const run = (env: Record<string, string>, incidents = WORK_INCIDENTS) => {
    const inherited = { ...process.env };
    for (const k of Object.keys(inherited))
      if (/^(ANTHROPIC_|CLAUDE_CODE_|GUARD_|TELEGRAM_)/.test(k)) delete inherited[k];
    const r = spawnSync('sh', [SCRIPT], {
      encoding: 'utf8',
      timeout: 15_000,
      env: {
        ...inherited,
        PATH: `${bin}:${process.env.PATH}`,
        AUDIT: dir,
        INCIDENTS: incidents,
        GUARD_READ_KEY: 'read-key',
        GUARD_REPO: 'git@example.invalid:wetop.git',
        GUARD_STATE_DIR: state,
        ...env,
      },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const claudeCalls = () =>
    existsSync(join(dir, 'claude')) ? readFileSync(join(dir, 'claude'), 'utf8') : '';
  const calls = () => (existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8') : '');
  const runsFile = join(state, 'runs-today');
  return { run, claudeCalls, calls, runsFile, state };
}

describe('дежурный агент: платит ключ API, подписка только явно (ADR-137)', () => {
  it('только токен подписки: отказ до первого круга, модель не зовётся', () => {
    const s = sandbox();
    const r = s.run({ CLAUDE_CODE_OAUTH_TOKEN: 'subscription-token' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('ANTHROPIC_API_KEY');
    expect(r.out).toContain('GUARD_ALLOW_SUBSCRIPTION=1');
    expect(s.claudeCalls()).toBe('');
    expect(s.calls()).toBe('');
  });

  it('ни ключа, ни токена: отказ с подсказкой про ключ', () => {
    const s = sandbox();
    const r = s.run({});
    expect(r.code).toBe(1);
    expect(r.out).toContain('ANTHROPIC_API_KEY');
    expect(s.claudeCalls()).toBe('');
  });

  it('заданы оба: платит ключ, токен подписки процессу агента не достаётся', () => {
    const s = sandbox();
    const r = s.run({ ANTHROPIC_API_KEY: 'api-key', CLAUDE_CODE_OAUTH_TOKEN: 'subscription-token' });
    expect(r.code, r.out).toBe(99);
    expect(r.out).toContain('платит ключ API');
    const claude = s.claudeCalls();
    expect(claude).toContain('api_key=set');
    expect(claude).toMatch(/^oauth=$/m);
    // значения ключей в журнал скрипта не попадают
    expect(r.out).not.toContain('api-key');
    expect(r.out).not.toContain('subscription-token');
  });

  it('подписка с явным GUARD_ALLOW_SUBSCRIPTION=1 работает и называет себя в журнале', () => {
    const s = sandbox();
    const r = s.run({ CLAUDE_CODE_OAUTH_TOKEN: 'subscription-token', GUARD_ALLOW_SUBSCRIPTION: '1' });
    expect(r.code, r.out).toBe(99);
    expect(r.out).toContain('подписка владельца');
    expect(s.claudeCalls()).toContain('oauth=set');
  });
});

describe('дежурный агент: дневной потолок денег (ADR-137)', () => {
  it('каждый запуск с потолком --max-budget-usd и счётчиком за сутки UTC', () => {
    const s = sandbox();
    const r = s.run({ ANTHROPIC_API_KEY: 'api-key', GUARD_RUN_BUDGET_USD: '1.5' });
    expect(r.code, r.out).toBe(99);
    expect(s.claudeCalls()).toContain('--max-budget-usd 1.5');
    expect(readFileSync(s.runsFile, 'utf8').trim()).toBe(`${today()} 1`);
    expect(r.out).toContain('запуск 1 из 4');
  });

  it('предел запусков исчерпан: модель не зовётся, дежурным одно сообщение за сутки', () => {
    const s = sandbox();
    writeFileSync(s.runsFile, `${today()} 4\n`);
    const env = { ANTHROPIC_API_KEY: 'api-key', TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_CHAT_ID: '42' };
    const first = s.run(env);
    expect(first.code, first.out).toBe(99);
    expect(first.out).toContain('дневной предел запусков исчерпан (4 из 4)');
    expect(s.claudeCalls()).toBe('');
    const notices = () => s.calls().split('\n').filter((l) => l.includes('дневной предел')).length;
    expect(notices()).toBe(1);
    s.run(env);
    expect(notices(), 'второе сообщение в те же сутки').toBe(1);
    expect(readFileSync(s.runsFile, 'utf8').trim()).toBe(`${today()} 4`);
  });

  it('вчерашний счётчик не мешает: новые сутки начинаются с первого запуска', () => {
    const s = sandbox();
    writeFileSync(s.runsFile, '2000-01-01 4\n');
    const r = s.run({ ANTHROPIC_API_KEY: 'api-key' });
    expect(r.code, r.out).toBe(99);
    expect(s.claudeCalls()).toContain('--max-budget-usd 2');
    expect(readFileSync(s.runsFile, 'utf8').trim()).toBe(`${today()} 1`);
  });

  it('тихий час: нет неисправностей класса Б и В, модель не зовётся и счётчик не растёт', () => {
    const s = sandbox();
    const r = s.run({ ANTHROPIC_API_KEY: 'api-key' }, '[{"class":"A"}]');
    expect(r.code, r.out).toBe(99);
    expect(s.claudeCalls()).toBe('');
    expect(existsSync(s.runsFile)).toBe(false);
  });
});
