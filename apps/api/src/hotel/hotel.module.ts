import { DashboardModule } from '../dashboard/dashboard.module';
import { BranchesController, BranchesService } from './branches';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
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
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@pms/database';
import {
  LUXX_APARTS_PROPERTY,
  REGISTRATION_NAME_TAKEN_MESSAGE,
  accessDeniedMessage,
  parseHotelSettingsPatch,
  parseServiceInput,
  type HotelSettingsPatch,
  type ServiceInput,
} from '@pms/domain';
import { channex } from '@pms/integrations';
import {
  actorMay,
  currentOrganizationId,
  currentBusinessId,
  currentLocationId,
  currentScope,
  hasSignedInActor,
} from '../auth/request-context';
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

/** Значения поля равны: списки (удобства) сравниваются по составу и порядку, остальное как есть */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

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
    return [
      currentOrganizationId() ?? '__nobody__',
      currentScope(),
      currentBusinessId(),
      currentLocationId(),
    ].join('|');
  }

  private async property() {
    // Вошедший видит объект своей организации; служебный ходок — единственный по имени (как раньше)
    const where = hasSignedInActor()
      ? (() => {
          const organizationId = currentOrganizationId();
          if (organizationId === null) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
          return {
            organizationId,
            ...(currentScope() === 'LOCATION' && currentLocationId()
              ? { locationId: currentLocationId()! }
              : {}),
            ...(currentBusinessId()
              ? { location: { businessId: currentBusinessId()!, business: { organizationId } } }
              : {}),
          };
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
        countryCode: true,
        city: true,
        channexPropertyType: true,
        timezone: true,
        currency: true,
        checkInTime: true,
        checkOutTime: true,
        // карточка объекта (ADR-155, DATA_MODEL §31)
        description: true,
        website: true,
        publicName: true,
        earlyCheckIn: true,
        lateCheckOut: true,
        childrenAllowed: true,
        petsAllowed: true,
        smokingAllowed: true,
        onsitePayment: true,
        cancellationRule: true,
        depositRule: true,
        minGuestAge: true,
        quietHoursFrom: true,
        quietHoursTo: true,
        houseRulesNote: true,
        amenities: true,
      },
    });
    if (!property) throw new NotFoundException('Гостиница ещё не настроена');
    return property;
  }

  /** Объект вошедшего: файлы объекта (фото, договор) привязаны к нему */
  async currentPropertyId(): Promise<string> {
    return (await this.property()).id;
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
    const [ratePlans, categories, rooms, beds] = await Promise.all([
      this.prisma.db.ratePlan.findMany({
        where: { propertyId: property.id },
        orderBy: { code: 'asc' },
        select: { code: true, name: true, currency: true, active: true, cancellationPenalty: true },
      }),
      // Нужен ли онбординг: у объекта ещё нет ни одной категории. Читаем здесь, чтобы гейт в layout
      // не делал отдельный рейс — layout и так берёт настройки (и они кэшируются по организации).
      this.prisma.db.accommodationType.count({ where: { propertyId: property.id } }),
      // «Количество номеров» и «мест» не хранятся: единицы продажи (ADR-013), активные
      this.prisma.db.inventoryUnit.count({
        where: { propertyId: property.id, active: true, kind: 'ROOM' },
      }),
      this.prisma.db.inventoryUnit.count({
        where: { propertyId: property.id, active: true, kind: 'BED' },
      }),
    ]);
    return {
      property,
      ratePlans,
      needsOnboarding: categories === 0,
      capacity: { rooms, beds },
    };
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
   * управляющий (ADR-107); администратору раздел закрыт, служебный ключ сведений не меняет. Валюта и пояс не правятся
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
      (k) => !sameValue(patch[k], property[k] ?? null),
    );
    if (keys.length === 0) return this.settings();
    const changed = Object.fromEntries(
      keys.map((k) => [k, patch[k] ?? null]),
    ) as HotelSettingsPatch;
    // ИИН/БИН у ИП — ИИН человека: в неудаляемый журнал только последние 4 цифры (как В-5 для гостей)
    const masked = (row: Record<string, unknown>): Prisma.InputJsonObject =>
      'bin' in row && typeof row['bin'] === 'string'
        ? ({ ...row, bin: `••••${row['bin'].slice(-4)}` } as Prisma.InputJsonObject)
        : (row as Prisma.InputJsonObject);
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
          after: masked({ ...changed }),
        },
      });
    });
    this.forget();
    return this.settings();
  }

  /**
   * Каталог услуг для «Настроек объекта» (SET3, `plans/property-settings-set2-set3-2026-09-28.md`): весь, с архивными.
   * Выбор услуги в счёте (`GET /finance/services`) по-прежнему видит только активные. Право `settings` — владелец и
   * управляющий: оно по таблице ролей включает «услуги» (ADR-107); администратору раздел закрыт.
   */
  async serviceCatalog() {
    this.mayEditSettings();
    const property = await this.property();
    const rows = await this.prisma.db.service.findMany({
      where: { propertyId: property.id },
      orderBy: [{ active: 'desc' }, { group: 'asc' }, { nameRu: 'asc' }],
    });
    return rows.map(serviceView);
  }

  /** Новая услуга: код даёт система (пользователю он не нужен), статус по умолчанию — активна. Журнал — «стало». */
  async createService(raw: unknown) {
    this.mayEditSettings();
    const parsed = parseServiceInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value as Required<ServiceInput>;
    const property = await this.property();
    const code = `svc-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const row = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          propertyId: property.id,
          code,
          nameRu: input.name,
          group: input.group,
          price: input.priceMinor,
          active: input.active,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Service',
          entityId: created.id,
          action: 'hotel.service.created',
          after: serviceView(created),
        },
      });
      return created;
    });
    return serviceView(row);
  }

  /**
   * Правка услуги: название, группа, цена, статус. Удаления нет — начисления ссылаются на услугу; архив — `active = false`.
   * Прошлые начисления не меняются: они хранят свою цену и название. Пишем только изменённое, журнал — «было/стало».
   */
  async updateService(code: string, raw: unknown) {
    this.mayEditSettings();
    const parsed = parseServiceInput(raw, { partial: true });
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const property = await this.property();
    const current = await this.prisma.db.service.findFirst({
      where: { propertyId: property.id, code },
    });
    if (!current) throw new NotFoundException('Услуга не найдена');
    const was = serviceView(current);
    const next = { ...was };
    const data: { nameRu?: string; group?: string | null; price?: bigint; active?: boolean } = {};
    const p = parsed.value;
    if (p.name !== undefined && p.name !== current.nameRu) {
      data.nameRu = p.name;
      next.name = p.name;
    }
    if (p.group !== undefined && p.group !== current.group) {
      data.group = p.group;
      next.group = p.group;
    }
    if (p.priceMinor !== undefined && p.priceMinor !== current.price) {
      data.price = p.priceMinor;
      next.priceMinor = p.priceMinor.toString();
    }
    if (p.active !== undefined && p.active !== current.active) {
      data.active = p.active;
      next.active = p.active;
    }
    const keys = (Object.keys(was) as Array<keyof typeof was>).filter((k) => was[k] !== next[k]);
    if (keys.length === 0) return was;
    const pick = (v: typeof was) => Object.fromEntries(keys.map((k) => [k, v[k]]));
    await this.prisma.db.$transaction(async (tx) => {
      await tx.service.update({ where: { id: current.id }, data });
      await tx.auditLog.create({
        data: {
          entityType: 'Service',
          entityId: current.id,
          action: 'hotel.service.updated',
          before: pick(was),
          after: pick(next),
        },
      });
    });
    return next;
  }

  private mayEditSettings(): void {
    if (!hasSignedInActor() || !actorMay('settings'))
      throw new ForbiddenException(accessDeniedMessage('settings'));
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

/** Услуга каталога наружу: код — ссылка для правки, цена — строка тиынов (деньги не float, ADR-008) */
function serviceView(s: {
  code: string;
  nameRu: string;
  group: string | null;
  price: bigint;
  active: boolean;
}) {
  return {
    code: s.code,
    name: s.nameRu,
    group: s.group,
    priceMinor: s.price.toString(),
    active: s.active,
  };
}

@Access('desk')
@Controller('hotel')
export class HotelController {
  constructor(@Inject(HotelService) private readonly service: HotelService) {}
  @Get('settings') settings() {
    return this.service.settings();
  }
  // «Общие» сведения гостиницы — владелец и управляющий (ADR-107)
  @Access('settings')
  @Patch('settings')
  updateSettings(@Body() body: unknown) {
    return this.service.updateSettings(body);
  }
  // Каталог услуг «Настроек объекта» (SET3): владелец и управляющий — право `settings` включает «услуги» (ADR-107)
  @Access('settings')
  @Get('services')
  services() {
    return this.service.serviceCatalog();
  }
  @Access('settings')
  @Post('services')
  createService(@Body() body: unknown) {
    return this.service.createService(body);
  }
  @Access('settings')
  @Patch('services/:code')
  updateService(@Param('code') code: string, @Body() body: unknown) {
    return this.service.updateService(code, body);
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
  imports: [DashboardModule],
  controllers: [
    BranchesController,
    HotelController,
    ReservationDirectoryController,
    OnboardingController,
  ],
  providers: [
    BranchesService,
    PrismaService,
    HotelService,
    ReservationDirectory,
    OnboardingService,
  ],
})
export class HotelModule {}
