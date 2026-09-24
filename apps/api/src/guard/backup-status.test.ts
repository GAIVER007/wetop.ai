import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readBackupStatus } from './backup-status';

/**
 * Файл статуса ночной копии (ADR-077) на диске контейнера API: `/backup-status/last.json`, папка смонтирована только на
 * чтение. Три исхода разные для человека: копия есть; статуса нет (cron не снимал, папка не смонтирована); файл есть,
 * но не читается (права, мусор) — причину видно в заголовке неисправности.
 */
describe('readBackupStatus: статус ночной копии с диска', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const dir = () => {
    const d = mkdtempSync(join(tmpdir(), 'wetop-backup-status-'));
    dirs.push(d);
    return d;
  };

  it('файл статуса есть — время, имя, размер и число таблиц', () => {
    const file = join(dir(), 'last.json');
    writeFileSync(
      file,
      '{"at":"2026-09-24T23:30:07Z","file":"wetop-20260924T233001Z.dump","bytes":207886,"tables":41}\n',
    );
    expect(readBackupStatus(file)).toEqual({
      state: 'ok',
      status: {
        at: new Date('2026-09-24T23:30:07Z'),
        file: 'wetop-20260924T233001Z.dump',
        bytes: 207_886,
        tables: 41,
      },
    });
  });

  it('файла нет — «статуса нет», а не ошибка проверки', () => {
    expect(readBackupStatus(join(dir(), 'last.json'))).toEqual({ state: 'missing' });
  });

  it('на месте файла папка или мусор — «не читается» с причиной', () => {
    const folder = join(dir(), 'last.json');
    mkdirSync(folder);
    expect(readBackupStatus(folder)).toEqual({ state: 'unreadable', error: 'EISDIR' });

    const junk = join(dir(), 'last.json');
    writeFileSync(junk, 'PGDMP');
    expect(readBackupStatus(junk)).toEqual({ state: 'unreadable', error: 'не статус копии' });
  });
});
