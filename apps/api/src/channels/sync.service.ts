import 'reflect-metadata';
import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { channex } from '@pms/integrations';
import {
  CHESSBOARD_REPOSITORY,
  type ChessboardRepository,
} from '../chessboard/chessboard.repository';
import { buildAvailabilityValues, buildRestrictionValues, freeUnitsPerNight } from './ari';
import { buildChannexSetup } from './setup-plan';
import {
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  type ChannelsRepository,
  type ChannexGateway,
} from './channels.repository';

export const PROVIDER = 'channex';
/** Тариф, который продаётся в OTA (plans/slice-4-channex.md, умолчание): «Тариф для ОТА +35%» */
export const DEFAULT_OTA_RATE_PLAN_CODE = 'exely-10158310';
const DEFAULT_SYNC_DAYS = 365;

export interface SetupResult {
  providerPropertyId: string;
  created: { property: boolean; roomTypes: number; ratePlans: number };
  roomTypes: Array<{
    categoryCode: string;
    providerRoomTypeId: string;
    providerRatePlanId: string;
  }>;
}
export interface SyncResult {
  from: string;
  to: string;
  availabilityValues: number;
  restrictionValues: number;
  tasks: string[];
  warnings: unknown[];
}

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

async function viaChannex<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof channex.ChannexApiError) {
      if (e.status === 503 && e.message.includes('CHANNEX_API_KEY'))
        throw new ServiceUnavailableException(e.message);
      throw new BadGatewayException(e.message);
    }
    throw e;
  }
}

@Injectable()
export class ChannexSyncService {
  constructor(
    @Inject(CHANNEX_GATEWAY) private readonly gateway: ChannexGateway,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(CHESSBOARD_REPOSITORY) private readonly board: ChessboardRepository,
  ) {}

  /** Создать в Channex объект, категории и тарифы, которых ещё нет в маппинге. Повтор ничего не дублирует. */
  async setup(ratePlanCode = DEFAULT_OTA_RATE_PLAN_CODE): Promise<SetupResult> {
    const local = await this.repo.localSetup(ratePlanCode);
    if (!local.ratePlan)
      throw new UnprocessableEntityException(
        `Тариф ${ratePlanCode} не найден — сначала импорт тарифов`,
      );
    const ratePlan = local.ratePlan;
    const plan = buildChannexSetup({
      property: local.property,
      categories: local.categories,
      ratePlan,
    });
    const existing = await this.repo.mappings(PROVIDER);
    const created = { property: false, roomTypes: 0, ratePlans: 0 };
    let providerPropertyId =
      existing.find((m) => m.providerRoomTypeId === null)?.providerPropertyId ?? null;
    if (!providerPropertyId) {
      const p = await viaChannex(() => this.gateway.createProperty(plan.property));
      providerPropertyId = p.id;
      await this.repo.savePropertyMapping(local.property.id, PROVIDER, providerPropertyId);
      created.property = true;
    }
    const roomTypes: SetupResult['roomTypes'] = [];
    for (const rt of plan.roomTypes) {
      const have = existing.find(
        (m) =>
          m.localAccommodationTypeId === rt.localCategoryId &&
          m.localRatePlanId === ratePlan.id &&
          m.providerRatePlanId,
      );
      if (have) {
        roomTypes.push({
          categoryCode: rt.localCategoryCode,
          providerRoomTypeId: have.providerRoomTypeId!,
          providerRatePlanId: have.providerRatePlanId!,
        });
        continue;
      }
      const sameType = existing.find(
        (m) => m.localAccommodationTypeId === rt.localCategoryId && m.providerRoomTypeId,
      );
      let providerRoomTypeId = sameType?.providerRoomTypeId ?? null;
      if (!providerRoomTypeId) {
        const r = await viaChannex(() =>
          this.gateway.createRoomType({ property_id: providerPropertyId!, ...rt.attrs }),
        );
        providerRoomTypeId = r.id;
        created.roomTypes += 1;
      }
      const rpPlan = plan.ratePlans.find((x) => x.localCategoryId === rt.localCategoryId)!;
      const rp = await viaChannex(() =>
        this.gateway.createRatePlan({
          property_id: providerPropertyId!,
          room_type_id: providerRoomTypeId!,
          ...rpPlan.attrs,
        }),
      );
      created.ratePlans += 1;
      await this.repo.saveRatePlanMapping({
        propertyId: local.property.id,
        provider: PROVIDER,
        localAccommodationTypeId: rt.localCategoryId,
        localRatePlanId: ratePlan.id,
        providerPropertyId,
        providerRoomTypeId,
        providerRatePlanId: rp.id,
      });
      roomTypes.push({
        categoryCode: rt.localCategoryCode,
        providerRoomTypeId,
        providerRatePlanId: rp.id,
      });
    }
    const result = { providerPropertyId, created, roomTypes };
    await this.repo.audit('channex.setup', result);
    return result;
  }

  /** Полная выгрузка ARI на N дней вперёд: 1 вызов доступности + 1 вызов цен/ограничений (ari.md, rate-limits.md). */
  async fullSync(days = DEFAULT_SYNC_DAYS): Promise<SyncResult> {
    if (!Number.isInteger(days) || days < 1 || days > 730)
      throw new UnprocessableEntityException('days — целое от 1 до 730');
    const mappings = (await this.repo.mappings(PROVIDER)).filter(
      (m) =>
        m.providerRoomTypeId &&
        m.providerRatePlanId &&
        m.localAccommodationTypeCode &&
        m.localRatePlanId,
    );
    if (mappings.length === 0)
      throw new UnprocessableEntityException(
        'Маппинг Channex пуст — сначала POST /channels/channex/setup',
      );
    const providerPropertyId = mappings[0]!.providerPropertyId;
    const local = await this.repo.localSetup(DEFAULT_OTA_RATE_PLAN_CODE);
    const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const from = today;
    const to = plusDays(today, days - 1);
    const [units, allocations, blocks] = await Promise.all([
      this.board.units(),
      this.board.allocations(from, to),
      this.board.blocks(from, to),
    ]);
    const free = freeUnitsPerNight({ from, to, units, allocations, blocks });
    const roomTypes = [
      ...new Map(
        mappings.map((m) => [
          m.providerRoomTypeId!,
          {
            localCategoryCode: m.localAccommodationTypeCode!,
            providerRoomTypeId: m.providerRoomTypeId!,
          },
        ]),
      ).values(),
    ];
    const availability = buildAvailabilityValues({
      propertyId: providerPropertyId,
      from,
      to,
      roomTypes,
      free,
    });
    const ratePlanIds = [...new Set(mappings.map((m) => m.localRatePlanId!))];
    const [dailyRates, restrictions] = await Promise.all([
      this.repo.dailyRates(ratePlanIds, from, to),
      this.repo.restrictions(ratePlanIds, from, to),
    ]);
    const restrictionValues = buildRestrictionValues({
      propertyId: providerPropertyId,
      from,
      to,
      ratePlans: mappings.map((m) => ({
        localCategoryCode: m.localAccommodationTypeCode!,
        localRatePlanId: m.localRatePlanId!,
        providerRatePlanId: m.providerRatePlanId!,
      })),
      dailyRates,
      restrictions,
      occupancyByCategory: Object.fromEntries(
        local.categories.map((c) => [c.code, c.capacityAdults]),
      ),
    });
    const a = await viaChannex(() => this.gateway.updateAvailability(availability));
    const r = await viaChannex(() => this.gateway.updateRestrictions(restrictionValues));
    const result: SyncResult = {
      from,
      to,
      availabilityValues: availability.length,
      restrictionValues: restrictionValues.length,
      tasks: [...a.data, ...r.data].map((t) => t.id),
      warnings: [...(a.meta?.warnings ?? []), ...(r.meta?.warnings ?? [])],
    };
    await this.repo.audit('channex.fullSync', result);
    return result;
  }
}
