import type { Metadata } from 'next';
import { AiSellers } from '../components/landing/ai-sellers';
import { Audience } from '../components/landing/audience';
import { Company } from '../components/landing/company';
import { FAQ } from '../components/landing/faq';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { LatestPosts } from '../components/landing/latest-posts';
import { Market } from '../components/landing/market';
import { Sales } from '../components/landing/sales';
import { Start } from '../components/landing/start';
import { Team } from '../components/landing/team';
import { pageMetadata } from '../lib/metadata';
import styles from './home.module.css';

export const metadata: Metadata = pageMetadata({ path: '/' });

/* PUBLIC-2 first visual gate: header, Hero and verticals. Lower sections await owner approval. */
export default function HomePage() {
  return (
    <div className={styles.home}>
      <Hero />
      <Audience />
      <Features />
      {/* фишка №1 (ADR-142): загрузка конкурентов сразу за возможностями */}
      <Market />
      <Sales />
      <AiSellers />
      <Team />
      <Start />
      <FAQ />
      <Company />
      <LatestPosts />
    </div>
  );
}
