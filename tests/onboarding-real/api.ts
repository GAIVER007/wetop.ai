import 'reflect-metadata';
import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { Access } from '../../apps/api/src/auth/access.decorator';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from '../../apps/api/src/auth/auth.module';
import { MAILER, APP_URL } from '../../apps/api/src/auth/password-reset.service';
import { AppModule } from '../../apps/api/src/app.module';
import { createPrismaClient } from '@pms/database';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { hashSessionToken } from '@pms/domain';

import { isLocalDatabase } from '../tools/seed-local';
const url = new URL(process.env.DATABASE_URL!);
if (!isLocalDatabase(url.toString()) || (process.env.DATABASE_APP_URL && !isLocalDatabase(process.env.DATABASE_APP_URL)) || process.env.DATABASE_SCHEMA !== 'pms_test') throw new Error('Own local test database required');
const letters = new Map<string, string[]>();
const fakeMailer = { async send(message: { to: string; text: string }) {
  if (!message.to.endsWith('@example.invalid')) throw new Error('Only synthetic recipients');
  letters.set(message.to, [...(letters.get(message.to) ?? []), message.text]);
} };
const providers = Reflect.getMetadata('providers', AuthModule) as Array<{ provide?: unknown } | unknown>;
Reflect.defineMetadata('providers', providers.map(p => typeof p === 'object' && p && 'provide' in p && p.provide === MAILER ? { provide: MAILER, useValue: fakeMailer } : typeof p === 'object' && p && 'provide' in p && p.provide === APP_URL ? { provide: APP_URL, useValue: 'http://127.0.0.1:55843' } : p), AuthModule);
class RuntimeIdentity {
 constructor(private readonly prisma:PrismaService) {}

 async role() {return this.prisma.db.$queryRaw`SELECT current_user AS role, r.rolsuper,r.rolbypassrls,(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pms_test' AND c.relowner=r.oid) AS owned FROM pg_roles r WHERE r.rolname=current_user`;}
}
Controller('__onboarding-test')(RuntimeIdentity);
Inject(PrismaService)(RuntimeIdentity, undefined, 0);
const roleDescriptor=Object.getOwnPropertyDescriptor(RuntimeIdentity.prototype,'role')!;
Get('runtime-role')(RuntimeIdentity.prototype,'role',roleDescriptor);
Access('property')(RuntimeIdentity.prototype,'role',roleDescriptor);
Reflect.defineMetadata('controllers',[...(Reflect.getMetadata('controllers',AppModule) ?? []),RuntimeIdentity],AppModule);
const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'], bodyParser: false });
useApiBodyParsers(app);
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
const express = app.getHttpAdapter().getInstance();
express.get('/__onboarding-test/health', (_req: unknown, res: { json: (v: unknown) => void }) => res.json({ local: true }));
express.get('/__onboarding-test/mail', (req: { query: { email: string } }, res: { json: (v: unknown) => void }) => {
  const email = req.query.email;
  if (typeof email !== 'string' || !email.endsWith('@example.invalid')) return res.json({ link: null });
  const text = letters.get(email)?.at(-1) ?? '';
  res.json({ link: text.match(/http:\/\/127\.0\.0\.1:55843\/login\/verify\?token=[a-zA-Z0-9_-]+/)?.[0] ?? null });
});
express.post('/__onboarding-test/expire-verification', async (req: { body: { token: string } }, res: { json: (v: unknown) => void }) => {
  await db.emailVerification.updateMany({ where: { tokenHash: hashSessionToken(req.body.token) }, data: { expiresAt: new Date('2000-01-01T00:00:00Z') } });
  res.json({ ok: true });
});
await app.listen(55844, '127.0.0.1');
console.log('Own local real API ready at 127.0.0.1:55844');
const stop = async () => { await app.close(); await db.$disconnect(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
