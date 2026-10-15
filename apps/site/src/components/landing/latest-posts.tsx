import Link from 'next/link';
import Image from 'next/image';
import styles from './latest-posts.module.css';
import { getDictionary } from '../../i18n';
import { getPublishedPosts } from '../../lib/posts';
import { Icon } from '../icon';
import { PostCard } from '../post-card';

const COVERS: Partial<Record<string, string>> = {
  'kak-vybrat-pms-dlya-khostela': '/photos/hotel.jpg',
  'kak-vesti-zapisi-v-salone-krasoty': '/photos/salon.jpg',
  'kak-prinimat-broni-stolov-v-restorane': '/photos/restaurant.jpg',
};

/** Три последние опубликованные статьи; нет статей — нет раздела. */
export function LatestPosts() {
  const posts = getPublishedPosts().slice(0, 3);
  if (posts.length === 0) return null;

  const t = getDictionary();
  return (
    <section id="blog" className={`section ${styles.section}`} aria-labelledby="blog-title">
      <div className="container">
        <div className="section-heading section-heading--row">
          <div>
            <p className="eyebrow">{t.blog.latestEyebrow}</p>
            <h2 id="blog-title" className="section-heading__title">
              {t.blog.latestTitle}
            </h2>
          </div>
          <Link className="link-arrow" href="/blog/">
            {t.blog.all}
            <Icon name="arrowRight" size={18} />
          </Link>
        </div>
        <div className={`post-grid ${styles.grid}`}>
          {posts.map((post) => (
            <div className={styles.story} key={post.slug}>
              {COVERS[post.slug] ? (
                <Image
                  className={styles.cover}
                  src={COVERS[post.slug]!}
                  alt=""
                  width={1184}
                  height={864}
                  loading="lazy"
                />
              ) : null}
              <PostCard post={post} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
