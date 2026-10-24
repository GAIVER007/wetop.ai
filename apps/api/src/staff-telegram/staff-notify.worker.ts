import 'reflect-metadata';
import { Inject, Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  fingerprintOf,
  STAFF_NOTIFY_MAX_ATTEMPTS,
  staffNotificationLink,
  staffNotificationText,
  staffNotifyRetryDelayMs,
  type StaffNotificationKind,
  type StaffSiteEvent,
} from '@pms/domain';
import { appUrlFromEnv } from '../auth/password-reset.service';
import { withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { INCIDENTS_REPOSITORY, type IncidentsRepository } from '../guard/incidents.repository';
import { staffRecipients, type StaffEventTarget } from './recipients';
import { STAFF_BOT, type StaffBot } from './staff-telegram.service';

/** Раз в 10 с (план): сотрудник узнаёт о брони почти сразу, а Telegram не получает больше 30 сообщений в секунду */
export const STAFF_NOTIFY_TICK_MS = 10_000;
const BATCH = 25;

interface QueueRow {
  id: string;
  organization_id: string;
  location_id: string;
  kind: StaffNotificationKind;
  source_id: string;
  recipient_user_id: string;
  attempts: number;
  created_at: Date;
}

export interface StaffSendTick {
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
}

/** Событие для текста, собранное из самой брони при отправке (в очереди ПД нет) */
type Loaded = { target: StaffEventTarget; event: StaffSiteEvent } | null;

/**
 * Отправщик очереди уведомлений сотрудникам (STAFF-TG-20261020, AGENTS.md §11). Без токена бота не запускается и
 * попыток не тратит: строки ждут. Перед отправкой заново проверяются привязка и права (уволенный или переведённый
 * сотрудник не получает), текст собирается из брони. Ошибка Telegram: повтор с нарастающей паузой до шести попыток,
 * затем FAILED и неисправность `staff.notify.failed`. 403: привязка отключается, строка SKIPPED.
 */
@Injectable()
export class StaffNotifyWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaffNotifyWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private readonly appUrl = appUrlFromEnv();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(STAFF_BOT) private readonly bot: StaffBot | null = null,
    @Optional() @Inject(INCIDENTS_REPOSITORY) private readonly incidents: IncidentsRepository | null = null,
  ) {}

  /** Часы: подменяются в тестах */
  now: () => Date = () => new Date();

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.STAFF_NOTIFY_WORKER?.trim() === 'off' || !this.bot) return;
    this.timer = setInterval(
      () => void this.tick().catch((e: unknown) => this.logger.warn(`Уведомления сотрудникам: ${(e as Error).name}`)),
      STAFF_NOTIFY_TICK_MS,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Один проход очереди служебной ролью: Telegram организации не знает, очередь общая */
  async tick(): Promise<StaffSendTick> {
    const result: StaffSendTick = { sent: 0, skipped: 0, retried: 0, failed: 0 };
    if (!this.bot || this.busy) return result;
    this.busy = true;
    try {
      await withServiceDatabase(async () => {
        const rows = await this.prisma.db.$queryRaw<QueueRow[]>`
          SELECT id, organization_id, location_id, kind::text AS kind, source_id, recipient_user_id, attempts, created_at
            FROM staff_notifications
           WHERE status = 'PENDING' AND next_attempt_at <= ${this.now()}
           ORDER BY next_attempt_at, created_at
           LIMIT ${BATCH}`;
        for (const row of rows) {
          // одна сбойная строка не останавливает пачку: остальные сотрудники получают свои сообщения
          try {
            await this.deliver(row, result);
          } catch (e) {
            result.failed += 1;
            this.logger.warn(`Уведомление ${row.id} не обработано: ${(e as Error).name}`);
          }
        }
      });
    } finally {
      this.busy = false;
    }
    return result;
  }

  private async deliver(row: QueueRow, result: StaffSendTick): Promise<void> {
    const bot = this.bot!;
    let loaded: Loaded;
    try {
      loaded = await this.load(row);
    } catch (e) {
      return this.retry(row, `load: ${(e as Error).name}`, result);
    }
    if (!loaded) return this.finish(row, 'SKIPPED', 'source-missing', result);
    const [allowed] = await staffRecipients(this.prisma.db, loaded.target, row.recipient_user_id);
    if (allowed !== row.recipient_user_id) return this.finish(row, 'SKIPPED', 'not-recipient', result);
    const [link] = await this.prisma.db.$queryRaw<Array<{ chat_id: bigint }>>`
      SELECT chat_id FROM staff_telegram_links WHERE user_id = ${row.recipient_user_id}::uuid AND disabled_at IS NULL`;
    if (!link) return this.finish(row, 'SKIPPED', 'not-linked', result);
    const message = staffNotificationText(loaded.event);
    const sent = await bot.client.sendMessage(link.chat_id.toString(), message.text, message.button);
    if (sent.ok) {
      await this.prisma.db.$executeRaw`
        UPDATE staff_notifications SET status = 'SENT', sent_at = ${this.now()}, attempts = attempts + 1, last_error = NULL
         WHERE id = ${row.id}::uuid AND status = 'PENDING'`;
      result.sent += 1;
      return;
    }
    if (sent.blocked) {
      await this.prisma.db.$executeRaw`
        UPDATE staff_telegram_links SET disabled_at = ${this.now()} WHERE user_id = ${row.recipient_user_id}::uuid AND disabled_at IS NULL`;
      return this.finish(row, 'SKIPPED', 'telegram-403', result, 1);
    }
    return this.retry(row, `telegram-${sent.status}`, result, sent.retryAfterS);
  }

  private async finish(
    row: QueueRow,
    status: 'SKIPPED',
    code: string,
    result: StaffSendTick,
    addAttempt = 0,
  ): Promise<void> {
    await this.prisma.db.$executeRaw`
      UPDATE staff_notifications SET status = ${status}::"StaffNotificationStatus", last_error = ${code},
             attempts = attempts + ${addAttempt}
       WHERE id = ${row.id}::uuid AND status = 'PENDING'`;
    result.skipped += 1;
  }

  private async retry(row: QueueRow, code: string, result: StaffSendTick, retryAfterS?: number): Promise<void> {
    const attempts = row.attempts + 1;
    if (attempts >= STAFF_NOTIFY_MAX_ATTEMPTS) {
      await this.prisma.db.$executeRaw`
        UPDATE staff_notifications SET status = 'FAILED', attempts = ${attempts}, last_error = ${code}
         WHERE id = ${row.id}::uuid AND status = 'PENDING'`;
      result.failed += 1;
      await this.incident(row, code);
      return;
    }
    const delay = Math.max(staffNotifyRetryDelayMs(attempts), (retryAfterS ?? 0) * 1000);
    await this.prisma.db.$executeRaw`
      UPDATE staff_notifications SET attempts = ${attempts}, last_error = ${code},
             next_attempt_at = ${new Date(this.now().getTime() + delay)}
       WHERE id = ${row.id}::uuid AND status = 'PENDING'`;
    result.retried += 1;
  }

  /** Строка в журнал платформы: без имён и телефонов, только вид, филиал и код ошибки */
  private async incident(row: QueueRow, code: string): Promise<void> {
    if (!this.incidents) return;
    const kind = 'staff.notify.failed' as const;
    try {
      await this.incidents.record(
        {
          kind,
          title: 'Уведомление сотруднику в Telegram не ушло за шесть попыток',
          subjectType: 'Location',
          subjectId: row.location_id,
          details: { notification: row.id, event: row.kind, error: code },
          fingerprint: fingerprintOf({ kind, subjectId: row.location_id }),
        },
        this.now(),
      );
    } catch (e) {
      this.logger.warn(`Неисправность ${kind} не записана: ${(e as Error).name}`);
    }
  }

  /** Бронь, запись, бронь стола или заявка по id строки очереди: цепочка филиала и данные для текста */
  private async load(row: QueueRow): Promise<Loaded> {
    const [chain] = await this.prisma.db.$queryRaw<
      Array<{ business_id: string; organization_id: string; vertical: StaffEventTarget['vertical']; name: string; timezone: string }>
    >`
      SELECT b.id AS business_id, b.organization_id, b.vertical::text AS vertical, l.name, l.timezone
        FROM locations l JOIN businesses b ON b.id = l.business_id WHERE l.id = ${row.location_id}::uuid`;
    if (!chain || chain.organization_id !== row.organization_id) return null;
    const target = (employeeId: string | null = null): StaffEventTarget => ({
      organizationId: row.organization_id,
      businessId: chain.business_id,
      locationId: row.location_id,
      vertical: chain.vertical,
      kind: row.kind,
      employeeId,
    });
    const common = { locationName: chain.name, timezone: chain.timezone };
    const localDay = (at: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: chain.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
    switch (row.kind) {
      case 'SITE_BOOKING_HOTEL': {
        const r = await this.prisma.db.reservation.findUnique({
          where: { id: row.source_id },
          select: {
            confirmationNumber: true,
            arrivalDate: true,
            departureDate: true,
            adults: true,
            currency: true,
            totalAmount: true,
            primaryGuest: { select: { firstName: true, lastName: true, phone: true } },
            items: { select: { accommodationType: { select: { name: true } } }, take: 1 },
            property: { select: { locationId: true } },
          },
        });
        if (!r || r.property.locationId !== row.location_id) return null;
        return {
          target: target(),
          event: {
            ...common,
            kind: 'SITE_BOOKING_HOTEL',
            confirmationNumber: r.confirmationNumber,
            categoryName: r.items[0]?.accommodationType.name ?? 'Номер',
            arrivalDate: r.arrivalDate.toISOString().slice(0, 10),
            departureDate: r.departureDate.toISOString().slice(0, 10),
            adults: r.adults,
            total: { minor: r.totalAmount.toString(), currency: r.currency },
            guestName: r.primaryGuest ? [r.primaryGuest.firstName, r.primaryGuest.lastName].filter(Boolean).join(' ') : null,
            guestPhone: r.primaryGuest?.phone ?? null,
            link: staffNotificationLink(this.appUrl, { kind: 'SITE_BOOKING_HOTEL', confirmationNumber: r.confirmationNumber }),
          },
        };
      }
      case 'SITE_APPOINTMENT': {
        const a = await this.prisma.db.appointment.findUnique({
          where: { id: row.source_id },
          select: {
            locationId: true,
            employeeId: true,
            startsAt: true,
            price: true,
            currency: true,
            service: { select: { name: true } },
            employee: { select: { name: true } },
            customer: { select: { firstName: true, lastName: true, phone: true } },
          },
        });
        if (!a || a.locationId !== row.location_id) return null;
        return {
          target: target(a.employeeId),
          event: {
            ...common,
            kind: 'SITE_APPOINTMENT',
            serviceName: a.service.name,
            employeeName: a.employee.name,
            startsAt: a.startsAt.toISOString(),
            price: { minor: a.price.toString(), currency: a.currency },
            guestName: [a.customer.firstName, a.customer.lastName].filter(Boolean).join(' ') || null,
            guestPhone: a.customer.phone,
            link: staffNotificationLink(this.appUrl, { kind: 'SITE_APPOINTMENT', date: localDay(a.startsAt) }),
          },
        };
      }
      case 'SITE_TABLE': {
        const t = await this.prisma.db.restaurantReservation.findUnique({
          where: { id: row.source_id },
          select: {
            locationId: true,
            startsAt: true,
            partySize: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
          },
        });
        if (!t || t.locationId !== row.location_id) return null;
        return {
          target: target(),
          event: {
            ...common,
            kind: 'SITE_TABLE',
            startsAt: t.startsAt.toISOString(),
            partySize: t.partySize,
            guestName: [t.customer.firstName, t.customer.lastName].filter(Boolean).join(' ') || null,
            guestPhone: t.customer.phone,
            link: staffNotificationLink(this.appUrl, { kind: 'SITE_TABLE', date: localDay(t.startsAt) }),
          },
        };
      }
      case 'SITE_LEAD': {
        const l = await this.prisma.db.siteLead.findUnique({
          where: { id: row.source_id },
          select: { locationId: true, name: true, phone: true, comment: true },
        });
        if (!l || l.locationId !== row.location_id) return null;
        return {
          target: target(),
          event: {
            ...common,
            kind: 'SITE_LEAD',
            comment: l.comment,
            guestName: l.name,
            guestPhone: l.phone,
            link: staffNotificationLink(this.appUrl, { kind: 'SITE_LEAD' }),
          },
        };
      }
    }
  }
}
