/**
 * Учётные записи сотрудников: завести, сменить пароль, заблокировать (DATA_MODEL §13, ADR-046 и ADR-049).
 *
 * Модель — из ADR-046: человек попадает в организацию через членство, ролей нет. Вход по паролю — ADR-049
 * (способ входа ждёт решения владельца, Q-146).
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
  checkPassword,
  hashPassword,
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
      include: { memberships: { include: { organization: { select: { name: true } } } } },
    });
    if (users.length === 0) console.log('сотрудников нет: заведите первого командой create или invite');
    for (const u of users) {
      const last = u.lastLoginAt ? u.lastLoginAt.toISOString() : 'ни разу';
      const locked =
        u.lockedUntil && u.lockedUntil > new Date() ? `, заперт до ${u.lockedUntil.toISOString()}` : '';
      const orgs = u.memberships.map((m) => m.organization.name).join(', ') || 'без организации';
      const password = u.passwordHash === '' ? 'пароль не задан' : 'пароль задан';
      console.log(`${u.email}\t${u.name ?? '—'}\t${orgs}\t${u.status}\t${password}\tвход: ${last}${locked}`);
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
    await db.membership.create({ data: { userId: user.id, organizationId: organization } });
    await db.auditLog.create({
      data: {
        userId: user.id,
        entityType: 'user',
        entityId: user.id,
        action: 'user.created',
        after: { email: user.email, organizationId: organization, by: 'cli' },
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
    await db.membership.create({ data: { userId: user.id, organizationId: organization } });
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
      console.log('Отправка писем не настроена (RESEND_API_KEY пуст) — передайте ссылку сами:');
      console.log(link);
      console.log('Ссылка работает 24 часа и только один раз.');
    } else {
      const letter = invitationLetter({ name: command.name, link });
      await new mail.ResendMailer(config).send({
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
} finally {
  await db.$disconnect();
}
