import { SummaryLine } from '../../lib/summary-line';

/**
 * Сводка дня над сеткой календаря одной строкой (аудит 22.10.2026 P1-2: шесть плиток занимали первый экран
 * телефона, владелец против плиток везде). Числа те же серверные, что были в плитках, testid прежние;
 * каждое число ведёт к своему списку, как раньше плитка.
 */
export function DayLine({
  today,
  counts,
  occupancy,
  occupied,
  units,
  free,
  attention,
  availabilityHref,
}: {
  today: string;
  counts: { arrivals: number; departures: number; inHouse: number };
  occupancy: number | null;
  occupied: number | null;
  units: number | null;
  free: number | null;
  attention: number;
  availabilityHref: string;
}) {
  const dayHref = (date: string) => `/reservations?from=${today}&to=${today}&date=${date}`;
  const n = (value: number | null) => (value == null ? '–' : String(value));
  return (
    <SummaryLine
      label="Сегодня на объекте"
      className="board-dayline"
      parts={[
        {
          key: 'occupied',
          label: 'Занято',
          value: n(occupied),
          testId: 'day-occupied',
          after:
            units !== null && occupied !== null ? (
              <>
                {` из ${units}`}
                {occupancy !== null && (
                  <>
                    {', '}
                    <b data-testid="day-occupancy">{`${occupancy}%`}</b>
                  </>
                )}
              </>
            ) : null,
        },
        { key: 'free', label: 'свободно', value: n(free), testId: 'day-free', href: availabilityHref },
        {
          key: 'arrivals',
          label: 'заезд',
          value: counts.arrivals,
          testId: 'day-arrivals',
          href: dayHref('arrival'),
        },
        {
          key: 'departures',
          label: 'выезд',
          value: counts.departures,
          testId: 'day-departures',
          href: dayHref('departure'),
        },
        {
          key: 'in-house',
          label: 'проживают',
          value: counts.inHouse,
          testId: 'day-in-house',
          href: dayHref('stay'),
        },
        {
          key: 'attention',
          label: 'требует внимания',
          value: attention,
          testId: 'day-attention',
          href: '/chessboard?stays=debt',
        },
      ]}
    />
  );
}
