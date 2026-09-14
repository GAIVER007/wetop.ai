import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.APP_UI_TEST === '1' ? '.next-ui' : '.next',
  devIndicators: false,
  // Стойка на app.wetop.ai за туннелем Cloudflare (plans/wetop-domain-2026-09-14.md, Д5): версия сервера наружу не нужна
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Next сверяет Origin серверного действия с Host. cloudflared передаёт Host как есть, так что совпадёт и без
      // этого; список — страховка, если прокси когда-нибудь подменит Host (docs: config serverActions.allowedOrigins)
      allowedOrigins: ['app.wetop.ai'],
    },
  },
};

export default nextConfig;
