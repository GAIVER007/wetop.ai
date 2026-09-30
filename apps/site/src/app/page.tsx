import type { Metadata } from 'next';
import { Audience } from '../components/landing/audience';
import { Company } from '../components/landing/company';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { LatestPosts } from '../components/landing/latest-posts';
import { Journey, FAQ } from '../components/landing/product-story';
import { Showcase } from '../components/landing/showcase';
import { Toolkit } from '../components/landing/toolkit';
import { ProductDetails, SellerDetails } from '../components/landing/product-details';
import { Start } from '../components/landing/start';
import { pageMetadata } from '../lib/metadata';

export const metadata: Metadata = pageMetadata({ path: '/' });

export default function HomePage() {
  return (
    <>
      <Hero />
      <Journey />
      <Features />
      <Showcase />
      <ProductDetails />
      <Audience />
      <Toolkit />
      <SellerDetails />
      <FAQ />
      <Start />
      <Company />
      <LatestPosts />
    </>
  );
}
