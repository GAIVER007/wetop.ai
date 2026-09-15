import { normalizeEmail } from '@pms/domain';

export type AccountsCommand =
  | { kind: 'list' }
  | { kind: 'create'; email: string; name: string }
  | { kind: 'invite'; email: string; name: string }
  | { kind: 'password'; email: string }
  | { kind: 'block'; email: string }
  | { kind: 'unblock'; email: string };

export type ParseResult = { ok: true; command: AccountsCommand } | { ok: false; error: string };



export const USAGE = `Учётные записи стойки (DATA_MODEL §13, ADR-047).

  npm run accounts -- list
  npm run accounts -- invite --email=aigul@luxx.kz --name="Айгуль Сеитова"
  PMS_NEW_PASSWORD=… npm run accounts -- create --email=aigul@luxx.kz --name="Айгуль Сеитова"
  PMS_NEW_PASSWORD=… npm run accounts -- password --email=aigul@luxx.kz
  npm run accounts -- block --email=aigul@luxx.kz
  npm run accounts -- unblock --email=aigul@luxx.kz

invite — сотрудник задаёт пароль сам по ссылке из письма (нужен RESEND_API_KEY; без него команда
печатает ссылку, и её передаёт владелец). create — владелец задаёт пароль за него.

Ролей в модели нет намеренно: ADR-023 в силе, вместо прав журнал с автором (Q-135). Человек попадает
в организацию через членство — команды создают его в единственной организации объекта.
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
    const name = (arg('name') ?? '').trim();
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    if (!name) return { ok: false, error: '--name= обязателен: журналу нужно имя, а не только почта' };
    return { ok: true, command: { kind: command, email, name } };
  }

  if (command === 'password' || command === 'block' || command === 'unblock') {
    const email = normalizeEmail(arg('email'));
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    return { ok: true, command: { kind: command, email } };
  }

  return { ok: false, error: USAGE };
}
