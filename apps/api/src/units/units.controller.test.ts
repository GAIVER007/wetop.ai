import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ARI_PUBLISHER, type AriPublisher } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY } from '../channels/channels.repository';
import { PrismaService } from '../database/prisma.provider';
import { UnitsModule } from './units.module';
import { UNITS_REPOSITORY, type UnitCard, type UnitsRepository } from './units.repository';

function makeFakes() {
  const blocks: Array<{
    id: string;
    unitId: string;
    dateFrom: string;
    dateTo: string;
    type: string;
    reason: string | null;
  }> = [];
  const published: unknown[] = [];
  const audits: string[] = [];
  /** Записи журнала, пришедшие вместе с блокировкой (одна транзакция), и отдельные вызовы audit */
  const blockAudits: unknown[] = [];
  const separateAudits: string[] = [];
  let hk: 'DIRTY' | 'CLEAN' | 'INSPECTED' = 'DIRTY';
  const unit = { id: 'u1', code: '9001', accommodationTypeId: 'type-1', accommodationTypeCode: 'category-single' };
  const card = (): UnitCard => ({
    id: 'u1',
    code: '9001',
    kind: 'ROOM',
    active: true,
    housekeepingStatus: hk,
    accommodationTypeCode: 'category-single',
    accommodationTypeName: 'Одиночная',
    roomNumber: '9001',
    buildingName: 'Тестовый',
    floorName: '1',
    capacity: 1,
    blocks: blocks.map((b) => ({
      id: b.id,
      dateFrom: b.dateFrom,
      dateTo: b.dateTo,
      type: b.type as 'MAINTENANCE',
      reason: b.reason,
    })),
    stays: [
      {
        confirmationNumber: 'B-1',
        startDate: '2026-10-05',
        endDate: '2026-10-07',
        status: 'CONFIRMED',
        guestLabel: 'Гость',
      },
    ],
    housekeepingHistory: [],
    createdAt: '2026-01-12T09:30:00.000Z',
    updatedAt: '2026-03-20T05:24:00.000Z',
  });
  const repo: UnitsRepository = {
    async today() {
      // как прежний жёсткий UTC+5 — под фальшивыми часами тестов даёт ту же дату
      return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    },
    async unitByCode(code) {
      return code === '9001' ? { ...unit, housekeepingStatus: hk } : null;
    },
    async card(code) {
      return code === '9001' ? card() : null;
    },
    async staysOverlapping(_id, from, to) {
      return from < '2026-10-07' && to > '2026-10-05'
        ? [{ confirmationNumber: 'B-1', startDate: '2026-10-05', endDate: '2026-10-07' }]
        : [];
    },
    // Блокировка и её запись в журнале — одна транзакция (SECURITY.md §6): журнал приходит вместе с командой
    async createBlock(unit, b, audit) {
      blocks.push({ id: `blk${blocks.length + 1}`, unitId: unit.id, ...b });
      audits.push('unit.block');
      blockAudits.push(audit);
      return `blk${blocks.length}`;
    },
    async blockById(id) {
      const b = blocks.find((x) => x.id === id);
      return b ? { id: b.id, unitId: b.unitId, dateFrom: b.dateFrom, dateTo: b.dateTo } : null;
    },
    async deleteBlock(id, audit) {
      const i = blocks.findIndex((x) => x.id === id);
      if (i >= 0) blocks.splice(i, 1);
      audits.push('unit.unblock');
      blockAudits.push(audit);
    },
    async setHousekeeping(_id, _from, to) {
      hk = to;
    },
    async audit(_e, action) {
      audits.push(action);
      separateAudits.push(action);
    },
  };
  const publisher: AriPublisher = {
    async reservationChanged(c) {
      published.push(c);
    },
    async ratesChanged() {
      return 0;
    },
  };
  return { repo, publisher, blocks, published, audits, blockAudits, separateAudits };
}

describe('units API: blocks and housekeeping', () => {
  let app: INestApplication;
  let fakes = makeFakes();
  beforeEach(() => {
    fakes = makeFakes();
  });
  beforeAll(async () => {
    const proxy = (get: () => object) =>
      new Proxy({}, { get: (_t, k) => (get() as Record<string, unknown>)[k as string] });
    const m = await Test.createTestingModule({ imports: [UnitsModule] })
      .overrideProvider(UNITS_REPOSITORY)
      .useFactory({ factory: () => proxy(() => fakes.repo) })
      .overrideProvider(ARI_PUBLISHER)
      .useFactory({ factory: () => proxy(() => fakes.publisher) })
      .overrideProvider(CHANNELS_REPOSITORY)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /units/:code returns the card; 404 for unknown', async () => {
    const res = await request(app.getHttpServer()).get('/units/9001').expect(200);
    expect(res.body).toMatchObject({
      code: '9001',
      housekeepingStatus: 'DIRTY',
      stays: [{ confirmationNumber: 'B-1' }],
      createdAt: '2026-01-12T09:30:00.000Z',
      updatedAt: '2026-03-20T05:24:00.000Z',
    });
    await request(app.getHttpServer()).get('/units/nope').expect(404);
  });
  it('код ячейки с управляющим символом (%00, перевод строки) — 404 без запроса к базе, а не 500', async () => {
    // Найдено сторожем системы 13.09.2026 (неисправность api.error на GET /units/:code): Postgres отвергает NUL в
    // тексте («invalid byte sequence for encoding "UTF8": 0x00») — подделка репозитория ведёт себя так же
    const pg = (code: string) => {
      if ([...code].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127))
        throw new Error('invalid byte sequence for encoding "UTF8": 0x00');
    };
    const { card, unitByCode } = fakes.repo;
    fakes.repo.card = async (code, from, to) => (pg(code), card(code, from, to));
    fakes.repo.unitByCode = async (code) => (pg(code), unitByCode(code));
    await request(app.getHttpServer()).get('/units/%00').expect(404);
    await request(app.getHttpServer())
      .post('/units/%00/housekeeping')
      .send({ status: 'CLEAN' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/units/90%0A01/blocks')
      .send({ dateFrom: '2026-10-08', dateTo: '2026-10-10', type: 'MAINTENANCE' })
      .expect(404);
    await request(app.getHttpServer()).delete('/units/%7F/blocks/blk1').expect(404);
  });
  it('block: refuses nights with a stay (409 names the booking), creates otherwise, publishes availability delta, unblock removes', async () => {
    const busy = await request(app.getHttpServer())
      .post('/units/9001/blocks')
      .send({ dateFrom: '2026-10-06', dateTo: '2026-10-08', type: 'MAINTENANCE' })
      .expect(409);
    expect(busy.body.message).toContain('B-1');
    await request(app.getHttpServer())
      .post('/units/9001/blocks')
      .send({ dateFrom: '2026-10-08', dateTo: '2026-10-08', type: 'MAINTENANCE' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/units/9001/blocks')
      .send({ dateFrom: '2026-10-08', dateTo: '2026-10-10', type: 'WEIRD' })
      .expect(400);
    const ok = await request(app.getHttpServer())
      .post('/units/9001/blocks')
      .send({
        dateFrom: '2026-10-08',
        dateTo: '2026-10-10',
        type: 'MAINTENANCE',
        reason: 'сломан замок',
      })
      .expect(201);
    expect(ok.body.blocks).toEqual([
      {
        id: 'blk1',
        dateFrom: '2026-10-08',
        dateTo: '2026-10-10',
        type: 'MAINTENANCE',
        reason: 'сломан замок',
      },
    ]);
    expect(fakes.published).toEqual([
      { categoryCodes: ['category-single'], from: '2026-10-08', toExclusive: '2026-10-10' },
    ]);
    await request(app.getHttpServer()).delete('/units/9001/blocks/blk1').expect(200);

    expect(fakes.blocks).toHaveLength(0);
    expect(fakes.published).toHaveLength(2);
    await request(app.getHttpServer()).delete('/units/9001/blocks/blk1').expect(404);
    expect(fakes.audits).toEqual(['unit.block', 'unit.unblock']);
    // SECURITY.md §6: блокировка и снятие пишутся в журнал в той же транзакции, не отдельным вызовом
    expect(fakes.separateAudits).toEqual([]);
    // id блокировки дописывает репозиторий в той же транзакции — до записи его нет
    expect(fakes.blockAudits[0]).toMatchObject({
      before: [],
      after: { dateFrom: '2026-10-08', dateTo: '2026-10-10', type: 'MAINTENANCE', reason: 'сломан замок' },
    });
    expect(fakes.blockAudits[1]).toMatchObject({ unitId: 'u1', before: { id: 'blk1' } });
    // Q-169: пока база не в РК, почта и телефоны в причине блокировки маскируются
    const piiBefore = process.env.PII_STORAGE;
    delete process.env.PII_STORAGE;
    try {
      const masked = await request(app.getHttpServer())
        .post('/units/9001/blocks')
        .send({
          dateFrom: '2026-10-12',
          dateTo: '2026-10-13',
          type: 'MAINTENANCE',
          reason: 'мастер, звонить +7 701 234 56 78',
        })
        .expect(201);
      expect(JSON.stringify(masked.body)).not.toContain('701 234 56 78');
      expect(JSON.stringify(masked.body)).toContain('мастер, звонить <телефон>');
      // и в журнале причина та же, с маской — не как пришла
      expect(JSON.stringify(fakes.blockAudits.at(-1))).not.toContain('701 234 56 78');
    } finally {
      if (piiBefore === undefined) delete process.env.PII_STORAGE;
      else process.env.PII_STORAGE = piiBefore;
    }
  });
  // Аудит 26.09, С-37: блокировка до 9999 года (опечатка в годе) — 2,9 млн дней, которые потом обходил каждый расчёт
  it('блокировка длиннее трёх лет — 400 словами, ничего не создано', async () => {
    const res = await request(app.getHttpServer())
      .post('/units/9001/blocks')
      .send({ dateFrom: '2026-10-01', dateTo: '9999-12-31', type: 'MAINTENANCE' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/трёх лет/);
  });

  it('housekeeping status change is recorded once per change', async () => {
    const r = await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'CLEAN' })
      .expect(200);
    expect(r.body.housekeepingStatus).toBe('CLEAN');
    await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'CLEAN' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'WET' })
      .expect(400);
    expect(fakes.audits).toEqual(['unit.housekeeping']);
  });
  it('housekeeping follows the cycle: dirty → clean → inspected, no skipping, back to dirty from any step', async () => {
    // требует уборки → сразу «проверено»: отказ словами — сначала уборка; в журнал ничего не пишется
    const skip = await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'INSPECTED' })
      .expect(409);
    expect(skip.body.message).toContain('сначала «Убрано»');
    expect(fakes.audits).toEqual([]);
    await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'CLEAN' })
      .expect(200);
    const done = await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'INSPECTED' })
      .expect(200);
    expect(done.body.housekeepingStatus).toBe('INSPECTED');
    // проверенную нельзя «разубрать», но можно снова отправить в уборку
    await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'CLEAN' })
      .expect(409);
    const again = await request(app.getHttpServer())
      .post('/units/9001/housekeeping')
      .send({ status: 'DIRTY' })
      .expect(200);
    expect(again.body.housekeepingStatus).toBe('DIRTY');
    expect(fakes.audits).toEqual(['unit.housekeeping', 'unit.housekeeping', 'unit.housekeeping']);
  });
});
