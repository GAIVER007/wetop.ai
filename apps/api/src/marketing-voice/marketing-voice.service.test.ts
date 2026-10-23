import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MarketingVoiceService } from './marketing-voice.service';
import type {
  CallbackRecord,
  CallRecord,
  MarketingVoiceRepository,
  ReadScope,
  SummaryData,
} from './marketing-voice.repository';

const SCOPE: ReadScope = { organizationId: 'org-1', locationId: 'loc-1', timezone: 'Asia/Almaty' };

const CALL: CallRecord = {
  id: 'c1',
  receivedAt: new Date('2026-10-22T05:00:00Z'),
  callerMasked: '***2233',
  state: 'ENDED',
  direction: 'INBOUND',
  durationSeconds: 120,
  transferRequested: false,
  callbackRequested: true,
  endReason: 'hangup',
};
const CB: CallbackRecord = {
  id: 'b1',
  callId: 'c1',
  phone: '+77001112233',
  name: 'Айдана',
  note: 'окрашивание',
  status: 'NEW',
  createdAt: new Date('2026-10-22T05:01:00Z'),
  doneAt: null,
};

class FakeRepo implements MarketingVoiceRepository {
  scopeError: Error | null = null;
  writable = true;
  summaryArgs: unknown[] = [];
  callsArgs: unknown[] = [];
  cbArgs: unknown[] = [];
  closeArgs: unknown[] = [];
  summaryData: SummaryData = {
    total: 4,
    byState: { RECEIVED: 0, ANSWERED: 1, ENDED: 2, REJECTED: 1, FAILED: 0 },
    answered: 3,
    withCallback: 2,
    withTransfer: 1,
    durationSum: 300,
    durationCount: 2,
  };
  closeResult: CallbackRecord | null = { ...CB, status: 'DONE', doneAt: new Date('2026-10-22T06:00:00Z') };
  async bookingAgent() {
    return null;
  }
  async readiness() {
    return [];
  }
  async saveBooking() {
    /* настройка брони проверяется в marketing-voice-booking.service.test.ts */
  }
  async scope(): Promise<ReadScope> {
    if (this.scopeError) throw this.scopeError;
    return SCOPE;
  }
  async assertWritable(): Promise<void> {
    if (!this.writable) throw new Error('read only');
  }
  async summary(scope: ReadScope, start: Date, end: Date) {
    this.summaryArgs = [scope.locationId, start, end];
    return this.summaryData;
  }
  async calls(scope: ReadScope, start: Date, end: Date, limit: number, offset: number) {
    this.callsArgs = [scope.locationId, start, end, limit, offset];
    return { rows: [CALL], total: 1 };
  }
  async callbacks(scope: ReadScope, status: 'NEW' | 'DONE' | null, limit: number) {
    this.cbArgs = [scope.locationId, status, limit];
    return [CB];
  }
  async closeCallback(scope: ReadScope, id: string, userId: string | null) {
    this.closeArgs = [scope.locationId, id, userId];
    return this.closeResult;
  }
}

const service = (repo = new FakeRepo(), userId: string | null = 'user-1') =>
  ({ repo, svc: new MarketingVoiceService(repo, () => userId, () => new Date('2026-10-22T07:00:00Z')) });

describe('сводка', () => {
  it('считает числа из журнала и окно месяца в поясе филиала', async () => {
    const { repo, svc } = service();
    const view = await svc.summary('2026-10');
    expect(view).toMatchObject({
      month: '2026-10',
      timezone: 'Asia/Almaty',
      hasData: true,
      totals: { calls: 4, answered: 3, ended: 2, rejected: 1, failed: 0, callbacks: 2, transfers: 1, avgDurationSeconds: 150 },
    });
    const [loc, start, end] = repo.summaryArgs as [string, Date, Date];
    expect(loc).toBe('loc-1');
    // Алматы UTC+5: октябрь начинается 30 сентября 19:00 UTC
    expect(start.toISOString()).toBe('2026-09-30T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-31T19:00:00.000Z');
  });

  it('без звонков: hasData=false и средняя длительность null, а не ноль', async () => {
    const repo = new FakeRepo();
    repo.summaryData = { total: 0, byState: { RECEIVED: 0, ANSWERED: 0, ENDED: 0, REJECTED: 0, FAILED: 0 }, answered: 0, withCallback: 0, withTransfer: 0, durationSum: 0, durationCount: 0 };
    const view = await service(repo).svc.summary('2026-10');
    expect(view.hasData).toBe(false);
    expect(view.totals.avgDurationSeconds).toBeNull();
  });

  it('месяц по умолчанию текущий по часам филиала; неверный формат 400', async () => {
    const { svc } = service();
    expect((await svc.summary(undefined)).month).toBe('2026-10');
    for (const bad of ['2026-13', '26-10', '2026-1', 'октябрь', '2026-10-01'])
      await expect(svc.summary(bad)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('без выбранного филиала ошибка репозитория (409) доходит как есть', async () => {
    const repo = new FakeRepo();
    repo.scopeError = new ConflictException('Выберите филиал');
    await expect(service(repo).svc.summary('2026-10')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('список звонков', () => {
  it('строки без внутренних полей, время ISO UTC', async () => {
    const { svc } = service();
    const view = await svc.calls({ month: '2026-10' });
    expect(view.total).toBe(1);
    expect(view.rows[0]).toEqual({
      id: 'c1',
      receivedAt: '2026-10-22T05:00:00.000Z',
      callerMasked: '***2233',
      state: 'ENDED',
      direction: 'INBOUND',
      durationSeconds: 120,
      transferRequested: false,
      callbackRequested: true,
      endReason: 'hangup',
    });
  });

  it('limit по умолчанию 50, не больше 100; offset не отрицательный', async () => {
    const { repo, svc } = service();
    await svc.calls({});
    expect(repo.callsArgs.slice(3)).toEqual([50, 0]);
    await svc.calls({ limit: '1000', offset: '20' });
    expect(repo.callsArgs.slice(3)).toEqual([100, 20]);
    await expect(svc.calls({ limit: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.calls({ offset: '-1' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.calls({ limit: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('просьбы о звонке', () => {
  it('отдаёт полный номер и фильтрует по статусу', async () => {
    const { repo, svc } = service();
    const rows = await svc.callbacks({ status: 'NEW' });
    expect(rows[0]).toMatchObject({ id: 'b1', phone: '+77001112233', status: 'NEW', doneAt: null });
    expect(repo.cbArgs).toEqual(['loc-1', 'NEW', 100]);
    await svc.callbacks({});
    expect(repo.cbArgs[1]).toBeNull();
    await expect(svc.callbacks({ status: 'ALL' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('закрытие: только DONE, автор из запроса, организация должна быть доступна для записи', async () => {
    const { repo, svc } = service();
    const out = await svc.closeCallback('b1', { status: 'DONE' });
    expect(out).toMatchObject({ id: 'b1', status: 'DONE' });
    expect(repo.closeArgs).toEqual(['loc-1', 'b1', 'user-1']);
    await expect(svc.closeCallback('b1', { status: 'NEW' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.closeCallback('b1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('чужая или несуществующая просьба 404', async () => {
    const repo = new FakeRepo();
    repo.closeResult = null;
    await expect(service(repo).svc.closeCallback('b9', { status: 'DONE' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('организация только для чтения: закрыть нельзя', async () => {
    const repo = new FakeRepo();
    repo.writable = false;
    await expect(service(repo).svc.closeCallback('b1', { status: 'DONE' })).rejects.toThrow('read only');
    expect(repo.closeArgs).toEqual([]);
  });
});
