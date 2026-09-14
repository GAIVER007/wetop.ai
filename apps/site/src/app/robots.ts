import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';

// Статическая сборка (output: 'export'): robots.txt считается один раз при `next build`.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
