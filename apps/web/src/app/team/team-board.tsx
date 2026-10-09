'use client';
import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import {
  MEMBERSHIP_ROLES,
  invitableRoles,
  type InviteRole,
  type MembershipRole,
} from '@pms/domain';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Select,
  Stat,
  Stats,
  Table,
} from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { Icon } from '../../components/icon';
import { useConfirm } from '../../components/use-confirm';
import type { AuthAccessStructure, AuthInvite, AuthMember } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { ScopeEditor } from './scope-editor';
import { fromScopes, hasChoice, scopeSummary, toScopes, type ScopeModel } from './scope-model';
import {
  inviteAction,
  removeMemberAction,
  resendInviteAction,
  revokeInviteAction,
  setMemberDetailsAction,
  setMemberRoleAction,
  setMemberScopesAction,
  setMemberSuspendedAction,
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
  structure = null,
  children,
}: {
  role: MembershipRole | null;
  structure?: AuthAccessStructure | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TeamContext.Provider value={{ openInvite: () => setOpen(true) }}>
      {children}
      {role && (
        <Overlay drawer open={open} onClose={() => setOpen(false)} title="Пригласить сотрудника">
          <InviteForm role={role} structure={structure} onDone={() => setOpen(false)} />
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

function InviteForm({
  role,
  structure,
  onDone,
}: {
  role: MembershipRole;
  structure: AuthAccessStructure | null;
  onDone: () => void;
}) {
  const roles = invitableRoles(role);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [model, setModel] = useState<ScopeModel>({});
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
          // область: выбранные места с одной должностью; «вся организация» — без назначений (DATA_MODEL §31.1)
          const scopes =
            structure && restricted
              ? toScopes(structure, model).map((s) => ({ ...s, role: inviteRole }))
              : [];
          if (restricted && scopes.length === 0) {
            setError('Отметьте хотя бы один филиал или выберите «Вся организация».');
            return;
          }
          const result = await inviteAction(email, inviteRole, {
            ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
            ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
            ...(scopes.length > 0 ? { scopes } : {}),
          });
          if (result.error) setError(result.error);
          else {
            setEmail('');
            setFirstName('');
            setLastName('');
            setPhone('');
            setRestricted(false);
            setModel({});
            onDone();
          }
        });
      }}
    >
      <p className="muted">
        Ссылка-приглашение действует 7 дней. Должность определяет, что человек видит и может на
        стойке.
      </p>
      <Field label="Имя">
        <Input
          name="inviteFirstName"
          autoComplete="off"
          maxLength={100}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </Field>
      <Field label="Фамилия">
        <Input
          name="inviteLastName"
          autoComplete="off"
          maxLength={100}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </Field>
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
        <Field label="Должность">
          <Select
            name="inviteRole"
            // подпись вокруг списка добавила бы к имени выбранную должность: имя задаём явно (как в срезе 13)
            aria-label="Должность"
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
          Должность: администратор. Управляющий приглашает администраторов; управляющих приглашает
          владелец.
        </p>
      )}
      <Field label="Телефон (необязательно)">
        <Input
          type="tel"
          name="invitePhone"
          inputMode="tel"
          autoComplete="off"
          placeholder="8 701 000 00 00"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      {structure && hasChoice(structure) && (
        <ScopeEditor
          structure={structure}
          roles={roles}
          restricted={restricted}
          onRestricted={setRestricted}
          model={model}
          onModel={setModel}
          fixedRole={inviteRole}
        />
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

/** Сводка (STAFF2.2): считает только то, что API отдаёт; «доступ приостановлен» не показываем: данных нет */
export function TeamStats({ members, invites }: { members: AuthMember[]; invites: AuthInvite[] }) {
  const suspended = members.filter((m) => m.suspended).length;
  const admins = members.filter((m) => m.role === 'STAFF').length;
  return (
    <Stats min={160} data-testid="team-stats" aria-label="Сводка по команде">
      <Stat label="Сотрудников" value={members.length} testId="team-stat-total" />
      <Stat label="Активных" value={members.length - suspended} testId="team-stat-active" />
      <Stat label="Ожидают ответа" value={invites.length} testId="team-stat-invites" />
      <Stat label="Доступ приостановлен" value={suspended} testId="team-stat-suspended" />
      <Stat label="Администраторов" value={admins} testId="team-stat-admins" />
    </Stats>
  );
}

const who = (m: AuthMember) => m.name ?? m.email;

export function MembersTable({
  members,
  structure = null,
  actorRole = null,
}: {
  members: AuthMember[];
  structure?: AuthAccessStructure | null;
  actorRole?: MembershipRole | null;
}) {
  const { error, pending, run } = useTeamActions();
  const { ask, dialog } = useConfirm();
  const [scoping, setScoping] = useState<AuthMember | null>(null);
  const withScope = hasChoice(structure);
  const [editing, setEditing] = useState<AuthMember | null>(null);
  return (
    <section className="settings-catalog" aria-label="Люди организации">
      {error && <Alert boxed>{error}</Alert>}
      <Table data-testid="team-table" className="settings-table settings-table--team">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th className="settings-col-wide">Телефон</th>
            <th className="settings-col-wide">Должность</th>
            {withScope && <th className="settings-col-wide">Доступ</th>}
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
                {m.suspended ? (
                  <>
                    {' '}
                    <Badge tone="warn" data-testid="member-suspended">
                      Приостановлен
                    </Badge>
                  </>
                ) : null}
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
                {m.phone ? (
                  <a href={`tel:${m.phone}`}>{m.phone}</a>
                ) : (
                  <span className="muted">не указан</span>
                )}
              </td>
              <td className="settings-col-wide">
                {m.roleEditable ? (
                  <Select
                    aria-label={`Должность: ${who(m)}`}
                    value={m.role}
                    disabled={pending}
                    onChange={(event) =>
                      run(() => setMemberRoleAction(m.userId, event.target.value))
                    }
                  >
                    <option value="MANAGER">{capital(MEMBERSHIP_ROLES.MANAGER)}</option>
                    <option value="STAFF">{capital(MEMBERSHIP_ROLES.STAFF)}</option>
                  </Select>
                ) : (
                  MEMBERSHIP_ROLES[m.role]
                )}
              </td>
              {withScope && (
                <td className="settings-col-wide" data-testid="member-scope">
                  {scopeSummary(m.scopes, structure)}
                </td>
              )}
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
                {withScope && m.scopesEditable && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => setScoping(m)}
                  >
                    Доступ
                  </Button>
                )}
                {m.suspendable && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={async () => {
                      if (m.suspended) return run(() => setMemberSuspendedAction(m.userId, false));
                      const ok = await ask({
                        title: `Приостановить доступ: ${who(m)}?`,
                        body: 'Человек останется в команде, но не сможет войти: его сеансы погаснут сразу. Вернуть доступ можно одним действием.',
                        confirmLabel: 'Приостановить',
                      });
                      if (ok) run(() => setMemberSuspendedAction(m.userId, true));
                    }}
                  >
                    {m.suspended ? 'Возобновить' : 'Приостановить'}
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
        open={scoping !== null}
        onClose={() => setScoping(null)}
        title={scoping ? `Доступ: ${who(scoping)}` : ''}
      >
        {scoping && structure && actorRole && (
          <ScopeForm
            key={scoping.userId}
            member={scoping}
            structure={structure}
            roles={invitableRoles(actorRole)}
            onDone={() => setScoping(null)}
          />
        )}
      </Overlay>
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

/** Область доступа сотрудника (DATA_MODEL §31.1): у каждого места своя роль; «Вся организация» снимает ограничение */
function ScopeForm({
  member,
  structure,
  roles,
  onDone,
}: {
  member: AuthMember;
  structure: AuthAccessStructure;
  roles: readonly InviteRole[];
  onDone: () => void;
}) {
  const [restricted, setRestricted] = useState(member.scopes.length > 0);
  const [model, setModel] = useState<ScopeModel>(fromScopes(member.scopes));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="team-invite-form"
      onSubmit={(event) => {
        event.preventDefault();
        const scopes = restricted ? toScopes(structure, model) : [];
        if (restricted && scopes.length === 0) {
          setError('Выберите хотя бы одно место или «Вся организация».');
          return;
        }
        start(async () => {
          setError('');
          const result = await setMemberScopesAction(member.userId, scopes);
          if (result.error) setError(result.error);
          else onDone();
        });
      }}
    >
      <p className="muted">
        Права даёт должность в каждом месте. Сотрудник видит и меняет данные только там, где ему
        назначен доступ.
      </p>
      <ScopeEditor
        structure={structure}
        roles={roles}
        restricted={restricted}
        onRestricted={setRestricted}
        model={model}
        onModel={setModel}
      />
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
      <p className="muted">
        Права даёт должность из списка (управляющий или администратор), подпись их не меняет.
      </p>
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
      <Field label="Подпись под именем (необязательно)">
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
                <span className="team-row-actions">
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        resendInviteAction(i.id, i.email, i.role ?? 'STAFF', {
                          ...(i.firstName ? { firstName: i.firstName } : {}),
                          ...(i.lastName ? { lastName: i.lastName } : {}),
                          ...(i.position ? { position: i.position } : {}),
                          ...(i.scopes && i.scopes.length > 0 ? { scopes: i.scopes } : {}),
                        }),
                      )
                    }
                  >
                    Отправить заново
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => revokeInviteAction(i.id))}
                  >
                    Отозвать
                  </Button>
                </span>
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
