export type StatusTone = 'success' | 'warning' | 'neutral';

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/**
 * Статус строки конкурента: свежесть внесённых данных (загрузка или цены, что новее). «Актуально» это сегодня или
 * вчера; старше суток это «Устарели»: цифрам нельзя верить, пока их не обновят. Нет данных вовсе это не ошибка.
 */
export function competitorStatus(
  today: string,
  occupancyOn: string | null,
  ratesOn: string | null,
): { tone: StatusTone; label: string } {
  const last = [occupancyOn, ratesOn].filter((d): d is string => d !== null).sort().at(-1) ?? null;
  if (!last) return { tone: 'neutral', label: 'Нет данных' };
  if (dayOf(today) - dayOf(last) <= 1) return { tone: 'success', label: 'Актуально' };
  return { tone: 'warning', label: `Устарели, с ${last.slice(8, 10)}.${last.slice(5, 7)}` };
}

/** 50 → «+5 %», −125 → «−12,5 %»; без сравнения это тире */
export function permilleText(permille: number | null): string {
  if (permille === null) return '–';
  if (permille === 0) return '0 %';
  const body = (Math.abs(permille) / 10).toFixed(1).replace('.0', '').replace('.', ',');
  return `${permille > 0 ? '+' : '−'}${body} %`;
}
