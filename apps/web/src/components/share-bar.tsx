/**
 * Доля полоской (MV8.5 DS1c, DESIGN.md §8.2). Родной `<progress>`: значение и предел читает
 * программа чтения, ширину рисует браузер, строки стиля нет. Число рядом по желанию, чтобы смысл не
 * держался на одной длине полосы. Тон по общей шкале (`neutral` без класса, цвет графика); смысл
 * держат имя и число, не цвет.
 */
export type ShareBarTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function ShareBar({
  label,
  value,
  max = 100,
  showValue,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: number;
  max?: number;
  showValue?: boolean;
  tone?: ShareBarTone;
  className?: string;
}) {
  const shown = Math.min(max, Math.max(0, value));
  const percent = max > 0 ? Math.round((shown / max) * 100) : 0;
  return (
    <span
      className={['share-bar', tone !== 'neutral' && `share-bar--tone-${tone}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      <progress className="share-bar__meter" value={shown} max={max} aria-label={label} />
      {showValue && <span className="share-bar__value">{percent} %</span>}
    </span>
  );
}
