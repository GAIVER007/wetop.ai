import type { Metadata } from 'next';
import { HotelLanding, hotelsDirectionMetadata } from '../../../for/hotels/page';

/** Казахская страница направления (фаза 1, 21.10.2026): тот же компонент, словарь kk, hreflang на пару. */
export const metadata: Metadata = hotelsDirectionMetadata('kk');

export default function HotelLandingKk() {
  return <HotelLanding locale="kk" />;
}
