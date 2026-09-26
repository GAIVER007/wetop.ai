import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { ExtensionsService } from '../platform/extensions.service';
import { AttemptWindows, LOGIN_ATTEMPTS_PER_IP, PasswordGate } from './attempt-limits';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './auth.guard';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { fakeDb } from './fake-db';

/**
 * Аудит 26.09, С-5: вход считал scrypt синхронно (~40 мс главного потока на попытку, и на неизвестную почту тоже), а
 * лимитов по адресу не было ни на входе, ни на регистрации, ни на письмах. Двадцать-тридцать запросов в секунду без
 * учётной записи замораживали весь API: стойку, webhook Channex, виджет.
 */
describe('окно попыток по ключу', () => {
  it('пускает до предела в окне, дальше отказывает, другой ключ считает отдельно', () => {
    const w = new AttemptWindows(3, 60_000);
    const t = 1_000_000;
    expect([w.allow('a', t), w.allow('a', t), w.allow('a', t), w.allow('a', t)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(w.allow('b', t)).toBe(true);
    expect(w.allow('a', t + 60_001)).toBe(true);
  });

  it('переполнение не сбрасывает чужие счётчики: вытесняются только протухшие окна', () => {
    const w = new AttemptWindows(1, 60_000, 3);
    const t = 1_000_000;
    expect(w.allow('жертва', t)).toBe(true);
    for (let i = 0; i < 50; i += 1) w.allow(`мусор-${i}`, t + 1);
    expect(w.allow('жертва', t + 2)).toBe(false);
  });
});

describe('очередь проверки паролей', () => {
  it('держит не больше заданного числа проверок сразу, лишние сверх очереди — 429 сразу', async () => {
    const gate = new PasswordGate(1, 1);
    let release!: () => void;
    const first = gate.run(() => new Promise<boolean>((ok) => (release = () => ok(true))));
    const second = gate.run(async () => true);
    await expect(gate.run(async () => true)).rejects.toMatchObject({ status: 429 });
    release();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });
});

describe('вход: предел попыток с одного адреса', () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    const world = fakeDb();
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: world.prisma },
        { provide: ExtensionsService, useValue: {} },
        { provide: PasswordResetService, useValue: {} },
        { provide: EmailVerificationService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(new SessionGuard(app.get(Reflector), app.get(AuthService)));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const attempt = (ip: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('cf-connecting-ip', ip)
      .send({ email: 'nikogo-net@example.invalid', password: 'ne-tot-parol' });

  it(`после ${LOGIN_ATTEMPTS_PER_IP} попыток с адреса — 429, а соседний адрес входит как прежде`, async () => {
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_IP; i += 1) expect((await attempt('203.0.113.7')).status).toBe(401);
    const over = await attempt('203.0.113.7');
    expect(over.status).toBe(429);
    expect(over.body.message).toMatch(/попыток/);
    expect((await attempt('203.0.113.8')).status).toBe(401);
  }, 30_000);
});
