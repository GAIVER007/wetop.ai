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
 * Порядок разделов: первый экран о платформе, затем направления (Hospitality работает, Beauty — следующее),
 * дальше всё про Hospitality — полоса чисел, витрина экранов, возможности, три колонки «из чего собрана»;
 * шаги и призыв, компания и блог (позиционирование 29.09.2026, ADR-104).
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Audience />
      <Stats />
      <Showcase />
      <Features />
      <Toolkit />
      <Start />
      <Company />
      <LatestPosts />
    </>
  );
}
