/**
 * Код карточки товара из названия (бар и склад салона): латиница, цифры и дефис, не длиннее 24 знаков.
 * Общий для формы прихода, карточки на обзоре и серверного «Нового товара» (аудит 21.10.2026 п.2).
 */
const RU_LAT: Record<string, string> = {
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'ZH', з: 'Z', и: 'I', й: 'Y', к: 'K', // kk-allow: таблица транслитерации кода товара
  л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ф: 'F', х: 'H', ц: 'TS', // kk-allow: таблица транслитерации кода товара
  ч: 'CH', ш: 'SH', щ: 'SCH', ъ: '', ы: 'Y', ь: '', э: 'E', ю: 'YU', я: 'YA', // kk-allow: таблица транслитерации кода товара
};
export function suggestCode(name: string): string {
  const flat = [...name.toLowerCase()].map((ch) => RU_LAT[ch] ?? ch.toUpperCase()).join('');
  const code = flat.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/g, '');
  return code || 'TOVAR';
}

