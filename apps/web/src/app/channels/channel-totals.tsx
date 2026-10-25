import { formatMoney } from '../../lib/money';
import { SummaryLine } from '../../lib/summary-line';
import { translator, type Translate } from '../../i18n';

/** Итоги отчёта по источникам одной строкой (владелец против плиток на всех экранах, аудит 22.10.2026) */
export function ChannelTotals({
  count,
  cancelled,
  noShow,
  money,
  t = translator('ru'),
}: {
  count: number;
  cancelled: number;
  noShow: number;
  money: Map<string, bigint>;
  t?: Translate;
}) {
  const amount = money.size
    ? [...money].map(([currency, value]) => formatMoney(value.toString(), currency)).join(' + ')
    : '—';
  return (
    <SummaryLine
      label={t('Итоги по источникам')}
      parts={[
        { key: 'count', label: t('Бронирований'), value: count, testId: 'channel-bookings' },
        { key: 'cancelled', label: t('отмен'), value: cancelled },
        { key: 'no-show', label: t('незаездов'), value: noShow },
        { key: 'amount', label: t('стоимость броней'), value: amount, testId: 'channel-amount' },
      ]}
    />
  );
}
