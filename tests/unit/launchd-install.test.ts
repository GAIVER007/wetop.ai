/**
 * scripts/ops/launchd/install.sh на подставных launchctl / lsof / pgrep: настоящие службы не трогаются.
 * Три случая с 13.09.2026, когда стойка осталась снятой:
 *  1) `--dry` снимал загруженную задачу (bootout выполнялся и в сухом прогоне);
 *  2) проверка доступа сдавалась на строке bash «getcwd … Operation not permitted», не дождавшись node,
 *     который при свопе отвечает через несколько секунд;
 *  3) переустановка работающей задачи: bootout и сразу проверка порта — старый процесс ещё держит порт,
 *     скрипт принимал его за «запущенный вручную» и пропускал установку;
 *  4) bootstrap сразу после bootout: launchd ещё снимает прежний экземпляр и отвечает
 *     «Bootstrap failed: 5: Input/output error» — задача оставалась не загруженной.
 */
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INSTALL = resolve(import.meta.dirname, '../../scripts/ops/launchd/install.sh');

interface Sandbox {
  bin: string;
  home: string;
  calls: string;
}

/**
 * Подставной launchctl пишет каждый вызов в calls.log. Задача считается загруженной, пока её не сняли;
 * после bootout launchd «снимает» её ещё unloadSec: print отвечает 0, bootstrap — ошибкой 5.
 * На bootstrap задачи-проверки пишет строку bash про getcwd сразу, а `preflight-ok` — через nodeDelaySec.
 * lsof/pgrep «видят» старый процесс стойки ещё releaseSec после её bootout.
 */
function sandbox(opts: { nodeDelaySec: number; releaseSec: number; unloadSec?: number }): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'launchd-install-'));
  const bin = join(dir, 'bin');
  const home = join(dir, 'home');
  const calls = join(dir, 'calls.log');
  const state = join(dir, 'state');
  mkdirSync(bin);
  mkdirSync(state);
  writeFileSync(join(state, 'loaded-kz.luxx.pms.web'), ''); // стойка уже работает под launchd
  mkdirSync(join(home, '.local', 'bin'), { recursive: true });
  const script = (body: string) => `#!/bin/bash\n${body}\n`;
  writeFileSync(
    join(bin, 'launchctl'),
    script(`echo "$*" >> "${calls}"
present() { # $1 — label; 0 = загружена или ещё снимается
  [ -f "${state}/loaded-$1" ] && return 0
  [ -f "${state}/out-$1" ] || return 1
  [ $(( $(date +%s) - $(cat "${state}/out-$1") )) -lt ${opts.unloadSec ?? 0} ]
}
case "$1" in
  print) present "\${2##*/}"; exit $? ;;
  bootout)
    label="\${2##*/}"
    [ -f "${state}/loaded-$label" ] || exit 3
    rm -f "${state}/loaded-$label"; date +%s > "${state}/out-$label" ;;
  bootstrap)
    label=$(/usr/libexec/PlistBuddy -c 'Print :Label' "$3")
    log=$(/usr/libexec/PlistBuddy -c 'Print :StandardOutPath' "$3")
    if present "$label"; then
      echo "Bootstrap failed: 5: Input/output error" >&2; exit 5
    fi
    touch "${state}/loaded-$label"
    if [ "$label" = kz.luxx.pms.preflight ]; then
      echo "shell-init: error retrieving current directory: getcwd: cannot access parent directories: Operation not permitted" >> "$log"
      ( sleep ${opts.nodeDelaySec}; echo preflight-ok >> "$log" ) &
    fi ;;
esac
exit 0`),
  );
  const bootedOut = join(state, 'out-kz.luxx.pms.web');
  const holder = script(`[ -f "${bootedOut}" ] || { echo 99999; exit 0; }
[ $(( $(date +%s) - $(cat "${bootedOut}") )) -lt ${opts.releaseSec} ] && echo 99999
exit 0`);
  writeFileSync(join(bin, 'lsof'), holder);
  writeFileSync(join(bin, 'pgrep'), holder);
  for (const f of ['launchctl', 'lsof', 'pgrep']) chmodSync(join(bin, f), 0o755);
  return { bin, home, calls };
}

function install(sb: Sandbox, args: string[]) {
  const res = spawnSync('bash', [INSTALL, ...args], {
    env: { ...process.env, PATH: `${sb.bin}:${process.env.PATH}`, HOME: sb.home },
    encoding: 'utf8',
    timeout: 90_000,
  });
  const calls = existsSync(sb.calls) ? readFileSync(sb.calls, 'utf8') : '';
  return { out: `${res.stdout}${res.stderr}`, calls };
}

/**
 * Подставной launchctl читает plist через `/usr/libexec/PlistBuddy` — его нет нигде, кроме macOS,
 * поэтому в удалённой среде (Linux) набор пропускается. На Mac, где эти службы и живут, он идёт как прежде:
 * иначе набор висел бы красным в каждом прогоне и приучал не смотреть на красное (TESTING.md §4).
 */
const onMac = process.platform === 'darwin';

describe.skipIf(!onMac)('launchd install.sh', () => {
  /*
   * 15.09.2026: Session pooler Supabase держит 15 клиентов на проект. Задача синхронизации с пулом по
   * умолчанию (5) поверх API (5) и разовых скриптов переполняла его, и запросы стойки падали в 500
   * («Connection terminated due to connection timeout» в журнале API). Прогон синхронизации
   * последовательный — одного соединения ему достаточно.
   */
  /** В сухом прогоне plist собирается во временной папке, её путь скрипт печатает */
  const dryPlist = (task: string): string => {
    const out = install(sandbox({ nodeDelaySec: 0, releaseSec: 0 }), ['--dry', task]).out;
    const file = /(\S+\.plist) собран и проверен/.exec(out)?.[1];
    expect(file, `путь plist не найден в выводе:\n${out}`).toBeTruthy();
    return readFileSync(file!, 'utf8');
  };

  it('задача синхронизации Exely берёт одно соединение, чтобы не съесть пулер', () => {
    expect(dryPlist('exely-sync')).toMatch(
      /<key>DATABASE_POOL_MAX<\/key><string>1<\/string>/,
    );
  });

  it('службам пул не урезаем: у API он свой', () => {
    expect(dryPlist('api')).not.toContain('DATABASE_POOL_MAX');
  });

  it('--dry не снимает загруженную задачу', () => {
    const sb = sandbox({ nodeDelaySec: 0, releaseSec: 0 });
    const { out, calls } = install(sb, ['--dry', 'web']);
    expect(out).toContain('собран и проверен');
    expect(calls).not.toMatch(/bootout \S*kz\.luxx\.pms\.web/);
  });

  it('проверка доступа дожидается node, когда bash первым пишет «Operation not permitted»', () => {
    const sb = sandbox({ nodeDelaySec: 3, releaseSec: 0 });
    const { out } = install(sb, ['web']);
    expect(out).not.toContain('нет доступа к папке проекта');
    expect(out).toContain('загружен');
  }, 60_000);

  it('переустановка работающей задачи ждёт, пока старый процесс освободит порт', () => {
    const sb = sandbox({ nodeDelaySec: 0, releaseSec: 3 });
    const { out, calls } = install(sb, ['web']);
    expect(out).not.toContain('уже запущен вручную');
    expect(out).toContain('загружен');
    expect(calls).toMatch(/bootstrap \S+ \S*kz\.luxx\.pms\.web\.plist/);
  }, 60_000);

  it('exely-sync (ADR-032, владелец 13.09.2026): раз в 5 минут, без KeepAlive, одним процессом node --import tsx', () => {
    const sb = sandbox({ nodeDelaySec: 0, releaseSec: 0 });
    const { out } = install(sb, ['--dry', 'exely-sync']);
    const plistPath = out.match(/(\/\S+kz\.luxx\.pms\.exely-sync\.plist) собран и проверен/)?.[1];
    expect(plistPath, out).toBeTruthy();
    const plist = readFileSync(plistPath!, 'utf8');
    expect(plist).toMatch(/<key>StartInterval<\/key><integer>300<\/integer>/);
    expect(plist).toMatch(/<key>KeepAlive<\/key><false\/>/);
    expect(plist).toContain('<string>--import</string>');
    expect(plist).toContain('<string>scripts/imports/src/cli-sync-day.ts</string>');
    expect(plist).toContain('<string>--auto</string>');
    // стойку и остальные задачи интервал не касается
    const web = install(sandbox({ nodeDelaySec: 0, releaseSec: 0 }), ['--dry', 'web']).out;
    const webPlist = readFileSync(
      web.match(/(\/\S+kz\.luxx\.pms\.web\.plist) собран/)![1]!,
      'utf8',
    );
    expect(webPlist).not.toContain('StartInterval');
    expect(webPlist).toMatch(/<key>KeepAlive<\/key><true\/>/);
  });

  it('переустановка ждёт, пока launchd снимет прежний экземпляр, и только потом загружает', () => {
    const sb = sandbox({ nodeDelaySec: 0, releaseSec: 0, unloadSec: 3 });
    const { out } = install(sb, ['web']);
    expect(out).not.toContain('Bootstrap failed');
    expect(out).toContain('загружен');
  }, 60_000);
});
