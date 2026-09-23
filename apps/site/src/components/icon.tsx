import type { ReactNode } from 'react';

/* Линейные иконки 24×24, цвет — currentColor. Декоративные: подпись всегда рядом текстом. */
const paths = {
  grid: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M3 14.75h18M8.5 4v16" />
      <path d="M11.5 12h5" strokeWidth="3" />
    </>
  ),
  guest: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  channels: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.3V5a1.5 1.5 0 0 1 1.5-1.5h7.3l8.4 8.4a1.5 1.5 0 0 1 0 2.1l-6.8 6.8a1.5 1.5 0 0 1-2.1 0Z" />
      <circle cx="8.25" cy="8.25" r="1.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21Z" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </>
  ),
  site: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M6.5 6.5h.01M9 6.5h.01" />
      <path d="M8 14.5h8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 19 6v5.2c0 4.4-2.9 8-7 9.8-4.1-1.8-7-5.4-7-9.8V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  migrate: (
    <>
      <path d="M4 8h13.5M14 4.5 17.5 8 14 11.5" />
      <path d="M20 16H6.5M10 12.5 6.5 16l3.5 3.5" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18.5V6M3 14h18v4.5M21 14v-1.5a3 3 0 0 0-3-3h-7.5V14" />
      <circle cx="6.75" cy="11" r="1.75" />
    </>
  ),
  building: (
    <>
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V21M15 9h2.5a1.5 1.5 0 0 1 1.5 1.5V21M3 21h18" />
      <path d="M8.5 7.5h3M8.5 11.5h3M8.5 15.5h3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l1.75 1.75" />
    </>
  ),
  article: (
    <>
      <path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20Z" />
      <path d="M13.5 3.5V8h4.5M9 12h6M9 16h6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  location: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z" />
    </>
  ),
  arrowDown: <path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5" />,
  spark: (
    <path d="M12 3.5c.9 4.2 2.3 5.6 6.5 6.5-4.2.9-5.6 2.3-6.5 6.5-.9-4.2-2.3-5.6-6.5-6.5 4.2-.9 5.6-2.3 6.5-6.5Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7.5 8 5.5 8-5.5" />
    </>
  ),
  phone: (
    <path d="M6.5 3.5h2.8l1.7 4.3-2.2 1.4a11 11 0 0 0 6 6l1.4-2.2 4.3 1.7v2.8a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
