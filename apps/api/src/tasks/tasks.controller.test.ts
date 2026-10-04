import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TaskInput } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { TasksModule } from './tasks.module';
import { TASKS_REPOSITORY, type DeskTaskRow, type TasksRepository } from './tasks.repository';

const TODAY = '2026-10-03';
const MEMBER = '4f8e1c1e-3b0a-4d1e-9a51-1f0a2b3c4d5e';
const STRANGER = '9a1e1c1e-3b0a-4d1e-9a51-1f0a2b3c4d5e';

function fakes() {
  const rows = new Map<string, DeskTaskRow>();
  const repo: TasksRepository = {
    async today() { return TODAY; },
    async list() { return [...rows.values()]; },
    async openDueCount(date) { return [...rows.values()].filter((t) => !t.doneAt && t.dueDate <= date).length; },
    async isMember(id) { return id === MEMBER; },
    async reservationId() { return null; },
    async create(i: TaskInput) {
      const row: DeskTaskRow = {
        id: `00000000-0000-4000-8000-00000000000${rows.size + 1}`,
        title: i.title!, note: i.note ?? null, dueDate: i.dueDate!, dueTime: i.dueTime ?? null,
        priority: i.priority ?? 'NORMAL', assigneeUserId: i.assigneeUserId ?? null, assigneeName: null,
        reservationNumber: i.reservationNumber ?? null, guestId: i.guestId ?? null, doneAt: null,
        createdAt: '2026-10-03T00:00:00.000Z',
      };
      rows.set(row.id, row);
      return row;
    },
    async update(id, i) {
      const t = rows.get(id);
      if (!t) return null;
      const next = { ...t, ...(i.title ? { title: i.title } : {}), ...(i.done === undefined ? {} : { doneAt: i.done ? 'now' : null }) };
      rows.set(id, next);
      return next;
    },
  };
  return { rows, repo };
}

describe('задачи стойки (DATA_MODEL §22)', () => {
  let app: INestApplication;
  const f = fakes();
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [TasksModule] })
      .overrideProvider(TASKS_REPOSITORY).useValue(f.repo)
      .overrideProvider(PrismaService).useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => f.rows.clear());

  it('создаёт задачу, список раскладывает по срокам и считает', async () => {
    for (const [title, dueDate] of [['Старая', '2026-10-01'], ['Сегодня', TODAY], ['Позже', '2026-10-09']])
      await request(app.getHttpServer()).post('/tasks').send({ title, dueDate }).expect(201);
    const list = (await request(app.getHttpServer()).get('/tasks').expect(200)).body;
    expect(list.counts).toEqual({ overdue: 1, today: 1, upcoming: 1, done: 0 });
    expect(list.tasks.map((t: { bucket: string }) => t.bucket)).toEqual(['overdue', 'today', 'upcoming']);
  });

  it('сделанная уходит в «Сделанные», открывается снова', async () => {
    const id = (await request(app.getHttpServer()).post('/tasks').send({ title: 'Позвонить', dueDate: TODAY })).body.id;
    await request(app.getHttpServer()).patch(`/tasks/${id}`).send({ done: true }).expect(200);
    expect((await request(app.getHttpServer()).get('/tasks')).body.counts.done).toBe(1);
    await request(app.getHttpServer()).patch(`/tasks/${id}`).send({ done: false }).expect(200);
    expect((await request(app.getHttpServer()).get('/tasks')).body.counts.today).toBe(1);
  });

  it('отказы словами: нет названия, чужой исполнитель, неизвестное поле, нет задачи', async () => {
    const r = (b: object) => request(app.getHttpServer()).post('/tasks').send(b);
    expect((await r({ dueDate: TODAY })).body.message).toBe('Напишите, что сделать');
    expect((await r({ title: 'x', dueDate: TODAY, assigneeUserId: STRANGER })).body.message).toBe('Исполнитель — сотрудник вашей организации');
    expect((await r({ title: 'x', dueDate: TODAY, propertyId: 'a' })).status).toBe(400);
    await r({ title: 'x', dueDate: TODAY, assigneeUserId: MEMBER }).expect(201);
    await request(app.getHttpServer()).patch('/tasks/00000000-0000-4000-8000-0000000000ff').send({ title: 'y' }).expect(404);
  });
});
