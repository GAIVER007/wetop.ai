import type { Metadata } from 'next';
import { Audience } from '../components/landing/audience';
import { Company } from '../components/landing/company';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { LatestPosts } from '../components/landing/latest-posts';
import { Start } from '../components/landing/start';
import { pageMetadata } from '../lib/metadata';

export const metadata: Metadata = pageMetadata({ path: '/' });

export default function HomePage() {
  return (
    <>
      <Hero />
      <Audience />
      <Features />
      <Start />
      <Company />
      <LatestPosts />
    </>
  );
}
