'use client';
import { RoleAccess } from './role-access';
import { useState, useTransition } from 'react';
import {
  MEMBERSHIP_ROLES,
  invitableRoles,
  type InviteRole,
  type MembershipRole,
} from '@pms/domain';
import { Button, Select } from '../../components/ui';
import { useConfirm } from '../../components/use-confirm';
import type { AuthInvite, AuthMember } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import {
  inviteAction,
  removeMemberAction,
  revokeInviteAction,
  setMemberRoleAction,
  type TeamActionResult,
} from './actions';

/**
 * Сотрудники организации (ADR-107, DATA_MODEL §16.1 v1.14): пригласить с ролью, люди с ролями, ожидающие приглашения.
 * Владелец зовёт управляющих и администраторов, меняет роль между ними и отключает их; управляющий зовёт и отключает
 * только администраторов. Что можно с каждым человеком и приглашением, решает API — строка несёт его ответ.
 */
export function TeamSection({
  role,
  invites,
  members,
  workspace = false,
}: {
  workspace?: boolean;
  role: MembershipRole;
  invites: AuthInvite[];
  members: AuthMember[];
}) {
  const roles = invitableRoles(role);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('STAFF');
  const [error, setError] = useState('');
  const [invited, setInvited] = useState<Array<{ email: string; role: InviteRole }>>([]);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  const run = (action: () => Promise<TeamActionResult>) =>
    start(async () => {
      setError('');
      const r = await action();
      if (r.error) setError(r.error);
    });

  function submitInvite() {
    const sent = inviteRole;
    start(async () => {
      setError('');
      const r = await inviteAction(email, sent);
      if (r.error) setError(r.error);
      else {
        setInvited((list) => [{ email: r.email!, role: sent }, ...list]);
        setEmail('');
      }
    });
  }

  const who = (m: AuthMember) => m.name ?? m.email;
  const waiting = invites;

  return (
    <section className="login-invites" aria-labelledby="team-heading" data-testid="team">
      <h2 id="team-heading">{workspace ? 'Добавить сотрудника' : 'Сотрудники'}</h2>
      <p className="muted">
        Отправьте приглашение на почту. Сотрудник сам задаст пароль и войдёт в вашу организацию.
        Ссылка действует 7 дней.
      </p>
      <form
        className="team-invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          submitInvite();
        }}
      >
        <label className="field">
          Почта приглашённого
          <input
            className="inp"
            type="email"
            name="inviteEmail"
            autoComplete="off"
            placeholder="admin@hotel.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {roles.length > 1 ? (
          <label className="field">
            Роль
            <Select
              name="inviteRole"
              // подпись вокруг списка добавила бы к имени выбранную роль: имя задаём явно, видимое слово в нём есть
              aria-label="Роль приглашённого"
              aria-describedby="team-role-help"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InviteRole)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {capital(MEMBERSHIP_ROLES[r])}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <p className="muted" data-testid="invite-role-fixed">
            Управляющий приглашает администраторов; управляющих приглашает владелец.
          </p>
        )}
        <p className="team-role-help" id="team-role-help">
          {inviteRole === 'MANAGER'
            ? 'Управляющий: работа с гостями, номерной фонд, тарифы, финансы, интеграции и приглашение администраторов. Права владельца не передаются.'
            : 'Администратор: брони, гости, заезды и выезды, приём оплат и просмотр отчётов. Без изменения тарифов, настроек и управления сотрудниками.'}
        </p>
        <details className="team-access" open>
          <summary>Что будет доступно сотруднику</summary>
          <RoleAccess role={inviteRole} />
        </details>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--secondary" type="submit" disabled={pending}>
          Отправить приглашение
        </button>
      </form>

      <h2 className="team-list-heading">В команде · {members.length}</h2>
      <ul className="login-invite-list" data-testid="member-list" aria-label="Люди организации">
        {members.map((m) => (
          <li key={m.userId} className="login-team-row" data-testid="member-row">
            <span className="login-team-row__who">
              <b>{who(m)}</b>{' '}
              <span className="muted">
                {m.name ? `${m.email}, ` : ''}
                {MEMBERSHIP_ROLES[m.role]}
                {m.you ? ' — это вы' : ''}
              </span>
            </span>
            <details className="team-access">
              <summary>Посмотреть права</summary>
              <RoleAccess role={m.role} />
            </details>
            {m.roleEditable && (
              <Select
                aria-label={`Роль: ${who(m)}`}
                value={m.role}
                disabled={pending}
                onChange={(e) => run(() => setMemberRoleAction(m.userId, e.target.value))}
              >
                <option value="MANAGER">{capital(MEMBERSHIP_ROLES.MANAGER)}</option>
                <option value="STAFF">{capital(MEMBERSHIP_ROLES.STAFF)}</option>
              </Select>
            )}
            {m.removable && (
              <Button
                type="button"
                tone="secondary"
                size="sm"
                disabled={pending}
                onClick={async () => {
                  const ok = await ask({
                    title: `Отключить: ${who(m)}?`,
                    body: 'Человек сразу потеряет доступ к организации: его сеансы погаснут на следующем действии. Позвать снова можно приглашением.',
                    confirmLabel: 'Отключить',
                  });
                  if (ok) run(() => removeMemberAction(m.userId));
                }}
              >
                Отключить
              </Button>
            )}
          </li>
        ))}
      </ul>

      <h2 className="team-list-heading">Ожидают принятия · {waiting.length}</h2>
      {waiting.length > 0 ? (
        <ul className="login-invite-list" data-testid="invite-list" aria-label="Приглашения">
          {waiting.map((i) => (
            <li key={i.id} className="login-team-row">
              <span className="login-team-row__who">
                <b>{i.email}</b>{' '}
                <span className="muted">
                  {MEMBERSHIP_ROLES[i.role ?? 'STAFF']},{' '}
                  {invited.some((n) => n.email === i.email) ? 'приглашение отправлено, ' : ''}ждёт
                  ответа до{' '}
                  <time dateTime={i.expiresAt}>{displayDate(i.expiresAt.slice(0, 10))}</time>
                </span>
              </span>
              <details className="team-access">
                <summary>Посмотреть права приглашённого</summary>
                <RoleAccess role={i.role ?? 'STAFF'} />
              </details>
              {i.revocable && (
                <Button
                  type="button"
                  tone="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => revokeInviteAction(i.id))}
                >
                  Отозвать
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" data-testid="invite-empty">
          Ожидающих приглашений нет.
        </p>
      )}
      {dialog}
    </section>
  );
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
