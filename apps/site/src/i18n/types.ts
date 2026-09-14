import type { IconName } from '../components/icon';

/**
 * Все тексты сайта. Новый язык (казахский, английский) = новый файл рядом с ru.ts того же типа и строка
 * в src/i18n/index.ts; компоненты тексты не хранят.
 */
export type Dictionary = {
  meta: {
    title: string;
    description: string;
    siteName: string;
  };
  a11y: {
    skipToContent: string;
    home: string;
    mainNav: string;
    footerNav: string;
    menu: string;
  };
  nav: {
    audience: string;
    features: string;
    start: string;
    blog: string;
    login: string;
    trial: string;
  };
  hero: {
    badge: string;
    title: string;
    lead: string;
    points: string[];
  };
  mockup: {
    label: string;
    title: string;
    views: string[];
    weekdays: string[];
    rooms: string;
    beds: string;
    room: string;
    bed: string;
    fromDesk: string;
    checkedIn: string;
    unassigned: string;
    toastTitle: string;
    toastText: string;
  };
  audience: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ icon: IconName; title: string; text: string }>;
  };
  features: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ icon: IconName; title: string; text: string; tags?: string[] }>;
  };
  start: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: Array<{ title: string; text: string }>;
    ctaTitle: string;
    ctaText: string;
    contactsLabel: string;
  };
  company: {
    eyebrow: string;
    city: string;
    email: string;
    phone: string;
  };
  blog: {
    title: string;
    lead: string;
    latestEyebrow: string;
    latestTitle: string;
    all: string;
    empty: string;
    back: string;
  };
  footer: {
    tagline: string;
  };
  notFound: {
    title: string;
    text: string;
    home: string;
    blog: string;
  };
};
