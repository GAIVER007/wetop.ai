import type { Metadata } from 'next';
import { Audience } from '../components/landing/audience';
import { Company } from '../components/landing/company';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { LatestPosts } from '../components/landing/latest-posts';
import { Showcase } from '../components/landing/showcase';
import { Start } from '../components/landing/start';
import { Stats } from '../components/landing/stats';
import { Toolkit } from '../components/landing/toolkit';
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
      <Showcase />
      <Audience />
      <Features />
      <Toolkit />
      <Start />
      <Company />
      <LatestPosts />
    </>
  );
}
