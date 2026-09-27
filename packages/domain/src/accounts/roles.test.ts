import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_ROLES,
  canChangeRole,
  canConfigureSeller,
  canInvite,
  canManageStaff,
  canRemoveMember,
  canSetRoleAtDesk,
  identityRole,
  invitableRoles,
  parseInviteRole,
  parseMembershipRole,
} from './roles';

/**
 * Роли в организации (DATA_MODEL §16.1, ADR-083; третья роль и права — ADR-101, §16.5): владелец, управляющий,
 * администратор.
 */
describe('роли в организации', () => {
  it('три роли словами стойки; «сотрудник» стал «администратором»', () => {
    expect(MEMBERSHIP_ROLES).toEqual({
      OWNER: 'владелец',
      MANAGER: 'управляющий',
      STAFF: 'администратор',
    });
  });

  it('сотрудниками ведают владелец и управляющий, настройки продавца меняют они же', () => {
    expect(canManageStaff('OWNER')).toBe(true);
    expect(canManageStaff('MANAGER')).toBe(true);
    expect(canManageStaff('STAFF')).toBe(false);
    expect(canConfigureSeller('OWNER')).toBe(true);
    expect(canConfigureSeller('MANAGER')).toBe(true);
    expect(canConfigureSeller('STAFF')).toBe(false);
  });

  it('владелец зовёт управляющих и администраторов, управляющий — только администраторов', () => {
    expect(invitableRoles('OWNER')).toEqual(['MANAGER', 'STAFF']);
    expect(invitableRoles('MANAGER')).toEqual(['STAFF']);
    expect(invitableRoles('STAFF')).toEqual([]);
    expect(canInvite('OWNER', 'MANAGER')).toBe(true);
    expect(canInvite('MANAGER', 'MANAGER')).toBe(false);
    expect(canInvite('MANAGER', 'STAFF')).toBe(true);
    expect(canInvite('STAFF', 'STAFF')).toBe(false);
    // владельца приглашением не назначают — никому
    expect(canInvite('OWNER', 'OWNER')).toBe(false);
  });

  it('отключает тот, кто вправе позвать с этой ролью; владельца не отключить', () => {
    expect(canRemoveMember('OWNER', 'MANAGER')).toBe(true);
    expect(canRemoveMember('OWNER', 'STAFF')).toBe(true);
    expect(canRemoveMember('OWNER', 'OWNER')).toBe(false);
    expect(canRemoveMember('MANAGER', 'STAFF')).toBe(true);
    expect(canRemoveMember('MANAGER', 'MANAGER')).toBe(false);
    expect(canRemoveMember('STAFF', 'STAFF')).toBe(false);
  });

  it('на стойке роль меняет только владелец и только между управляющим и администратором', () => {
    expect(canSetRoleAtDesk('OWNER', 'STAFF', 'MANAGER')).toBe(true);
    expect(canSetRoleAtDesk('OWNER', 'MANAGER', 'STAFF')).toBe(true);
    expect(canSetRoleAtDesk('OWNER', 'STAFF', 'OWNER')).toBe(false);
    expect(canSetRoleAtDesk('OWNER', 'OWNER', 'MANAGER')).toBe(false);
    expect(canSetRoleAtDesk('MANAGER', 'STAFF', 'MANAGER')).toBe(false);
    expect(canSetRoleAtDesk('STAFF', 'STAFF', 'MANAGER')).toBe(false);
  });

  it('в подписи помощника роль строчными — как в эталоне ТЗ (`…|owner|…`)', () => {
    expect(identityRole('OWNER')).toBe('owner');
    expect(identityRole('MANAGER')).toBe('manager');
    expect(identityRole('STAFF')).toBe('staff');
  });

  it('роль из команды: owner, manager и staff в любом регистре, остальное — не роль', () => {
    expect(parseMembershipRole('owner')).toBe('OWNER');
    expect(parseMembershipRole('Manager')).toBe('MANAGER');
    expect(parseMembershipRole(' STAFF ')).toBe('STAFF');
    for (const raw of ['', 'admin', 'владелец', 'OWNERS']) expect(parseMembershipRole(raw)).toBeNull();
  });

  it('роль приглашения: manager или staff; владелец и прочее — не роль приглашения', () => {
    expect(parseInviteRole('manager')).toBe('MANAGER');
    expect(parseInviteRole(' STAFF ')).toBe('STAFF');
    for (const raw of ['owner', 'OWNER', '', 'admin', 42, null, undefined, ['staff']])
      expect(parseInviteRole(raw)).toBeNull();
  });

  it('последнего владельца организации снять нельзя; второго — можно; сотрудника сделать владельцем — можно', () => {
    expect(canChangeRole({ current: 'OWNER', next: 'STAFF', owners: 1 })).toEqual({
      ok: false,
      reason: 'Это единственный владелец организации: сначала назначьте другого',
    });
    expect(canChangeRole({ current: 'OWNER', next: 'MANAGER', owners: 1 })).toEqual({
      ok: false,
      reason: 'Это единственный владелец организации: сначала назначьте другого',
    });
    expect(canChangeRole({ current: 'OWNER', next: 'STAFF', owners: 2 })).toEqual({ ok: true });
    expect(canChangeRole({ current: 'STAFF', next: 'OWNER', owners: 1 })).toEqual({ ok: true });
    expect(canChangeRole({ current: 'MANAGER', next: 'STAFF', owners: 1 })).toEqual({ ok: true });
    expect(canChangeRole({ current: 'STAFF', next: 'STAFF', owners: 1 })).toEqual({ ok: true });
  });
});
