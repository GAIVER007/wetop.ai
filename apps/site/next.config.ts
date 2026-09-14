import type { NextConfig } from 'next';

// Главная wetop.ai — статический сайт (plans/wetop-domain-2026-09-14.md §5): `next build` кладёт готовые страницы
// в out/, их выкладывает Cloudflare Pages. Серверного кода нет — сайт живёт, даже когда Mac со стойкой выключен.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
