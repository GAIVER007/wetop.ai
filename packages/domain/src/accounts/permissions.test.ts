import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  accessDeniedMessage,
  can,
  mayAssignPlanWithoutRates,
  permissionsOf,
  plansToChoose,
  rolesWith,
  type Permission,
} from './permissions';

/**
 * Права ролей (DATA_MODEL §16.5, ADR-106) — ответы владельца 27.09.2026: роль — готовый набор; управляющий — всё, кроме
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
    expect(accessDeniedMessage('rates')).toBe(
      '«Тарифы и цены»: доступ есть у владельца и управляющего.',
    );
    expect(accessDeniedMessage('refunds')).toBe(
      '«Возврат оплаты и сторно»: доступ есть у владельца и управляющего.',
    );
    expect(accessDeniedMessage('owner')).toBe(
      '«Управляющие, роли и платные расширения»: доступ есть только у владельца.',
    );
  });
});

/**
 * Q-198 (ответ владельца 27.09.2026 — «Да, разрешить»): брони без тарифа (из Exely) администратор назначает тариф один
 * раз, и только со штрафом не мягче «первых суток». Без тарифа штрафа нет (`NONE`), так что назначение его добавляет.
 */
describe('тариф брони без тарифа у администратора (Q-198)', () => {
  it('назначить можно тариф со штрафом «первые сутки» или «всё проживание», без штрафа — нет', () => {
    expect(mayAssignPlanWithoutRates('FIRST_NIGHT')).toBe(true);
    expect(mayAssignPlanWithoutRates('FULL_STAY')).toBe(true);
    expect(mayAssignPlanWithoutRates('NONE')).toBe(false);
  });

  // стойка предлагает ровно то, что примет API: лишний тариф в списке — отказ после выбора
  const plans = [
    { code: 'BASE', cancellationPenalty: 'FIRST_NIGHT' as const },
    { code: 'FLEX', cancellationPenalty: 'NONE' as const },
    { code: 'STRICT', cancellationPenalty: 'FULL_STAY' as const },
  ];
  const codes = (list: Array<{ code: string }>) => list.map((p) => p.code);

  it('владелец и управляющий выбирают любой тариф — и у брони с тарифом, и без', () => {
    expect(codes(plansToChoose(plans, { mayChangePlan: true, hasPlan: true }))).toEqual([
      'BASE',
      'FLEX',
      'STRICT',
    ]);
    expect(codes(plansToChoose(plans, { mayChangePlan: true, hasPlan: false }))).toHaveLength(3);
  });

  it('администратору у брони с тарифом выбирать нечего, у брони без тарифа — только со штрафом', () => {
    expect(plansToChoose(plans, { mayChangePlan: false, hasPlan: true })).toEqual([]);
    expect(codes(plansToChoose(plans, { mayChangePlan: false, hasPlan: false }))).toEqual([
      'BASE',
      'STRICT',
    ]);
  });

  it('тариф без правила штрафа (старый ответ API) администратору не предлагается', () => {
    const old: Array<{ code: string; cancellationPenalty?: 'NONE' | 'FIRST_NIGHT' | 'FULL_STAY' }> =
      [{ code: 'OLD' }];
    expect(plansToChoose(old, { mayChangePlan: false, hasPlan: false })).toEqual([]);
  });
});
