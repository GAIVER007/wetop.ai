import { describe, expect, it } from 'vitest';
import { PERMISSIONS, accessDeniedMessage, can, permissionsOf, rolesWith, type Permission } from './permissions';

/**
 * Права ролей (DATA_MODEL §16.5, ADR-101) — ответы владельца 27.09.2026: роль — готовый набор; управляющий — всё, кроме
 * владельческого; администратор — работа с гостями плюс статистика и «Оплаты» на просмотр; возврат и сторно — владелец
 * и управляющий.
 */
describe('права ролей', () => {
  const all = Object.keys(PERMISSIONS) as Permission[];

  it('двенадцать прав и своё; у каждого — название', () => {
    expect(all).toEqual([
      'self',
      'desk',
      'dialogs',
      'reports',
      'refunds',
      'property',
      'rates',
      'channels',
      'settings',
      'journal',
      'seller',
      'staff',
      'owner',
    ]);
    for (const p of all) expect(PERMISSIONS[p].label.length).toBeGreaterThan(3);
  });

  it('владельцу — всё', () => {
    expect(permissionsOf('OWNER')).toEqual(all);
  });

  it('управляющему — всё, кроме владельческого', () => {
    expect(permissionsOf('MANAGER')).toEqual(all.filter((p) => p !== 'owner'));
  });

  it('администратору — своё, работа с гостями, диалоги продавца и отчёты на просмотр', () => {
    expect(permissionsOf('STAFF')).toEqual(['self', 'desk', 'dialogs', 'reports']);
  });

  it('возврат и сторно — владелец и управляющий, не администратор (Q-024)', () => {
    expect(can('OWNER', 'refunds')).toBe(true);
    expect(can('MANAGER', 'refunds')).toBe(true);
    expect(can('STAFF', 'refunds')).toBe(false);
  });

  it('администратор не видит тарифы, каналы, настройки, журнал, сотрудников и настройки продавца', () => {
    for (const p of [
      'property',
      'rates',
      'channels',
      'settings',
      'journal',
      'seller',
      'staff',
      'owner',
    ] as const)
      expect(can('STAFF', p)).toBe(false);
  });

  it('неизвестная роль не открывает ничего — даже своё', () => {
    for (const p of all) {
      expect(can(null, p)).toBe(false);
      expect(can(undefined, p)).toBe(false);
      expect(can('ADMIN' as never, p)).toBe(false);
    }
  });

  it('у кого право — по порядку ролей', () => {
    expect(rolesWith('desk')).toEqual(['OWNER', 'MANAGER', 'STAFF']);
    expect(rolesWith('rates')).toEqual(['OWNER', 'MANAGER']);
    expect(rolesWith('owner')).toEqual(['OWNER']);
  });

  it('отказ называет раздел и у кого доступ', () => {
    expect(accessDeniedMessage('rates')).toBe('«Тарифы и цены»: доступ есть у владельца и управляющего.');
    expect(accessDeniedMessage('refunds')).toBe(
      '«Возврат оплаты и сторно»: доступ есть у владельца и управляющего.',
    );
    expect(accessDeniedMessage('owner')).toBe(
      '«Управляющие, роли и платные расширения»: доступ есть только у владельца.',
    );
  });
});
