import { formatMoney } from '../../lib/money';
import { SummaryLine } from '../../lib/summary-line';

/** Итоги отчёта по источникам одной строкой (владелец против плиток на всех экранах, аудит 22.10.2026) */
export function ChannelTotals({
  count,
  cancelled,
  noShow,
  money,
}: {
  count: number;
  cancelled: number;
  noShow: number;
  money: Map<string, bigint>;
}) {
  const amount = money.size
    ? [...money].map(([currency, value]) => formatMoney(value.toString(), currency)).join(' + ')
    : '—';
  return (
    <SummaryLine
      label="Итоги по источникам"
      parts={[
        { key: 'count', label: 'Бронирований', value: count, testId: 'channel-bookings' },
        { key: 'cancelled', label: 'отмен', value: cancelled },
        { key: 'no-show', label: 'незаездов', value: noShow },
        { key: 'amount', label: 'стоимость броней', value: amount, testId: 'channel-amount' },
      ]}
    />
  );
}
