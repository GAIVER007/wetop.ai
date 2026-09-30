/**
 * Тег виджета ИИ-помощника (ТЗ ред. 1, П2; docs/assistant/README.md §1):
 * `<script async src="{ASSISTANT_URL}/widget/widget.js" data-identity="{подпись}">`.
 *
 * Без зависимостей от сервера: этим же файлом пользуется клиентский сторож смены вошедшего.
 */

// Bump when shipping widget UI: CDN and browser caches otherwise keep the old script.
const WIDGET_PATH = '/widget/widget.js?v=20260930-support';

/** Адрес скрипта по `ASSISTANT_URL`. Пусто или не http(s) — `null`: тега нет, а не скрипт с чужой схемой */
export function assistantScriptSrc(base: string | undefined | null): string | null {
  const value = base?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${WIDGET_PATH}`;
}

export type AssistantScriptProps = { src: string; 'data-identity'?: string };

/** Атрибуты тега. Невошедшему `data-identity` нет совсем (ТЗ П2), а не пустой */
export function assistantScriptProps(
  base: string | undefined | null,
  identity: string | null,
): AssistantScriptProps | null {
  const src = assistantScriptSrc(base);
  if (!src) return null;
  return identity ? { src, 'data-identity': identity } : { src };
}

/**
 * Виджет читает подпись один раз при загрузке страницы, а вход и выход в стойке — мягкий переход без
 * перезагрузки. Хозяин работающего виджета запоминается при первой отрисовке; сменился (вход, выход, другой
 * человек) — страницу перезагружаем один раз, иначе следующий за стойкой видел бы диалог предыдущего.
 */
export function nextWidgetOwner(
  running: string | null,
  owner: string,
): { owner: string; reload: boolean } {
  if (running === null || running === owner) return { owner, reload: false };
  return { owner, reload: true };
}
