import { describe, expect, it } from 'vitest';
import { buildRequesterContext, maskEmail } from './requester-context';

const base = {
  user: { name: 'Аня Тестова', email: 'anna.testova@example.kz' },
  role: 'STAFF' as const,
  organization: { name: 'Тестовый отель', status: 'ACTIVE' },
  businesses: [
    {
      name: 'Тестовый бизнес',
      vertical: 'HOSPITALITY' as const,
      status: 'ACTIVE',
      locations: [{ name: 'Филиал 1', status: 'ACTIVE' }],
    },
  ],
  aiSeller: { access: 'active' as const, activeUntil: '2026-12-31T00:00:00.000Z', daysLeft: 93 },
};

describe('контекст обратившегося (S4)', () => {
  it('почта скрыта маской, домен виден', () => {
    expect(maskEmail('anna.testova@example.kz')).toBe('a***@example.kz');
    expect(maskEmail('не почта')).toBe('***');
  });

  it('роль словами и права из таблицы ролей: администратор без возвратов и настроек продавца', () => {
    const ctx = buildRequesterContext(base);
    expect(ctx.role).toEqual({ code: 'STAFF', label: expect.any(String) });
    const allowed = ctx.permissions.allowed.map((p) => p.code);
    const denied = ctx.permissions.denied.map((p) => p.code);
    expect(allowed).toContain('desk');
    expect(denied).toEqual(expect.arrayContaining(['refunds', 'seller', 'owner', 'staff']));
    expect(allowed.filter((c) => denied.includes(c))).toEqual([]);
  });

  it('решения, которые принимает только человек, названы всегда', () => {
    const ctx = buildRequesterContext({ ...base, role: 'OWNER' });
    expect(ctx.permissions.humanOnly.length).toBeGreaterThan(0);
    expect(ctx.permissions.humanOnly.join(' ')).toMatch(/возврат/i);
  });

  it('в ответе нет чужих и служебных данных: только названия, направление, статусы и срок расширения', () => {
    const json = JSON.stringify(
      buildRequesterContext({
        ...base,
        user: { ...base.user, passwordHash: 'x', phone: '+7700', id: 'u-1' } as never,
      }),
    );
    expect(json).not.toContain('anna.testova');
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain('+7700');
    expect(json).not.toContain('u-1');
  });

  it('подписка: действует, истекла, не подключена — словами', () => {
    expect(buildRequesterContext(base).subscription.aiSeller.summary).toMatch(/действует/);
    const expired = buildRequesterContext({
      ...base,
      aiSeller: { access: 'expired', activeUntil: '2026-09-01T00:00:00.000Z', daysLeft: null },
    });
    expect(expired.subscription.aiSeller.summary).toMatch(/истёк/);
    const off = buildRequesterContext({
      ...base,
      aiSeller: { access: 'off', activeUntil: null, daysLeft: null },
    });
    expect(off.subscription.aiSeller.summary).toMatch(/не подключено/);
  });

  it('бизнес и филиал перечислены с названием и направлением', () => {
    const ctx = buildRequesterContext(base);
    expect(ctx.businesses).toEqual([
      {
        name: 'Тестовый бизнес',
        vertical: 'HOSPITALITY',
        status: 'ACTIVE',
        locations: [{ name: 'Филиал 1', status: 'ACTIVE' }],
      },
    ]);
  });
});
