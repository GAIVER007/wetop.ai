import type { HTMLAttributes } from 'react';
import { formatMoney } from '../lib/money';
import { cx } from './ui';

export type AmountTone = 'due' | 'paid' | 'refund' | 'neutral';

/**
 * Плашка суммы (DESIGN.md §8): «к оплате 12 500 ₸» на полосе брони, в строке справочника и на
 * карточке. Слово перед суммой — обязательный носитель смысла, цвет только подчёркивает (§1 п. 4).
 * Сумма — строка в тиынах (ADR-008).
 */
export function AmountChip({
  minor,
  tone = 'neutral',
  label,
  currency,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  minor: string | bigint;
  tone?: AmountTone | undefined;
  /** слово перед суммой; по умолчанию — по тону */
  label?: string | undefined;
  currency?: string | undefined;
}) {
  const word =
    label ??
    ({ due: 'к оплате', paid: 'оплачено', refund: 'возврат', neutral: 'сумма' } as const)[tone];
  return (
    <span
      className={cx('amount-chip', tone !== 'neutral' && `amount-chip--${tone}`, className)}
      {...rest}
    >
      <span className="amount-chip__label">{word}</span>
      <span className="amount-chip__value num">{formatMoney(minor, currency)}</span>
    </span>
  );
}
