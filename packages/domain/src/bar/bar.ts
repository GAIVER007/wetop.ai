/** Товарный учет бара: money in minor units, markup in basis points, stock in whole units. */
export class BarRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BarRuleError';
  }
}

const BASIS_POINTS = 10_000n;
const TEN_TENGE_MINOR = 1_000n;

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

/** Цена после наценки, округленная вверх до 10 тенге, без float. */
export function salePriceFromMarkup(unitCostMinor: bigint, markupBasisPoints: bigint): bigint {
  if (unitCostMinor <= 0n) throw new BarRuleError('Себестоимость должна быть больше нуля');
  if (markupBasisPoints < 0n) throw new BarRuleError('Наценка не может быть отрицательной');
  const markedUp = ceilDiv(unitCostMinor * (BASIS_POINTS + markupBasisPoints), BASIS_POINTS);
  return ceilDiv(markedUp, TEN_TENGE_MINOR) * TEN_TENGE_MINOR;
}

export interface FifoLot {
  lotId: string;
  receivedAt: string;
  availableUnits: bigint;
  unitCostMinor: bigint;
}

export interface FifoAllocation {
  lotId: string;
  units: bigint;
  unitCostMinor: bigint;
  costMinor: bigint;
}

/** Раскладывает продажу по самым ранним партиям и запрещает минусовой остаток. */
export function allocateFifo(
  lots: readonly FifoLot[],
  requestedUnits: bigint,
): { allocations: FifoAllocation[]; totalCostMinor: bigint } {
  if (requestedUnits <= 0n) throw new BarRuleError('Количество продажи должно быть больше нуля');
  for (const lot of lots) {
    if (!lot.lotId || lot.availableUnits < 0n || lot.unitCostMinor <= 0n)
      throw new BarRuleError('Партия содержит недопустимые данные');
    if (Number.isNaN(Date.parse(lot.receivedAt)))
      throw new BarRuleError('У партии неверное время прихода');
  }
  const available = lots.reduce((sum, lot) => sum + lot.availableUnits, 0n);
  if (available < requestedUnits)
    throw new BarRuleError(`Недостаточно товара: доступно ${available}, нужно ${requestedUnits}`);

  let remaining = requestedUnits;
  const allocations: FifoAllocation[] = [];
  const ordered = [...lots].sort(
    (a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.lotId.localeCompare(b.lotId),
  );
  for (const lot of ordered) {
    if (remaining === 0n) break;
    if (lot.availableUnits === 0n) continue;
    const units = lot.availableUnits < remaining ? lot.availableUnits : remaining;
    allocations.push({
      lotId: lot.lotId,
      units,
      unitCostMinor: lot.unitCostMinor,
      costMinor: units * lot.unitCostMinor,
    });
    remaining -= units;
  }
  return {
    allocations,
    totalCostMinor: allocations.reduce((sum, row) => sum + row.costMinor, 0n),
  };
}

/** Переводит целые упаковки в целые штуки. */
export function unitsFromPackages(packages: bigint, unitsPerPackage: bigint): bigint {
  if (packages <= 0n) throw new BarRuleError('Количество упаковок должно быть больше нуля');
  if (unitsPerPackage <= 0n)
    throw new BarRuleError('Штук в упаковке должно быть больше нуля');
  return packages * unitsPerPackage;
}
