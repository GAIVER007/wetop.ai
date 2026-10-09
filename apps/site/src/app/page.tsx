import type { Metadata } from 'next';
import { Audience } from '../components/landing/audience';
import { Company } from '../components/landing/company';
import { FAQ } from '../components/landing/faq';
import { Features } from '../components/landing/features';
import { FinalCta } from '../components/landing/final-cta';
import { Growth } from '../components/landing/growth';
import { Hero } from '../components/landing/hero';
import { LatestPosts } from '../components/landing/latest-posts';
import { Start } from '../components/landing/start';
import { Team } from '../components/landing/team';
import { pageMetadata } from '../lib/metadata';
import styles from './home.module.css';

export const metadata: Metadata = pageMetadata({ path: '/' });

/* LAND2 (09.10.2026): семь смысловых секций по ТЗ владельца; Company и LatestPosts только при данных. */
export default function HomePage() {
  return (
    <div className={styles.home}>
      <Hero />
      <Audience />
      <Features />
      <Growth />
      <Team />
      <Start />
      <FAQ />
      <FinalCta />
      <Company />
      <LatestPosts />
    </div>
  );
}
