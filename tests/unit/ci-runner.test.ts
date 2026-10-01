/**
 * Свой раннер GitHub Actions (`scripts/ops/ci-runner`, разбор 21.09.2026).
 *
 * Держит то, что ломается молча и обнаруживается через неделю:
 *  1. раннеру дали сокет Docker — код из любой ветки получает root на машине, где рядом чужие проекты
 *     и боевая PMS;
 *  2. тяжёлые задачи вернулись на раннеры GitHub, где минуты выбраны и ничего не запускается;
 *  3. задача с базой уехала на свой раннер, где нет Docker для `services: postgres`, и падает не по делу.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const WORKFLOW = read('.github/workflows/checks.yml');
const COMPOSE = read('scripts/ops/ci-runner/compose.yml');

/** Только то, что исполняется: в пояснениях те же слова стоят намеренно. */
const withoutComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

/** Кусок файла от заголовка задачи до следующей задачи того же уровня */
function job(name: string): string {
  const start = WORKFLOW.indexOf(`\n  ${name}:\n`);
  expect(start, `задача ${name} не найдена`).toBeGreaterThan(-1);
  const rest = WORKFLOW.slice(start + 1);
  const next = rest.search(/\n {2}[a-z][a-z-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('свой раннер CI', () => {
  it('раннеру не дают сокет Docker: это был бы root на машине с чужими проектами', () => {
    const run = withoutComments(COMPOSE);
    expect(run).not.toContain('docker.sock');
    expect(run).not.toContain('privileged');
  });

  it('потолки памяти и процессора заданы: браузерные проверки не душат боевую стойку', () => {
    const run = withoutComments(COMPOSE);
    expect(run).toMatch(/mem_limit:/);
    expect(run).toMatch(/cpus:/);
  });

  it('тяжёлые задачи идут на свой раннер: минуты GitHub выбраны', () => {
    for (const name of ['fast', 'ui-shard', 'ui'])
      expect(job(name), name).toMatch(/runs-on: \[self-hosted, linux, x64, wetop\]/);
  });

  it('задача с базой остаётся на GitHub: ей нужен Docker для services: postgres', () => {
    const db = job('db');
    expect(db).toMatch(/runs-on: ubuntu-24\.04/);
    expect(db).toContain('services:');
    expect(db).toContain('postgres');
  });
});

/**
 * Разбор 01.10.2026 (reports/order-2026-10-01, пункты 8 и 9).
 *  8. Тесты бота (pytest, apps/ai-seller) в проверки GitHub не входили: `release` мог уйти вперёд с красным ботом.
 *  9. Свой раннер стоит на боевом сервере и исполняет код из запросов на слияние. Код из форка на него попадать
 *     не должен: задачи на своём раннере идут только для пушей в этот репозиторий и PR из его же веток.
 */
describe('проверки GitHub после разбора 01.10.2026', () => {
  const selfHosted = ['fast', 'ui-shard', 'ui', 'bot'];

  it('тесты бота идут отдельной задачей на своём раннере', () => {
    const bot = job('bot');
    expect(bot).toMatch(/runs-on: \[self-hosted, linux, x64, wetop\]/);
    expect(bot).toContain('apps/ai-seller');
    expect(bot).toMatch(/pytest/);
    expect(bot).toMatch(/requirements\.txt/);
  });

  // Задача db на раннере GitHub была красной на каждом PR с 30.09: три файла интеграционных тестов (rls-isolation,
  // rls-credential-grants, integration-tables-role) ходят в базу сырым pg по DATABASE_URL, как локальный стенд
  // (scripts/ops/local-db.sh): схема public заполнена migrate:deploy, вход 127.0.0.1 по trust, wetop_app без пароля.
  // В CI public была пустой, а postgres требовал пароль: «relation does not exist» и «SASL: client password».
  it('задача db повторяет локальный стенд: миграции в public и вход без пароля', () => {
    const db = withoutComments(job('db'));
    expect(db).toMatch(/POSTGRES_HOST_AUTH_METHOD: trust/);
    expect(db).toMatch(/migrate:deploy -w @pms\/database/);
    expect(db).toMatch(/tests\/tools\/seed-local\.ts/);
    expect(db.indexOf('migrate:deploy')).toBeLessThan(db.indexOf('seed-local.ts'));
    expect(db.indexOf('seed-local.ts')).toBeLessThan(db.indexOf('--project integration'));
  });

  // Очередь на уровне workflow держала весь прогон, пока задачи своего раннера стояли в очереди (01.10 раннер wetop
  // не брал задачи): новый прогон висел «pending», и задача db на раннере GitHub не стартовала вовсе. Группа у каждой
  // задачи своя: db идёт сразу, части UI и bot ждут только свои прежние запуски.
  it('очередь на уровне задач: db на раннере GitHub не ждёт очереди своего раннера', () => {
    const top = withoutComments(WORKFLOW.split('\njobs:\n')[0]!);
    expect(top).not.toMatch(/^concurrency:/m);
    for (const name of ['fast', 'db', 'ui-shard', 'ui', 'bot'])
      expect(withoutComments(job(name)), name).toMatch(/concurrency:\s*\n\s*group: [^\n]*\$\{\{ github\.ref \}\}/);
  });

  it('код из форка на свой раннер не попадает', () => {
    for (const name of selfHosted) {
      const text = withoutComments(job(name));
      expect(text, name).toMatch(
        /if: .*github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
      );
    }
  });
});
