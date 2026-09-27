import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.APP_UI_TEST === '1' ? '.next-ui' : '.next',
  devIndicators: false,
  // Стойка на app.wetop.ai за туннелем Cloudflare (plans/wetop-domain-2026-09-14.md, Д5): версия сервера наружу не нужна
  poweredByHeader: false,
  // ADR-107: сайт объекта собран в «Сайт и онлайн-бронирование». Старые адреса из закладок и документов ведут туда же
  // вместе с параметрами (?site, ?from, ?to). Временная (307), а не постоянная: браузер запоминает 308 навсегда, а
  // `/analytics` может понадобиться общей аналитике (ADR-105 переносит туда показатели за период с Главной).
  async redirects() {
    return [
      { source: '/analytics', destination: '/website/analytics', permanent: false },
      { source: '/analytics/setup', destination: '/website/settings', permanent: false },
    ];
  },
  experimental: {
    serverActions: {
      // Next сверяет Origin серверного действия с Host. cloudflared передаёт Host как есть, так что совпадёт и без
      // этого; список — страховка, если прокси когда-нибудь подменит Host (docs: config serverActions.allowedOrigins)
      allowedOrigins: ['app.wetop.ai'],
      // Документ знаний ИИ-продавца уходит серверным действием (ТЗ ред. 1 П6): продавец принимает до 10 МБ,
      // сверху — запас на разметку multipart (docs: config serverActions.bodySizeLimit). Остальным хватало 1 МБ.
      bodySizeLimit: '11mb',
    },
  },
};

export default nextConfig;
