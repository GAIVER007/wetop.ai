import type { HTMLAttributes } from 'react';
import { formatMoney } from '../lib/money';
import { cx } from './ui';

/**
 * Плашка суммы (DESIGN.md §8, §9 «Долг»): остаток к оплате на полосе брони и в списках, «оплачено»,
 * «к возврату». Смысл — словом и знаком, не только цветом: «к оплате 16 000 ₸», «оплачено», «штраф 8 000 ₸».
 */
export function AmountBadge({
  amountMinor,
  kind,
  currency = 'KZT',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  amountMinor: string;
  kind: 'due' | 'paid' | 'refund' | 'penalty' | 'prepaid';
  currency?: string | undefined;
}) {
  const label = { due: 'к оплате', paid: 'оплачено', refund: 'к возврату', penalty: 'штраф', prepaid: 'предоплата' }[kind];
  const tone = { due: 'danger', paid: 'ok', refund: 'warn', penalty: 'danger', prepaid: 'info' }[kind];
  const zero = /^-?0+$/.test(amountMinor);
  return (
    <span className={cx('amount-badge', `amount-badge--${tone}`, className)} data-kind={kind} {...rest}>
      <span className="amount-badge__label">{label}</span>
      {!(kind === 'paid' && zero) && <b className="amount-badge__value">{formatMoney(amountMinor, currency)}</b>}
    </span>
  );
}
