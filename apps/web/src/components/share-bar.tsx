/**
 * Доля полоской (MV8.5 DS1c, DESIGN.md §8.2). Родной `<progress>`: значение и предел читает
 * программа чтения, ширину рисует браузер, строки стиля нет. Число рядом по желанию, чтобы смысл не
 * держался на одной длине полосы.
 */
export function ShareBar({
  label,
  value,
  max = 100,
  showValue,
  className,
}: {
  label: string;
  value: number;
  max?: number;
  showValue?: boolean;
  className?: string;
}) {
  const shown = Math.min(max, Math.max(0, value));
  const percent = max > 0 ? Math.round((shown / max) * 100) : 0;
  return (
    <span className={className ? `share-bar ${className}` : 'share-bar'}>
      <progress className="share-bar__meter" value={shown} max={max} aria-label={label} />
      {showValue && <span className="share-bar__value">{percent} %</span>}
    </span>
  );
}
