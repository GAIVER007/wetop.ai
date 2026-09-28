/**
 * scripts/ops/repo-sync.sh — связь рабочей папки на Mac с репозиторием GAIVER007/wetop.ai.
 *
 * 16.09.2026: папка проекта на Mac переименована из «Pms Lux» в «WETOP», а в plist служб launchd путь
 * вшит абсолютно (install.sh пишет `WorkingDirectory` = папка на момент установки). После переименования
 * launchd не может сделать chdir и не поднимает ни API, ни стойку, ни синхронизацию Legacy — молча,
 * раз в 15 с. Раньше та же беда была с отставанием рабочей копии от `main` на 62 коммита (15.09):
 * API работал на старом коде. Скрипт делает обе проверки одной командой и умеет чинить.
 *
 * Песочница: голый «origin» с именем GAIVER007/wetop.ai в пути, клон «Pms Lux», переименованный в «WETOP»,
 * plist с прежним путём и подставные launchctl / plutil / lsof / pgrep — настоящие службы не трогаются.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
  mkdirSync(join(seed, 'apps', 'web'), { recursive: true });
  writeFileSync(join(seed, 'apps/web/next-env.d.ts'), '/// <reference types="next" />\n');
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
  for (const n of ['api', 'web']) {
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
  writeFileSync(join(bin, 'npm'), script(`echo "npm $*" >> "${calls}"; exit 0`));
  for (const f of ['launchctl', 'plutil', 'lsof', 'pgrep', 'npm']) chmodSync(join(bin, f), 0o755);
  return { dir, bin, home, calls, origin, seed, oldDir, newDir };
}

const envFor = (sb: Sandbox, extra: Record<string, string> = {}) => ({
  ...process.env,
  ...GIT_ENV,
  PATH: `${sb.bin}:${process.env.PATH}`,
  HOME: sb.home,
  // API PMS в песочнице нет: закрытый порт, чтобы скрипт не постучался в настоящий 3001
  API_URL: 'http://127.0.0.1:9',
  ...extra,
});

function run(sb: Sandbox, args: string[], cwd = sb.newDir) {
  const res = spawnSync('bash', [SCRIPT, ...args], {
    cwd,
    env: envFor(sb),
    encoding: 'utf8',
    timeout: 90_000,
  });
  const calls = existsSync(sb.calls) ? readFileSync(sb.calls, 'utf8') : '';
  return { code: res.status, out: `${res.stdout}${res.stderr}`, calls };
}

/** Асинхронный запуск: поддельный API живёт в этом же процессе, spawnSync его заблокировал бы */
function runAsync(sb: Sandbox, args: string[], extra: Record<string, string>) {
  return new Promise<{ code: number | null; out: string; calls: string }>((done) => {
    const p = spawn('bash', [SCRIPT, ...args], { cwd: sb.newDir, env: envFor(sb, extra) });
    let out = '';
    p.stdout.on('data', (c) => (out += c));
    p.stderr.on('data', (c) => (out += c));
    p.on('close', (code) =>
      done({ code, out, calls: existsSync(sb.calls) ? readFileSync(sb.calls, 'utf8') : '' }),
    );
  });
}

/** Поддельный API PMS: статус webhook с адресом в Channex и постоянным адресом; регистрации записывает */
function fakeApi(callbackUrl: string, expectedUrl: string) {
  const registered: string[] = [];
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'POST' && path === '/channels/channex/webhook/register') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        registered.push(body);
        const url = (JSON.parse(body) as { callbackUrl: string }).callbackUrl;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ registered: true, callbackUrl: url, active: true }));
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    if (path === '/channels/channex/webhook/status')
      res.end(JSON.stringify({ registered: true, callbackUrl, expectedUrl, active: true }));
    else res.end(JSON.stringify({ ok: true }));
  });
  return new Promise<{ url: string; registered: string[]; close: () => void }>((done) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      done({ url: `http://127.0.0.1:${port}`, registered, close: () => server.close() });
    });
  });
}

// Каждый тест поднимает песочницу с настоящим git и гоняет скрипт по нескольку раз: на свободной машине — доли
// секунды, под параллельным unit — до 6 с. Пять падений «timed out in 5000ms» с 16.09 по 24.09
// (TESTING.md, грабли 21.09) — поэтому срок на весь блок 60 с, как у самых долгих тестов ниже.
describe('repo-sync.sh: связь папки с репозиторием', { timeout: 60_000 }, () => {
  it('проверка: называет remote, отставание от origin/main, службы в другой папке; код выхода 1', () => {
    const sb = sandbox();
    const { code, out } = run(sb, []);
    expect(out).toContain('GAIVER007/wetop.ai');
    expect(out).toMatch(/отстаёт от origin\/main на 1/);
    expect(out).toContain('Pms Lux');
    expect(out).toMatch(/api/);
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
    for (const n of ['api', 'web']) {
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
    mkdirSync(join(old, 'project-input', 'forms'), { recursive: true });
    writeFileSync(join(old, '.env'), 'CHANNEX_API_KEY=из-старой-папки\n');
    writeFileSync(join(old, 'project-input', 'forms', 'form.txt'), 'тест\n');
    expect(existsSync(join(sb.newDir, '.env'))).toBe(false);

    const first = run(sb, ['--from', old]);
    expect(readFileSync(join(sb.newDir, '.env'), 'utf8')).toBe('CHANNEX_API_KEY=из-старой-папки\n');
    expect(readFileSync(join(sb.newDir, 'project-input/forms/form.txt'), 'utf8')).toBe('тест\n');
    expect(first.out).toMatch(/\.env/);
    // значения ключей в вывод не попадают
    expect(first.out).not.toContain('из-старой-папки');

    writeFileSync(join(sb.newDir, '.env'), 'CHANNEX_API_KEY=уже-вписан-здесь\n');
    run(sb, ['--from', old]);
    expect(readFileSync(join(sb.newDir, '.env'), 'utf8')).toBe('CHANNEX_API_KEY=уже-вписан-здесь\n');
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

  it('быстрый туннель не переустанавливается ни на какой машине: без wetop.yml тоже снимается', () => {
    // 16.09.2026, вечер: на втором компьютере разработчика (wetop.yml нет, PUBLIC_API_URL не задан) --relink
    // переустановил tunnel, и тот снова затёр постоянный адрес webhook в Channex. Правило из отчёта
    // 77c8085: быстрый туннель не запускать ни на одной машине, пока в Channex стоит постоянный адрес.
    const sb = sandbox();
    const agents = join(sb.home, 'Library', 'LaunchAgents');
    writeFileSync(join(agents, 'kz.luxx.pms.tunnel.plist'), plist('tunnel', sb.oldDir));
    writeFileSync(join(sb.dir, 'state', 'loaded-kz.luxx.pms.tunnel'), '');

    const check = run(sb, []);
    expect(check.out).toMatch(/быстрый туннель/);
    expect(check.out).not.toMatch(/служба tunnel.*держит PMS/);

    const { calls } = run(sb, ['--relink']);
    expect(
      existsSync(join(agents, 'kz.luxx.pms.tunnel.plist')),
      'plist быстрого туннеля снят',
    ).toBe(false);
    expect(calls).not.toMatch(/bootstrap \S+ \S*kz\.luxx\.pms\.tunnel\.plist/);
    // без wetop.yml постоянный туннель ставить негде — про domain не просим
    expect(run(sb, []).out).not.toMatch(/install\.sh domain/);
  }, 60_000);

  it('esbuild не той платформы: API и скрипты падали бы на старте — просит npm ci', () => {
    // Ночь на 17.09.2026: после npm install на ноутбуке esbuild остался под другую платформу, tsx не стартовал,
    // API упал 101 раз подряд, а status.sh показывал «spawn scheduled». Нативные модули проверяем запуском node.
    const sb = sandbox();
    const nm = join(sb.newDir, 'node_modules');
    mkdirSync(join(nm, 'esbuild'), { recursive: true });
    writeFileSync(join(nm, '.package-lock.json'), '{}\n');
    writeFileSync(join(nm, 'esbuild', 'package.json'), '{"name":"esbuild","main":"index.js"}\n');
    writeFileSync(
      join(nm, 'esbuild', 'index.js'),
      "throw new Error('You installed esbuild for another platform');\n",
    );
    const { out, code } = run(sb, []);
    expect(out).toMatch(/esbuild/);
    expect(out).toMatch(/npm ci/);
    expect(code).toBe(1);
  });

  it('--fix при битом esbuild: npm ci, клиент Prisma и перезапуск API — сам, без диктовки команд', () => {
    // Ночь на 17.09.2026: владелец пять раз подряд получал от агента список команд. --fix обязан
    // закрывать известные поломки сам: переустановить зависимости, сгенерировать клиент, перезапустить API.
    const sb = sandbox();
    const nm = join(sb.newDir, 'node_modules');
    mkdirSync(join(nm, 'esbuild'), { recursive: true });
    mkdirSync(join(sb.newDir, 'packages', 'database'), { recursive: true });
    writeFileSync(join(nm, '.package-lock.json'), '{}\n');
    writeFileSync(join(nm, 'esbuild', 'package.json'), '{"name":"esbuild","main":"index.js"}\n');
    writeFileSync(
      join(nm, 'esbuild', 'index.js'),
      "throw new Error('You installed esbuild for another platform');\n",
    );
    const { out, calls } = run(sb, ['--fix']);
    expect(calls).toMatch(/^npm ci$/m);
    expect(calls).toMatch(/^npm run generate -w @pms\/database$/m);
    expect(calls).toMatch(/kickstart -k gui\/\d+\/kz\.luxx\.pms\.api/);
    expect(out).toMatch(/перезапустил API|API перезапущен/);
  }, 60_000);

  it('webhook Channex не на постоянном адресе: проверка называет, --fix перерегистрирует', async () => {
    // 16–17.09.2026: в Channex остался адрес мёртвого быстрого туннеля, сторож исчерпал попытки,
    // брони шли только опросом ленты. Возврат адреса — тот же вызов, что кнопка на /channels.
    const permanent = 'https://api.wetop.ai/channels/channex/webhook';
    const api = await fakeApi(
      'https://dead-tunnel.trycloudflare.com/channels/channex/webhook',
      permanent,
    );
    try {
      const sb = sandbox();
      const check = await runAsync(sb, [], { API_URL: api.url });
      expect(check.out).toMatch(/опросом ленты/);
      expect(api.registered).toHaveLength(0);

      const fix = await runAsync(sb, ['--fix'], { API_URL: api.url });
      expect(api.registered).toHaveLength(1);
      expect(api.registered[0]).toContain(permanent);
      expect(fix.out).toMatch(/перерегистрирован/);
    } finally {
      api.close();
    }
  }, 60_000);

  it('next-env.d.ts переписан сборкой — это не работа для человека, а строка «сборка»', () => {
    // Next переписывает apps/web/next-env.d.ts при каждом запуске, а next.config.ts меняет папку сборки
    // между next dev, next build и UI-тестами (.next-ui) — файл вечно «изменён». 17.09.2026: после
    // пересборки стойки скрипт выдал из-за него пункт к исполнению на полностью чистой папке.
    const sb = sandbox();
    const before = /пунктов к исполнению — (\d+)/.exec(run(sb, []).out)?.[1];
    writeFileSync(join(sb.newDir, 'apps/web/next-env.d.ts'), '/// изменено сборкой\n');
    const { out } = run(sb, []);
    expect(out).toMatch(/next-env\.d\.ts/);
    expect(out).toMatch(/сборк/i);
    expect(out).not.toMatch(/→ закоммитить/);
    // пунктов к исполнению не прибавилось: в песочнице свой пункт про службы launchd
    expect(/пунктов к исполнению — (\d+)/.exec(out)?.[1]).toBe(before);
  });

  it('настоящая правка рядом со сгенерированным файлом по-прежнему пункт к исполнению', () => {
    const sb = sandbox();
    writeFileSync(join(sb.newDir, 'apps/web/next-env.d.ts'), '/// изменено сборкой\n');
    writeFileSync(join(sb.newDir, 'README.md'), '# правка руками\n');
    const { out, code } = run(sb, []);
    // правка руками — в счёте и в списке; сгенерированный файл — отдельной строкой и вне счёта
    expect(out).toMatch(/незакоммиченных правок: 1/);
    expect(out).toContain('README.md');
    expect(out).toMatch(/переписан сборкой.*next-env\.d\.ts/);
    expect(code).toBe(1);
  });

  it('--pull возвращает сгенерированный файл и подтягивает: из-за него fast-forward не отменяется', () => {
    const sb = sandbox();
    const target = git(sb.seed, 'rev-parse', 'HEAD');
    writeFileSync(join(sb.newDir, 'apps/web/next-env.d.ts'), '/// изменено сборкой\n');
    const { out } = run(sb, ['--pull']);
    expect(git(sb.newDir, 'rev-parse', 'HEAD')).toBe(target);
    expect(out).toMatch(/подтянул/);
    expect(git(sb.newDir, 'status', '--porcelain', '--untracked-files=no')).toBe('');
  });

  it('находит вторую копию репозитория рядом с папкой', () => {
    const sb = sandbox();
    git(sb.dir, 'clone', '-q', sb.origin, sb.oldDir);
    const { out } = run(sb, []);
    expect(out).toMatch(/ещё одна копия/);
    expect(out).toContain(realpathSync(sb.oldDir));
  });
});

/**
 * 27.09.2026: владелец перенёс папку бота («Чат агент/WETOP» — второй клон этого же репозитория на ветке
 * ai-seller) внутрь рабочей папки. С 24.09 бот живёт в apps/ai-seller ветки main; копия внутри — дубль, а файлы
 * из неё, положенные поверх apps/ai-seller, откатили бы бота к версии 24.09 и заперли бы --pull.
 */
describe('repo-sync.sh: папка бота, перенесённая внутрь рабочей', { timeout: 90_000 }, () => {
  /** origin: ветка ai-seller со старым ботом в корне, в main — apps/ai-seller новее; папка — на вершине main */
  function botSandbox(): Sandbox {
    const sb = sandbox();
    git(sb.seed, 'checkout', '-q', '-b', 'ai-seller');
    writeFileSync(join(sb.seed, 'bot.py'), 'old\n');
    writeFileSync(join(sb.seed, '.gitignore'), '.env\ndata/*\n');
    git(sb.seed, 'add', 'bot.py', '.gitignore');
    git(sb.seed, 'commit', '-q', '-m', 'bot on its own branch');
    git(sb.seed, 'push', '-q', 'origin', 'ai-seller');
    git(sb.seed, 'checkout', '-q', 'main');
    mkdirSync(join(sb.seed, 'apps', 'ai-seller'), { recursive: true });
    writeFileSync(join(sb.seed, 'apps/ai-seller/bot.py'), 'new\n');
    git(sb.seed, 'add', 'apps/ai-seller/bot.py');
    git(sb.seed, 'commit', '-q', '-m', 'bot moved into main');
    git(sb.seed, 'push', '-q', 'origin', 'main');
    git(sb.newDir, 'pull', '-q', 'origin', 'main');
    return sb;
  }

  /** старая папка бота целиком внутри рабочей: клон на ai-seller, его .env и заметки владельца рядом */
  function nestedBotCopy(sb: Sandbox): string {
    const top = join(sb.newDir, 'Чат агент');
    mkdirSync(top);
    git(sb.dir, 'clone', '-q', '-b', 'ai-seller', sb.origin, join(top, 'WETOP'));
    writeFileSync(join(top, 'WETOP', '.env'), 'SECRET=1\n');
    writeFileSync(join(top, 'заметки.md'), 'мои заметки\n');
    return top;
  }

  it('находит перенесённую внутрь копию (папку бота) и без флага ничего не двигает', () => {
    const sb = botSandbox();
    const top = nestedBotCopy(sb);
    const { code, out } = run(sb, []);
    expect(out).toMatch(/внутри папки вторая копия репозитория: Чат агент\/WETOP \(ветка ai-seller\)/);
    expect(out).toMatch(/apps\/ai-seller/);
    expect(out).toMatch(/всё из неё уже на GitHub/);
    expect(out).toContain('--archive-nested');
    expect(out).not.toContain('SECRET=1');
    expect(existsSync(join(top, 'WETOP', '.env'))).toBe(true);
    expect(code).toBe(1);
  });

  it('--archive-nested переносит папку целиком в архив рядом: .env и заметки с ней, рабочая чистая', () => {
    const sb = botSandbox();
    nestedBotCopy(sb);
    const { out } = run(sb, ['--archive-nested']);
    expect(existsSync(join(sb.newDir, 'Чат агент'))).toBe(false);
    const archive = join(sb.dir, 'WETOP-архив');
    const moved = readdirSync(archive);
    expect(moved).toHaveLength(1);
    const name = moved[0] ?? '';
    expect(name).toMatch(/^Чат агент-\d{8}-\d{6}$/);
    expect(readFileSync(join(archive, name, 'WETOP', '.env'), 'utf8')).toBe('SECRET=1\n');
    expect(readFileSync(join(archive, name, 'заметки.md'), 'utf8')).toBe('мои заметки\n');
    expect(out).toMatch(/перенёс в архив/);
    expect(git(sb.newDir, 'status', '--porcelain')).toBe('');
  });

  it('копия с неотправленной работой остаётся на месте: названы коммиты и правки, команда отправки', () => {
    const sb = botSandbox();
    const copy = join(nestedBotCopy(sb), 'WETOP');
    writeFileSync(join(copy, 'local.py'), 'print(1)\n');
    git(copy, 'add', 'local.py');
    git(copy, 'commit', '-q', '-m', 'local work');
    writeFileSync(join(copy, 'bot.py'), 'old, edited\n');
    const { code, out } = run(sb, ['--archive-nested']);
    expect(existsSync(copy)).toBe(true);
    expect(out).toMatch(/коммитов только здесь, не на GitHub: 1/);
    expect(out).toMatch(/незакоммиченных правок: 1/);
    expect(out).toMatch(/refs\/heads\/rescue\//);
    expect(code).toBe(1);
  });

  it('чужой репозиторий внутри папки назван, но не переносится', () => {
    const sb = botSandbox();
    const other = join(sb.dir, 'other', 'competitor.git');
    mkdirSync(other, { recursive: true });
    git(other, 'init', '--bare', '-b', 'main');
    git(sb.dir, 'clone', '-q', other, join(sb.newDir, 'competitor'));
    const { out } = run(sb, ['--archive-nested']);
    expect(existsSync(join(sb.newDir, 'competitor'))).toBe(true);
    expect(out).toMatch(/внутри папки чужой репозиторий: competitor/);
  });

  it('рабочие копии сессий и node_modules копиями не считаются', () => {
    const sb = botSandbox();
    mkdirSync(join(sb.newDir, 'node_modules', 'pkg', '.git'), { recursive: true });
    git(sb.newDir, 'worktree', 'add', '-q', join(sb.newDir, '.claude', 'worktrees', 'w1'));
    const { out } = run(sb, []);
    expect(out).not.toMatch(/внутри папки/);
  });

  it('файлы из старой папки поверх apps/ai-seller названы; --fix возвращает версию main и подтягивает', () => {
    const sb = botSandbox();
    writeFileSync(join(sb.newDir, 'apps/ai-seller/bot.py'), 'old\n');
    const { out } = run(sb, []);
    expect(out).toMatch(/из старой папки бота/);
    expect(out).toContain('apps/ai-seller/bot.py');
    expect(out).not.toMatch(/незакоммиченных правок/);
    run(sb, ['--fix']);
    expect(readFileSync(join(sb.newDir, 'apps/ai-seller/bot.py'), 'utf8')).toBe('new\n');
  });

  it('настоящая правка в apps/ai-seller копией не считается, и --fix её не трогает', () => {
    const sb = botSandbox();
    writeFileSync(join(sb.newDir, 'apps/ai-seller/bot.py'), 'new, edited\n');
    const { out } = run(sb, ['--fix']);
    expect(readFileSync(join(sb.newDir, 'apps/ai-seller/bot.py'), 'utf8')).toBe('new, edited\n');
    expect(out).not.toMatch(/из старой папки бота/);
    expect(out).toMatch(/незакоммиченных правок: 1/);
  });
});
