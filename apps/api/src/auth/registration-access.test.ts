import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './auth.guard';
import { PasswordResetService } from './password-reset.service';
import { fakeDb } from './fake-db';

const NEW = {
  email: 'closed@example.invalid',
  name: 'Тестовый сотрудник',
  password: 'test-password-2026',
};

describe('единая настройка самостоятельной регистрации (ADR-055)', () => {
  let app: INestApplication;
  let world: ReturnType<typeof fakeDb>;
  let auth: AuthService;

  beforeEach(async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('REGISTRATION_OPEN', '0');
    world = fakeDb();
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: world.prisma },
        { provide: PasswordResetService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    auth = app.get(AuthService);
    app.useGlobalGuards(new SessionGuard(app.get(Reflector), auth));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it.each(['0', 'true', 'yes'])(
    'настройка %s: прямой HTTP-запрос получает 403 без записей',
    async (setting) => {
      vi.stubEnv('REGISTRATION_OPEN', setting);
      const before = structuredClone({
        users: world.users,
        organizations: world.organizations,
        memberships: world.memberships,
        sessions: world.sessions,
        audit: world.audit,
      });
      const transaction = vi.spyOn((world.prisma as PrismaService).db, '$transaction');
      const response = await request(app.getHttpServer()).post('/auth/register').send(NEW);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Самостоятельная регистрация закрыта');
      expect(response.body).not.toHaveProperty('token');
      expect(transaction).not.toHaveBeenCalled();
      expect({
        users: world.users,
        organizations: world.organizations,
        memberships: world.memberships,
        sessions: world.sessions,
        audit: world.audit,
      }).toEqual(before);
    },
  );

  it('вызов сервиса тоже закрыт: нельзя обойти контроллер', async () => {
    const status = await auth.register(NEW).then(
      () => 201,
      (error: { status: number }) => error.status,
    );
    expect(status).toBe(403);
  });

  it('без сессии можно узнать только доступность регистрации', async () => {
    const response = await request(app.getHttpServer()).get('/auth/options');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ registrationEnabled: false });
  });

  it.each([undefined, '', ' ', '1', ' 1 '])(
    'настройка %s: регистрация и повторный вход доступны',
    async (setting) => {
      vi.stubEnv('REGISTRATION_OPEN', setting);
      const options = await request(app.getHttpServer()).get('/auth/options');
      expect(options.body).toEqual({ registrationEnabled: true });
      const registration = await request(app.getHttpServer()).post('/auth/register').send(NEW);
      expect(registration.status).toBe(201);
      expect(registration.body.user.email).toBe(NEW.email);
      const login = await request(app.getHttpServer()).post('/auth/login').send(NEW);
      expect(login.status).toBe(201);
      expect(login.body.user.id).toBe(registration.body.user.id);
    },
  );
});
