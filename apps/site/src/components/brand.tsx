/* Знак WETOP: та же буква, что в apps/web/src/app/icon.svg, цвет — акцент темы, как в боковой панели стойки. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="13" />
      <path d="m10 14 5 21h5l4-13 4 13h5l5-21h-5l-3 14-4-14h-4l-4 14-3-14Z" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="brand">
      <BrandMark />
      <span className="brand__name">WETOP</span>
    </span>
  );
}
