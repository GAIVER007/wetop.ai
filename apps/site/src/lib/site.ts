import type { BusinessVertical } from '../../../../packages/domain/src/verticals/registry';
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
 * Единая публичная точка входа — форма на главной продукта (ADR-131).
 */
export function loginLink(config: SiteConfig = siteConfig): SiteLink {
  return { href: `${siteUrl(config)}/#login`, external: false };
}

/**
 * «Регистрация»: форма самостоятельной регистрации стойки (ADR-147, 04.10.2026).
 */
export function registerLink(
  config: SiteConfig = siteConfig,
  vertical?: BusinessVertical,
): SiteLink {
  const url = new URL(siteUrl(config));
  if (vertical) url.searchParams.set('vertical', vertical);
  url.hash = 'register';
  return { href: url.toString(), external: false };
}

/** «Забыли пароль?» из окна входа — экран сброса стойки: письмо со ссылкой уходит оттуда (ADR-049). */
export function resetLink(config: SiteConfig = siteConfig): SiteLink {
  return { href: `${checkHttpUrl('appUrl', config.appUrl)}/login/reset`, external: true };
}

/** Какое окно открывает кнопка: вход или создание аккаунта (ADR-100). */
export type AuthMode = 'login' | 'register';

/**
 * Адрес стойки, куда окно входа и регистрации шлёт запрос (`apps/web/src/app/api/site-auth`, ADR-100).
 * Кука сессии ставится ответом стойки: сайт её не видит и ключа не получает.
 */
export function siteAuthEndpoint(
  action: 'options' | 'login' | 'register' | 'resend' | 'session',
  config: SiteConfig = siteConfig,
): string {
  return `${checkHttpUrl('appUrl', config.appUrl)}/api/site-auth/${action}`;
}

/** Куда вести после входа: стойка называет путь сама (`next`), чужой адрес не принимаем — только путь от корня. */
export function appPath(next: unknown, config: SiteConfig = siteConfig): string {
  const path = typeof next === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : '/today';
  return `${checkHttpUrl('appUrl', config.appUrl)}${path}`;
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
