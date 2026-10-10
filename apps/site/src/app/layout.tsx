import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Manrope } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AuthDialogLazy } from '../components/auth-dialog-lazy';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { getDictionary, localeInfo } from '../i18n';
import { websiteOpenGraph } from '../lib/metadata';
import { assistantScriptSrc, resetLink, siteAuthEndpoint, siteUrl } from '../lib/site';
import { siteConfig } from '../site.config';
import './tokens.css';
import './globals.css';

/*
 * Шрифты стойки WETOP (направление A): Manrope — заголовки, IBM Plex Sans — текст, IBM Plex Mono — код.
 * next/font кладёт файлы в сборку: страница не ходит за шрифтами к Google.
 */
const headingFont = Manrope({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-manrope',
  display: 'swap',
});
const bodyFont = IBM_Plex_Sans({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const monoFont = IBM_Plex_Mono({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});

const t = getDictionary();
const assistantSrc = assistantScriptSrc();
// Окно входа и создания аккаунта (ADR-100): адреса стойки считаются при сборке, клиенту настройки не передаются
const authUrls = {
  login: `${siteConfig.appUrl}/auth/fallback`,
  register: `${siteConfig.appUrl}/auth/fallback?mode=register`,
  reset: resetLink().href,
  app: siteConfig.appUrl.replace(/\/+$/, ''),
  endpoint: {
    options: siteAuthEndpoint('options'),
    login: siteAuthEndpoint('login'),
    register: siteAuthEndpoint('register'),
    resend: siteAuthEndpoint('resend'),
    session: siteAuthEndpoint('session'),
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: t.meta.title, template: `%s — ${t.meta.siteName}` },
  description: t.meta.description,
  applicationName: t.meta.siteName,
  openGraph: websiteOpenGraph({ path: '/' }),
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e6eef8' },
    { media: '(prefers-color-scheme: dark)', color: '#05070e' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={localeInfo().htmlLang}
      className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      // Плавная прокрутка — только к разделам на странице; переход на другую страницу Next делает сразу.
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#content">
          {t.a11y.skipToContent}
        </a>
        <SiteHeader />
        <main id="content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <AuthDialogLazy texts={t.auth} urls={authUrls} />
        <noscript>
          <p>
            Для входа без JavaScript: <a href={authUrls.login}>Войти</a> или{' '}
            <a href={authUrls.register}>Получить доступ</a>.
          </p>
        </noscript>
        {/* Чат ИИ-помощника (ТЗ П2): анонимный, адрес — assistantUrl в site.config.ts */}
        {assistantSrc && <Script src={assistantSrc} />}
      </body>
    </html>
  );
}
