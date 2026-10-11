'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InventoryTrend, InventoryUnit, TrendValue } from '../../lib/api';
import { Icon, type IconName } from '../../components/icon';
import { Select, cx } from '../../components/ui';

/**
 * Шесть плиток сводки «Номерного фонда» с динамикой за период. Числа считаются из списка мест,
 * динамика приходит из `GET /inventory/trend` (восстановлена из дат создания, блокировок и журнала уборки).
 * Рост «Недоступно» и «Требует уборки» это плохо, поэтому их стрелка красная при росте.
 */
type Key = keyof InventoryTrend['metrics'];

const PERIODS = [
  [7, '7 дней'],
  [30, '30 дней'],
  [90, '90 дней'],
] as const;

function Delta({ value, worseWhenUp }: { value: TrendValue | undefined; worseWhenUp?: boolean }) {
  if (!value) return null;
  const { delta, percent } = value;
  const tone = delta === 0 ? 'flat' : delta > 0 === Boolean(worseWhenUp) ? 'bad' : 'good';
  const text = percent === null ? (delta > 0 ? `+${delta}` : `${delta}`) : `${Math.abs(percent)}%`;
  return (
    <span
      className={cx('inv-delta', `inv-delta--${tone}`)}
      data-testid="trend-delta"
      aria-label={
        delta === 0
          ? 'Без изменений за период'
          : `${delta > 0 ? 'Выросло' : 'Снизилось'} на ${text} за период`
      }
    >
      {delta !== 0 && (
        <span aria-hidden="true" className="inv-delta-arrow">
          {delta > 0 ? '↑' : '↓'}
        </span>
      )}
      {delta === 0 ? '0%' : text}
    </span>
  );
}

export function InventorySummaryTiles({
  units,
  trend,
  days,
}: {
  units: InventoryUnit[];
  trend: InventoryTrend | null;
  days: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const rooms = units.filter((u) => u.kind === 'ROOM').length;
  const beds = units.length - rooms;
  const onSale = units.filter((u) => u.active && !u.block).length;
  const blocked = units.filter((u) => u.active && u.block).length;
  const dirty = units.filter((u) => u.active && u.housekeepingStatus === 'DIRTY').length;
  const tiles: Array<{
    id: string;
    key: Key;
    label: string;
    value: number;
    of?: number;
    icon: IconName;
    tone: string;
    worseWhenUp?: boolean;
  }> = [
    {
      id: 'total-units',
      key: 'totalUnits',
      label: 'Единиц продажи',
      value: units.length,
      of: units.length,
      icon: 'inventory',
      tone: 'primary',
    },
    {
      id: 'rooms',
      key: 'rooms',
      label: 'Номеров',
      value: rooms,
      of: rooms,
      icon: 'bed',
      tone: 'primary',
    },
    {
      id: 'beds',
      key: 'beds',
      label: 'Койко-мест',
      value: beds,
      of: beds,
      icon: 'guests',
      tone: 'primary',
    },
    {
      id: 'on-sale',
      key: 'onSale',
      label: 'В продаже',
      value: onSale,
      icon: 'booking',
      tone: 'ok',
    },
    {
      id: 'blocks',
      key: 'unavailable',
      label: 'Недоступно',
      value: blocked,
      icon: 'incidents',
      tone: 'bad',
      worseWhenUp: true,
    },
    {
      id: 'needs-cleaning',
      key: 'needsCleaning',
      label: 'Требует уборки',
      value: dirty,
      icon: 'dirty',
      tone: 'warn',
      worseWhenUp: true,
    },
  ];
  function setPeriod(value: string) {
    const params = new URLSearchParams(search.toString());
    params.set('period', value);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }
  return (
    <section aria-label="Сводка фонда" className="inv-summary-wrap">
      <div className="inv-summary-head">
        <label className="inv-period">
          Динамика за
          <Select
            aria-label="Период динамики"
            value={String(days)}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIODS.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <dl className="inv-summary" data-testid="inventory-summary">
        {tiles.map((tile) => (
          <div key={tile.id} className="inv-tile">
            <dt>
              <span
                className={cx('inv-tile-icon', `inv-tile-icon--${tile.tone}`)}
                aria-hidden="true"
              >
                <Icon name={tile.icon} width={22} height={22} />
              </span>
              {tile.label}
            </dt>
            <dd>
              <span className="inv-tile-value" data-testid={tile.id}>
                {tile.value}
              </span>
              <Delta value={trend?.metrics[tile.key]} worseWhenUp={tile.worseWhenUp ?? false} />
              {tile.of !== undefined && <span className="inv-tile-of">из {tile.of}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
