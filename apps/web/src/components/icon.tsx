import type { SVGProps } from 'react';

const paths = {
  today: 'M4 5h16v15H4z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M8 17h6',
  board: 'M3 4h18v16H3z M3 9h18 M8 4v16 M14 4v16 M3 14h18',
  guests:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  rates: 'M3 3h8l10 10-8 8L3 11z M7 7h.01',
  money: 'M3 6h18v14H3z M3 10h18 M16 15h2 M6 3h12',
  inventory: 'M3 21V3h12v18 M15 9h6v12 M7 7h4 M7 11h4 M7 15h4 M7 21v-3h4v3',
  channels: 'M12 3v6 M5 15v-3h14v3 M12 9v3 M2 15h6v6H2z M16 15h6v6h-6z M9 3h6',
  journal: 'M6 3h14v18H6z M3 7h5 M3 12h5 M3 17h5 M11 8h5 M11 12h5 M11 16h3',
  incidents: 'M12 3 2 21h20L12 3z M12 9v5 M12 17h.01',
  analytics: 'M4 3v18h17 M8 16v-5 M13 16V6 M18 16v-8',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  close: 'M6 6l12 12 M18 6 6 18',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
