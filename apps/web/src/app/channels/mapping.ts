import type { ChannelMappingRow } from '../../lib/api';

/**
 * Вкладка «Сопоставление» модуля «Каналы продаж» (ADR-112; `plans/channels-mapping-port-2026-09-28.md`). Сопоставления пишет только `setup` (кнопка «Создать
 * объект и категории»): каждая категория объекта — со своим номером и тарифом в Channex, все — с одним
 * тарифом WETOP. Поэтому категория без сопоставления — ошибка (остатки и цены по ней в каналы не уходят,
 * `ari-publisher` берёт только сопоставленные), а тариф без сопоставлений — не ошибка: он работает только
 * в WETOP.
 */

/** Категория WETOP и номер Channex, с которым она связана */
export interface CategoryMapping {
  code: string;
  name: string;
  /** id номера в Channex — для «Технических деталей»; null — категория не сопоставлена */
  roomTypeId: string | null;
  /** id тарифа Channex этой категории — для «Технических деталей» */
  ratePlanId: string | null;
  /** название номера в кабинете Channex; null — сопоставлена, но название не пришло */
  channexName: string | null;
}

/** Выгружается ли тариф: во всех категориях, не во всех, ни в одной */
export type PlanExport = 'full' | 'partial' | 'none';

export interface PlanMapping {
  code: string;
  name: string;
  currency: string;
  active: boolean;
  /** в скольких категориях тариф связан с тарифом Channex */
  mappedIn: number;
  status: PlanExport;
}

/** Строка сопоставления категории: номер Channex есть. Строка объекта (без номера) не считается */
const categoryRow = (mapping: readonly ChannelMappingRow[], code: string) =>
  mapping.find((m) => m.localAccommodationTypeCode === code && m.providerRoomTypeId);

export function categoryMappings(
  categories: ReadonlyArray<{ code: string; name: string }>,
  mapping: readonly ChannelMappingRow[],
  roomTypeNames: Readonly<Record<string, string>>,
): CategoryMapping[] {
  return categories.map((c) => {
    const row = categoryRow(mapping, c.code);
    const roomTypeId = row?.providerRoomTypeId ?? null;
    return {
      code: c.code,
      name: c.name,
      roomTypeId,
      ratePlanId: row?.providerRatePlanId ?? null,
      channexName: roomTypeId ? (roomTypeNames[roomTypeId] ?? null) : null,
    };
  });
}

export function planMappings(
  plans: ReadonlyArray<{ code: string; name: string; currency: string; active: boolean }>,
  categoryCodes: readonly string[],
  mapping: readonly ChannelMappingRow[],
): PlanMapping[] {
  return plans.map((p) => {
    const mappedIn = categoryCodes.filter((code) =>
      mapping.some(
        (m) =>
          m.localAccommodationTypeCode === code &&
          m.localRatePlanCode === p.code &&
          m.providerRatePlanId,
      ),
    ).length;
    const status: PlanExport =
      mappedIn === 0 ? 'none' : mappedIn === categoryCodes.length ? 'full' : 'partial';
    return { ...p, mappedIn, status };
  });
}
