import { normalizeEmail } from '@pms/domain';

export type AccountsCommand =
  | { kind: 'list' }
  | { kind: 'create'; email: string; fullName: string; role: Role }
  | { kind: 'invite'; email: string; fullName: string; role: Role }
  | { kind: 'password'; email: string }
  | { kind: 'block'; email: string }
  | { kind: 'unblock'; email: string };

export type ParseResult = { ok: true; command: AccountsCommand } | { ok: false; error: string };

const ROLES = ['OWNER', 'MANAGER', 'DESK', 'READONLY'] as const;
type Role = (typeof ROLES)[number];

export const USAGE = `Учётные записи стойки (DATA_MODEL §13 шаг 1).

  npm run accounts -- list
  npm run accounts -- invite --email=aigul@luxx.kz --name="Айгуль Сеитова" [--role=desk]
  PMS_NEW_PASSWORD=… npm run accounts -- create --email=aigul@luxx.kz --name="Айгуль Сеитова" [--role=desk]
  PMS_NEW_PASSWORD=… npm run accounts -- password --email=aigul@luxx.kz
  npm run accounts -- block --email=aigul@luxx.kz
  npm run accounts -- unblock --email=aigul@luxx.kz

invite — сотрудник задаёт пароль сам по ссылке из письма (нужен RESEND_API_KEY; без него команда
печатает ссылку, и её передаёт владелец). create — владелец задаёт пароль за него.

Роли: owner, manager, desk, readonly. На шаге 1 роль ничего не запрещает (ADR-023, Q-135).
Пароль передаётся только переменной PMS_NEW_PASSWORD — в аргументах он остался бы в истории оболочки.`;

/** Разбор аргументов отдельно от работы с базой: это можно проверить тестом без .env и без базы. */
export function parseAccountsArgs(argv: readonly string[]): ParseResult {
  const [command, ...rest] = argv;
  const arg = (name: string) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

  if (rest.some((a) => a.startsWith('--password=')))
    return { ok: false, error: 'пароль в аргументах не принимается — передайте его в PMS_NEW_PASSWORD' };

  if (command === 'list') return { ok: true, command: { kind: 'list' } };

  if (command === 'create' || command === 'invite') {
    const email = normalizeEmail(arg('email'));
    const fullName = (arg('name') ?? '').trim();
    const roleRaw = (arg('role') ?? 'desk').trim().toUpperCase();
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    if (!fullName) return { ok: false, error: '--name= обязателен: журналу нужно имя, а не только почта' };
    const role = ROLES.find((r) => r === roleRaw);
    if (!role) return { ok: false, error: `--role= одна из: ${ROLES.join(', ').toLowerCase()}` };
    return { ok: true, command: { kind: command, email, fullName, role } };
  }

  if (command === 'password' || command === 'block' || command === 'unblock') {
    const email = normalizeEmail(arg('email'));
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    return { ok: true, command: { kind: command, email } };
  }

  return { ok: false, error: USAGE };
}
