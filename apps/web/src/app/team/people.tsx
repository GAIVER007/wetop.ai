'use client';
import { ActionMenu } from '../../components/action-menu';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AccessLevel, MembershipRole } from '@pms/domain';
import { Alert, Badge, Button, Field, Input } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import type { StaffColumn, StaffTab } from '../../components/staff-board';
import { StaffAccessPicker, type StaffAccessDraft } from '../../components/staff-access-picker';
import type { AuthAccessStructure } from '../../lib/api';
import { inviteNewStaffAction } from '../login/actions';
import { useT } from '../../i18n/locale-provider';
import { useInviteActions, useMemberActions } from './team-board';
import { accessLabel, peopleRows, peopleTabs, type Person, type TeamPeople } from './people-model';

/**
 * Общий экран «Сотрудники» салона и ресторана (plans/unified-team-screen-2026-10-25.md, U2, В1–В7 вариант А).
 * Доска направления отдаёт свои колонки и вкладки карточек; здесь они переносятся на строку человека: у строки без
 * карточки колонки карточки пустые, имя берётся из входа или приглашения. Без `team` (администратор) доска прежняя.
 */
export interface TeamBoardData extends TeamPeople {
  structure: AuthAccessStructure | null;
  actorRole: MembershipRole;
}

type EmployeeLike = { id: string; name: string; email?: string | null };

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export function usePeopleBoard<E extends EmployeeLike>({
  team,
  employees,
  columns,
  tabs,
  search,
  grant,
}: {
  team: TeamBoardData | null | undefined;
  employees: readonly E[];
  columns: StaffColumn<E>[];
  /** вкладки карточек направления, кроме «Все» */
  tabs: Array<StaffTab<E>>;
  search: (row: E) => string;
  /** «Дать доступ» карточке без входа: уровни, которые может выдать вошедший */
  grant: { levels: readonly AccessLevel[]; vertical: string; branchName: string | null; canAllBranches: boolean };
}) {
  const t = useT();
  const member = useMemberActions({ structure: team?.structure ?? null, actorRole: team?.actorRole ?? null });
  const invite = useInviteActions();
  const [granting, setGranting] = useState<E | null>(null);
  if (!team) return null;

  const rows = peopleRows(employees, team);
  const grantLevels = grant.levels.filter((level) => level !== 'NONE');
  const label = (id: string) => tabs.find((tab) => tab.id === id);
  // пустые «С доступом» и «Ждут приглашения» не показываются, как пустое «Не назначено»
  const shown = peopleTabs(rows, tabs, true).filter((tab) => (tab.id !== 'access' && tab.id !== 'invited') || tab.rows.length > 0);
  const shaped = shown.map((tab): StaffTab<Person<E>> => {
    const own = label(tab.id);
    if (own) return { ...own, rows: tab.rows };
    if (tab.id === 'all') return { id: 'all', label: t('Все'), rows: tab.rows, empty: t('Пока никого нет') };
    if (tab.id === 'access') return { id: 'access', label: t('С доступом'), rows: tab.rows, empty: t('Входа в WETOP пока нет ни у кого') };
    return { id: tab.id, label: t('Ждут приглашения'), rows: tab.rows, empty: t('Ожидающих приглашений нет.') };
  });

  const nameOf = (p: Person<E>) => p.member?.name ?? p.member?.email ?? p.invite?.email ?? '';
  const loginName = (p: Person<E>) => (
    <span className="staff-person">
      <span className="staff-person__avatar" aria-hidden="true">
        {initials(nameOf(p))}
      </span>
      <span>
        <strong>{nameOf(p)}</strong>
        {p.member?.you ? t(' — это вы') : ''}
        <span className="staff-person__role">
          {p.member ? (p.member.position ?? (p.member.name ? p.member.email : t('Без карточки сотрудника'))) : t('Приглашён')}
        </span>
      </span>
    </span>
  );
  const accessCell = (p: Person<E>): ReactNode =>
    p.member ? (
      <span className="staff-access-cell">
        {member.roleCell(p.member)}
        {p.member.suspended && (
          <Badge tone="warn" data-testid="member-suspended">
            {t('Приостановлен')}
          </Badge>
        )}
      </span>
    ) : (
      t(accessLabel(p.access))
    );

  const wrapped: StaffColumn<Person<E>>[] = columns.flatMap((col): StaffColumn<Person<E>>[] => {
    if (col.key === 'name') return [{ ...col, cell: (p) => (p.employee ? col.cell(p.employee) : loginName(p)) }];
    if (col.key === 'actions')
      return [
        {
          ...col,
          cell: (p) => {
            // «Открыть» кнопкой, доступ и приглашение пунктами «⋯» (владелец 27.10.2026: без прокрутки вбок)
            const more = [
              ...(p.kind === 'card' && p.employee && grantLevels.length > 0
                ? [{ label: t('Дать доступ'), onSelect: () => setGranting(p.employee!) }]
                : []),
              ...(p.invite ? invite.inviteItems(p.invite) : []),
            ];
            const name = p.employee?.name ?? p.member?.name ?? p.invite?.email ?? '';
            return (
              <span className="staff-actions team-row-actions__group">
                {p.employee && col.cell(p.employee)}
                {p.member && member.actionsCell(p.member, true)}
                {more.length > 0 && <ActionMenu size="sm" label={t('Ещё: {name}', { name })} items={more} />}
              </span>
            );
          },
        },
      ];
    const plain: StaffColumn<Person<E>> = { ...col, cell: (p) => (p.employee ? col.cell(p.employee) : null) };
    if (col.key !== 'kind') return [plain];
    return [plain, { key: 'access', label: t('Доступ в WETOP'), testId: 'person-access', cell: accessCell }];
  });

  const error = member.error || invite.error;
  return {
    columns: wrapped,
    tabs: shaped,
    search: (p: Person<E>) =>
      [p.employee ? search(p.employee) : '', p.member?.name, p.member?.email, p.member?.phone, p.invite?.email]
        .filter(Boolean)
        .join(' '),
    notice: error ? <Alert boxed>{t(error)}</Alert> : null,
    overlays: (
      <>
        {member.overlays}
        <Overlay
          drawer
          open={granting !== null}
          onClose={() => setGranting(null)}
          title={granting ? t('Доступ в WETOP: {name}', { name: granting.name }) : ''}
        >
          {granting && (
            <GrantAccessForm
              key={granting.id}
              employee={granting}
              levels={grantLevels}
              grant={grant}
              onDone={() => setGranting(null)}
            />
          )}
        </Overlay>
      </>
    ),
  };
}

/** Приглашение для уже заведённой карточки: после принятия вход привяжется к ней сам (решение 20.10.2026) */
function GrantAccessForm({
  employee,
  levels,
  grant,
  onDone,
}: {
  employee: EmployeeLike;
  levels: readonly AccessLevel[];
  grant: { vertical: string; branchName: string | null; canAllBranches: boolean };
  onDone: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState(employee.email ?? '');
  const [draft, setDraft] = useState<StaffAccessDraft>({ level: levels[0]!, allBranches: false });
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="team-invite-form"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError('');
          const result = await inviteNewStaffAction({
            employeeId: employee.id,
            level: draft.level,
            email,
            allBranches: draft.allBranches,
          });
          if (result.error) {
            setError(result.error);
            return;
          }
          router.refresh();
          onDone();
        });
      }}
    >
      <Field label={t('Почта')}>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      <StaffAccessPicker
        vertical={grant.vertical}
        levels={levels}
        value={draft}
        onChange={setDraft}
        branchName={grant.branchName}
        canAllBranches={grant.canAllBranches}
        email={email}
        disabled={pending}
      />
      {error && <Alert>{t(error)}</Alert>}
      <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
        {pending ? t('Отправляем…') : t('Отправить приглашение')}
      </Button>
    </form>
  );
}
