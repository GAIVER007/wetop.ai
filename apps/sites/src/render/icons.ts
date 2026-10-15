/**
 * Значки словаря `Icon` SiteSpec v0 §3: свои линейные SVG рантайма, в разметку встраиваются как есть, `aria-hidden`.
 * Это код WETOP, а не содержимое документа: документ выбирает только имя из словаря.
 */
const PATHS: Record<string, string> = {
  CLOCK: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  PARKING: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M10 17V7h3a3 3 0 0 1 0 6h-3"/>',
  WIFI: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
  BREAKFAST: '<path d="M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v4M12 3v4"/>',
  LAUNDRY: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.5"/><path d="M8 6h1"/>',
  LUGGAGE: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 11v5M15 11v5"/>',
  KITCHEN: '<path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v6M14 21V3c3 1 4 4 4 8h-4"/>',
  AIRCON: '<rect x="3" y="5" width="18" height="7" rx="2"/><path d="M7 16c0 2-1 3-2 4M12 16v5M17 16c0 2 1 3 2 4"/>',
  TRANSFER: '<path d="M4 16V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7z"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M4 11h16"/>',
  PETS: '<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><path d="M8 17a4 4 0 0 1 8 0c0 2-2 3-4 3s-4-1-4-3z"/>',
  ACCESSIBLE: '<circle cx="12" cy="4" r="1.6"/><path d="M8 8h8M12 8v6h4l2 5M12 14a5 5 0 1 0 4 6"/>',
  FAMILY: '<circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="6" r="2.5"/><circle cx="12" cy="13" r="2"/><path d="M4 21v-6a4 4 0 0 1 8 0M12 21v-4a4 4 0 0 1 8-2v6"/>',
  QUIET: '<path d="M20 15A8 8 0 1 1 9 4a6 6 0 0 0 11 11z"/>',
  CENTER: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  STATION: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 2M15 20l2 2M9 13h.01M15 13h.01"/>',
  STAR: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};

export const ICON_NAMES = Object.keys(PATHS);

export function icon(name: unknown): string {
  const paths = typeof name === 'string' ? PATHS[name] : undefined;
  if (!paths) throw new Error(`icon:${String(name)}`);
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}
