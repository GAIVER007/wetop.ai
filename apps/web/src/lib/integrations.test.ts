import { describe, expect, it } from 'vitest';
import { ApiError, type ChannelConnection, type OutboxSummary, type WebhookStatus } from './api';
import { propertyClock } from './property-time';
import { channexCard, exchangeLine, type Settled } from './integrations';

const NOW = new Date('2026-09-27T14:00:00Z'); // 19:00 по Алматы
const ok = <T>(value: T): Settled<T> => ({ ok: true, value });
const fail = (error: unknown): Settled<never> => ({ ok: false, error });

const connection = (over: Partial<ChannelConnection> = {}): ChannelConnection => ({
  checkedAt: NOW.toISOString(),
  environment: 'staging',
  apiConfigured: true,
  propertyId: 'channex-property',
  propertyAccessible: true,
  mappedCategories: 5,
  mappedRatePlans: 10,
  lastWebhookAt: '2026-09-27T13:58:00Z',
  lastPullAt: '2026-09-27T12:00:00Z',
  state: 'READY',
  message: 'Объект доступен',
  ...over,
});
const webhook = (over: Partial<WebhookStatus> = {}): WebhookStatus => ({
  registered: true,
  id: 'wh',
  callbackUrl: 'https://api.example.invalid/channels/channex/webhook',
  eventMask: '*',
  active: true,
  sendData: true,
  expectedUrl: 'https://api.example.invalid/channels/channex/webhook',
  secretConfigured: true,
  callbackReachable: true,
  callbackCheckedAt: NOW.toISOString(),
  ...over,
});
const outbox = (over: Partial<OutboxSummary> = {}): OutboxSummary => ({
  pending: 0,
  failed: 0,
  sent: 400,
  lastSentAt: '2026-09-27T13:40:00Z',
  lastTaskId: 't',
  oldestPendingAt: null,
  ...over,
});
const card = (
  c: Settled<ChannelConnection>,
  w: Settled<WebhookStatus> = ok(webhook()),
  o: Settled<OutboxSummary> = ok(outbox()),
) => channexCard({ connection: c, webhook: w, outbox: o, now: NOW });

describe('channexCard — состояние по настоящим сигналам', () => {
  it('объект доступен, webhook включён, очередь пуста — «работает», без списка успехов', () => {
    const c = card(ok(connection()));
    expect(c.health).toBe('ok');
    expect(c.issues).toEqual([]);
    expect(c.lastExchangeAt).toBe('2026-09-27T13:58:00Z');
  });

  it('последний обмен — самое позднее из webhook, импорта и отправки в каналы', () => {
    const c = card(
      ok(connection({ lastWebhookAt: null, lastPullAt: '2026-09-27T10:00:00Z' })),
      ok(webhook()),
      ok(outbox({ lastSentAt: '2026-09-27T11:00:00Z' })),
    );
    expect(c.lastExchangeAt).toBe('2026-09-27T11:00:00Z');
  });

  it('403 от API — Channex к этой организации не подключён', () => {
    const c = card(fail(new ApiError(403, 'Каналы продаж ведёт поддержка WETOP')), fail(null), fail(null));
    expect(c.health).toBe('off');
  });

  it('ключ не задан — не подключено', () => {
    expect(card(ok(connection({ state: 'NO_KEY', apiConfigured: false }))).health).toBe('off');
  });

  it('сбой запроса — «неизвестно», а не зелёный и не «не подключено»', () => {
    const c = card(fail(new ApiError(503, 'сбой')));
    expect(c.health).toBe('unknown');
    expect(c.issues[0]?.text).toContain('Не удалось проверить');
  });

  it('объект недоступен — внимание с причиной словами API', () => {
    const c = card(ok(connection({ state: 'DENIED', propertyAccessible: false, message: 'Нет доступа к объекту' })));
    expect(c.health).toBe('attention');
    expect(c.issues[0]?.text).toBe('Нет доступа к объекту');
  });

  it('объект в Channex не создан — внимание и ссылка туда, где его создают', () => {
    const c = card(ok(connection({ state: 'NO_MAPPING', propertyId: null, message: 'Объект не сопоставлен' })));
    expect(c.health).toBe('attention');
    expect(c.issues[0]?.href).toBe('/channels');
  });

  it('webhook не включён или не отвечает — внимание', () => {
    expect(card(ok(connection()), ok(webhook({ active: false }))).issues[0]?.text).toBe('Webhook не включён');
    expect(card(ok(connection()), ok(webhook({ callbackReachable: false }))).issues[0]?.text).toBe(
      'Webhook не отвечает',
    );
  });

  it('ошибки отправки и застой очереди — внимание со ссылкой в «Каналы продаж»', () => {
    const failed = card(ok(connection()), ok(webhook()), ok(outbox({ failed: 2 })));
    expect(failed.health).toBe('attention');
    expect(failed.issues[0]).toMatchObject({ text: 'Ошибок отправки в каналы: 2', href: '/channels?queue=FAILED' });
    const stalled = card(
      ok(connection()),
      ok(webhook()),
      ok(outbox({ pending: 3, oldestPendingAt: '2026-09-27T13:30:00Z' })),
    );
    expect(stalled.issues[0]?.text).toBe('Очередь в каналы стоит 30 мин');
    // свежая очередь — норма
    expect(card(ok(connection()), ok(webhook()), ok(outbox({ pending: 1, oldestPendingAt: '2026-09-27T13:58:00Z' }))).health).toBe('ok');
  });

  it('ни одной сопоставленной категории — внимание', () => {
    expect(card(ok(connection({ mappedCategories: 0 }))).health).toBe('attention');
  });

  it('webhook или очередь не проверены — «неизвестно», проблема важнее незнания', () => {
    expect(card(ok(connection()), fail(new ApiError(503, 'x'))).health).toBe('unknown');
    expect(card(ok(connection()), fail(new ApiError(503, 'x')), ok(outbox({ failed: 1 }))).health).toBe(
      'attention',
    );
  });
});

describe('exchangeLine — время обмена словами', () => {
  const clock = propertyClock('Asia/Almaty');
  it('недавно — минутами, сегодня и вчера — словом, раньше — датой', () => {
    expect(exchangeLine('2026-09-27T13:59:40Z', clock, NOW)).toBe('только что');
    expect(exchangeLine('2026-09-27T13:58:00Z', clock, NOW)).toBe('2 мин назад');
    expect(exchangeLine('2026-09-27T09:10:00Z', clock, NOW)).toBe('сегодня, 14:10');
    expect(exchangeLine('2026-09-26T14:46:00Z', clock, NOW)).toBe('вчера, 19:46');
    expect(exchangeLine('2026-09-20T11:50:00Z', clock, NOW)).toBe(clock.when('2026-09-20T11:50:00Z'));
    expect(exchangeLine(null, clock, NOW)).toBe('—');
  });
});
