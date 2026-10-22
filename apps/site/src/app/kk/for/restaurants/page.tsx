import type { Metadata } from 'next';
import { RestaurantLanding, restaurantsDirectionMetadata } from '../../../for/restaurants/page';

/** Казахская страница направления (фаза 1, 21.10.2026): тот же компонент, словарь kk, hreflang на пару. */
export const metadata: Metadata = restaurantsDirectionMetadata('kk');

export default function RestaurantLandingKk() {
  return <RestaurantLanding locale="kk" />;
}
