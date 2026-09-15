import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { DeskModule } from './desk.module';
import { DESK_REPOSITORY, type DeskRepository, type DeskStay } from './desk.repository';

/** Сутки 2026-10-05 на вымышленных гостях: заезд без ячейки, заезд без гражданства, выезд с долгом, живущий. */
const stay = (over: Partial<DeskStay>): DeskStay => ({
  itemId: 'i0',
  confirmationNumber: 'B-0',
  guestLabel: 'Гость Тестовый',
  guestPhone: '+70000000000',
  unitCode: '9001',
  accommodationTypeName: 'Одноместная',
  arrivalDate: '2026-10-05',
  departureDate: '2026-10-07',
  status: 'CONFIRMED',
  balanceMinor: 0n,
  citizenship: 'KAZ',
  adults: 1,
  guestsRecorded: 1,
  ...over,
});

const repo: DeskRepository = {
  async stays(date) {
    if (date !== '2026-10-05') return [];
    return [
      stay({ itemId: 'i1', confirmationNumber: 'B-1', unitCode: null }),
      stay({ itemId: 'i2', confirmationNumber: 'B-2', citizenship: null }),
      // пустая строка в CHAR(3) хранится как три пробела — для стойки это тоже «нет гражданства»
      stay({ itemId: 'i7', confirmationNumber: 'B-7', citizenship: '   ' }),
      stay({ itemId: 'i3', confirmationNumber: 'B-3' }),
      // заявлено двое, карточка одна — для eQonaq нужен каждый гость (Q-098)
      stay({ itemId: 'i6', confirmationNumber: 'B-6', adults: 2, guestsRecorded: 1 }),
      stay({
        itemId: 'i4',
        confirmationNumber: 'B-4',
        arrivalDate: '2026-10-03',
        departureDate: '2026-10-05',
        status: 'CHECKED_IN',
        balanceMinor: 1_200_000n,
      }),
      stay({
        itemId: 'i5',
        confirmationNumber: 'B-5',
        arrivalDate: '2026-10-01',
        departureDate: '2026-10-09',
        status: 'CHECKED_IN',
      }),
      // заезд был позавчера, гость так и не заселён: не заезд дня и не живущий — стойка должна его видеть
      stay({
        itemId: 'i8',
        confirmationNumber: 'B-8',
        arrivalDate: '2026-10-03',
        departureDate: '2026-10-08',
        status: 'CONFIRMED',
      }),
    ];
  },
};

describe('desk day API', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [DeskModule] })
      .overrideProvider(DESK_REPOSITORY)
      .useValue(repo)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('делит сутки на заезды, выезды и живущих; называет, что мешает заселить; считает долг уезжающих', async () => {
    const r = await request(app.getHttpServer()).get('/desk/today?date=2026-10-05').expect(200);
    expect(r.body.counts).toEqual({
      arrivals: 5,
      departures: 1,
      inHouse: 1,
      toCheckIn: 5,
      toCheckOut: 1,
      overdue: 1,
    });
    // просроченный заезд — отдельным списком, с датой, когда должен был заехать
    expect(r.body.overdue).toMatchObject([
      { confirmationNumber: 'B-8', arrivalDate: '2026-10-03', status: 'CONFIRMED' },
    ]);
    expect(
      r.body.arrivals.map((a: { confirmationNumber: string }) => a.confirmationNumber),
    ).toEqual(['B-1', 'B-2', 'B-7', 'B-3', 'B-6']);
    // стойка сразу видит, почему нельзя заселить
    expect(r.body.arrivals[0]).toMatchObject({ blockedReason: 'нет ячейки' });
    expect(r.body.arrivals[1]).toMatchObject({ blockedReason: 'нет гражданства' });
    expect(r.body.arrivals[2]).toMatchObject({
      blockedReason: 'нет гражданства',
      citizenship: null,
    });
    expect(r.body.arrivals[3]).toMatchObject({ blockedReason: null });
    expect(r.body.arrivals[4]).toMatchObject({ blockedReason: 'карточек 1 из 2' });
    // выезжающий с долгом, и долг просуммирован
    expect(r.body.departures[0]).toMatchObject({
      confirmationNumber: 'B-4',
      status: 'CHECKED_IN',
      balanceMinor: '1200000',
    });
    expect(r.body.debtMinor).toBe('1200000');
    // живущий — тот, кто не выезжает сегодня
    expect(r.body.inHouse.map((x: { confirmationNumber: string }) => x.confirmationNumber)).toEqual(
      ['B-5'],
    );
  });

  it('пустые сутки и неверная дата', async () => {
    const empty = await request(app.getHttpServer()).get('/desk/today?date=2026-01-01').expect(200);
    expect(empty.body.counts).toEqual({
      arrivals: 0,
      departures: 0,
      inHouse: 0,
      toCheckIn: 0,
      toCheckOut: 0,
      overdue: 0,
    });
    expect(empty.body.debtMinor).toBe('0');
    await request(app.getHttpServer()).get('/desk/today?date=05.10.2026').expect(400);
  });
});
