/**
 * Что создать в Channex для нашего объекта (plans/slice-4-channex.md, умолчания):
 * объект → 5 категорий как room types → один тариф на категорию (тариф ОТА, manual, per_room).
 * Источники форматов: hotels-collection.md, room-types-collection.md, rate-plans-collection.md.
 * Чистая функция: ни сети, ни базы.
 */
import type { channex } from '@pms/integrations';

export interface LocalPropertyForChannex {
  name: string;
  currency: string;
  timezone: string;
  /** ISO 3166-1 alpha-2, у объекта KZ */
  country: string;
  city: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}
export interface LocalCategoryForChannex {
  id: string;
  code: string;
  name: string;
  kind: 'PRIVATE_ROOM' | 'DORM_BED' | 'APARTMENT';
  capacityAdults: number;
  /** Активных ячеек категории (единиц продажи) */
  units: number;
}
export interface LocalRatePlanForChannex {
  id: string;
  code: string;
  name: string;
  currency: string;
}
export interface ChannexSetupPlan {
  property: channex.ChannexPropertyAttributes;
  roomTypes: Array<{
    localCategoryId: string;
    localCategoryCode: string;
    attrs: Omit<channex.ChannexRoomTypeAttributes, 'property_id'>;
  }>;
  ratePlans: Array<{
    localCategoryId: string;
    localRatePlanId: string;
    attrs: Omit<channex.ChannexRatePlanAttributes, 'property_id' | 'room_type_id'>;
  }>;
}

/** Коек в одной dorm-комнате — со слов владельца (OBJECT.md: 4 dorm × 18); Q-095 отложен. */
export const DEFAULT_DORM_BEDS_PER_ROOM = 18;

export function buildChannexSetup(input: {
  property: LocalPropertyForChannex;
  categories: LocalCategoryForChannex[];
  ratePlan: LocalRatePlanForChannex;
  dormBedsPerRoom?: number;
}): ChannexSetupPlan {
  const dormBeds = input.dormBedsPerRoom ?? DEFAULT_DORM_BEDS_PER_ROOM;
  if (input.categories.length === 0) throw new Error('Нет категорий для менеджера каналов');
  if (input.ratePlan.currency !== input.property.currency)
    throw new Error(
      `Валюта тарифа ${input.ratePlan.code} (${input.ratePlan.currency}) не совпадает с валютой объекта (${input.property.currency})`,
    );
  const property: channex.ChannexPropertyAttributes = {
    title: input.property.name,
    currency: input.property.currency,
    timezone: input.property.timezone,
    country: input.property.country,
    city: input.property.city,
    property_type: 'hostel',
    ...(input.property.address ? { address: input.property.address } : {}),
    ...(input.property.email ? { email: input.property.email } : {}),
    ...(input.property.phone ? { phone: input.property.phone } : {}),
    settings: {
      // бронь из канала уменьшает доступность сразу; мы всё равно шлём availability сами (ari.md)
      allow_availability_autoupdate_on_confirmation: true,
      allow_availability_autoupdate_on_modification: true,
      allow_availability_autoupdate_on_cancellation: true,
      min_stay_type: 'both',
    },
  };
  const roomTypes = input.categories.map((c) => {
    if (c.units <= 0) throw new Error(`Категория ${c.code}: нет активных ячеек`);
    const dorm = c.kind === 'DORM_BED';
    return {
      localCategoryId: c.id,
      localCategoryCode: c.code,
      attrs: {
        title: c.name,
        count_of_rooms: c.units,
        occ_adults: c.capacityAdults,
        occ_children: 0,
        occ_infants: 0,
        default_occupancy: c.capacityAdults,
        room_kind: dorm ? ('dorm' as const) : ('room' as const),
        capacity: dorm ? dormBeds : null,
      },
    };
  });
  const ratePlans = input.categories.map((c) => ({
    localCategoryId: c.id,
    localRatePlanId: input.ratePlan.id,
    attrs: {
      title: `${input.ratePlan.name} — ${c.name}`,
      currency: input.ratePlan.currency,
      sell_mode: 'per_room' as const,
      rate_mode: 'manual' as const,
      // per_room → одна опция на максимальную вместимость (rate-plans-collection.md → Occupancy Options)
      options: [{ occupancy: c.capacityAdults, is_primary: true }],
    },
  }));
  return { property, roomTypes, ratePlans };
}
