import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '../lib/posts';
import { DIRECTIONS, SUBTYPE_SLUGS } from '../lib/landings';
import { absoluteUrl } from '../lib/site';

// Статическая сборка (output: 'export'): sitemap.xml считается один раз при `next build`.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts();
  const latest = posts[0]?.date;
  return [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/privacy/'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/terms/'), changeFrequency: 'yearly', priority: 0.2 },
    {
      url: absoluteUrl('/blog/'),
      changeFrequency: 'weekly',
      priority: 0.7,
      ...(latest ? { lastModified: latest } : {}),
    },
    ...DIRECTIONS.map((slug) => ({
      url: absoluteUrl(`/for/${slug}/`),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...SUBTYPE_SLUGS.map((slug) => ({
      url: absoluteUrl(`/for/${slug}/`),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...DIRECTIONS.map((slug) => ({
      url: absoluteUrl(`/kk/for/${slug}/`),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...SUBTYPE_SLUGS.map((slug) => ({
      url: absoluteUrl(`/kk/for/${slug}/`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: absoluteUrl('/calculator/'), changeFrequency: 'monthly' as const, priority: 0.6 },
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}/`),
      lastModified: post.date,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
