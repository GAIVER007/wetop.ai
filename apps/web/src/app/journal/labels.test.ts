import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTION_RU, ENTITY_RU, actionLabel, entityLabel } from './labels';

/**
 * Каждый код действия и тип объекта, который API пишет в журнал литералом, имеет подпись (аудит платформы
 * 17.10.2026, Д5). Коды, собранные шаблонной строкой, сюда не попадают: для них есть подпись раздела.
 */
const API = resolve(import.meta.dirname, '../../../../api/src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [full] : [];
  });
}
const text = sources(API)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const literals = (key: string, pattern: string) =>
  [
    ...new Set([...text.matchAll(new RegExp(`${key}: '(${pattern})'`, 'g'))].map((m) => m[1]!)),
  ].sort();

describe('подписи журнала операций', () => {
  it('у каждого кода действия из API есть подпись', () => {
    const codes = literals('action', '[a-z_]+(?:\\.[a-zA-Z_]+)+');
    expect(codes.length).toBeGreaterThan(100);
    expect(codes.filter((code) => !ACTION_RU[code])).toEqual([]);
  });
  it('у каждого типа объекта из API есть подпись', () => {
    const types = literals('entityType', '[A-Za-z_-]+');
    expect(types.filter((type) => !ENTITY_RU[type])).toEqual([]);
  });
  it('незнакомый код показывается разделом, а не сырой строкой', () => {
    expect(actionLabel('beauty.something.new')).toBe('Действие: салон');
    expect(actionLabel('food.something.new')).toBe('Действие: ресторан');
  });
  it('аудит 21.10.2026 п. 10: подписи с большой буквы, у кодов сотрудников свои подписи', () => {
    expect(Object.entries(ACTION_RU).filter(([, v]) => v[0] !== v[0]!.toUpperCase())).toEqual([]);
    expect(actionLabel('membership.suspended')).toBe('Доступ сотрудника приостановлен');
    expect(actionLabel('membership.resumed')).toBe('Доступ сотрудника возобновлён');
    expect(actionLabel('user.login')).toBe('Вход в систему');
  });
});

describe('фильтры истории действий', () => {
  // «Ячейки» — служебное слово для номера или места (аудит 22.10.2026, P2-2)
  it('фильтр номеров назван по-человечески', () => {
    const page = readFileSync(resolve(import.meta.dirname, 'page.tsx'), 'utf8');
    expect(page).toContain("['InventoryUnit', 'Номера и места']");
    expect(page).not.toContain('Ячейки');
  });
});

describe('события входа и регистрации понятны (аудит 22.10.2026, P2-3)', () => {
  it('регистрация владельца названа событием, а не «Действие: сотрудники»', () => {
    expect(actionLabel('user.register')).toBe('Аккаунт создан');
  });
  it('объект входа: учётная запись, а не «где: Сотрудник»', () => {
    expect(entityLabel('user')).toBe('Учётная запись');
  });
  it('коды, которые API пишет через this.record(…), тоже имеют подпись', () => {
    const auth = readFileSync(resolve(API, 'auth/auth.service.ts'), 'utf8');
    const codes = [...auth.matchAll(/this\.record\([^,]+,\s*'([a-z_.]+)'/g)].map((m) => m[1]!);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.filter((code) => !ACTION_RU[code])).toEqual([]);
  });
});
