import { describe, expect, it } from 'vitest';
import {
  ACCESS_LEVELS,
  accessLevelInfo,
  accessLevelsFor,
  defaultAccessLevel,
  inviteRoleOfLevel,
  levelOfRole,
  parseStaffAccess,
} from './access-levels';
import { can } from './permissions';

// Доступ при добавлении сотрудника (решение владельца 20.10.2026, docs/decisions/2026-10-20-staff-access-levels.md)
describe('уровни доступа сотрудника', () => {
  it('четыре уровня по порядку и роль каждого', () => {
    expect(ACCESS_LEVELS).toEqual(['NONE', 'PORTAL', 'STAFF', 'MANAGER']);
    expect(ACCESS_LEVELS.map(inviteRoleOfLevel)).toEqual([null, 'EMPLOYEE', 'STAFF', 'MANAGER']);
    expect(levelOfRole('EMPLOYEE')).toBe('PORTAL');
    expect(levelOfRole('OWNER')).toBe('OWNER');
  });

  it('«Личный кабинет» открывает только своё (и приём своих заказов в ресторане, §33.6)', () => {
    expect(can('EMPLOYEE', 'self')).toBe(true);
    expect(can('EMPLOYEE', 'orders')).toBe(true);
    for (const p of ['desk', 'reports', 'dialogs', 'staff', 'refunds', 'settings'] as const)
      expect(can('EMPLOYEE', p)).toBe(false);
  });

  it('по умолчанию: специалист и «оба» получают кабинет, другой сотрудник без входа', () => {
    expect(defaultAccessLevel('SPECIALIST')).toBe('PORTAL');
    expect(defaultAccessLevel('BOTH')).toBe('PORTAL');
    expect(defaultAccessLevel('OTHER_EMPLOYEE')).toBe('NONE');
    expect(defaultAccessLevel(null)).toBe('NONE');
  });

  it('владелец выдаёт все уровни, управляющий без «Управляющего», администратор никакие', () => {
    expect(accessLevelsFor('OWNER')).toEqual(['NONE', 'PORTAL', 'STAFF', 'MANAGER']);
    expect(accessLevelsFor('MANAGER')).toEqual(['NONE', 'PORTAL', 'STAFF']);
    expect(accessLevelsFor('STAFF')).toEqual([]);
    expect(accessLevelsFor('EMPLOYEE')).toEqual([]);
  });

  it('у каждого уровня понятное «что увидит» своими словами направления', () => {
    const salon = accessLevelInfo('BEAUTY');
    expect(salon.PORTAL.label).toBe('Личный кабинет');
    expect(salon.PORTAL.sees).toEqual(['Свои записи', 'Свой график', 'Своя зарплата', 'Свои отзывы']);
    expect(salon.STAFF.sees).toContain('Клиенты');
    expect(salon.NONE.sees).toEqual([]);
    expect(accessLevelInfo('FOOD_SERVICE').PORTAL.sees).toContain('Свои заказы');
    expect(accessLevelInfo('HOSPITALITY').STAFF.sees).toContain('Брони и гости');
    expect(salon.MANAGER.denies).toContain('Платные расширения и управляющие');
  });
});

describe('parseStaffAccess: блок «Доступ в WETOP» из формы', () => {
  const base = { actor: 'OWNER' as const, actorRestricted: false };
  it('без входа: почта не нужна', () => {
    expect(parseStaffAccess({ level: 'NONE' }, base)).toEqual({ ok: true, access: null });
    expect(parseStaffAccess(undefined, base)).toEqual({ ok: true, access: null });
  });
  it('с входом нужна почта', () => {
    expect(parseStaffAccess({ level: 'PORTAL', email: '' }, base)).toEqual({
      ok: false,
      message: 'Для входа в WETOP укажите почту: на неё придёт приглашение.',
    });
    expect(parseStaffAccess({ level: 'PORTAL', email: ' Anna@Mail.KZ ' }, base)).toEqual({
      ok: true,
      access: { role: 'EMPLOYEE', email: 'anna@mail.kz', allBranches: false },
    });
  });
  it('управляющего выдаёт только владелец', () => {
    expect(parseStaffAccess({ level: 'MANAGER', email: 'a@b.kz' }, { actor: 'MANAGER', actorRestricted: false })).toEqual({
      ok: false,
      message: 'Этот уровень доступа выдаёт только владелец.',
    });
  });
  it('«Все филиалы» только у того, кто сам без ограничения', () => {
    expect(
      parseStaffAccess({ level: 'STAFF', email: 'a@b.kz', allBranches: true }, { actor: 'MANAGER', actorRestricted: true }),
    ).toEqual({ ok: false, message: 'Доступ ко всем филиалам выдаёт сотрудник без ограничения по филиалам.' });
    expect(parseStaffAccess({ level: 'STAFF', email: 'a@b.kz', allBranches: true }, base)).toEqual({
      ok: true,
      access: { role: 'STAFF', email: 'a@b.kz', allBranches: true },
    });
  });
  it('неизвестный уровень', () => {
    expect(parseStaffAccess({ level: 'ROOT' }, base)).toEqual({ ok: false, message: 'Выберите уровень доступа.' });
  });
});
