import { PRICES_JS } from './render/prices-script';
import { SITE_CSS } from './render/theme';

/** Неизменяемые файлы рантайма с хэшем содержимого в имени: долгий кэш безопасен, новая версия даёт новый адрес */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const CSS_PATH = `/_wetop/site-${fnv1a(SITE_CSS)}.css`;
export const PRICES_PATH = `/_wetop/prices-${fnv1a(PRICES_JS)}.js`;
