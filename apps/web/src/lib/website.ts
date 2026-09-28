import type { TrackedSite, TrackedSiteCard } from './api';
import type { PropertyClock } from './property-time';

/**
 * «Сайт и онлайн-бронирование» (ADR-117, WEB1): одно место для сайта объекта вместо трёх — «Аналитики сайта»,
 * «Настроек сайта» и панели в «Интеграциях». Модель та же (`tracked_sites`, DATA_MODEL §11): одна запись — счётчик,
 * виджет бронирования и список доменов, с которых WETOP принимает запросы. Здесь только слова состояния для
 * экранов; новых правил нет — всё выводится из того, что API уже отдаёт.
 */

export type WebsiteView = 'overview' | 'booking' | 'analytics' | 'settings';

export const WEBSITE_TITLE = 'Сайт и онлайн-бронирование';

export const WEBSITE_TABS: Array<{ view: WebsiteView; label: string; href: string }> = [
  { view: 'overview', label: 'Обзор', href: '/website' },
  { view: 'booking', label: 'Бронирование', href: '/website/booking' },
  { view: 'analytics', label: 'Аналитика', href: '/website/analytics' },
  { view: 'settings', label: 'Настройки', href: '/website/settings' },
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
): SiteState {
  const { site, status } = card;
  const host = primaryHost(site);
  const paused = site.status === 'PAUSED';
  const last = status.lastEventAt;

  const counter: SiteState['counter'] = !host
    ? { state: 'blocked', value: 'Не принимает посещения', note: 'Нет адреса сайта', tone: 'warn' }
    : paused
      ? {
          state: 'paused',
          value: 'Приостановлен',
          note: 'Посещения не записываются',
          tone: 'warn',
        }
      : !last
        ? {
            state: 'waiting',
            value: 'Ждём первое посещение',
            note: 'Событий с сайта ещё не было',
            tone: 'warn',
          }
        : clock.date(last) === clock.today(now)
          ? {
              state: 'today',
              value: 'Работает',
              note: `Последнее событие в ${clock.clock(last)}`,
              tone: 'calm',
            }
          : {
              state: 'quiet',
              value: 'Сегодня событий нет',
              note: `Последнее — ${clock.when(last)}`,
              tone: 'warn',
            };

  const booking: SiteState['booking'] = !site.bookingEnabled
    ? {
        state: 'off',
        value: 'Выключено',
        note: 'Виджет на сайте говорит, что бронирование недоступно',
        tone: 'warn',
      }
    : !host
      ? { state: 'blocked', value: 'Не принимает брони', note: 'Нет адреса сайта', tone: 'warn' }
      : paused
        ? { state: 'paused', value: 'Остановлено', note: 'Сайт приостановлен', tone: 'warn' }
        : !site.bookingRatePlan
          ? { state: 'blocked', value: 'Не принимает брони', note: 'Не выбран тариф', tone: 'warn' }
          : {
              state: 'on',
              value: 'Включено',
              note: `Тариф «${site.bookingRatePlan.name}»`,
              tone: 'calm',
            };

  const overall: SiteState['overall'] = !host
    ? { value: 'Не подключён', tone: 'warn' }
    : paused
      ? { value: 'Приостановлен', tone: 'warn' }
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
export function parseDomainInput(raw: string): { host: string } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: `Впишите адрес сайта, например ${DOMAIN_EXAMPLE}` };
  const host = text
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  if (!HOST_RE.test(host))
    return { error: `Не похоже на адрес сайта: впишите домен, например ${DOMAIN_EXAMPLE}` };
  return { host };
}

/**
 * Список доменов после «Добавить домен»: новый — в конец, основной не меняется. Настоящий домен вытесняет заглушки —
 * так просила инструкция установки 12.09 («замените заглушку на настоящий адрес»); что убрано — в `dropped`.
 */
export function hostsAfterAdd(
  current: readonly string[],
  host: string,
): { hosts: string[]; dropped: string[] } | { error: string } {
  if (current.includes(host)) return { error: `${host} уже в списке` };
  const dropped = isPlaceholderHost(host) ? [] : current.filter(isPlaceholderHost);
  return { hosts: [...current.filter((h) => !dropped.includes(h)), host], dropped };
}

/** Список доменов после «Убрать»: API требует хотя бы один адрес — последний не убирается */
export function hostsAfterRemove(
  current: readonly string[],
  host: string,
): { hosts: string[] } | { error: string } {
  if (!current.includes(host)) return { error: `${host} уже нет в списке` };
  const hosts = current.filter((h) => h !== host);
  if (!hosts.length) return { error: 'Сайту нужен хотя бы один адрес: сначала добавьте другой' };
  return { hosts };
}
