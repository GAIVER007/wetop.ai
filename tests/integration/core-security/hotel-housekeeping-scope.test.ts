/**
 * Кабинет горничной гостиницы (решение владельца 22.10.2026, docs/decisions/2026-10-22-hotel-staff-cabinet.md,
 * DATA_MODEL §4.1) на настоящем HTTP: «Личный кабинет» (EMPLOYEE) гостиницы видит только номера, где он «Кто убирает»,
 * и свои задачи, ставит «Убрано» и «Сделано» только им. Шахматка, гости, финансы, задачи стойки, карточка места и
 * назначение уборки ему закрыты. Руководитель назначает, кто убирает; зарплата гостиницы считает уборки сдельно.
 */
import { randomBytes } from 'node:crypto';
import request from 'supertest';
// приложение мира поднято в scope-world.ts через `listen(0, '127.0.0.1')` (сторож supertest-loopback)
import { hashPassword } from '@pms/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildScopeWorld, type ScopeWorld } from './scope-world';

const ENABLED = !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)('«Личный кабинет» гостиницы: свои уборки и задачи (HTTP + база + RLS)', () => {
  let w: ScopeWorld;
  let token = '';
  let userId = '';
  const ids = { me: '', other: '', mine: '', foreign: '', free: '', myTask: '', otherTask: '' };
  const code = { mine: '', foreign: '', free: '' };
  const pointer = () => `business=${w.ids.hot};location=${w.ids.h1}`;
  const call = (method: 'get' | 'post' | 'patch' | 'put', path: string, body?: unknown) => {
    let req = request(w.app.getHttpServer())[method](path).set('Authorization', `Bearer ${token}`).set('X-Wetop-Scope', pointer());
    if (body !== undefined) req = req.send(body as object);
    return req;
  };

  beforeAll(async () => {
    w = await buildScopeWorld();
    const password = randomBytes(24).toString('base64url') + 'aA1!';
    const user = await w.db.user.create({
      data: { email: `maid-${w.ids.m}@example.invalid`, emailVerifiedAt: new Date(), passwordHash: await hashPassword(password), name: 'Горничная Тест' },
    });
    userId = user.id;
    await w.db.membership.create({ data: { organizationId: w.ids.orgA!, userId, role: 'EMPLOYEE' } });
    await w.db.membershipScope.create({
      data: { organizationId: w.ids.orgA!, userId, role: 'EMPLOYEE', businessId: w.ids.hot!, locationId: w.ids.h1! },
    });
    ids.me = (await w.db.employee.create({ data: { businessId: w.ids.hot!, name: 'Горничная Тест', userId, personnelKind: 'OTHER_EMPLOYEE' } })).id;
    ids.other = (await w.db.employee.create({ data: { businessId: w.ids.hot!, name: 'Другая Горничная', personnelKind: 'OTHER_EMPLOYEE' } })).id;
    for (const employeeId of [ids.me, ids.other]) await w.db.employeeLocation.create({ data: { employeeId, locationId: w.ids.h1! } });
    const type = await w.db.accommodationType.create({
      data: { propertyId: w.ids.p1!, code: `HK-${w.ids.m}`, name: 'Двухместный', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
    });
    const building = await w.db.building.create({ data: { propertyId: w.ids.p1!, name: 'Корпус' } });
    const floor = await w.db.floor.create({ data: { buildingId: building.id, name: '1' } });
    for (const [key, assignee] of [['mine', ids.me], ['foreign', ids.other], ['free', null]] as const) {
      const room = await w.db.physicalRoom.create({ data: { floorId: floor.id, roomNumber: `${key}-${w.ids.m}`, capacity: 2 } });
      code[key] = `HK${key.toUpperCase()}${w.ids.m}`;
      ids[key] = (
        await w.db.inventoryUnit.create({
          data: { propertyId: w.ids.p1!, physicalRoomId: room.id, accommodationTypeId: type.id, code: code[key], kind: 'ROOM', housekeepingAssigneeId: assignee },
        })
      ).id;
    }
    const due = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    ids.myTask = (await w.db.deskTask.create({ data: { propertyId: w.ids.p1!, title: 'Поменять полотенца в 12', dueDate: due, assigneeUserId: userId } })).id;
    ids.otherTask = (await w.db.deskTask.create({ data: { propertyId: w.ids.p1!, title: 'Чужая задача', dueDate: due } })).id;
    const login = await request(w.app.getHttpServer()).post('/auth/login').send({ email: user.email, password });
    expect(login.status, JSON.stringify(login.body)).toBe(201);
    token = login.body.token as string;
  }, 180_000);

  afterAll(async () => {
    if (w) {
      await w.db.housekeepingEvent.deleteMany({ where: { inventoryUnitId: { in: [ids.mine, ids.foreign, ids.free].filter(Boolean) } } });
      await w.db.deskTask.deleteMany({ where: { id: { in: [ids.myTask, ids.otherTask].filter(Boolean) } } });
      await w.db.inventoryUnit.deleteMany({ where: { propertyId: w.ids.p1! } });
      await w.db.physicalRoom.deleteMany({ where: { floor: { building: { propertyId: w.ids.p1! } } } });
      await w.db.floor.deleteMany({ where: { building: { propertyId: w.ids.p1! } } });
      await w.db.building.deleteMany({ where: { propertyId: w.ids.p1! } });
      await w.db.accommodationType.deleteMany({ where: { propertyId: w.ids.p1! } });
      await w.db.employeePaySetting.deleteMany({ where: { employeeId: { in: [ids.me, ids.other].filter(Boolean) } } });
      await w.db.employeeLocation.deleteMany({ where: { employeeId: { in: [ids.me, ids.other].filter(Boolean) } } });
      await w.db.employee.deleteMany({ where: { id: { in: [ids.me, ids.other].filter(Boolean) } } });
      await w.close();
    }
  }, 60_000);

  it('видит только свои номера на уборку и свои задачи', async () => {
    const res = await call('get', '/hotel-staff/me');
    expect(res.status, res.text.slice(0, 300)).toBe(200);
    const body = res.body as { me: { id: string }; units: Array<{ code: string; status: string }>; tasks: Array<{ id: string; title: string }> };
    expect(body.me.id).toBe(ids.me);
    expect(body.units.map((u) => `${u.code}:${u.status}`)).toEqual([`${code.mine}:DIRTY`]);
    expect(body.tasks.map((t) => t.title)).toEqual(['Поменять полотенца в 12']);
    expect(res.text).not.toContain('Чужая задача');
    expect(res.text).not.toContain(code.foreign);
  });

  it('«Убрано» только своему номеру: чужой и свободный отказ, статус не меняется', async () => {
    for (const c of [code.foreign, code.free]) {
      const r = await call('post', `/hotel-staff/me/units/${c}/clean`);
      expect(r.status, r.text.slice(0, 200)).toBe(403);
    }
    expect((await w.db.inventoryUnit.findUniqueOrThrow({ where: { id: ids.foreign } })).housekeepingStatus).toBe('DIRTY');
    const ok = await call('post', `/hotel-staff/me/units/${code.mine}/clean`);
    expect(ok.status, ok.text.slice(0, 300)).toBe(200);
    expect((await w.db.inventoryUnit.findUniqueOrThrow({ where: { id: ids.mine } })).housekeepingStatus).toBe('CLEAN');
    const events = await w.db.housekeepingEvent.findMany({ where: { inventoryUnitId: ids.mine } });
    expect(events.map((e) => [e.fromStatus, e.toStatus, e.userId, e.employeeId])).toEqual([['DIRTY', 'CLEAN', userId, ids.me]]);
    // повтор того же нажатия не пишет второе событие
    expect((await call('post', `/hotel-staff/me/units/${code.mine}/clean`)).status).toBe(200);
    expect(await w.db.housekeepingEvent.count({ where: { inventoryUnitId: ids.mine } })).toBe(1);
  });

  it('«Сделано» только своей задаче', async () => {
    const foreign = await call('post', `/hotel-staff/me/tasks/${ids.otherTask}/done`);
    expect(foreign.status).toBe(403);
    expect((await w.db.deskTask.findUniqueOrThrow({ where: { id: ids.otherTask } })).doneAt).toBeNull();
    const mine = await call('post', `/hotel-staff/me/tasks/${ids.myTask}/done`);
    expect(mine.status, mine.text.slice(0, 300)).toBe(200);
    const row = await w.db.deskTask.findUniqueOrThrow({ where: { id: ids.myTask } });
    expect(row.doneAt).not.toBeNull();
    expect(row.doneById).toBe(userId);
  });

  it('шахматка, гости, финансы, задачи стойки, карточка места, зарплата и назначение уборки закрыты', async () => {
    for (const [method, path, body] of [
      ['get', '/chessboard'],
      ['get', '/guests'],
      ['get', '/finance/cash'],
      ['get', '/tasks'],
      ['get', `/units/${code.mine}`],
      ['post', `/units/${code.foreign}/housekeeping`, { status: 'CLEAN' }],
      ['put', `/units/${code.free}/housekeeping-assignee`, { employeeId: ids.me }],
      ['get', `/food-service/payroll?month=${new Date().toISOString().slice(0, 7)}`],
      ['get', '/hotel-staff/employees'],
    ] as const) {
      const r = await call(method, path, body);
      expect(r.status, `${method} ${path}: ${r.text.slice(0, 160)}`).toBe(403);
    }
  });

  it('руководитель назначает, кто убирает; зарплата считает уборки сдельно; «Мой месяц» видит уборку', async () => {
    const assign = await w.call('H1_MGR', 'put', `/units/${code.free}/housekeeping-assignee`, { scope: 'HOT+H1', body: { employeeId: ids.me } });
    expect(assign.status, assign.text.slice(0, 300)).toBe(200);
    expect((await w.db.inventoryUnit.findUniqueOrThrow({ where: { id: ids.free } })).housekeepingAssigneeId).toBe(ids.me);
    const team = await w.call('H1_MGR', 'get', '/hotel-staff/employees', { scope: 'HOT+H1' });
    expect(team.status, team.text.slice(0, 300)).toBe(200);
    expect((team.json as { items: Array<{ id: string }> }).items.map((e) => e.id).sort()).toEqual([ids.me, ids.other].sort());
    const pay = await w.call('H1_MGR', 'put', `/food-service/employees/${ids.me}/pay-settings`, {
      scope: 'HOT+H1',
      body: { model: 'FIXED', fixedMinor: 1_000_000, percent: 0, perCleaningMinor: 150_000 },
    });
    expect(pay.status, pay.text.slice(0, 300)).toBe(200);
    // месяц зарплаты в поясе гостиницы (Asia/Almaty): с 00:00 до 05:00 1-го числа по Алматы UTC ещё в прошлом месяце,
    // и уборка сегодняшнего дня в нём не считалась (гейт main 1.11.2026)
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date()).slice(0, 7);
    const payroll = await w.call('H1_MGR', 'get', `/food-service/payroll?month=${month}`, { scope: 'HOT+H1' });
    expect(payroll.status, payroll.text.slice(0, 300)).toBe(200);
    const row = (payroll.json as { rows: Array<{ employeeId: string; cleanings: number; pieceMinor: string; totalMinor: string }> }).rows.find((r) => r.employeeId === ids.me)!;
    expect([row.cleanings, row.pieceMinor, row.totalMinor]).toEqual([1, '150000', '1150000']);
    const payout = await w.call('H1_MGR', 'post', `/food-service/employees/${ids.me}/payouts`, {
      scope: 'HOT+H1',
      body: { period: `${month}-01`, method: 'CASH', amount: 100 },
    });
    expect(payout.status).toBe(409);
    const me = await call('get', '/hotel-staff/me');
    expect(me.status).toBe(200);
    const body = me.body as { units: Array<{ code: string }>; month: { cleanings: number; tasksDone: number }; pay: { totalMinor: string } };
    expect(body.units.map((u) => u.code).sort()).toEqual([code.free, code.mine].sort());
    expect([body.month.cleanings, body.month.tasksDone, body.pay.totalMinor]).toEqual([1, 1, '1150000']);
  });
});
