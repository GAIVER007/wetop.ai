import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import type { channex } from '@pms/integrations';
import type { ChannexGateway } from './channels.repository';
import { ChannexSyncService, WEBHOOK_PATH } from './sync.service';

const PROPERTY = 'prop-staging-1';
const OLD_URL = `https://old-tunnel.trycloudflare.test${WEBHOOK_PATH}`;
const PERMANENT = 'https://api.wetop.test';

const repo = {
  mappings: async () => [
    {
      id: 'm',
      localAccommodationTypeId: null,
      localAccommodationTypeCode: null,
      localRatePlanId: null,
      providerPropertyId: PROPERTY,
      providerRoomTypeId: null,
      providerRatePlanId: null,
    },
  ],
  audit: async () => undefined,
} as never;

const webhook = (
  id: string,
  callbackUrl: string,
): channex.ChannexResource<channex.ChannexWebhookAttributes> => ({
  id,
  type: 'webhook',
  attributes: {
    callback_url: callbackUrl,
    event_mask: 'booking',
    request_params: null,
    headers: null,
    is_active: true,
    send_data: true,
    protected: false,
    is_global: false,
  },
  relationships: { property: { data: { id: PROPERTY, type: 'property' } } },
});

/**
 * Channex, который на PUT отвечает 200, но адрес НЕ меняет — ровно то, что случилось на staging 15.09.2026:
 * перерегистрация отрапортовала успех, а в Channex остался мёртвый быстрый туннель.
 */
function gatewayIgnoringUpdate(): ChannexGateway {
  const stored = webhook('wh-1', OLD_URL);
  return {
    listWebhooks: async () => [stored],
    updateWebhook: async () => stored,
    createWebhook: async () => stored,
  } as unknown as ChannexGateway;
}

/** Честный Channex: сохраняет то, что прислали. */
function gatewayApplyingUpdate(): ChannexGateway {
  let stored = webhook('wh-1', OLD_URL);
  return {
    listWebhooks: async () => [stored],
    updateWebhook: async (_id: string, input: channex.ChannexWebhookInput) => {
      stored = webhook('wh-1', input.callback_url);
      return stored;
    },
    createWebhook: async () => stored,
  } as unknown as ChannexGateway;
}

describe('registerWebhook: успех считается по ответу Channex, а не по отправленному адресу', () => {
  beforeEach(() => {
    process.env.PUBLIC_API_URL = PERMANENT;
    process.env.CHANNEX_WEBHOOK_SECRET = 'secret-for-test';
  });

  it('падает, когда Channex вернул прежний адрес: кнопка не должна рапортовать о перерегистрации', async () => {
    const sync = new ChannexSyncService(gatewayIgnoringUpdate(), repo);
    await expect(sync.registerWebhook()).rejects.toThrow(/не перерегистрирован|сохранил/i);
  });

  it('возвращает адрес из ответа Channex, когда тот его принял', async () => {
    const sync = new ChannexSyncService(gatewayApplyingUpdate(), repo);
    const r = await sync.registerWebhook();
    expect(r.callbackUrl).toBe(`${PERMANENT}${WEBHOOK_PATH}`);
    expect(r.created).toBe(false);
  });
});

/**
 * Проверка webhook: Channex шлёт пробный запрос на указанный адрес вместе с заголовком секрета. При заданном
 * постоянном адресе — то же правило, что у регистрации: другой адрес не принимается, иначе любой вошедший уведёт
 * секрет на свой сервер (SECURITY.md §11, проверка 24.09.2026).
 */
describe('testWebhook: при заданном PUBLIC_API_URL секрет уходит только на постоянный адрес', () => {
  beforeEach(() => {
    process.env.PUBLIC_API_URL = PERMANENT;
    process.env.CHANNEX_WEBHOOK_SECRET = 'secret-for-test';
  });

  function gatewayRecordingTests() {
    const tested: string[] = [];
    const gateway = {
      testWebhook: async (input: channex.ChannexWebhookInput) => {
        tested.push(input.callback_url);
        return { status_code: 200, body: 'ok' };
      },
    } as unknown as ChannexGateway;
    return { gateway, tested };
  }

  it('чужой адрес — 409, Channex не вызывается', async () => {
    const { gateway, tested } = gatewayRecordingTests();
    const sync = new ChannexSyncService(gateway, repo);
    await expect(sync.testWebhook('https://collector.example.test/hook')).rejects.toThrow(
      /постоянный адрес/,
    );
    expect(tested).toEqual([]);
  });

  it('постоянный адрес — явно или по умолчанию — проверяется', async () => {
    const { gateway, tested } = gatewayRecordingTests();
    const sync = new ChannexSyncService(gateway, repo);
    await sync.testWebhook();
    await sync.testWebhook(`${PERMANENT}${WEBHOOK_PATH}`);
    expect(tested).toEqual([`${PERMANENT}${WEBHOOK_PATH}`, `${PERMANENT}${WEBHOOK_PATH}`]);
  });
});
