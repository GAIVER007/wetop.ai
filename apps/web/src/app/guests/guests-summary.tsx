import type { GuestDirectoryKpi } from '../../lib/api';
import { SummaryLine } from '../../lib/summary-line';

export type GuestsSummaryLink = 'inhouse' | 'today' | 'departures' | 'expected' | 'attention' | 'none';

/**
 * Показатели «Гостей» одной строкой (аудит 22.10.2026 P1-16): шесть плиток обрезали подписи
 * («Без активного про…», «+1 к вчерашнему д…»). Числа и ссылки те же, testid прежние.
 */
export function GuestsSummary({
  kpi,
  href,
}: {
  kpi: GuestDirectoryKpi;
  href: (part: GuestsSummaryLink) => string;
}) {
  return (
    <SummaryLine
      label="Показатели гостей"
      testId="guests-kpis"
      parts={[
        { key: 'inhouse', label: 'Проживают', value: kpi.inhouse, testId: 'kpi-inhouse', href: href('inhouse') },
        {
          key: 'arrivals',
          label: 'заезды сегодня',
          value: kpi.arrivalsToday,
          testId: 'kpi-arrivals',
          href: href('today'),
        },
        {
          key: 'departures',
          label: 'выезды сегодня',
          value: kpi.departuresToday,
          testId: 'kpi-departures',
          href: href('departures'),
        },
        {
          key: 'expected',
          label: 'ожидают заезд',
          value: kpi.expected,
          testId: 'kpi-expected',
          href: href('expected'),
        },
        {
          key: 'attention',
          label: 'требуют внимания',
          value: kpi.attention,
          testId: 'kpi-attention',
          href: href('attention'),
        },
        {
          key: 'none',
          label: 'без активного проживания',
          value: kpi.none,
          testId: 'kpi-none',
          after: ` из ${kpi.all}`,
          href: href('none'),
        },
      ]}
    />
  );
}
