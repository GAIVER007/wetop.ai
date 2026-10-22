import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Manrope } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AuthDialog } from '../components/auth-dialog';
import { SiteMotion } from '../components/site-motion';
import motion from '../components/site-motion.module.css';
import { DevAgentation } from '../components/dev-agentation';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { getDictionary, localeInfo } from '../i18n';
import { TITLE_SEPARATOR, websiteOpenGraph } from '../lib/metadata';
import { assistantScriptSrc, resetLink, siteAuthEndpoint, siteUrl } from '../lib/site';
import { JsonLd } from '../components/json-ld';
import { absoluteUrl } from '../lib/site';
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
    verifyCode: siteAuthEndpoint('verify-code'),
    session: siteAuthEndpoint('session'),
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: t.meta.title, template: `%s${TITLE_SEPARATOR}${t.meta.siteName}` },
  twitter: { card: 'summary_large_image' },
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
      <body className={motion.motion}>
        <a className="skip-link" href="#content">
          {t.a11y.skipToContent}
        </a>
        <SiteHeader />
        <main id="content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        {/* Организация и сайт для поисковиков (schema.org): имя, адрес, контакт; цен и отзывов нет (§19.9) */}
        <JsonLd
          data={{
            '@graph': [
              {
                '@type': 'Organization',
                '@id': absoluteUrl('/#organization'),
                name: t.meta.siteName,
                url: absoluteUrl('/'),
                logo: absoluteUrl('/og.png'),
                email: siteConfig.company.email,
                address: { '@type': 'PostalAddress', addressLocality: siteConfig.company.city },
              },
              {
                '@type': 'WebSite',
                '@id': absoluteUrl('/#website'),
                name: t.meta.siteName,
                url: absoluteUrl('/'),
                inLanguage: localeInfo().htmlLang,
                publisher: { '@id': absoluteUrl('/#organization') },
              },
            ],
          }}
        />
        <AuthDialog texts={t.auth} urls={authUrls} />
        <noscript>
          <p>
            Для входа без JavaScript: <a href={authUrls.login}>Войти</a> или{' '}
            <a href={authUrls.register}>Получить доступ</a>.
          </p>
        </noscript>
        {/* Чат ИИ-помощника (ТЗ П2): анонимный, адрес — assistantUrl в site.config.ts */}
        {assistantSrc && <Script src={assistantSrc} />}
        <SiteMotion />
        <DevAgentation />
      </body>
    </html>
  );
}
