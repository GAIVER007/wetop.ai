import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож образа и служб сервера (plans/server-kz-2026-09-18.md, шаг 4).
 *
 * Все три проверки здесь — про ошибки, которые видно только на сервере и поздно:
 * пропущенный манифест валит `npm ci` внутри образа, `127.0.0.1` в контейнере делает службу
 * невидимой для соседей, пул больше предела базы роняет стойку в 500 (случай 15.09.2026).
 */
const ROOT = resolve(import.meta.dirname, '../..');
const dockerfile = () => readFileSync(resolve(ROOT, 'deploy/Dockerfile'), 'utf8');
const compose = () => readFileSync(resolve(ROOT, 'deploy/compose.yml'), 'utf8');

/** Только то, что исполняется: в пояснениях эти же слова стоят намеренно. */
const withoutComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

/** Папки рабочих пакетов монорепозитория — по факту на диске, а не по списку в коде теста. */
function workspaceManifests(): string[] {
  const found: string[] = [];
  for (const group of ['apps', 'packages', 'scripts']) {
    for (const name of readdirSync(resolve(ROOT, group))) {
      const manifest = `${group}/${name}/package.json`;
      if (existsSync(resolve(ROOT, manifest))) found.push(manifest);
    }
  }
  return found;
}

/** Кусок compose.yml от заголовка службы до следующей службы того же уровня. */
function service(name: string): string {
  const text = compose();
  const start = text.indexOf(`\n  ${name}:`);
  expect(start, `служба ${name} в compose.yml`).toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe('образ и службы сервера', () => {
  it('в образ скопирован манифест каждого рабочего пакета — иначе npm ci падает внутри образа', () => {
    const text = dockerfile();
    const missing = workspaceManifests().filter((m) => !text.includes(m));
    expect(missing, 'нет COPY для манифестов').toEqual([]);
  });

  it('схема Prisma копируется до npm ci: клиент генерируется на postinstall', () => {
    const text = dockerfile();
    const schema = text.indexOf('COPY packages/database/prisma');
    const install = text.indexOf('RUN npm ci');
    expect(schema).toBeGreaterThan(-1);
    expect(schema).toBeLessThan(install);
  });

  it('портов наружу нет: снаружи объект виден только через туннель', () => {
    expect(compose()).not.toMatch(/^\s*ports:/m);
  });

  it('API в контейнере слушает не 127.0.0.1 — иначе до него не достучится никто, даже стойка', () => {
    expect(service('api')).toMatch(/API_HOST:\s*0\.0\.0\.0/);
  });

  it('стойка поднимается своей командой: npm run start -w apps/web прибит к 127.0.0.1', () => {
    const web = service('web');
    expect(web).toContain('--hostname');
    expect(web).toContain('0.0.0.0');
    expect(web).not.toMatch(/command:.*npm.*start.*-w.*apps\/web/s);
  });

  it('у синхронизации Exely пул один: сумма пулов обязана быть меньше предела базы', () => {
    expect(service('exely-sync')).toMatch(/DATABASE_POOL_MAX:\s*'?1'?/);
  });

  it('.env берётся из корня репозитория — одно место для compose и для скриптов', () => {
    expect(compose()).toContain('../.env');
    expect(compose()).not.toMatch(/env_file:[\s\S]{0,40}deploy\/\.env/);
  });

  it('боевой миграции в службах нет: её делает владелец руками (AGENTS.md §15)', () => {
    expect(withoutComments(compose())).not.toContain('migrate deploy');
  });

  it('команды служб зовут то, что есть в package.json', () => {
    const scripts = JSON.parse(readFileSync(resolve(ROOT, 'apps/api/package.json'), 'utf8')).scripts;
    expect(scripts.start).toBeTruthy();
    expect(service('api')).toContain("'start', '-w', 'apps/api'");
  });
});
