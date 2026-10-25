import type { TrackedSite, TrackedSiteCard } from './api';
import type { PropertyClock } from './property-time';
import { msg, translator, type Translate } from '../i18n';

/**
 * «Сайт и онлайн-бронирование» (ADR-117, WEB1): одно место для сайта объекта вместо трёх — «Аналитики сайта»,
 * «Настроек сайта» и панели в «Интеграциях». Модель та же (`tracked_sites`, DATA_MODEL §11): одна запись — счётчик,
 * виджет бронирования и список доменов, с которых WETOP принимает запросы. Здесь только слова состояния для
 * экранов; новых правил нет — всё выводится из того, что API уже отдаёт.
 */

export type WebsiteView = 'overview' | 'booking' | 'analytics' | 'settings';

export const WEBSITE_TITLE = msg('Сайт и онлайн-бронирование');

export const WEBSITE_TABS: Array<{ view: WebsiteView; label: string; href: string }> = [
  { view: 'overview', label: msg('Обзор'), href: '/website' },
  { view: 'booking', label: msg('Бронирование'), href: '/website/booking' },
  { view: 'analytics', label: msg('Аналитика'), href: '/website/analytics' },
  { view: 'settings', label: msg('Настройки'), href: '/website/settings' },
];

/**
 * Имена, которые RFC 2606 / RFC 6761 резервируют для примеров: с них не придёт ни один запрос. `.test` и `.localhost`
 * сюда не входят — это адреса локального стенда, запросы с них доходят (сквозные тесты — `test-site.localhost`).
 */
const RESERVED_TLD = ['example', 'invalid'];
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

/**
 * Домен-заглушка. У боевого сайта первого партнёра с 12.09 до очистки 28.09 (ADR-118) стоял `*.example` — адреса
 * сайта не было (Q-111), а форма требует хотя бы один домен. С заглушкой приёмник и виджет отбрасывают всё: сайт не подключён.
 */
export function isPlaceholderHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  const tld = h.slice(h.lastIndexOf('.') + 1);
  if (RESERVED_TLD.includes(tld)) return true;
  return RESERVED_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Основной домен — первый настоящий из списка; нет — сайт не подключён */
export function primaryHost(site: Pick<TrackedSite, 'hosts'>): string | null {
  return site.hosts.find((h) => !isPlaceholderHost(h)) ?? null;
}

type Tone = 'calm' | 'warn';

export interface SiteState {
  /** Есть настоящий домен: без него приёмник и виджет не принимают ничего */
  connected: boolean;
  host: string | null;
  overall: { value: string; tone: Tone };
  counter: {
    state: 'blocked' | 'paused' | 'waiting' | 'today' | 'quiet';
    value: string;
    note: string;
    tone: Tone;
  };
  booking: {
    state: 'blocked' | 'paused' | 'off' | 'on';
    value: string;
    note: string;
    tone: Tone;
  };
}

/**
 * Состояние сайта словами. Пауза (`PAUSED`) останавливает и счётчик, и виджет — так работает API
 * (`collect.service`, `web-booking.service`). «Работает» — только когда событие пришло сегодня по часам объекта:
 * зелёный цвет по событию месячной давности был бы той же неправдой, что зелёная заглушка. Полная машина
 * состояний счётчика — WEB2.
 */
export function siteState(
  card: TrackedSiteCard,
  clock: PropertyClock,
  now = new Date(),
  t: Translate = translator('ru'),
): SiteState {
  const { site, status } = card;
  const host = primaryHost(site);
  const paused = site.status === 'PAUSED';
  const last = status.lastEventAt;

  const counter: SiteState['counter'] = !host
    ? { state: 'blocked', value: t('Не принимает посещения'), note: t('Нет адреса сайта'), tone: 'warn' }
    : paused
      ? {
          state: 'paused',
          value: t('Приостановлен'),
          note: t('Посещения не записываются'),
          tone: 'warn',
        }
      : !last
        ? {
            state: 'waiting',
            value: t('Ждём первое посещение'),
            note: t('Событий с сайта ещё не было'),
            tone: 'warn',
          }
        : clock.date(last) === clock.today(now)
          ? {
              state: 'today',
              value: t('Работает'),
              note: t('Последнее событие в {time}', { time: clock.clock(last) }),
              tone: 'calm',
            }
          : {
              state: 'quiet',
              value: t('Сегодня событий нет'),
              note: t('Последнее — {when}', { when: clock.when(last, t) }),
              tone: 'warn',
            };

  const booking: SiteState['booking'] = !site.bookingEnabled
    ? {
        state: 'off',
        value: t('Выключено'),
        // выключенный виджет ничего не объявляет: форма остаётся, на «Показать цены» гость получает отказ
        note: t('Форма на сайте цены не покажет'),
        tone: 'warn',
      }
    : !host
      ? { state: 'blocked', value: t('Не принимает брони'), note: t('Нет адреса сайта'), tone: 'warn' }
      : paused
        ? { state: 'paused', value: t('Остановлено'), note: t('Сайт приостановлен'), tone: 'warn' }
        : !site.bookingRatePlan
          ? { state: 'blocked', value: t('Не принимает брони'), note: t('Не выбран тариф'), tone: 'warn' }
          : {
              state: 'on',
              value: t('Включено'),
              note: t('Тариф «{name}»', { name: site.bookingRatePlan.name }),
              tone: 'calm',
            };

  const overall: SiteState['overall'] = !host
    ? { value: t('Не подключён'), tone: 'warn' }
    : paused
      ? { value: t('Приостановлен'), tone: 'warn' }
      : { value: counter.value, tone: counter.tone };

  return { connected: !!host, host, overall, counter, booking };
}

/** Та же проверка, что у API (`parseHosts`): латиница, цифры, дефис, точки между частями */
const HOST_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;
/** Пример адреса в подсказках и ошибках: стойка у каждого партнёра своя, домен конкретного отеля здесь не к месту */
export const DOMAIN_EXAMPLE = 'myhotel.kz';

/**
 * Адрес сайта из того, что вставил человек (WEB2): схема, путь, порт, `www` и точка в конце снимаются —
 * `https://www.myhotel.kz/rooms` → `myhotel.kz`. Неверный ввод — словами до запроса в API.
 */
export function parseDomainInput(
  raw: string,
  t: Translate = translator('ru'),
): { host: string } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: t('Впишите адрес сайта, например {example}', { example: DOMAIN_EXAMPLE }) };
  const host = text
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  if (!HOST_RE.test(host))
    return { error: t('Не похоже на адрес сайта: впишите домен, например {example}', { example: DOMAIN_EXAMPLE }) };
  return { host };
}

/**
 * Список доменов после «Добавить домен»: новый — в конец, основной не меняется. Настоящий домен вытесняет заглушки —
 * так просила инструкция установки 12.09 («замените заглушку на настоящий адрес»); что убрано — в `dropped`.
 */
export function hostsAfterAdd(
  current: readonly string[],
  host: string,
  t: Translate = translator('ru'),
): { hosts: string[]; dropped: string[] } | { error: string } {
  if (current.includes(host)) return { error: t('{host} уже в списке', { host }) };
  const dropped = isPlaceholderHost(host) ? [] : current.filter(isPlaceholderHost);
  return { hosts: [...current.filter((h) => !dropped.includes(h)), host], dropped };
}

/** Список доменов после «Убрать»: API требует хотя бы один адрес — последний не убирается */
export function hostsAfterRemove(
  current: readonly string[],
  host: string,
  t: Translate = translator('ru'),
): { hosts: string[] } | { error: string } {
  if (!current.includes(host)) return { error: t('{host} уже нет в списке', { host }) };
  const hosts = current.filter((h) => h !== host);
  if (!hosts.length) return { error: t('Сайту нужен хотя бы один адрес: сначала добавьте другой') };
  return { hosts };
}

/** Адрес, который можно открыть в новой вкладке (демо виджета): только http и https, не относительный путь */
export function isOpenableUrl(url: string): boolean {
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
