import Link from 'next/link';
import { getDictionary } from '../../i18n';
import { getPublishedPosts } from '../../lib/posts';
import { Icon } from '../icon';
import { PostCard } from '../post-card';

/** Три последние опубликованные статьи; нет статей — нет раздела. */
export function LatestPosts() {
  const posts = getPublishedPosts().slice(0, 3);
  if (posts.length === 0) return null;

  const t = getDictionary();
  return (
    <section id="blog" className="section" aria-labelledby="blog-title">
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
        <div className="post-grid">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
