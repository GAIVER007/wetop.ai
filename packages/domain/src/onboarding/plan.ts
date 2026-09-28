/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md). Превращает то, что человек ввёл на
 * странице настройки (категории, вместимость, число мест, цена), в структуры, которые PMS уже умеет
 * записывать: план фонда для `importInventoryPlan`, тариф и цены на ночь.
 *
 * Чистая функция без БД и без Prisma: проверки и генерация кодов здесь, чтобы их можно было испытать
 * без сервера. Сервис поверх лишь пишет готовый план транзакцией.
 */
import type { AccommodationKind, InventoryImportPlan, InventoryUnitKind } from '../inventory/types';

export interface OnboardingCategory {
  name: string;
  kind: AccommodationKind;
  /** Гостей на одно место (вместимость) */
  capacityAdults: number;
  /** Сколько таких мест завести */
  units: number;
  /** Цена за ночь, в минорных единицах (тиын), ADR-008 */
  priceMinor: number;
}

export interface HotelSetup {
  categories: OnboardingCategory[];
  /** ISO 4217, на объекте KZT */
  currency: string;
}

export interface HotelSetupRate {
  accommodationTypeCode: string;
  occupancy: number;
  /** Строкой — цена хранится как BigInt (тиын), число бы теряло точность на больших суммах */
  priceMinor: string;
}

export interface HotelSetupPlan {
  inventory: InventoryImportPlan;
  ratePlan: { code: string; name: string; currency: string };
  rates: HotelSetupRate[];
}

export class OnboardingError extends Error {}

const MAX_CATEGORIES = 50;
const MAX_UNITS_PER_CATEGORY = 500;
const MAX_TOTAL_UNITS = 2000;
const MAX_CAPACITY = 20;
const MAX_NAME = 100;
/** Потолок цены — 100 млн минорных единиц (1 млн валюты): выше — это опечатка, а не цена ночи */
const MAX_PRICE_MINOR = 100_000_000;
const KINDS: readonly AccommodationKind[] = ['PRIVATE_ROOM', 'DORM_BED', 'APARTMENT'];

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ');
const isCurrency = (s: string): boolean => /^[A-Z]{3}$/.test(s);

/** Ширина номера места, чтобы 1..N выравнивались: до 99 — две цифры, дальше — по длине максимума */
function pad(n: number, total: number): string {
  const width = Math.max(2, String(total).length);
  return String(n).padStart(width, '0');
}

/**
 * Построить план настройки отеля. Бросает `OnboardingError` с понятным текстом на любой негодный
 * ввод — до единой записи в базу.
 */
export function buildHotelSetupPlan(setup: HotelSetup): HotelSetupPlan {
  if (!isCurrency(setup.currency))
    throw new OnboardingError('Валюта — три латинские буквы, например KZT');
  const categories = setup.categories ?? [];
  if (categories.length === 0) throw new OnboardingError('Добавьте хотя бы одну категорию номеров');
  if (categories.length > MAX_CATEGORIES)
    throw new OnboardingError(`Категорий не больше ${MAX_CATEGORIES}`);

  const seenNames = new Set<string>();
  let totalUnits = 0;
  const accommodationTypes: InventoryImportPlan['accommodationTypes'] = [];
  const units: InventoryImportPlan['units'] = [];
  const rates: HotelSetupRate[] = [];

  categories.forEach((c, i) => {
    const name = norm(c.name ?? '');
    const where = `Категория ${i + 1}`;
    if (name.length < 1 || name.length > MAX_NAME)
      throw new OnboardingError(`${where}: укажите название до ${MAX_NAME} знаков`);
    const key = name.toLocaleLowerCase('ru');
    if (seenNames.has(key)) throw new OnboardingError(`Категория «${name}» повторяется`);
    seenNames.add(key);
    if (!KINDS.includes(c.kind)) throw new OnboardingError(`${where}: неизвестный тип размещения`);
    if (
      !Number.isInteger(c.capacityAdults) ||
      c.capacityAdults < 1 ||
      c.capacityAdults > MAX_CAPACITY
    )
      throw new OnboardingError(`${where}: гостей на место — целое от 1 до ${MAX_CAPACITY}`);
    if (!Number.isInteger(c.units) || c.units < 1 || c.units > MAX_UNITS_PER_CATEGORY)
      throw new OnboardingError(`${where}: число мест — целое от 1 до ${MAX_UNITS_PER_CATEGORY}`);
    if (!Number.isInteger(c.priceMinor) || c.priceMinor < 0 || c.priceMinor > MAX_PRICE_MINOR)
      throw new OnboardingError(
        `${where}: цена за ночь — целое число (в тиынах), не больше ${MAX_PRICE_MINOR}`,
      );

    totalUnits += c.units;
    if (totalUnits > MAX_TOTAL_UNITS)
      throw new OnboardingError(`Всего мест не больше ${MAX_TOTAL_UNITS}`);

    const code = `cat-${i + 1}`;
    const isDorm = c.kind === 'DORM_BED';
    const unitKind: InventoryUnitKind = isDorm ? 'BED' : 'ROOM';
    accommodationTypes.push({
      code,
      name,
      kind: c.kind,
      capacityAdults: c.capacityAdults,
      capacityChildren: 0,
    });
    for (let n = 1; n <= c.units; n += 1) {
      // Код места: <номер категории><порядковый>, например 101, 102; номер комнаты — тот же
      const unitCode = `${i + 1}${pad(n, c.units)}`;
      units.push({
        code: unitCode,
        kind: unitKind,
        accommodationTypeCode: code,
        roomNumber: unitCode,
        // Койка держит одного; отдельный номер/апартаменты — по вместимости категории
        roomCapacity: isDorm ? 1 : c.capacityAdults,
        isDorm,
      });
    }
    // Цена по строке на каждый occupancy 1..вместимость — иначе бронь на 2 гостей не найдёт цену
    for (let occ = 1; occ <= c.capacityAdults; occ += 1) {
      rates.push({ accommodationTypeCode: code, occupancy: occ, priceMinor: String(c.priceMinor) });
    }
  });

  return {
    inventory: {
      buildingName: 'Основной корпус',
      floorName: '1 этаж',
      accommodationTypes,
      units,
    },
    ratePlan: { code: 'main', name: 'Основной тариф', currency: setup.currency },
    rates,
  };
}
