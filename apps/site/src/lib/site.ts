import { siteConfig, type SiteConfig } from '../site.config';

/** Ссылка, которую можно поставить в `href`; `external` — ведёт за пределы сайта. */
export type SiteLink = { href: string; external: boolean };

export type ContactLink = { kind: 'email' | 'phone'; href: string; label: string };

const START_ANCHOR = '/#start';

function fail(field: string, message: string): never {
  throw new Error(`apps/site/src/site.config.ts: ${field} — ${message}`);
}

function checkHttpUrl(field: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(field, `ожидается полный адрес вида https://…, сейчас «${value}»`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    fail(field, `ожидается адрес https://…, сейчас «${value}»`);
  }
  return value.replace(/\/+$/, '');
}

/** Адрес сайта без слеша в конце. */
export function siteUrl(config: SiteConfig = siteConfig): string {
  return checkHttpUrl('siteUrl', config.siteUrl);
}

/** Полный адрес страницы сайта: `absoluteUrl('/blog/')` → `https://wetop.ai/blog/`. */
export function absoluteUrl(path: string, config: SiteConfig = siteConfig): string {
  return new URL(path, `${siteUrl(config)}/`).toString();
}

export function loginLink(config: SiteConfig = siteConfig): SiteLink {
  return { href: checkHttpUrl('appUrl', config.appUrl), external: true };
}

/** «Попробовать бесплатно»: ссылка владельца, а пока её нет — раздел «Как начать». */
export function trialLink(config: SiteConfig = siteConfig): SiteLink {
  const value = config.trialHref.trim();
  if (!value) return { href: START_ANCHOR, external: false };
  if (/^(mailto|tel):\S+$/i.test(value)) return { href: value, external: true };
  return { href: checkHttpUrl('trialHref', value), external: true };
}

/** Задана ли у владельца ссылка на заявку (иначе кнопка в разделе «Как начать» не показывается). */
export function hasTrialHref(config: SiteConfig = siteConfig): boolean {
  return config.trialHref.trim() !== '';
}

/** Почта и телефон из настроек — только заполненные. */
export function contactLinks(config: SiteConfig = siteConfig): ContactLink[] {
  const links: ContactLink[] = [];
  const email = config.company.email.trim();
  const phone = config.company.phone.trim();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail('company.email', `не похоже на адрес почты: «${email}»`);
    links.push({ kind: 'email', href: `mailto:${email}`, label: email });
  }
  if (phone) {
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length < 5)
      fail('company.phone', `в номере меньше пяти цифр: «${phone}»`);
    links.push({ kind: 'phone', href: `tel:${digits}`, label: phone });
  }
  return links;
}

export function companyName(config: SiteConfig = siteConfig): string {
  return config.company.name.trim();
}
