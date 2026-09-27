import 'reflect-metadata';
import { ReservationDirectory, ReservationDirectoryController } from './reservation-directory';
import { OnboardingController, OnboardingService } from './onboarding';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Patch,
  Query,
} from '@nestjs/common';
import { ReservationStatus } from '@pms/database';
import {
  LUXX_APARTS_PROPERTY,
  REGISTRATION_NAME_TAKEN_MESSAGE,
  accessDeniedMessage,
  parseHotelSettingsPatch,
  type HotelSettingsPatch,
} from '@pms/domain';
import { channex } from '@pms/integrations';
import { actorMay, currentOrganizationId, hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { FOREIGN_PROPERTY_MESSAGE } from '../database/property-ref';
import { Access } from '../auth/access.decorator';

/**
 * Сколько держать настройки объекта в памяти API (волна 4 плана wetop-domain).
 *
 * Их читает `layout.tsx`, то есть каждая страница стойки: два запроса в базу Сингапура на каждый
 * показ экрана, а пулер Supabase даёт 15 клиентов на проект. Название, часы и тарифы меняет импорт,
 * не стойка, поэтому правка появится на экранах не позже чем через минуту.
 */
const SETTINGS_TTL_MS = () => Number(process.env.HOTEL_SETTINGS_TTL_MS ?? 60_000);

/** Read-only projections of the approved model. No provider calls or financial mutations. */
@Injectable()
export class HotelService {
  // Настройки кэшируются ПО ОРГАНИЗАЦИИ (мультитенантность): иначе один процесс отдал бы объект
  // одной организации другой. Ключ «__service__» — служебные ходоки (за ними нет человека).
  private cachedSettings = new Map<
    string,
    { at: number; value: Awaited<ReturnType<HotelService['readSettings']>> }
  >();
  private settingsRead = new Map<string, ReturnType<HotelService['readSettings']>>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** По какому объекту отвечаем: вошедший — по своей организации, служебный ходок — по имени (Luxx). */
  private settingsKey(): string {
    if (!hasSignedInActor()) return '__service__';
    return currentOrganizationId() ?? '__nobody__';
  }

  private async property() {
    // Вошедший видит объект своей организации; служебный ходок — единственный по имени (как раньше)
    const where = hasSignedInActor()
      ? (() => {
          const organizationId = currentOrganizationId();
          if (organizationId === null) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
          return { organizationId };
        })()
      : { name: LUXX_APARTS_PROPERTY.name };
    const property = await this.prisma.db.property.findFirst({
      where,
      select: {
        id: true,
        name: true,
        legalName: true,
        // ИИН/БИН для печатных форм — из записи объекта, не из кода (проверка SECURITY.md 24.09.2026, Н12)
        bin: true,
        address: true,
        // контакты для печатных форм — тоже из записи (v1.7, ADR-082)
        phone: true,
        email: true,
        timezone: true,
        currency: true,
        checkInTime: true,
        checkOutTime: true,
      },
    });
    if (!property) throw new NotFoundException('Гостиница ещё не настроена');
    return property;
  }

  async settings() {
    const key = this.settingsKey();
    const cached = this.cachedSettings.get(key);
    if (cached && Date.now() - cached.at < SETTINGS_TTL_MS()) return cached.value;
    // Несколько открывающихся страниц одной организации делят один промах её кэша.
    // Ошибка очищает только незавершённое чтение и не мешает следующей попытке.
    let read = this.settingsRead.get(key);
    if (!read) {
      read = this.readSettings()
        .then((value) => {
          this.cachedSettings.set(key, { at: Date.now(), value });
          return value;
        })
        .finally(() => {
          this.settingsRead.delete(key);
        });
      this.settingsRead.set(key, read);
    }
    return read;
  }

  private async readSettings() {
    const property = await this.property();
    const [ratePlans, categories] = await Promise.all([
      this.prisma.db.ratePlan.findMany({
        where: { propertyId: property.id },
        orderBy: { code: 'asc' },
        select: { code: true, name: true, currency: true, active: true, cancellationPenalty: true },
      }),
      // Нужен ли онбординг: у объекта ещё нет ни одной категории. Читаем здесь, чтобы гейт в layout
      // не делал отдельный рейс — layout и так берёт настройки (и они кэшируются по организации).
      this.prisma.db.accommodationType.count({ where: { propertyId: property.id } }),
    ]);
    return { property, ratePlans, needsOnboarding: categories === 0 };
  }

  /**
   * «Первые шаги» на Главной (ТЗ ux-retention п. 2.1): есть ли в объекте хоть одна бронь. Без кэша — панель
   * должна уйти сразу после первой брони; одна выборка по индексу `property_id`.
   */
  async firstSteps() {
    const property = await this.property();
    const reservation = await this.prisma.db.reservation.findFirst({
      where: { propertyId: property.id },
      select: { id: true },
    });
    return { hasReservations: reservation !== null };
  }

  /**
   * Правка «Общих» настроек (ТЗ ux-retention п. 3.1, UQ-1 — «да» владельца 26.09.2026): право `settings` — владелец и
   * управляющий (ADR-106); администратору раздел закрыт, служебный ключ сведений не меняет. Валюта и пояс не правятся
   * (разбор их не пропускает). Название объекта Luxx служебные пути ищут по имени — его не переименовать; чужое название
   * не занять (ADR-099). Журнал — «было/стало».
   */
  async updateSettings(raw: unknown) {
    if (!hasSignedInActor() || !actorMay('settings'))
      throw new ForbiddenException(accessDeniedMessage('settings'));
    const parsed = parseHotelSettingsPatch(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const patch = parsed.value;
    const property = await this.property();
    if (patch.name !== undefined && patch.name !== property.name) {
      if (property.name === LUXX_APARTS_PROPERTY.name)
        throw new BadRequestException(
          'Название этого объекта используют каналы продаж и сторож — его меняет поддержка WETOP',
        );
      const namesake = await this.prisma.db.property.findFirst({
        where: { name: { equals: patch.name, mode: 'insensitive' }, NOT: { id: property.id } },
        select: { id: true },
      });
      if (namesake) throw new BadRequestException(REGISTRATION_NAME_TAKEN_MESSAGE);
    }
    // пишем только изменённое: форма шлёт все поля, а журнал только дописывается
    const keys = (Object.keys(patch) as Array<keyof HotelSettingsPatch>).filter(
      (k) => patch[k] !== (property[k] ?? null),
    );
    if (keys.length === 0) return this.settings();
    const changed = Object.fromEntries(
      keys.map((k) => [k, patch[k] ?? null]),
    ) as HotelSettingsPatch;
    // ИИН/БИН у ИП — ИИН человека: в неудаляемый журнал только последние 4 цифры (как В-5 для гостей)
    const masked = (row: Record<string, string | null>): Record<string, string | null> =>
      'bin' in row && typeof row['bin'] === 'string'
        ? { ...row, bin: `••••${row['bin'].slice(-4)}` }
        : row;
    const before = masked(Object.fromEntries(keys.map((k) => [k, property[k] ?? null])));
    const organizationId = currentOrganizationId();
    await this.prisma.db.$transaction(async (tx) => {
      await tx.property.update({ where: { id: property.id }, data: changed });
      if (changed.name !== undefined && organizationId)
        await tx.organization.update({
          where: { id: organizationId },
          data: { name: changed.name },
        });
      await tx.auditLog.create({
        data: {
          entityType: 'Property',
          entityId: property.id,
          action: 'hotel.settings.updated',
          before,
          after: masked({ ...changed } as Record<string, string | null>),
        },
      });
    });
    this.forget();
    return this.settings();
  }

  /** Сбросить кэш настроек (после онбординга: у объекта появились номера, гейт больше не нужен). */
  forget(): void {
    this.cachedSettings.clear();
    this.settingsRead.clear();
  }

  async channelReport(from?: string, to?: string, status = 'ALL') {
    const validDate = (s?: string): s is string =>
      !!s &&
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s;
    if (
      !validDate(from) ||
      !validDate(to) ||
      from > to ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 365
    ) {
      throw new BadRequestException('Выберите корректный период до 366 дней включительно');
    }
    if (
      status !== 'ALL' &&
      !Object.values(ReservationStatus).includes(status as ReservationStatus)
    ) {
      throw new BadRequestException('Неизвестный статус брони');
    }
    const property = await this.property();
    // Uses property/arrival index; DB aggregation avoids loading individual bookings or guests.
    const groups = await this.prisma.db.reservation.groupBy({
      by: ['source', 'channel', 'currency', 'status'],
      where: {
        propertyId: property.id,
        arrivalDate: { gte: new Date(from), lte: new Date(to) },
        ...(status !== 'ALL' ? { status: status as ReservationStatus } : {}),
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const rows = new Map<
      string,
      {
        source: string;
        channel: string | null;
        currency: string;
        count: number;
        cancelled: number;
        noShow: number;
        amountMinor: bigint;
      }
    >();
    for (const group of groups) {
      // Один канал Channex присылает под разными именами («Booking.com» / «BookingCom») — строка отчёта одна
      // (plans/channel-name-canonical-2026-09-22.md)
      const channel = group.channel === null ? null : channex.otaChannelLabel(group.channel);
      const key = JSON.stringify([group.source, channel, group.currency]);
      const row = rows.get(key) ?? {
        source: group.source,
        channel,
        currency: group.currency,
        count: 0,
        cancelled: 0,
        noShow: 0,
        amountMinor: 0n,
      };
      row.count += group._count._all;
      row.cancelled += group.status === 'CANCELLED' ? group._count._all : 0;
      row.noShow += group.status === 'NO_SHOW' ? group._count._all : 0;
      row.amountMinor += group._sum.totalAmount ?? 0n;
      rows.set(key, row);
    }
    return {
      from,
      to,
      status,
      dateBasis: 'ARRIVAL',
      rows: [...rows.values()]
        .sort(
          (a, b) =>
            b.count - a.count ||
            JSON.stringify([a.source, a.channel, a.currency]).localeCompare(
              JSON.stringify([b.source, b.channel, b.currency]),
            ),
        )
        .map((r) => ({ ...r, amountMinor: r.amountMinor.toString() })),
    };
  }
}

@Access('desk')
@Controller('hotel')
export class HotelController {
  constructor(@Inject(HotelService) private readonly service: HotelService) {}
  @Get('settings') settings() {
    return this.service.settings();
  }
  // «Общие» сведения гостиницы — владелец и управляющий (ADR-106)
  @Access('settings')
  @Patch('settings')
  updateSettings(@Body() body: unknown) {
    return this.service.updateSettings(body);
  }
  @Get('first-steps') firstSteps() {
    return this.service.firstSteps();
  }
  @Access('channels')
  @Get('channel-report')
  channelReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.channelReport(from, to, status);
  }
}

@Module({
  controllers: [HotelController, ReservationDirectoryController, OnboardingController],
  providers: [PrismaService, HotelService, ReservationDirectory, OnboardingService],
})
export class HotelModule {}
