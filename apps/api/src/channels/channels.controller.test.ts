import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const state = { hangListWebhooks: false };
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
      // Channex не отвечает: запрос висит (повторы клиента и пауза на 429 до минуты)
      if (state.hangListWebhooks) return new Promise<never>(() => {});
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
  /** Вымышленные события ленты: одна ревизия связана с бронью B-77 по unique_id (ADR-024) */
  const events: Array<{
    externalEventId: string;
    type: string;
    status: string;
    attempts: number;
    receivedVia: 'WEBHOOK' | 'PULL' | 'MANUAL';
    receivedAt: string;
    processedAt: string | null;
    lastError: string | null;
    uniqueId: string | null;
    otaName: string | null;
    confirmationNumber: string | null;
    payload: unknown;
  }> = [
    {
      externalEventId: 'rev-new',
      type: 'booking_new',
      status: 'PROCESSED',
      attempts: 1,
      receivedVia: 'WEBHOOK',
      receivedAt: '2026-09-15T02:41:00Z',
      processedAt: '2026-09-15T02:41:02Z',
      lastError: null,
      uniqueId: 'BDC-4821-7731',
      otaName: 'Booking.com',
      confirmationNumber: 'B-77',
      payload: {
        unique_id: 'BDC-4821-7731',
        ota_name: 'Booking.com',
        status: 'new',
        arrival_date: '2026-09-16',
        departure_date: '2026-09-18',
        occupancy: { adults: 1, children: 0, infants: 0 },
        amount: '16000.00',
        currency: 'KZT',
        customer: { name: 'Гость', surname: 'Тестовый', phone: '+70000000009' },
        rooms: [],
      },
    },
    {
      externalEventId: 'rev-failed',
      type: 'booking_new',
      status: 'FAILED',
      attempts: 6,
      receivedVia: 'PULL',
      receivedAt: '2026-09-15T01:00:00Z',
      processedAt: null,
      lastError: 'Несколько перенесённых броней подходят',
      uniqueId: 'EXP-1',
      otaName: 'Expedia',
      confirmationNumber: null,
      payload: { unique_id: 'EXP-1', ota_name: 'Expedia', status: 'new' },
    },
  ];
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const d = (k: number) => {
    const x = new Date(`${today}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + k);
    return x.toISOString().slice(0, 10);
  };
  const repo: ChannelsRepository = {
    async lastEventAt() {
      return null;
    },
    async lastAuditAt() {
      return null;
    },
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
    async recentEvents() {
      return [];
    },
    // Срез 7.2: журнал с фильтрами и страница ревизии — на вымышленных событиях (ADR-010)
    async eventsPage(_p, q) {
      // Как Prisma: значение вне перечисления ExternalEventStatus — исключение, а не пустая выборка
      if (q.status && !['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED'].includes(q.status))
        throw new Error(`Invalid value for argument \`status\`: ${q.status}`);
      let list = events.filter(
        (e) =>
          (!q.status || e.status === q.status) &&
          (!q.type || e.type === q.type) &&
          (!q.q ||
            e.externalEventId.includes(q.q) ||
            (e.uniqueId ?? '').includes(q.q) ||
            (e.confirmationNumber ?? '').includes(q.q)),
      );
      const total = list.length;
      list = list.slice(q.offset, q.offset + q.limit);
      return {
        total,
        rows: list.map((r) =>
          Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'payload')),
        ) as never,
      };
    },
    async eventByRevision(_p, revisionId) {
      const e = events.find((x) => x.externalEventId === revisionId);
      if (!e) return null;
      return Object.fromEntries(
        Object.entries(e).filter(
          ([k]) => !['uniqueId', 'otaName', 'confirmationNumber'].includes(k),
        ),
      ) as never;
    },
    async reservationCardByExternalId(externalId) {
      if (externalId !== 'BDC-4821-7731') return null;
      return {
        card: {
          confirmationNumber: 'B-77',
          source: 'OTA',
          channel: 'Booking.com',
          status: 'CONFIRMED',
          arrivalDate: d(1),
          departureDate: d(3),
          adults: 1,
          children: 0,
          currency: 'KZT',
          totalAmountMinor: '1600000',
          notes: null,
          primaryGuest: null,
          items: [
            {
              id: 'i-77',
              accommodationTypeCode: 'exely-900001',
              accommodationTypeName: 'Одиночная',
              arrivalDate: d(1),
              departureDate: d(3),
              status: 'CONFIRMED',
              priceMinor: '1600000',
              ratePlanCode: null,
              ratePlanName: null,
              adults: 1,
              children: 0,
              unitCode: '9001',
              guests: [],
            },
          ],
        },
        balances: { 'i-77': '0' },
      };
    },
    async outboxRows(_p, q) {
      return outbox
        .filter((o) => !q.status || o.status === q.status)
        .slice(0, q.limit)
        .map((o) => ({
          id: o.id,
          kind: o.kind,
          payload: o.payload,
          status: o.status as 'PENDING' | 'SENT' | 'FAILED',
          attempts: o.attempts,
          taskId: o.taskId ?? null,
          lastError: o.lastError ?? null,
          createdAt: o.createdAt.toISOString(),
          sentAt: null,
        }));
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
    async unassignedStays() {
      return [];
    },
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
    async soldStays() {
      return [];
    },
    async blocks() {
      return [];
    },
    async reservation() {
      return null;
    },
  };
  return { gateway, repo, board, calls, mappings, audits, outbox, today, d, webhooks, state };
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

  it('availability/changed (ADR-032): only the named categories and nights go to the outbox as one AVAILABILITY delta; bad input → 400', async () => {
    await request(app.getHttpServer()).post('/channels/channex/setup').expect(200);
    await request(app.getHttpServer())
      .post('/channels/channex/availability/changed')
      .send({ categoryCodes: ['exely-900003'], from: fakes.today, toExclusive: fakes.d(3) })
      .expect(200, { accepted: true });
    expect(fakes.outbox.map((o) => o.kind)).toEqual(['AVAILABILITY']);
    expect(fakes.outbox[0]!.payload).toEqual([
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
    const bad = [
      {},
      { categoryCodes: [], from: fakes.today, toExclusive: fakes.d(1) },
      { categoryCodes: [''], from: fakes.today, toExclusive: fakes.d(1) },
      { categoryCodes: ['exely-900003'], from: '13.09.2026', toExclusive: fakes.d(1) },
      { categoryCodes: ['exely-900003'], from: fakes.d(2), toExclusive: fakes.d(2) },
      { categoryCodes: ['exely-900003'], from: fakes.today, toExclusive: '2099-01-01' },
    ];
    for (const body of bad)
      await request(app.getHttpServer())
        .post('/channels/channex/availability/changed')
        .send(body)
        .expect(400);
    expect(fakes.outbox).toHaveLength(1);
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
    // Д1: постоянный адрес задан — быстрый туннель (или ошибка настройки) не перерегистрирует webhook на свой
    const hijack = await post('/channels/channex/webhook/register', {
      callbackUrl: 'https://quick-tunnel.trycloudflare.com/channels/channex/webhook',
    }).expect(409);
    expect(hijack.body.message).toContain('PUBLIC_API_URL');
    // тот же адрес явно — можно (кнопка на /channels шлёт без адреса, скрипт — с ним)
    await post('/channels/channex/webhook/register', {
      callbackUrl: 'https://pms.example.kz/channels/channex/webhook',
    }).expect(200);
    expect(fakes.webhooks).toHaveLength(1); // один webhook на объект — повтор обновляет
    expect(fakes.calls.filter((c) => c.op === 'updateWebhook')).toHaveLength(2);
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
    expect(fakes.audits.filter((a) => a === 'channels.webhook.register')).toHaveLength(3);
    delete process.env.PUBLIC_API_URL;
    delete process.env.CHANNEX_WEBHOOK_SECRET;
  });
  it('срез 7.2: журнал событий — фильтр по статусу, поиск по номеру брони, постраничность, бронь у ревизии', async () => {
    const all = await request(app.getHttpServer()).get('/channels/channex/events').expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.rows[0]).toMatchObject({
      externalEventId: 'rev-new',
      confirmationNumber: 'B-77',
      otaName: 'Booking.com',
    });
    expect(JSON.stringify(all.body)).not.toContain('Тестовый'); // payload в списке не отдаётся
    const failed = await request(app.getHttpServer())
      .get('/channels/channex/events?status=FAILED')
      .expect(200);
    expect(failed.body.rows.map((r: { externalEventId: string }) => r.externalEventId)).toEqual([
      'rev-failed',
    ]);
    const byNumber = await request(app.getHttpServer())
      .get('/channels/channex/events?q=B-77')
      .expect(200);
    expect(byNumber.body.total).toBe(1);
    // Статуса «пропущено» в базе нет: фильтр с ним не должен ронять всю таблицу событий
    const unknown = await request(app.getHttpServer())
      .get('/channels/channex/events?status=SKIPPED')
      .expect(200);
    expect(unknown.body.total).toBeGreaterThan(0);
    const page2 = await request(app.getHttpServer())
      .get('/channels/channex/events?limit=1&offset=1')
      .expect(200);
    expect(page2.body.total).toBe(2);
    expect(page2.body.rows).toHaveLength(1);
  });

  it('срез 7.2: страница ревизии — факты без ПД, связанная бронь, категория по маппингу; неизвестная — 404', async () => {
    await request(app.getHttpServer())
      .post('/channels/channex/setup')
      .send({ ratePlanCode: 'OTA' })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get('/channels/channex/events/rev-new')
      .expect(200);
    expect(res.body.facts).toMatchObject({
      uniqueId: 'BDC-4821-7731',
      arrivalDate: '2026-09-16',
      amount: '16000.00',
    });
    expect(JSON.stringify(res.body)).not.toContain('+70000000009');
    expect(res.body.reservation.confirmationNumber).toBe('B-77');
    expect(res.body.balances).toEqual({ 'i-77': '0' });
    expect(Object.values(res.body.categoryByRoomType)).toContain('exely-900001');
    await request(app.getHttpServer()).get('/channels/channex/events/nope').expect(404);
  });

  it('срез 7.2: строки очереди — что ушло, на какие даты, по каким категориям; фильтр по статусу', async () => {
    await request(app.getHttpServer())
      .post('/channels/channex/setup')
      .send({ ratePlanCode: 'OTA' })
      .expect(200);
    // полная выгрузка идёт в Channex напрямую; в очередь пишет дельта остатков (ADR-032)
    await request(app.getHttpServer())
      .post('/channels/channex/availability/changed')
      .send({ categoryCodes: ['exely-900001'], from: fakes.today, toExclusive: fakes.d(2) })
      .expect(200);
    await request(app.getHttpServer()).post('/channels/channex/outbox/flush').expect(200);
    const rows = await request(app.getHttpServer())
      .get('/channels/channex/outbox/rows')
      .expect(200);
    expect(rows.body.length).toBeGreaterThan(0);
    const avail = rows.body.find((r: { kind: string }) => r.kind === 'AVAILABILITY');
    expect(avail).toMatchObject({ status: 'SENT', messages: expect.any(Number) });
    expect(avail.dateFrom <= avail.dateTo).toBe(true);
    expect(avail.roomTypes).toContain('exely-900001'); // код категории по маппингу, имя подставит экран
    const pending = await request(app.getHttpServer())
      .get('/channels/channex/outbox/rows?status=PENDING')
      .expect(200);
    expect(pending.body.every((r: { status: string }) => r.status === 'PENDING')).toBe(true);
  });

  it('webhook/status: Channex молчит — 504 за отведённое время, а не минута ожидания страницы «Подключения»', async () => {
    vi.stubEnv('CHANNEX_STATUS_TIMEOUT_MS', '50');
    fakes.state.hangListWebhooks = true;
    try {
      await request(app.getHttpServer()).post('/channels/channex/setup').expect(200);
      const started = Date.now();
      const res = await request(app.getHttpServer()).get('/channels/channex/webhook/status');
      expect(res.status).toBe(504);
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      fakes.state.hangListWebhooks = false;
      vi.unstubAllEnvs();
    }
  });
});
