import Link from 'next/link';
import { formatPostDate } from '../lib/format';
import type { Post } from '../lib/posts';
import { typo } from './typo';

/** Карточка статьи: вся карточка кликабельна через ссылку в заголовке. */
export function PostCard({ post, headingLevel = 3 }: { post: Post; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="post-card">
      <Heading className="post-card__title">
        <Link href={`/blog/${post.slug}/`}>{typo(post.title)}</Link>
      </Heading>
      <time className="post-card__date" dateTime={post.date}>
        {formatPostDate(post.date)}
      </time>
      <p className="post-card__text">{typo(post.description)}</p>
    </article>
  );
}
