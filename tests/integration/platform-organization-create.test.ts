import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';
import { hashSessionToken } from '@pms/domain';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PasswordResetService } from '../../apps/api/src/auth/password-reset.service';
import {
  HOTEL_NAME_TAKEN,
  OWNER_EMAIL_TAKEN,
  OWNER_HAS_PASSWORD,
  OrganizationCreation,
} from '../../apps/api/src/platform/organization-creation';
import { PrismaExtensionsRepository } from '../../apps/api/src/platform/extensions.repository';
import { purgeAuditRows } from '../tools/audit-purge';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Создание организации главным администратором (ORG2, ADR-ORG2, Q-283). Проверяется сама база: организация, первый
 * филиал, владелец без пароля, членство, ссылка и журнал пишутся одной транзакцией; в базе только хеш токена; токен из
 * письма подходит к этому хешу и ставит пароль через тот же `PasswordResetService`, что и сброс пароля. Всё вымышленное
 * (ADR-010), убирается за собой.
 */
describe.skipIf(!url)('создание организации главным администратором (integration, DATABASE_URL required)', () => {
  let db: Db;
  let creation: OrganizationCreation;
  let repo: PrismaExtensionsRepository;
  const mark = Date.now().toString(36);
  const admin = randomUUID();
  const orgs: string[] = [];
  const emails: string[] = [];
  const mailbox: Array<{ to: string; subject: string; text: string }> = [];
  const mailer = {
    failing: false,
    async send(letter: { to: string; subject: string; text: string }) {
      if (this.failing) throw new Error('почтовая служба отказала');
      mailbox.push(letter);
    },
  };
  const APP = 'https://app.example.invalid';
  const email = (tag: string) => {
    const value = `org2-${tag}-${mark}@example.invalid`;
    emails.push(value);
    return value;
  };
  const tokenOf = (letter: { text: string }) => decodeURIComponent(/token=([^\s]+)/.exec(letter.text)![1]!.replace(/\+/g, ' '));
  const env = { ...process.env };

  beforeAll(async () => {
    db = createPrismaClient(url);
    creation = new OrganizationCreation({ db } as PrismaService, mailer, APP);
    repo = new PrismaExtensionsRepository({ db } as PrismaService);
    await db.user.create({ data: { id: admin, email: `org2-admin-${mark}@example.invalid` } });
    emails.push(`org2-admin-${mark}@example.invalid`);
  });

  afterEach(() => {
    mailer.failing = false;
    delete process.env.REGISTRATION_BEAUTY_PILOT_EMAILS;
  });

  afterAll(async () => {
    process.env.REGISTRATION_BEAUTY_PILOT_EMAILS = env.REGISTRATION_BEAUTY_PILOT_EMAILS;
    if (env.REGISTRATION_BEAUTY_PILOT_EMAILS === undefined) delete process.env.REGISTRATION_BEAUTY_PILOT_EMAILS;
    if (!db) return;
    const users = (await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await purgeAuditRows(db, { organizationId: { in: orgs } });
    await purgeAuditRows(db, { entityType: 'user', entityId: { in: users } });
    await db.passwordReset.deleteMany({ where: { userId: { in: users } } });
    await db.session.deleteMany({ where: { userId: { in: users } } });
    await db.membership.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.property.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.location.deleteMany({ where: { business: { organizationId: { in: orgs } } } });
    await db.business.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  const track = (id: string) => {
    orgs.push(id);
    return id;
  };

  it('гостиница: организация, филиал, владелец без пароля, ссылка и журнал; токен только хешем', async () => {
    const before = Date.now();
    const owner = email('hotel');
    const made = await creation.create({ name: `Хостел Новый ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY', by: admin });
    track(made.organizationId);
    expect(made.ownerLinkSent).toBe(true);

    const org = await db.organization.findUniqueOrThrow({ where: { id: made.organizationId } });
    expect(org).toMatchObject({ name: `Хостел Новый ${mark}`, status: 'TRIAL' });
    expect(org.trialEndsAt!.getTime()).toBeGreaterThan(before);

    const property = await db.property.findFirstOrThrow({ where: { organizationId: made.organizationId } });
    expect(property).toMatchObject({ name: `Хостел Новый ${mark}`, timezone: 'Asia/Almaty', currency: 'KZT' });
    expect(property.locationId).toBeTruthy();
    expect(await db.business.count({ where: { organizationId: made.organizationId, vertical: 'HOSPITALITY' } })).toBe(1);

    const user = await db.user.findUniqueOrThrow({ where: { email: owner } });
    expect(user).toMatchObject({ passwordHash: '', status: 'ACTIVE', emailVerifiedAt: null });
    expect(await db.membership.findMany({ where: { organizationId: made.organizationId }, select: { userId: true, role: true } })).toEqual([
      { userId: user.id, role: 'OWNER' },
    ]);

    const resets = await db.passwordReset.findMany({ where: { userId: user.id } });
    expect(resets).toHaveLength(1);
    expect(resets[0]).toMatchObject({ usedAt: null });
    expect(resets[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const hours = (resets[0]!.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThanOrEqual(24);

    const letter = mailbox.find((l) => l.to === owner)!;
    expect(letter.text).toContain(`${APP}/login/set-password?token=`);
    // токен из письма подходит к хешу в базе, а самого токена в базе нет
    expect(hashSessionToken(tokenOf(letter))).toBe(resets[0]!.tokenHash);

    const audit = await db.auditLog.findMany({ where: { organizationId: made.organizationId, action: 'organization.created' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      userId: admin,
      entityId: made.organizationId,
      after: { name: `Хостел Новый ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY' },
    });

    const summary = await repo.organization(made.organizationId);
    expect(summary).toMatchObject({ members: 1, owners: [owner], ownerPending: true, status: 'TRIAL' });
    expect(JSON.stringify(summary)).not.toContain(resets[0]!.tokenHash);
  });

  it('ссылка из письма ставит пароль и подтверждает почту; потом ownerPending false, а повторная ссылка 409', async () => {
    const owner = email('confirm');
    const made = await creation.create({ name: `Хостел Пароль ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY', by: admin });
    track(made.organizationId);
    const token = tokenOf(mailbox.filter((l) => l.to === owner).at(-1)!);

    const resets = new PasswordResetService({ db } as PrismaService, null, APP);
    await resets.confirm({ token, password: 'Kakoi-to-Parol-2026!' });
    const user = await db.user.findUniqueOrThrow({ where: { email: owner } });
    expect(user.passwordHash).not.toBe('');
    expect(user.emailVerifiedAt).not.toBeNull();
    // ссылка одноразовая
    await expect(resets.confirm({ token, password: 'Drugoi-Parol-2026!' })).rejects.toThrow();

    expect(await repo.organization(made.organizationId)).toMatchObject({ ownerPending: false });
    // чужой пароль главный администратор менять не может: ссылка владельцу, который уже вошёл, не выдаётся
    await expect(creation.resendOwnerLink(made.organizationId)).rejects.toThrow(new ConflictException(OWNER_HAS_PASSWORD));
  });

  it('почта занята: 409, транзакция откатилась, организации и филиала нет', async () => {
    const owner = email('taken');
    const first = await creation.create({ name: `Хостел Первый ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY', by: admin });
    track(first.organizationId);
    await expect(
      creation.create({ name: `Хостел Второй ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY', by: admin }),
    ).rejects.toThrow(new ConflictException(OWNER_EMAIL_TAKEN));
    expect(await db.organization.count({ where: { name: `Хостел Второй ${mark}` } })).toBe(0);
    expect(await db.property.count({ where: { name: `Хостел Второй ${mark}` } })).toBe(0);
  });

  it('название гостиницы занято (без учёта регистра): 409; остальным направлениям название не мешает', async () => {
    const made = await creation.create({ name: `Хостел Занят ${mark}`, ownerEmail: email('name1'), vertical: 'HOSPITALITY', by: admin });
    track(made.organizationId);
    await expect(
      creation.create({ name: `хостел занят ${mark}`, ownerEmail: email('name2'), vertical: 'HOSPITALITY', by: admin }),
    ).rejects.toThrow(new ConflictException(HOTEL_NAME_TAKEN));
    expect(await db.organization.count({ where: { name: `хостел занят ${mark}` } })).toBe(0);
  });

  it('салон без пилота: 403 и ничего не создано; почта из списка пилота: бизнес и филиал без объекта', async () => {
    const owner = email('beauty');
    await expect(
      creation.create({ name: `Салон Лотос ${mark}`, ownerEmail: owner, vertical: 'BEAUTY', by: admin }),
    ).rejects.toThrow(ForbiddenException);
    expect(await db.organization.count({ where: { name: `Салон Лотос ${mark}` } })).toBe(0);
    expect(await db.user.count({ where: { email: owner } })).toBe(0);

    process.env.REGISTRATION_BEAUTY_PILOT_EMAILS = owner;
    const made = await creation.create({ name: `Салон Лотос ${mark}`, ownerEmail: owner, vertical: 'BEAUTY', by: admin });
    track(made.organizationId);
    expect(await db.business.count({ where: { organizationId: made.organizationId, vertical: 'BEAUTY' } })).toBe(1);
    expect(await db.location.count({ where: { business: { organizationId: made.organizationId } } })).toBe(1);
    expect(await db.property.count({ where: { organizationId: made.organizationId } })).toBe(0);
  });

  it('письмо не ушло: организация создана; ссылка ещё раз гасит прежнюю, чаще раза в пять минут нельзя', async () => {
    const owner = email('resend');
    mailer.failing = true;
    const made = await creation.create({ name: `Хостел Письмо ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY', by: admin });
    track(made.organizationId);
    expect(made.ownerLinkSent).toBe(false);
    expect(await repo.organization(made.organizationId)).toMatchObject({ ownerPending: true });
    const user = await db.user.findUniqueOrThrow({ where: { email: owner } });
    const [first] = await db.passwordReset.findMany({ where: { userId: user.id } });

    mailer.failing = false;
    const again = await creation.resendOwnerLink(made.organizationId);
    expect(again.ownerLinkSent).toBe(true);
    const rows = await db.passwordReset.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    // прежняя ссылка погашена, новая живая и подходит к токену из письма
    expect(rows.find((r) => r.id === first!.id)!.usedAt).not.toBeNull();
    const live = rows.find((r) => r.usedAt === null)!;
    expect(hashSessionToken(tokenOf(mailbox.filter((l) => l.to === owner).at(-1)!))).toBe(live.tokenHash);

    // не чаще раза в пять минут: письмо ушло, второе подряд 429
    await expect(creation.resendOwnerLink(made.organizationId)).rejects.toMatchObject({ status: 429 });
    await expect(creation.resendOwnerLink(made.organizationId)).rejects.toBeInstanceOf(HttpException);
    // через шесть минут можно снова
    const later = await creation.resendOwnerLink(made.organizationId, new Date(Date.now() + 6 * 60_000));
    expect(later.ownerLinkSent).toBe(true);
  });
});
