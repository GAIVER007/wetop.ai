import '../../today/dashboard.css';
import { cx } from '../../../components/ui';
import { deltaPercent, deltaPoints, type Delta } from '../../../lib/dashboard-format';

/**
 * Плитка и сравнение вкладок «Аналитики» (ADR-114): одни на «Обзоре» и «Загрузке». Классы — общие `.kpi*`
 * Главной (today/dashboard.css), `data-testid` плитки — `pa-kpi-<id>`.
 */
export const NO_BASE: Delta = { direction: null, text: 'нет данных для сравнения' };

/**
 * Сравнение честное (ТЗ §16–17, §27): база — прошлое количество. Ноль в прошлом отрезке — «нет данных для
 * сравнения», а не «+100 %» и не красные «−100 %». Доли сравниваются в процентных пунктах.
 */
export function pointsDelta(current: number, previous: number, base: number): Delta {
  return base > 0 ? deltaPoints(current, previous) : NO_BASE;
}
export function moneyDelta(current: string | null, previous: string | null): Delta {
  return current !== null && previous !== null && BigInt(previous) !== 0n
    ? deltaPercent(BigInt(current), BigInt(previous))
    : NO_BASE;
}
/** Количество: прошлый ноль — «нет данных», а не «+100 %» */
export function countDelta(current: number, previous: number): Delta {
  return previous > 0 ? deltaPercent(current, previous) : NO_BASE;
}

export function DeltaMark({ delta, inverse }: { delta: Delta; inverse?: boolean }) {
  if (!delta.direction)
    return (
      <span className="kpi-delta kpi-delta--none">
        —<span className="sr-only"> {delta.text}</span>
      </span>
    );
  // у отмен, блокировок и мест без размещения рост — плохо: цвет переворачивается, стрелка — нет
  const tone =
    delta.direction === 'flat' ? 'flat' : (delta.direction === 'up') !== !!inverse ? 'up' : 'down';
  return (
    <span className={cx('kpi-delta', `kpi-delta--${tone}`)}>
      {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'}{' '}
      {delta.text.replace(/^[+−]/, '')}
    </span>
  );
}

export function Tile({
  id,
  label,
  value,
  hint,
  delta,
  inverse,
  compare,
}: {
  id: string;
  label: string;
  value: string;
  hint: React.ReactNode;
  delta: Delta;
  inverse?: boolean;
  compare: boolean;
}) {
  return (
    <article className={`kpi kpi--${id}`}>
      <div className="kpi__top">
        <span>{label}</span>
      </div>
      <div className="kpi__body">
        <strong className="kpi__value" data-testid={`pa-kpi-${id}`}>
          {value}
        </strong>
      </div>
      <div className="kpi__hint">{hint}</div>
      {compare && <DeltaMark delta={delta} {...(inverse ? { inverse } : {})} />}
    </article>
  );
}
