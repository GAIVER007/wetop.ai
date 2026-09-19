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
 *  7. боевая миграция, вписанная в команду службы, — её делает владелец (AGENTS.md §15).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const DOCKERFILE = read('deploy/Dockerfile');
const COMPOSE = read('deploy/compose.yml');
const DOCKERIGNORE = read('deploy/.dockerignore');

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
  return [...COMPOSE.matchAll(/fetch\('(http:\/\/127\.0\.0\.1:\d+\/[^']*)'\)/g)].map((m) => m[1] ?? '');
}

describe('deploy/Dockerfile', () => {
  it('копирует манифест каждого рабочего пакета — иначе npm ci в образе не сойдётся', () => {
    const missing = workspacePackages().filter((p) => !DOCKERFILE.includes(`COPY ${p}/package.json`));
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
  const services = ['api:', 'web:', 'cloudflared:', 'exely-sync:'];

  it('поднимает четыре службы, которые на Mac держал launchd', () => {
    for (const s of services) expect(COMPOSE).toContain(`  ${s}`);
  });

  it('API и стойка идут из одного образа — иначе сборка стойки и клиент базы разъезжаются', () => {
    expect(COMPOSE).toContain('image: pms-lux:latest');
    expect(COMPOSE.match(/<<: \*app/g)?.length).toBeGreaterThanOrEqual(3);
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

  it('порты наружу не публикуются: 0.0.0.0 виден только внутри сети compose', () => {
    // expose — соседям по сети; ports — на хост и в интернет. Наружу ходит только туннель.
    expect(COMPOSE).not.toMatch(/^\s+ports:/m);
    expect(COMPOSE).toMatch(/expose: \['3001'\]/);
    expect(COMPOSE).toMatch(/expose: \['3000'\]/);
  });

  it('у синхронизации Exely пул один: сумма пулов обязана быть меньше предела базы', () => {
    expect(service('exely-sync')).toMatch(/DATABASE_POOL_MAX:\s*'?1'?/);
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
    expect(existsSync(join(ROOT, 'scripts/imports/src/cli-sync-day.ts'))).toBe(true);
    expect(service('exely-sync')).toContain('scripts/imports/src/cli-sync-day.ts --auto');
  });

  it('ключ туннеля монтируется только на чтение', () => {
    expect(COMPOSE).toContain('./cloudflared:/etc/cloudflared:ro');
  });
});

describe('контекст сборки', () => {
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
});
