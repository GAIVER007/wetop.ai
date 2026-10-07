'use client';
import '../hotel-settings/settings.css';
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  MEMBERSHIP_ROLES,
  invitableRoles,
  type InviteRole,
  type MembershipRole,
} from '@pms/domain';
import { Alert, Button, Field, Input, Select, Table } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { Icon } from '../../components/icon';
import { useConfirm } from '../../components/use-confirm';
import type { AuthInvite, AuthMember } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import {
  inviteAction,
  removeMemberAction,
  revokeInviteAction,
  setMemberDetailsAction,
  setMemberRoleAction,
  type TeamActionResult,
} from '../login/actions';

/**
 * «Сотрудники» (TEAM1, план `plans/settings-hub-2026-10-02.md`): команда — видимый раздел, а не секция
 * профиля. Логика прежняя (ADR-107): зовут и отключают владелец и управляющий, роль меняет владелец;
 * что можно с каждой строкой, решает API — компонент несёт его ответ. Приглашение — панелью из шапки.
 */
const TeamContext = createContext<{ openInvite: () => void } | null>(null);

export function TeamProvider({
  role,
  children,
}: {
  role: MembershipRole | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TeamContext.Provider value={{ openInvite: () => setOpen(true) }}>
      {children}
      {role && (
        <Overlay drawer open={open} onClose={() => setOpen(false)} title="Пригласить сотрудника">
          <InviteForm role={role} onDone={() => setOpen(false)} />
        </Overlay>
      )}
    </TeamContext.Provider>
  );
}

export function InviteButton() {
  const ctx = useContext(TeamContext);
  return (
    <Button type="button" data-testid="team-invite" onClick={() => ctx?.openInvite()}>
      <Icon name="plus" />
      Пригласить сотрудника
    </Button>
  );
}

function InviteForm({ role, onDone }: { role: MembershipRole; onDone: () => void }) {
  const roles = invitableRoles(role);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('STAFF');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="team-invite-form"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError('');
          const result = await inviteAction(email, inviteRole);
          if (result.error) setError(result.error);
          else {
            setEmail('');
            onDone();
          }
        });
      }}
    >
      <p className="muted">
        Ссылка-приглашение действует 7 дней. Роль определяет, что человек видит и может на стойке.
      </p>
      <Field label="Почта приглашённого">
        <Input
          type="email"
          name="inviteEmail"
          autoComplete="off"
          placeholder="admin@hotel.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      {roles.length > 1 ? (
        <Field label="Роль приглашённого">
          <Select
            name="inviteRole"
            // подпись вокруг списка добавила бы к имени выбранную роль: имя задаём явно (как в срезе 13)
            aria-label="Роль приглашённого"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as InviteRole)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {capital(MEMBERSHIP_ROLES[r])}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="muted" data-testid="invite-role-fixed">
          Управляющий приглашает администраторов; управляющих приглашает владелец.
        </p>
      )}
      {error && <Alert>{error}</Alert>}
      <div className="team-invite-form__actions">
        <Button type="submit" disabled={pending}>
          {pending ? 'Отправляю…' : 'Отправить приглашение'}
        </Button>
        <Button type="button" tone="secondary" onClick={onDone}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

/** Строка действия: сессия кончилась или API отказал — словами над таблицей, ввод не теряется */
function useTeamActions() {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (action: () => Promise<TeamActionResult>) =>
    start(async () => {
      setError('');
      const result = await action();
      if (result.error) setError(result.error);
    });
  return { error, pending, run };
}

const who = (m: AuthMember) => m.name ?? m.email;

export function MembersTable({ members }: { members: AuthMember[] }) {
  const { error, pending, run } = useTeamActions();
  const { ask, dialog } = useConfirm();
  const [editing, setEditing] = useState<AuthMember | null>(null);
  return (
    <section className="settings-catalog" aria-label="Люди организации">
      {error && <Alert boxed>{error}</Alert>}
      <Table data-testid="team-table" className="settings-table settings-table--team">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th className="settings-col-wide">Телефон</th>
            <th className="settings-col-wide">Роль</th>
            <th className="settings-col-wide">В организации с</th>
            <th className="settings-col-wide">Был в системе</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} data-testid="member-row">
              <td>
                <b>{who(m)}</b>
                {m.you ? ' — это вы' : ''}
                {m.position ? <span className="cell-sub">{m.position}</span> : null}
                <span className="cell-sub team-member-sub">
                  {m.name ? <span>{m.email}</span> : null}
                  {/* на телефоне колонки телефона, роли и дат скрыты: они строками под именем */}
                  {m.phone ? <span className="team-sub-role">{m.phone}</span> : null}
                  <span className="team-sub-role">{MEMBERSHIP_ROLES[m.role]}</span>
                  <span className="team-sub-role">
                    {m.lastLoginAt
                      ? `был в системе ${displayDate(m.lastLoginAt.slice(0, 10))}`
                      : 'ещё не входил'}
                  </span>
                </span>
              </td>
              <td className="settings-col-wide">
                {m.phone ? <a href={`tel:${m.phone}`}>{m.phone}</a> : <span className="muted">не указан</span>}
              </td>
              <td className="settings-col-wide">
                {m.roleEditable ? (
                  <Select
                    aria-label={`Роль: ${who(m)}`}
                    value={m.role}
                    disabled={pending}
                    onChange={(event) => run(() => setMemberRoleAction(m.userId, event.target.value))}
                  >
                    <option value="MANAGER">{capital(MEMBERSHIP_ROLES.MANAGER)}</option>
                    <option value="STAFF">{capital(MEMBERSHIP_ROLES.STAFF)}</option>
                  </Select>
                ) : (
                  MEMBERSHIP_ROLES[m.role]
                )}
              </td>
              <td className="settings-col-wide">{displayDate(m.joinedAt.slice(0, 10))}</td>
              <td className="settings-col-wide">
                {m.lastLoginAt ? displayDate(m.lastLoginAt.slice(0, 10)) : 'ещё не входил'}
              </td>
              <td className="team-row-actions">
                {m.detailsEditable && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => setEditing(m)}
                  >
                    Изменить
                  </Button>
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
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {dialog}
      <Overlay
        drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? who(editing) : ''}
      >
        {editing && (
          <DetailsForm key={editing.userId} member={editing} onDone={() => setEditing(null)} />
        )}
      </Overlay>
    </section>
  );
}

/** Телефон и должность (TEAM2, Q-244): пустое поле стирает значение; отказ API: словами, ввод остаётся */
function DetailsForm({ member, onDone }: { member: AuthMember; onDone: () => void }) {
  const [phone, setPhone] = useState(member.phone ?? '');
  const [position, setPosition] = useState(member.position ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="team-invite-form"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError('');
          const result = await setMemberDetailsAction(member.userId, phone, position);
          if (result.error) setError(result.error);
          else onDone();
        });
      }}
    >
      <p className="muted">Права даёт роль, должность их не меняет.</p>
      <Field label="Телефон">
        <Input
          type="tel"
          name="memberPhone"
          inputMode="tel"
          autoComplete="off"
          placeholder="8 701 000 00 00"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      <Field label="Должность">
        <Input
          name="memberPosition"
          autoComplete="off"
          maxLength={100}
          placeholder="Старший администратор"
          value={position}
          onChange={(event) => setPosition(event.target.value)}
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <div className="team-invite-form__actions">
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
        <Button type="button" tone="secondary" onClick={onDone}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

export function PendingInvites({ invites }: { invites: AuthInvite[] }) {
  const { error, pending, run } = useTeamActions();
  return (
    <section className="team-invites" aria-labelledby="team-invites-heading">
      <h2 id="team-invites-heading">Ожидают ответа</h2>
      {error && <Alert>{error}</Alert>}
      {invites.length > 0 ? (
        <ul className="login-invite-list" data-testid="invite-list" aria-label="Приглашения">
          {invites.map((i) => (
            <li key={i.id} className="login-team-row">
              <span className="login-team-row__who">
                <b>{i.email}</b>{' '}
                <span className="muted">
                  {MEMBERSHIP_ROLES[i.role ?? 'STAFF']}, ждёт ответа до{' '}
                  <time dateTime={i.expiresAt}>{displayDate(i.expiresAt.slice(0, 10))}</time>
                </span>
              </span>
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
    </section>
  );
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
