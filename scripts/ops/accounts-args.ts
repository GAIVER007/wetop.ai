import {
  parseMembershipRole,
  validEmail,
  type ExtensionStatus,
  type MembershipRole,
} from '@pms/domain';

export type AccountsCommand =
  | { kind: 'list' }
  | { kind: 'create'; email: string; name: string }
  | { kind: 'invite'; email: string; name: string }
  | { kind: 'password'; email: string }
  | { kind: 'block'; email: string }
  | { kind: 'unblock'; email: string }
  | { kind: 'role'; email: string; role: MembershipRole }
  | { kind: 'platform-admin'; email: string; note: string | null }
  | { kind: 'platform-admin-revoke'; email: string }
  /** Срок и заметку проверяет домен (`parseExtensionChange`) при выполнении: там же, где форма «Платформы» */
  | { kind: 'extension'; email: string; status: ExtensionStatus; until: string; note: string };

export type ParseResult = { ok: true; command: AccountsCommand } | { ok: false; error: string };



export const USAGE = `Учётные записи стойки (DATA_MODEL §13, ADR-049).

  npm run accounts -- list
  npm run accounts -- invite --email=aigul@luxx.kz --name="Айгуль Сеитова"
  PMS_NEW_PASSWORD=… npm run accounts -- create --email=aigul@luxx.kz --name="Айгуль Сеитова"
  PMS_NEW_PASSWORD=… npm run accounts -- password --email=aigul@luxx.kz
  npm run accounts -- block --email=aigul@luxx.kz
  npm run accounts -- unblock --email=aigul@luxx.kz
  npm run accounts -- role --email=aigul@luxx.kz --role=owner|staff
  npm run accounts -- platform-admin --email=owner@wetop.ai --note="владелец WETOP"
  npm run accounts -- platform-admin-revoke --email=owner@wetop.ai
  npm run accounts -- extension --email=owner@wetop.ai --status=active|trial|off --until=2026-12-31 --note="счёт 12"

invite — сотрудник задаёт пароль сам по ссылке из письма (нужен MAIL_API_KEY; без него команда
печатает ссылку, и её передаёт владелец). create — владелец задаёт пароль за него.

Роли (DATA_MODEL §16.1, ADR-083): владелец (owner) и сотрудник (staff). На стойке они равноправны (ADR-023);
владелец приглашает сотрудников и настраивает ИИ-продавца. create и invite заводят сотрудника, владельца —
только если в организации его ещё нет; последнего владельца команда role не снимает. Роль и расширение
относятся к организации, в которой человек открывает сессию, — самой ранней по вступлению.

platform-admin — главный администратор платформы (§16.2): раздел «Платформа», расширения организаций,
техподдержка. Выдаётся и снимается только этой командой. extension — расширение «ИИ-продавец» организации
человека: active без --until — бессрочно, trial — только со сроком; дата включительно, по Алматы.
Пароль передаётся только переменной PMS_NEW_PASSWORD — в аргументах он остался бы в истории оболочки.`;

/** Разбор аргументов отдельно от работы с базой: это можно проверить тестом без .env и без базы. */
export function parseAccountsArgs(argv: readonly string[]): ParseResult {
  const [command, ...rest] = argv;
  const arg = (name: string) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

  if (rest.some((a) => a.startsWith('--password=')))
    return { ok: false, error: 'пароль в аргументах не принимается — передайте его в PMS_NEW_PASSWORD' };

  if (command === 'list') return { ok: true, command: { kind: 'list' } };

  if (command === 'create' || command === 'invite') {
    const email = validEmail(arg('email'));
    const name = (arg('name') ?? '').trim();
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    if (!name) return { ok: false, error: '--name= обязателен: журналу нужно имя, а не только почта' };
    return { ok: true, command: { kind: command, email, name } };
  }

  if (command === 'role') {
    const email = validEmail(arg('email'));
    const role = parseMembershipRole(arg('role') ?? '');
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    if (!role) return { ok: false, error: '--role= owner или staff' };
    return { ok: true, command: { kind: 'role', email, role } };
  }

  if (command === 'platform-admin' || command === 'platform-admin-revoke') {
    const email = validEmail(arg('email'));
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    if (command === 'platform-admin-revoke') return { ok: true, command: { kind: command, email } };
    const note = (arg('note') ?? '').trim();
    return { ok: true, command: { kind: command, email, note: note === '' ? null : note } };
  }

  if (command === 'extension') {
    const email = validEmail(arg('email'));
    const status = (arg('status') ?? '').trim().toUpperCase();
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    if (status !== 'TRIAL' && status !== 'ACTIVE' && status !== 'OFF')
      return { ok: false, error: '--status= active, trial или off' };
    return {
      ok: true,
      command: { kind: 'extension', email, status, until: (arg('until') ?? '').trim(), note: arg('note') ?? '' },
    };
  }

  if (command === 'password' || command === 'block' || command === 'unblock') {
    const email = validEmail(arg('email'));
    if (!email) return { ok: false, error: '--email= непохож на почту' };
    return { ok: true, command: { kind: command, email } };
  }

  return { ok: false, error: USAGE };
}
