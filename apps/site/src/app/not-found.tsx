import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedPosts } from '../lib/posts';
import { typo } from '../components/typo';
import { getDictionary } from '../i18n';

const t = getDictionary();

export const metadata: Metadata = {
  title: t.notFound.title,
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <div className="container not-found__inner">
        <p className="not-found__code" aria-hidden="true">
          404
        </p>
        <h1 id="not-found-title" className="not-found__title">
          {t.notFound.title}
        </h1>
        <p className="not-found__text">{typo(t.notFound.text)}</p>
        <div className="not-found__actions">
          <Link className="btn btn--primary" href="/">
            {t.notFound.home}
          </Link>
          {getPublishedPosts().length > 0 ? (
            <Link className="btn btn--secondary" href="/blog/">
              {t.notFound.blog}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
