import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { ExtensionsService } from '../platform/extensions.service';
import { AttemptWindows, PasswordGate, visitorKey } from './attempt-limits';
import { AUTH_IP_LIMITS, AuthController } from './auth.controller';
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

// Проверка исправлений 26.09: уборка обходила все ключи на каждой новой попытке сверх предела памяти (1 мс синхронно на
// ключ при 50 тыс.), а память не имела жёсткого потолка — ключи, которые выбирает сам посетитель, росли без края
describe('окно попыток: потолок памяти', () => {
  it('сверх потолка новый ключ получает отказ, память не растёт, известный считается как прежде', () => {
    const w = new AttemptWindows(5, 60_000, 100);
    const t = 1_000_000;
    expect(w.allow('свой', t)).toBe(true);
    for (let i = 0; i < 1_000; i += 1) w.allow(`мусор-${i}`, t + 1);
    expect(w.size).toBeLessThanOrEqual(100);
    expect(w.allow('свой', t + 2)).toBe(true);
  });

  it('уборка на переполнении — не на каждой попытке', () => {
    const w = new AttemptWindows(5, 60_000, 1_000);
    const t = 1_000_000;
    for (let i = 0; i < 1_000; i += 1) w.allow(`ключ-${i}`, t);
    const started = performance.now();
    for (let i = 0; i < 20_000; i += 1) w.allow(`новый-${i}`, t + 1);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('адрес посетителя как ключ', () => {
  it('IPv6 — по сети /64: адреса одного абонента делят счётчик', () => {
    expect(visitorKey('2001:db8:1:2:aaaa::1')).toBe(visitorKey('2001:0db8:0001:0002:ffff:1:2:3'));
    expect(visitorKey('2001:db8:1:2::1')).not.toBe(visitorKey('2001:db8:1:3::1'));
    expect(visitorKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
  });

  it('IPv4 и IPv4 внутри IPv6 — один и тот же адрес', () => {
    expect(visitorKey('203.0.113.7')).toBe('203.0.113.7');
    expect(visitorKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
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

  it(`после ${AUTH_IP_LIMITS.loginPerHour} попыток с адреса — 429, а соседний адрес входит как прежде`, async () => {
    for (let i = 0; i < AUTH_IP_LIMITS.loginPerHour; i += 1)
      expect((await attempt('203.0.113.7')).status).toBe(401);
    const over = await attempt('203.0.113.7');
    expect(over.status).toBe(429);
    expect(over.body.message).toMatch(/попыток/);
    expect((await attempt('203.0.113.8')).status).toBe(401);
  }, 30_000);

  // Проверка исправлений 26.09: IPv6-абонент получает сеть /64 и перебором адресов в ней обходил предел
  it('адреса IPv6 одной сети /64 делят один предел', async () => {
    for (let i = 0; i < AUTH_IP_LIMITS.loginPerHour; i += 1)
      expect((await attempt(`2001:db8:1:2::${(i + 1).toString(16)}`)).status).toBe(401);
    expect((await attempt('2001:db8:1:2::ffff')).status).toBe(429);
    expect((await attempt('2001:db8:1:3::1')).status).toBe(401);
  }, 30_000);
});
