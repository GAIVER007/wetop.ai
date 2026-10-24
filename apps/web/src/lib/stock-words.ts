import type { WebVertical } from './vertical-landing';
import { verticalCopy } from './vertical-copy';

/**
 * Слова склада по направлению. Решение владельца 24.10.2026: на складе у всех направлений «Бар» (товары на продажу) и
 * «Кухня» (продукты и материалы); у ресторана склад кухни зовётся «Склад кухни», потому что его «Кухня» уже экран
 * заказов. От аудита салона 22.10.2026 остаются только причины списания салона (без боя и угощения).
 */
export interface StockWords {
  /** вкладка и карточка склада товаров на продажу (/bar): «Бар» */
  goods: string;
  /** склад материалов (/bar/consumables или /stock у ресторана) */
  materials: string;
  /** заголовок экрана /bar */
  goodsTitle: string;
  /** подзаголовок «Обзора склада» */
  overviewSubtitle: string;
  /** пустой список «Что заканчивается» */
  overviewOk: string;
  /** слово позиции склада материалов для «Всего на складе: …» */
  materialsNoun: [string, string, string];
  /** причины списания */
  writeOffReasons: string[];
}

export function stockWords(vertical: WebVertical): StockWords {
  const goods = verticalCopy(vertical).menu.goods;
  const common = {
    goods,
    materials: vertical === 'FOOD_SERVICE' ? 'Склад кухни' : 'Кухня',
    goodsTitle: 'Склад: бар',
    overviewSubtitle: 'Остатки бара и кухни и что заканчивается',
    overviewOk: 'Остатки бара и кухни выше минимума.',
  };
  if (vertical === 'BEAUTY')
    return {
      ...common,
      materialsNoun: ['позиция', 'позиции', 'позиций'],
      writeOffReasons: ['Порча', 'Истек срок', 'Для работы салона', 'Иное'],
    };
  return {
    ...common,
    materialsNoun: ['продукт', 'продукта', 'продуктов'],
    writeOffReasons: ['Порча', 'Бой', 'Истек срок', 'Угощение', 'Нужды объекта', 'Иное'],
  };
}
