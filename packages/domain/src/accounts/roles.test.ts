import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_ROLES,
  canChangeRole,
  canConfigureSeller,
  canManageStaff,
  identityRole,
  parseMembershipRole,
} from './roles';

/** Роли в организации (DATA_MODEL §16.1, ADR-083): две, на стойке равноправны, владельцу — сотрудники и продавец */
describe('роли в организации', () => {
  it('две роли словами стойки', () => {
    expect(MEMBERSHIP_ROLES).toEqual({ OWNER: 'владелец', STAFF: 'сотрудник' });
  });

  it('сотрудников приглашает и настройки продавца меняет только владелец', () => {
    expect(canManageStaff('OWNER')).toBe(true);
    expect(canManageStaff('STAFF')).toBe(false);
    expect(canConfigureSeller('OWNER')).toBe(true);
    expect(canConfigureSeller('STAFF')).toBe(false);
  });

  it('в подписи помощника роль строчными — как в эталоне ТЗ (`…|owner|…`)', () => {
    expect(identityRole('OWNER')).toBe('owner');
    expect(identityRole('STAFF')).toBe('staff');
  });

  it('роль из команды: owner и staff в любом регистре, остальное — не роль', () => {
    expect(parseMembershipRole('owner')).toBe('OWNER');
    expect(parseMembershipRole(' STAFF ')).toBe('STAFF');
    for (const raw of ['', 'admin', 'владелец', 'OWNERS']) expect(parseMembershipRole(raw)).toBeNull();
  });

  it('последнего владельца организации снять нельзя; второго — можно; сотрудника сделать владельцем — можно', () => {
    expect(canChangeRole({ current: 'OWNER', next: 'STAFF', owners: 1 })).toEqual({
      ok: false,
      reason: 'Это единственный владелец организации: сначала назначьте другого',
    });
    expect(canChangeRole({ current: 'OWNER', next: 'STAFF', owners: 2 })).toEqual({ ok: true });
    expect(canChangeRole({ current: 'STAFF', next: 'OWNER', owners: 1 })).toEqual({ ok: true });
    expect(canChangeRole({ current: 'STAFF', next: 'STAFF', owners: 1 })).toEqual({ ok: true });
  });
});
