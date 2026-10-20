import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '../../../components/icon';
import { JsonLd, breadcrumbLd } from '../../../components/json-ld';
import { PostCard } from '../../../components/post-card';
import { typo } from '../../../components/typo';
import { getDictionary } from '../../../i18n';
import { formatPostDate } from '../../../lib/format';
import { renderMarkdown } from '../../../lib/markdown';
import { articleOpenGraph, pageMetadata } from '../../../lib/metadata';
import { getPublishedPost, getPublishedPosts, type Post } from '../../../lib/posts';
import { absoluteUrl } from '../../../lib/site';

/*
 * Один маршрут на список статей (/blog/) и статью (/blog/<slug>/). При `output: 'export'` Next останавливает сборку,
 * если generateStaticParams динамического маршрута вернул пустой список, а пока в блоге только черновик, опубликованных
 * статей ноль. Необязательный сегмент [[...slug]] всегда даёт хотя бы страницу списка — без страниц-заглушек в out/.
 */
export const dynamicParams = false;

type Props = { params: Promise<{ slug?: string[] }> };

type Page = { kind: 'index' } | { kind: 'post'; post: Post };

export function generateStaticParams(): Array<{ slug: string[] }> {
  return [{ slug: [] }, ...getPublishedPosts().map((post) => ({ slug: [post.slug] }))];
}

async function resolvePage(params: Props['params']): Promise<Page> {
  const { slug = [] } = await params;
  if (slug.length === 0) return { kind: 'index' };
  const [first] = slug;
  const post = slug.length === 1 && first ? getPublishedPost(first) : undefined;
  if (!post) notFound();
  return { kind: 'post', post };
}

/*
 * Картинка ссылки статьи: обрезка 1200×630 её первого фото (`public/og`, те же файлы, что у лендингов).
 * Нет обрезки, остаётся общая `og.png`. Считается при сборке, сайт статический.
 */
function postImage(body: string): string | undefined {
  const name = body.match(/\]\(\/photos\/([\w.-]+\.jpg)\)/)?.[1];
  return name && existsSync(join(process.cwd(), 'public/og', name)) ? `/og/${name}` : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getDictionary();
  const page = await resolvePage(params);
  if (page.kind === 'index') {
    return pageMetadata({ path: '/blog/', title: t.blog.title, description: t.blog.lead });
  }
  const { post } = page;
  const path = `/blog/${post.slug}/`;
  const image = postImage(post.body);
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: articleOpenGraph({
      path,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      ...(image ? { image } : {}),
    }),
    ...(image ? { twitter: { card: 'summary_large_image', images: [image] } } : {}),
  };
}

export default async function BlogPage({ params }: Props) {
  const page = await resolvePage(params);
  return page.kind === 'index' ? <BlogIndex /> : <BlogArticle post={page.post} />;
}

function BlogIndex() {
  const t = getDictionary();
  const posts = getPublishedPosts();
  return (
    <div className="page">
      <div className="container container--narrow">
        <header className="page-header">
          <h1 className="page-header__title">{t.blog.title}</h1>
          <p className="page-header__lead">{typo(t.blog.lead)}</p>
        </header>
        {posts.length === 0 ? (
          <div className="empty-state">
            <span className="icon-tile">
              <Icon name="article" />
            </span>
            <p className="empty-state__title">{t.blog.empty}</p>
          </div>
        ) : (
          <div className="post-list">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} headingLevel={2} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlogArticle({ post }: { post: Post }) {
  const t = getDictionary();
  return (
    <article className="page article">
      <JsonLd
        data={{
          '@graph': [
            {
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              dateModified: post.date,
              inLanguage: 'ru',
              image: absoluteUrl(postImage(post.body) ?? '/og.png'),
              mainEntityOfPage: absoluteUrl(`/blog/${post.slug}/`),
              author: { '@id': absoluteUrl('/#organization') },
              publisher: { '@id': absoluteUrl('/#organization') },
            },
            breadcrumbLd([
              { name: t.meta.siteName, path: '/' },
              { name: t.blog.title, path: '/blog/' },
              { name: post.title, path: `/blog/${post.slug}/` },
            ]),
          ],
        }}
      />
      <div className="container container--narrow">
        <Link className="link-back" href="/blog/">
          <Icon name="arrowLeft" size={18} />
          {t.blog.back}
        </Link>
        <header className="article__header">
          <h1 className="article__title">{typo(post.title)}</h1>
          <p className="article__lead">{typo(post.description)}</p>
          <time className="article__date" dateTime={post.date}>
            {formatPostDate(post.date)}
          </time>
        </header>
        {/* Статьи — файлы репозитория (content/blog), HTML собирается при `next build`. */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
      </div>
    </article>
  );
}
