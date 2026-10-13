import localFont from 'next/font/local';

/**
 * Шрифт стойки: Inter 4.001 (OFL), решение владельца 13.10.2026 (ADR-179, DESIGN.md §6). Один файл
 * из репозитория, без запроса к Google при сборке: латиница с Latin-1, кириллица целиком (казахские
 * Ә Ғ Қ Ң Ө Ұ Ү Һ І), знаки ₸ № ⌘, стрелки и пунктуация; ось веса 100–900, оптический размер
 * закреплён на 14. Как пересобрать: `apps/web/src/app/fonts/README.md`.
 */
export const inter = localFont({
  src: './fonts/inter-wetop.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});
