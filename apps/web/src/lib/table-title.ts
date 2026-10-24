import { translator, type Translate } from '../i18n';

/**
 * Подпись стола: номер «7» читается как «Стол 7», а «Стол 2», «Столик у окна» или «Терраса 2» остаются как есть.
 * Аудит ресторана 22.10.2026: экраны добавляли слово ещё раз и выходило «Стол Стол 2».
 */
export function tableTitle(name: string, t: Translate = translator('ru')): string {
  const title = name.trim();
  return /^стол/i.test(title) || !/^\d/.test(title) ? title : t('Стол {n}', { n: title }); // kk-allow: сверка с названием стола (данные)
}

const byName = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** Порядок столов во всех списках: сначала sortOrder, потом название с учётом чисел (Стол 1, Стол 2, Стол 10) */
export function compareTables(a: { name: string; sortOrder: number }, b: { name: string; sortOrder: number }): number {
  return a.sortOrder - b.sortOrder || byName.compare(a.name, b.name);
}
