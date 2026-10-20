import type { MarketingResultsView, MetaConnectionView } from '../../../lib/api';
import { pluralRu } from '../../../lib/plural';
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
}): DataSource[] {
  const { editable } = input;
  const manual: DataSource =
    input.expenses > 0
      ? {
          key: 'manual',
          title: 'Расходы вручную',
          state: 'ok',
          status: `${pluralRu(input.expenses, ['расход', 'расхода', 'расходов'])} за месяц`,
          text: 'Всё, что оплачено: реклама, блогеры, креативы, сервисы. Каждый платёж одной строкой с каналом; выписку из банка или Excel можно загрузить CSV-файлом.',
          actions: editable ? ['add-expense', 'import-csv', 'journal'] : ['journal'],
        }
      : {
          key: 'manual',
          title: 'Расходы вручную',
          state: 'todo',
          status: 'Расходов за месяц нет',
          text: 'Начните отсюда: «Добавить расход» на каждый платёж (дата, канал, сумма) или загрузите CSV из банка или Excel. Без расходов цены заявки и ROMI нет.',
          actions: editable ? ['add-expense', 'import-csv', 'journal'] : ['journal'],
        };

  let meta: DataSource;
  const m = input.meta;
  if (m === 'error')
    meta = {
      key: 'meta',
      title: 'Кабинет Meta (Facebook и Instagram)',
      state: 'error',
      status: 'Не удалось узнать',
      text: 'Состояние кабинета не загрузилось. Откройте «Рекламу» или обновите страницу.',
      actions: ['open-ads'],
    };
  else if (!m.configured)
    meta = {
      key: 'meta',
      title: 'Кабинет Meta (Facebook и Instagram)',
      state: 'off',
      status: 'Пока недоступно',
      text: 'Подключение появится, когда платформа включит приложение Meta. До тех пор расход Meta вносите вручную.',
      actions: [],
    };
  else if (!m.connection)
    meta = {
      key: 'meta',
      title: 'Кабинет Meta (Facebook и Instagram)',
      state: 'todo',
      status: 'Не подключён',
      text: 'Подключите один раз через вход Facebook: расход, показы и лиды кампаний будут приходить сами каждую ночь.',
      actions: editable ? ['connect-meta'] : [],
    };
  else if (m.connection.status === 'FAILED')
    meta = {
      key: 'meta',
      title: 'Кабинет Meta (Facebook и Instagram)',
      state: 'error',
      status: 'Нужно подключить заново',
      text: `Сверка остановилась${m.connection.lastError ? `: ${m.connection.lastError}` : ''}. Подключите кабинет заново через Facebook.`,
      actions: editable ? ['connect-meta'] : ['open-ads'],
    };
  else
    meta = {
      key: 'meta',
      title: 'Кабинет Meta (Facebook и Instagram)',
      state: 'ok',
      status: `Подключён: ${m.connection.accountName ?? m.connection.adAccountId}, ${m.connection.currency}`,
      text: 'Расход и лиды кампаний приходят сами каждую ночь. Оплату счёта Meta из банка вносите в расходы вручную: в сводке эти числа стоят отдельно и не складываются.',
      actions: ['open-ads'],
    };

  let results: DataSource;
  const r = input.results;
  if (r === 'error')
    results = {
      key: 'results',
      title: 'Заявки и выручка',
      state: 'error',
      status: 'Не загрузились',
      text: 'Результаты каналов не загрузились. Обновите страницу.',
      actions: ['open-analytics'],
    };
  else if (!r.supported)
    results = {
      key: 'results',
      title: 'Заявки и выручка',
      state: 'off',
      status: 'Пока недоступно',
      text: 'Заявки и выручка по каналам пока считаются по броням гостиницы. Для салона и ресторана появятся со своими записями и заказами; расходы уже видны.',
      actions: [],
    };
  else
    results = {
      key: 'results',
      title: 'Заявки и выручка',
      state: 'ok',
      status: 'Подтягиваются сами',
      text: 'Добавлять ничего не нужно: брони, заявки с сайта и диалоги ИИ-продавца по каналам сайт, WhatsApp, Instagram и телефон. Канал брони это её источник.',
      actions: ['open-analytics'],
    };

  const list = [manual, meta, results];
  if (input.otherAds.length > 0)
    list.push({
      key: 'other-ads',
      title: 'Другая реклама',
      state: 'manual',
      status: 'Только вручную',
      text: `${input.otherAds.map(platformLabel).join(', ')}: кабинеты не подключаются, расход вносите в расходы вручную. Заявки и ROMI у них появятся, когда брони начнут нести метку кампании.`,
      actions: [],
    });
  return list;
}
