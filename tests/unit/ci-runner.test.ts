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
