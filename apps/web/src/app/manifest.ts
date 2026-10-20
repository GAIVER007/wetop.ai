import type { MetadataRoute } from 'next';
import { PWA_THEME } from '../lib/pwa';

/** Манифест стойки (PWA1): «Установить приложение» в Chrome, значок на экране телефона, запуск сразу на «Сегодня» */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WETOP',
    short_name: 'WETOP',
    description: 'Стойка WETOP: брони, гости, записи и заказы',
    lang: 'ru',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    theme_color: PWA_THEME.light,
    background_color: PWA_THEME.background,
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
