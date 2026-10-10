import { describe, expect, it } from 'vitest';
import { buildPlatformOverview, type OverviewSource } from './overview';

/**
 * Обзор платформы (план `plans/platform-superadmin-2026-10-10.md`, срез P1): числа считаются из того, что уже есть
 * в базе. Денег здесь нет: платежи платформе не ведутся (ADR-102, Q-PA-2), и обзор их не выдумывает.
 */
const NOW = new Date('2026-10-10T12:00:00Z');

const org = (
  createdAt: string,
  status: OverviewSource['organizations'][number]['status'] = 'ACTIVE',
  businesses: OverviewSource['organizations'][number]['businesses'] = [
    { vertical: 'HOSPITALITY', createdAt: new Date(createdAt) },
  ],
) => ({ status, createdAt: new Date(createdAt), businesses });

const src = (organizations: OverviewSource['organizations']): OverviewSource => ({
  organizations,
  usersTotal: 7,
  activeUsers: 3,
});

describe('buildPlatformOverview', () => {
  it('считает итоги по статусам; «клиенты» — без архива, архив отдельно', () => {
    const view = buildPlatformOverview(
      src([
        org('2026-01-15T00:00:00Z', 'ACTIVE'),
        org('2026-02-15T00:00:00Z', 'TRIAL'),
        org('2026-03-15T00:00:00Z', 'READ_ONLY'),
        org('2026-04-15T00:00:00Z', 'SUSPENDED'),
      ]),
      NOW,
    );
    expect(view.totals).toMatchObject({
      organizations: 3,
      active: 1,
      trial: 1,
      readOnly: 1,
      suspended: 1,
      usersTotal: 7,
      activeUsers: 3,
    });
    // кольцо статусов — все четыре, нули не отдаются
    expect(view.statuses).toEqual([
      { status: 'ACTIVE', organizations: 1 },
      { status: 'TRIAL', organizations: 1 },
      { status: 'READ_ONLY', organizations: 1 },
      { status: 'SUSPENDED', organizations: 1 },
    ]);
  });

  it('новые за 30 дней: граница входит, 31-й день — нет', () => {
    const view = buildPlatformOverview(
      src([
        org('2026-09-10T12:00:00Z'), // ровно 30 дней назад — входит
        org('2026-09-10T11:59:59Z'), // старше — нет
        org('2026-10-01T00:00:00Z'),
      ]),
      NOW,
    );
    expect(view.totals.newLast30d).toBe(2);
  });

  it('рост: 12 месяцев по UTC, новые и накопительно; старые организации сидят в накопительном итоге', () => {
    const view = buildPlatformOverview(
      src([
        org('2025-01-01T00:00:00Z'), // до окна — только в total
        org('2025-11-01T00:00:00Z'), // первый месяц окна
        org('2026-10-09T00:00:00Z'),
        org('2026-10-10T00:00:00Z'),
      ]),
      NOW,
    );
    expect(view.growth).toHaveLength(12);
    expect(view.growth[0]).toEqual({ month: '2025-11', added: 1, total: 2 });
    expect(view.growth[11]).toEqual({ month: '2026-10', added: 2, total: 4 });
    expect(view.growth.map((g) => g.month)).toContain('2026-03');
  });

  it('направления: по старейшему бизнесу организации; без бизнеса и архив в кольцо не попадают', () => {
    const view = buildPlatformOverview(
      src([
        org('2026-01-01T00:00:00Z', 'ACTIVE', [
          { vertical: 'BEAUTY', createdAt: new Date('2026-02-01T00:00:00Z') },
          { vertical: 'HOSPITALITY', createdAt: new Date('2026-01-01T00:00:00Z') },
        ]),
        org('2026-03-01T00:00:00Z', 'TRIAL', [
          { vertical: 'FOOD_SERVICE', createdAt: new Date('2026-03-01T00:00:00Z') },
        ]),
        org('2026-04-01T00:00:00Z', 'ACTIVE', []),
        org('2026-05-01T00:00:00Z', 'SUSPENDED'),
      ]),
      NOW,
    );
    expect(view.verticals).toEqual([
      { vertical: 'HOSPITALITY', organizations: 1 },
      { vertical: 'FOOD_SERVICE', organizations: 1 },
    ]);
  });
});
