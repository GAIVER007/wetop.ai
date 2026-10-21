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
  CONFIRMATION_TEMPLATE,
  DEFAULT_REMINDER_HOURS,
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_MAX_ATTEMPTS,
  parseReminderSettings,
  redactText,
  reminderBackoffMs,
  reminderDueTimes,
  reminderVariables,
  renderReminder,
  timeOffWindow,
  whatsappLink,
  type ReminderVariables,
} from '@pms/domain';
import type { DbTx } from '@pms/database';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { bookingMailerFromEnv } from '../web-booking/booking-mailer';
import { BeautyAccess } from './access.decorator';
import { beautyScope, beautyTransaction, mayBeauty, mayBeautyWrite, UUID } from './scope';

/**
 * Напоминания клиентам салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md, §1, миграция 140).
 *
 * Очередь `client_notifications` пишется в транзакции записи (стойка и сайт): создание и перенос пересчитывают
 * плановые строки, отмена и незаезд отменяют ждущие. Натуральный ключ (запись, вид, время) не даёт дублей.
 * Воркер раз в минуту берёт созревшие строки (`FOR UPDATE SKIP LOCKED`), текст собирает в момент отправки.
 */

/** Записи этих состояний ещё ждут клиента: им напоминаем */
const ACTIVE_STATUSES = new Set(['BOOKED', 'CONFIRMED']);

export interface ReminderSettingsView {
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

async function settingsOf(db: Pick<DbTx, 'beautyReminderSettings'>, locationId: string): Promise<SettingsRow> {
  const row = await db.beautyReminderSettings.findUnique({ where: { locationId } });
  return row ?? DEFAULT_SETTINGS;
}

/**
 * Пересчитать очередь записи в текущей транзакции. Ждущие напоминания на другое время отменяются, нужные
 * создаются (повтор по ключу ничего не меняет). Отменённая запись отменяет всё ждущее.
 * `confirmation`: запись с сайта получает подтверждение сразу.
 */
export async function syncAppointmentReminders(
  tx: DbTx,
  appointmentId: string,
  options: { now?: Date; confirmation?: boolean } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  const appointment = await tx.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true, status: true, startsAt: true, locationId: true, customerId: true,
      location: { select: { business: { select: { organizationId: true, vertical: true } } } },
    },
  });
  if (!appointment || appointment.location.business.vertical !== 'BEAUTY') return;
  const settings = await settingsOf(tx, appointment.locationId);
  const wanted = ACTIVE_STATUSES.has(appointment.status) && settings.enabled
    ? reminderDueTimes(appointment.startsAt, settings.hoursBefore, now)
    : [];
  const wantedKeys = new Set(wanted.map((d) => d.getTime()));
  const pending = await tx.clientNotification.findMany({
    where: { appointmentId, kind: 'REMINDER', state: 'PENDING' },
    select: { id: true, dueAt: true },
  });
  const stale = pending.filter((row) => !wantedKeys.has(row.dueAt.getTime())).map((row) => row.id);
  if (stale.length)
    await tx.clientNotification.updateMany({ where: { id: { in: stale } }, data: { state: 'CANCELLED' } });
  if (!ACTIVE_STATUSES.has(appointment.status))
    await tx.clientNotification.updateMany({ where: { appointmentId, state: 'PENDING' }, data: { state: 'CANCELLED' } });
  const base = {
    organizationId: appointment.location.business.organizationId,
    locationId: appointment.locationId,
    appointmentId,
    customerId: appointment.customerId,
  };
  if (wanted.length)
    await tx.clientNotification.createMany({
      data: wanted.map((dueAt) => ({ ...base, kind: 'REMINDER' as const, dueAt })),
      skipDuplicates: true,
    });
  // строка, отменённая раньше и снова нужная (перенос туда и обратно), возвращается в очередь
  if (wanted.length)
    await tx.clientNotification.updateMany({
      where: { appointmentId, kind: 'REMINDER', state: 'CANCELLED', dueAt: { in: wanted } },
      data: { state: 'PENDING', attempts: 0, nextAttemptAt: null, lastError: null, channel: null },
    });
  if (options.confirmation && ACTIVE_STATUSES.has(appointment.status) && settings.enabled)
    await tx.clientNotification.createMany({
      data: [{ ...base, kind: 'CONFIRMATION' as const, dueAt: now }],
      skipDuplicates: true,
    });
}

// ───────────── отправка ─────────────

export interface WhatsAppTemplateMessage {
  locationId: string;
  /** только цифры номера */
  to: string;
  templateName: string;
  language: 'ru';
  /** значения {{1}}..{{8}} одобренного шаблона в порядке: имя, услуга, дата, время, мастер, салон, адрес, телефон */
  parameters: string[];
}

/**
 * Отправка шаблона WhatsApp Cloud API от номера филиала (Q-185 (а): только официальный путь). Подключения номера
 * филиала в WETOP пока нет, поэтому по умолчанию отправитель «не подключён» и строка уходит в «Вручную».
 * Настоящий отправитель подставляется провайдером `CLIENT_WHATSAPP_SENDER` без правки воркера.
 */
export interface ClientWhatsAppSender {
  connected(locationId: string): Promise<boolean>;
  send(message: WhatsAppTemplateMessage): Promise<void>;
}
export const CLIENT_WHATSAPP_SENDER = Symbol('CLIENT_WHATSAPP_SENDER');
export const CLIENT_REMINDER_MAILER = Symbol('CLIENT_REMINDER_MAILER');

export class NoWhatsAppSender implements ClientWhatsAppSender {
  async connected(): Promise<boolean> {
    return false;
  }
  async send(): Promise<void> {
    throw new Error('WhatsApp филиала не подключён');
  }
}

export interface ReminderRunResult {
  sent: number;
  manual: number;
  retried: number;
  failed: number;
  cancelled: number;
}

type DueRow = { id: string; kind: 'REMINDER' | 'CONFIRMATION' | 'REVIEW_REQUEST'; attempts: number; appointmentId: string; locationId: string };

const SUBJECT: Record<DueRow['kind'], string> = {
  REMINDER: 'Напоминание о записи',
  CONFIRMATION: 'Запись подтверждена',
  REVIEW_REQUEST: 'Как прошёл визит',
};

/** Данные для текста: читаются в момент отправки, в очереди их нет */
export async function reminderMessage(db: Pick<DbTx, 'appointment' | 'beautyReminderSettings'>, appointmentId: string, kind: DueRow['kind'] = 'REMINDER') {
  const a = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      status: true, startsAt: true, locationId: true,
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
      employee: { select: { name: true } },
      service: { select: { name: true } },
      lines: { orderBy: { position: 'asc' }, select: { service: { select: { name: true } }, employee: { select: { name: true } } } },
      location: { select: { name: true, address: true, phone: true, timezone: true, business: { select: { name: true } } } },
    },
  });
  if (!a) return null;
  const settings = await settingsOf(db, a.locationId);
  const services = a.lines.length ? [...new Set(a.lines.map((l) => l.service.name))].join(', ') : a.service.name;
  const vars: ReminderVariables = reminderVariables({
    customerName: [a.customer.firstName, a.customer.lastName].filter(Boolean).join(' '),
    serviceName: services,
    startsAt: a.startsAt,
    timezone: a.location.timezone,
    masterName: a.lines[0]?.employee.name ?? a.employee.name,
    salonName: a.location.business.name || a.location.name,
    address: a.location.address,
    phone: a.location.phone,
  });
  const template = kind === 'CONFIRMATION' ? CONFIRMATION_TEMPLATE : settings.template ?? DEFAULT_REMINDER_TEMPLATE;
  const text = renderReminder(template, vars);
  return {
    status: a.status,
    startsAt: a.startsAt,
    text,
    vars,
    phone: a.customer.phone,
    email: a.customer.email,
    whatsappTemplateName: settings.whatsappTemplateName,
    whatsappUrl: whatsappLink(a.customer.phone, text),
  };
}

@Injectable()
export class ClientReminderWorker implements OnModuleInit, OnModuleDestroy {
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

  /** Фоновый цикл раз в минуту; в тестах (NODE_ENV=test) и с CLIENT_REMINDERS_WORKER=off выключен */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.CLIENT_REMINDERS_WORKER === 'off') return;
    this.timer = setInterval(
      () => void this.runOnce().catch((e: unknown) =>
        new Logger(ClientReminderWorker.name).warn(`Напоминания клиентам: ${redactText((e as Error).message, 500)}`)),
      60_000,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Один проход: созревшие строки по очереди, каждая в своей короткой транзакции под замком строки */
  async runOnce(now: Date = new Date(), limit = 50): Promise<ReminderRunResult> {
    const result: ReminderRunResult = { sent: 0, manual: 0, retried: 0, failed: 0, cancelled: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      for (let i = 0; i < limit; i++) {
        const outcome = await withServiceDatabase(() => this.prisma.db.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<DueRow[]>`
            SELECT id::text, kind::text AS kind, attempts, appointment_id::text AS "appointmentId", location_id::text AS "locationId"
            FROM client_notifications
            WHERE state = 'PENDING' AND due_at <= ${now} AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
            ORDER BY due_at, id
            LIMIT 1
            FOR UPDATE SKIP LOCKED`;
          const row = rows[0];
          if (!row) return null;
          return this.deliver(tx, row, now);
        }, { maxWait: 5000, timeout: 30_000 }));
        if (!outcome) break;
        result[outcome] += 1;
      }
    } finally {
      this.running = false;
    }
    return result;
  }

  private async deliver(tx: DbTx, row: DueRow, now: Date): Promise<keyof ReminderRunResult> {
    const message = await reminderMessage(tx, row.appointmentId, row.kind);
    if (!message || !ACTIVE_STATUSES.has(message.status) || message.startsAt.getTime() <= now.getTime()) {
      await tx.clientNotification.update({ where: { id: row.id }, data: { state: 'CANCELLED' } });
      return 'cancelled';
    }
    let channel: 'EMAIL' | 'WHATSAPP' | null = null;
    try {
      if (message.whatsappTemplateName && message.phone && (await this.whatsapp.connected(row.locationId))) {
        channel = 'WHATSAPP';
        const v = message.vars;
        await this.whatsapp.send({
          locationId: row.locationId,
          to: message.phone.replace(/\D/g, ''),
          templateName: message.whatsappTemplateName,
          language: 'ru',
          parameters: [v.имя, v.услуга, v.дата, v.время, v.мастер, v.салон, v.адрес, v.телефон],
        });
      } else if (message.email && this.mailer) {
        channel = 'EMAIL';
        await this.mailer.send({ to: message.email.toLowerCase(), subject: SUBJECT[row.kind], text: message.text });
      }
    } catch (e) {
      const attempts = row.attempts + 1;
      const failed = attempts >= REMINDER_MAX_ATTEMPTS;
      await tx.clientNotification.update({
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
      await tx.clientNotification.update({ where: { id: row.id }, data: { state: 'MANUAL', channel: 'MANUAL' } });
      return 'manual';
    }
    await tx.clientNotification.update({
      where: { id: row.id },
      data: { state: 'SENT', channel, sentAt: now, attempts: row.attempts + 1, lastError: null },
    });
    return 'sent';
  }
}

// ───────────── API ─────────────

const STATE_LABEL: Record<string, string> = {
  PENDING: 'Ждёт',
  SENT: 'Отправлено',
  MANUAL: 'Вручную',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменено',
};

@Injectable()
export class BeautyRemindersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(CLIENT_WHATSAPP_SENDER) private readonly whatsapp?: ClientWhatsAppSender,
  ) {}

  async settings(): Promise<ReminderSettingsView> {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma, true);
    const locationId = scope.locationId!;
    const row = await this.prisma.db.beautyReminderSettings.findUnique({ where: { locationId } });
    const s = row ?? DEFAULT_SETTINGS;
    return {
      locationId,
      configured: row !== null,
      revision: s.revision,
      enabled: s.enabled,
      hoursBefore: s.hoursBefore,
      template: s.template,
      defaultTemplate: DEFAULT_REMINDER_TEMPLATE,
      whatsappTemplateName: s.whatsappTemplateName,
      whatsappConnected: await (this.whatsapp ?? new NoWhatsAppSender()).connected(locationId),
    };
  }

  async saveSettings(raw: unknown): Promise<ReminderSettingsView> {
    await mayBeautyWrite(this.prisma, 'property');
    const parsed = parseReminderSettings(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value;
    const scope = await beautyScope(this.prisma, true);
    const locationId = scope.locationId!;
    await withServiceDatabase(() => beautyTransaction(this.prisma, scope, async (tx) => {
      const old = await tx.beautyReminderSettings.findUnique({ where: { locationId } });
      if ((old?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException('Настройки напоминаний изменены. Обновите страницу.');
      const data = {
        enabled: input.enabled,
        hoursBefore: input.hoursBefore,
        template: input.template,
        whatsappTemplateName: input.whatsappTemplateName,
      };
      if (old) {
        const saved = await tx.beautyReminderSettings.updateMany({
          where: { locationId, revision: input.expectedRevision },
          data: { ...data, revision: { increment: 1 } },
        });
        if (saved.count !== 1) throw new ConflictException('Настройки напоминаний изменены. Обновите страницу.');
      } else await tx.beautyReminderSettings.create({ data: { locationId, ...data, revision: 1 } });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'location',
          entityId: locationId,
          action: 'beauty.reminder_settings.updated',
          before: old ? { enabled: old.enabled, hoursBefore: old.hoursBefore, revision: old.revision } : { revision: 0 },
          after: { enabled: input.enabled, hoursBefore: input.hoursBefore, revision: input.expectedRevision + 1 },
        },
      });
      // будущие записи филиала получают новое расписание напоминаний
      const upcoming = await tx.appointment.findMany({
        where: { locationId, status: { in: ['BOOKED', 'CONFIRMED'] }, startsAt: { gt: new Date() } },
        select: { id: true },
        take: 2000,
      });
      for (const a of upcoming) await syncAppointmentReminders(tx, a.id);
    }));
    return this.settings();
  }

  /** Напоминания дня филиала: состояние каждого, у «Вручную» готовый текст и ссылка wa.me */
  async day(rawDate?: string) {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma, true);
    const timezone = scope.locationTimezone!;
    const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    const window = timeOffWindow({ dateFrom: date, dateTo: date, timezone });
    const rows = await this.prisma.db.clientNotification.findMany({
      where: { locationId: scope.locationId!, dueAt: { gte: window.fromUtc, lt: window.toUtcExclusive } },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, kind: true, state: true, channel: true, dueAt: true, sentAt: true, attempts: true, lastError: true,
        appointmentId: true,
        appointment: { select: { startsAt: true, customer: { select: { firstName: true, lastName: true, phone: true } } } },
      },
      take: 500,
    });
    const items = [];
    for (const row of rows) {
      const message = row.state === 'MANUAL' ? await reminderMessage(this.prisma.db, row.appointmentId, row.kind) : null;
      items.push({
        id: row.id,
        kind: row.kind,
        state: row.state,
        stateLabel: STATE_LABEL[row.state] ?? row.state,
        channel: row.channel,
        dueAt: row.dueAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        attempts: row.attempts,
        lastError: row.lastError,
        appointmentId: row.appointmentId,
        appointmentStartsAt: row.appointment.startsAt.toISOString(),
        customerName: [row.appointment.customer.firstName, row.appointment.customer.lastName].filter(Boolean).join(' '),
        customerPhone: row.appointment.customer.phone,
        text: message?.text ?? null,
        whatsappUrl: message?.whatsappUrl ?? null,
      });
    }
    return { date, timezone, items };
  }

  /** «Напомнил»: ручное напоминание отмечено отправленным */
  async done(id: string) {
    await mayBeautyWrite(this.prisma, 'desk');
    if (!UUID.test(id)) throw new NotFoundException('Напоминание не найдено');
    const scope = await beautyScope(this.prisma, true);
    await beautyTransaction(this.prisma, scope, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ state: string }>>`
        SELECT state::text FROM client_notifications WHERE id = ${id}::uuid AND location_id = ${scope.locationId!}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new NotFoundException('Напоминание не найдено');
      if (row.state === 'SENT') return;
      if (row.state !== 'MANUAL' && row.state !== 'FAILED') throw new ConflictException('Это напоминание отправляется само');
      await tx.clientNotification.update({
        where: { id },
        data: { state: 'SENT', channel: 'MANUAL', sentAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'client_notification',
          entityId: id,
          action: 'beauty.reminder.manual_sent',
          before: { state: row.state },
          after: { state: 'SENT' },
        },
      });
    });
    return { id, state: 'SENT' as const };
  }
}

@RequiresBusinessCapability('beauty.appointments')
@Controller('beauty')
export class BeautyRemindersController {
  constructor(@Inject(BeautyRemindersService) private readonly service: BeautyRemindersService) {}

  @BeautyAccess('settings', 'view')
  @Get('reminder-settings') @Access('desk') settings() {
    return this.service.settings();
  }
  @BeautyAccess('settings', 'update')
  @Put('reminder-settings') @Access('property') saveSettings(@Body() body: unknown) {
    return this.service.saveSettings(body);
  }
  @BeautyAccess('journal', 'view')
  @Get('reminders') @Access('desk') day(@Query('date') date?: string) {
    return this.service.day(date);
  }
  @BeautyAccess('appointments', 'update')
  @Post('reminders/:id/done') @Access('desk') done(@Param('id') id: string) {
    return this.service.done(id);
  }
}
