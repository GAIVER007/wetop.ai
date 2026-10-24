import { countLabel, intlLocale, msg, translator, type DeskLocale, type Translate } from '../../i18n';
import { blockTypeLabel } from '../../lib/block-types';
import { displayDate } from '../../lib/display-date';

/** Язык подписей чистых модулей календаря (KK3): экран передаёт свой, тесты и прежние вызовы получают русский */
export interface Lang {
  t: Translate;
  locale: DeskLocale;
}

export const RU: Lang = { t: translator('ru'), locale: 'ru' };

const NIGHT_FORMS: [string, string, string] = [msg('ночь'), 'ночи', msg('ночей')]; // kk-allow: форма склонения

export const nightsLabel = (lang: Lang, n: number) => countLabel(lang.locale, lang.t, n, NIGHT_FORMS);

/** «27 сент.» на языке человека */
export const shortDate = (lang: Lang, iso: string) => displayDate(iso, 'short', intlLocale(lang.locale));

/** Слово типа блокировки из `lib/block-types` на языке человека */
export const blockLabel = (lang: Lang, type: string | null | undefined) => lang.t(blockTypeLabel(type));
