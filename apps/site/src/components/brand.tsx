/*
 * Знак WETOP: та же буква, что в apps/web/src/app/icon.svg. Плитка залита акцентным градиентом
 * направления «стекло», буква белая. `id` разный у каждого знака на странице: два одинаковых
 * `linearGradient id` в одном документе — невалидный HTML, и второй знак красится первым градиентом.
 */
export function BrandMark({ size = 34, id = 'brand' }: { size?: number; id?: string }) {
  const gradientId = `${id}-gradient`;
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-1)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} />
      {/* Заливка буквы — из `.brand__mark path` в globals.css: цвет живёт токеном, а не в разметке. */}
      <path d="m10 14 5 21h5l4-13 4 13h5l5-21h-5l-3 14-4-14h-4l-4 14-3-14Z" />
    </svg>
  );
}

export function Wordmark({
  id = 'brand',
  withDomain = false,
}: {
  id?: string;
  withDomain?: boolean;
}) {
  return (
    <span className="brand">
      <BrandMark id={id} />
      <span className="brand__name">WETOP{withDomain ? '.AI' : ''}</span>
    </span>
  );
}
