import type { Metadata } from 'next';
import { SalonLanding, salonsDirectionMetadata } from '../../../for/salons/page';

/** Казахская страница направления (фаза 1, 21.10.2026): тот же компонент, словарь kk, hreflang на пару. */
export const metadata: Metadata = salonsDirectionMetadata('kk');

export default function SalonLandingKk() {
  return <SalonLanding locale="kk" />;
}
