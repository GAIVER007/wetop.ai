import type { BusinessVertical, OrganizationStatus } from '@pms/domain';
import { BUSINESS_VERTICALS } from '@pms/domain';

/**
 * Обзор платформы для главного администратора (план `plans/platform-superadmin-2026-10-10.md`, срез P1).
 * Считается только из существующих таблиц: организации, их бизнесы, входы людей. Денег здесь нет: платежи
 * платформе не ведутся (ADR-102), MRR и «просрочено» не выдумываются (Q-PA-1, Q-PA-2). Внутренние показатели
 * чужих организаций (брони, выручка гостей) сюда не попадают по построению (Q-285, ADR-083).
 */
export interface OverviewSource {
  organizations: Array<{
    status: OrganizationStatus;
    createdAt: Date;
    businesses: Array<{ vertical: BusinessVertical; createdAt: Date }>;
  }>;
  /** Людей с хотя бы одним членством в организации */
  usersTotal: number;
  /** Из них входили за последние 30 дней (`users.last_login_at`) */
  activeUsers: number;
}

export interface PlatformOverview {
  totals: {
    /** Клиенты платформы: организации без архива (`SUSPENDED` отдельно) */
    organizations: number;
    active: number;
    trial: number;
    readOnly: number;
    suspended: number;
    newLast30d: number;
    usersTotal: number;
    activeUsers: number;
  };
  /** 12 месяцев по UTC: подключения за месяц и накопительный итог (архив остаётся в истории подключений) */
  growth: Array<{ month: string; added: number; total: number }>;
  /** Действующие организации по направлению старейшего бизнеса; без бизнеса в кольцо не попадают */
  verticals: Array<{ vertical: BusinessVertical; organizations: number }>;
  /** Все организации по статусу, нулевые статусы не отдаются */
  statuses: Array<{ status: OrganizationStatus; organizations: number }>;
}

const MONTHS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const STATUSES: OrganizationStatus[] = ['ACTIVE', 'TRIAL', 'READ_ONLY', 'SUSPENDED'];

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

export function buildPlatformOverview(src: OverviewSource, now: Date): PlatformOverview {
  const orgs = src.organizations;
  const byStatus = (s: OrganizationStatus) => orgs.filter((o) => o.status === s).length;
  const suspended = byStatus('SUSPENDED');
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const months: string[] = [];
  for (let i = MONTHS - 1; i >= 0; i -= 1) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  const growth = months.map((month) => ({
    month,
    added: orgs.filter((o) => monthKey(o.createdAt) === month).length,
    total: orgs.filter((o) => monthKey(o.createdAt) <= month).length,
  }));

  const verticalCount = new Map<BusinessVertical, number>();
  for (const o of orgs) {
    if (o.status === 'SUSPENDED') continue;
    const [oldest] = [...o.businesses].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (!oldest) continue;
    verticalCount.set(oldest.vertical, (verticalCount.get(oldest.vertical) ?? 0) + 1);
  }

  return {
    totals: {
      organizations: orgs.length - suspended,
      active: byStatus('ACTIVE'),
      trial: byStatus('TRIAL'),
      readOnly: byStatus('READ_ONLY'),
      suspended,
      newLast30d: orgs.filter((o) => o.createdAt.getTime() >= since.getTime()).length,
      usersTotal: src.usersTotal,
      activeUsers: src.activeUsers,
    },
    growth,
    verticals: BUSINESS_VERTICALS.filter((v) => verticalCount.has(v)).map((vertical) => ({
      vertical,
      organizations: verticalCount.get(vertical)!,
    })),
    statuses: STATUSES.filter((s) => byStatus(s) > 0).map((status) => ({
      status,
      organizations: byStatus(status),
    })),
  };
}
