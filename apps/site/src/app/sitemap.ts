import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '../lib/posts';
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
    ...(['hostels', 'mini-hotels', 'apart-hotels'] as const).map((slug) => ({
      url: absoluteUrl(`/for/${slug}/`),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
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
