import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { hashSecret, newSessionToken } from '@pms/shared';
import { PrismaAccountsRepository } from '../../apps/api/src/accounts/accounts.prisma-repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
process.env.SESSION_SECRET ??= 'секрет-для-прогона';
const url = process.env.DATABASE_URL;

/**
 * Срез 13, этап 7: хранилище приглашений на живой базе (DATA_MODEL §13.6). Контроллер доказан на
 * подделке; здесь — то, что делает сама база: уникальность отпечатка, составной ключ членства
 * (повторное вступление не падает и не дублирует), принятие один раз, список без принятых и
 * просроченных. Строки свои, с суффиксом прогона; в конце удаляются.
 */
describe.skipIf(!url)('invites repository (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaAccountsRepository;
  const mark = randomUUID().slice(0, 8);
  const ownerEmail = `owner-${mark}@example.test`;
  const inviteeEmail = `invitee-${mark}@example.test`;
  const outsiderEmail = `outsider-${mark}@example.test`;
  let organizationId = '';
  let ownerId = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaAccountsRepository({ db } as unknown as PrismaService);
    const owner = await repo.createAccount({
      email: ownerEmail,
      organizationName: `Приглашения (integration ${mark})`,
      trialEndsAt: new Date(Date.now() + 7 * 86_400_000),
    });
    if (!owner) throw new Error('владелец не создан');
    organizationId = owner.organizationId;
    ownerId = owner.userId;
  });

  afterAll(async () => {
    if (!db) return;
    await db.invite.deleteMany({ where: { organizationId } });
    await db.session.deleteMany({ where: { organizationId } });
    await db.membership.deleteMany({ where: { organizationId } });
    await db.user.deleteMany({
      where: { email: { in: [ownerEmail, inviteeEmail, outsiderEmail] } },
    });
    await db.organization.deleteMany({ where: { id: organizationId } });
    await db.$disconnect();
  });

  it('создание → поиск по отпечатку → принятие → список без принятых и просроченных', async () => {
    const token = newSessionToken();
    const created = await repo.createInvite({
      organizationId,
      email: inviteeEmail,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      createdBy: ownerId,
      role: 'STAFF',
    });
    expect(created.organizationId).toBe(organizationId);
    expect(created.email).toBe(inviteeEmail);
    expect(created.acceptedAt).toBeNull();

    const found = await repo.inviteByTokenHash(hashSecret(token));
    expect(found?.id).toBe(created.id);
    expect(found?.organizationName).toContain('Приглашения');
    expect(await repo.inviteByTokenHash(hashSecret('чужой ключ'))).toBeNull();

    // просроченное — в списке ожидающих его нет
    await repo.createInvite({
      organizationId,
      email: outsiderEmail,
      tokenHash: hashSecret(newSessionToken()),
      expiresAt: new Date(Date.now() - 1000),
      createdBy: ownerId,
      role: 'STAFF',
    });
    const pending = await repo.pendingInvites(organizationId, new Date());
    expect(pending.map((i) => i.email)).toEqual([inviteeEmail]);

    await repo.markInviteAccepted(created.id, new Date());
    expect((await repo.inviteByTokenHash(hashSecret(token)))?.acceptedAt).not.toBeNull();
    expect(await repo.pendingInvites(organizationId, new Date())).toEqual([]);
  });

  it('вступление: новый человек заведён с членством; повторное вступление не падает и не дублирует', async () => {
    expect(await repo.isMember(inviteeEmail, organizationId)).toBe(false);
    const joined = await repo.joinOrganization({ email: inviteeEmail, organizationId, role: 'STAFF' });
    expect(joined.email).toBe(inviteeEmail);
    expect(joined.organizationId).toBe(organizationId);
    expect(await repo.isMember(inviteeEmail, organizationId)).toBe(true);

    const again = await repo.joinOrganization({ email: inviteeEmail, organizationId, role: 'STAFF' });
    expect(again.userId).toBe(joined.userId);
    const memberships = await db.membership.count({ where: { organizationId } });
    expect(memberships).toBe(2); // владелец и приглашённый, без дубля

    // приглашённый входит именно в эту организацию
    const account = await repo.accountByEmail(inviteeEmail);
    expect(account?.organizationId).toBe(organizationId);
  });

  it('второе приглашение с тем же отпечатком база отвергает', async () => {
    const tokenHash = hashSecret(newSessionToken());
    await repo.createInvite({
      organizationId,
      email: outsiderEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdBy: ownerId,
      role: 'STAFF',
    });
    await expect(
      repo.createInvite({
        organizationId,
        email: outsiderEmail,
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdBy: ownerId,
        role: 'STAFF',
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  /** Отзывает владелец: ему доступны приглашения с любой ролью (ADR-107) */
  const ALL_INVITE_ROLES = ['MANAGER', 'STAFF'] as const;

  // Аудит 26.09, С-10 и С-11: отзыв приглашения и суточный счётчик — на настоящей базе, а не только на подделке
  it('отзыв гасит только живое приглашение своей организации; счётчик за сутки считает созданные', async () => {
    const since = new Date(Date.now() - 60_000);
    const before = await repo.invitesCreatedSince(organizationId, since);
    const created = await repo.createInvite({
      organizationId,
      email: outsiderEmail,
      tokenHash: hashSecret(newSessionToken()),
      expiresAt: new Date(Date.now() + 86_400_000),
      createdBy: ownerId,
      role: 'STAFF',
    });
    expect(await repo.invitesCreatedSince(organizationId, since)).toBe(before + 1);
    expect(await repo.revokeInvite(created.id, randomUUID(), new Date(), ALL_INVITE_ROLES)).toBe(false);
    expect(await repo.revokeInvite('не-uuid', organizationId, new Date(), ALL_INVITE_ROLES)).toBe(false);
    expect(await repo.revokeInvite(created.id, organizationId, new Date(), ALL_INVITE_ROLES)).toBe(true);
    expect((await repo.pendingInvites(organizationId, new Date())).map((i) => i.id)).not.toContain(
      created.id,
    );
    expect(await repo.revokeInvite(created.id, organizationId, new Date(), ALL_INVITE_ROLES)).toBe(false);
  });
});
