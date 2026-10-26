import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Param,
  Post,
  Put,
  Query,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { mail } from '@pms/integrations';
import {
  DEFAULT_REMINDER_HOURS,
  foodConfirmationTemplate,
  foodDefaultReminderTemplate,
  FOOD_DEFAULT_REMINDER_TEMPLATE,
  FOOD_REMINDER_STATUSES,
  REMINDER_MAX_ATTEMPTS,
  foodReminderVariables,
  foodReminderWanted,
  parseReminderSettings,
  redactText,
  reminderBackoffMs,
  renderFoodReminder,
  timeOffWindow,
  whatsappLink,
  type FoodReminderVariables,
} from '@pms/domain';
import type { DbTx } from '@pms/database';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { bookingMailerFromEnv } from '../web-booking/booking-mailer';
import { CLIENT_REMINDER_MAILER, CLIENT_WHATSAPP_SENDER, NoWhatsAppSender, type ClientWhatsAppSender } from '../beauty/reminders';
import { foodMay, foodScope, foodTransaction, foodWritable } from './scope';

/**
 * Напоминания гостям ресторана о брони стола (DATA_MODEL §61, миграция 152; «да» владельца 23.10.2026).
 *
 * Как у салона (beauty/reminders.ts, §1 решения 21.10.2026), но своя очередь `restaurant_reservation_notifications`:
 * пересчёт в транзакции брони (создание, перенос, смена статуса), отмена и неявка снимают ждущие. Воркер раз в минуту
 * берёт созревшие строки под `FOR UPDATE SKIP LOCKED`, текст собирает в момент отправки. Канал: шаблон WhatsApp
 * филиала (когда подключён), иначе почта гостя, иначе «Вручную» в списке дня с готовым текстом и ссылкой wa.me.
 * Почта идёт тем же отправителем, что у салона (`bookingMailerFromEnv`); в тестах только тестовый транспорт.
 */

export interface FoodReminderSettingsView {
  locationId: string;
  configured: boolean;
  revision: number;
  enabled: boolean;
  hoursBefore: number[];
  template: string | null;
  defaultTemplate: string;
  whatsappTemplateName: string | null;
  whatsappConnected: boolean;
}

type SettingsRow = { enabled: boolean; hoursBefore: number[]; template: string | null; whatsappTemplateName: string | null; revision: number };

const DEFAULT_SETTINGS: SettingsRow = {
  enabled: true,
  hoursBefore: [...DEFAULT_REMINDER_HOURS],
  template: null,
  whatsappTemplateName: null,
  revision: 0,
};

async function settingsOf(db: Pick<DbTx, 'foodReminderSettings'>, locationId: string): Promise<SettingsRow> {
  return (await db.foodReminderSettings.findUnique({ where: { locationId } })) ?? DEFAULT_SETTINGS;
}

/**
 * Пересчитать очередь брони в текущей транзакции. Ждущие напоминания на другое время отменяются, нужные создаются
 * (повтор по ключу ничего не меняет). Бронь ушла из «ждём гостя»: снимается всё ждущее. `confirmation`: бронь с сайта
 * получает подтверждение сразу.
 */
export async function syncReservationReminders(
  tx: DbTx,
  reservationId: string,
  options: { now?: Date; confirmation?: boolean } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  const r = await tx.restaurantReservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true, status: true, source: true, startsAt: true, locationId: true, customerId: true,
      location: { select: { business: { select: { organizationId: true, vertical: true } } } },
    },
  });
  if (!r || r.location.business.vertical !== 'FOOD_SERVICE') return;
  const settings = await settingsOf(tx, r.locationId);
  const wanted = foodReminderWanted({
    startsAt: r.startsAt,
    status: r.status,
    source: r.source,
    enabled: settings.enabled,
    hoursBefore: settings.hoursBefore,
    now,
    confirm: options.confirmation,
  });
  const wantedKeys = new Set(wanted.reminders.map((d) => d.getTime()));
  const pending = await tx.restaurantReservationNotification.findMany({
    where: { reservationId, kind: 'REMINDER', state: 'PENDING' },
    select: { id: true, dueAt: true },
  });
  const stale = pending.filter((row) => !wantedKeys.has(row.dueAt.getTime())).map((row) => row.id);
  if (stale.length)
    await tx.restaurantReservationNotification.updateMany({ where: { id: { in: stale } }, data: { state: 'CANCELLED' } });
  if (!FOOD_REMINDER_STATUSES.includes(r.status))
    await tx.restaurantReservationNotification.updateMany({
      where: { reservationId, state: 'PENDING' },
      data: { state: 'CANCELLED' },
    });
  const base = { organizationId: r.location.business.organizationId, locationId: r.locationId, reservationId, customerId: r.customerId };
  if (wanted.reminders.length) {
    await tx.restaurantReservationNotification.createMany({
      data: wanted.reminders.map((dueAt) => ({ ...base, kind: 'REMINDER' as const, dueAt })),
      skipDuplicates: true,
    });
    // строка, отменённая раньше и снова нужная (перенос туда и обратно), возвращается в очередь
    await tx.restaurantReservationNotification.updateMany({
      where: { reservationId, kind: 'REMINDER', state: 'CANCELLED', dueAt: { in: wanted.reminders } },
      data: { state: 'PENDING', attempts: 0, nextAttemptAt: null, lastError: null, channel: null },
    });
  }
  if (wanted.confirmation)
    await tx.restaurantReservationNotification.createMany({
      data: [{ ...base, kind: 'CONFIRMATION' as const, dueAt: now }],
      skipDuplicates: true,
    });
}

/** Текст для гостя: читается в момент отправки, в очереди его нет */
export async function foodReminderMessage(
  db: Pick<DbTx, 'restaurantReservation' | 'foodReminderSettings'>,
  reservationId: string,
  kind: 'REMINDER' | 'CONFIRMATION' = 'REMINDER',
) {
  const r = await db.restaurantReservation.findUnique({
    where: { id: reservationId },
    select: {
      status: true, startsAt: true, partySize: true, locationId: true,
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
      location: {
        select: {
          name: true, address: true, phone: true, timezone: true,
          business: { select: { name: true, organization: { select: { locale: true } } } },
        },
      },
    },
  });
  if (!r) return null;
  const raw = r.location.business.organization?.locale;
  const locale: 'ru' | 'kk' | 'en' = raw === 'en' || raw === 'kk' ? raw : 'ru';
  const settings = await settingsOf(db, r.locationId);
  const vars = foodReminderVariables({
    customerName: [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' '),
    startsAt: r.startsAt,
    timezone: r.location.timezone,
    partySize: r.partySize,
    restaurantName: r.location.business.name || r.location.name,
    address: r.location.address,
    phone: r.location.phone,
    locale,
  });
  // язык организации (ORG-LOCALE-20261026): свой шаблон владельца как есть, по умолчанию текст на языке ресторана
  const text = renderFoodReminder(kind === 'CONFIRMATION' ? foodConfirmationTemplate(locale) : settings.template ?? foodDefaultReminderTemplate(locale), vars);
  return {
    locale,
    status: r.status,
    startsAt: r.startsAt,
    text,
    vars,
    phone: r.customer.phone,
    email: r.customer.email,
    whatsappTemplateName: settings.whatsappTemplateName,
    whatsappUrl: whatsappLink(r.customer.phone, text),
  };
}

export interface FoodReminderRunResult {
  sent: number;
  manual: number;
  retried: number;
  failed: number;
  cancelled: number;
}

type DueRow = { id: string; kind: 'REMINDER' | 'CONFIRMATION'; attempts: number; reservationId: string; locationId: string };

const SUBJECT: Record<'ru' | 'kk' | 'en', Record<DueRow['kind'], string>> = {
  ru: { REMINDER: 'Напоминание о брони', CONFIRMATION: 'Столик забронирован' },
  kk: { REMINDER: 'Брондау туралы еске салу', CONFIRMATION: 'Үстел брондалды' },
  en: { REMINDER: 'Table booking reminder', CONFIRMATION: 'Table booked' },
};

@Injectable()
export class FoodReminderWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly mailer: mail.MailSender | null;
  private readonly whatsapp: ClientWhatsAppSender;
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(CLIENT_REMINDER_MAILER) mailer?: mail.MailSender | null,
    @Optional() @Inject(CLIENT_WHATSAPP_SENDER) whatsapp?: ClientWhatsAppSender,
  ) {
    this.mailer = mailer === undefined ? bookingMailerFromEnv() : mailer;
    this.whatsapp = whatsapp ?? new NoWhatsAppSender();
  }

  /** Раз в минуту; в тестах (NODE_ENV=test) и с CLIENT_REMINDERS_WORKER=off выключен, как воркер салона */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.CLIENT_REMINDERS_WORKER === 'off') return;
    this.timer = setInterval(
      () =>
        void this.runOnce().catch((e: unknown) =>
          new Logger(FoodReminderWorker.name).warn(`Напоминания гостям ресторана: ${redactText((e as Error).message, 500)}`),
        ),
      60_000,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now: Date = new Date(), limit = 50): Promise<FoodReminderRunResult> {
    const result: FoodReminderRunResult = { sent: 0, manual: 0, retried: 0, failed: 0, cancelled: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      for (let i = 0; i < limit; i++) {
        const outcome = await withServiceDatabase(() =>
          this.prisma.db.$transaction(
            async (tx) => {
              const rows = await tx.$queryRaw<DueRow[]>`
                SELECT id::text, kind::text AS kind, attempts, reservation_id::text AS "reservationId", location_id::text AS "locationId"
                FROM restaurant_reservation_notifications
                WHERE state = 'PENDING' AND due_at <= ${now} AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
                ORDER BY due_at, id
                LIMIT 1
                FOR UPDATE SKIP LOCKED`;
              const row = rows[0];
              return row ? this.deliver(tx, row, now) : null;
            },
            { maxWait: 5000, timeout: 30_000 },
          ),
        );
        if (!outcome) break;
        result[outcome] += 1;
      }
    } finally {
      this.running = false;
    }
    return result;
  }

  private async deliver(tx: DbTx, row: DueRow, now: Date): Promise<keyof FoodReminderRunResult> {
    const message = await foodReminderMessage(tx, row.reservationId, row.kind);
    if (!message || !FOOD_REMINDER_STATUSES.includes(message.status) || message.startsAt.getTime() <= now.getTime()) {
      await tx.restaurantReservationNotification.update({ where: { id: row.id }, data: { state: 'CANCELLED' } });
      return 'cancelled';
    }
    let channel: 'EMAIL' | 'WHATSAPP' | null = null;
    try {
      if (message.whatsappTemplateName && message.phone && (await this.whatsapp.connected(row.locationId))) {
        channel = 'WHATSAPP';
        const v: FoodReminderVariables = message.vars;
        await this.whatsapp.send({
          locationId: row.locationId,
          to: message.phone.replace(/\D/g, ''),
          templateName: message.whatsappTemplateName,
          language: message.locale ?? 'ru',
          parameters: [v.имя, v.дата, v.время, v.гостей, v.ресторан, v.адрес, v.телефон],
        });
      } else if (message.email && this.mailer) {
        channel = 'EMAIL';
        await this.mailer.send({ to: message.email.toLowerCase(), subject: SUBJECT[message.locale ?? 'ru'][row.kind], text: message.text });
      }
    } catch (e) {
      const attempts = row.attempts + 1;
      const failed = attempts >= REMINDER_MAX_ATTEMPTS;
      await tx.restaurantReservationNotification.update({
        where: { id: row.id },
        data: {
          attempts,
          channel,
          state: failed ? 'FAILED' : 'PENDING',
          nextAttemptAt: failed ? null : new Date(now.getTime() + reminderBackoffMs(attempts)),
          // SECURITY.md §7: без контактов и ключей в журнале очереди
          lastError: redactText(e instanceof Error ? e.message : String(e), 500),
        },
      });
      return failed ? 'failed' : 'retried';
    }
    if (!channel) {
      await tx.restaurantReservationNotification.update({ where: { id: row.id }, data: { state: 'MANUAL', channel: 'MANUAL' } });
      return 'manual';
    }
    await tx.restaurantReservationNotification.update({
      where: { id: row.id },
      data: { state: 'SENT', channel, sentAt: now, attempts: row.attempts + 1, lastError: null },
    });
    return 'sent';
  }
}

const KIND_LABEL: Record<DueRow['kind'], string> = {
  REMINDER: 'Напомнить о брони',
  CONFIRMATION: 'Подтвердить бронь',
};
const STATE_LABEL: Record<string, string> = {
  PENDING: 'Ждёт',
  SENT: 'Отправлено',
  MANUAL: 'Вручную',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменено',
};

@Injectable()
export class FoodRemindersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(CLIENT_WHATSAPP_SENDER) private readonly whatsapp?: ClientWhatsAppSender,
  ) {}

  async settings(): Promise<FoodReminderSettingsView> {
    foodMay('desk');
    const s = await foodScope(this.prisma.db);
    const row = await this.prisma.db.foodReminderSettings.findUnique({ where: { locationId: s.locationId } });
    const v = row ?? DEFAULT_SETTINGS;
    return {
      locationId: s.locationId,
      configured: row !== null,
      revision: v.revision,
      enabled: v.enabled,
      hoursBefore: v.hoursBefore,
      template: v.template,
      defaultTemplate: FOOD_DEFAULT_REMINDER_TEMPLATE,
      whatsappTemplateName: v.whatsappTemplateName,
      whatsappConnected: await (this.whatsapp ?? new NoWhatsAppSender()).connected(s.locationId),
    };
  }

  /** Настройки пишет служебная роль (как у салона); будущие брони филиала получают новое расписание */
  async saveSettings(raw: unknown): Promise<FoodReminderSettingsView> {
    foodMay('property');
    await foodWritable(this.prisma.db);
    const parsed = parseReminderSettings(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value;
    const scope = await foodScope(this.prisma.db);
    const stale = () => new ConflictException('Настройки напоминаний изменены. Обновите страницу.');
    await withServiceDatabase(() =>
      foodTransaction(this.prisma, scope, async (tx, s) => {
        const old = await tx.foodReminderSettings.findUnique({ where: { locationId: s.locationId } });
        if ((old?.revision ?? 0) !== input.expectedRevision) throw stale();
        const data = {
          enabled: input.enabled,
          hoursBefore: input.hoursBefore,
          template: input.template,
          whatsappTemplateName: input.whatsappTemplateName,
        };
        if (old) {
          const saved = await tx.foodReminderSettings.updateMany({
            where: { locationId: s.locationId, revision: input.expectedRevision },
            data: { ...data, revision: { increment: 1 } },
          });
          if (saved.count !== 1) throw stale();
        } else await tx.foodReminderSettings.create({ data: { locationId: s.locationId, ...data, revision: 1 } });
        await tx.auditLog.create({
          data: {
            organizationId: s.organizationId,
            userId: currentUserId(),
            entityType: 'location',
            entityId: s.locationId,
            action: 'food.reminder_settings.updated',
            before: old ? { enabled: old.enabled, hoursBefore: old.hoursBefore, revision: old.revision } : { revision: 0 },
            after: { enabled: input.enabled, hoursBefore: input.hoursBefore, revision: input.expectedRevision + 1 },
          },
        });
        const upcoming = await tx.restaurantReservation.findMany({
          where: { locationId: s.locationId, status: { in: ['BOOKED', 'CONFIRMED'] }, startsAt: { gt: new Date() } },
          select: { id: true },
          take: 2000,
        });
        for (const r of upcoming) await syncReservationReminders(tx, r.id);
      }),
    );
    return this.settings();
  }

  /** Напоминания дня филиала: состояние каждого, у «Вручную» и «Ошибка» готовый текст и ссылка wa.me */
  async day(rawDate?: string) {
    foodMay('desk');
    const s = await foodScope(this.prisma.db);
    const date =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Intl.DateTimeFormat('en-CA', { timeZone: s.timezone }).format(new Date());
    const window = timeOffWindow({ dateFrom: date, dateTo: date, timezone: s.timezone });
    const rows = await this.prisma.db.restaurantReservationNotification.findMany({
      where: { locationId: s.locationId, dueAt: { gte: window.fromUtc, lt: window.toUtcExclusive } },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, kind: true, state: true, channel: true, dueAt: true, sentAt: true, attempts: true, lastError: true,
        reservationId: true,
        reservation: { select: { startsAt: true, partySize: true, customer: { select: { firstName: true, lastName: true, phone: true } } } },
      },
      take: 500,
    });
    const items = [];
    for (const row of rows) {
      const manual = row.state === 'MANUAL' || row.state === 'FAILED';
      const kind = row.kind as DueRow['kind'];
      const message = manual ? await foodReminderMessage(this.prisma.db, row.reservationId, kind) : null;
      items.push({
        id: row.id,
        kind,
        kindLabel: KIND_LABEL[kind],
        state: row.state,
        stateLabel: STATE_LABEL[row.state] ?? row.state,
        channel: row.channel,
        dueAt: row.dueAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        attempts: row.attempts,
        lastError: row.lastError,
        reservationId: row.reservationId,
        reservationStartsAt: row.reservation.startsAt.toISOString(),
        partySize: row.reservation.partySize,
        customerName: [row.reservation.customer.firstName, row.reservation.customer.lastName].filter(Boolean).join(' '),
        customerPhone: row.reservation.customer.phone,
        text: message?.text ?? null,
        whatsappUrl: message?.whatsappUrl ?? null,
      });
    }
    return { date, timezone: s.timezone, items };
  }

  /** «Напомнил»: ручное напоминание отмечено отправленным */
  async done(id: string) {
    foodMay('desk');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new NotFoundException('Напоминание не найдено');
    await foodWritable(this.prisma.db);
    const scope = await foodScope(this.prisma.db);
    await foodTransaction(this.prisma, scope, async (tx, s) => {
      const rows = await tx.$queryRaw<Array<{ state: string }>>`
        SELECT state::text FROM restaurant_reservation_notifications WHERE id = ${id}::uuid AND location_id = ${s.locationId}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new NotFoundException('Напоминание не найдено');
      if (row.state === 'SENT') return;
      if (row.state !== 'MANUAL' && row.state !== 'FAILED') throw new ConflictException('Это напоминание отправляется само');
      await tx.restaurantReservationNotification.update({ where: { id }, data: { state: 'SENT', channel: 'MANUAL', sentAt: new Date() } });
      await tx.auditLog.create({
        data: {
          organizationId: s.organizationId,
          userId: currentUserId(),
          entityType: 'restaurant_reservation_notification',
          entityId: id,
          action: 'food.reminder.manual_sent',
          before: { state: row.state },
          after: { state: 'SENT' },
        },
      });
    });
    return { id, state: 'SENT' as const };
  }
}

@Controller('food-service')
@RequiresBusinessCapability('food.tableReservations')
export class FoodRemindersController {
  constructor(@Inject(FoodRemindersService) private readonly service: FoodRemindersService) {}

  @Get('reminder-settings') @Access('desk') settings() {
    return this.service.settings();
  }
  @Put('reminder-settings') @Access('property') saveSettings(@Body() body: unknown) {
    return this.service.saveSettings(body);
  }
  @Get('reminders') @Access('desk') day(@Query('date') date?: string) {
    return this.service.day(date);
  }
  @Post('reminders/:id/done') @Access('desk') done(@Param('id') id: string) {
    return this.service.done(id);
  }
}
