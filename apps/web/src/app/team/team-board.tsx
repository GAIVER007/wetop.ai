'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  MEMBERSHIP_ROLES,
  accessLevelsFor,
  invitableRoles,
  type AccessLevel,
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
} from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { StaffBoard } from '../../components/staff-board';
import { StaffAccessPicker } from '../../components/staff-access-picker';
import { ActionMenu } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { useConfirm } from '../../components/use-confirm';
import type { AuthAccessStructure, AuthInvite, AuthMember } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { periodTitle, revenueCells, unattributedLabel, type StaffRevenue } from '../../lib/staff-revenue';
import { ScopeEditor } from './scope-editor';
import {
  fromScopes,
  hasChoice,
  scopeSelectionValid,
  scopeSummary,
  toScopes,
  type ScopeModel,
} from './scope-model';
import { createHotelEmployeeAction } from '../hotel-staff/actions';
import {
  inviteAction,
  inviteNewStaffAction,
  removeMemberAction,
  resendInviteAction,
  revokeInviteAction,
  setMemberDetailsAction,
  setMemberRoleAction,
  setMemberScopesAction,
  setMemberSuspendedAction,
  type TeamActionResult,
} from '../login/actions';
import { formatPhone, formatPhoneInput } from '../../lib/phone';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * «Сотрудники» (TEAM1, план `plans/settings-hub-2026-10-02.md`): команда — видимый раздел, а не секция
 * профиля. Логика прежняя (ADR-107): зовут и отключают владелец и управляющий, роль меняет владелец;
 * что можно с каждой строкой, решает API — компонент несёт его ответ. Приглашение — панелью из шапки.
 */
const TeamContext = createContext<{
  openInvite: () => void;
  ready: boolean;
  expectedOrganizationId: string | null;
} | null>(null);

export function TeamProvider({
  role,
  structure = null,
  expectedOrganizationId,
  children,
  vertical = 'HOSPITALITY',
}: {
  role: MembershipRole | null;
  structure?: AuthAccessStructure | null;
  expectedOrganizationId: string | null;
  children: ReactNode;
  /** направление филиала: слова «Увидит» в блоке доступа */
  vertical?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [scopeSwitching, setScopeSwitching] = useState(false);
  useEffect(() => {
    const switching = () => {
      setScopeSwitching(true);
      setOpen(false);
    };
    const failed = () => setScopeSwitching(false);
    window.addEventListener('wetop-scope-switch', switching);
    window.addEventListener('wetop-scope-switch-failed', failed);
    return () => {
      window.removeEventListener('wetop-scope-switch', switching);
      window.removeEventListener('wetop-scope-switch-failed', failed);
    };
  }, []);
  useEffect(() => setScopeSwitching(false), [expectedOrganizationId, structure]);
  const ready = expectedOrganizationId !== null && structure !== null && !scopeSwitching;
  return (
    <TeamContext.Provider
      value={{
        openInvite: () => {
          if (ready) setOpen(true);
        },
        ready,
        expectedOrganizationId,
      }}
    >
      {children}
      {role && (
        <Overlay open={open} onClose={() => setOpen(false)} title={t('Пригласить сотрудника')} size="lg">
          <InviteForm role={role} structure={structure} onDone={() => setOpen(false)} vertical={vertical} />
        </Overlay>
      )}
    </TeamContext.Provider>
  );
}

export function InviteButton() {
  const ctx = useContext(TeamContext);
  const t = useT();
  return (
    <Button
      type="button"
      data-testid="team-invite"
      disabled={!ctx?.ready}
      onClick={() => ctx?.openInvite()}
    >
      <Icon name="plus" />
      {t('Пригласить сотрудника')}
    </Button>
  );
}

function InviteForm({
  role,
  structure,
  onDone,
  vertical = 'HOSPITALITY',
}: {
  role: MembershipRole;
  structure: AuthAccessStructure | null;
  onDone: () => void;
  vertical?: string;
}) {
  const team = useContext(TeamContext);
  const t = useT();
  // «Личный кабинет» привязан к карточке сотрудника: у салона и ресторана он выдаётся из формы «Новый сотрудник».
  // У гостиницы своей формы сотрудника нет, поэтому здесь все четыре уровня (кабинет горничной, решение 22.10.2026):
  // «Без входа» и «Личный кабинет» сначала создают сотрудника гостиницы, приглашение уходит с его карточкой.
  const hotel = vertical === 'HOSPITALITY';
  const roles = invitableRoles(role).filter((r) => r !== 'EMPLOYEE');
  const levels: AccessLevel[] = hotel
    ? accessLevelsFor(role)
    : roles.filter((r): r is 'MANAGER' | 'STAFF' => r === 'MANAGER' || r === 'STAFF');
  const [level, setLevel] = useState<AccessLevel>('STAFF');
  const personal = level === 'NONE' || level === 'PORTAL';
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
        if (!structure || pending || !team?.ready) {
          setError(msg('Сначала загрузите структуру доступа.'));
          return;
        }
        start(async () => {
          setError('');
          if (personal) {
            const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
            if (!name) {
              setError(msg('Укажите имя сотрудника.'));
              return;
            }
            if (level === 'PORTAL' && !email.trim()) {
              setError(msg('Для входа в WETOP укажите почту: на неё придёт приглашение.'));
              return;
            }
            const created = await createHotelEmployeeAction({
              name,
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(email.trim() ? { email: email.trim() } : {}),
            });
            if (created.error || !created.id) {
              setError(created.error ?? msg('Не удалось добавить сотрудника.'));
              return;
            }
            if (level === 'PORTAL') {
              const invited = await inviteNewStaffAction({ employeeId: created.id, level, email: email.trim(), allBranches: false });
              if (invited.error) {
                setError(t('Сотрудник добавлен, но приглашение не ушло: {error}', { error: t(invited.error) }));
                return;
              }
            }
            setEmail('');
            setFirstName('');
            setLastName('');
            setPhone('');
            onDone();
            return;
          }
          if (restricted && !scopeSelectionValid(structure, model)) {
            setError(msg('Структура доступа изменилась. Проверьте выбранные филиалы.'));
            return;
          }
          // область: выбранные места с одной должностью; «вся организация» — без назначений (DATA_MODEL §31.1)
          const scopes =
            structure && restricted
              ? toScopes(structure, model).map((s) => ({ ...s, role: inviteRole }))
              : [];
          if (restricted && scopes.length === 0) {
            setError(msg('Отметьте хотя бы один филиал или выберите «Вся организация».'));
            return;
          }
          const result = await inviteAction(
            email,
            inviteRole,
            {
              ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
              ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(scopes.length > 0 ? { scopes } : {}),
            },
            team?.expectedOrganizationId ?? null,
          );
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
        {t('Ссылка-приглашение действует 7 дней. Должность определяет, что человек видит и может на стойке.')}
      </p>
      <Field label={t('Имя')}>
        <Input
          name="inviteFirstName"
          autoComplete="off"
          maxLength={100}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </Field>
      <Field label={t('Фамилия')}>
        <Input
          name="inviteLastName"
          autoComplete="off"
          maxLength={100}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </Field>
      <Field label={t('Почта приглашённого')}>
        <Input
          type="email"
          name="inviteEmail"
          autoComplete="off"
          placeholder="name@company.kz"
          required={level !== 'NONE'}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      {/* единый блок доступа во всех направлениях (решение владельца 20.10.2026): уровни, «Увидит / Не увидит» */}
      <StaffAccessPicker
        vertical={vertical}
        levels={levels}
        value={{ level, allBranches: !restricted }}
        onChange={(next) => {
          setLevel(next.level);
          if (next.level === 'MANAGER' || next.level === 'STAFF') setInviteRole(next.level);
        }}
        branchName={null}
        canAllBranches
        email={email}
        showWhere={false}
        name="inviteRole"
      />
      {roles.length <= 1 && (
        <p className="muted" data-testid="invite-role-fixed">
          {t('Управляющий приглашает администраторов; управляющих приглашает владелец.')}
        </p>
      )}
      <Field label={t('Телефон (необязательно)')}>
        <Input
          type="tel"
          name="invitePhone"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
        />
      </Field>
      {structure && !personal && (
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
      {!structure && <Alert>{t('Сначала загрузите структуру доступа.')}</Alert>}
      {error && <Alert>{t(error)}</Alert>}
      <div className="team-invite-form__actions">
        <Button type="submit" disabled={pending || !structure || !team?.ready}>
          {pending ? t('Отправляю…') : level === 'NONE' ? t('Добавить сотрудника') : t('Отправить приглашение')}
        </Button>
        <Button type="button" tone="secondary" onClick={onDone}>
          {t('Отмена')}
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
const who = (m: AuthMember) => m.name ?? m.email;
const initialsOf = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export function MembersTable({
  members,
  structure = null,
  actorRole = null,
  revenue = null,
  revenueNav = null,
}: {
  members: AuthMember[];
  structure?: AuthAccessStructure | null;
  actorRole?: MembershipRole | null;
  /** «Сколько принёс» гостиницы по создавшему бронь (решение 20.10.2026); null = колонки нет */
  revenue?: StaffRevenue | null;
  revenueNav?: ReactNode;
}) {
  const t = useT();
  const earned = revenue ? revenueCells(revenue.items) : null;
  const unattributed = revenue ? unattributedLabel(revenue.items, 'HOSPITALITY', t) : null;
  const team = useContext(TeamContext);
  const { error, pending, run } = useTeamActions();
  const { ask, dialog } = useConfirm();
  const [scoping, setScoping] = useState<AuthMember | null>(null);
  const withScope = hasChoice(structure);
  const [editing, setEditing] = useState<AuthMember | null>(null);
  const rows = members.map((m) => ({ ...m, id: m.userId }));
  return (
    <section className="settings-catalog" aria-label={t('Люди организации')}>
      <StaffBoard<AuthMember & { id: string }>
        caption={t('Сотрудники организации')}
        tableTestId="team-table"
        rowTestId="member-row"
        notice={error ? <Alert boxed>{t(error)}</Alert> : null}
        tabs={[{ id: 'all', label: t('Все'), rows, empty: t('В организации пока никого нет') }]}
        search={(m) => `${m.name ?? ''} ${m.email} ${m.phone ?? ''}`}
        // короткая подсказка: длинная обрезалась в поле («…телеф», аудит 21.10.2026, п. 22)
        searchPlaceholder={t('Имя, почта, телефон')}
        period={revenue ? revenueNav : null}
        footer={unattributed ? <span data-testid="team-unattributed">{unattributed}</span> : null}
        columns={[
          {
            key: 'name',
            label: t('Сотрудник'),
            cell: (m) => (
              <span className="staff-person">
                <span className="staff-person__avatar" aria-hidden="true">
                  {initialsOf(who(m))}
                </span>
                <span>
                  <b>{who(m)}</b>
                  {m.you ? t(' — это вы') : ''}
                  {m.suspended ? (
                    <>
                      {' '}
                      <Badge tone="warn" data-testid="member-suspended">
                        {t('Приостановлен')}
                      </Badge>
                    </>
                  ) : null}
                  <span className="staff-person__role team-member-sub">
                    {m.position ?? (m.name ? m.email : t(roleLabel(m.role)))}
                    {/* на телефоне колонки телефона, роли и дат скрыты: они строками под именем */}
                    {m.phone ? <span className="team-sub-role">{formatPhone(m.phone)}</span> : null}
                    <span className="team-sub-role">{t(roleLabel(m.role))}</span>
                    <span className="team-sub-role">
                      {m.lastLoginAt ? t('был в системе {date}', { date: displayDate(m.lastLoginAt.slice(0, 10)) }) : t('ещё не входил')}
                    </span>
                  </span>
                </span>
              </span>
            ),
          },
          {
            key: 'phone',
            label: t('Телефон'),
            className: 'settings-col-wide',
            cell: (m) => (m.phone ? <a href={`tel:${m.phone}`}>{formatPhone(m.phone)}</a> : <span className="muted">{t('не указан')}</span>),
          },
          {
            key: 'role',
            label: t('Должность'),
            className: 'settings-col-wide',
            cell: (m) =>
              m.roleEditable ? (
                <Select
                  aria-label={t('Должность: {name}', { name: who(m) })}
                  value={m.role}
                  disabled={pending}
                  onChange={(event) => run(() => setMemberRoleAction(m.userId, event.target.value))}
                >
                  <option value="MANAGER">{t(capital(MEMBERSHIP_ROLES.MANAGER))}</option>
                  <option value="STAFF">{t(capital(MEMBERSHIP_ROLES.STAFF))}</option>
                  <option value="EMPLOYEE">{t(capital(MEMBERSHIP_ROLES.EMPLOYEE))}</option>
                </Select>
              ) : (
                t(roleLabel(m.role))
              ),
          },
          {
            key: 'scope',
            label: t('Доступ'),
            className: 'settings-col-wide',
            testId: 'member-scope',
            hidden: !withScope,
            cell: (m) => scopeSummary(m.scopes, structure, t),
          },
          {
            key: 'joined',
            label: t('В организации с'),
            className: 'settings-col-wide',
            cell: (m) => displayDate(m.joinedAt.slice(0, 10)),
          },
          {
            key: 'login',
            label: t('Был в системе'),
            className: 'settings-col-wide',
            cell: (m) => (m.lastLoginAt ? displayDate(m.lastLoginAt.slice(0, 10)) : t('ещё не входил')),
          },
          {
            key: 'earned',
            label: revenue ? t('Принёс {period}', { period: t(periodTitle(revenue.period)) }) : '',
            align: 'end',
            testId: 'member-earned',
            hidden: !earned,
            cell: (m) => earned?.get(m.userId) ?? null,
          },
          {
            key: 'actions',
            label: <span className="sr-only">{t('Действия')}</span>,
            align: 'end',
            className: 'team-row-actions',
            cell: (m) => (
              <span className="staff-actions team-row-actions__group">
                {m.detailsEditable && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => setEditing(m)}
                  >
                    {t('Изменить')}
                  </Button>
                )}
                {withScope && m.scopesEditable && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending || !team?.ready}
                    onClick={() => {
                      if (team?.ready) setScoping(m);
                    }}
                  >
                    {t('Доступ')}
                  </Button>
                )}
                {(m.suspendable || m.removable) && (
                  <ActionMenu
                    size="sm"
                    label={t('Ещё: {name}', { name: who(m) })}
                    items={[
                      ...(m.suspendable
                        ? [
                            {
                              label: m.suspended ? t('Возобновить') : t('Приостановить'),
                              disabled: pending,
                              onSelect: async () => {
                                if (m.suspended) return run(() => setMemberSuspendedAction(m.userId, false));
                                const ok = await ask({
                                  title: t('Приостановить доступ: {name}?', { name: who(m) }),
                                  body: t('Человек останется в команде, но не сможет войти: его сеансы погаснут сразу. Вернуть доступ можно одним действием.'),
                                  confirmLabel: t('Приостановить'),
                                });
                                if (ok) run(() => setMemberSuspendedAction(m.userId, true));
                              },
                            },
                          ]
                        : []),
                      ...(m.removable
                        ? [
                            {
                              label: t('Отключить'),
                              tone: 'danger' as const,
                              disabled: pending,
                              onSelect: async () => {
                                const ok = await ask({
                                  title: t('Отключить: {name}?', { name: who(m) }),
                                  body: t('Человек сразу потеряет доступ к организации: его сеансы погаснут на следующем действии. Позвать снова можно приглашением.'),
                                  confirmLabel: t('Отключить'),
                                });
                                if (ok) run(() => removeMemberAction(m.userId));
                              },
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </span>
            ),
          },
        ]}
      />
      {dialog}
      <Overlay
        drawer
        open={scoping !== null}
        onClose={() => setScoping(null)}
        title={scoping ? t('Доступ: {name}', { name: who(scoping) }) : ''}
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
  const team = useContext(TeamContext);
  const t = useT();
  const [restricted, setRestricted] = useState(member.scopes.length > 0);
  const [model, setModel] = useState<ScopeModel>(fromScopes(member.scopes));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="team-invite-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!team?.ready) {
          setError(msg('Структура доступа изменилась. Обновите страницу и повторите.'));
          return;
        }
        if (restricted && !scopeSelectionValid(structure, model)) {
          setError(msg('Структура доступа изменилась. Проверьте выбранные филиалы.'));
          return;
        }
        const scopes = restricted ? toScopes(structure, model) : [];
        if (restricted && scopes.length === 0) {
          setError(msg('Выберите хотя бы одно место или «Вся организация».'));
          return;
        }
        start(async () => {
          setError('');
          const result = await setMemberScopesAction(
            member.userId,
            scopes,
            team.expectedOrganizationId,
          );
          if (result.error) setError(result.error);
          else onDone();
        });
      }}
    >
      <p className="muted">
        {t('Права даёт должность в каждом месте. Сотрудник видит и меняет данные только там, где ему назначен доступ.')}
      </p>
      <ScopeEditor
        structure={structure}
        roles={roles}
        restricted={restricted}
        onRestricted={setRestricted}
        model={model}
        onModel={setModel}
      />
      {error && <Alert>{t(error)}</Alert>}
      <div className="team-invite-form__actions">
        <Button type="submit" disabled={pending || !team?.ready}>
          {pending ? t('Сохраняю…') : t('Сохранить')}
        </Button>
        <Button type="button" tone="secondary" onClick={onDone}>
          {t('Отмена')}
        </Button>
      </div>
    </form>
  );
}

/** Телефон и должность (TEAM2, Q-244): пустое поле стирает значение; отказ API: словами, ввод остаётся */
function DetailsForm({ member, onDone }: { member: AuthMember; onDone: () => void }) {
  const t = useT();
  const [phone, setPhone] = useState(formatPhone(member.phone));
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
        {t('Права даёт должность из списка (управляющий или администратор), подпись их не меняет.')}
      </p>
      <Field label={t('Телефон')}>
        <Input
          type="tel"
          name="memberPhone"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
        />
      </Field>
      <Field label={t('Подпись под именем (необязательно)')}>
        <Input
          name="memberPosition"
          autoComplete="off"
          maxLength={100}
          placeholder={t('Старший администратор')}
          value={position}
          onChange={(event) => setPosition(event.target.value)}
        />
      </Field>
      {error && <Alert>{t(error)}</Alert>}
      <div className="team-invite-form__actions">
        <Button type="submit" disabled={pending}>
          {pending ? t('Сохраняю…') : t('Сохранить')}
        </Button>
        <Button type="button" tone="secondary" onClick={onDone}>
          {t('Отмена')}
        </Button>
      </div>
    </form>
  );
}

export function PendingInvites({ invites }: { invites: AuthInvite[] }) {
  const t = useT();
  const { error, pending, run } = useTeamActions();
  return (
    <section className="team-invites" aria-labelledby="team-invites-heading">
      <h2 id="team-invites-heading">{t('Ожидают ответа')}</h2>
      {error && <Alert>{t(error)}</Alert>}
      {invites.length > 0 ? (
        <ul className="login-invite-list" data-testid="invite-list" aria-label={t('Приглашения')}>
          {invites.map((i) => (
            <li key={i.id} className="login-team-row">
              <span className="login-team-row__who">
                <b>{i.email}</b>{' '}
                <span className="muted">
                  {t('{role}, ждёт ответа до', { role: t(roleLabel(i.role ?? 'STAFF')) })}{' '}
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
                    {t('Отправить заново')}
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => revokeInviteAction(i.id))}
                  >
                    {t('Отозвать')}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" data-testid="invite-empty">
          {t('Ожидающих приглашений нет.')}
        </p>
      )}
    </section>
  );
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
/** Роль с заглавной, как «Владелец» в шапке (аудит 21.10.2026, п. 23) */
export const roleLabel = (role: MembershipRole): string => capital(MEMBERSHIP_ROLES[role]);
