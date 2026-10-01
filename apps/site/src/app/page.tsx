import type { Metadata } from 'next';
import { Audience } from '../components/landing/audience';
import { Company } from '../components/landing/company';
import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { LatestPosts } from '../components/landing/latest-posts';
import { Journey, FAQ } from '../components/landing/product-story';
import { About, Control } from '../components/landing/about';
import { Toolkit } from '../components/landing/toolkit';
import { ProductDetails, SellerDetails } from '../components/landing/product-details';
import { Start } from '../components/landing/start';
import { pageMetadata } from '../lib/metadata';
import styles from './home.module.css';

export const metadata: Metadata = pageMetadata({ path: '/' });

export default function HomePage() {
  return (
    <div className={styles.home}>
      <Hero />
      <About />
      <Audience />
      <Journey />
      <Features />
      <ProductDetails />
      <Toolkit />
      <SellerDetails />
      <Control />
      <FAQ />
      <Start />
      <Company />
      <LatestPosts />
    </div>
  );
}
