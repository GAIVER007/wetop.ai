'use client';
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EmployeeProfile,
  EmployeeTransitionGuard,
} from '../../../components/employee-workspace/workspace';
import { Overlay } from '../../../components/overlay';
import { StaffBoard, type StaffColumn } from '../../../components/staff-board';
import { Alert, Badge, Button, Select } from '../../../components/ui';
import { PERSONNEL_KINDS, PERSONNEL_KIND_LABELS, personnelTabs } from '@pms/domain';
import { assignBeautyPersonnelKind } from '../actions';
import { periodTitle, revenueCells, staffSummaryStats, unattributedLabel, type StaffRevenue } from '../../../lib/staff-revenue';
import type {
  BeautyEmployeeRow,
  BeautyServiceRow,
  BeautySchedule,
  BeautyDay,
} from '../../../lib/api';
import { clearPendingCreation, pendingCreation } from '../creation-key';
import { beautyMasterDayStatus } from '../../../lib/beauty-master-day-status';

/**
 * Мастера салона (DATA_MODEL §19, срез B3). Мастер это сотрудник сети, не филиала: филиалы ведёт отдельная
 * связь, и новый мастер сразу начинает работать в выбранном филиале, иначе он нигде не работает.
 * Умения приходят одним списком, чтобы снятая галочка снималась, а не копилась.
 */
type Editing = { mode: 'new' } | null;

export const employeeProfileHref = (id: string) => `/employees/${encodeURIComponent(id)}/profile`;

type Kind = NonNullable<BeautyEmployeeRow['personnelKind']>;

/**
 * Назначение строки (DATA_MODEL.md, решения 18.10 и 20.10.2026): руководитель выбирает «специалист», «другой
 * сотрудник» или «оба», остальные видят только метку. Право считает сервер (`canAssignPersonnelKind`), PATCH
 * проверяет его ещё раз. Конфликт версии: сообщение и свежий список с сервера.
 */
function PersonnelKindPicker({ row, canAssign }: { row: BeautyEmployeeRow; canAssign: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const kind = row.personnelKind ?? null;
  if (!canAssign || !row.profileRevision)
    return <Badge>{kind ? PERSONNEL_KIND_LABELS[kind] : 'Не назначено'}</Badge>;
  return (
    <div className="beauty-master-card__kind">
      <Select
        aria-label={`Назначение: ${row.name}`}
        value={kind ?? ''}
        disabled={pending}
        aria-busy={pending || undefined}
        onChange={(event) => {
          const next = event.target.value as Kind;
          setError('');
          start(async () => {
            const result = await assignBeautyPersonnelKind(row.id, next, row.profileRevision!);
            if (result.error) setError(result.error);
            router.refresh();
          });
        }}
      >
        {kind === null && (
          <option value="" disabled>
            Не назначено
          </option>
        )}
        {PERSONNEL_KINDS.map((value) => (
          <option key={value} value={value}>
            {PERSONNEL_KIND_LABELS[value]}
          </option>
        ))}
      </Select>
      {pending && <span className="beauty-note">Сохраняем…</span>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

/** Инициалы для кружка карточки: первые буквы первых двух слов имени */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function MastersBoard({
  items,
  services,
  canEdit,
  canCreate = canEdit ?? false,
  today,
  locations,
  scopeKey = '',
  initialEmployeeId = '',
  businessName,
  locationName,
  unavailable = false,
  scheduleAvailable = true,
  canAssignPersonnelKind = false,
  revenue = null,
  revenueNav = null,
}: {
  items: BeautyEmployeeRow[];
  services: BeautyServiceRow[];
  canEdit?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canManagePrices?: boolean;
  today: BeautyDay;
  locations: BeautySchedule['locations'];
  scopeKey?: string;
  initialEmployeeId?: string;
  businessName?: string;
  locationName?: string;
  unavailable?: boolean;
  scheduleAvailable?: boolean;
  canAssignPersonnelKind?: boolean;
  /** «Сколько принёс» за период (решение 20.10.2026); null = нет права на отчёты, строки нет */
  revenue?: StaffRevenue | null;
  revenueNav?: ReactNode;
}) {
  const earned = revenue ? revenueCells(revenue.items) : null;
  const unattributed = revenue ? unattributedLabel(revenue.items, 'BEAUTY') : null;
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  const guard = useRef<(action: () => void) => void>((action) => action());
  const registerGuard = useCallback((request: (action: () => void) => void) => {
    guard.current = request;
  }, []);
  const requested = useRef(false);
  const initialRequest = useRef(initialEmployeeId);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    const id = initialRequest.current || pendingCreation(scopeKey, 'employee');
    const row = itemsRef.current.find((item) => item.id === id);
    if (row) {
      // A legacy URL or recovered create can open only an authorized row from this scope.
      clearPendingCreation(scopeKey, 'employee', row.id);
      router.replace(employeeProfileHref(row.id), { scroll: false });
    }
    return () => {
      requested.current = false;
    };
  }, [router, scopeKey]);
  const savedProfile = (row: BeautyEmployeeRow) => {
    setEditing(null);
    setNotice('Специалист создан');
    clearPendingCreation(scopeKey, 'employee', row.id);
    router.replace(employeeProfileHref(row.id), { scroll: false });
  };
  const close = () => {
    setEditing(null);
  };
  const names = new Map(services.map((s) => [s.id, s.name]));
  // старые записи без назначения не прячутся и не угадываются: своя вкладка, пока они есть
  const tabs = personnelTabs(
    items.map((row) => ({ ...row, personnelKind: row.personnelKind ?? null })),
  );
  const appointmentsOf = (id: string) =>
    today.appointments.filter((a) => a.employeeId === id && a.status !== 'CANCELLED').length;
  const categoriesOf = (row: BeautyEmployeeRow) =>
    [
      ...new Set(
        row.serviceIds
          .map((id) => services.find((s) => s.id === id)?.category)
          .filter((c): c is string => Boolean(c)),
      ),
    ].join(', ');
  const columns: StaffColumn<BeautyEmployeeRow>[] = [
    {
      key: 'name',
      label: 'Специалист',
      cell: (row) => (
        <span className="staff-person">
          <span className="staff-person__avatar" aria-hidden="true">
            {initials(row.name)}
          </span>
          <span>
            <strong>{row.name}</strong>
            <span className="staff-person__role">
              {categoriesOf(row) ||
                (row.serviceIds.length
                  ? row.serviceIds.map((id) => names.get(id)).filter(Boolean).join(', ')
                  : 'Специализация не указана')}
            </span>
          </span>
          {!row.active && <Badge>В архиве</Badge>}
        </span>
      ),
    },
    { key: 'kind', label: 'Назначение', cell: (row) => <PersonnelKindPicker row={row} canAssign={canAssignPersonnelKind} /> },
    {
      key: 'shift',
      label: 'Смена сегодня',
      cell: (row) => {
        const day = beautyMasterDayStatus(scheduleAvailable ? today : null, row.id);
        if (!row.active || day.state === 'UNAVAILABLE') return null;
        return day.state === 'ON_SHIFT' ? day.hours : 'Выходной';
      },
    },
    {
      key: 'status',
      label: 'Статус',
      cell: (row) => {
        const day = beautyMasterDayStatus(scheduleAvailable ? today : null, row.id);
        if (!row.active) return <Badge>В архиве</Badge>;
        if (day.state === 'UNAVAILABLE') return <Badge>График недоступен</Badge>;
        return day.state === 'ON_SHIFT' ? <Badge tone="ok">На смене</Badge> : <Badge>Не на смене</Badge>;
      },
    },
    {
      key: 'load',
      label: 'Записей сегодня',
      align: 'end',
      cell: (row) => (row.active ? appointmentsOf(row.id) || null : null),
    },
    {
      key: 'earned',
      label: revenue ? `Принёс ${periodTitle(revenue.period)}` : '',
      align: 'end',
      hidden: !earned,
      cell: (row) => (earned?.get(row.id) ? <strong data-testid="employee-earned">{earned.get(row.id)}</strong> : null),
    },
    {
      key: 'locations',
      label: 'Филиалы',
      cell: (row) =>
        locations
          .filter((l) => row.locationIds.includes(l.id))
          .map((l) => l.name)
          .join(', ') || null,
    },
    {
      key: 'actions',
      label: <span className="sr-only">Действия</span>,
      align: 'end',
      cell: (row) => (
        <span className="staff-actions">
          <Link className="btn btn--secondary btn--sm" href={employeeProfileHref(row.id)} aria-label={`Открыть: ${row.name}`}>
            Открыть
          </Link>
        </span>
      ),
    },
  ];
  const unassigned = tabs.find((t) => t.key === 'unassigned')?.items.length ?? 0;
  return (
    <>
      {unavailable && <Alert>Специалист недоступен в текущем контексте.</Alert>}
      {notice && <p role="status">{notice}</p>}
      <StaffBoard<BeautyEmployeeRow>
        caption="Специалисты салона"
        actions={
          canCreate ? (
            <Button
              type="button"
              onClick={() =>
                guard.current(() => {
                  setEditing({ mode: 'new' });
                  setNotice('');
                })
              }
            >
              Добавить специалиста
            </Button>
          ) : null
        }
        stats={staffSummaryStats({
          revenue,
          names: new Map(items.map((row) => [row.id, row.name])),
          earners: items.filter(
            (row) => row.active && (row.personnelKind === 'SPECIALIST' || row.personnelKind === 'BOTH'),
          ).length,
          unassigned,
          people: items.length,
        })}
        tabs={[
          { id: 'all', label: 'Все', rows: items, empty: 'Добавьте первого специалиста' },
          ...tabs.map((tab) => ({
            id: tab.key,
            label: tab.key === 'unassigned' ? 'Не назначено' : tab.label,
            rows: tab.items as BeautyEmployeeRow[],
            ...(tab.key === 'unassigned'
              ? { note: 'Укажите, кто это: специалист, другой сотрудник или оба. Назначение не меняет услуги и права.' }
              : {}),
            empty:
              tab.key === 'specialists'
                ? 'Специалистов пока нет. Назначьте их в строке сотрудника.'
                : 'Других сотрудников пока нет. Назначьте их в строке сотрудника.',
          })),
        ]}
        columns={columns}
        search={(row) => `${row.name} ${row.phone ?? ''}`}
        searchPlaceholder="Поиск специалиста"
        period={revenue ? revenueNav : null}
        footer={unattributed ? <span data-testid="employees-unattributed">{unattributed}</span> : null}
      />
      <Overlay
        open={editing !== null}
        onClose={() => guard.current(close)}
        title="Новый специалист"
        drawer
        size="md"
        trapFocus
      >
        <EmployeeTransitionGuard
          register={registerGuard}
          discard={() => setEpoch((value) => value + 1)}
        >
          <div key={`${scopeKey}:new:${epoch}`}>
            {editing && (
              <>
                <section aria-label="Бизнес и филиал" className="employee-workspace-heading">
                  <p>Бизнес: {businessName ?? 'Название недоступно'}</p>
                  <p>
                    Филиал:{' '}
                    {locationName ??
                      locations.find((item) => item.id === scopeKey)?.name ??
                      'Название недоступно'}
                  </p>
                </section>
                <EmployeeProfile
                  row={null}
                  onCancelCreate={() => guard.current(close)}
                  scopeKey={scopeKey}
                  canEdit={canCreate}
                  onSaved={savedProfile}
                />
              </>
            )}
          </div>
        </EmployeeTransitionGuard>
      </Overlay>
    </>
  );
}
