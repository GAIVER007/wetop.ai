/**
 * scripts/ops/repo-sync.sh — связь рабочей папки на Mac с репозиторием GAIVER007/wetop.ai.
 *
 * 16.09.2026: папка проекта на Mac переименована из «Pms Lux» в «WETOP», а в plist служб launchd путь
 * вшит абсолютно (install.sh пишет `WorkingDirectory` = папка на момент установки). После переименования
 * launchd не может сделать chdir и не поднимает ни API, ни стойку, ни синхронизацию Exely — молча,
 * раз в 15 с. Раньше та же беда была с отставанием рабочей копии от `main` на 62 коммита (15.09):
 * API работал на старом коде. Скрипт делает обе проверки одной командой и умеет чинить.
 *
 * Песочница: голый «origin» с именем GAIVER007/wetop.ai в пути, клон «Pms Lux», переименованный в «WETOP»,
 * plist с прежним путём и подставные launchctl / plutil / lsof / pgrep — настоящие службы не трогаются.
 */
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/ops/repo-sync.sh');
const LAUNCHD = resolve(import.meta.dirname, '../../scripts/ops/launchd');

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Тест',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Тест',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd: string, ...args: string[]): string {
  const res = spawnSync('git', args, {
    cwd,
    env: { ...process.env, ...GIT_ENV },
    encoding: 'utf8',
  });
  if (res.status !== 0)
    throw new Error(`git ${args.join(' ')} в ${cwd}:\n${res.stdout}${res.stderr}`);
  return res.stdout.trim();
}

interface Sandbox {
  dir: string;
  bin: string;
  home: string;
  calls: string;
  /** голый репозиторий; в пути есть GAIVER007/wetop.ai — так скрипт узнаёт «свой» remote */
  origin: string;
  /** клон-«вторая машина», из него уходят коммиты в origin */
  seed: string;
  /** старое имя папки на Mac */
  oldDir: string;
  /** новое имя папки на Mac — сюда переименован клон */
  newDir: string;
}

const plist = (name: string, workdir: string) => `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key><string>kz.luxx.pms.${name}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/echo</string>
  </array>
  <key>WorkingDirectory</key><string>${workdir}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/dev/null</string>
  <key>StandardErrorPath</key><string>/dev/null</string>
</dict>
</plist>
`;

/** Значение ключа plist без plutil и PlistBuddy — их нет на Linux (CI) */
const plistValue = (file: string, key: string): string =>
  new RegExp(`<key>${key}</key><string>([^<]*)</string>`).exec(readFileSync(file, 'utf8'))?.[1] ??
  '';

function sandbox(): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'repo-sync-'));
  const bin = join(dir, 'bin');
  const home = join(dir, 'home');
  const calls = join(dir, 'calls.log');
  const state = join(dir, 'state');
  const agents = join(home, 'Library', 'LaunchAgents');
  mkdirSync(bin);
  mkdirSync(state);
  mkdirSync(agents, { recursive: true });
  mkdirSync(join(home, '.local', 'bin'), { recursive: true });
  mkdirSync(join(home, 'Library', 'Logs', 'pms-lux'), { recursive: true });

  // origin и первый коммит
  const origin = join(dir, 'GAIVER007', 'wetop.ai.git');
  mkdirSync(origin, { recursive: true });
  git(origin, 'init', '--bare', '-b', 'main');
  const seed = join(dir, 'seed');
  git(dir, 'clone', '-q', origin, seed);
  mkdirSync(join(seed, 'scripts', 'ops', 'launchd'), { recursive: true });
  for (const f of ['install.sh', 'uninstall.sh']) {
    writeFileSync(join(seed, 'scripts/ops/launchd', f), readFileSync(join(LAUNCHD, f)));
    chmodSync(join(seed, 'scripts/ops/launchd', f), 0o755);
  }
  writeFileSync(join(seed, 'package.json'), '{"name":"sandbox"}\n');
  writeFileSync(join(seed, 'package-lock.json'), '{}\n');
  writeFileSync(join(seed, 'README.md'), '# sandbox\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'first');
  git(seed, 'push', '-q', 'origin', 'main');

  // папка на Mac: клон под старым именем, потом второй коммит в origin, потом переименование
  const oldDir = join(dir, 'Pms Lux');
  git(dir, 'clone', '-q', origin, oldDir);
  writeFileSync(join(seed, 'README.md'), '# sandbox\n\nвторой коммит\n');
  git(seed, 'commit', '-q', '-am', 'second');
  git(seed, 'push', '-q', 'origin', 'main');
  for (const n of ['api', 'web', 'exely-sync']) {
    writeFileSync(join(agents, `kz.luxx.pms.${n}.plist`), plist(n, oldDir));
    writeFileSync(join(state, `loaded-kz.luxx.pms.${n}`), '');
  }
  const newDir = join(dir, 'WETOP');
  renameSync(oldDir, newDir);

  // подставные утилиты macOS: launchctl помнит загруженные задачи и отвечает на проверку доступа install.sh
  const script = (body: string) => `#!/bin/bash\n${body}\n`;
  writeFileSync(
    join(bin, 'launchctl'),
    script(`echo "$*" >> "${calls}"
field() { sed -n "s#.*<key>$2</key><string>\\([^<]*\\)</string>.*#\\1#p" "$1" | head -1; }
case "$1" in
  print) [ -f "${state}/loaded-\${2##*/}" ]; exit $? ;;
  bootout) rm -f "${state}/loaded-\${2##*/}"; exit 0 ;;
  bootstrap)
    label=$(field "$3" Label); log=$(field "$3" StandardOutPath)
    touch "${state}/loaded-$label"
    [ "$label" = kz.luxx.pms.preflight ] && echo preflight-ok >> "$log"
    exit 0 ;;
esac
exit 0`),
  );
  writeFileSync(join(bin, 'plutil'), script('exit 0'));
  writeFileSync(join(bin, 'lsof'), script('exit 0'));
  writeFileSync(join(bin, 'pgrep'), script('exit 0'));
  for (const f of ['launchctl', 'plutil', 'lsof', 'pgrep']) chmodSync(join(bin, f), 0o755);
  return { dir, bin, home, calls, origin, seed, oldDir, newDir };
}

function run(sb: Sandbox, args: string[], cwd = sb.newDir) {
  const res = spawnSync('bash', [SCRIPT, ...args], {
    cwd,
    env: { ...process.env, ...GIT_ENV, PATH: `${sb.bin}:${process.env.PATH}`, HOME: sb.home },
    encoding: 'utf8',
    timeout: 90_000,
  });
  const calls = existsSync(sb.calls) ? readFileSync(sb.calls, 'utf8') : '';
  return { code: res.status, out: `${res.stdout}${res.stderr}`, calls };
}

describe('repo-sync.sh: связь папки с репозиторием', () => {
  it('проверка: называет remote, отставание от origin/main, службы в другой папке; код выхода 1', () => {
    const sb = sandbox();
    const { code, out } = run(sb, []);
    expect(out).toContain('GAIVER007/wetop.ai');
    expect(out).toMatch(/отстаёт от origin\/main на 1/);
    expect(out).toContain('Pms Lux');
    expect(out).toMatch(/api/);
    expect(out).toMatch(/exely-sync/);
    expect(out).toContain('--relink');
    expect(code).toBe(1);
  });

  it('--pull подтягивает origin/main только fast-forward и потом отставания нет', () => {
    const sb = sandbox();
    const target = git(sb.seed, 'rev-parse', 'HEAD');
    expect(git(sb.newDir, 'rev-parse', 'HEAD')).not.toBe(target);
    const { out } = run(sb, ['--pull']);
    expect(git(sb.newDir, 'rev-parse', 'HEAD')).toBe(target);
    expect(out).toMatch(/подтянул/);
  });

  it('--pull не трогает дерево с незакоммиченными правками', () => {
    const sb = sandbox();
    const before = git(sb.newDir, 'rev-parse', 'HEAD');
    writeFileSync(join(sb.newDir, 'README.md'), '# правка на стойке\n');
    const { out, code } = run(sb, ['--pull']);
    expect(git(sb.newDir, 'rev-parse', 'HEAD')).toBe(before);
    expect(readFileSync(join(sb.newDir, 'README.md'), 'utf8')).toBe('# правка на стойке\n');
    expect(out).toMatch(/незакоммиченн/);
    expect(code).toBe(1);
  });

  it('--pull с локальными коммитами не сливает, а просит отправить их', () => {
    const sb = sandbox();
    writeFileSync(join(sb.newDir, 'local.md'), 'локальная работа\n');
    git(sb.newDir, 'add', 'local.md');
    git(sb.newDir, 'commit', '-q', '-m', 'local');
    const before = git(sb.newDir, 'rev-parse', 'HEAD');
    const { out } = run(sb, ['--pull']);
    expect(git(sb.newDir, 'rev-parse', 'HEAD')).toBe(before);
    expect(out).toMatch(/впереди origin\/main на 1/);
    expect(out).toMatch(/разошлись|git push/);
  });

  it('--relink переводит службы launchd на эту папку через uninstall.sh + install.sh', () => {
    const sb = sandbox();
    const { out, calls } = run(sb, ['--relink']);
    const agents = join(sb.home, 'Library', 'LaunchAgents');
    for (const n of ['api', 'web', 'exely-sync']) {
      const file = join(agents, `kz.luxx.pms.${n}.plist`);
      expect(existsSync(file), `${n}: plist после relink`).toBe(true);
      // на Mac os.tmpdir() — симлинк (/var → /private/var); скрипт и git работают с настоящим путём
      expect(plistValue(file, 'WorkingDirectory'), `${n}: папка в plist`).toBe(
        realpathSync(sb.newDir),
      );
    }
    expect(calls).toMatch(/bootout \S*kz\.luxx\.pms\.api/);
    expect(calls).toMatch(/bootstrap \S+ \S*kz\.luxx\.pms\.api\.plist/);
    expect(out).not.toContain('нет доступа к папке проекта');
    // повторная проверка: службы уже в этой папке
    const again = run(sb, []);
    expect(again.out).not.toContain('--relink');
    expect(again.out).toMatch(/службы launchd.*этой папке/);
  }, 60_000);

  it('--from переносит то, чего нет в git (.env, выгрузки), и не перезаписывает существующее', () => {
    const sb = sandbox();
    const old = join(sb.dir, 'old-copy');
    mkdirSync(join(old, 'project-input', 'exely'), { recursive: true });
    writeFileSync(join(old, '.env'), 'EXELY_API_KEY=из-старой-папки\n');
    writeFileSync(join(old, 'project-input', 'exely', 'export.csv'), 'a;b\n');
    expect(existsSync(join(sb.newDir, '.env'))).toBe(false);

    const first = run(sb, ['--from', old]);
    expect(readFileSync(join(sb.newDir, '.env'), 'utf8')).toBe('EXELY_API_KEY=из-старой-папки\n');
    expect(readFileSync(join(sb.newDir, 'project-input/exely/export.csv'), 'utf8')).toBe('a;b\n');
    expect(first.out).toMatch(/\.env/);
    // значения ключей в вывод не попадают
    expect(first.out).not.toContain('из-старой-папки');

    writeFileSync(join(sb.newDir, '.env'), 'EXELY_API_KEY=уже-вписан-здесь\n');
    run(sb, ['--from', old]);
    expect(readFileSync(join(sb.newDir, '.env'), 'utf8')).toBe('EXELY_API_KEY=уже-вписан-здесь\n');
  });

  it('без .env говорит, что его нет, но содержимое не читает и не печатает', () => {
    const sb = sandbox();
    const { out } = run(sb, []);
    expect(out).toMatch(/\.env/);
    expect(out).toMatch(/нет|отсутствует/);
  });

  it('чужой remote или папка не под git — код 2 и ни одного действия', () => {
    const sb = sandbox();
    git(sb.newDir, 'remote', 'set-url', 'origin', 'https://github.com/someone/else.git');
    const wrong = run(sb, ['--pull', '--relink']);
    expect(wrong.code).toBe(2);
    expect(wrong.out).toContain('someone/else');
    expect(wrong.calls).toBe('');

    const plain = join(sb.dir, 'not-a-repo');
    mkdirSync(plain);
    const none = run(sb, [], plain);
    expect(none.code).toBe(2);
    expect(none.out).toMatch(/не под git|не репозиторий/);
  });

  it('аргументы после # — комментарий: zsh без INTERACTIVE_COMMENTS передаёт их скрипту', () => {
    // 16.09.2026, первый запуск на Mac: «bash repo-sync.sh   # только проверка» пришёл как пять аргументов,
    // скрипт ответил «неизвестно: #» и не сделал ничего
    const sb = sandbox();
    const { code, out } = run(sb, ['#', 'только', 'проверка,', 'ничего', 'не', 'меняет']);
    expect(out).not.toContain('неизвестно');
    expect(out).toMatch(/отстаёт от origin\/main на 1/);
    expect(code).toBe(1);
  });

  it('при постоянном адресе быстрый туннель не переустанавливается, а снимается; нужен domain', () => {
    // На машине стойки стоит ~/.cloudflared/wetop.yml (постоянный туннель wetop.ai). Быстрый туннель там
    // запускать нельзя: он уводит webhook Channex на одноразовый адрес (CLAUDE.md, 16.09.2026). На Mac 16.09
    // среди служб оказался tunnel, а domain — нет.
    const sb = sandbox();
    const agents = join(sb.home, 'Library', 'LaunchAgents');
    writeFileSync(join(agents, 'kz.luxx.pms.tunnel.plist'), plist('tunnel', sb.oldDir));
    writeFileSync(join(sb.dir, 'state', 'loaded-kz.luxx.pms.tunnel'), '');
    mkdirSync(join(sb.home, '.cloudflared'), { recursive: true });
    writeFileSync(join(sb.home, '.cloudflared', 'wetop.yml'), 'tunnel: wetop\n');

    const check = run(sb, []);
    expect(check.out).toMatch(/быстрый туннель/);
    expect(check.out).toMatch(/install\.sh domain/);

    const { out, calls } = run(sb, ['--relink']);
    expect(
      existsSync(join(agents, 'kz.luxx.pms.tunnel.plist')),
      'plist быстрого туннеля снят',
    ).toBe(false);
    expect(calls).toMatch(/bootout \S*kz\.luxx\.pms\.tunnel/);
    expect(calls).not.toMatch(/bootstrap \S+ \S*kz\.luxx\.pms\.tunnel\.plist/);
    expect(out).toMatch(/install\.sh domain/);
    // остальные службы переведены как обычно
    expect(plistValue(join(agents, 'kz.luxx.pms.api.plist'), 'WorkingDirectory')).toBe(
      realpathSync(sb.newDir),
    );
  }, 60_000);

  it('находит вторую копию репозитория рядом с папкой', () => {
    const sb = sandbox();
    git(sb.dir, 'clone', '-q', sb.origin, sb.oldDir);
    const { out } = run(sb, []);
    expect(out).toMatch(/ещё одна копия/);
    expect(out).toContain(realpathSync(sb.oldDir));
  });
});
