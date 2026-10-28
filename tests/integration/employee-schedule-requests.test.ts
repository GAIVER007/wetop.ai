import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

// Владелец 28.10.2026 (DATA_MODEL SCHEDULE-REQUESTS-20261028): мастер предлагает изменение графика, решает руководитель.
const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const portal = new EmployeePortalService({ db } as PrismaService, null);
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
const as = <T>(actor: 'ownerA' | 'staffA' | 'staffB', fn: () => Promise<T>) =>
  withSignedInUser({ ...f.actors[actor], scope: 'LOCATION' as const, locationId: f.locationA }, fn);
const week = (from: string, to: string) => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, timeFrom: from, timeTo: to }));
const hours = async () => (await db.workingHours.findMany({ where: { employeeId: f.employeeA, locationId: f.locationA }, orderBy: { weekday: 'asc' } }))
  .map((h) => `${h.weekday} ${h.timeFrom.toISOString().slice(11, 16)}`);

describe('запросы графика мастера', () => {
  beforeAll(async () => {
    f = await seedPortalFixture(db);
    const dto = await as('ownerA', () => portal.get(f.employeeA, {}));
    await as('ownerA', () => portal.mutate(f.employeeA, 'week', { intervals: week('10:00', '18:00'), expectedRevision: dto.weekRevision }));
  });
  afterAll(async () => { await db.$disconnect(); });

  it('мастер не меняет неделю напрямую, а подаёт запрос; график не меняется до решения', async () => {
    const before = await hours();
    await expect(as('staffA', async () => {
      const dto = await portal.get(null, {});
      return portal.mutate(null, 'week', { intervals: week('12:00', '20:00'), expectedRevision: dto.weekRevision });
    })).rejects.toThrow(/График меняет руководитель/u);
    const dto = await as('staffA', () => portal.mutate(null, 'schedule-request', { kind: 'WEEK', intervals: week('12:00', '20:00') }));
    expect(dto.scheduleRequests).toEqual([expect.objectContaining({ kind: 'WEEK', status: 'PENDING' })]);
    expect(await hours()).toEqual(before);
    // второй запрос недели, пока первый ждёт, не принимается
    await expect(as('staffA', () => portal.mutate(null, 'schedule-request', { kind: 'WEEK', intervals: week('11:00', '19:00') }))).rejects.toThrow();
  });

  it('мастер не одобряет свой запрос; руководитель одобряет, и неделя применяется', async () => {
    const pending = (await as('ownerA', () => portal.get(f.employeeA, {}))).scheduleRequests.find((r) => r.status === 'PENDING')!;
    await expect(as('staffA', () => portal.mutate(f.employeeA, 'approve-schedule-request', {}, pending.id))).rejects.toThrow();
    const dto = await as('ownerA', () => portal.mutate(f.employeeA, 'approve-schedule-request', {}, pending.id));
    expect(dto.scheduleRequests.find((r) => r.id === pending.id)).toMatchObject({ status: 'APPROVED' });
    expect(await hours()).toEqual(['1 12:00', '2 12:00', '3 12:00', '4 12:00', '5 12:00']);
    // решённый запрос второй раз не решается
    await expect(as('ownerA', () => portal.mutate(f.employeeA, 'reject-schedule-request', {}, pending.id))).rejects.toThrow();
  });

  it('устаревший запрос недели не применяется поверх правки руководителя', async () => {
    await as('staffA', () => portal.mutate(null, 'schedule-request', { kind: 'WEEK', intervals: week('09:00', '17:00') }));
    const dto = await as('ownerA', () => portal.get(f.employeeA, {}));
    await as('ownerA', () => portal.mutate(f.employeeA, 'week', { intervals: week('14:00', '22:00'), expectedRevision: dto.weekRevision }));
    const pending = (await as('ownerA', () => portal.get(f.employeeA, {}))).scheduleRequests.find((r) => r.status === 'PENDING')!;
    await expect(as('ownerA', () => portal.mutate(f.employeeA, 'approve-schedule-request', {}, pending.id))).rejects.toThrow(/устарел/u);
    expect(await hours()).toEqual(['1 14:00', '2 14:00', '3 14:00', '4 14:00', '5 14:00']);
    await as('ownerA', () => portal.mutate(f.employeeA, 'reject-schedule-request', { note: 'Неделя уже другая' }, pending.id));
    const mine = (await as('staffA', () => portal.get(null, {}))).scheduleRequests.find((r) => r.id === pending.id);
    expect(mine).toMatchObject({ status: 'REJECTED', decisionNote: 'Неделя уже другая' });
  });

  it('отсутствие: мастер подаёт и сам отменяет; одобренное создаёт отсутствие', async () => {
    const offs = () => db.timeOff.count({ where: { employeeId: f.employeeA } });
    const start = await offs();
    let dto = await as('staffA', () => portal.mutate(null, 'schedule-request', { kind: 'TIME_OFF', dateFrom: '2026-11-10', dateTo: '2026-11-14', reason: 'Отпуск' }));
    const first = dto.scheduleRequests.find((r) => r.kind === 'TIME_OFF' && r.status === 'PENDING')!;
    dto = await as('staffA', () => portal.mutate(null, 'cancel-schedule-request', {}, first.id));
    expect(dto.scheduleRequests.find((r) => r.id === first.id)).toMatchObject({ status: 'CANCELLED' });
    dto = await as('staffA', () => portal.mutate(null, 'schedule-request', { kind: 'TIME_OFF', dateFrom: '2026-11-20', dateTo: '2026-11-20', reason: '' }));
    const second = dto.scheduleRequests.find((r) => r.kind === 'TIME_OFF' && r.status === 'PENDING')!;
    // чужой мастер не видит и не отменяет запрос
    await expect(as('staffB', () => portal.mutate(null, 'cancel-schedule-request', {}, second.id))).rejects.toThrow();
    await as('ownerA', () => portal.mutate(f.employeeA, 'approve-schedule-request', {}, second.id));
    expect(await offs()).toBe(start + 1);
    expect(await db.timeOff.findFirst({ where: { employeeId: f.employeeA, dateFrom: new Date('2026-11-20T00:00:00Z') } })).not.toBeNull();
  });

  it('база не даёт удалить запрос и менять решённый', async () => {
    const r = await db.employeeScheduleRequest.findFirst({ where: { employeeId: f.employeeA, status: 'APPROVED' } });
    await expect(db.employeeScheduleRequest.update({ where: { id: r!.id }, data: { status: 'PENDING', decidedById: null, decidedAt: null } })).rejects.toThrow();
  });
});
