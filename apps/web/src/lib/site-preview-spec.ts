import { promptSiteSpec, templateSiteSpec } from '@pms/domain';
import type { SiteFacts } from './site-facts';

/**
 * Документ мини-превью карточки шаблона (SITE-1): ровно тот сайт, который создаст сервер по этому шаблону
 * (`templateSiteSpec` домена из фактов филиала), тем же рендером, что у опубликованного сайта (`apps/sites`), без ИИ.
 * Что видно на карточке, то и получится после «Создать сайт». Документ живёт только в браузере и никуда не сохраняется
 */
export function previewSpec(facts: SiteFacts, templateId: string): Record<string, unknown> | null {
  return inertSpec(templateSiteSpec(facts, templateId));
}

/** Превью сайта по промту (владелец 29.10.2026): тот же документ, что сохранит сервер, только без индексации */
export function promptPreviewSpec(facts: SiteFacts, prompt: string): Record<string, unknown> | null {
  return inertSpec(promptSiteSpec(facts, prompt, facts.location.id));
}

function inertSpec(spec: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!spec) return null;
  // превью не индексируется и без аналитики: это только картинка карточки
  const site = spec['site'] as Record<string, unknown>;
  site['seo'] = { ...(site['seo'] as Record<string, unknown>), robots: 'NOINDEX' };
  spec['integrations'] = { ...(spec['integrations'] as Record<string, unknown>), analytics: { mode: 'NONE', consent: 'NOT_REQUIRED' } };
  return spec;
}

/** В превью виджета брони и формы нет: служебные строки и кнопки внутри формы не показываем */
const PREVIEW_CSS = '#sec-booking p,#sec-booking .btn,#sec-form form{display:none}';
/**
 * Первый экран превью окрашен у глубоких шаблонов (NIGHT): без фото первые экраны всех шаблонов иначе выглядели бы
 * одинаково светлыми. Это только картинка карточки, документ сайта не меняется
 */
const DEEP_HERO_CSS =
  '.p-night .hero{background:var(--text);color:var(--bg)}.p-night .hero .lead{color:var(--border)}' +
  '.p-night .hero .btn{background:var(--bg);color:var(--text);border-color:var(--bg)}';

/**
 * Разметка превью без фокусируемого: ссылки становятся текстом с тем же классом, ссылка «к содержимому» и скрипты
 * убираются. Карточка выбирается целиком, внутри рамки нажимать нечего, и клавиатура в неё не попадает
 */
export function inertPreviewHtml(html: string): string {
  return html
    .replace('</head>', `<style>${PREVIEW_CSS}${DEEP_HERO_CSS}</style></head>`)
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<a class="skip"[^>]*>[\s\S]*?<\/a>/, '')
    .replace(/<a\b[^>]*?(\sclass="[^"]*")?[^>]*>/g, (_m, cls: string | undefined) => `<span${cls ?? ''}>`)
    .replace(/<\/a>/g, '</span>')
    .replace(/<(input|select|textarea|button)\b[^>]*>/g, '')
    .replace(/<\/(select|textarea|button)>/g, '');
}
