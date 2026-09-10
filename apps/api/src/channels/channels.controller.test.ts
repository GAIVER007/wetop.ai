import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { channex } from '@pms/integrations';
import {
  CHESSBOARD_REPOSITORY,
  type ChessboardRepository,
} from '../chessboard/chessboard.repository';
import { PrismaService } from '../database/prisma.provider';
import { ChannelsModule } from './channels.module';
import {
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  type ChannelsRepository,
  type ChannexGateway,
  type MappingRow,
} from './channels.repository';

/** Фальшивки: локальный объект с 2 категориями, тариф ОТА, цены на 3 дня; Channex отвечает ID по счётчику. */
function makeFakes() {
  const calls: Array<{ op: string; body: unknown }> = [];
  let n = 0;
  let mi = 0;
  const id = (p: string) => (p === 'm' ? `m-${++mi}` : `${p}-${++n}`);
  const gateway: ChannexGateway = {
    async createProperty(attrs) {
      calls.push({ op: 'createProperty', body: attrs });
      return { type: 'property', id: id('prop'), attributes: attrs };
    },
    async createRoomType(attrs) {
      calls.push({ op: 'createRoomType', body: attrs });
      return { type: 'room_type', id: id('rt'), attributes: attrs };
    },
    async createRatePlan(attrs) {
      calls.push({ op: 'createRatePlan', body: attrs });
      return { type: 'rate_plan', id: id('rp'), attributes: attrs };
    },
    async updateAvailability(values) {
      calls.push({ op: 'updateAvailability', body: values });
      return { data: [{ id: 'task-a', type: 'task' }], meta: { message: 'Success', warnings: [] } };
    },
    async updateRestrictions(values) {
      calls.push({ op: 'updateRestrictions', body: values });
      return { data: [{ id: 'task-r', type: 'task' }], meta: { message: 'Success', warnings: [] } };
    },
    async listProperties() {
      return [];
    },
    async bookingRevisionsFeed() {
      return [];
    },
    async getBookingRevision(): Promise<never> {
      throw new Error('not in this test');
    },
    async ackBookingRevision() {},
    async listWebhooks() {
      return webhooks;
    },
    async createWebhook(input) {
      calls.push({ op: 'createWebhook', body: input });
      const w = {
        type: 'webhook',
        id: id('wh'),
        attributes: {
          callback_url: input.callback_url,
          event_mask: input.event_mask,
          request_params: input.request_params ?? null,
          headers: input.headers ?? null,
          is_active: input.is_active ?? false,
          send_data: input.send_data ?? false,
          protected: false,
          is_global: input.is_global ?? false,
        },
        relationships: {
          property: { data: { type: 'property', id: input.property_id ?? 'none' } },
        },
      };
      webhooks.push(w);
      return w;
    },
    async updateWebhook(whId, input) {
      calls.push({ op: 'updateWebhook', body: { id: whId, ...input } });
      const w = webhooks.find((x) => x.id === whId)!;
      w.attributes = {
        ...w.attributes,
        ...input,
        request_params: input.request_params ?? null,
        headers: input.headers ?? null,
        is_active: input.is_active ?? w.attributes.is_active,
        send_data: input.send_data ?? w.attributes.send_data,
        is_global: input.is_global ?? w.attributes.is_global,
      };
      return w;
    },
    async testWebhook(input) {
      calls.push({ op: 'testWebhook', body: input });
      return { status_code: 400, body: '{"message":"Нет поля event"}' };
    },
  };
  const webhooks: Array<{
    type: string;
    id: string;
    attributes: {
      callback_url: string;
      event_mask: string;
      request_params: Record<string, string> | null;
      headers: Record<string, string> | null;
      is_active: boolean;
      send_data: boolean;
      protected: boolean;
      is_global: boolean;
    };
    relationships: { property: { data: { type: string; id: string } } };
  }> = [];
  const mappings: MappingRow[] = [];
  const outbox: Array<{
    id: string;
    kind: 'AVAILABILITY' | 'RESTRICTIONS';
    payload: unknown[];
    attempts: number;
    createdAt: Date;
    status: string;
    taskId?: string | null;
    lastError?: string;
  }> = [];
  const audits: string[] = [];
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const d = (k: number) => {
    const x = new Date(`${today}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + k);
    return x.toISOString().slice(0, 10);
  };
  const repo: ChannelsRepository = {
    async localSetup() {
      return {
        property: {
          id: 'P',
          name: 'Тестовый хостел',
          currency: 'KZT',
          timezone: 'Asia/Almaty',
          country: 'KZ',
          city: 'Алматы',
          address: null,
          email: null,
          phone: null,
        },
        categories: [
          {
            id: 't1',
            code: 'exely-900001',
            name: 'Одиночная',
            kind: 'PRIVATE_ROOM',
            capacityAdults: 1,
            units: 1,
          },
          {
            id: 't3',
            code: 'exely-900003',
            name: 'Dorm',
            kind: 'DORM_BED',
            capacityAdults: 1,
            units: 2,
          },
        ],
        ratePlan: { id: 'p2', code: 'exely-800002', name: 'ОТА', currency: 'KZT' },
      };
    },
    async mappings() {
      return mappings.map((m) => ({ ...m }));
    },
    async savePropertyMapping(_p, _prov, providerPropertyId) {
      mappings.push({
        id: id('m'),
        localAccommodationTypeId: null,
        localAccommodationTypeCode: null,
        localRatePlanId: null,
        providerPropertyId,
        providerRoomTypeId: null,
        providerRatePlanId: null,
      });
    },
    async saveRatePlanMapping(row) {
      mappings.push({
        id: id('m'),
        localAccommodationTypeId: row.localAccommodationTypeId,
        localAccommodationTypeCode:
          row.localAccommodationTypeId === 't1' ? 'exely-900001' : 'exely-900003',
        localRatePlanId: row.localRatePlanId,
        providerPropertyId: row.providerPropertyId,
        providerRoomTypeId: row.providerRoomTypeId,
        providerRatePlanId: row.providerRatePlanId,
      });
    },
    async dailyRates() {
      return [0, 1, 2].flatMap((k) => [
        {
          date: d(k),
          accommodationTypeCode: 'exely-900001',
          ratePlanId: 'p2',
          occupancy: 1,
          priceMinor: 1_540_000n,
        },
        {
          date: d(k),
          accommodationTypeCode: 'exely-900003',
          ratePlanId: 'p2',
          occupancy: 1,
          priceMinor: 900_000n,
        },
      ]);
    },
    async restrictions() {
      return [];
    },
    async audit(action) {
      audits.push(action);
    },
    async categoryUnits() {
      return [
        { code: 'exely-900001', active: 1, capacityAdults: 1 },
        { code: 'exely-900003', active: 2, capacityAdults: 1 },
      ];
    },
    async categoryBlocks() {
      return [];
    },
    async soldItems() {
      // одно проданное проживание в dorm на ночь d(1) — с ячейкой или без, для канала это занято
      return [{ accommodationTypeCode: 'exely-900003', arrivalDate: d(1), departureDate: d(2) }];
    },
    async ratePlanIdsByCode() {
      return { 'exely-800002': 'p2' };
    },
    async enqueueOutbox(_p, kind, payload) {
      outbox.push({
        id: `o${outbox.length + 1}`,
        kind,
        payload,
        attempts: 0,
        createdAt: new Date(),
        status: 'PENDING',
      });
      return `o${outbox.length}`;
    },
    async pendingOutbox(_p, kind) {
      return outbox.filter((o) => o.kind === kind && o.status === 'PENDING');
    },
    async markOutboxSent(ids, taskId) {
      for (const o of outbox) if (ids.includes(o.id)) Object.assign(o, { status: 'SENT', taskId });
    },
    async markOutboxRetry(ids, error, _next, failed) {
      for (const o of outbox)
        if (ids.includes(o.id))
          Object.assign(o, {
            attempts: o.attempts + 1,
            lastError: error,
            status: failed ? 'FAILED' : 'PENDING',
          });
    },
    async outboxSummary() {
      return {
        pending: outbox.filter((o) => o.status === 'PENDING').length,
        failed: 0,
        sent: outbox.filter((o) => o.status === 'SENT').length,
        lastSentAt: null,
        lastTaskId: null,
        oldestPendingAt: null,
      };
    },
  };
  const board: ChessboardRepository = {
    async units() {
      return [
        {
          id: 'u1',
          code: '9001',
          kind: 'ROOM',
          accommodationTypeCode: 'exely-900001',
          accommodationTypeName: 'Одиночная',
        },
        {
          id: 'u2',
          code: '9010',
          kind: 'BED',
          accommodationTypeCode: 'exely-900003',
          accommodationTypeName: 'Dorm',
        },
        {
          id: 'u3',
          code: '9011',
          kind: 'BED',
          accommodationTypeCode: 'exely-900003',
          accommodationTypeName: 'Dorm',
        },
      ];
    },
    async allocations() {
      return [
        {
          unitId: 'u2',
          startDate: d(1),
          endDate: d(2),
          itemId: 'i1',
          itemStatus: 'CONFIRMED',
          confirmationNumber: 'B',
          guestLabel: 'Гость',
        },
      ];
    },
    async blocks() {
      return [];
    },
    async reservation() {
      return null;
    },
  };
  return { gateway, repo, board, calls, mappings, audits, outbox, today, d, webhooks };
}

describe('Channex setup and full sync (contract on fakes)', () => {
  let app: INestApplication;
  let fakes: ReturnType<typeof makeFakes> = makeFakes();
  beforeEach(() => {
    fakes = makeFakes();
  });
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [ChannelsModule] })
      .overrideProvider(CHANNEX_GATEWAY)
      .useFactory({
        factory: () =>
          new Proxy(
            {},
            { get: (_t, k) => (fakes.gateway as unknown as Record<string, unknown>)[k as string] },
          ),
      })
      .overrideProvider(CHANNELS_REPOSITORY)
      .useFactory({
        factory: () =>
          new Proxy(
            {},
            { get: (_t, k) => (fakes.repo as unknown as Record<string, unknown>)[k as string] },
          ),
      })
      .overrideProvider(CHESSBOARD_REPOSITORY)
      .useFactory({
        factory: () =>
          new Proxy(
            {},
            { get: (_t, k) => (fakes.board as unknown as Record<string, unknown>)[k as string] },
          ),
      })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('setup creates property, room types and one rate plan per category, saves mapping; second run creates nothing', async () => {
    const first = await request(app.getHttpServer()).post('/channels/channex/setup').expect(200);
    expect(first.body.created).toEqual({ property: true, roomTypes: 2, ratePlans: 2 });
    expect(first.body.roomTypes).toEqual([
      { categoryCode: 'exely-900001', providerRoomTypeId: 'rt-2', providerRatePlanId: 'rp-3' },
      { categoryCode: 'exely-900003', providerRoomTypeId: 'rt-4', providerRatePlanId: 'rp-5' },
    ]);
    expect(fakes.calls.map((c) => c.op)).toEqual([
      'createProperty',
      'createRoomType',
      'createRatePlan',
      'createRoomType',
      'createRatePlan',
    ]);
    expect(fakes.calls[3]!.body).toMatchObject({
      property_id: 'prop-1',
      title: 'Dorm',
      room_kind: 'dorm',
      capacity: 18,
      count_of_rooms: 2,
    });
    expect(fakes.calls[4]!.body).toMatchObject({
      property_id: 'prop-1',
      room_type_id: 'rt-4',
      sell_mode: 'per_room',
      options: [{ occupancy: 1, is_primary: true }],
    });
    const second = await request(app.getHttpServer()).post('/channels/channex/setup').expect(200);
    expect(second.body.created).toEqual({ property: false, roomTypes: 0, ratePlans: 0 });
    expect(fakes.calls).toHaveLength(5);
    expect(fakes.audits).toEqual(['channex.setup', 'channex.setup']);
    const mapping = await request(app.getHttpServer()).get('/channels/channex/mapping').expect(200);
    expect(mapping.body).toHaveLength(3);
  });

  it('sync sends availability and restrictions as two calls with compressed ranges', async () => {
    await request(app.getHttpServer()).post('/channels/channex/setup').expect(200);
    const res = await request(app.getHttpServer())
      .post('/channels/channex/sync?days=3')
      .expect(200);
    expect(res.body).toMatchObject({
      from: fakes.today,
      to: fakes.d(2),
      tasks: ['task-a', 'task-r'],
    });
    const avail = fakes.calls.find((c) => c.op === 'updateAvailability')!
      .body as channex.ChannexAvailabilityValue[];
    expect(avail).toEqual([
      {
        property_id: 'prop-1',
        room_type_id: 'rt-2',
        date_from: fakes.today,
        date_to: fakes.d(2),
        availability: 1,
      },
      {
        property_id: 'prop-1',
        room_type_id: 'rt-4',
        date_from: fakes.today,
        date_to: fakes.today,
        availability: 2,
      },
      {
        property_id: 'prop-1',
        room_type_id: 'rt-4',
        date_from: fakes.d(1),
        date_to: fakes.d(1),
        availability: 1,
      },
      {
        property_id: 'prop-1',
        room_type_id: 'rt-4',
        date_from: fakes.d(2),
        date_to: fakes.d(2),
        availability: 2,
      },
    ]);
    const restr = fakes.calls.find((c) => c.op === 'updateRestrictions')!
      .body as channex.ChannexRestrictionValue[];
    expect(restr).toEqual([
      expect.objectContaining({
        rate_plan_id: 'rp-3',
        date_from: fakes.today,
        date_to: fakes.d(2),
        rate: 1540000,
        stop_sell: false,
      }),
      expect.objectContaining({
        rate_plan_id: 'rp-5',
        date_from: fakes.today,
        date_to: fakes.d(2),
        rate: 900000,
        stop_sell: false,
      }),
    ]);
  });

  it('sync without mapping → 422; setup with an unknown tariff → 422', async () => {
    await request(app.getHttpServer()).post('/channels/channex/sync').expect(422);
    fakes.repo.localSetup = async () => ({
      property: {
        id: 'P',
        name: 'x',
        currency: 'KZT',
        timezone: 'Asia/Almaty',
        country: 'KZ',
        city: 'A',
        address: null,
        email: null,
        phone: null,
      },
      categories: [],
      ratePlan: null,
    });
    await request(app.getHttpServer())
      .post('/channels/channex/setup?ratePlanCode=nope')
      .expect(422);
  });

  it('webhook (webhook-collection.md): register needs the secret, an https address and the Channex property; creates once, then updates; status and test', async () => {
    delete process.env.CHANNEX_WEBHOOK_SECRET;
    delete process.env.PUBLIC_API_URL;
    const post = (path: string, body: object = {}) =>
      request(app.getHttpServer()).post(path).send(body);
    await post('/channels/channex/webhook/register').expect(503); // секрета нет
    process.env.CHANNEX_WEBHOOK_SECRET = 'test-webhook-secret';
    await post('/channels/channex/webhook/register').expect(400); // адреса нет
    await post('/channels/channex/webhook/register', {
      callbackUrl: 'http://pms.example.kz/hook',
    }).expect(400); // не https
    await post('/channels/channex/webhook/register', {
      callbackUrl: 'https://pms.example.kz/hook',
    }).expect(422); // объекта в Channex нет
    await post('/channels/channex/setup').expect(200);
    const st0 = await request(app.getHttpServer())
      .get('/channels/channex/webhook/status')
      .expect(200);
    expect(st0.body).toMatchObject({
      registered: false,
      secretConfigured: true,
      expectedUrl: null,
    });

    process.env.PUBLIC_API_URL = 'https://pms.example.kz/';
    const r1 = await post('/channels/channex/webhook/register').expect(200);
    expect(r1.body).toMatchObject({
      created: true,
      callbackUrl: 'https://pms.example.kz/channels/channex/webhook',
      eventMask: 'booking',
      active: true,
    });
    expect(fakes.calls.find((c) => c.op === 'createWebhook')!.body).toMatchObject({
      property_id: 'prop-1',
      event_mask: 'booking',
      send_data: true,
      is_active: true,
      is_global: false,
      headers: { 'x-channex-webhook-secret': 'test-webhook-secret' },
    });
    const r2 = await post('/channels/channex/webhook/register').expect(200);
    expect(r2.body.created).toBe(false);
    expect(fakes.webhooks).toHaveLength(1); // один webhook на объект — повтор обновляет
    expect(fakes.calls.filter((c) => c.op === 'updateWebhook')).toHaveLength(1);
    const st = await request(app.getHttpServer())
      .get('/channels/channex/webhook/status')
      .expect(200);
    expect(st.body).toMatchObject({
      registered: true,
      callbackUrl: 'https://pms.example.kz/channels/channex/webhook',
      eventMask: 'booking',
      active: true,
      sendData: true,
      expectedUrl: 'https://pms.example.kz/channels/channex/webhook',
    });
    const t = await post('/channels/channex/webhook/test').expect(200);
    expect(t.body).toMatchObject({ statusCode: 400 });
    expect(t.body.verdict).toContain('секрет принят');
    expect(fakes.audits.filter((a) => a === 'channels.webhook.register')).toHaveLength(2);
    delete process.env.PUBLIC_API_URL;
    delete process.env.CHANNEX_WEBHOOK_SECRET;
  });
});
