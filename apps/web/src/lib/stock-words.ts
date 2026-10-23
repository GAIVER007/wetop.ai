import type { WebVertical } from './vertical-landing';
import { verticalCopy } from './vertical-copy';

/**
 * Слова склада по направлению (аудит салона 22.10.2026 P1: «Склад: бар», «Остатки бара и кухни», причины «Бой»,
 * «Угощение» в салоне). Экраны склада общие, у салона склад товаров и расходников, у гостиницы и ресторана бар.
 */
export interface StockWords {
  /** вкладка и карточка склада товаров на продажу (/bar): «Бар» / «Товары» */
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
  if (vertical === 'BEAUTY')
    return {
      goods,
      materials: 'Расходники',
      goodsTitle: 'Склад: товары',
      overviewSubtitle: 'Остатки товаров и расходников и что заканчивается',
      overviewOk: 'Остатки товаров и расходников выше минимума.',
      materialsNoun: ['позиция', 'позиции', 'позиций'],
      writeOffReasons: ['Порча', 'Истек срок', 'Для работы салона', 'Иное'],
    };
  return {
    goods,
    materials: vertical === 'FOOD_SERVICE' ? 'Склад кухни' : 'Расходники',
    goodsTitle: 'Склад: бар',
    overviewSubtitle:
      vertical === 'FOOD_SERVICE' ? 'Остатки бара и кухни и что заканчивается' : 'Остатки бара и расходников и что заканчивается',
    overviewOk:
      vertical === 'FOOD_SERVICE' ? 'Остатки бара и кухни выше минимума.' : 'Остатки бара и расходников выше минимума.',
    materialsNoun: ['продукт', 'продукта', 'продуктов'],
    writeOffReasons: ['Порча', 'Бой', 'Истек срок', 'Угощение', 'Нужды объекта', 'Иное'],
  };
}
