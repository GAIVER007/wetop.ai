import type { BusinessVertical } from '../../../../packages/domain/src/verticals/registry';

/*
 * Лендинги сайта одним списком (11.10.2026): из него собираются страницы типов бизнеса (`app/for/[segment]`),
 * sitemap.xml и ссылки подвала, поэтому новая страница не теряется ни в одном из трёх мест.
 */
export const DIRECTIONS = ['hotels', 'salons', 'restaurants'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const SUBTYPES = {
  hostels: { vertical: 'HOSPITALITY', direction: 'hotels', photo: '/photos/hostel.jpg' },
  'mini-hotels': { vertical: 'HOSPITALITY', direction: 'hotels', photo: '/photos/minihotel.jpg' },
  'apart-hotels': { vertical: 'HOSPITALITY', direction: 'hotels', photo: '/photos/aparthotel.jpg' },
  'beauty-salons': { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/salon.jpg' },
  barbershops: { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/barbershop.jpg' },
  spa: { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/spa.jpg' },
  'nail-studios': { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/nails.jpg' },
  cafes: { vertical: 'FOOD_SERVICE', direction: 'restaurants', photo: '/photos/cafe.jpg' },
  bars: { vertical: 'FOOD_SERVICE', direction: 'restaurants', photo: '/photos/bar.jpg' },
} as const satisfies Record<
  string,
  { vertical: BusinessVertical; direction: Direction; photo: string }
>;
export type Subtype = keyof typeof SUBTYPES;
export const SUBTYPE_SLUGS = Object.keys(SUBTYPES) as Subtype[];

export const subtypesOf = (direction: Direction): Subtype[] =>
  SUBTYPE_SLUGS.filter((slug) => SUBTYPES[slug].direction === direction);
