import type { Metadata } from 'next';
import { AiSellers } from '../components/landing/ai-sellers';
import { Audience } from '../components/landing/audience';
import { Company } from '../components/landing/company';
import { Facts } from '../components/landing/facts';
import { FAQ } from '../components/landing/faq';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { LatestPosts } from '../components/landing/latest-posts';
import { Market } from '../components/landing/market';
import { MobileHomeNav } from '../components/landing/mobile-home-nav';
import { Sales } from '../components/landing/sales';
import { Start } from '../components/landing/start';
import { Team } from '../components/landing/team';
import { pageMetadata } from '../lib/metadata';
import styles from './home.module.css';

export const metadata: Metadata = pageMetadata({ path: '/' });

/*
 * Главная: восемь блоков в порядке вопросов посетителя (plans/site-home-clear-blocks-2026-10-01.md).
 * Что это → для кого → что умеет → загрузка конкурентов → откуда брони → ИИ-продавец → команда → как начать → вопросы.
 * Между первым экраном и блоками стоит полоса фактов «что это даёт» (plans/site-home-clarity-2026-10-02.md).
 * Каждый блок виден целиком, без вкладок; у каждого надзаголовок и заголовок словами. Порядок и заголовки
 * проверяет tests/site/homepage-blocks.spec.ts. `styles.home` ограничивает композицию главной (ADR-132):
 * прочие страницы остаются стеклянными.
 */
export default function HomePage() {
  return (
    <div className={styles.home}>
      <Hero />
      <Facts />
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
      <MobileHomeNav />
    </div>
  );
}
