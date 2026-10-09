import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConflictException, HttpException } from '@nestjs/common';
import { createPrismaClient, type Db } from '@pms/database';
import { hashSessionToken, parseOrganizationCreate, type OrganizationCreate } from '@pms/domain';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PasswordResetService } from '../../apps/api/src/auth/password-reset.service';
import {
  HOTEL_NAME_TAKEN,
  ORGANIZATION_NAME_TAKEN,
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

  beforeAll(async () => {
    db = createPrismaClient(url);
    creation = new OrganizationCreation({ db } as PrismaService, mailer, APP);
    repo = new PrismaExtensionsRepository({ db } as PrismaService);
    await db.user.create({ data: { id: admin, email: `org2-admin-${mark}@example.invalid` } });
    emails.push(`org2-admin-${mark}@example.invalid`);
  });

  afterEach(() => {
    mailer.failing = false;
  });

  afterAll(async () => {
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

  /** Форма окна «Создать организацию» (ADR-159), приведённая тем же разбором, что у API */
  const form = (over: Record<string, unknown>): OrganizationCreate & { by: string } => {
    const parsed = parseOrganizationCreate({
      id: randomUUID(),
      brand: 'Бренд',
      vertical: 'HOSPITALITY',
      ownerName: 'Владелец Пример',
      phoneCountry: 'KZ',
      ownerPhone: '700 123 45 67',
      country: 'KZ',
      city: 'Алматы',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      bin: '1234567890',
      website: 'example.kz',
      createFirstBranch: true,
      branchAddress: 'Алматы, ул. Пример, 1',
      // название филиала по умолчанию своё у каждой организации: гостиничные названия не повторяются
      branchName: String(over.name ?? ''),
      ...over,
    });
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));
    return { ...parsed.value, by: admin };
  };

  const track = (id: string) => {
    orgs.push(id);
    return id;
  };

  it('гостиница: организация, филиал, владелец без пароля, ссылка и журнал; токен только хешем', async () => {
    const owner = email('hotel');
    const made = await creation.create(form({ name: `Хостел Новый ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY' }));
    track(made.organizationId);
    expect(made.ownerLinkSent).toBe(true);

    const org = await db.organization.findUniqueOrThrow({ where: { id: made.organizationId } });
    // пробного периода нет: организация работает сразу и без срока
    expect(org).toMatchObject({ name: `Хостел Новый ${mark}`, status: 'ACTIVE', trialEndsAt: null, reportingCurrency: 'KZT' });

    const property = await db.property.findFirstOrThrow({ where: { organizationId: made.organizationId } });
    expect(property).toMatchObject({ name: `Хостел Новый ${mark}`, timezone: 'Asia/Almaty', currency: 'KZT' });
    expect(property.locationId).toBeTruthy();
    // бизнес с публичным названием, а не с названием организации
    expect(await db.business.findMany({ where: { organizationId: made.organizationId }, select: { name: true, vertical: true } })).toEqual([
      { name: 'Бренд', vertical: 'HOSPITALITY' },
    ]);

    const user = await db.user.findUniqueOrThrow({ where: { email: owner } });
    expect(user).toMatchObject({ passwordHash: '', status: 'ACTIVE', emailVerifiedAt: null });
    expect(await db.membership.findMany({ where: { organizationId: made.organizationId }, select: { userId: true, role: true, phone: true } })).toEqual([
      { userId: user.id, role: 'OWNER', phone: '+77001234567' },
    ]);
    expect(user.name).toBe('Владелец Пример');

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
      after: { name: `Хостел Новый ${mark}`, brand: 'Бренд', ownerEmail: owner, vertical: 'HOSPITALITY', bin: '1234567890', website: 'https://example.kz' },
    });

    const summary = await repo.organization(made.organizationId);
    expect(summary).toMatchObject({ members: 1, owners: [owner], ownerPending: true, status: 'ACTIVE' });
    expect(JSON.stringify(summary)).not.toContain(resets[0]!.tokenHash);
  });

  it('ссылка из письма ставит пароль и подтверждает почту; потом ownerPending false, а повторная ссылка 409', async () => {
    const owner = email('confirm');
    const made = await creation.create(form({ name: `Хостел Пароль ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY' }));
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
    const first = await creation.create(form({ name: `Хостел Первый ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY' }));
    track(first.organizationId);
    await expect(
      creation.create(form({ name: `Хостел Второй ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY' })),
    ).rejects.toThrow(new ConflictException(OWNER_EMAIL_TAKEN));
    expect(await db.organization.count({ where: { name: `Хостел Второй ${mark}` } })).toBe(0);
    expect(await db.property.count({ where: { name: `Хостел Второй ${mark}` } })).toBe(0);
  });

  it('название организации занято (без учёта регистра): 409; название гостиницы занято: 409 своими словами', async () => {
    const made = await creation.create(form({ name: `Хостел Занят ${mark}`, ownerEmail: email('name1') }));
    track(made.organizationId);
    await expect(creation.create(form({ name: `хостел занят ${mark}`, ownerEmail: email('name2') }))).rejects.toThrow(
      new ConflictException(ORGANIZATION_NAME_TAKEN),
    );
    expect(await db.organization.count({ where: { name: `хостел занят ${mark}` } })).toBe(0);
    // другая организация, но гостиница с тем же названием (служебные пути ищут объект по названию)
    await expect(
      creation.create(form({ name: `Другая Группа ${mark}`, branchName: `ХОСТЕЛ ЗАНЯТ ${mark}`, ownerEmail: email('name3') })),
    ).rejects.toThrow(new ConflictException(HOTEL_NAME_TAKEN));
    expect(await db.organization.count({ where: { name: `Другая Группа ${mark}` } })).toBe(0);
  });

  it('салон и ресторан создаёт главный администратор без списка пилота: бизнес направления и филиал без объекта', async () => {
    for (const vertical of ['BEAUTY', 'FOOD_SERVICE'] as const) {
      const made = await creation.create(form({ name: `Лотос ${vertical} ${mark}`, ownerEmail: email(vertical), vertical }));
      track(made.organizationId);
      expect(await db.business.findMany({ where: { organizationId: made.organizationId }, select: { name: true, vertical: true } })).toEqual([
        { name: 'Бренд', vertical },
      ]);
      const locations = await db.location.findMany({ where: { business: { organizationId: made.organizationId } } });
      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({ name: `Лотос ${vertical} ${mark}`, currency: 'KZT', timezone: 'Asia/Almaty' });
      expect(await db.property.count({ where: { organizationId: made.organizationId } })).toBe(0);
    }
  });

  it('без первого филиала: только организация и бизнес', async () => {
    const made = await creation.create(form({ name: `Без Филиала ${mark}`, ownerEmail: email('nobranch'), createFirstBranch: false }));
    track(made.organizationId);
    expect(await db.business.count({ where: { organizationId: made.organizationId } })).toBe(1);
    expect(await db.location.count({ where: { business: { organizationId: made.organizationId } } })).toBe(0);
  });

  it('повтор того же запроса возвращает созданное, дубля и второго письма нет; тот же id с другим названием 409', async () => {
    const owner = email('replay');
    const input = form({ name: `Повтор ${mark}`, ownerEmail: owner });
    const first = await creation.create(input);
    track(first.organizationId);
    const letters = mailbox.filter((l) => l.to === owner).length;
    const again = await creation.create(input);
    expect(again).toMatchObject({ organizationId: input.id, replay: true, ownerLinkSent: false });
    expect(await db.organization.count({ where: { id: input.id } })).toBe(1);
    expect(await db.membership.count({ where: { organizationId: input.id } })).toBe(1);
    expect(mailbox.filter((l) => l.to === owner)).toHaveLength(letters);
    await expect(creation.create({ ...input, name: `${input.name} другая` })).rejects.toThrow(/другими данными/);
  });

  it('письмо не ушло: организация создана; ссылка ещё раз гасит прежнюю, чаще раза в пять минут нельзя', async () => {
    const owner = email('resend');
    mailer.failing = true;
    const made = await creation.create(form({ name: `Хостел Письмо ${mark}`, ownerEmail: owner, vertical: 'HOSPITALITY' }));
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
