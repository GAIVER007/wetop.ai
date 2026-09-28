import type { Metadata } from 'next';
import { Audience } from '../components/landing/audience';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import {
  AiSeller,
  CoreTasks,
  DirectBooking,
  FinalCta,
  Finance,
  Integrations,
  Migration,
  Pricing,
  WhyWetop,
} from '../components/landing/product-sections';
import { Showcase } from '../components/landing/showcase';
import { Start } from '../components/landing/start';
import { Stats } from '../components/landing/stats';
import { pageMetadata } from '../lib/metadata';

export const metadata: Metadata = pageMetadata({ path: '/' });

/*
 * Порядок разделов повторяет направление «стекло»: первый экран, полоса чисел, витрина экранов,
 * затем для кого и что умеет система, три колонки «из чего собрана», шаги и призыв, компания и блог.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <CoreTasks />
      <Showcase />
      <Audience />
      <Features />
      <Integrations />
      <DirectBooking />
      <AiSeller />
      <Finance />
      <WhyWetop />
      <Migration />
      <Start />
      <Pricing />
      <FinalCta />
    </>
  );
}
