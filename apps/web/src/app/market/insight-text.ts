import type { MarketInsight } from '../../lib/api';
import { formatOccupancy } from '@pms/domain';
import { displayDate } from '../../lib/display-date';
import { countLabel, intlLocale, msg, translator, type DeskLocale, type Translate } from '../../i18n';

/** Проценты подсказок: целые, как в таблице рынка. Хранится точнее (базисные пункты) */
const pct = (bp: number | null) => (bp === null ? '–' : formatOccupancy(Math.round(bp / 100) * 100));
const range = (i: { from: string; to: string }, locale: DeskLocale) => {
  const il = intlLocale(locale);
  return i.from === i.to
    ? displayDate(i.from, 'short', il)
    : `${displayDate(i.from, 'short', il)} → ${displayDate(i.to, 'short', il)}`;
};

/** Слова подсказки (ADR-142 п. 4): что видно на рынке и что с этим сделать; цены человек меняет сам */
export function insightText(
  i: MarketInsight,
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): { title: string; text: string; tone: 'warn' | 'ok' | 'info' } {
  const nights = countLabel(locale, t, i.nights, [msg('ночь'), msg('ночи'), msg('ночей')]);
  const market = i.marketBp === null ? '' : t('рынок {pct}', { pct: pct(i.marketBp) });
  const own = i.ownBp === null ? '' : t(', у вас {pct}', { pct: pct(i.ownBp) });
  const facts = { market, own, nights, range: range(i, locale) };
  switch (i.kind) {
    case 'high-behind':
      return {
        title: t('Рынок почти полон, у вас есть места: {range}', facts),
        text: t('{market}{own} ({nights}). Соседи распроданы: цену на эти даты можно поднять.', facts),
        tone: 'warn',
      };
    case 'high':
      return {
        title: t('Высокий спрос: {range}', facts),
        text: t('{market}{own} ({nights}). Проверьте, что ваша цена не ниже рынка.', facts),
        tone: 'info',
      };
    case 'low-ahead':
      return {
        title: t('Вы продаёте лучше рынка: {range}', facts),
        text: t('{market}{own} ({nights}). Цену держите, скидка не нужна.', facts),
        tone: 'ok',
      };
    case 'low':
      return {
        title: t('Спрос слабый: {range}', facts),
        text: t('{market}{own} ({nights}). Подумайте об акции или промокоде на эти даты.', facts),
        tone: 'info',
      };
    case 'missing':
      return {
        title: t('Нет данных: {names}', { names: i.competitors?.join(', ') ?? '' }),
        text: t('Внесите их загрузку, и средняя по рынку станет точнее.'),
        tone: 'info',
      };
  }
}

