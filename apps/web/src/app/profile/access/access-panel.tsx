'use client';
import Link from 'next/link';
import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { Icon } from '../../../components/icon';
import { Page } from '../../../components/page';
import { Alert, Badge, Button, Fact, Grid, Panel, Row, Stack } from '../../../components/ui';
import type { AuthOrganizationRow, AuthSessionRow, SignedIn } from '../../../lib/api';
import { logoutAllAction, signOut } from '../../login/actions';
import { trialLine } from '../../../lib/desk-person';
import { displayDate } from '../../../lib/display-date';

const ROLE_WORD: Record<string, string> = {
  OWNER: 'Владелец',
  MANAGER: 'Управляющий',
  STAFF: 'Администратор',
};

/**
 * «Управление доступом» (ADR-131): кто вошёл, в какой организации, свои сеансы и выход. Собрано из общих компонентов
 * стойки (страница, карточки, факты, кнопки), без своих стилей (DESIGN.md §8).
 */
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
    <Page
      title="Управление доступом"
      subtitle="Ваш вход, организация и сеансы"
      width="narrow"
      actions={
        <Link className="btn" href="/today">
          Открыть рабочее место
          <Icon name="arrow" width={16} />
        </Link>
      }
    >
      <Stack>
        <Panel title="Вы вошли">
          <Grid min={180} gap="sm">
            <Fact label="Имя" value={user.name ?? 'не указано'} />
            <Fact label="Почта" value={user.email} />
            {user.organization && <Fact label="Организация" value={user.organization.name} />}
            {user.role && <Fact label="Роль" value={ROLE_WORD[user.role] ?? user.role} />}
          </Grid>
          {trial && (
            <p>
              <Badge tone="info">{trial}</Badge>
            </p>
          )}
          <form action={signOut}>
            <Row>
              <span className="muted">Смена закончена?</span>
              <Button type="submit" tone="secondary">
                Выйти
              </Button>
            </Row>
          </form>
        </Panel>

        {organizations.length > 1 && (
          <OrganizationSwitch organizations={organizations} error={organizationError} />
        )}

        {/* «Где я вошёл» и «выйти везде» (§13.5): отзыв гасит все ключи человека, включая этот */}
        <Panel title="Где вы вошли" aria-label="Где вы вошли">
          {sessions.length > 0 ? (
            <ul className="login-invite-list" data-testid="session-list">
              {sessions.map((s) => (
                <li key={s.id} className="row row--between">
                  <span>
                    <b>{s.device}</b>{' '}
                    <span className="muted">
                      вход <time dateTime={s.issuedAt}>{displayDate(s.issuedAt.slice(0, 10))}</time>
                    </span>
                  </span>
                  {s.current && <Badge tone="ok">этот сеанс</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Список сеансов недоступен.</p>
          )}
          <form action={logoutAllAction}>
            <Button type="submit" tone="secondary">
              Завершить все сеансы
            </Button>
          </form>
        </Panel>

        {/* Команда живёт на своей странице «Сотрудники» (TEAM1): здесь только ссылка */}
        <Panel title="Сотрудники">
          {user.organization && role && canManageStaff(role) ? (
            <Row className="row--between">
              <span className="muted">Приглашения, роли и отключение.</span>
              <Link className="btn btn--secondary" href="/team" data-testid="team-link">
                Открыть «Сотрудников»
              </Link>
            </Row>
          ) : (
            <p className="muted" data-testid="invite-not-allowed">
              Приглашать сотрудников могут владелец и управляющий.
            </p>
          )}
        </Panel>
      </Stack>
    </Page>
  );
}

/** Один аккаунт в нескольких организациях: обычная форма, переход проверяет сервер (§13.5, `/auth/organization`) */
function OrganizationSwitch({
  organizations,
  error,
}: {
  organizations: AuthOrganizationRow[];
  error: string | null;
}) {
  return (
    <Panel title="Ваши организации">
      {error && <Alert boxed>{error}</Alert>}
      <ul className="login-invite-list" data-testid="organization-list">
        {organizations.map((o) => (
          <li key={o.id} className="row row--between">
            <span>
              <b>{o.name}</b> <span className="muted">{ROLE_WORD[o.role] ?? o.role}</span>
            </span>
            {o.current ? (
              <Badge tone="ok">вы сейчас здесь</Badge>
            ) : (
              <form method="post" action="/auth/organization">
                <input type="hidden" name="organizationId" value={o.id} />
                <Button type="submit" tone="secondary" size="sm">
                  Перейти<span className="sr-only"> в «{o.name}»</span>
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
