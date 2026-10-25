import { countLabel, msg, translator, type DeskLocale, type Translate } from '../../../i18n';

/** Состояние уборки номера: из сводки фонда, `DIRTY` значит ещё не убран */
export type Housekeeping = Record<string, 'DIRTY' | 'CLEAN' | 'INSPECTED'>;

export interface RoomChoice {
  code: string;
  name: string;
  capacity: number;
  free: number;
  /** вмещает ли номер категории столько гостей */
  fits: boolean;
  /** почему не подходит: «до 1 гостя» */
  why: string;
  units: Array<{ code: string; dirty: boolean }>;
}

const byNumber = (a: string, b: string) =>
  a.localeCompare(b, 'ru-RU', { numeric: true, sensitivity: 'base' });

/**
 * Свободные номера справа в окне брони (решение владельца 23.10.2026, вариант B): по категориям, номера по
 * порядку чисел, неубранный отмечен. Категория, которая не вмещает гостей, остаётся видна серой с причиной.
 */
export function roomChoices(
  categories: ReadonlyArray<{
    code: string;
    name: string;
    capacityAdults: number;
    availableUnitCodes: string[];
  }>,
  { guests, housekeeping }: { guests: number; housekeeping: Housekeeping },
  locale: DeskLocale = 'ru',
  t: Translate = translator(locale),
): RoomChoice[] {
  return categories.map((c) => {
    const capacity = Math.max(1, c.capacityAdults);
    return {
      code: c.code,
      name: c.name,
      capacity,
      free: c.availableUnitCodes.length,
      fits: capacity >= guests,
      why: t('до {guests}', {
        guests: countLabel(locale, t, capacity, [msg('гостя'), 'гостей', msg('гостей')]), // kk-allow: форма склонения
      }),
      units: [...c.availableUnitCodes]
        .sort(byNumber)
        .map((code) => ({ code, dirty: housekeeping[code] === 'DIRTY' })),
    };
  });
}
