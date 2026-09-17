/**
 * Сборка и службы сервера (`deploy/`, plans/server-kz-2026-09-17.md, шаг 0).
 *
 * Сам образ здесь не собирается — в контейнере агента нет демона Docker, сборка проверяется на сервере
 * (шаг 1 плана). Тест держит то, что ломается молча и обнаруживается только на боевой машине:
 *
 *  1. новый рабочий пакет в монорепозитории → его манифест не скопирован в образ → `npm ci` внутри
 *     сборки не сходится с package-lock.json, а узнаём мы об этом на сервере;
 *  2. секрет, случайно вписанный в compose или попавший в контекст сборки (SECURITY.md §3);
 *  3. вторая копия туннеля — 17.09.2026 две копии одного туннеля поделили запросы, и адрес отвечал
 *     через раз;
 *  4. пул синхронизации больше одного соединения — переполняет пулер, запросы стойки падают в 500
 *     (15.09.2026).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const DOCKERFILE = read('deploy/Dockerfile');
const COMPOSE = read('deploy/compose.yml');
const DOCKERIGNORE = read('deploy/.dockerignore');

/** Рабочие пакеты монорепозитория — так же, как их видит npm: каталог с package.json. */
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

describe('deploy/Dockerfile', () => {
  it('копирует манифест каждого рабочего пакета — иначе npm ci в образе не сойдётся', () => {
    const missing = workspacePackages().filter((p) => !DOCKERFILE.includes(`COPY ${p}/package.json`));
    expect(missing, `нет в deploy/Dockerfile: ${missing.join(', ')}`).toEqual([]);
  });

  it('копирует схему базы до npm ci: клиент Prisma генерируется из неё на сборке', () => {
    const schema = DOCKERFILE.indexOf('packages/database/prisma');
    const install = DOCKERFILE.indexOf('RUN npm ci');
    expect(schema).toBeGreaterThan(-1);
    expect(schema).toBeLessThan(install);
  });

  it('собирает стойку: next start без сборки не поднимется', () => {
    expect(DOCKERFILE).toContain('npm run build -w apps/web');
  });

  it('ставит пояс объекта', () => {
    expect(DOCKERFILE).toContain('TZ=Asia/Almaty');
  });

  it('не запускается от root', () => {
    expect(DOCKERFILE).toContain('USER node');
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

  it('у синхронизации пул в одно соединение', () => {
    expect(COMPOSE).toMatch(/DATABASE_POOL_MAX:\s*'1'/);
  });

  it('секреты приходят снаружи, а не из файла compose', () => {
    expect(COMPOSE).toContain('env_file: .env');
    // Ни одного присвоения, похожего на ключ или строку подключения
    expect(COMPOSE).not.toMatch(/(API_KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)\s*[:=]\s*\S/i);
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
    const rules = example
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    expect(rules).not.toContain('127.0.0.1');
  });
});
