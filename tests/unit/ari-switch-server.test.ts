/**
 * `scripts/ops/ari.sh` на сервере (plans/server-kz-2026-09-17.md; CUTOVER.md ROLLBACK, полный откат, шаг 1).
 *
 * Выключатель исходящего ARI был написан только под Mac: `launchctl setenv`, `kickstart`, `lsof`, `ps eww`.
 * На сервере ничего этого нет, то есть первый шаг полного отката там просто не выполнялся бы — а откат
 * входит в условие допуска №3. Здесь проверяется ветка для Docker: настоящие контейнеры не трогаются,
 * `docker` и `curl` подставные.
 *
 * Побочный выигрыш ветки Docker: состояние выключателя лежит файлом рядом с compose и **переживает
 * перезагрузку**, тогда как `launchctl setenv` на Mac её не переживает (предупреждение в шапке скрипта).
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ARI = resolve(import.meta.dirname, '../../scripts/ops/ari.sh');

interface Case {
  /** Что печатает `printenv CHANNEX_ARI` внутри контейнера после перезапуска. */
  containerSwitch?: string;
  /** Есть ли файл выключателя до запуска команды. */
  stopped?: boolean;
}

interface Run {
  code: number;
  out: string;
  /** Содержимое ari.env после команды, либо null, если файла нет. */
  envFile: string | null;
  /** Строки вызовов подставного docker. */
  docker: string;
}

function run(args: string[], opts: Case = {}): Run {
  const dir = mkdtempSync(join(tmpdir(), 'ari-'));
  const bin = join(dir, 'bin');
  const deploy = join(dir, 'deploy');
  mkdirSync(bin);
  mkdirSync(deploy);
  const calls = join(dir, 'docker.log');
  const compose = join(deploy, 'compose.yml');
  writeFileSync(compose, 'name: pms-lux\n');
  const ariEnv = join(deploy, 'ari.env');
  if (opts.stopped) writeFileSync(ariEnv, 'CHANNEX_ARI=off\n');
  const script = (name: string, body: string) => {
    const file = join(bin, name);
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
    chmodSync(file, 0o755);
  };
  // printenv внутри контейнера отвечает тем, что лежит в файле выключателя, — как настоящий env_file
  script(
    'docker',
    `echo "$*" >> "${calls}"
if [ "$*" = "${'${*}'}" ]; then :; fi
case "$*" in
  *"printenv CHANNEX_ARI"*)
    ${
      opts.containerSwitch === undefined
        ? `if [ -f "${ariEnv}" ]; then echo off; else exit 1; fi`
        : `echo '${opts.containerSwitch}'`
    } ;;
esac
exit 0`,
  );
  // Живость: скрипт спрашивает /health и ждёт ровно «200». Очередь отвечает телом.
  script(
    'curl',
    `case "$*" in
  */health*) printf '200' ;;
  *) echo '{"pending":0,"sent":0}' ;;
esac`,
  );
  const res = spawnSync('bash', [ARI, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`, // launchctl недоступен: машина не Mac
      ARI_MODE: 'docker',
      COMPOSE_FILE: compose,
    },
  });
  return {
    code: res.status ?? -1,
    out: res.stdout + res.stderr,
    envFile: existsSync(ariEnv) ? readFileSync(ariEnv, 'utf8') : null,
    docker: existsSync(calls) ? readFileSync(calls, 'utf8') : '',
  };
}

describe('ari.sh на сервере (Docker)', () => {
  it('stop кладёт выключатель файлом и пересоздаёт контейнер API', () => {
    const r = run(['stop']);
    expect(r.code).toBe(0);
    expect(r.envFile).toContain('CHANNEX_ARI=off');
    expect(r.docker).toMatch(/up -d --force-recreate api/);
  });

  it('start убирает файл и пересоздаёт контейнер', () => {
    const r = run(['start'], { stopped: true, containerSwitch: '' });
    expect(r.code).toBe(0);
    expect(r.envFile).toBeNull();
    expect(r.docker).toMatch(/up -d --force-recreate api/);
  });

  it('stop не рапортует успех, если контейнер выключателя не увидел', () => {
    const r = run(['stop'], { containerSwitch: 'on' });
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/ARI НЕ остановлен/);
  });

  it('start не рапортует успех, если контейнер всё ещё видит off', () => {
    const r = run(['start'], { stopped: true, containerSwitch: 'off' });
    expect(r.code).not.toBe(0);
  });

  it('status показывает и файл, и то, что видит запущенный API', () => {
    const r = run(['status'], { stopped: true });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/остановлен|off/i);
  });
});
