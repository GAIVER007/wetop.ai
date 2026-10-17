import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WizardController } from './wizard.controller';
import { WizardService } from './wizard.service';
import { TurnstileService } from '../web-booking/turnstile';
let app: INestApplication;
const wizard = { status: vi.fn(), scan: vi.fn(), scanStatus: vi.fn() };
const captcha = { verify: vi.fn() };
beforeEach(async () => {
  vi.stubEnv('WIZARD_SCAN_ENABLED', '1');
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'synthetic-secret');
  vi.stubEnv('TURNSTILE_SITE_KEY', 'synthetic-public');
  vi.stubEnv('WIZARD_PUBLIC_HOST', 'app.example.test');
  wizard.status.mockResolvedValue({});
  wizard.scan.mockResolvedValue({ id: 'job', state: 'queued' });
  captcha.verify.mockResolvedValue({ ok: true });
  const module = await Test.createTestingModule({
    controllers: [WizardController],
    providers: [
      { provide: WizardService, useValue: wizard },
      { provide: TurnstileService, useValue: captcha },
    ],
  }).compile();
  app = module.createNestApplication();
  await app.listen(0, '127.0.0.1');
});
afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it('requires configured rollout, session and captcha before enqueuing', async () => {
  vi.stubEnv('WIZARD_SCAN_ENABLED', '0');
  await request(app.getHttpServer()).post('/wizard/scan').send({ revision: 1 }).expect(503);
  expect(wizard.scan).not.toHaveBeenCalled();
  vi.stubEnv('WIZARD_SCAN_ENABLED', '1');
  wizard.status.mockRejectedValueOnce(new UnauthorizedException());
  await request(app.getHttpServer()).post('/wizard/scan').send({ revision: 1 }).expect(401);
  expect(captcha.verify).not.toHaveBeenCalled();
  captcha.verify.mockResolvedValueOnce({ ok: false, reason: 'invalid' });
  await request(app.getHttpServer())
    .post('/wizard/scan')
    .send({ revision: 1, challenge: 'bad' })
    .expect(403);
  expect(wizard.scan).not.toHaveBeenCalled();
  await request(app.getHttpServer())
    .post('/wizard/scan')
    .set('x-wizard-token', 'synthetic-token')
    .send({ revision: 1, challenge: 'ok' })
    .expect(201);
  expect(captcha.verify).toHaveBeenLastCalledWith(
    'ok',
    expect.objectContaining({
      action: 'wizard',
      requireBinding: true,
      allowedHosts: ['app.example.test'],
    }),
  );
  expect(wizard.scan).toHaveBeenCalledWith(
    'synthetic-token',
    { revision: 1, challenge: 'ok' },
    expect.stringMatching(/^[a-f0-9]{64}$/),
  );
});
