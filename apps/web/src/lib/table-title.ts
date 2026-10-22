/**
 * Подпись стола: номер «7» читается как «Стол 7», а «Стол 2», «Столик у окна» или «Терраса 2» остаются как есть.
 * Аудит ресторана 22.10.2026: экраны добавляли слово ещё раз и выходило «Стол Стол 2».
 */
export function tableTitle(name: string): string {
  const title = name.trim();
  return /^стол/i.test(title) || !/^\d/.test(title) ? title : `Стол ${title}`;
}
