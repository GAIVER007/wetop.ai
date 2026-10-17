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
  'guest-houses': {
    vertical: 'HOSPITALITY',
    direction: 'hotels',
    photo: '/photos/guest-houses.jpg',
  },
  resorts: { vertical: 'HOSPITALITY', direction: 'hotels', photo: '/photos/resorts.jpg' },
  'daily-rentals': {
    vertical: 'HOSPITALITY',
    direction: 'hotels',
    photo: '/photos/daily-rentals.jpg',
  },
  glamping: { vertical: 'HOSPITALITY', direction: 'hotels', photo: '/photos/glamping.jpg' },
  sanatoriums: { vertical: 'HOSPITALITY', direction: 'hotels', photo: '/photos/sanatoriums.jpg' },
  'capsule-hotels': {
    vertical: 'HOSPITALITY',
    direction: 'hotels',
    photo: '/photos/capsule-hotels.jpg',
  },
  'beauty-salons': { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/salon.jpg' },
  barbershops: {
    vertical: 'BEAUTY',
    direction: 'salons',
    photo: '/photos/barbershop.jpg',
    preview: '/design-only/beauty-barbershop.svg',
  },
  spa: {
    vertical: 'BEAUTY',
    direction: 'salons',
    photo: '/photos/spa.jpg',
    preview: '/design-only/beauty-spa.svg',
  },
  'nail-studios': {
    vertical: 'BEAUTY',
    direction: 'salons',
    photo: '/photos/nails.jpg',
    preview: '/design-only/beauty-nails.svg',
  },
  'hair-salons': { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/hair-salons.jpg' },
  massage: {
    vertical: 'BEAUTY',
    direction: 'salons',
    photo: '/photos/massage.jpg',
    preview: '/design-only/beauty-massage.svg',
  },
  cosmetology: { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/cosmetology.jpg' },
  'brows-lashes': { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/brows-lashes.jpg' },
  epilation: { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/epilation.jpg' },
  tattoo: { vertical: 'BEAUTY', direction: 'salons', photo: '/photos/tattoo.jpg' },
  cafes: { vertical: 'FOOD_SERVICE', direction: 'restaurants', photo: '/photos/cafe.jpg' },
  bars: { vertical: 'FOOD_SERVICE', direction: 'restaurants', photo: '/photos/bar.jpg' },
  'coffee-shops': {
    vertical: 'FOOD_SERVICE',
    direction: 'restaurants',
    photo: '/photos/coffee-shops.jpg',
  },
  'hookah-lounges': {
    vertical: 'FOOD_SERVICE',
    direction: 'restaurants',
    photo: '/photos/hookah-lounges.jpg',
  },
  karaoke: { vertical: 'FOOD_SERVICE', direction: 'restaurants', photo: '/photos/karaoke.jpg' },
  pizzerias: { vertical: 'FOOD_SERVICE', direction: 'restaurants', photo: '/photos/pizzerias.jpg' },
  canteens: { vertical: 'FOOD_SERVICE', direction: 'restaurants', photo: '/photos/canteens.jpg' },
  'banquet-halls': {
    vertical: 'FOOD_SERVICE',
    direction: 'restaurants',
    photo: '/photos/banquet-halls.jpg',
  },
} as const satisfies Record<
  string,
  // preview: свой рисунок экрана для первого экрана подтипа (16.10.2026), иначе общий рисунок вертикали
  { vertical: BusinessVertical; direction: Direction; photo: string; preview?: string }
>;
export type Subtype = keyof typeof SUBTYPES;
export const SUBTYPE_SLUGS = Object.keys(SUBTYPES) as Subtype[];

export const subtypesOf = (direction: Direction): Subtype[] =>
  SUBTYPE_SLUGS.filter((slug) => SUBTYPES[slug].direction === direction);
