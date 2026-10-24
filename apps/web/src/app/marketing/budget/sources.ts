import type { MarketingResultsView, MetaConnectionView } from '../../../lib/api';
import { countLabel, msg, translator, type DeskLocale, type Translate } from '../../../i18n';
import { platformLabel } from './parts';

/**
 * Блок «Откуда берутся цифры» сводки «Бюджет и аналитика» (поручение владельца 20.10.2026: чётко показать, как
 * добавлять источники расходов и остального). По каждому источнику: состояние словами и действие, которое его
 * включает. Чистый расчёт, своих запросов нет: экран передаёт уже прочитанные ответы API.
 */
export type SourceState = 'ok' | 'todo' | 'error' | 'off' | 'manual';
export type SourceAction = 'add-expense' | 'import-csv' | 'journal' | 'connect-meta' | 'open-ads' | 'open-analytics';

export interface DataSource {
  key: 'manual' | 'meta' | 'results' | 'other-ads';
  title: string;
  state: SourceState;
  status: string;
  /** Что даёт источник и как его пополнять, одной-двумя фразами */
  text: string;
  actions: SourceAction[];
}

export function dataSources(input: {
  /** Строк расхода в журнале за месяц, всех */
  expenses: number;
  /** Рекламные площадки без кабинета, у которых есть ручной расход (кроме Meta) */
  otherAds: string[];
  meta: MetaConnectionView | 'error';
  results: MarketingResultsView | 'error';
  editable: boolean;
  /** Язык человека; без него русский */
  locale?: DeskLocale;
  t?: Translate;
}): DataSource[] {
  const { editable } = input;
  const locale = input.locale ?? 'ru';
  const t = input.t ?? translator(locale);
  const manual: DataSource =
    input.expenses > 0
      ? {
          key: 'manual',
          title: t('Расходы вручную'),
          state: 'ok',
          status: t('{n} за месяц', { n: countLabel(locale, t, input.expenses, [msg('расход'), 'расхода', msg('расходов')]) }), // kk-allow: форма склонения
          text: t('Всё, что оплачено: реклама, блогеры, креативы, сервисы. Каждый платёж одной строкой с каналом; выписку из банка или Excel можно загрузить CSV-файлом.'),
          actions: editable ? ['add-expense', 'import-csv', 'journal'] : ['journal'],
        }
      : {
          key: 'manual',
          title: t('Расходы вручную'),
          state: 'todo',
          status: t('Расходов за месяц нет'),
          text: t('Начните отсюда: «Добавить расход» на каждый платёж (дата, канал, сумма) или загрузите CSV из банка или Excel. Без расходов цены обращения и окупаемости рекламы нет.'),
          actions: editable ? ['add-expense', 'import-csv', 'journal'] : ['journal'],
        };

  let meta: DataSource;
  const m = input.meta;
  if (m === 'error')
    meta = {
      key: 'meta',
      title: t('Кабинет Meta (Facebook и Instagram)'),
      state: 'error',
      status: t('Не удалось узнать'),
      text: t('Состояние кабинета не загрузилось. Откройте «Рекламу» или обновите страницу.'),
      actions: ['open-ads'],
    };
  else if (!m.configured)
    meta = {
      key: 'meta',
      title: t('Кабинет Meta (Facebook и Instagram)'),
      state: 'off',
      status: t('Пока недоступно'),
      text: t('Подключение появится, когда платформа включит приложение Meta. До тех пор расход Meta вносите вручную.'),
      actions: [],
    };
  else if (!m.connection)
    meta = {
      key: 'meta',
      title: t('Кабинет Meta (Facebook и Instagram)'),
      state: 'todo',
      status: t('Не подключён'),
      text: t('Подключите один раз через вход Facebook: расход, показы и лиды кампаний будут приходить сами каждую ночь.'),
      actions: editable ? ['connect-meta'] : [],
    };
  else if (m.connection.status === 'FAILED')
    meta = {
      key: 'meta',
      title: t('Кабинет Meta (Facebook и Instagram)'),
      state: 'error',
      status: t('Нужно подключить заново'),
      text: m.connection.lastError
        ? t('Сверка остановилась: {error}. Подключите кабинет заново через Facebook.', { error: m.connection.lastError })
        : t('Сверка остановилась. Подключите кабинет заново через Facebook.'),
      actions: editable ? ['connect-meta'] : ['open-ads'],
    };
  else
    meta = {
      key: 'meta',
      title: t('Кабинет Meta (Facebook и Instagram)'),
      state: 'ok',
      status: t('Подключён: {account}, {currency}', {
        account: m.connection.accountName ?? m.connection.adAccountId,
        currency: m.connection.currency,
      }),
      text: t('Расход и лиды кампаний приходят сами каждую ночь. Оплату счёта Meta из банка вносите в расходы вручную: в сводке эти числа стоят отдельно и не складываются.'),
      actions: ['open-ads'],
    };

  let results: DataSource;
  const r = input.results;
  if (r === 'error')
    results = {
      key: 'results',
      title: t('Заявки и выручка'),
      state: 'error',
      status: t('Не загрузились'),
      text: t('Результаты каналов не загрузились. Обновите страницу.'),
      actions: ['open-analytics'],
    };
  else if (!r.supported)
    results = {
      key: 'results',
      title: t('Заявки и выручка'),
      state: 'off',
      status: t('Пока недоступно'),
      text: t('Заявки и выручка по каналам пока считаются по броням гостиницы. Для салона и ресторана появятся со своими записями и заказами; расходы уже видны.'),
      actions: [],
    };
  else
    results = {
      key: 'results',
      title: t('Заявки и выручка'),
      state: 'ok',
      status: t('Подтягиваются сами'),
      text: t('Добавлять ничего не нужно: брони, заявки с сайта и диалоги ИИ-продавца по каналам сайт, WhatsApp, Instagram и телефон. Канал брони это её источник.'),
      actions: ['open-analytics'],
    };

  const list = [manual, meta, results];
  if (input.otherAds.length > 0)
    list.push({
      key: 'other-ads',
      title: t('Другая реклама'),
      state: 'manual',
      status: t('Только вручную'),
      text: t(
        '{platforms}: кабинеты не подключаются, расход вносите в расходы вручную. Заявки и окупаемость рекламы у них появятся, когда брони начнут нести метку кампании.',
        { platforms: input.otherAds.map((p) => t(platformLabel(p))).join(', ') },
      ),
      actions: [],
    });
  return list;
}
