/**
 * Публичная страница статуса сервиса (H14 плана развития, ADR-144): клиент видит, работает ли WETOP, без входа.
 * Наружу уходят только общие слова по четырём частям; виды неисправностей, тексты, время и числа сторожа не уходят:
 * страница видна всем и не должна рассказывать о внутреннем устройстве (SECURITY.md).
 */
import type { IncidentKind } from './incidents';

export type PublicState = 'ok' | 'degraded' | 'down';
export interface PublicComponent {
  key: 'app' | 'database' | 'channels' | 'booking';
  label: string;
  state: PublicState;
}
export interface PublicStatus {
  overall: PublicState;
  components: PublicComponent[];
}

const CHANNEL_KINDS: readonly IncidentKind[] = [
  'webhook.suspect',
  'webhook.unreachable',
  'webhook.misrouted',
  'feed.stale',
  'outbox.failed',
  'outbox.stuck',
  'ari.delta.lost',
  'ari.oversell',
  'event.failed',
  'event.rejected',
  'sync.missing',
];

export function publicStatus(input: {
  databaseUp: boolean;
  openKinds: readonly string[];
}): PublicStatus {
  const open = new Set(input.openKinds);
  const any = (kinds: readonly IncidentKind[]) => kinds.some((k) => open.has(k));
  const database: PublicState = !input.databaseUp || open.has('db.down') ? 'down' : 'ok';
  const components: PublicComponent[] = [
    { key: 'app', label: 'Рабочее место и вход', state: open.has('web.down') ? 'down' : 'ok' },
    { key: 'database', label: 'Хранение данных', state: database },
    {
      key: 'channels',
      label: 'Обмен с каналами продаж',
      state: any(CHANNEL_KINDS) ? 'degraded' : 'ok',
    },
    {
      key: 'booking',
      label: 'Бронирование с сайта',
      state: open.has('booking.flood') ? 'degraded' : 'ok',
    },
  ];
  const overall: PublicState = components.some((c) => c.state === 'down')
    ? 'down'
    : components.some((c) => c.state === 'degraded')
      ? 'degraded'
      : 'ok';
  return { overall, components };
}
