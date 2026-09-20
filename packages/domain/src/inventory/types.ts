/**
 * Инвентарь по DATA_MODEL.md v1.0 §1 (утверждено 07.09.2026) и ADR-013:
 * единица продажи = ячейка; PhysicalRoom заполняется 1:1 до списка Q-095.
 * Домен не знает про Prisma, Exely и Channex — только чистые типы.
 */
export type InventoryUnitKind = 'ROOM' | 'BED';
export type AccommodationKind = 'PRIVATE_ROOM' | 'DORM_BED' | 'APARTMENT';

export interface AccommodationTypeSpec {
  /** Код в PMS, стабильный идентификатор (для импорта из Exely — `exely-<id>`) */
  code: string;
  name: string;
  kind: AccommodationKind;
  capacityAdults: number;
  /** На объекте всегда 0: детское размещение выключено */
  capacityChildren: number;
  /** Внешняя ссылка, ADR-003 */
  exelyId: string | null;
}

export interface InventoryUnitSpec {
  /** Код единицы в PMS; при импорте = «№ комнаты в Exely» как метка, из неё ничего не выводится */
  code: string;
  exelyRoomNumber: string | null;
  kind: InventoryUnitKind;
  accommodationTypeCode: string;
  /** PhysicalRoom 1:1 (ADR-013, Q-095 отложен) */
  roomNumber: string;
  roomCapacity: number;
  isDorm: boolean;
}

/** Всё, что нужно, чтобы создать фонд объекта: здание, этаж, категории, единицы. */
export interface InventoryImportPlan {
  buildingName: string;
  floorName: string;
  accommodationTypes: AccommodationTypeSpec[];
  units: InventoryUnitSpec[];
}

export interface InventoryCategorySummary {
  code: string;
  name: string;
  units: number;
  /** Сумма вместимости единиц категории */
  maxGuests: number;
  /** Вместимость одной единицы категории (койка — 1, номер — вместимость комнаты); предел «гостей» в формах */
  capacityAdults: number;
}

export interface InventorySummary {
  totalUnits: number;
  rooms: number;
  beds: number;
  maxGuests: number;
  physicalRooms: number;
  byCategory: InventoryCategorySummary[];
}
