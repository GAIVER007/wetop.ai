import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Выключатель ARI на сервере через обёртку scripts/ops/ari-server.sh → ari.sh в режиме Docker
 * (plans/server-kz-2026-09-18.md, шаг 5; слито 18.09.2026, набор параллельной сессии сохранён целиком).
 * Проверяем главное: успех считается по ответу САМОГО API, а не по тому, что мы записали в файл
 * (урок 15.09.2026 — «рапорт без проверки»). Подставной `docker compose` подсовывается целиком через COMPOSE.
 */
const SCRIPT = resolve(import.meta.dirname, '../../scripts/ops/ari-server.sh');

/** Подставной `docker compose`: отвечает так, как ответил бы API, перечитавший файл выключателя. */
function fakeCompose(dir: string, options: { ignoresFile?: boolean } = {}): string {
  const path = join(dir, 'fake-compose.sh');
  writeFileSync(
    path,
    `#!/usr/bin/env bash
switch_file="${join(dir, 'deploy/ari.env')}"
stopped=false
if [ "${options.ignoresFile ? 'ignore' : 'read'}" = read ] && grep -qs 'CHANNEX_ARI=off' "$switch_file"; then stopped=true; fi
case "$1" in
  up) exit 0 ;;
  exec) echo "{\\"pending\\":0,\\"failed\\":0,\\"ariStopped\\":$stopped}" ; exit 0 ;;
esac
exit 0
`,
    'utf8',
  );
  chmodSync(path, 0o755);
  return `bash ${path}`;
}

function run(dir: string, command: string, compose: string) {
  return execFileSync('bash', [SCRIPT, command], {
    encoding: 'utf8',
    env: { ...process.env, ROOT: dir, COMPOSE: compose, ARI_ENV_FILE: join(dir, 'deploy/ari.env') },
  });
}

describe('выключатель ARI на сервере', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ari-server-'));
    mkdirSync(join(dir, 'deploy'), { recursive: true });
  });

  it('stop пишет выключатель в файл и подтверждает его ответом API', () => {
    const out = run(dir, 'stop', fakeCompose(dir));
    expect(readFileSync(join(dir, 'deploy/ari.env'), 'utf8')).toContain('CHANNEX_ARI=off');
    expect(out).toContain('исходящий ARI остановлен');
  });

  it('файл записан, а процесс выключателя не видит — это ОШИБКА, а не успех', () => {
    let failed = false;
    try {
      run(dir, 'stop', fakeCompose(dir, { ignoresFile: true }));
    } catch (error) {
      failed = true;
      expect(String((error as { stdout?: string }).stdout)).toContain('ARI НЕ остановлен');
    }
    expect(failed, 'скрипт обязан выйти с ошибкой').toBe(true);
  });

  it('start снимает выключатель и проверяет, что API его больше не видит', () => {
    const file = join(dir, 'deploy/ari.env');
    writeFileSync(file, 'CHANNEX_ARI=off\n');
    const out = run(dir, 'start', fakeCompose(dir));
    // выключатель снят: файла нет либо он пуст — compose читает его как необязательный env_file
    expect(!existsSync(file) || readFileSync(file, 'utf8').trim() === '').toBe(true);
    expect(out).toContain('исходящий ARI включён');
  });

  it('status печатает и файл, и то, что видит API', () => {
    writeFileSync(join(dir, 'deploy/ari.env'), 'CHANNEX_ARI=off\n');
    const out = run(dir, 'status', fakeCompose(dir));
    expect(out).toContain('CHANNEX_ARI=off');
    expect(out).toMatch(/API сейчас: CHANNEX_ARI=off/);
  });

  it('обёртка на сервере launchd не зовёт: его там нет, режим Docker задан явно', () => {
    expect(existsSync(SCRIPT)).toBe(true);
    const wrapper = readFileSync(SCRIPT, 'utf8');
    expect(wrapper).not.toContain('launchctl');
    expect(wrapper).toContain('ARI_MODE=docker');
  });
});
