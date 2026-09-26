import { siteConfig, type SiteConfig } from '../site.config';

/** Ссылка, которую можно поставить в `href`; `external` — ведёт за пределы сайта. */
export type SiteLink = { href: string; external: boolean };

export type ContactLink = { kind: 'email' | 'phone'; href: string; label: string };

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

/**
 * «Войти» ведёт на экран входа стойки, а не в её корень: корень редиректом бросает в `/today`, и человек
 * проваливается сразу в рабочий день смены. На `/login` видно, под какой почтой пустил Cloudflare Access,
 * и есть выход (ADR-045, Д5).
 */
export function loginLink(config: SiteConfig = siteConfig): SiteLink {
  return { href: `${checkHttpUrl('appUrl', config.appUrl)}/login`, external: true };
}

/**
 * «Регистрация»: форма самостоятельной регистрации стойки, 7 дней пробного периода (ADR-095, 26.09.2026).
 * Раньше на её месте была заявка по почте: одна установка обслуживала одну гостиницу (ADR-056).
 */
export function registerLink(config: SiteConfig = siteConfig): SiteLink {
  return { href: `${checkHttpUrl('appUrl', config.appUrl)}/register`, external: true };
}

/**
 * Скрипт виджета ИИ-помощника (ТЗ П2): тот же, что в стойке, но без `data-identity` — посетитель главной аноним.
 * Пусто — чата нет; неверный адрес останавливает сборку, как и остальные ссылки настроек.
 */
export function assistantScriptSrc(config: SiteConfig = siteConfig): string | null {
  const value = config.assistantUrl.trim();
  if (!value) return null;
  return `${checkHttpUrl('assistantUrl', value)}/widget/widget.js`;
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
