import type { BadgeTone } from '../../components/ui';
import type { ChannelConnectionRow, ChannelOutsideRow } from '../../lib/api';
import { sourceNames } from '../../lib/hotel-api';

/**
 * Слова раздела «Каналы» (ADR-140). «Работает» — только когда сервер подтвердил фактами (включён, событие канала
 * за 30 дней, нет ошибок входящих за 7 дней); иначе честное «Включён» с причиной (дополнение к ADR-112).
 */
const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export function channelStatusView(
  r: Pick<ChannelConnectionRow, 'status' | 'removalDate' | 'lastEventAt' | 'failedEvents7d'>,
): { label: string; tone: BadgeTone; note: string | null } {
  switch (r.status) {
    case 'WORKING':
      return { label: 'Работает', tone: 'ok', note: null };
    case 'ERRORS':
      return {
        label: 'Ошибки броней',
        tone: 'danger',
        note: `${r.failedEvents7d} ${plural(r.failedEvents7d)} с ошибкой за 7 дней`,
      };
    case 'ENABLED':
      return { label: 'Включён', tone: 'neutral', note: 'броней из канала не было 30 дней' };
    case 'REMOVING':
      return r.removalDate
        ? {
            label: `Удаляется ${ddmm(r.removalDate)}`,
            tone: 'warn',
            note: `Менеджер каналов удалит выключенное подключение ${ddmm(r.removalDate)}.${r.removalDate.slice(0, 4)}`,
          }
        : { label: 'Выключен', tone: 'neutral', note: null };
    default:
      return { label: 'Выключен', tone: 'neutral', note: 'цены и остатки в канал не уходят' };
  }
}

const plural = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'бронь';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'брони';
  return 'броней';
};

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

export function outsideLabel(r: Pick<ChannelOutsideRow, 'source' | 'label'>): string {
  return r.label ?? sourceNames[r.source] ?? r.source;
}
