/**
 * `scripts/ops/ari.sh` на сервере (plans/server-kz-2026-09-17.md; CUTOVER.md ROLLBACK, полный откат, шаг 1).
 *
 * Выключатель исходящего ARI был написан только под Mac: `launchctl setenv`, `kickstart`, `lsof`, `ps eww`.
 * На сервере ничего этого нет, то есть первый шаг полного отката там просто не выполнялся бы — а откат
 * входит в условие допуска №3. Здесь проверяется ветка для Docker: настоящие контейнеры не трогаются,
 * `docker` подставной.
 *
 * Механика ветки Docker (18.09.2026, слито из ari-server.sh параллельной сессии): портов наружу у compose
 * нет, поэтому API спрашивается изнутри контейнера, и выключатель подтверждается ответом САМОГО API —
 * полем `ariStopped` в сводке очереди, а не тем, что записано в файл. Побочный выигрыш: состояние лежит
 * файлом рядом с compose и **переживает перезагрузку**, тогда как `launchctl setenv` на Mac её не переживает.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ARI = resolve(import.meta.dirname, '../../scripts/ops/ari.sh');

interface Case {
  /** Что API отвечает про выключатель после перезапуска: `off`, `on`; не задано — по файлу, как настоящий env_file. */
  containerSwitch?: 'off' | 'on';
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
  // Подставной docker: `compose … up` — ок; `compose … exec -T api node -e …` — сводка очереди, где
  // ariStopped отвечает тому, что лежит в файле выключателя (как настоящий env_file), либо тому,
  // что задано в случае — так проверяется «файл записан, а процесс не увидел»
  const stopped =
    opts.containerSwitch === undefined
      ? `$([ -s "${ariEnv}" ] && grep -q off "${ariEnv}" && echo true || echo false)`
      : opts.containerSwitch === 'off'
        ? 'true'
        : 'false';
  script(
    'docker',
    `echo "$*" >> "${calls}"
case "$*" in
  *" exec "*) printf '{"pending":0,"sent":0,"ariStopped":%s}' "${stopped}" ;;
esac
exit 0`,
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
  it('stop кладёт выключатель файлом, пересоздаёт контейнер API и подтверждает ответом самого API', () => {
    const r = run(['stop']);
    expect(r.code, r.out).toBe(0);
    expect(r.envFile).toContain('CHANNEX_ARI=off');
    expect(r.docker).toMatch(/up -d --force-recreate api/);
    expect(r.docker).toMatch(/exec -T api node -e/);
    expect(r.out).toContain('исходящий ARI остановлен');
  });

  it('start убирает файл, пересоздаёт контейнер и проверяет, что API выключателя больше не видит', () => {
    const r = run(['start'], { stopped: true, containerSwitch: 'on' });
    expect(r.code, r.out).toBe(0);
    expect(r.envFile).toBeNull();
    expect(r.docker).toMatch(/up -d --force-recreate api/);
    expect(r.out).toContain('исходящий ARI включён');
  });

  it('файл записан, а процесс выключателя не увидел — это ОШИБКА, а не успех', () => {
    const r = run(['stop'], { containerSwitch: 'on' });
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/ARI НЕ остановлен/);
  });

  it('start не рапортует успех, если API всё ещё видит off', () => {
    const r = run(['start'], { stopped: true, containerSwitch: 'off' });
    expect(r.code).not.toBe(0);
  });

  it('status показывает и файл, и то, что видит запущенный API', () => {
    const r = run(['status'], { stopped: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain('машина: docker');
    expect(r.out).toContain('CHANNEX_ARI=off');
    expect(r.out).toMatch(/API сейчас: CHANNEX_ARI=off/);
  });

  it('с хоста к API не ходит: портов наружу нет, всё через compose exec', () => {
    const r = run(['status'], { stopped: false });
    expect(r.code).toBe(0);
    expect(r.docker.match(/ exec /g)?.length).toBeGreaterThanOrEqual(2);
  });
});
