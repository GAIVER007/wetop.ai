import type { MarketInsight } from '../../lib/api';
import { formatOccupancy } from '@pms/domain';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';

/** Проценты подсказок: целые, как в таблице рынка. Хранится точнее (базисные пункты) */
const pct = (bp: number | null) => (bp === null ? '–' : formatOccupancy(Math.round(bp / 100) * 100));
const range = (i: { from: string; to: string }) =>
  i.from === i.to ? displayDate(i.from) : `${displayDate(i.from)} → ${displayDate(i.to)}`;

/** Слова подсказки (ADR-142 п. 4): что видно на рынке и что с этим сделать; цены человек меняет сам */
export function insightText(i: MarketInsight): { title: string; text: string; tone: 'warn' | 'ok' | 'info' } {
  const nights = pluralRu(i.nights, ['ночь', 'ночи', 'ночей']);
  const market = i.marketBp === null ? '' : `рынок ${pct(i.marketBp)}`;
  const own = i.ownBp === null ? '' : `, у вас ${pct(i.ownBp)}`;
  switch (i.kind) {
    case 'high-behind':
      return {
        title: `Рынок почти полон, у вас есть места: ${range(i)}`,
        text: `${market}${own} (${nights}). Соседи распроданы: цену на эти даты можно поднять.`,
        tone: 'warn',
      };
    case 'high':
      return {
        title: `Высокий спрос: ${range(i)}`,
        text: `${market}${own} (${nights}). Проверьте, что ваша цена не ниже рынка.`,
        tone: 'info',
      };
    case 'low-ahead':
      return {
        title: `Вы продаёте лучше рынка: ${range(i)}`,
        text: `${market}${own} (${nights}). Цену держите, скидка не нужна.`,
        tone: 'ok',
      };
    case 'low':
      return {
        title: `Спрос слабый: ${range(i)}`,
        text: `${market}${own} (${nights}). Подумайте об акции или промокоде на эти даты.`,
        tone: 'info',
      };
    case 'missing':
      return {
        title: `Нет данных: ${i.competitors?.join(', ')}`,
        text: 'Внесите их загрузку, и средняя по рынку станет точнее.',
        tone: 'info',
      };
  }
}

