import type { BarMovementRow, BarSaleRow } from '../../../lib/api';

/** Тип движения в ленте «Склад: движение товаров» и значение параметра адреса `type` */
export type MovementType = 'sales' | 'returns' | 'writeoff' | 'inventory' | 'receipts';
export const MOVEMENT_TYPES: MovementType[] = ['sales', 'returns', 'writeoff', 'inventory', 'receipts'];

const KIND_TYPE: Record<BarMovementRow['kind'], MovementType> = {
  RECEIPT: 'receipts',
  SALE: 'sales',
  WRITE_OFF: 'writeoff',
  SALE_RETURN: 'returns',
  INVENTORY_ADJUSTMENT: 'inventory',
};

/** Старые якоря вкладок (#bar-sales и т.п.) ведут на ленту с нужным типом */
const HASH_TYPE: Record<string, MovementType | ''> = {
  'bar-sales': 'sales',
  'bar-movements': '',
  'bar-writeoff': 'writeoff',
  'bar-inventory': 'inventory',
};
export function typeFromHash(hash: string): MovementType | '' | undefined {
  return HASH_TYPE[hash.replace(/^#/, '')];
}

export function parseMovementType(value: string | undefined): MovementType | '' {
  return MOVEMENT_TYPES.includes(value as MovementType) ? (value as MovementType) : '';
}

export interface FeedRow {
  id: string;
  createdAt: string;
  item: string;
  type: MovementType;
  /** количество со знаком: «+3» или «−2» */
  quantity: string;
  direction: 'in' | 'out' | 'zero';
  amountMinor: string | null;
  note: string | null;
  /** продажа, по которой можно оформить возврат */
  sale?: BarSaleRow;
}

function signed(units: string, kind: BarMovementRow['kind']): { quantity: string; direction: FeedRow['direction'] } {
  const raw = units.trim();
  const abs = raw.replace(/^[-+]/, '');
  if (/^0+(\.0+)?$/.test(abs)) return { quantity: '0', direction: 'zero' };
  const negative = raw.startsWith('-') || ((kind === 'SALE' || kind === 'WRITE_OFF') && !raw.startsWith('+'));
  return negative ? { quantity: `−${abs}`, direction: 'out' } : { quantity: `+${abs}`, direction: 'in' };
}

function sumUnits(sale: BarSaleRow): string {
  // целые штуки складываются без float; дробные остаются строкой каждой строки
  const whole = sale.lines.every((line) => /^\d+$/.test(line.quantityUnits));
  if (whole) return sale.lines.reduce((acc, line) => acc + BigInt(line.quantityUnits), 0n).toString();
  return sale.lines.map((line) => line.quantityUnits).join(' + ');
}

/**
 * Одна лента движений, новые сверху. Продажа берётся из журнала продаж (с кнопкой возврата),
 * остальные движения (приход, возврат, списание, инвентаризация) из ленты остатка;
 * движения SALE не дублируются. `type` пустой: все типы. `query`: поиск по товару.
 * `from`/`to` (YYYY-MM-DD, день объекта) через `dayOf`.
 */
export function movementRows(
  data: { sales: BarSaleRow[]; movements: BarMovementRow[] },
  type: MovementType | '' = '',
  options: { query?: string; from?: string; to?: string; dayOf?: (iso: string) => string } = {},
): FeedRow[] {
  const rows: FeedRow[] = [
    ...data.sales.map((sale): FeedRow => {
      const units = sumUnits(sale);
      return {
        id: `sale-${sale.id}`,
        createdAt: sale.createdAt,
        item: sale.lines.map((line) => `${line.product.name} × ${line.quantityUnits}`).join(', '),
        type: 'sales',
        quantity: units === '0' || units === '' ? '0' : `−${units}`,
        direction: units === '0' || units === '' ? 'zero' : 'out',
        amountMinor: sale.totalRevenue,
        note: null,
        sale,
      };
    }),
    ...data.movements
      .filter((movement) => movement.kind !== 'SALE')
      .map((movement): FeedRow => ({
        id: `movement-${movement.id}`,
        createdAt: movement.createdAt,
        item: movement.product.name,
        type: KIND_TYPE[movement.kind],
        ...signed(movement.units, movement.kind),
        amountMinor: movement.amountMinor,
        note: movement.note,
      })),
  ];
  const query = options.query?.trim().toLocaleLowerCase('ru') ?? '';
  const dayOf = options.dayOf ?? ((iso: string) => iso.slice(0, 10));
  return rows
    .filter((row) => !type || row.type === type)
    .filter((row) => !query || row.item.toLocaleLowerCase('ru').includes(query))
    .filter((row) => {
      if (!options.from && !options.to) return true;
      const day = dayOf(row.createdAt);
      return (!options.from || day >= options.from) && (!options.to || day <= options.to);
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export type MovementPeriod = 'today' | 'yesterday' | 'week' | 'month' | '';
export function parsePeriod(value: string | undefined): MovementPeriod {
  return value === 'today' || value === 'yesterday' || value === 'week' || value === 'month' ? value : '';
}

function shift(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Границы периода в днях объекта; неделя с понедельника */
export function periodRange(period: MovementPeriod, today: string): { from?: string; to?: string } {
  if (period === 'today') return { from: today, to: today };
  if (period === 'yesterday') return { from: shift(today, -1), to: shift(today, -1) };
  if (period === 'week') {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    return { from: shift(today, -weekday), to: today };
  }
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  return {};
}
