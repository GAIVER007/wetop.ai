import type { BadgeTone } from '../../components/ui';
import type { ChannelConnectionRow, ChannelOutsideRow } from '../../lib/api';
import { sourceNames } from '../../lib/hotel-api';
import { countLabel, msg, translator, type DeskLocale, type Translate } from '../../i18n';

/**
 * Слова раздела «Каналы» (ADR-140). «Работает» — только когда сервер подтвердил фактами (включён, событие канала
 * за 30 дней, нет ошибок входящих за 7 дней); иначе честное «Включён» с причиной (дополнение к ADR-112).
 */
const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export function channelStatusView(
  r: Pick<ChannelConnectionRow, 'status' | 'removalDate' | 'lastEventAt' | 'failedEvents7d'>,
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): { label: string; tone: BadgeTone; note: string | null } {
  switch (r.status) {
    case 'WORKING':
      return { label: t('Работает'), tone: 'ok', note: null };
    case 'ERRORS':
      return {
        label: t('Ошибки броней'),
        tone: 'danger',
        note: t('{n} с ошибкой за 7 дней', {
          n: countLabel(locale, t, r.failedEvents7d, [msg('бронь'), msg('брони'), msg('броней')]),
        }),
      };
    case 'ENABLED':
      return { label: t('Включён'), tone: 'neutral', note: t('броней из канала не было 30 дней') };
    case 'REMOVING':
      return r.removalDate
        ? {
            label: t('Удаляется {date}', { date: ddmm(r.removalDate) }),
            tone: 'warn',
            note: t('Менеджер каналов удалит выключенное подключение {date}', {
              date: `${ddmm(r.removalDate)}.${r.removalDate.slice(0, 4)}`,
            }),
          }
        : { label: t('Выключен'), tone: 'neutral', note: null };
    default:
      return { label: t('Выключен'), tone: 'neutral', note: t('цены и остатки в канал не уходят') };
  }
}

export function matchesChannel(
  r: Pick<ChannelConnectionRow, 'channelTitle' | 'connectionTitle' | 'channelPropertyId'>,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [r.channelTitle, r.connectionTitle, r.channelPropertyId ?? ''].some((v) =>
    v.toLowerCase().includes(needle),
  );
}

export function outsideLabel(
  r: Pick<ChannelOutsideRow, 'source' | 'label'>,
  t: Translate = translator('ru'),
): string {
  // sourceNames из lib/hotel-api: постоянные русские подписи источников, переводятся при показе
  return r.label ?? (sourceNames[r.source] ? t(sourceNames[r.source]!) : r.source);
}
