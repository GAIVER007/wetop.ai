import 'reflect-metadata';
import type { Request, Response, NextFunction } from 'express';
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
Reflect.defineMetadata('providers', providers.map(p => typeof p === 'object' && p && 'provide' in p && p.provide === MAILER ? { provide: MAILER, useValue: fakeMailer } : typeof p === 'object' && p && 'provide' in p && p.provide === APP_URL ? { provide: APP_URL, useValue: process.env.APP_URL || 'http://127.0.0.1:55843' } : p), AuthModule);
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
  res.json({ link: text.match(/http:\/\/127\.0\.0\.1:\d+\/login\/verify\?token=[a-zA-Z0-9_-]+/)?.[0] ?? null });
});
express.post('/__onboarding-test/expire-verification', async (req: { body: { token: string } }, res: { json: (v: unknown) => void }) => {
  await db.emailVerification.updateMany({ where: { tokenHash: hashSessionToken(req.body.token) }, data: { expiresAt: new Date('2000-01-01T00:00:00Z') } });
  res.json({ ok: true });
});
// Fixture controls are local-only and accept only actors registered by this process.
// Successful business traffic always continues into the real AppModule and SessionGuard.
type Fault = 'before503' | 'dropbefore' | 'dropafter';
const faults = new Map<string, Fault>();
async function syntheticActor(req: Request) {
  const token = req.header('x-wetop-session');
  if (!token) throw new Error('Synthetic session required');
  const session = await db.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: true } });
  if (!session || !session.user.email.startsWith('onboarding-recovery-') || !letters.has(session.user.email))
    throw new Error('Owned synthetic actor required');
  const membership = await db.membership.findUnique({ where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } } });
  if (!membership) throw new Error('Owned organization required');
  return session;
}
express.post('/__onboarding-test/recovery', async (req: Request, res: Response) => {
  try {
    const actor = await syntheticActor(req);
    const key = actor.tokenHash;
    const mode = req.body?.mode;
    if (['before503', 'dropbefore', 'dropafter'].includes(mode)) faults.set(key, mode);
    else if (mode === 'reset') faults.delete(key);
    else if (mode === 'expire') await db.session.updateMany({ where: { id: actor.id, userId: actor.userId, organizationId: actor.organizationId }, data: { expiresAt: new Date('2000-01-01') } });
    else if (mode === 'STAFF') await db.membership.updateMany({ where: { userId: actor.userId, organizationId: actor.organizationId }, data: { role: 'STAFF' } });
    else if (mode === 'READ_ONLY') await db.organization.updateMany({ where: { id: actor.organizationId, memberships: { some: { userId: actor.userId, role: 'OWNER' } } }, data: { status: 'READ_ONLY' } });
    else return res.status(400).json({ error: 'Unknown fixture mode' });
    return res.json({ ok: true });
  } catch { return res.status(403).json({ error: 'Owned synthetic actor required' }); }
});
express.get('/__onboarding-test/recovery-snapshot', async (req: Request, res: Response) => {
  try {
    const actor = await syntheticActor(req);
    const locations = await db.location.findMany({ where: { business: { organizationId: actor.organizationId } }, select: { id: true } });
    const progress = await db.onboardingProgress.findMany({ where: { locationId: { in: locations.map(l => l.id) } }, orderBy: { locationId: 'asc' } });
    return res.json({ progress });
  } catch { return res.status(403).json({ error: 'Owned synthetic actor required' }); }
});
// Read-only authoritative snapshots; every row is bounded to this registered actor's organization.
express.get('/__onboarding-test/guest-snapshot', async (req: Request, res: Response) => {
  try {
    const actor = await syntheticActor(req);
    const properties = await db.property.findMany({ where: { organizationId: actor.organizationId },
      include: { accommodationTypes: { orderBy: { id: 'asc' } }, ratePlans: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } });
    const guests = await db.guest.findMany({ where: { organizationId: actor.organizationId }, orderBy: { id: 'asc' } });
    const reservations = await db.reservation.findMany({ where: { property: { organizationId: actor.organizationId } },
      include: { items: { orderBy: { id: 'asc' }, include: {
        allocations: { orderBy: { id: 'asc' } }, stayGuests: { orderBy: { guestId: 'asc' } },
        folio: { include: { charges: { orderBy: { id: 'asc' } }, allocations: { orderBy: { paymentId: 'asc' } }, refunds: { orderBy: { id: 'asc' } } } },
      } } }, orderBy: { id: 'asc' } });
    return res.type('json').send(JSON.stringify({ properties, guests, reservations }, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
  } catch { return res.status(403).json({ error: 'Owned synthetic actor required' }); }
});
express.post('/__onboarding-test/guest-restrict', async (req: Request, res: Response) => {
  try {
    const actor = await syntheticActor(req);
    const pointer = req.header('x-wetop-scope') ?? '';
    const businessId = pointer.match(/(?:^|;)business=([^;]+)/)?.[1];
    const locationId = pointer.match(/(?:^|;)location=([^;]+)/)?.[1];
    const location = await db.location.findFirst({ where: { id: locationId ?? '', businessId: businessId ?? '', business: { organizationId: actor.organizationId } } });
    if (!location) return res.status(403).json({ error: 'Owned location required' });
    await db.$transaction(async tx => {
      await tx.membership.updateMany({ where: { userId: actor.userId, organizationId: actor.organizationId }, data: { role: 'STAFF' } });
      await tx.membershipScope.create({ data: { organizationId: actor.organizationId, userId: actor.userId, role: 'STAFF', businessId: location.businessId, locationId: location.id } });
    });
    return res.json({ ok: true });
  } catch { return res.status(403).json({ error: 'Owned synthetic actor required' }); }
});
express.use('/onboarding', async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'POST') return next();
  const token = req.header('x-wetop-session');
  const key = token ? hashSessionToken(token) : '';
  const fault = faults.get(key);
  if (!fault) return next();
  faults.delete(key); // one request only; other actors and all reads are unaffected
  if (fault === 'before503') return res.status(503).json({ message: 'Synthetic outage' });
  if (fault === 'dropbefore') return req.socket.destroy();
  const end = res.end.bind(res);
  // Nest calls end only after the real controller's awaited transaction has committed.
  res.end = ((...args: Parameters<typeof res.end>) => {
    if (res.statusCode >= 200 && res.statusCode < 300) { req.socket.destroy(); return res; }
    return end(...args);
  }) as typeof res.end;
  return next();
});
await app.listen(Number(process.env.ONBOARDING_REAL_API_PORT || '55844'), '127.0.0.1');
console.log('Own local real API ready at 127.0.0.1:55844');
const stop = async () => { await app.close(); await db.$disconnect(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
