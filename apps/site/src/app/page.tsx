import type { Metadata } from 'next';
import { Audience } from '../components/landing/audience';
import { Hero } from '../components/landing/hero';
import {
  AiSeller,
  FinalCta,
  Finance,
  Launch,
  Pricing,
  SalesEcosystem,
} from '../components/landing/product-sections';
import { Showcase } from '../components/landing/showcase';
import { pageMetadata } from '../lib/metadata';

export const metadata: Metadata = pageMetadata({ path: '/' });

export default function HomePage() {
  return (
    <>
      <Hero />
      <Audience />
      <Showcase />
      <SalesEcosystem />
      <AiSeller />
      <Finance />
      <Launch />
      <Pricing />
      <FinalCta />
    </>
  );
}
