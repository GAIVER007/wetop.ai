import { ru } from './ru';
import type { Dictionary } from './types';
import { hotelKk, hotelsItemsKk } from './kk-parts/hotels';
import { salonKk, beautyItemsKk } from './kk-parts/beauty';
import { restaurantKk, foodItemsKk } from './kk-parts/food';
import { segmentsSharedKk, marketingKk, miscKk } from './kk-parts/shared';

/*
 * Казахский словарь (фаза 1, 21.10.2026): полностью переведены ветки раздела «для кого» (направления,
 * 27 типов бизнеса, маркетинг-блок и общие строки этих страниц). Остальные ветки сознательно берутся из
 * русского словаря: у главной, блога и калькулятора казахских маршрутов пока нет, их переводить рано.
 * Тексты ждут вычитки носителем языка (правило MKT12 для казахских текстов).
 */
export const kk: Dictionary = {
  ...ru,
  hotel: hotelKk,
  salon: salonKk,
  restaurant: restaurantKk,
  marketing: marketingKk,
  segments: {
    ...segmentsSharedKk,
    previews: ru.segments.previews,
    items: { ...ru.segments.items, ...hotelsItemsKk, ...beautyItemsKk, ...foodItemsKk },
  },
  final: { ...ru.final, note: miscKk.finalNote },
  nav: { ...ru.nav, features: miscKk.navFeatures, register: miscKk.navRegister },
  a11y: {
    ...ru.a11y,
    breadcrumbs: miscKk.a11yBreadcrumbs,
    crumbHome: miscKk.a11yCrumbHome,
    switchToKk: miscKk.switchToKk,
    switchToRu: miscKk.switchToRu,
  },
  hero: { ...ru.hero, dash: { ...ru.hero.dash, label: miscKk.heroDashLabel } },
  calculator: { ...ru.calculator, link: miscKk.calculatorLink },
};
