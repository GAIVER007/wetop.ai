/**
 * Учётные записи сотрудников: завести, сменить пароль, заблокировать (DATA_MODEL §13, ADR-046 и ADR-049).
 *
 * Модель — из ADR-046: человек попадает в организацию через членство. Роли (владелец, сотрудник), главный
 * администратор платформы и расширения организации — DATA_MODEL §16, ADR-083. Вход по паролю — ADR-049.
 *
 * Пока нет рассылок (Q-142), первый вход выдаёт владелец этой командой. Пароль передаётся переменной
 * PMS_NEW_PASSWORD: в аргументах он остался бы в истории оболочки и в списке процессов.
 * DATABASE_URL читает программа из .env — не агент (SECURITY.md §3).
 *
 * Запуск: npm run accounts -- <команда>   (см. USAGE в accounts-args.ts)
 * Разовые скрипты — с DATABASE_POOL_MAX=1, чтобы не вычерпать пулер Supabase (TESTING.md).
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { mail } from '@pms/integrations';
import {
  canChangeRole,
  checkPassword,
  EXTENSION_STATUSES,
  hashPassword,
  MEMBERSHIP_ROLES,
  parseExtensionChange,
  hashSessionToken,
  invitationLetter,
  newSessionToken,
  resetExpiry,
  resetLink,
} from '@pms/domain';
import { parseAccountsArgs, USAGE } from './accounts-args';

const ROOT = resolve(import.meta.dirname, '../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const parsed = parseAccountsArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error === USAGE ? USAGE : `${parsed.error}\n\n${USAGE}`);
  process.exit(2);
}
const command = parsed.command;

/** Пароль нужен только там, где он и правда нужен. */
function newPassword(): string {
  const value = process.env.PMS_NEW_PASSWORD ?? '';
  const policy = checkPassword(value);
  if (!policy.ok) {
    console.error(`PMS_NEW_PASSWORD: ${policy.reason}`);
    process.exit(2);
  }
  return value;
}

const db = createPrismaClient();

/**
 * Роль нового участника: владелец, если у организации его ещё нет (первый человек только что заведённой
 * организации), иначе сотрудник (DATA_MODEL §16.1).
 */
async function roleForNewMember(organization: string): Promise<'OWNER' | 'STAFF'> {
  const owners = await db.membership.count({ where: { organizationId: organization, role: 'OWNER' } });
  return owners === 0 ? 'OWNER' : 'STAFF';
}

/**
 * Человек и организация, в которой он открывает сессию, — самая ранняя по вступлению (как при входе, §13.5).
 * Нет человека или членства — команда останавливается словами, а не падает на ограничении базы.
 */
async function memberByEmail(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1, include: { organization: true } } },
  });
  if (!user) {
    console.error(`сотрудника с почтой ${email} нет — смотрите список: npm run accounts -- list`);
    process.exit(2);
  }
  const membership = user.memberships[0];
  if (!membership) {
    console.error(`${email} не состоит ни в одной организации`);
    process.exit(2);
  }
  return { user, membership };
}

/** Единственная организация объекта: берём существующую, иначе создаём по имени объекта (§13.1). */
async function organizationId(): Promise<string> {
  const existing = await db.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return existing.id;
  const property = await db.property.findFirst({ select: { name: true } });
  const created = await db.organization.create({
    data: { name: property?.name ?? 'WETOP', status: 'ACTIVE' },
  });
  console.log(`создана организация «${created.name}»`);
  return created.id;
}

try {
  if (command.kind === 'list') {
    const users = await db.user.findMany({
      orderBy: { email: 'asc' },
      include: {
        memberships: { include: { organization: { select: { name: true } } } },
        platformAdmin: { select: { revokedAt: true } },
      },
    });
    if (users.length === 0) console.log('сотрудников нет: заведите первого командой create или invite');
    for (const u of users) {
      const last = u.lastLoginAt ? u.lastLoginAt.toISOString() : 'ни разу';
      const locked =
        u.lockedUntil && u.lockedUntil > new Date() ? `, заперт до ${u.lockedUntil.toISOString()}` : '';
      const orgs =
        u.memberships.map((m) => `${m.organization.name} (${MEMBERSHIP_ROLES[m.role]})`).join(', ') ||
        'без организации';
      const password = u.passwordHash === '' ? 'пароль не задан' : 'пароль задан';
      const admin = u.platformAdmin && u.platformAdmin.revokedAt === null ? '\tглавный администратор' : '';
      console.log(
        `${u.email}\t${u.name ?? '—'}\t${orgs}\t${u.status}\t${password}\tвход: ${last}${locked}${admin}`,
      );
    }
  }

  if (command.kind === 'create') {
    const password = newPassword();
    const organization = await organizationId();
    const user = await db.user.create({
      data: {
        email: command.email,
        name: command.name,
        status: 'ACTIVE',
        passwordHash: hashPassword(password),
      },
    });
    const role = await roleForNewMember(organization);
    await db.membership.create({ data: { userId: user.id, organizationId: organization, role } });
    await db.auditLog.create({
      data: {
        userId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: 'user.created',
        after: { email: user.email, organizationId: organization, role, by: 'cli' },
      },
    });
    console.log(`создан: ${user.email}. Пароль выдайте сотруднику лично.`);
  }

  if (command.kind === 'invite') {
    const existing = await db.user.findUnique({ where: { email: command.email } });
    if (existing) {
      console.error(`сотрудник с почтой ${command.email} уже есть — смените пароль командой password`);
      process.exit(2);
    }
    const organization = await organizationId();
    // пароль пустой: человек задаст его сам по ссылке (§13.8)
    const user = await db.user.create({
      data: { email: command.email, name: command.name, status: 'ACTIVE', passwordHash: '' },
    });
    await db.membership.create({
      data: { userId: user.id, organizationId: organization, role: await roleForNewMember(organization) },
    });
    // одна живая ссылка на человека: прежние неиспользованные гасим
    await db.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = newSessionToken();
    const now = new Date();
    await db.passwordReset.create({
      data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: resetExpiry(now) },
    });
    const link = resetLink(process.env.PUBLIC_APP_URL?.trim() || 'https://app.wetop.ai', token);
    await db.auditLog.create({
      data: {
        userId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: 'user.invited',
        after: { email: user.email, organizationId: organization, by: 'cli' },
      },
    });

    const config = mail.mailConfigFromEnv(process.env);
    if (!config) {
      console.log(`приглашён: ${user.email}.`);
      console.log('Отправка писем не настроена (MAIL_API_KEY пуст) — передайте ссылку сами:');
      console.log(link);
      console.log('Ссылка работает 24 часа и только один раз.');
    } else {
      const letter = invitationLetter({ name: command.name, link });
      await new mail.ResendMailSender({ config }).send({
        to: user.email,
        subject: letter.subject,
        text: letter.text,
      });
      console.log(`приглашён: ${user.email}; письмо отправлено, ссылка живёт 24 часа.`);
    }
  }

  if (command.kind === 'password') {
    const password = newPassword();
    const user = await db.user.update({
      where: { email: command.email },
      data: { passwordHash: hashPassword(password), failedAttempts: 0, lockedUntil: null },
    });
    // Пароль сменили со стороны — прежние сессии этого сотрудника гаснут
    const { count } = await db.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        userId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: 'user.password.changed',
        after: { by: 'cli', sessionsRevoked: count },
      },
    });
    console.log(`пароль изменён: ${user.email}; погашено сессий: ${count}`);
  }

  if (command.kind === 'block' || command.kind === 'unblock') {
    const block = command.kind === 'block';
    const user = await db.user.update({
      where: { email: command.email },
      data: block
        ? { status: 'BLOCKED' }
        : { status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
    });
    const { count } = block
      ? await db.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      : { count: 0 };
    await db.auditLog.create({
      data: {
        userId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: block ? 'user.blocked' : 'user.unblocked',
        after: { by: 'cli', sessionsRevoked: count },
      },
    });
    console.log(
      block ? `заблокирован: ${user.email}; погашено сессий: ${count}` : `разблокирован: ${user.email}`,
    );
  }
  // ── Роли, главный администратор, расширения (DATA_MODEL §16, ADR-083) ─────────────────────────

  if (command.kind === 'role') {
    const { user, membership } = await memberByEmail(command.email);
    const owners = await db.membership.count({
      where: { organizationId: membership.organizationId, role: 'OWNER' },
    });
    const allowed = canChangeRole({ current: membership.role, next: command.role, owners });
    if (!allowed.ok) {
      console.error(allowed.reason);
      process.exit(2);
    }
    await db.membership.update({
      where: { userId_organizationId: { userId: user.id, organizationId: membership.organizationId } },
      data: { role: command.role },
    });
    await db.auditLog.create({
      data: {
        userId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: 'membership.role.updated',
        before: { organizationId: membership.organizationId, role: membership.role },
        after: { organizationId: membership.organizationId, role: command.role, by: 'cli' },
      },
    });
    console.log(
      `${user.email} в «${membership.organization.name}» — ${MEMBERSHIP_ROLES[command.role]} (было: ${MEMBERSHIP_ROLES[membership.role]})`,
    );
  }

  if (command.kind === 'platform-admin' || command.kind === 'platform-admin-revoke') {
    const user = await db.user.findUnique({ where: { email: command.email } });
    if (!user) {
      console.error(`сотрудника с почтой ${command.email} нет — смотрите список: npm run accounts -- list`);
      process.exit(2);
    }
    const now = new Date();
    if (command.kind === 'platform-admin') {
      // строки не удаляются (§16.2): повторная выдача снимает отметку об отзыве и ставит новое время
      await db.platformAdmin.upsert({
        where: { userId: user.id },
        create: { userId: user.id, grantedAt: now, note: command.note },
        update: { grantedAt: now, revokedAt: null, note: command.note },
      });
    } else {
      const { count } = await db.platformAdmin.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (count === 0) {
        console.log(`${user.email} не главный администратор — снимать нечего`);
        process.exit(0);
      }
    }
    const granted = command.kind === 'platform-admin';
    await db.auditLog.create({
      data: {
        userId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: granted ? 'platform.admin.granted' : 'platform.admin.revoked',
        after: { by: 'cli', ...(granted && command.note ? { note: command.note } : {}) },
      },
    });
    console.log(
      granted
        ? `${user.email} — главный администратор платформы; раздел «Платформа» откроется при следующем запросе`
        : `${user.email} больше не главный администратор`,
    );
  }

  if (command.kind === 'extension') {
    const { membership } = await memberByEmail(command.email);
    const change = parseExtensionChange(
      { status: command.status, activeUntil: command.until, note: command.note },
      new Date(),
    );
    if (!change.ok) {
      console.error(change.errors.join('; '));
      process.exit(2);
    }
    const key = { organizationId: membership.organizationId, extension: 'AI_SELLER' as const };
    const before = await db.organizationExtension.findUnique({
      where: { organizationId_extension: key },
    });
    const now = new Date();
    await db.organizationExtension.upsert({
      where: { organizationId_extension: key },
      create: { ...key, ...change.value, updatedAt: now },
      update: { ...change.value, updatedAt: now, updatedBy: null },
    });
    await db.auditLog.create({
      data: {
        entityType: 'organization',
        entityId: membership.organizationId,
        action: 'extension.updated',
        before: before
          ? { extension: 'AI_SELLER', status: before.status, activeUntil: before.activeUntil?.toISOString() ?? null }
          : undefined,
        after: {
          extension: 'AI_SELLER',
          status: change.value.status,
          activeUntil: change.value.activeUntil?.toISOString() ?? null,
          by: 'cli',
        },
      },
    });
    const until = change.value.activeUntil ? `до ${change.value.activeUntil.toISOString()}` : 'бессрочно';
    console.log(
      `«ИИ-продавец» у «${membership.organization.name}»: ${EXTENSION_STATUSES[change.value.status]}${change.value.status === 'OFF' ? '' : `, ${until}`}`,
    );
  }
} finally {
  await db.$disconnect();
}
