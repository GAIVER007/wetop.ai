/**
 * Channel API Channex: каталог адаптеров каналов и подключения объекта к каналам (OTA), только формы и разбор.
 * Источник — docs/channex/site/api-v.1-documentation/channel-api.md (OpenAPI «Channex.io — Channels»: схемы
 * `Channels.ChannelAdapter`, `Channels.ChannelAdapterParam`, `Channels.Channel`) и channel-api-examples/*.md
 * (Booking.com, Agoda, Expedia, Emerging Travel Group: ID объекта в канале — поле `hotel_id`); окно Channex —
 * channel-iframe.md. Наружу из пакета уходят нейтральные виды без кодов полей формы (ADR-004).
 */
import { otaChannelKey } from './channel-names';
import type { ChannexResource } from './client';

/** `Channels.ChannelAdapterParam`: поле формы подключения */
export interface ChannexAdapterParam {
  position: number;
  type: string;
  title?: string;
  default?: string | boolean | number;
  options?: string[];
  rules?: unknown[];
}

/** `Channels.ChannelAdapter`: один канал каталога Channex */
export interface ChannexChannelAdapter {
  code: string;
  title: string;
  kind: 'ota' | 'meta' | 'cm' | string;
  params: Record<string, ChannexAdapterParam>;
  actions: string[];
  mapping_mode: string | null;
  message_support: boolean;
  property_mapping: string | null;
  rate_params?: Record<string, ChannexAdapterParam> | null;
}

/** `Channels.Channel`: подключение объекта к каналу */
export interface ChannexChannelAttributes {
  id: string;
  title: string;
  channel: string;
  currency: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  rate_plans: Array<{ id: string; rate_plan_id: string; settings: unknown }>;
  properties: string[];
  actions: string[];
  expected_removal_date: string | null;
  inserted_at: string;
  updated_at: string;
}

/** Подключение для WETOP: что видно в списке «Подключённые» */
export interface ChannelConnectionView {
  id: string;
  adapterCode: string;
  /** Тот же ключ, что у броней и событий (`otaChannelKey`): по нему считаются брони канала */
  channelKey: string;
  channelTitle: string;
  connectionTitle: string;
  /** ID объекта на стороне канала (Booking.com Hotel ID и т. п.); null — поле не заполнено или не определено */
  channelPropertyId: string | null;
  /** `is_active` Channex: меняется только activate/deactivate, у нас — только показывается */
  active: boolean;
  /** Channex удалит выключенное подключение в этот день (через 30 дней после deactivate) */
  removalDate: string | null;
  mappedRatePlans: number;
  actions: string[];
}

export interface ChannelAdapterView {
  code: string;
  channelKey: string;
  title: string;
  kind: string;
  canLoadFutureReservations: boolean;
}

const HIDDEN_TYPES = new Set(['hidden', 'password', 'boolean', 'switch']);

/**
 * ID объекта в канале. У каналов из документации это `hotel_id`; у остальных — первое по `position` видимое
 * текстовое поле формы (пароль, скрытое и флажки не показываются никогда). Неизвестный адаптер — только `hotel_id`.
 */
export function connectionChannelPropertyId(
  settings: Record<string, unknown> | null | undefined,
  adapter: ChannexChannelAdapter | undefined,
): string | null {
  const value = (v: unknown) =>
    (typeof v === 'string' && v.trim()) || (typeof v === 'number' && Number.isFinite(v))
      ? String(v).trim()
      : null;
  const s = settings ?? {};
  const direct = value(s['hotel_id']);
  if (direct) return direct;
  if (!adapter) return null;
  const fields = Object.entries(adapter.params ?? {})
    .filter(([, p]) => !HIDDEN_TYPES.has(p.type))
    .sort((a, b) => a[1].position - b[1].position);
  for (const [name] of fields) {
    const v = value(s[name]);
    if (v) return v;
  }
  return null;
}

export function toConnectionView(
  r: ChannexResource<ChannexChannelAttributes>,
  adapters: ReadonlyMap<string, ChannexChannelAdapter>,
): ChannelConnectionView {
  const a = r.attributes;
  const adapter = adapters.get(a.channel);
  return {
    id: r.id,
    adapterCode: a.channel,
    channelKey: otaChannelKey(adapter?.title ?? a.channel) || otaChannelKey(a.channel),
    channelTitle: adapter?.title ?? a.channel,
    connectionTitle: a.title,
    channelPropertyId: connectionChannelPropertyId(a.settings, adapter),
    active: a.is_active === true,
    removalDate: a.expected_removal_date ?? null,
    mappedRatePlans: (a.rate_plans ?? []).length,
    actions: a.actions ?? [],
  };
}

export function toAdapterView(a: ChannexChannelAdapter): ChannelAdapterView {
  return {
    code: a.code,
    channelKey: otaChannelKey(a.title) || otaChannelKey(a.code),
    title: a.title,
    kind: a.kind,
    canLoadFutureReservations: (a.actions ?? []).includes('load_future_reservations'),
  };
}

/**
 * Адрес окна Channex (channel-iframe.md): `{server}/auth/exchange?oauth_session_key=…&app_mode=headless&
 * redirect_to=/channels&property_id=…`, `lng=ru`; `channels` — коды каналов из channel-codes.md, ограничивают
 * список окна. Сервер — адрес API без `/api/v1`.
 */
export function channelIframeUrl(
  apiBaseUrl: string,
  o: { token: string; propertyId: string; channelCode?: string },
): string {
  const server = apiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  const q = new URLSearchParams({
    oauth_session_key: o.token,
    app_mode: 'headless',
    redirect_to: '/channels',
    property_id: o.propertyId,
    lng: 'ru',
  });
  if (o.channelCode) q.set('channels', o.channelCode);
  return `${server}/auth/exchange?${q.toString()}`;
}
