import { sourceStatus } from './status/source';
import { statusLabel } from './status/types';
/** Представление чисел дашборда. Деньги приходят строкой в тиынах (ADR-008) — float здесь нет. */

const percentFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const intFormat = new Intl.NumberFormat('ru-RU');

/** Целые тенге с разделителями, тиыны округлены: «15 688 018 ₸» */
export function wholeTenge(minor: string, currency = 'KZT'): string {
  const v = BigInt(minor);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const tenge = (abs + 50n) / 100n;
  const text = tenge.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${text} ${currency === 'KZT' ? '₸' : currency}`;
}

export const formatPercent = (v: number) => `${percentFormat.format(v)} %`;
export const formatInt = (v: number) => intFormat.format(v);

export interface Delta {
  /** Знак: рост, падение, без изменений; null — сравнивать не с чем */
  direction: 'up' | 'down' | 'flat' | null;
  text: string;
}
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
/** Разница в процентных пунктах: загрузка 70 % против 66,8 % → «+3,2 п.п.» */
export function deltaPoints(current: number, previous: number): Delta {
  const diff = Math.round((current - previous) * 10) / 10;
  return {
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    text: `${sign(diff)}${percentFormat.format(Math.abs(diff))} п.п.`,
  };
}
/** Относительное изменение в процентах; при нулевой базе сравнения нет */
export function deltaPercent(current: bigint | number, previous: bigint | number): Delta {
  const c = typeof current === 'bigint' ? current : BigInt(Math.round(current));
  const p = typeof previous === 'bigint' ? previous : BigInt(Math.round(previous));
  if (p === 0n) return { direction: null, text: 'нет базы для сравнения' };
  const abs = p < 0n ? -p : p;
  // десятые доли процента целочисленно
  const tenths = Number(((c - p) * 1000n) / abs);
  const value = tenths / 10;
  return {
    direction: value > 0 ? 'up' : value < 0 ? 'down' : 'flat',
    text: `${sign(value)}${percentFormat.format(Math.abs(value))} %`,
  };
}

/** Канал важнее источника: «Booking.com», иначе «Стойка» */
export const sourceLabel = (source: string, channel: string | null) =>
  channel || statusLabel(sourceStatus, source);

export const METHOD_RU: Record<string, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта (терминал)',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод от физлица',
  BANK_TRANSFER_LEGAL: 'Перевод от юрлица',
  DEPOSIT: 'Депозит',
  CARD_GUARANTEE: 'Гарантия картой',
  EXTERNAL: 'Внешний канал',
};
