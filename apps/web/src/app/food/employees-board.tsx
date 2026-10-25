'use client';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Badge, Button, Field, Input, Select } from '../../components/ui';
import { StaffBoard, type StaffColumn } from '../../components/staff-board';
import { PERSONNEL_KINDS, PERSONNEL_KIND_LABELS, personnelTabs, type PersonnelKind } from '@pms/domain';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { periodTitle, revenueCells, unattributedLabel, type StaffRevenue } from '../../lib/staff-revenue';
import type { FoodEmployee } from '../../lib/food-types';
import { assignFoodPersonnelKind, mutateStaff } from './restaurant-actions';
import { inviteNewStaffAction } from '../login/actions';
import { StaffAccessPicker, staffAccessDraft, type StaffAccessDraft } from '../../components/staff-access-picker';
import type { AccessLevel } from '@pms/domain';
import { formatPhone, formatPhoneInput } from '../../lib/phone';

/**
 * Назначение строки (DATA_MODEL.md, решения 18.10 и 20.10.2026): руководитель выбирает «специалист», «другой
 * сотрудник» или «оба», остальные видят только метку. Право считает сервер, PATCH проверяет его ещё раз.
 */
function KindCell({ scopeKey, employee, canAssign }: { scopeKey: string; employee: FoodEmployee; canAssign: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const kind = employee.personnelKind ?? null;
  if (!canAssign) return <Badge>{kind ? t(PERSONNEL_KIND_LABELS[kind]) : t('Не назначено')}</Badge>;
  return (
    <>
      <Select
        className="rest-staff-kind"
        aria-label={t('Назначение: {name}', { name: employee.name })}
        value={kind ?? ''}
        disabled={pending}
        aria-busy={pending || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setError('');
          start(async () => {
            const result = await assignFoodPersonnelKind(scopeKey, employee.id, next, employee.profileRevision);
            if (result.error) setError(result.error);
            router.refresh();
          });
        }}
      >
        {kind === null && (
          <option value="" disabled>
            {t('Не назначено')}
          </option>
        )}
        {PERSONNEL_KINDS.map((value) => (
          <option key={value} value={value}>
            {t(PERSONNEL_KIND_LABELS[value])}
          </option>
        ))}
      </Select>
      {error && <Alert>{error}</Alert>}
    </>
  );
}

export interface StaffAccessOptions {
  /** уровни, которые может выдать вошедший; пусто: блока «Доступ в WETOP» нет */
  levels: AccessLevel[];
  canAllBranches: boolean;
  branchName: string | null;
  vertical: string;
}

function EmployeeDrawer({
  scopeKey,
  employee,
  close,
  access,
}: {
  scopeKey: string;
  employee: FoodEmployee | null;
  close: () => void;
  access?: StaffAccessOptions | undefined;
}) {
  const t = useT();
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(formatPhone(employee?.phone));
  const [email, setEmail] = useState(employee?.email ?? '');
  const [status, setStatus] = useState(employee?.status ?? 'ACTIVE');
  // назначение нового сотрудника выбирает руководитель; по умолчанию «Другой сотрудник»: у ресторана это чаще
  const [personnelKind, setPersonnelKind] = useState<PersonnelKind>('OTHER_EMPLOYEE');
  // доступ по умолчанию от назначения (решение 20.10.2026): специалист в кабинет, другой сотрудник без входа
  const [accessDraft, setAccessDraft] = useState<StaffAccessDraft>(() => staffAccessDraft('OTHER_EMPLOYEE', ''));
  const [accessTouched, setAccessTouched] = useState(false);
  const showAccess = !employee && !!access && access.levels.length > 0;
  const [expectedProfileRevision] = useState(employee?.profileRevision ?? '');
  function submit() {
    setError('');
    if (!name.trim()) {
      setError(t('Имя обязательно'));
      return;
    }
    if (showAccess && accessDraft.level !== 'NONE' && !email.trim()) {
      setError(t('Для входа в WETOP укажите почту: на неё придёт приглашение.'));
      return;
    }
    start(async () => {
      const body = {
        name: name.trim(),
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim() ? email.trim() : null,
      };
      const result = await mutateStaff(
        scopeKey,
        employee
          ? { kind: 'edit', id: employee.id, body: { ...body, status, expectedProfileRevision } }
          : { kind: 'create', body: { ...body, personnelKind } },
      );
      if (result.error) setError(result.error);
      else if (showAccess && result.createdId && accessDraft.level !== 'NONE') {
        const invited = await inviteNewStaffAction({
          employeeId: result.createdId,
          level: accessDraft.level,
          email: email.trim(),
          allBranches: accessDraft.allBranches,
        });
        router.refresh();
        // сотрудник уже создан: ошибку приглашения показываем, а не прячем, повторить можно в «Сотрудники и доступ»
        if (invited.error) setError(t('Сотрудник добавлен, но приглашение не отправлено: {error}', { error: invited.error }));
        else close();
      } else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay
      open
      onClose={close}
      title={employee ? t('Изменить сотрудника') : t('Новый сотрудник')}
      drawer
      className="food-drawer"
      trapFocus
    >
      <div className="food-form" data-testid="employee-drawer">
        {error && <Alert>{error}</Alert>}
        {employee && <input type="hidden" name="expectedProfileRevision" value={expectedProfileRevision} />}
        {error && employee && <><p>{t('Ввод сохранён. Сравните актуальный профиль перед повтором.')}</p><Button tone="secondary" onClick={async () => {
          if (!(await ask({
            title: t('Отменить черновик профиля?'),
            body: t('Несохранённые изменения будут потеряны. Вместо них загрузится актуальный профиль сотрудника.'),
            confirmLabel: t('Отменить черновик и загрузить профиль'),
            cancelLabel: t('Оставить черновик'),
          }))) return;
          window.location.reload();
        }}>{t('Отменить черновик и загрузить профиль')}</Button></>}
        <Field label={t('Имя и фамилия')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="food-form-row">
          <Field label={t('Телефон')}>
            <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />
          </Field>
          <Field label={t('Почта')}>
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (!accessTouched) setAccessDraft(staffAccessDraft(personnelKind, e.target.value));
              }}
            />
          </Field>
        </div>
        {!employee && (
          <Field label={t('Кто это')}>
            <Select
              value={personnelKind}
              onChange={(e) => {
                const next = e.target.value as PersonnelKind;
                setPersonnelKind(next);
                if (!accessTouched) setAccessDraft(staffAccessDraft(next, email));
              }}
            >
              {PERSONNEL_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(PERSONNEL_KIND_LABELS[value])}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {showAccess && access && (
          <StaffAccessPicker
            vertical={access.vertical}
            levels={access.levels}
            value={accessDraft}
            onChange={(next) => {
              setAccessTouched(true);
              setAccessDraft(next);
            }}
            branchName={access.branchName}
            canAllBranches={access.canAllBranches}
            email={email}
            disabled={pending}
          />
        )}
        {employee && (
          <Field label={t('Статус')}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">{t('Работает')}</option>
              <option value="ARCHIVED">{t('В архиве')}</option>
            </Select>
          </Field>
        )}
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            {t('Сохранить')}
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
          </Button>
        </div>
      </div>
      {dialog}
    </Overlay>
  );
}

/** «Добавить сотрудника» в шапке страницы, как «Добавить специалиста» салона (эталон владельца 25.10.2026).
 * Окно живёт в списке: кнопка шлёт событие, список его открывает. */
const NEW_EMPLOYEE_EVENT = 'wetop-new-food-employee';
export function NewEmployeeButton() {
  const t = useT();
  return (
    <Button type="button" onClick={() => window.dispatchEvent(new Event(NEW_EMPLOYEE_EVENT))}>
      {t('Добавить сотрудника')}
    </Button>
  );
}

/**
 * «Сотрудники» ресторана: единый экран персонала (вариант A, решение владельца 20.10.2026,
 * docs/decisions/2026-10-20-unified-staff-screen.md). Смены из графика, «Принёс» из оплат, рейтинг из оценок.
 */
export function EmployeesBoard({
  scopeKey,
  write,
  employees,
  branchName,
  canAssignPersonnelKind = false,
  revenue = null,
  revenueNav = null,
  access,
}: {
  scopeKey: string;
  write: boolean;
  employees: FoodEmployee[];
  branchName: string;
  canAssignPersonnelKind?: boolean;
  /** «Сколько принёс» за период (решение 20.10.2026); null = нет права на отчёты, колонки нет */
  revenue?: StaffRevenue | null;
  /** переключатель периода (серверные ссылки) */
  revenueNav?: ReactNode;
  /** «Доступ в WETOP» в форме нового сотрудника (решение 20.10.2026) */
  access?: StaffAccessOptions;
}) {
  const t = useT();
  const locale = useLocale();
  const [draft, setDraft] = useState<FoodEmployee | null | 'new'>(null);
  useEffect(() => {
    if (!write) return;
    const startNew = () => setDraft('new');
    window.addEventListener(NEW_EMPLOYEE_EVENT, startNew);
    return () => window.removeEventListener(NEW_EMPLOYEE_EVENT, startNew);
  }, [write]);
  const earned = revenue ? revenueCells(revenue.items) : null;
  const unattributed = revenue ? unattributedLabel(revenue.items, 'FOOD_SERVICE', t) : null;
  // старые записи без назначения не прячутся и не угадываются: своя вкладка, пока они есть
  const groups = personnelTabs(employees.map((e) => ({ ...e, personnelKind: e.personnelKind ?? null })));
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase();
  const columns: StaffColumn<FoodEmployee>[] = [
    {
      key: 'name',
      label: t('Сотрудник'),
      cell: (e) => (
        <span className="staff-person">
          <span className="staff-person__avatar" aria-hidden="true">
            {initials(e.name)}
          </span>
          <span>
            <strong>{e.name}</strong>
            <span className="staff-person__role">{e.phone ? formatPhone(e.phone) : t('Телефон не указан')}</span>
          </span>
          {e.status === 'ARCHIVED' && <Badge>{t('В архиве')}</Badge>}
        </span>
      ),
    },
    {
      key: 'kind',
      label: t('Назначение'),
      cell: (e) => <KindCell scopeKey={scopeKey} employee={e} canAssign={canAssignPersonnelKind && write} />,
    },
    { key: 'shift', label: t('Смена сегодня'), cell: (e) => e.shift ?? t('Выходной') },
    {
      key: 'status',
      label: t('Статус'),
      cell: (e) => <Badge tone={e.onShift ? 'ok' : 'neutral'}>{e.onShift ? t('На смене') : t('Не на смене')}</Badge>,
    },
    {
      key: 'earned',
      label: revenue ? t('Принёс {period}', { period: t(periodTitle(revenue.period)) }) : '',
      align: 'end',
      hidden: !earned,
      cell: (e) => (earned?.get(e.id) ? <strong data-testid="employee-earned">{earned.get(e.id)}</strong> : null),
    },
    {
      key: 'rating',
      label: t('Рейтинг'),
      align: 'end',
      cell: (e) =>
        e.rating?.average != null ? (
          <span data-testid="employee-rating">
            {`${String(e.rating.average).replace('.', ',')} ★, ${countLabel(locale, t, e.rating.count, [msg('оценка'), 'оценки', msg('оценок')])}`}{/* kk-allow: форма склонения */}
          </span>
        ) : null,
    },
    {
      key: 'actions',
      label: <span className="sr-only">{t('Действия')}</span>,
      align: 'end',
      cell: (e) =>
        write ? (
          <span className="staff-actions rest-staff-actions">
            <a
              className="btn btn--secondary btn--sm"
              href={`/employees/${encodeURIComponent(e.id)}/profile`}
              aria-label={t('Карточка сотрудника: {name}', { name: e.name })}
            >
              {t('Карточка')}
            </a>
            <Button tone="ghost" size="sm" onClick={() => setDraft(e)} aria-label={t('Изменить: {name}', { name: e.name })}>
              {t('Изменить')}
            </Button>
          </span>
        ) : null,
    },
  ];
  return (
    <div className="food-workspace rest-ws" data-testid="employees-board">
      <StaffBoard<FoodEmployee>
        caption={t('Сотрудники ресторана')}
        tabs={[
          { id: 'all', label: t('Все'), rows: employees, empty: t('Сотрудников пока нет') },
          ...groups.map((g) => ({
          id: g.key,
          label: g.key === 'unassigned' ? t('Не назначено') : t(g.label),
          rows: g.items as FoodEmployee[],
          ...(g.key === 'unassigned'
            ? { note: t('Укажите, кто это: специалист, другой сотрудник или оба. Назначение не меняет смены, оплату и права.') }
            : {}),
          empty: employees.length
            ? g.key === 'specialists'
              ? t('Специалистов пока нет.')
              : t('Других сотрудников пока нет.')
            : t('Сотрудников пока нет'),
          })),
        ]}
        columns={columns}
        search={(e) => `${e.name} ${e.phone ?? ''}`}
        searchPlaceholder={t('Поиск сотрудника')}
        period={
          <span className="staff-board__period">
            <span className="muted rest-staff-branch">{t('Филиал: {name}', { name: branchName })}</span>
            {revenue && revenueNav}
          </span>
        }
        footer={unattributed ? <span data-testid="employees-unattributed">{unattributed}</span> : null}
      />
      {draft && (
        <EmployeeDrawer
          scopeKey={scopeKey}
          employee={draft === 'new' ? null : draft}
          access={access}
          close={() => setDraft(null)}
        />
      )}
    </div>
  );
}
