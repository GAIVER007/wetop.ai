import 'reflect-metadata';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { OrganizationStatus } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { ALMATY_OFFSET_HOURS, localDayAndHour } from '../channels/schedule';
import type { Mailer } from '../auth/password-reset.service';
import { companyOrganizationIds } from './growth.controller';
import { PLATFORM_APP_URL, PLATFORM_MAILER } from './organization-creation';

/**
 * Ночная проверка подписок (план `docs/plans/2026-10-29-owner-cabinet-full.md` §3, срез 4; владелец 29.10.2026):
 * - пробный кончился → «только чтение» (запись и так закрыта на лету `writeBlocked`, теперь это видно и считается);
 * - «оплачено до» прошло больше 3 дней назад → «только чтение»;
 * - оплату получили («оплачено до» снова впереди) → «работает», но только если закрыла сама проверка: «только чтение»,
 *   поставленное главным администратором руками, остаётся;
 * - за 7 и за 1 день до конца пробного или оплаты письмо владельцу, один раз на срок (строка журнала).
 * Данные клиента не трогаются, вход остаётся. Своя организация WETOP (владелец сайта wetop.ai), архив и клиенты без
 * «оплачено до» не трогаются. Таймер в процессе API, как очистка счётчика сайта (`WebRetentionService`).
 */

export const NIGHTLY_HOUR_LOCAL = 5;
export const UNPAID_GRACE_DAYS = 3;
export const REMINDER_DAYS = [7, 1] as const;
const CHECK_MS = 60 * 60_000;
const DAY_MS = 86_400_000;

export interface NightOrg {
  id: string;
  name: string;
  status: OrganizationStatus;
  trialEndsAt: Date | null;
  /** «Оплачено до» подписки, `ГГГГ-ММ-ДД`; подписки нет — `null` */
  paidUntil: string | null;
  /** Почта первого владельца; нет — письма не будет */
  ownerEmail: string | null;
  /** Последнюю смену статуса сделала эта проверка (`after.by = 'nightly'`) */
  closedByNight: boolean;
  /** Ключи уже отправленных писем `вид:срок:дней` */
  remindersSent: string[];
  /** Своя организация WETOP */
  company: boolean;
}

export type NightReason = 'trial_ended' | 'unpaid' | 'paid';
export interface NightStatusChange {
  organizationId: string;
  from: OrganizationStatus;
  to: OrganizationStatus;
  reason: NightReason;
}
export interface NightReminder {
  organizationId: string;
  to: string;
  name: string;
  kind: 'trial' | 'paid';
  until: string;
  days: number;
  key: string;
}

export interface SubscriptionNightlyRepository {
  organizations(): Promise<NightOrg[]>;
  /** Статус и строка журнала `organization.status_changed` (after.by = 'nightly') одной транзакцией */
  setStatus(change: NightStatusChange): Promise<void>;
  /** Письмо ушло: строка журнала `platform.subscription.reminder` с ключом */
  remindered(r: NightReminder): Promise<void>;
}
export const SUBSCRIPTION_NIGHTLY_REPOSITORY = Symbol('SUBSCRIPTION_NIGHTLY_REPOSITORY');

const localDay = (now: Date) => localDayAndHour(now, ALMATY_OFFSET_HOURS).day;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Что сделать этой ночью: чистая функция, `now` задаёт местный день */
export function planNight(orgs: NightOrg[], now: Date): { statuses: NightStatusChange[]; reminders: NightReminder[] } {
  const today = localDay(now);
  const statuses: NightStatusChange[] = [];
  const reminders: NightReminder[] = [];
  for (const o of orgs) {
    if (o.company || o.status === 'SUSPENDED') continue;
    if (o.status === 'TRIAL' && o.trialEndsAt && o.trialEndsAt <= now) {
      statuses.push({ organizationId: o.id, from: o.status, to: 'READ_ONLY', reason: 'trial_ended' });
      continue;
    }
    if (o.status === 'ACTIVE' && o.paidUntil && daysBetween(o.paidUntil, today) > UNPAID_GRACE_DAYS) {
      statuses.push({ organizationId: o.id, from: o.status, to: 'READ_ONLY', reason: 'unpaid' });
      continue;
    }
    if (o.status === 'READ_ONLY' && o.closedByNight && o.paidUntil && o.paidUntil >= today) {
      statuses.push({ organizationId: o.id, from: o.status, to: 'ACTIVE', reason: 'paid' });
      continue;
    }
    if (!o.ownerEmail) continue;
    const end =
      o.status === 'TRIAL' && o.trialEndsAt
        ? { kind: 'trial' as const, until: localDay(o.trialEndsAt) }
        : o.status === 'ACTIVE' && o.paidUntil
          ? { kind: 'paid' as const, until: o.paidUntil }
          : null;
    if (!end) continue;
    const days = daysBetween(today, end.until);
    if (!(REMINDER_DAYS as readonly number[]).includes(days)) continue;
    const key = `${end.kind}:${end.until}:${days}`;
    if (o.remindersSent.includes(key)) continue;
    reminders.push({ organizationId: o.id, to: o.ownerEmail, name: o.name, kind: end.kind, until: end.until, days, key });
  }
  return { statuses, reminders };
}

const ru = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Письмо владельцу: срок, что будет и куда идти. Без длинных тире */
export function reminderLetter(
  r: Pick<NightReminder, 'kind' | 'name' | 'until' | 'days'>,
  appUrl: string,
): { subject: string; text: string } {
  const when = r.days === 1 ? 'завтра' : `через ${r.days} дн.`;
  if (r.kind === 'trial')
    return {
      subject: `WETOP: пробный период закончится ${ru(r.until)}`,
      text: [
        'Здравствуйте!',
        '',
        `Пробный период «${r.name}» в WETOP закончится ${when}, ${ru(r.until)}.`,
        'После этого данные останутся на месте и будут видны, но вносить изменения будет нельзя, пока подписка не оплачена.',
        'Чтобы продолжить работу без перерыва, ответьте на это письмо или напишите в поддержку в стойке.',
        '',
        appUrl,
        '',
        'Команда WETOP',
      ].join('\n'),
    };
  return {
    subject: `WETOP: оплата до ${ru(r.until)}`,
    text: [
      'Здравствуйте!',
      '',
      `Подписка «${r.name}» в WETOP оплачена до ${ru(r.until)}, это ${when}.`,
      `Если оплата не придёт в течение ${UNPAID_GRACE_DAYS} дней после этой даты, стойка перейдёт в режим «только чтение»: данные останутся, изменения будут недоступны.`,
      'Чтобы продлить, ответьте на это письмо или напишите в поддержку в стойке.',
      '',
      appUrl,
      '',
      'Команда WETOP',
    ].join('\n'),
  };
}

/** Пора ли: местный час ≥ 05:00 и сегодня ещё не проверяли */
export function nightlyDue(lastRunDay: string | null, now: Date, hourLocal: number = NIGHTLY_HOUR_LOCAL): boolean {
  const local = localDayAndHour(now, ALMATY_OFFSET_HOURS);
  return local.hour >= hourLocal && lastRunDay !== local.day;
}

@Injectable()
export class PrismaSubscriptionNightlyRepository implements SubscriptionNightlyRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async organizations(): Promise<NightOrg[]> {
    const db = this.prisma.db;
    const [rows, company, journal] = await Promise.all([
      db.organization.findMany({
        where: { status: { in: ['TRIAL', 'ACTIVE', 'READ_ONLY'] } },
        select: {
          id: true,
          name: true,
          status: true,
          trialEndsAt: true,
          platformSubscription: { select: { paidUntil: true } },
          memberships: {
            where: { role: 'OWNER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { user: { select: { email: true, status: true } } },
          },
        },
      }),
      companyOrganizationIds(db),
      db.auditLog.findMany({
        where: { entityType: 'organization', action: { in: ['organization.status_changed', 'platform.subscription.reminder'] } },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, action: true, after: true },
      }),
    ]);
    const lastStatusByNight = new Map<string, boolean>();
    const sent = new Map<string, string[]>();
    for (const j of journal) {
      const after = (j.after && typeof j.after === 'object' ? j.after : {}) as Record<string, unknown>;
      if (j.action === 'organization.status_changed' && !lastStatusByNight.has(j.entityId))
        lastStatusByNight.set(j.entityId, after['by'] === 'nightly');
      if (j.action === 'platform.subscription.reminder' && typeof after['key'] === 'string')
        sent.set(j.entityId, [...(sent.get(j.entityId) ?? []), after['key']]);
    }
    return rows.map((o) => {
      const owner = o.memberships[0]?.user;
      return {
        id: o.id,
        name: o.name,
        status: o.status,
        trialEndsAt: o.trialEndsAt,
        paidUntil: o.platformSubscription?.paidUntil?.toISOString().slice(0, 10) ?? null,
        ownerEmail: owner && owner.status === 'ACTIVE' ? owner.email : null,
        closedByNight: lastStatusByNight.get(o.id) ?? false,
        remindersSent: sent.get(o.id) ?? [],
        company: company.has(o.id),
      };
    });
  }

  async setStatus(c: NightStatusChange): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      // статус меняется, только если он тот же, что видела проверка: ручная правка между чтением и записью побеждает
      const { count } = await tx.organization.updateMany({ where: { id: c.organizationId, status: c.from }, data: { status: c.to } });
      if (count === 0) return;
      await tx.auditLog.create({
        data: {
          userId: null,
          entityType: 'organization',
          entityId: c.organizationId,
          action: 'organization.status_changed',
          before: { status: c.from },
          after: { status: c.to, note: null, by: 'nightly', reason: c.reason },
        },
      });
    });
  }

  async remindered(r: NightReminder): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        userId: null,
        entityType: 'organization',
        entityId: r.organizationId,
        action: 'platform.subscription.reminder',
        after: { key: r.key, kind: r.kind, until: r.until, days: r.days },
      },
    });
  }
}

export interface NightRun {
  ran: boolean;
  statuses: number;
  reminders: number;
}

@Injectable()
export class SubscriptionNightlyService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SubscriptionNightlyService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunDay: string | null = null;
  private running = false;

  constructor(
    @Inject(SUBSCRIPTION_NIGHTLY_REPOSITORY) private readonly repo: SubscriptionNightlyRepository,
    @Inject(PLATFORM_MAILER) private readonly mailer: Mailer | null,
    @Inject(PLATFORM_APP_URL) private readonly appUrl: string,
  ) {}

  /** В тестах и при SUBSCRIPTION_NIGHTLY=off таймера нет */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.SUBSCRIPTION_NIGHTLY === 'off') return;
    this.timer = setInterval(
      () => void this.runIfDue().catch((e: unknown) => this.log.warn(`ночная проверка подписок не удалась: ${(e as Error).message}`)),
      CHECK_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runIfDue(now: Date = new Date()): Promise<NightRun> {
    if (this.running || !nightlyDue(this.lastRunDay, now)) return { ran: false, statuses: 0, reminders: 0 };
    this.running = true;
    try {
      const plan = planNight(await this.repo.organizations(), now);
      for (const c of plan.statuses) await this.repo.setStatus(c);
      let sent = 0;
      for (const r of plan.reminders) {
        if (!this.mailer) break;
        const letter = reminderLetter(r, this.appUrl);
        try {
          await this.mailer.send({ to: r.to, subject: letter.subject, text: letter.text });
        } catch (e) {
          this.log.warn(`письмо о сроке не ушло (${r.organizationId}): ${(e as Error).message}`);
          continue;
        }
        await this.repo.remindered(r);
        sent += 1;
      }
      this.lastRunDay = localDay(now);
      if (plan.statuses.length || sent)
        this.log.log(`подписки: статусов изменено ${plan.statuses.length}, писем ${sent}`);
      return { ran: true, statuses: plan.statuses.length, reminders: sent };
    } finally {
      this.running = false;
    }
  }
}
