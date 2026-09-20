import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LUXX_APARTS_PROPERTY } from './index';

const ROOT = resolve(import.meta.dirname, '../../../..');

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return tsFiles(p);
    return e.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx')) ? [p] : [];
  });
}

/**
 * Реквизиты объекта переехали из импорта Exely в домен (20.09.2026, ADR-052). Тест держит две вещи:
 * значения не поехали при переносе, и API больше не берёт их из пакета импорта — иначе удаление кода
 * Exely снова упрётся в тринадцать репозиториев, каждый из которых начинает запрос с имени объекта.
 */
describe('реквизиты объекта', () => {
  it('значения те же, что в OBJECT.md §1', () => {
    expect(LUXX_APARTS_PROPERTY).toMatchObject({
      name: 'Luxx Aparts',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
  });

  it('API не тянет объект из @pms/imports', () => {
    const guilty = tsFiles(resolve(ROOT, 'apps/api/src')).filter((p) => {
      const text = readFileSync(p, 'utf8');
      return /import[^;]*LUXX_APARTS_PROPERTY[^;]*from '@pms\/imports'/s.test(text);
    });
    expect(guilty.map((p) => p.slice(ROOT.length + 1)), 'эти файлы всё ещё берут объект из импорта').toEqual([]);
  });
});
