/**
 * Сборка и службы сервера (`deploy/`, plans/server-kz-2026-09-17.md шаг 0, plans/server-kz-2026-09-18.md шаг 4).
 * Слито 18.09.2026 из двух параллельных наборов — ни одна проверка не выброшена.
 *
 * Сам образ здесь не собирается — в контейнере агента нет демона Docker, сборка проверяется на сервере.
 * Тест держит то, что ломается молча и обнаруживается только на боевой машине, и поздно:
 *
 *  1. новый рабочий пакет в монорепозитории → его манифест не скопирован в образ → `npm ci` внутри
 *     сборки не сходится с package-lock.json;
 *  2. секрет, случайно вписанный в compose или попавший в контекст сборки (SECURITY.md §3);
 *  3. вторая копия туннеля — 17.09.2026 две копии одного туннеля поделили запросы;
 *  4. пул синхронизации больше одного соединения — переполняет пулер, стойка падает в 500 (15.09.2026);
 *  5. `127.0.0.1` в контейнере делает службу невидимой для соседей по сети compose (18.09.2026);
 *  6. `.env` не в корне клона — хост (prisma, cli-check-env) и compose читают разные файлы (18.09.2026);
 *  7. боевая миграция, вписанная в команду службы, — её делает владелец (AGENTS.md §15);
 *  8. сторож проверяет стойку по 127.0.0.1 — в контейнере это он сам, и дежурного будят впустую (21.09.2026);
 *  9. сторож ждёт синхронизации из Legacy, которого с 19.09 нет вовсе (ADR-052), — тот же будильник впустую;
 * 10. сторож читает отчёты и журнал тестов из слепка образа и повторяет день сборки как сегодняшнее.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const DOCKERFILE = read('deploy/Dockerfile');
const COMPOSE = read('deploy/compose.yml');
const DOCKERIGNORE = read('.dockerignore');

/** Только то, что исполняется: в пояснениях те же слова стоят намеренно. */
const withoutComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

/** Рабочие пакеты монорепозитория — так же, как их видит npm: каталог с package.json, по факту на диске. */
function workspacePackages(): string[] {
  const globs = JSON.parse(read('package.json')).workspaces as string[];
  return globs
    .map((g) => g.replace(/\/\*$/, ''))
    .flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .map((name) => `${dir}/${name}`)
        .filter((p) => existsSync(join(ROOT, p, 'package.json'))),
    )
    .sort();
}

/** Кусок compose.yml от заголовка службы до следующей службы того же уровня. */
function service(name: string): string {
  const start = COMPOSE.indexOf(`\n  ${name}:`);
  expect(start, `служба ${name} в compose.yml`).toBeGreaterThan(-1);
  const rest = COMPOSE.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

/** Адреса, которыми compose меряет живость: `node -e "fetch('…')"` — node есть в любом образе, wget и curl нет. */
function healthUrls(): string[] {
  return [...COMPOSE.matchAll(/fetch\('(http:\/\/127\.0\.0\.1:\d+\/[^']*)'\)/g)].map(
    (m) => m[1] ?? '',
  );
}

describe('deploy/Dockerfile', () => {
  it('копирует манифест каждого рабочего пакета — иначе npm ci в образе не сойдётся', () => {
    const missing = workspacePackages().filter(
      (p) => !DOCKERFILE.includes(`COPY ${p}/package.json`),
    );
    expect(missing, `нет в deploy/Dockerfile: ${missing.join(', ')}`).toEqual([]);
  });

  it('копирует схему базы и prisma.config.ts до npm ci: клиент Prisma генерируется на postinstall', () => {
    const schema = DOCKERFILE.indexOf('COPY packages/database/prisma ');
    const config = DOCKERFILE.indexOf('COPY packages/database/prisma.config.ts');
    const install = DOCKERFILE.indexOf('RUN npm ci');
    expect(schema).toBeGreaterThan(-1);
    expect(config).toBeGreaterThan(-1);
    expect(schema).toBeLessThan(install);
    expect(config).toBeLessThan(install);
  });

  it('ставит и devDependencies: API и скрипты идут через tsx, стойка собирается next-ом', () => {
    expect(DOCKERFILE).toMatch(/npm ci[^\n]*--include=dev/);
  });

  it('собирает стойку: next start без сборки не поднимется', () => {
    expect(DOCKERFILE).toContain('npm run build -w apps/web');
  });

  it('ставит пояс объекта', () => {
    expect(DOCKERFILE).toContain('TZ=Asia/Almaty');
  });

  it('не запускается от root и держит PID 1 за tini', () => {
    expect(DOCKERFILE).toContain('USER node');
    expect(DOCKERFILE).toMatch(/ENTRYPOINT \["\/sbin\/tini", "--"\]/);
  });
});

describe('deploy/compose.yml', () => {
  const services = ['api:', 'web:', 'cloudflared:'];

  it('поднимает три службы: API, стойка, туннель', () => {
    for (const s of services) expect(COMPOSE).toContain(`  ${s}`);
  });

  it('службы синхронизации с Legacy нет: Legacy перестал быть источником (ADR-052, 19.09.2026)', () => {
    // Не косметика: пока служба была в compose, `up -d` поднимал её вместе со всеми и она тянула
    // брони из системы, от которой отказались, — поверх ручных правок смены.
    expect(withoutComments(COMPOSE)).not.toContain('legacy-sync');
    expect(withoutComments(COMPOSE)).not.toContain('cli-sync-day');
  });

  it('API и стойка идут из одного образа — иначе сборка стойки и клиент базы разъезжаются', () => {
    expect(COMPOSE).toContain('image: pms-lux:latest');
    // api и web; у cloudflared свой образ провайдера. Было три, пока в compose жил legacy-sync (ADR-052)
    expect(COMPOSE.match(/<<: \*app/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('туннель ровно один и никогда не масштабируется', () => {
    expect(COMPOSE.match(/^ {2}cloudflared:$/gm)).toHaveLength(1);
    expect(COMPOSE).not.toMatch(/replicas:\s*[2-9]/);
    expect(COMPOSE).not.toMatch(/scale:\s*[2-9]/);
  });

  it('живость меряется маршрутами, которые отвечают и с включённым замком', () => {
    // С AUTH_REQUIRED=1 рабочие маршруты отдают 401 без сессии. Если ими мерить здоровье,
    // контейнер API навсегда останется «нездоровым», а web и cloudflared ждут его здоровья
    // (depends_on: service_healthy) и не поднимутся вовсе.
    const checks = healthUrls();
    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect(checks.some((u) => u.endsWith('/health'))).toBe(true);
    for (const url of checks) {
      expect(url, `здоровье нельзя мерить закрытым маршрутом: ${url}`).not.toMatch(
        /\/(inventory|desk|reservations|chessboard|rates|finance|today)/,
      );
    }
  });

  it('API в контейнере слушает 0.0.0.0 — иначе до него не достучится никто, даже стойка', () => {
    expect(service('api')).toMatch(/API_HOST:\s*'?0\.0\.0\.0'?/);
  });

  it('API запускается из своей папки: из корня tsx берёт tsconfig без декораторов и Nest падает', () => {
    // 18.09.2026 на сервере: команда из корня давала «Parameter decorators only work when experimental
    // decorators are enabled» и контейнер валился по кругу. На Mac не видно — launchd зовёт
    // workspace-скрипт, который уже стоит в apps/api.
    const api = service('api');
    expect(api).toMatch(/working_dir:\s*\/app\/apps\/api/);
    expect(api, 'команда считается от рабочей папки, путь от корня — та же ошибка').not.toMatch(
      /command:.*apps\/api\/src\/main\.ts/,
    );
  });

  it('у API пул соединений задан явно: умолчание переполняет пулер и роняет соседнюю копию', () => {
    // 18–19.09.2026: вторая копия PMS с пулом по умолчанию выбрала остаток Session pooler Supabase
    // (15 клиентов на проект), и боевая стойка отвечала 500 — 609 раз на одной карточке брони.
    expect(service('api')).toMatch(/DATABASE_POOL_MAX:/);
  });

  it('стойка поднимается своей командой: npm run start -w apps/web прибит к 127.0.0.1', () => {
    const web = service('web');
    expect(web).toContain('--hostname');
    expect(web).toContain('0.0.0.0');
    expect(web).not.toMatch(/command:.*npm.*start.*-w.*apps\/web/s);
  });

  it('стойка ходит в API по имени службы, а не в собственный контейнер', () => {
    expect(service('web')).toMatch(/APP_API_URL:\s*http:\/\/api:3001/);
  });

  it('проверки синхронизации из Legacy у сторожа больше нет — и выключателя для неё в compose тоже (ADR-073)', () => {
    // С 19.09 Legacy не источник (ADR-052), 23.09 проверку сняли из кода: выключатель стал бы мёртвой строкой.
    expect(service('api')).not.toMatch(/GUARD_LEGACY_SYNC/);
  });

  it('выключателя GUARD_LOCAL_FILES в compose больше нет: возраст файлов сторож судит сам', () => {
    // Слепок образа отсеивается по дате отчёта и времени прогона (LOCAL_FILE_FRESH_MS в @pms/domain);
    // выключатель, забытый на новом сервере, снова родил бы будильники дня сборки.
    expect(service('api')).not.toMatch(/GUARD_LOCAL_FILES/);
  });

  it('API и туннель в общей сети с ботом (ADR-081): сеть заводит сама платформа, без выхода наружу, стойки в ней нет', () => {
    // Помощник читает у API ошибки человека и состояние сторожа, API зовёт продавца по SELLER_URL — по внутренней
    // сети, туннель остаётся с шестью путями (docs/assistant/README.md §3). Внешней (external) сеть не объявлена:
    // иначе выкладка платформы падала бы, пока сеть не завели руками. Туннелю сеть нужна, чтобы вывести наружу
    // assistant.wetop.ai (только чат и живость — правило ниже); стойке бот не нужен.
    const code = withoutComments(COMPOSE);
    const block = code.match(/^networks:\n((?: {2,}.*\n)+)/m)?.[1] ?? '';
    expect(block).toMatch(/^ {2}wetop-internal:\n/m);
    expect(block).toMatch(/name: wetop-internal/);
    expect(block).toMatch(/internal: true/);
    expect(block).not.toMatch(/external:/);
    for (const s of ['api', 'cloudflared'])
      expect(withoutComments(service(s)), s).toMatch(/networks: \[default, wetop-internal\]/);
    expect(withoutComments(service('web'))).not.toContain('wetop-internal');
  });

  it('сторож проверяет стойку по имени службы, а не собственный контейнер', () => {
    // Умолчание в коде (guard.adapters.ts) — http://127.0.0.1:3000: верно на Mac, где службы рядом.
    // В контейнере это сам api, где на 3000 никто не слушает, и «стойка не отвечает» горит всегда.
    expect(service('api')).toMatch(/GUARD_WEB_URL:\s*http:\/\/web:3000/);
  });

  it('порты наружу не публикуются: 0.0.0.0 виден только внутри сети compose', () => {
    // expose — соседям по сети; ports — на хост и в интернет. Наружу ходит только туннель.
    expect(COMPOSE).not.toMatch(/^\s+ports:/m);
    expect(COMPOSE).toMatch(/expose: \['3001'\]/);
    expect(COMPOSE).toMatch(/expose: \['3000'\]/);
  });

  it('выключатель ARI подхватывается файлом и не обязателен', () => {
    // scripts/ops/ari.sh stop кладёт deploy/ari.env, start его убирает. Файл необязателен:
    // его отсутствие — это «ARI включён», а не отказ compose подняться.
    expect(COMPOSE).toMatch(/path: ari\.env\s*\n\s*required: false/);
  });

  it('секреты приходят снаружи, а не из файла compose, и .env лежит в корне репозитория', () => {
    // .env читается из корня десятками мест (main.ts, cli-check-env, prisma migrate на хосте):
    // один файл на сервере, compose берёт его по относительному пути, а не свою копию в deploy/.
    expect(COMPOSE).toMatch(/path: \.\.\/\.env\s*\n\s*required: true/);
    expect(COMPOSE).not.toMatch(/env_file:[\s\S]{0,40}deploy\/\.env/);
    // Ни одного присвоения, похожего на ключ или строку подключения
    expect(COMPOSE).not.toMatch(/(API_KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)\s*[:=]\s*\S/i);
  });

  it('боевой миграции в службах нет: её делает владелец руками (AGENTS.md §15)', () => {
    expect(withoutComments(COMPOSE)).not.toContain('migrate deploy');
  });

  it('команды служб зовут то, что есть в репозитории', () => {
    // Путь считается от рабочей папки службы, а не от корня образа (см. проверку про working_dir)
    expect(existsSync(join(ROOT, 'apps/api/src/main.ts'))).toBe(true);
    expect(service('api')).toContain("'src/main.ts'");
  });

  it('ключ туннеля монтируется только на чтение', () => {
    expect(COMPOSE).toContain('./cloudflared:/etc/cloudflared:ro');
  });

  it('сторож видит статус ночной копии, но не сами копии: смонтирована только папка статуса и только на чтение', () => {
    // ADR-078. В копиях хеши паролей и почты сотрудников — API они не нужны, ему нужна одна дата. Смонтируй
    // по ошибке всю /root/backups — и дамп базы окажется в контейнере, который смотрит в интернет через туннель.
    const api = service('api');
    expect(api).toContain('/root/backups/status:/backup-status:ro');
    expect(api).toMatch(/GUARD_BACKUP_STATUS:\s*\/backup-status\/last\.json/);
    expect(withoutComments(api)).not.toMatch(/\/root\/backups(?!\/status:)/);
    // сторож читает ровно то, что пишет скрипт копии
    expect(read('scripts/ops/db-backup.sh')).toContain('status/last.json');
  });
});

describe('контекст сборки', () => {
  it('runtime multer не содержит известные multipart DoS из версий до 2.3.0', () => {
    const lock = JSON.parse(read('package-lock.json'));
    const entries = Object.entries(lock.packages).filter(([name]) => name.endsWith('/multer'));
    expect(entries.length).toBeGreaterThan(0);
    for (const [, value] of entries) {
      const version = (value as { version: string }).version;
      const [major, minor] = version.split('.').map(Number);
      expect(major! > 2 || (major === 2 && minor! >= 3), version).toBe(true);
    }
  });
  it('Docker читает исключения из корня context, а не произвольного файла рядом с Dockerfile', () => {
    expect(existsSync(join(ROOT, '.dockerignore'))).toBe(true);
    expect(existsSync(join(ROOT, 'deploy/.dockerignore'))).toBe(false);
  });
  it('секреты в образ не попадают', () => {
    for (const p of ['.env', 'deploy/cloudflared/', '*.pem', '*.key', 'secrets/']) {
      expect(DOCKERIGNORE, `нет в .dockerignore: ${p}`).toContain(p);
    }
  });

  it('папка с ключом туннеля не едет в git', () => {
    expect(read('.gitignore')).toContain('deploy/cloudflared/');
  });

  it('образец конфига туннеля ходит в службы по именам, а не на 127.0.0.1', () => {
    const example = read('deploy/cloudflared.example.yml');
    expect(example).toContain('http://web:3000');
    expect(example).toContain('http://api:3001');
    // В шапке 127.0.0.1 упомянут как раз для того, чтобы объяснить разницу с версией для Mac,
    // поэтому смотрим только правила, без комментариев
    expect(withoutComments(example)).not.toContain('127.0.0.1');
  });

  it('помощник наружу — только чат и живость (ADR-081): панель бота и /internal/* туннель не пропускает', () => {
    const rules = withoutComments(read('deploy/cloudflared.example.yml'));
    const assistant = [
      ...rules.matchAll(/- hostname: assistant\.wetop\.ai\n\s+path: (\S+)\n\s+service: (\S+)/g),
    ];
    expect(assistant.map((m) => [m[1], m[2]])).toEqual([['^/(widget/.*|health)$', 'http://assistant:8000']]);
    // Последнее правило — отказ всему остальному
    expect(rules.trimEnd().split('\n').at(-1)).toMatch(/- service: http_status:404$/);
  });

  it('продавец наружу — только вебхук WhatsApp гостиницы (С3, SECURITY.md §11): чат, панель и /internal/* — нет', () => {
    const rules = withoutComments(read('deploy/cloudflared.example.yml'));
    // Одно правило и обязательно с путём: правило без path открыло бы наружу весь продавец
    expect(rules.match(/hostname: seller\.wetop\.ai/g)).toHaveLength(1);
    const seller = [
      ...rules.matchAll(/- hostname: seller\.wetop\.ai\n\s+path: (\S+)\n\s+service: (\S+)/g),
    ];
    expect(seller.map((m) => m[2])).toEqual(['http://seller:8000']);
    const path = new RegExp(seller[0]![1]!);
    const org = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    expect(path.test(`/channels/whatsapp/webhook/${org}`)).toBe(true);
    // Чат продавца на сайт объекта — только когда база бота в РК (ADR-009); панель и служебное — никогда.
    // Кривой номер организации до бота не доходит: он ответил бы разбором ошибки со своими именами полей
    for (const closed of [
      '/widget/widget.js',
      '/widget/session',
      '/health',
      '/internal/sandbox',
      '/internal/health',
      '/panel-x/conversations',
      '/channels/whatsapp/webhook/',
      '/channels/whatsapp/webhook/not-a-uuid',
      `/channels/whatsapp/webhook/${org}/extra`,
      `/channels/whatsapp/webhook/${org.toUpperCase()}`,
      `/x/channels/whatsapp/webhook/${org}`,
    ])
      expect(path.test(closed), closed).toBe(false);
  });
});
