'use client';
import Link from 'next/link';
import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { Icon } from '../../../components/icon';
import type { AuthOrganizationRow, AuthSessionRow, SignedIn } from '../../../lib/api';
import { logoutAllAction, signOut } from '../../login/actions';
import { trialLine } from '../../../lib/desk-person';
import { displayDate } from '../../../lib/display-date';

/** Управление доступом перенесено с публичного входа в защищённый профиль (ADR-131). */
export function AccessPanel({
  user,
  sessions = [],
  organizations = [],
  organizationError = null,
}: {
  user: SignedIn;
  sessions?: AuthSessionRow[];
  organizations?: AuthOrganizationRow[];
  organizationError?: string | null;
}) {
  const role = user.role ? parseMembershipRole(user.role) : null;
  const trial = trialLine(user.organization, new Date());
  return (
    <main className="panel" id="main-content" aria-label="Управление доступом">
      <h1>Управление доступом</h1>
      <p>
        как <b>{user.name ?? user.email}</b>
        {user.name ? `, ${user.email}` : ''}
        {user.organization && (
          <>
            <br />
            {user.organization.name}
            {trial && (
              <>
                <br />
                <span className="muted">{trial}</span>
              </>
            )}
          </>
        )}
      </p>
      <Link className="btn" href="/today">
        Открыть рабочее место
        <Icon name="arrow" width={16} />
      </Link>
      <form action={signOut} className="login-preview">
        <span>Смена закончена?</span>
        <button type="submit">Выйти</button>
      </form>
      {/* Команда переехала на свою страницу «Сотрудники» (TEAM1): здесь — личный доступ и ссылка */}
      {user.organization && role && canManageStaff(role) ? (
        <section className="login-invites" aria-labelledby="invite-heading">
          <h2 id="invite-heading">Сотрудники</h2>
          <p className="muted">Приглашения, роли и отключение — на странице «Сотрудники».</p>
          <Link className="btn btn--secondary" href="/team" data-testid="team-link">
            Открыть «Сотрудников»
          </Link>
        </section>
      ) : (
        <section className="login-invites" aria-labelledby="invite-heading">
          <h2 id="invite-heading">Сотрудники</h2>
          <p className="muted" data-testid="invite-not-allowed">
            Приглашать сотрудников могут владелец и управляющий.
          </p>
        </section>
      )}
      {organizations.length > 1 && (
        <OrganizationSwitch organizations={organizations} error={organizationError} />
      )}
      {/* «Где я вошёл» и «выйти везде» (§13.5): отзыв гасит все ключи человека, включая этот */}
      <section className="login-invites" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Где вы вошли</h2>
        {sessions.length > 0 ? (
          <ul className="login-invite-list" data-testid="session-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <b>{s.device}</b>{' '}
                <span className="muted">
                  вход <time dateTime={s.issuedAt}>{displayDate(s.issuedAt.slice(0, 10))}</time>
                  {s.current ? ', этот сеанс' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Список сеансов недоступен.</p>
        )}
        <form action={logoutAllAction}>
          <button type="submit" className="btn btn--secondary">
            Завершить все сеансы
          </button>
        </form>
      </section>
    </main>
  );
}

const ROLE_WORD: Record<string, string> = { OWNER: 'владелец', MANAGER: 'управляющий', STAFF: 'администратор' };

/** Один аккаунт в нескольких организациях: обычная форма, переход проверяет сервер (§13.5, `/auth/organization`) */
function OrganizationSwitch({
  organizations,
  error,
}: {
  organizations: AuthOrganizationRow[];
  error: string | null;
}) {
  return (
    <section className="login-invites" aria-labelledby="orgs-heading">
      <h2 id="orgs-heading">Ваши организации</h2>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <ul className="login-invite-list" data-testid="organization-list">
        {organizations.map((o) => (
          <li key={o.id}>
            <b>{o.name}</b> <span className="muted">{ROLE_WORD[o.role] ?? o.role}</span>{' '}
            {o.current ? (
              <span className="muted">, вы сейчас здесь</span>
            ) : (
              <form method="post" action="/auth/organization">
                <input type="hidden" name="organizationId" value={o.id} />
                <button type="submit" className="btn btn--secondary">
                  Перейти<span className="sr-only"> в «{o.name}»</span>
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
