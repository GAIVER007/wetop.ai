import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Post,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import {
  USER_ERRORS_REPOSITORY,
  type UserErrorRecord,
  type UserErrorsRepository,
} from '../assistant/user-errors.repository';
import { ApiErrorFilter } from './api-error.filter';
import { GuardService } from './guard.service';

/**
 * Журнал ошибок, которые видит человек (DATA_MODEL §14, ТЗ ред. 1, П3): фильтр ошибок API после ответа пишет
 * строку вошедшему — шаблон маршрута, код, текст ответа, идентификатор запроса. Тела запроса, значений из адреса и
 * данных гостей в строке нет. Прежняя обязанность фильтра — ответ 500 в неисправности сторожа — остаётся.
 */

const USER = {
  id: '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11',
  email: 'admin@example.invalid',
  name: 'Айгуль Тестова',
  organizationId: '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00',
};

@Controller('probe')
class ProbeController {
  // тело и параметр адреса обработчику не нужны: Nest их разбирает сам, а проверка — что в журнал они не попали
  @Post('items/:id')
  bad(): never {
    throw new BadRequestException(['adults — целое ≥ 1', 'дата выезда раньше заезда']);
  }

  @Get('boom')
  boom(): never {
    throw new Error('connection string postgresql://app:pw-not-real@db.example.com/pms');
  }

  @Get('contact')
  contact(): never {
    throw new ConflictException('Гость ivan.petrov@example.com уже заселён');
  }

  @Get('ok')
  ok() {
    return { ok: true };
  }
}

@Controller('assistant')
class AssistantProbeController {
  @Get('identity')
  identity(): never {
    throw new ServiceUnavailableException('Подпись помощника не настроена');
  }
}

class FakeUserErrors implements UserErrorsRepository {
  rows: UserErrorRecord[] = [];
  fail = false;
  async record(row: UserErrorRecord): Promise<void> {
    if (this.fail) throw new Error('база не ответила');
    this.rows.push(row);
  }
  async list(): Promise<UserErrorRecord[]> {
    return this.rows;
  }
  async deleteBefore(): Promise<number> {
    return 0;
  }
}

const errors = new FakeUserErrors();
const guard = { recordApiError: vi.fn(async () => undefined) };
let app: INestApplication;

beforeAll(async () => {
  // Каждый тест входит своим человеком: защита от дублей живёт весь прогон, и одинаковые ошибки разных
  // тестов иначе глушили бы друг друга — тест прошёл бы на пустом журнале
  const auth = {
    whoami: vi.fn(async (token: string) =>
      token.startsWith('session-')
        ? {
            user: { ...USER, id: `${USER.id.slice(0, 24)}${token.slice(8).padStart(12, '0')}` },
            organization: null,
            expiresAt: '2026-09-25T00:00:00.000Z',
          }
        : null,
    ),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController, AssistantProbeController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: GuardService, useValue: guard },
      { provide: USER_ERRORS_REPOSITORY, useValue: errors },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_FILTER, useClass: ApiErrorFilter },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  errors.rows = [];
  errors.fail = false;
  guard.recordApiError.mockClear();
});

/** Запись идёт после ответа и не ждётся им: даём ей доехать */
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('журнал ошибок человека (П3)', () => {
  it('вошедшему пишет шаблон маршрута, код, текст ответа и идентификатор запроса', async () => {
    const res = await request(app.getHttpServer())
      .post('/probe/items/RES-12345?email=guest@example.com&phone=%2B77011234567')
      .set('x-wetop-session', 'session-000000000001')
      .send({ guestName: 'Иван Петров', passport: 'N12345678' })
      .expect(400);
    await settle();

    expect(errors.rows).toHaveLength(1);
    const row = errors.rows[0]!;
    expect(row).toMatchObject({
      userId: '0b6c3c1e-4f4e-4a53-9b7e-000000000001',
      organizationId: USER.organizationId,
      method: 'POST',
      route: '/probe/items/:id',
      status: 400,
      message: 'adults — целое ≥ 1; дата выезда раньше заезда',
    });
    expect(row.at).toBeInstanceOf(Date);
    expect(row.requestId).toMatch(/^[0-9a-f-]{36}$/);
    // тот же идентификатор — человеку в заголовке ответа: по нему ошибку можно назвать
    expect(res.headers['x-request-id']).toBe(row.requestId);
    // ответ человеку не изменился
    expect(res.body.message).toEqual(['adults — целое ≥ 1', 'дата выезда раньше заезда']);
  });

  it('ни тела запроса, ни значений из адреса, ни данных гостя в строке нет', async () => {
    await request(app.getHttpServer())
      .post('/probe/items/RES-12345?email=guest@example.com&phone=%2B77011234567')
      .set('x-wetop-session', 'session-000000000002')
      .send({ guestName: 'Иван Петров', passport: 'N12345678' })
      .expect(400);
    await settle();
    const text = JSON.stringify(errors.rows);
    for (const value of ['RES-12345', 'guest@example.com', '77011234567', 'Иван', 'N12345678'])
      expect(text).not.toContain(value);
  });

  it('почта в тексте ответа маскируется', async () => {
    await request(app.getHttpServer())
      .get('/probe/contact')
      .set('x-wetop-session', 'session-000000000003')
      .expect(409);
    await settle();
    expect(errors.rows[0]?.message).toBe('Гость <почта> уже заселён');
  });

  it('500 пишется и человеку, и в неисправности сторожа, как раньше', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/boom')
      .set('x-wetop-session', 'session-000000000004')
      .expect(500);
    await settle();
    expect(errors.rows).toHaveLength(1);
    expect(errors.rows[0]).toMatchObject({ status: 500, message: 'Internal server error' });
    expect(JSON.stringify(errors.rows)).not.toContain('pw-not-real');
    expect(guard.recordApiError).toHaveBeenCalledTimes(1);
    expect(res.headers['x-request-id']).toBe(errors.rows[0]!.requestId);
  });

  it('невошедшему строки нет: журнал — о человеке', async () => {
    const res = await request(app.getHttpServer()).get('/probe/contact').expect(409);
    await settle();
    expect(errors.rows).toHaveLength(0);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('маршруты помощника не пишутся', async () => {
    await request(app.getHttpServer())
      .get('/assistant/identity')
      .set('x-wetop-session', 'session-000000000005')
      .expect(503);
    await settle();
    expect(errors.rows).toHaveLength(0);
  });

  it('успешный ответ не пишется', async () => {
    await request(app.getHttpServer())
      .get('/probe/ok')
      .set('x-wetop-session', 'session-000000000006')
      .expect(200);
    await settle();
    expect(errors.rows).toHaveLength(0);
  });

  it('одна и та же ошибка подряд — одна строка', async () => {
    for (let i = 0; i < 3; i += 1)
      await request(app.getHttpServer())
        .get('/probe/contact')
        .set('x-wetop-session', 'session-000000000007')
        .expect(409);
    await settle();
    expect(errors.rows).toHaveLength(1);
  });

  it('журнал не ответил — человек получает свой ответ как обычно', async () => {
    errors.fail = true;
    const res = await request(app.getHttpServer())
      .post('/probe/items/1')
      .set('x-wetop-session', 'session-000000000008')
      .send({})
      .expect(400);
    expect(res.body.message).toEqual(['adults — целое ≥ 1', 'дата выезда раньше заезда']);
  });
});
