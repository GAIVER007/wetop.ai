import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  forwardRef,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Post,
} from '@nestjs/common';
import {
  AccommodationKind,
  InventoryUnitKind,
  NEW_PROPERTY_DEFAULTS,
  createPropertyInChain,
  type DbTx,
} from '@pms/database';
import { buildHotelSetupPlan, OnboardingError, type HotelSetup } from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import {
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentScope,
  hasSignedInActor,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { FOREIGN_PROPERTY_MESSAGE, PROPERTY_NOT_SET_UP_MESSAGE } from '../database/property-ref';
import { HotelService } from './hotel.module';
import { Access } from '../auth/access.decorator';

/** Горизонт цен: столько дней вперёд, как полная выгрузка ARI. Дальше цену продлевают в «Ценах». */
const PRICE_HORIZON_DAYS = 500;

/** Даты [сегодня; сегодня+n) по часам объекта, полночью UTC — как хранит `daily_rates.date`. */
function horizon(now: Date, timezone: string, days: number): Date[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  const start = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => new Date(start + i * 86_400_000));
}

interface RawCategory {
  name?: unknown;
  kind?: unknown;
  capacityAdults?: unknown;
  units?: unknown;
  priceMinor?: unknown;
}

/** Тело запроса приводим к форме домена; значения проверяет `buildHotelSetupPlan`, здесь только форма. */
function parseSetup(body: Record<string, unknown>): HotelSetup {
  const rawList = body?.['categories'];
  if (!Array.isArray(rawList)) throw new BadRequestException('categories — список категорий');
  const num = (v: unknown): number => (typeof v === 'number' ? v : NaN);
  const categories = (rawList as RawCategory[]).map((c) => ({
    name: typeof c?.name === 'string' ? c.name : '',
    kind: String(c?.kind ?? '') as HotelSetup['categories'][number]['kind'],
    capacityAdults: num(c?.capacityAdults),
    units: num(c?.units),
    priceMinor: num(c?.priceMinor),
  }));
  return { categories, currency: typeof body?.['currency'] === 'string' ? body['currency'] : '' };
}

/** Объект организации без объекта — с её именем и умолчаниями регистрации, сразу в цепочке (DATA_MODEL v2.6) */
async function createOrganizationProperty(tx: DbTx, organizationId: string, currency: string) {
  const organization = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });
  return createPropertyInChain(tx, organizationId, {
    name: organization.name,
    ...NEW_PROPERTY_DEFAULTS,
    currency,
  });
}

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md): из пустого объекта делает рабочий —
 * заводит номера, тариф и цены одной транзакцией. Пишет ПОД объект своей организации по его id, а
 * не по имени: имя у объектов не уникально между организациями. Доступно только пока объект пуст.
 */
@Injectable()
export class OnboardingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => HotelService)) private readonly hotel: HotelService,
  ) {}

  /** Организация вошедшего; служебный ходок сюда не ходит — онбординг только для человека. */
  private organizationId(): string {
    if (!hasSignedInActor()) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
    const organizationId = currentOrganizationId();
    if (organizationId === null) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
    return organizationId;
  }

  /**
   * Объект организации вошедшего или `null`, если его нет. Объекта нет после сброса платформы (ADR-118): остаются
   * владелец и членство, а объект, Business и Location удалены — онбординг начинается с пустого места
   * (plans/onboarding-without-property-2026-09-28.md).
   */
  private async findProperty(organizationId: string, db: Pick<PrismaService['db'], 'property'> = this.prisma.db) {
    // Несколько филиалов (Platform P3): объект, текущего scope, как у остальных экранов (`property-ref.ts`); без
    // указателя, самый ранний, а не случайный
    const scope = currentScope();
    const locationId = currentLocationId();
    const businessId = currentBusinessId();
    const where =
      scope === 'LOCATION' && locationId
        ? { organizationId, locationId }
        : scope === 'BUSINESS' && businessId
          ? { organizationId, location: { businessId } }
          : { organizationId };
    return db.property.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, currency: true, timezone: true },
    });
  }

  /** Нужен ли онбординг: у объекта ещё нет ни одной категории. Плюс имя и валюта для формы. */
  async status() {
    const organizationId = this.organizationId();
    const property = await this.findProperty(organizationId);
    if (!property) {
      // Объекта нет — форма открывается с именем организации; объект создаст сохранение, GET ничего не пишет
      const organization = await this.prisma.db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      if (!organization) throw new NotFoundException(PROPERTY_NOT_SET_UP_MESSAGE);
      return { needed: true, name: organization.name, currency: NEW_PROPERTY_DEFAULTS.currency };
    }
    const categories = await this.prisma.db.accommodationType.count({
      where: { propertyId: property.id },
    });
    return { needed: categories === 0, name: property.name, currency: property.currency };
  }

  async provision(body: Record<string, unknown>, now = new Date()) {
    const organizationId = this.organizationId();
    const existing = await this.findProperty(organizationId);
    const setup = parseSetup(body);
    let plan;
    try {
      plan = buildHotelSetupPlan({
        categories: setup.categories,
        currency: setup.currency || existing?.currency || NEW_PROPERTY_DEFAULTS.currency,
      });
    } catch (e) {
      if (e instanceof OnboardingError) throw new BadRequestException(e.message);
      throw e;
    }
    const dates = horizon(now, existing?.timezone ?? NEW_PROPERTY_DEFAULTS.timezone, PRICE_HORIZON_DAYS);

    await this.prisma.db.$transaction(async (tx) => {
      // Объекта нет (после сброса) — создаётся в этой же транзакции сразу в цепочке, как при регистрации:
      // номера без объекта не заведутся, а объект без номеров после отказа не останется.
      // Строка организации запирается до конца транзакции: два одновременных первых сохранения иначе оба видели
      // «объекта нет» и заводили по объекту; второе теперь ждёт первое, видит его объект с номерами и получает 409.
      await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const property =
        existing ??
        (await this.findProperty(organizationId, tx)) ??
        (await createOrganizationProperty(tx, organizationId, plan.ratePlan.currency));
      // Повторный онбординг закрыт: объект с номерами уже настроен, второй прогон плодил бы дубли
      const already = await tx.accommodationType.count({ where: { propertyId: property.id } });
      if (already > 0)
        throw new ConflictException(
          'Отель уже настроен: номера созданы ранее. Меняйте их в настройках.',
        );

      const building = await tx.building.create({
        data: { propertyId: property.id, name: plan.inventory.buildingName },
        select: { id: true },
      });
      const floor = await tx.floor.create({
        data: { buildingId: building.id, name: plan.inventory.floorName },
        select: { id: true },
      });
      const typeIdByCode = new Map<string, string>();
      for (const t of plan.inventory.accommodationTypes) {
        const created = await tx.accommodationType.create({
          data: {
            propertyId: property.id,
            code: t.code,
            name: t.name,
            kind: t.kind as AccommodationKind,
            capacityAdults: t.capacityAdults,
            capacityChildren: t.capacityChildren,
          },
          select: { id: true },
        });
        typeIdByCode.set(t.code, created.id);
      }
      for (const u of plan.inventory.units) {
        const room = await tx.physicalRoom.create({
          data: {
            floorId: floor.id,
            roomNumber: u.roomNumber,
            capacity: u.roomCapacity,
            isDorm: u.isDorm,
          },
          select: { id: true },
        });
        await tx.inventoryUnit.create({
          data: {
            propertyId: property.id,
            physicalRoomId: room.id,
            accommodationTypeId: typeIdByCode.get(u.accommodationTypeCode)!,
            kind: u.kind as InventoryUnitKind,
            code: u.code,
          },
        });
      }
      const ratePlan = await tx.ratePlan.create({
        data: {
          propertyId: property.id,
          code: plan.ratePlan.code,
          name: plan.ratePlan.name,
          currency: plan.ratePlan.currency,
        },
        select: { id: true },
      });
      await tx.ratePlanAccommodationType.createMany({
        data: [...typeIdByCode.values()].map((accommodationTypeId) => ({
          ratePlanId: ratePlan.id,
          accommodationTypeId,
        })),
      });
      const rateRows = plan.rates.flatMap((r) => {
        const accommodationTypeId = typeIdByCode.get(r.accommodationTypeCode)!;
        const price = BigInt(r.priceMinor);
        return dates.map((date) => ({
          date,
          accommodationTypeId,
          ratePlanId: ratePlan.id,
          occupancy: r.occupancy,
          price,
        }));
      });
      await tx.dailyRate.createMany({ data: rateRows });
      // SECURITY.md §6: первые цены и фонд — в журнал одной строкой; прежнего состояния нет — объект был пуст
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'Property',
          entityId: property.id,
          action: 'hotel.onboarding',
          after: {
            currency: plan.ratePlan.currency,
            ratePlan: plan.ratePlan.code,
            categories: plan.inventory.accommodationTypes.map((t) => ({
              code: t.code,
              name: t.name,
              kind: t.kind,
              units: plan.inventory.units.filter((u) => u.accommodationTypeCode === t.code).length,
            })),
            rates: plan.rates.map((r) => ({
              accommodationTypeCode: r.accommodationTypeCode,
              occupancy: r.occupancy,
              priceMinor: String(r.priceMinor),
            })),
            from: dates[0]?.toISOString().slice(0, 10) ?? null,
            days: dates.length,
          },
        },
      });
    });

    // У объекта появились номера — прежние настройки (needsOnboarding:true) в кэше устарели
    this.hotel.forget();

    return {
      ok: true as const,
      categories: plan.inventory.accommodationTypes.length,
      units: plan.inventory.units.length,
    };
  }
}

@Access('desk')
@Controller('hotel/onboarding')
export class OnboardingController {
  constructor(@Inject(OnboardingService) private readonly service: OnboardingService) {}
  @Get() status() {
    return this.service.status();
  }
  @Access('settings')
  @Post() provision(@Body() body: Record<string, unknown>) {
    return this.service.provision(body ?? {});
  }
}
